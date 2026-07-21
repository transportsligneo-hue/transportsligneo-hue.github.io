import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Fingerprint, X } from "lucide-react";
import {
  isBiometricSupported,
  hasBiometricEnrolled,
  enableBiometric,
} from "@/lib/biometric";

const DISMISS_KEY = (uid: string) => `ligneo_bio_prompt_dismissed_${uid}`;

export default function BiometricEnrollPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setVisible(false); return; }
    let cancelled = false;
    (async () => {
      if (hasBiometricEnrolled(user.id)) return;
      try {
        if (localStorage.getItem(DISMISS_KEY(user.id)) === "1") return;
      } catch { /* ignore */ }
      const supported = await isBiometricSupported();
      if (!cancelled && supported) setVisible(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!visible || !user) return null;

  const handleEnable = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await enableBiometric(user.id, user.email ?? "");
      setVisible(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Impossible d'activer l'empreinte";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY(user.id), "1"); } catch { /* ignore */ }
    setVisible(false);
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[80] w-[calc(100%-1.5rem)] max-w-md
      bottom-[calc(env(safe-area-inset-bottom)+80px)] md:bottom-6">
      <div className="relative rounded-2xl border border-blue-400/30 bg-[#0a1740]/95 backdrop-blur-xl p-4 pr-10 shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Ignorer"
          className="absolute top-2.5 right-2.5 text-white/50 hover:text-white p-1"
        >
          <X size={14} />
        </button>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-400/30 flex items-center justify-center">
            <Fingerprint size={22} className="text-blue-300" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold">Déverrouillage rapide</p>
            <p className="text-white/65 text-[12px] mt-0.5 leading-snug">
              Activez Face ID / empreinte pour accéder à votre espace en un geste.
            </p>
            {error ? (
              <p className="mt-2 text-[11px] text-red-300">{error}</p>
            ) : null}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleEnable}
                disabled={busy}
                className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-3.5 py-1.5 text-white text-[12px] font-medium disabled:opacity-60"
              >
                {busy ? "Activation…" : "Activer"}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="text-white/55 hover:text-white text-[12px]"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
