import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Se désabonner — Transports Ligneo" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function UnsubscribePage() {
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) { setStatus("invalid"); return; }

    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.valid) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      })
      .catch(() => setStatus("error"));
  }, []);

  const handleUnsubscribe = async () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) return;

    try {
      const res = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) setStatus("done");
      else if (data.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center section-bg px-4">
      <div className="w-full max-w-md text-center">
        <div className="gold-divider-short mb-4" />
        <h1 className="font-heading text-xl tracking-[0.15em] uppercase text-primary mb-6">
          Désabonnement
        </h1>

        <div className="card-premium p-8 rounded">
          {status === "loading" && <p className="text-cream/50 text-sm">Vérification...</p>}

          {status === "valid" && (
            <div className="space-y-4">
              <p className="text-cream/70 text-sm">Souhaitez-vous vous désabonner des emails de Transports Ligneo ?</p>
              <button
                onClick={handleUnsubscribe}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors"
              >
                Confirmer le désabonnement
              </button>
            </div>
          )}

          {status === "done" && (
            <p className="text-green-400 text-sm">✓ Vous avez été désabonné avec succès.</p>
          )}

          {status === "already" && (
            <p className="text-cream/50 text-sm">Vous êtes déjà désabonné.</p>
          )}

          {status === "invalid" && (
            <p className="text-destructive text-sm">Lien invalide ou expiré.</p>
          )}

          {status === "error" && (
            <p className="text-destructive text-sm">Une erreur est survenue. Veuillez réessayer.</p>
          )}
        </div>

        <a href="/" className="text-cream/40 text-xs hover:text-primary transition-colors mt-6 inline-block">
          ← Retour au site
        </a>
      </div>
    </div>
  );
}
