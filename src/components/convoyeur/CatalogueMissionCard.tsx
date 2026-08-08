import { useEffect, useState } from "react";
import { missionRequiredNiveau } from "@/lib/mission-level";
import { niveauLabel, canAccessNiveau } from "@/lib/convoyeur-niveau";
import { isElectricEnergie, guessElectricFromModel } from "@/lib/vehicule-electrique";

export interface CatalogTrajet {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  marque: string | null;
  modele: string | null;
  distance_km?: number | null;
  duree_estimee_min?: number | null;
  kilometrage_estime?: number | null;
  type_carburant?: string | null;
  prix_convoyeur_fixe: number | null;
  prix_convoyeur: number | null;
  prix_suggere: number | null;
  attribution_mode: string;
  allow_counter_offer: boolean;
  proposal_expires_at: string | null;
  urgence?: string | null;
  leg_type: string | null;
  mission_group_id: string | null;
  statut_publication?: string | null;
  created_at: string;
  published_at: string | null;
  depart_lat?: number | null;
  depart_lng?: number | null;
  niveau_requis?: string | null;
  vehicule_energie?: string | null;
  publisher_nom?: string | null;
  publisher_logo_url?: string | null;
  publisher_verifie?: boolean | null;
  groupedLegs?: CatalogTrajet[];
  isGroupedAr?: boolean;
}


interface Props {
  trajet: CatalogTrajet;
  distanceFromMe?: number | null;
  myOfferStatus?: string | null;
  myOfferPrice?: number | null;
  canApply: boolean;
  /** Niveau du convoyeur connecté (pour verrouiller les missions trop élevées). */
  driverNiveau?: string | null;
  onOpen: () => void;
  onQuickApply: () => void;
}

