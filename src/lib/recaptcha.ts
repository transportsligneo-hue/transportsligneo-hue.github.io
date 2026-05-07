/**
 * reCAPTCHA v3 client helper.
 * Site key publique — OK dans le bundle.
 */
export const RECAPTCHA_SITE_KEY = "6Lc_29ssAAAAAEnceoullPjxKYicHlPDekkviVZz";

let loadingPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).grecaptcha?.execute) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-recaptcha="v3"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("recaptcha load failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    s.async = true;
    s.defer = true;
    s.dataset.recaptcha = "v3";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("recaptcha load failed"));
    document.head.appendChild(s);
  });
  return loadingPromise;
}

/**
 * Récupère un token reCAPTCHA v3 pour une action donnée.
 * Retourne null si l'environnement ne supporte pas (SSR / offline).
 */
export async function getRecaptchaToken(action: string): Promise<string | null> {
  try {
    if (typeof window === "undefined") return null;
    await loadScript();
    const grecaptcha = (window as any).grecaptcha;
    if (!grecaptcha?.ready || !grecaptcha?.execute) return null;
    await new Promise<void>((res) => grecaptcha.ready(res));
    const token: string = await grecaptcha.execute(RECAPTCHA_SITE_KEY, { action });
    return token || null;
  } catch (err) {
    console.warn("[recaptcha] token error", err);
    return null;
  }
}
