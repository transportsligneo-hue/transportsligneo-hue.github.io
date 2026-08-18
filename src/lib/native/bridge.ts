/**
 * Pont natif Capacitor — 100 % optionnel.
 *
 * Toutes les fonctions sont sûres côté web : si l'app ne tourne pas dans la
 * coquille native, elles retombent sur les APIs navigateur (ou ne font rien).
 * Les plugins sont importés dynamiquement pour ne jamais alourdir le bundle
 * du site public ni casser le rendu serveur.
 */

export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return w.Capacitor?.isNativePlatform?.() === true;
}

export function nativePlatform(): "ios" | "android" | "web" {
  if (typeof window === "undefined") return "web";
  const w = window as unknown as { Capacitor?: { getPlatform?: () => string } };
  const p = w.Capacitor?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
}

/* ------------------------------------------------------------------ */
/* Géolocalisation                                                     */
/* ------------------------------------------------------------------ */

/** Demande la permission GPS native (no-op sur le web). */
export async function ensureLocationPermission(): Promise<boolean> {
  if (!isNativeApp()) return true;
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const status = await Geolocation.checkPermissions();
    if (status.location === "granted") return true;
    const asked = await Geolocation.requestPermissions();
    return asked.location === "granted";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Caméra                                                              */
/* ------------------------------------------------------------------ */

/**
 * Prend une photo via l'appareil natif et renvoie un File exploitable par les
 * flux existants (EDL, incidents…). Renvoie null hors coquille native.
 */
export async function takeNativePhoto(): Promise<File | null> {
  if (!isNativeApp()) return null;
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 82,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      correctOrientation: true,
    });
    if (!photo.webPath) return null;
    const blob = await (await fetch(photo.webPath)).blob();
    const ext = photo.format || "jpeg";
    return new File([blob], `photo-${Date.now()}.${ext}`, { type: blob.type || `image/${ext}` });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Partage / enregistrement de fichiers (PDF)                          */
/* ------------------------------------------------------------------ */

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read error"));
    reader.onload = () => {
      const res = String(reader.result || "");
      resolve(res.slice(res.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Enregistre puis propose le partage natif d'un document (PDF).
 * Renvoie false si non natif : l'appelant garde son téléchargement web.
 */
export async function shareNativeFile(blob: Blob, filename: string, title = "Document Ligneo"): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const data = await blobToBase64(blob);
    const written = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Cache,
    });
    await Share.share({ title, files: [written.uri] });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Notifications push natives                                          */
/* ------------------------------------------------------------------ */

/**
 * Enregistre l'appareil auprès d'APNs / FCM et transmet le token.
 * Le Web Push existant reste utilisé côté navigateur.
 */
export type NativePushEvent = { title?: string; body?: string; url?: string; data?: Record<string, unknown> };

export async function registerNativePush(
  onToken: (token: string, platform: "ios" | "android") => void | Promise<void>,
  handlers?: {
    onReceived?: (e: NativePushEvent) => void;
    onAction?: (e: NativePushEvent) => void;
    onError?: (message: string) => void;
  },
): Promise<boolean> {
  if (!isNativeApp()) return false;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // Canal Android dédié aux alertes missions (requis Android 8+).
    if (nativePlatform() === "android") {
      try {
        await PushNotifications.createChannel({
          id: "missions",
          name: "Alertes missions",
          description: "Nouvelles missions, attributions et rappels",
          importance: 5,
          visibility: 1,
        });
      } catch { /* noop */ }
    }

    const perm = await PushNotifications.checkPermissions();
    let granted = perm.receive === "granted";
    if (!granted) {
      const asked = await PushNotifications.requestPermissions();
      granted = asked.receive === "granted";
    }
    if (!granted) return false;

    // Les listeners doivent être posés AVANT register() pour ne pas rater
    // l'évènement "registration" (sinon aucun token n'est jamais reçu).
    await PushNotifications.removeAllListeners().catch(() => {});
    await PushNotifications.addListener("registration", (t) => {
      void onToken(t.value, nativePlatform() === "ios" ? "ios" : "android");
    });
    await PushNotifications.addListener("registrationError", (e: unknown) => {
      handlers?.onError?.(String((e as { error?: string })?.error ?? "registration error"));
    });
    await PushNotifications.addListener("pushNotificationReceived", (n) => {
      handlers?.onReceived?.({
        title: n.title,
        body: n.body,
        url: (n.data as Record<string, string> | undefined)?.url,
        data: n.data as Record<string, unknown>,
      });
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
      const d = (a.notification?.data ?? {}) as Record<string, unknown>;
      handlers?.onAction?.({
        title: a.notification?.title,
        body: a.notification?.body,
        url: typeof d.url === "string" ? d.url : undefined,
        data: d,
      });
    });

    await PushNotifications.register();
    return true;
  } catch (e) {
    handlers?.onError?.(e instanceof Error ? e.message : "push natif indisponible");
    return false;
  }
}
