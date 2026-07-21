import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Fingerprint, LogOut } from "lucide-react";
import {
  hasBiometricEnrolled,
  isUnlocked,
  verifyBiometric,
  disableBiometric,
} from "@/lib/biometric";

export default function BiometricLock() {
  const { user, logout } = useAuth();
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLocked(false); return; }
    if (hasBiometricEnrolled(user.id) && !isUnlocked(user.id)) {
      setLocked(true);
    } else {
      setLocked(false);
    }
  }, [user]);

  useEffect(() => {
    if (!locked || !user) return;
    // Auto-prompt sur le premier montage
    void handleUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  const handleUnlock = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await verifyBiometric(user.id);
      if (ok) setLocked(false);
      else setError("Empreinte non reconnue. Réessayez.");
    } catch {
      setError("Vérification impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleUsePassword = async () => {
    if (!user) return;
    disableBiometric(user.id);
    await logout();
  };

  if (!locked || !user) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050b24]/95 backdrop-blur-xl px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 border border-blue-400/30 flex items-center justify-center shadow-[0_0_40px_rgba(79,140,255,0.25)]">
          <Fingerprint size={44} className="text-blue-300" />
        </div>
        <h1 className="text-white text-2xl font-semibold mb-2">Déverrouillage</h1>
        <p className="text-white/60 text-sm mb-8">
          Confirmez votre identité avec Face ID ou votre empreinte pour accéder à votre espace.
        </p>
        {error ? (
          <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-200 text-xs">
            {error}
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleUnlock}
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 text-white font-medium shadow-[0_10px_30px_rgba(47,95,255,0.35)] disabled:opacity-60"
        >
          {busy ? "Vérification…" : "Déverrouiller avec empreinte"}
        </button>
        <button
          type="button"
          onClick={handleUsePassword}
          className="mt-4 inline-flex items-center gap-1.5 text-white/55 hover:text-white text-xs"
        >
          <LogOut size={12} /> Utiliser mon mot de passe
        </button>
      </div>
    </div>
  );
}
