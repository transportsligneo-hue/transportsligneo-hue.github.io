import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FactureNeonPayment, type FactureSummary } from "@/components/facture/FactureNeonPayment";
import { NeonPayBackdrop } from "@/components/facture/NeonPayBackdrop";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";
import { ArrowLeft, ShieldCheck, Clock3, Lock } from "lucide-react";

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

      <header className="pn-topbar">
        <div className="pn-brand">
          <div className="pn-brand-mark">
            <img src={logoLigneo} alt="Transports Ligneo" />
          </div>
          <div className="pn-brand-text">
            <span className="pn-brand-name">TRANSPORTS <span>LIGNEO</span></span>
            <span className="pn-brand-tag">Convoyage automobile</span>
          </div>
        </div>
        <div className="pn-secure-pill">
          <Lock size={15} /> Paiement sécurisé SSL
        </div>
      </header>

      <div className="pn-wrap">
        <aside className="pn-summary">
          <button type="button" className="pn-back-link" onClick={() => window.history.back()}>
            <ArrowLeft size={14} /> Retour
          </button>

          <div className="pn-kicker">Règlement de facture</div>
          <h1>Facture {summary?.numero ?? "…"}</h1>

          <div className="pn-row">
            <span className="pn-label">Référence</span>
            <span className="pn-val">{summary?.referenceClient ?? summary?.numero ?? "—"}</span>
          </div>
          {summary?.clientSociete && (
            <div className="pn-row">
              <span className="pn-label">Client</span>
              <span className="pn-val">{summary.clientSociete}</span>
            </div>
          )}
          {summary?.numeroMission && (
            <div className="pn-row">
              <span className="pn-label">Mission</span>
              <span className="pn-val">{summary.numeroMission}</span>
            </div>
          )}
          {summary?.vehicule && (
            <div className="pn-row">
              <span className="pn-label">Véhicule</span>
              <span className="pn-val">{summary.vehicule}</span>
            </div>
          )}
          {summary?.immatriculation && (
            <div className="pn-row">
              <span className="pn-label">Plaque</span>
              <span className="pn-val pn-plate">{summary.immatriculation}</span>
            </div>
          )}
          {summary?.dateMission && (
            <div className="pn-row">
              <span className="pn-label">Date de convoyage</span>
              <span className="pn-val">
                {new Date(`${summary.dateMission}T00:00:00`).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
          {summary?.designation && (
            <div className="pn-row">
              <span className="pn-label">Prestation</span>
              <span className="pn-val">{summary.designation}</span>
            </div>
          )}

          {trajet && (
            <div className="pn-route-box">
              <div className="pn-route-line">
                <span className="pn-rdot a" />
                <span className="pn-route-track" />
                <span className="pn-rdot b" />
              </div>
              <div className="pn-route-cities">
                <div>
                  <div className="pn-route-city">{trajet.depart}</div>
                  <div className="pn-route-sub">Enlèvement</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="pn-route-city">{trajet.arrivee}</div>
                  <div className="pn-route-sub">Livraison</div>
                </div>
              </div>
            </div>
          )}

          <div className="pn-total-box">
            <div className="pn-trow"><span>Total HT</span><span>{summary ? `${summary.prixHt.toFixed(2)} €` : "—"}</span></div>
            <div className="pn-trow">
              <span>TVA{summary?.tvaTaux ? ` (${summary.tvaTaux} %)` : ""}</span>
              <span>{summary ? `${summary.prixTva.toFixed(2)} €` : "—"}</span>
            </div>
            <div className="pn-trow grand"><span>Total TTC</span><span>{summary ? `${summary.prixTtc.toFixed(2)} €` : "—"}</span></div>
          </div>

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
    </div>
  );
}