/* ---------- Icônes (identiques à la maquette) ---------- */
const S = (p: { children: React.ReactNode; fill?: string; sw?: number }) => (
  <svg viewBox="0 0 24 24" fill={p.fill ?? "none"} stroke={p.fill ? "none" : "currentColor"} strokeWidth={p.sw ?? 2.4}>
    {p.children}
  </svg>
);
const IcoLink = () => (
  <S>
    <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </S>
);
const IcoArrow = () => (<S><path d="M5 12h14M13 5l7 7-7 7" /></S>);
const IcoDoc = () => (<S><path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /><path d="M14 2v6h6" /></S>);
const IcoBolt = () => (<S fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></S>);
const IcoThermal = () => (
  <S sw={2}>
    <path d="M6 22h8a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2z" />
    <path d="M18 5l3 3v9" />
    <path d="M18 11V5h-3" />
    <circle cx="10" cy="17" r="1.5" fill="currentColor" />
  </S>
);
const IcoCal = () => (<S sw={2}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></S>);
const IcoClock = () => (<S sw={2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></S>);
const IcoCheck = () => (<S sw={2}><path d="M9 11l3 3 8-8" /></S>);
const IcoPin = () => (<S sw={2}><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></S>);
const IcoCar = () => (<S sw={2}><path d="M5 17h14M6 17v2M18 17v2" /><path d="M4 13l1.5-5A2 2 0 0 1 7.4 6.6h9.2A2 2 0 0 1 18.5 8L20 13v4H4z" /></S>);
const IcoLock = () => (<S sw={2}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></S>);

function useCountdown(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return null;
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "Expirée";
  const h = Math.floor(diff / 3600_000);
  const m = Math.floor((diff % 3600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)} j restants`;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")} restants`;
  return `${m} min restantes`;
}

const OFFER_LABEL: Record<string, string> = {
  en_attente: "Candidature envoyée",
  contre_offre_admin: "Contre-offre reçue",
  accepte: "Acceptée",
  acceptee: "Acceptée",
};

export function CatalogueMissionCard({
  trajet: t,
  distanceFromMe,
  myOfferStatus,
  myOfferPrice,
  canApply,
  driverNiveau,
  onOpen,
  onQuickApply,
}: Props) {
  const price = t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? 0;
  const isAR = Boolean(t.isGroupedAr || (!!t.leg_type && t.leg_type !== "simple"));
  const urgent = t.urgence === "immediat" || t.urgence === "urgent";
  const fresh = t.published_at
    ? Date.now() - new Date(t.published_at).getTime() < 24 * 3600_000
    : false;
  const countdown = useCountdown(t.proposal_expires_at);
  const requis = missionRequiredNiveau({
    niveau_requis: t.niveau_requis,
    distance_km: t.distance_km,
    urgence: t.urgence,
  });
  const level = niveauLabel(requis);
  const locked = !canAccessNiveau(driverNiveau, requis);
  const isElectric =
    isElectricEnergie(t.type_carburant) ||
    isElectricEnergie(t.vehicule_energie) ||
    guessElectricFromModel(t.marque, t.modele);

  const retourLeg = (t.groupedLegs ?? []).find((l) => l.leg_type === "retour");
  const dateLabel = t.date_trajet
    ? new Date(t.date_trajet).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })
    : null;

  return (
    <article className={`cat2-card${locked ? " is-locked" : ""}`} onClick={onOpen}>
      {/* Badges */}
      <div className="cat2-badges">
        <span className={`cat2-badge ${isAR ? "linked" : "simple"}`}>
          {isAR ? <IcoLink /> : <IcoArrow />}
          {isAR ? "Livraison + Restitution" : "Livraison simple"}
        </span>
        {isAR && (
          <span className="cat2-badge doc"><IcoDoc />2 états des lieux</span>
        )}
        <span className="cat2-badge level">
          {locked && <IcoLock />}
          {level}
        </span>
        {urgent && <span className="cat2-badge urgent"><IcoBolt />Urgente</span>}
        {fresh && <span className="cat2-badge new">Nouveau</span>}
        {isElectric ? (
          <span className="cat2-ev">
            <span className="bolt"><IcoBolt /></span>
            Électrique
          </span>
        ) : (
          <span className="cat2-thermal"><IcoThermal />Thermique</span>
        )}
      </div>

      {/* Itinéraire */}
      <div className="cat2-route">
        <div className="cat2-stop pickup">
          <div className="cat2-eyebrow">Prise en charge du véhicule</div>
          <div className="cat2-addr">{t.depart}</div>
        </div>
        <div className="cat2-stop delivery">
          <div className="cat2-eyebrow">Livraison du véhicule</div>
          <div className="cat2-addr">{t.arrivee}</div>
          {isAR && (
            <span className="cat2-tag">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
              </svg>
              Étape liée à la restitution
            </span>
          )}
        </div>
        {isAR && (
          <div className="cat2-stop restitution">
            <div className="cat2-eyebrow">Restitution du véhicule</div>
            <div className="cat2-addr">{retourLeg?.arrivee ?? t.depart}</div>
          </div>
        )}
      </div>

      {/* Méta */}
      <div className="cat2-meta">
        {dateLabel && (
          <div className="cat2-meta-item"><IcoCal /><b>{dateLabel}</b></div>
        )}
        {t.heure_trajet && (
          <div className="cat2-meta-item"><IcoClock /><b>{t.heure_trajet.slice(0, 5)}</b></div>
        )}
        {isAR && <div className="cat2-meta-item"><IcoCheck />Mission groupée</div>}
        {typeof t.distance_km === "number" && (
          <div className="cat2-meta-item"><IcoCar />{Math.round(t.distance_km)} km</div>
        )}
        {distanceFromMe != null && (
          <div className="cat2-meta-item"><IcoPin />à {Math.round(distanceFromMe)} km de vous</div>
        )}
        {countdown && (
          <div className="cat2-meta-item"><IcoClock />{countdown}</div>
        )}
      </div>

      {/* Prix + statut */}
      <div className="cat2-price-row">
        <div className="cat2-price">
          <div className="k">Rémunération</div>
          <div className="v">
            {price.toFixed(0)}
            <span className="cur">€</span>
          </div>
        </div>
        {myOfferStatus ? (
          <span className="cat2-status">
            <span className="dt" />
            {OFFER_LABEL[myOfferStatus] ?? "En attente"}
            {typeof myOfferPrice === "number" ? ` · ${myOfferPrice.toFixed(0)} €` : ""}
          </span>
        ) : (
          <span className="cat2-status ok"><span className="dt" />Disponible</span>
        )}
      </div>

      {/* CTA */}
      {locked ? (
        <button type="button" className="cat2-accept locked" disabled>
          <IcoLock />
          Réservé aux convoyeurs {level}
          {requis === "confirme" ? "+" : ""}
        </button>
      ) : myOfferStatus ? (
        <button
          type="button"
          className="cat2-accept"
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          <IcoDoc />
          Voir ma candidature
        </button>
      ) : (
        <button
          type="button"
          className="cat2-accept"
          disabled={!canApply}
          onClick={(e) => { e.stopPropagation(); if (canApply) onQuickApply(); }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg>
          Accepter la mission
        </button>
      )}
    </article>
  );
}
