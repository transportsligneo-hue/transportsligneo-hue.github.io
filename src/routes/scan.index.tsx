/**
 * /scan · saisie manuelle du code de pairage à 6 caractères.
 *
 * Alternative au QR code : le visiteur tape le code affiché sur son ordinateur,
 * le serveur le vérifie et renvoie le token de la session (30 min de validité).
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, Smartphone } from "lucide-react";

export const Route = createFileRoute("/scan/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connexion scanner · Transports Ligneo" },
      { name: "description", content: "Saisissez le code affiché sur votre ordinateur pour scanner un document." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: ScanCodePage,
});

function ScanCodePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) { setError("Le code comporte 6 caractères."); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/scan/handoff-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", code: clean }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Code inconnu ou expiré");
        return;
      }
      void navigate({ to: "/scan/$token", params: { token: json.token as string } });
    } catch {
      setError("Connexion impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7ff] text-[#0b1026] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 text-[#2f5fff]">
          <Smartphone size={18} />
          <span className="text-xs uppercase tracking-[0.25em]">Transports Ligneo</span>
        </div>
        <h1 className="mt-3 text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
          Code de connexion
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Saisissez le code à 6 caractères affiché sur votre ordinateur.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="sr-only" htmlFor="scan-code">Code de connexion</label>
          <input
            id="scan-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            placeholder="ABC123"
            className="w-full rounded-xl bg-[#f4f7ff] border border-slate-200 px-4 py-4 text-center font-mono text-2xl tracking-[0.4em] text-[#2f5fff] outline-none focus:border-[#4f8cff]"
          />
          {error && <p className="text-red-600 text-xs text-center">{error}</p>}
          <button
            type="submit"
            disabled={busy || code.length !== 6}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#2f5fff] to-[#4f8cff] text-white font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
            Continuer
          </button>
        </form>
      </div>
    </div>
  );
}
