/**
 * DriverSelfieCapture — Étape 0 : selfie identité du convoyeur.
 *
 * Flow:
 *   1. Ouvrir caméra (capture="user") via clic direct utilisateur
 *   2. Preview immédiate du selfie capturé
 *   3. Footer sticky : Reprendre / Valider et continuer
 *   4. Validation = upload + insert + close (auto-advance côté parent)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, Check, X, AlertCircle, MapPin, RotateCcw, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image-compression";

const UPLOAD_TIMEOUT_MS = 20000;
const CAMERA_RETURN_GRACE_MS = 1200;

function withTimeout<T>(promise: Promise<T>, ms: number, label = "Délai dépassé"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

interface Props {
  attributionId: string;
  userId: string;
  onCaptured: () => Promise<void> | void;
  onClose: () => void;
}

const SELFIE_RESUME_PREFIX = "driver:selfie-resume:";
const SELFIE_DONE_PREFIX = "driver:selfie-done:";

function getSelfieResumeKey(attributionId: string) {
  return `${SELFIE_RESUME_PREFIX}${attributionId}`;
}

function getSelfieDoneKey(attributionId: string) {
  return `${SELFIE_DONE_PREFIX}${attributionId}`;
}

export function hasLocalSelfieDone(attributionId: string) {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(getSelfieDoneKey(attributionId)) === "1"
      || sessionStorage.getItem(getSelfieDoneKey(attributionId)) === "1";
  } catch {
    return false;
  }
}

function markLocalSelfieDone(attributionId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getSelfieDoneKey(attributionId), "1");
    sessionStorage.setItem(getSelfieDoneKey(attributionId), "1");
  } catch {
    // ignore
  }
}

export function hasPendingDriverSelfie(attributionId: string) {
  if (typeof window === "undefined") return false;
  const key = getSelfieResumeKey(attributionId);

  try {
    return sessionStorage.getItem(key) === "1" || localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function setPendingDriverSelfie(attributionId: string, active: boolean) {
  if (typeof window === "undefined") return;
  const key = getSelfieResumeKey(attributionId);

  try {
    if (active) {
      sessionStorage.setItem(key, "1");
      localStorage.setItem(key, "1");
      return;
    }

    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    // Ignore storage quota or privacy mode errors.
  }
}

function getPosition(): Promise<GeolocationPosition | null> {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      p => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}

async function materializeCapturedFile(raw: File) {
  const buffer = await raw.arrayBuffer();
  const safeType = raw.type && raw.type.startsWith("image/") ? raw.type : "image/jpeg";
  const safeName = raw.name || `selfie_${Date.now()}.jpg`;

  return new File([buffer], safeName, {
    type: safeType,
    lastModified: raw.lastModified || Date.now(),
  });
}

export function DriverSelfieCapture({ attributionId, userId, onCaptured, onClose }: Props) {
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle"|"uploading"|"success"|"error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{lat:number;lng:number}|null>(null);
  const [cameraOpening, setCameraOpening] = useState(false);
  const [liveCamera, setLiveCamera] = useState(false);
  const [cameraIssue, setCameraIssue] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);
  const cameraTimeoutRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canValidate = !!capturedFile && status !== "uploading" && status !== "success";

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setLiveCamera(false);
  }, []);

  const applyCapturedFile = useCallback(async (raw: File) => {
    const stableFile = await materializeCapturedFile(raw);
    if (preview) { try { URL.revokeObjectURL(preview); } catch { /* ignore */ } }

    stopStream();
    setCapturedFile(stableFile);
    setPreview(URL.createObjectURL(stableFile));
    setStatus("idle");
    setError(null);
    setCameraIssue(null);

    getPosition().then(p => { if (p) setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); });
  }, [preview, stopStream]);

  useEffect(() => {
    setPendingDriverSelfie(attributionId, true);
  }, [attributionId]);

  useEffect(() => {
    return () => {
      if (cameraTimeoutRef.current) {
        window.clearTimeout(cameraTimeoutRef.current);
      }
      stopStream();
      if (preview) {
        try { URL.revokeObjectURL(preview); } catch { /* ignore */ }
      }
    };
  }, [preview, stopStream]);

  const openCamera = async () => {
    if (status === "uploading") return;
    if (cameraTimeoutRef.current) {
      window.clearTimeout(cameraTimeoutRef.current);
    }
    setError(null);
    setCameraIssue(null);
    setCameraOpening(true);

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (cameraTimeoutRef.current) {
          window.clearTimeout(cameraTimeoutRef.current);
          cameraTimeoutRef.current = null;
        }

        stopStream();
        streamRef.current = stream;
        setLiveCamera(true);
        setCameraOpening(false);

        requestAnimationFrame(() => {
          if (!videoRef.current) return;
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "La caméra n’a pas pu être ouverte.";
        setCameraIssue(msg);
      }
    }

    if (!fileRef.current) {
      setCameraOpening(false);
      return;
    }

    cameraTimeoutRef.current = window.setTimeout(() => {
      setCameraOpening(false);
      cameraTimeoutRef.current = null;
    }, CAMERA_RETURN_GRACE_MS);
    fileRef.current.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (cameraTimeoutRef.current) {
      window.clearTimeout(cameraTimeoutRef.current);
      cameraTimeoutRef.current = null;
    }
    setCameraOpening(false);
    stopStream();
    if (!raw) return;

    try {
      await applyCapturedFile(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Le selfie n’a pas pu être préparé.";
      setStatus("error");
      setError(msg);
      toast.error("Échec selfie", { description: "Le selfie n’a pas pu être enregistré. Réessayez." });
    }
  };

  const captureFromLiveCamera = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setStatus("error");
      setError("Le flux caméra n'est pas prêt. Réessayez.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponible");

      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.92);
      });

      if (!blob) throw new Error("Capture vide");

      await applyCapturedFile(new File([blob], `selfie_${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Le selfie n’a pas pu être capturé.";
      setStatus("error");
      setError(msg);
      toast.error("Échec selfie", { description: msg });
    }
  };

  const retake = () => {
    if (preview) { try { URL.revokeObjectURL(preview); } catch { /* ignore */ } }
    setCapturedFile(null);
    setPreview(null);
    setStatus("idle");
    setError(null);
    setCameraOpening(false);
    setCameraIssue(null);
    stopStream();
    closingRef.current = false;
    setTimeout(openCamera, 50);
  };

  const finalizeStep = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    // Le selfie est déjà sauvegardé en base. On ferme tout de suite,
    // puis on déclenche la synchro parent en arrière-plan. Si le refresh
    // échoue, ça ne re-bloque PAS la mission : la prochaine lecture ira
    // bien chercher le selfie qui existe déjà.
    onClose();
    void Promise.resolve(onCaptured()).catch(() => {
      // silencieux : le parent retentera au prochain render / fetch
    });
  };

  const validate = async () => {
    if (!capturedFile) return;
    if (status === "uploading") return; // anti double-clic
    setStatus("uploading");
    setError(null);
    try {
      const pos = await getPosition();
      if (pos) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });

      let file: File;
      try { file = await compressImage(capturedFile); } catch { file = capturedFile; }

      const isJpeg = file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg");
      const ext = isJpeg ? "jpg" : (file.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "") || "jpg";
      const contentType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
      const path = `${userId}/${attributionId}/selfie_${Date.now()}.${ext}`;

      // Upload avec timeout strict + 1 retry — empêche tout chargement infini.
      const uploadOnce = () => supabase.storage
        .from("mission-selfies")
        .upload(path, file, { upsert: true, contentType });

      let upErr: unknown = null;
      try {
        const { error } = await withTimeout(uploadOnce(), UPLOAD_TIMEOUT_MS, "Délai d'envoi dépassé");
        upErr = error;
      } catch (e) {
        upErr = e;
      }
      if (upErr) {
        await new Promise(r => setTimeout(r, 800));
        try {
          const { error } = await withTimeout(uploadOnce(), UPLOAD_TIMEOUT_MS, "Délai d'envoi dépassé");
          upErr = error;
        } catch (e) {
          upErr = e;
        }
      }
      if (upErr) throw upErr instanceof Error ? upErr : new Error(String(upErr));

      const { error: dbErr } = await withTimeout(
        supabase.from("mission_selfies" as never).insert({
          attribution_id: attributionId,
          convoyeur_user_id: userId,
          storage_path: path,
          latitude: pos?.coords.latitude ?? null,
          longitude: pos?.coords.longitude ?? null,
          accuracy: pos?.coords.accuracy ?? null,
        } as never) as unknown as Promise<{ error: unknown }>,
        UPLOAD_TIMEOUT_MS,
        "Délai d'enregistrement dépassé",
      );
      if (dbErr) throw dbErr instanceof Error ? dbErr : new Error(String(dbErr));

      setStatus("success");
      markLocalSelfieDone(attributionId);
      setPendingDriverSelfie(attributionId, false);
      toast.success("Selfie validé", { description: "Passage automatique à l'étape suivante." });
      setTimeout(finalizeStep, 180);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec";
      setStatus("error");
      setError("Erreur lors de l'envoi du selfie. Réessayez.");
      closingRef.current = false;
      // On garde le fichier capturé en mémoire pour permettre le retry sans
      // refaire la photo, et le flag "selfie en attente d'envoi" reste actif.
      setPendingDriverSelfie(attributionId, true);
      toast.error("Échec selfie", { description: msg });
    }
  };

  const retryUpload = () => {
    if (status === "uploading") return;
    void validate();
  };

  return (
    <div className="driver-selfie-shell fixed inset-0 z-[80] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden overscroll-none">
      <div className="driver-selfie-header flex items-center justify-between px-4 py-3 text-white shrink-0">
        <button onClick={() => {
          setPendingDriverSelfie(attributionId, false);
          onClose();
        }} className="p-2 hover:bg-white/10 rounded-lg" aria-label="Fermer"><X size={20}/></button>
        <div className="text-center">
          <p className="driver-eyebrow opacity-80">Étape 1 — Identité</p>
          <p className="text-sm font-semibold">Selfie convoyeur</p>
        </div>
        <div className="w-9"/>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-3 pb-4">
        <div className="driver-selfie-stage relative flex h-full w-full max-w-md items-center justify-center overflow-hidden rounded-[24px] px-4 py-5">
        {preview ? (
          <img src={preview} alt="Selfie" className="max-h-full w-full rounded-[20px] object-contain"/>
        ) : liveCamera ? (
          <div className="relative h-full w-full overflow-hidden rounded-[20px] bg-black/40">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover scale-x-[-1]"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        ) : (
          <div className="text-center text-white/70 max-w-sm">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--driver-border-strong)] bg-white/6 shadow-[0_0_36px_-12px_rgba(59,130,246,0.55)]">
              <Camera size={40} className="text-[var(--driver-accent-2)]"/>
            </div>
            <p className="text-base font-semibold text-white mb-2">Prenez un selfie</p>
            <p className="text-sm opacity-80">Photo d'identité horodatée et géolocalisée. Visage net, bien éclairé.</p>
            {cameraIssue && <p className="mt-3 text-xs text-amber-200">{cameraIssue}</p>}
          </div>
        )}

        {status === "uploading" && (
          <div className="driver-selfie-status absolute top-4 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white">
            <Loader2 className="animate-spin" size={14}/> Envoi…
          </div>
        )}
        {status === "success" && (
          <div className="absolute top-4 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
            <Check size={14}/> Selfie validé
          </div>
        )}
        {status === "error" && (
          <div className="absolute top-4 left-1/2 flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700 truncate">
            <AlertCircle size={14}/> {error}
          </div>
        )}
        {coords && preview && (
          <div className="driver-selfie-status absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 text-[10px] text-white/80">
            <MapPin size={11}/> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
          </div>
        )}
        {liveCamera && !preview && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[10px] text-white/85">
            Cadrez votre visage puis capturez
          </div>
        )}
        </div>
      </div>

      {/* Sticky footer toujours visible */}
      <div className="driver-selfie-footer sticky bottom-0 shrink-0 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        {/* Input réel : visuellement caché mais PAS display:none (sinon
            certains Android/Chrome bloquent l'ouverture caméra). */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleFile}
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", left: -9999 }}
          tabIndex={-1}
          aria-hidden="true"
        />
        {!preview && liveCamera ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <button
              onClick={() => {
                stopStream();
                setCameraIssue(null);
              }}
              className="driver-secondary-cta flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[11px]"
            >
              <X size={16}/>
              <span className="leading-tight">Fermer caméra</span>
            </button>
            <button
              onClick={captureFromLiveCamera}
              className="driver-cta flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[11px]"
            >
              <Camera size={16}/>
              <span className="leading-tight">Capturer le selfie</span>
            </button>
          </div>
        ) : !preview ? (
          <button
            onClick={openCamera}
            disabled={cameraOpening || status === "uploading"}
            className="driver-cta flex w-full items-center justify-center gap-2 py-4 text-base font-bold"
          >
            {cameraOpening ? <Loader2 className="animate-spin" size={20}/> : <Camera size={20}/>}
            {cameraOpening ? "Ouverture de l'appareil photo…" : "Ouvrir l'appareil photo"}
          </button>
        ) : status === "error" ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <button
              onClick={retake}
              className="driver-secondary-cta flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[11px]"
            >
              <RotateCcw size={16}/>
              <span className="leading-tight">Reprendre photo</span>
            </button>
            <button
              onClick={retryUpload}
              className="driver-cta flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[11px]"
            >
              <RefreshCw size={16}/>
              <span className="leading-tight">Réessayer l'envoi</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <button
              onClick={retake}
              disabled={status === "uploading" || status === "success"}
              className="driver-secondary-cta flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[11px]"
            >
              <RotateCcw size={16}/>
              <span className="leading-tight">Reprendre selfie</span>
            </button>
            <button
              onClick={validate}
              disabled={!canValidate}
              className="driver-cta flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2 text-center text-[11px]"
            >
              {status === "uploading" ? <Loader2 className="animate-spin" size={18}/> : <Check size={18}/>}
              <span className="leading-tight">{status === "success" ? "Validation en cours" : "Valider et continuer"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
