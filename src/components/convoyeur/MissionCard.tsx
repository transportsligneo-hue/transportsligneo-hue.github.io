/**
 * MissionCard · carte mission style Stripe/Brex (sobre, glass premium).
 * Pilules monotone, hiérarchie typo, numérique tabulaire, accent or unique.
 */
import {
  MapPin, Calendar, Car, ClipboardCheck, ChevronRight,
  Phone, Navigation, AlertCircle, Clock, Truck, Flag, Layers,
} from "lucide-react";
import type { ComponentType } from "react";
import { displayNumero } from "@/lib/mission-number";


export interface MissionCardData {
  id: string;
  statut: string;
  numero_mission?: string | null;
  etape_courante?: string | null;

  trajet: {
    depart: string;
    arrivee: string;
    date_trajet: string | null;
    heure_trajet: string | null;
    marque: string | null;
    modele: string | null;
    immatriculation: string | null;
    tarif_convoyeur: number | null;
    contact_depart_tel?: string | null;
    contact_arrivee_tel?: string | null;
    vin?: string | null;
    carte_grise_recto_url?: string | null;
    carte_grise_verso_url?: string | null;
    options_meta?: unknown;
  } | null;
  inspectionDepart?: boolean;
  inspectionArrivee?: boolean;
  /** Lot administratif : plusieurs missions distinctes, attribuables ensemble. */
  lot?: { ref: string | null; plaques: string[]; total: number } | null;
}

interface Props {
  mission: MissionCardData;
  showTarif?: boolean;
  onOpen?: () => void;
  onCall?: () => void;
  onNavigate?: () => void;
  isActive?: boolean;
}

type PillTone = "gold" | "blue" | "amber" | "green" | "red" | "muted";
const STATUS_META: Record<string, { label: string; tone: PillTone; live?: boolean; Icon: ComponentType<{ size?: number; className?: string }> }> = {
  propose:               { label: "Proposée",         tone: "amber", Icon: Clock },
  accepte:               { label: "Acceptée",         tone: "blue",  Icon: ClipboardCheck },
  en_cours:              { label: "En cours",         tone: "green", live: true, Icon: Truck },
  en_attente_validation: { label: "Validation",       tone: "amber", Icon: Clock },
  validee:               { label: "Validée",          tone: "green", Icon: Flag },
  refusee:               { label: "Refusée",          tone: "red",   Icon: AlertCircle },
  termine:               { label: "Terminée",         tone: "muted", Icon: Flag },
  incident:              { label: "Incident",         tone: "red",   Icon: AlertCircle },
};

