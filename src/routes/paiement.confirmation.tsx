import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { logoLigneoSeasonal as logoLigneo } from "@/lib/seasonal-logo";
import { CheckCircle2, Loader2, AlertTriangle, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/paiement/confirmation")({
  component: ConfirmationPage,
  head: () => ({
    meta: [
      { title: "Paiement confirmé — Transports Ligneo" },
      { name: "description", content: "Confirmation de votre paiement de facture Transports Ligneo : reçu, facture acquittée et suivi de mission." },
      { property: "og:title", content: "Paiement confirmé — Transports Ligneo" },
      { property: "og:description", content: "Votre paiement Transports Ligneo a bien été enregistré." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type State = "pending" | "ok" | "failed";

function ConfirmationPage() {
  const [state, setState] = useState<State>("pending");
  const [info, setInfo] = useState<{ numero?: string; montant?: number; trajet?: string | null; email?: string | null }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectStatus = params.get("redirect_status");
    const pi = params.get("payment_intent");
    if (redirectStatus && redirectStatus !== "succeeded" && redirectStatus !== "processing") {
      setState("failed");
      return;
    }
    if (!pi) { setState("ok"); return; }

    let tries = 0;
    let cancelled = false;
    const poll = async () => {
      tries += 1;
      try {
        const res = await fetch(`/api/public/facture/statut?pi=${encodeURIComponent(pi)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setInfo({ numero: data.numero, montant: data.montant, trajet: data.trajet, email: data.email });
          if (data.paid) { setState("ok"); return; }
        }
      } catch { /* retry */ }
      if (!cancelled) {
        if (tries >= 8) setState("ok");
        else setTimeout(poll, 1500);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="pn-success-screen">
      <section className="pn-success-card">
        <div className="pn-check-wrap">
          <div className={`pn-check-circle${state === "pending" ? " pending" : state === "failed" ? " failed" : ""}`}>
            {state === "pending" && <Loader2 size={44} className="animate-spin" />}
            {state === "ok" && <CheckCircle2 size={52} />}
            {state === "failed" && <AlertTriangle size={44} />}
            {state === "ok" && <span className="pn-pulse-ring" />}
          </div>
        </div>

        {state === "pending" && (
          <>
            <h1>Validation du paiement…</h1>
            <p>Nous confirmons l'encaissement auprès de notre prestataire bancaire.</p>
          </>
        )}

        {state === "ok" && (
          <>
            <h1>Paiement confirmé</h1>
            <p>
              {info.numero ? <>La facture <b>{info.numero}</b> est acquittée.</> : "Votre paiement a bien été enregistré."}
            </p>
            <div className="pn-success-info">
              {info.numero && <div className="pn-srow"><span>Facture</span><b>{info.numero}</b></div>}
              {info.montant != null && (
                <div className="pn-srow amt"><span>Montant réglé</span><b>{Number(info.montant).toFixed(2)} € TTC</b></div>
              )}
              {info.trajet && <div className="pn-srow"><span>Trajet</span><b>{info.trajet}</b></div>}
              <div className="pn-srow">
                <span>Confirmation</span>
                <b>{info.email ? info.email : "Email envoyé"}</b>
              </div>
            </div>
          </>
        )}

        {state === "failed" && (
          <>
            <h1>Paiement non abouti</h1>
            <p>Le règlement n'a pas été validé par votre banque. Aucun montant n'a été débité.</p>
          </>
        )}

        <div className="pn-success-actions">
          <a className="pn-btn-primary" href="/">
            Retour à l'accueil <ArrowRight size={16} />
          </a>
        </div>

        <div className="pn-success-brand">
          <img src={logoLigneo()} alt="Transports Ligneo" />
          <span>TRANSPORTS LIGNEO · Convoyage automobile</span>
        </div>
      </section>
    </div>
  );
}
