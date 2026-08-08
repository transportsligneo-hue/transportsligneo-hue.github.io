import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { NeonPayBackdrop } from "@/components/facture/NeonPayBackdrop";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
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
    <div className="pn-page pn-page--center">
      <NeonPayBackdrop />
      <section className="pn-confirm-card">
        <div className="pn-brand">
          <div className="pn-brand-mark"><img src={logoLigneo} alt="Transports Ligneo" /></div>
          <div className="pn-brand-word">TRANSPORTS <span>LIGNEO</span></div>
        </div>

        {state === "pending" && (
          <>
            <div className="pn-confirm-icon pending"><Loader2 size={34} className="animate-spin" /></div>
            <h1>Validation du paiement…</h1>
            <p>Nous confirmons l'encaissement auprès de notre prestataire bancaire.</p>
          </>
        )}

        {state === "ok" && (
          <>
            <div className="pn-confirm-icon ok"><CheckCircle2 size={38} /></div>
            <h1>Paiement confirmé</h1>
            <p>
              {info.numero ? <>La facture <b>{info.numero}</b> est acquittée</> : "Votre paiement a bien été enregistré"}
              {info.montant ? <> · <b>{Number(info.montant).toFixed(2)} € TTC</b></> : null}.
            </p>
            {info.trajet && <p className="pn-confirm-sub">{info.trajet}</p>}
            <p className="pn-confirm-sub">
              Un email de confirmation{info.email ? ` a été envoyé à ${info.email}` : " vous a été envoyé"} avec la facture acquittée en pièce jointe.
            </p>
          </>
        )}

        {state === "failed" && (
          <>
            <div className="pn-confirm-icon failed"><AlertTriangle size={34} /></div>
            <h1>Paiement non abouti</h1>
            <p>Le règlement n'a pas été validé par votre banque. Aucun montant n'a été débité.</p>
          </>
        )}

        <a className="pn-confirm-cta" href="/">
          Retour à l'accueil <ArrowRight size={16} />
        </a>
      </section>
    </div>
  );
}