export function MissionCard({ mission, showTarif, onOpen, onCall, onNavigate, isActive }: Props) {
  const meta = STATUS_META[mission.statut] || { label: mission.statut, tone: "muted" as PillTone, Icon: ClipboardCheck };
  const t = mission.trajet;

  const departQuery = t?.depart ? encodeURIComponent(t.depart) : "";
  const arriveeQuery = t?.arrivee ? encodeURIComponent(t.arrivee) : "";
  const itineraireHref = arriveeQuery
    ? `https://www.google.com/maps/dir/?api=1${departQuery ? `&origin=${departQuery}` : ""}&destination=${arriveeQuery}&travelmode=driving`
    : undefined;

  return (
    <article className={`brex-card ${isActive ? "brex-card--active" : ""}`}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`brex-pill brex-pill--${meta.tone} ${meta.live ? "brex-pill--live" : ""}`}>
            <span className="brex-pill-dot" />
            {meta.label}
          </span>
          {mission.numero_mission && (
            <span
              title={displayNumero(mission.numero_mission)}
              className="shrink-0 whitespace-nowrap rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-white/90"
            >
              {displayNumero(mission.numero_mission).replace(/^MIS-TLG-/, "")}
            </span>
          )}

        </div>

        {t?.date_trajet && (
          <span className="flex items-center gap-1.5 text-[11px] text-[var(--driver-muted)] tabular-nums">
            <Calendar size={11} />
            {new Date(t.date_trajet).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
            {t.heure_trajet && <span className="text-[var(--driver-text-soft)]"> · {t.heure_trajet}</span>}
          </span>
        )}
      </div>

      {/* Trajet */}
      <button
        onClick={onOpen}
        className="w-full px-5 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex items-start gap-3.5">
          <div className="flex flex-col items-center gap-1 pt-1.5 shrink-0">
            <div className={`w-2.5 h-2.5 rounded-full ${meta.live ? "bg-emerald-400 ring-2 ring-emerald-400/30 animate-pulse" : "bg-[#e7c76a] ring-2 ring-[rgba(212,175,55,0.25)]"}`} />
            <div className="relative w-px h-7 bg-[rgba(255,255,255,0.10)] overflow-hidden">
              <div className={`absolute inset-x-0 top-0 ${meta.live ? "h-full bg-gradient-to-b from-emerald-400 via-[#4EA8FF] to-[#93c5fd] animate-[pulse_2s_ease-in-out_infinite]" : "h-1/2 bg-gradient-to-b from-[#e7c76a] to-transparent"}`} />
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${meta.live ? "bg-[#4EA8FF] ring-2 ring-[#4EA8FF]/30" : "bg-[#93c5fd] ring-2 ring-[rgba(59,130,246,0.25)]"}`} />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="brex-label-xs">Départ</p>
              <p className="text-[14px] text-white font-semibold leading-snug truncate mt-0.5">{t?.depart || " · "}</p>
            </div>
            <div>
              <p className="brex-label-xs">Arrivée</p>
              <p className="text-[14px] text-white font-semibold leading-snug truncate mt-0.5">{t?.arrivee || " · "}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-[var(--driver-muted)] shrink-0 mt-1" />
        </div>
      </button>

      {/* Lot de missions distinctes */}
      {mission.lot && mission.lot.total > 1 && (
        <div className="brex-divider px-5 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(110,255,205,0.35)] bg-[rgba(110,255,205,0.12)] px-2.5 py-0.5 text-[10.5px] font-bold text-[#6effcd]">
              <Layers size={11} /> Lot · {mission.lot.total} missions
              {mission.lot.ref ? ` · ${mission.lot.ref}` : ""}
            </span>
            {mission.lot.plaques.map((pl) => (
              <span
                key={pl}
                className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-white"
              >
                {pl}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Véhicule + tarif */}
      {(t?.marque || t?.immatriculation || (showTarif && t?.tarif_convoyeur != null)) && (
        <div className="brex-divider px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[var(--driver-text-soft)] min-w-0">
            {(t?.marque || t?.immatriculation) && (
              <>
                <Car size={13} className="text-[var(--driver-muted)] shrink-0" />
                <span className="truncate tabular-nums">{[t?.marque, t?.modele, t?.immatriculation].filter(Boolean).join(" · ")}</span>
              </>
            )}
          </div>
          {showTarif && t?.tarif_convoyeur != null && (
            <span className="brex-amount shrink-0">{t.tarif_convoyeur.toLocaleString("fr-FR")} €</span>
          )}
        </div>
      )}

      {/* Inspections */}
      <div className="brex-divider px-5 py-2.5 flex items-center gap-4 text-[11px]">
        <InspectionFlag label="Inspection départ" done={!!mission.inspectionDepart} />
        <InspectionFlag label="Inspection arrivée" done={!!mission.inspectionArrivee} />
      </div>

      {/* Actions */}
      <div className="brex-divider px-3 py-3 grid grid-cols-3 gap-2">
        <ActionBtn
          label="Itinéraire"
          icon={<Navigation size={14} />}
          href={itineraireHref}
          onClick={onNavigate}
        />
        <ActionBtn
          label="Appeler"
          icon={<Phone size={14} />}
          href={t?.contact_depart_tel ? `tel:${t.contact_depart_tel}` : undefined}
          disabled={!t?.contact_depart_tel}
          onClick={onCall}
        />
        <ActionBtn
          label="Détails"
          icon={<MapPin size={14} />}
          onClick={onOpen}
          primary
        />
      </div>
    </article>
  );
}

function InspectionFlag({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${done ? "text-[#7ee2b8]" : "text-[var(--driver-muted)]"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${done ? "bg-[#7ee2b8]" : "bg-[var(--driver-muted)]"}`} />
      {label}
      <span className="tabular-nums opacity-80">{done ? "OK" : " · "}</span>
    </span>
  );
}

function ActionBtn({
  label, icon, href, onClick, disabled, primary,
}: {
  label: string;
  icon: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const cls = `brex-action ${primary ? "brex-action--primary" : ""} ${disabled ? "opacity-40 pointer-events-none" : ""}`;

  if (href && !disabled) {
    return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={cls} onClick={onClick}>{icon}{label}</a>;
  }
  return <button type="button" className={cls} onClick={onClick} disabled={disabled}>{icon}{label}</button>;
}
