import { useEffect, useState } from "react";
import { missionRequiredNiveau } from "@/lib/mission-level";
import { niveauLabel, canAccessNiveau } from "@/lib/convoyeur-niveau";
import { isElectricEnergie, guessElectricFromModel } from "@/lib/vehicule-electrique";
import { MissionPublisherChip } from "./MissionPublisherChip";
import { Ic } from "@/components/driver2/icons";
import { AuctionStrip, EnchTile, MissionChips, RouteMap, VehicleTile, type AuctionInfo } from "@/components/driver2/mission-bits";
import { vehicleCategory } from "@/lib/vehicle-category";
import "@/styles/driver-v2.css";

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
  /** Options du catalogue (fonction list_catalogue_extras). */
  equipements_requis?: string[];
  carburant_mode?: string | null;
  mise_en_main?: boolean;
  enchere?: AuctionInfo | null;
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
  /** Heure de livraison (ex. « 14h00 »), si connue. */
  livraisonLabel?: string | null;
  onOpen: () => void;
  onQuickApply: () => void;
  /** Ouvre la fiche d'enchère (missions en enchère). */
  onAuction?: () => void;
}

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
  livraisonLabel,
  onOpen,
  onQuickApply,
  onAuction,
}: Props) {
  const price = Number(t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? 0) || 0;
  const isAR = Boolean(t.isGroupedAr || (!!t.leg_type && t.leg_type !== "simple"));
  const urgent = t.urgence === "immediat" || t.urgence === "urgent";
  const fresh = t.published_at ? Date.now() - new Date(t.published_at).getTime() < 24 * 3600_000 : false;
  const countdown = useCountdown(t.proposal_expires_at);
  const requis = missionRequiredNiveau({ niveau_requis: t.niveau_requis, distance_km: t.distance_km, urgence: t.urgence });
  const level = niveauLabel(requis);
  const locked = !canAccessNiveau(driverNiveau, requis);
  const isElectric =
    isElectricEnergie(t.type_carburant) || isElectricEnergie(t.vehicule_energie) || guessElectricFromModel(t.marque, t.modele);

  const legs = [t, ...(t.groupedLegs ?? [])];
  const retourLeg = legs.find((l) => l.leg_type === "retour");
  // Toujours afficher le trajet dans l'ordre Livraison puis Restitution,
  // même si la carte est portée par la jambe retour.
  const allerLeg = legs.find((l) => l.leg_type === "aller");
  const routeDepart = allerLeg?.depart ?? (t.leg_type === "retour" ? t.arrivee : t.depart);
  const routeArrivee = allerLeg?.arrivee ?? (t.leg_type === "retour" ? t.depart : t.arrivee);
  const routeRetour = retourLeg?.arrivee ?? routeDepart;
  const dateLabel = t.date_trajet
    ? new Date(t.date_trajet).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })
    : null;
  const vehicule = [t.marque, t.modele].filter(Boolean).join(" ");
  const ench = t.enchere ?? null;

  return (
    <div className="drv2">
      <article className={`card cmx${locked ? " is-locked" : ""}`} onClick={onOpen} style={locked ? { opacity: 0.78 } : undefined}>
        <div className="vhead" style={{ padding: "0 0 10px" }}>
          <VehicleTile marque={t.marque} modele={t.modele} ev={isElectric} />
          {ench && <EnchTile />}
        </div>

        <div className="row" style={{ gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          {urgent && <span className="badge-new badge-urg">Urgente</span>}
          {fresh && <span className="badge-new">Nouveau</span>}
          <span className="badge-new" style={{ background: "rgba(47,95,255,.1)", color: "#2147c9", borderColor: "rgba(47,95,255,.3)" }}>
            {locked && <Ic n="lock" s={11} sw={2.4} />}{level}
          </span>
          {isAR && <span className="badge-new">Restitution et livraison</span>}
          <span className="sp" />
          {dateLabel && <span className="tiny mut">{dateLabel}</span>}
        </div>

        <MissionChips
          ev={isElectric}
          categorie={vehicleCategory(t.marque, t.modele)}
          carburant={t.carburant_mode}
          miseEnMain={t.mise_en_main}
          requis={t.equipements_requis}
        />

        <MissionPublisherChip compact nom={t.publisher_nom} logoUrl={t.publisher_logo_url} verifie={t.publisher_verifie} />

        <RouteMap dep={routeDepart} arr={routeArrivee} km={t.distance_km} near={distanceFromMe ?? null} />

        <div className="row" style={{ gap: 12, marginTop: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#14B866" }} />
            <i style={{ width: 1, height: isAR ? 52 : 26, background: "var(--line)" }} />
            <i style={{ width: 10, height: 10, borderRadius: "50%", background: "#2f5fff" }} />
            {isAR && (<><i style={{ width: 1, height: 26, background: "var(--line)" }} /><i style={{ width: 10, height: 10, borderRadius: "50%", background: "#8b5cf6" }} /></>)}
          </div>
          <div className="sp">
            <p className="semi" style={{ fontSize: 15 }}>{routeDepart}</p>
            {t.heure_trajet && <p className="tiny" style={{ color: "#0b7a45", fontWeight: 700, marginTop: 2 }}>Enlèvement · {t.heure_trajet.slice(0, 5).replace(":", "h")}</p>}
            <p className="semi" style={{ fontSize: 15, marginTop: 14 }}>{routeArrivee}</p>
            {livraisonLabel && <p className="tiny" style={{ color: "#2147c9", fontWeight: 700, marginTop: 2 }}>Livraison · {livraisonLabel}</p>}
            {isAR && <p className="semi" style={{ fontSize: 15, marginTop: 14 }}>{routeRetour}</p>}
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="tiny mut">Rémunération</p>
            <p className="brex-amount" style={{ fontSize: 22 }}>{price.toFixed(0)} €</p>
            {typeof t.distance_km === "number" && <p className="tiny mut">{Math.round(t.distance_km)} km</p>}
          </div>
        </div>

        <div className="row xs soft" style={{ marginTop: 12, gap: 8 }}>
          <Ic n="car" s={13} /> <b style={{ whiteSpace: "nowrap" }}>{vehicule || "Véhicule à confirmer"}</b>
          <span className="mut tiny">· {isAR ? "Livraison puis restitution" : "Trajet simple, sans retour"}</span>
        </div>
        {countdown && <p className="tiny mut" style={{ marginTop: 8 }}><Ic n="clock" s={11} sw={2.4} /> {countdown}</p>}

        {ench && <AuctionStrip a={ench} />}

        {locked ? (
          <button type="button" className="btn" disabled style={{ marginTop: 14, opacity: 0.6 }}>
            <Ic n="lock" s={15} sw={2.4} /> Réservé aux convoyeurs {level}{requis === "confirme" ? "+" : ""}
          </button>
        ) : ench ? (
          <button type="button" className="btn aucbtn" style={{ marginTop: 12 }} disabled={!canApply}
            onClick={(e) => { e.stopPropagation(); if (canApply) onAuction?.(); }}>
            <Ic n="hammer" s={17} sw={2.3} /> {ench.mon_offre != null ? `Modifier mon offre (${Math.round(ench.mon_offre)} €)` : "Faire une offre"}
          </button>
        ) : myOfferStatus ? (
          <button type="button" className="btn" style={{ marginTop: 14 }} onClick={(e) => { e.stopPropagation(); onOpen(); }}>
            {OFFER_LABEL[myOfferStatus] ?? "Candidature envoyée"}{typeof myOfferPrice === "number" ? ` · ${myOfferPrice.toFixed(0)} €` : ""} ✓
          </button>
        ) : (
          <button type="button" className="btn" style={{ marginTop: 14 }} disabled={!canApply}
            onClick={(e) => { e.stopPropagation(); if (canApply) onQuickApply(); }}>
            Je me positionne
          </button>
        )}
      </article>
    </div>
  );
}
