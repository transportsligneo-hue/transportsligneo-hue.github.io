import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FactureNeonPayment, type FactureSummary } from "@/components/facture/FactureNeonPayment";
import { NeonPayBackdrop } from "@/components/facture/NeonPayBackdrop";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { ArrowLeft, ShieldCheck, Clock3, Building2 } from "lucide-react";

export const Route = createFileRoute("/paiement/facture/$factureId")({
  component: PaiementFacturePage,
  head: () => ({
    meta: [
      { title: "Paiement de facture — Transports Ligneo" },
      { name: "description", content: "Réglez votre facture de convoyage Transports Ligneo en ligne, paiement sécurisé par carte, Apple Pay, Google Pay ou SEPA." },
      { property: "og:title", content: "Paiement de facture — Transports Ligneo" },
      { property: "og:description", content: "Paiement sécurisé de votre facture de convoyage automobile Transports Ligneo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PaiementFacturePage() {
  const { factureId } = Route.useParams();
  const [summary, setSummary] = useState<FactureSummary | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const trajet = summary?.depart && summary?.arrivee
    ? { depart: summary.depart, arrivee: summary.arrivee }
    : null;

  return (
    <div className="pn-page">
      <NeonPayBackdrop />

      <aside className="pn-summary-panel">
        <div className="pn-brand">
          <div className="pn-brand-mark">
            <img src={logoLigneo} alt="Transports Ligneo" />
          </div>
          <div className="pn-brand-word">TRANSPORTS <span>LIGNEO</span></div>
        </div>

        <button type="button" className="pn-back-link" onClick={() => window.history.back()}>
          <ArrowLeft size={14} /> Retour
        </button>

        <div className="pn-eyebrow"><span className="pn-dot" /> Règlement de facture</div>

        <p className="pn-ref">Facture <b>{summary?.numero ?? "…"}</b></p>
        <div className="pn-amount">{summary ? `${summary.prixTtc.toFixed(2)} €` : "—"}</div>
        <p className="pn-amount-sub">
          Montant TTC{summary?.referenceClient ? ` · Réf. ${summary.referenceClient}` : ""}
        </p>

        {(trajet || summary?.designation) && (
          <div className="pn-route-card">
            {trajet ? (
              <>
                <div className="pn-route-row">
                  <div className="pn-route-dot-col">
                    <span className="pn-route-dot start" />
                    <span className="pn-route-line" />
                  </div>
                  <div className="pn-route-text"><span className="pn-tag">Enlèvement</span>{trajet.depart}</div>
                </div>
                <div className="pn-route-row">
                  <div className="pn-route-dot-col"><span className="pn-route-dot end" /></div>
                  <div className="pn-route-text"><span className="pn-tag">Livraison</span>{trajet.arrivee}</div>
                </div>
              </>
            ) : (
              <div className="pn-route-text"><span className="pn-tag">Prestation</span>{summary?.designation}</div>
            )}
          </div>
        )}

        <div className="pn-details">
          <div className="pn-detail-line"><span>Total HT</span><span>{summary ? `${summary.prixHt.toFixed(2)} €` : "—"}</span></div>
          <div className="pn-detail-line">
            <span>TVA{summary?.tvaTaux ? ` (${summary.tvaTaux} %)` : ""}</span>
            <span>{summary ? `${summary.prixTva.toFixed(2)} €` : "—"}</span>
          </div>
          <div className="pn-detail-line total"><span>Total TTC</span><span>{summary ? `${summary.prixTtc.toFixed(2)} €` : "—"}</span></div>
        </div>

        {summary?.clientSociete && (
          <p className="pn-client"><Building2 size={13} /> {summary.clientSociete}</p>
        )}

        <div className="pn-trust-row">
          <span className="pn-trust-item"><ShieldCheck size={14} /> Paiement sécurisé</span>
          <span className="pn-trust-item"><Clock3 size={14} /> Encaissement immédiat</span>
        </div>
      </aside>

      <main className="pn-pay-panel">
        {origin && (
          <FactureNeonPayment
            factureId={factureId}
            returnUrlBase={`${origin}/paiement/confirmation`}
            onSummary={setSummary}
          />
        )}
      </main>
    </div>
  );
}
