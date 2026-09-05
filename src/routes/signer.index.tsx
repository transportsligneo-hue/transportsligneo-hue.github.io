/**
 * /signer · saisie manuelle du code de pairage à 6 caractères.
 *
 * Alternative au QR code affiché sur l'ordinateur : le signataire tape le code,
 * le serveur le vérifie et renvoie le lien secret de la session de signature.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, PenLine } from "lucide-react";

export const Route = createFileRoute("/signer/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signer un document · Transports Ligneo" },
      { name: "description", content: "Saisissez le code affiché sur l'ordinateur pour signer le document au doigt." },
      { property: "og:title", content: "Signer un document · Transports Ligneo" },
      { property: "og:description", content: "Signature tactile d'un document de mission depuis votre téléphone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: SignerCodePage,
});

function SignerCodePage() {
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
      const res = await fetch("/api/public/sign/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve_code", code: clean }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Code inconnu ou expiré");
        return;
      }
      void navigate({ to: "/signer/$token", params: { token: json.token as string } });
    } catch {
      setError("Connexion impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0b1026] to-[#111a3d] p-6 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-[#d4af37]/30 bg-white/5 p-6">
        <div className="flex items-center gap-2 text-[#e7c76a]">
          <PenLine size={18} />
          <span className="text-xs uppercase tracking-[0.25em]">Transports Ligneo</span>
        </div>
        <h1 className="mt-3 text-xl font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
          Signer un document
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Saisissez le code à 6 caractères affiché sur l'ordinateur.
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <label className="sr-only" htmlFor="sign-code">Code de pairage</label>
          <input
            id="sign-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
            autoCapitalize="characters"
            autoCorrect="off"
            inputMode="text"
            placeholder="A1B2C3"
            className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-center text-2xl tracking-[0.4em] text-white outline-none focus:border-[#d4af37]"
          />
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d4af37] px-4 py-3 text-sm font-semibold text-[#0b1026] disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
            Continuer
          </button>
        </form>
      </div>
    </div>
  );
}
