/**
 * MissionCard — carte mission style Stripe/Brex (sobre, glass premium).
 * Pilules monotone, hiérarchie typo, numérique tabulaire, accent or unique.
 */
import {
  MapPin, Calendar, Car, ClipboardCheck, ChevronRight,
  Phone, Navigation, AlertCircle, Clock, Truck, Flag,
} from "lucide-react";
import type { ComponentType } from "react";

export interface MissionCardData {
  id: string;
  statut: string;
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
  } | null;
  inspectionDepart?: boolean;
  inspectionArrivee?: boolean;
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

  return (
    <article className={`brex-card ${isActive ? "brex-card--active" : ""}`}>
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2">
        <span className={`brex-pill brex-pill--${meta.tone} ${meta.live ? "brex-pill--live" : ""}`}>
          <span className="brex-pill-dot" />
          {meta.label}
        </span>
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
            <div className="w-2 h-2 rounded-full bg-[#e7c76a] ring-2 ring-[rgba(212,175,55,0.20)]" />
            <div className="w-px h-6 bg-[rgba(255,255,255,0.12)]" />
            <div className="w-2 h-2 rounded-full bg-[#93c5fd] ring-2 ring-[rgba(59,130,246,0.20)]" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="brex-label-xs">Départ</p>
              <p className="text-[13.5px] text-[var(--driver-text)] font-medium leading-snug truncate mt-0.5">{t?.depart || "—"}</p>
            </div>
            <div>
              <p className="brex-label-xs">Arrivée</p>
              <p className="text-[13.5px] text-[var(--driver-text)] font-medium leading-snug truncate mt-0.5">{t?.arrivee || "—"}</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-[var(--driver-muted)] shrink-0 mt-1" />
        </div>
      </button>

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
          href={departQuery ? `https://www.google.com/maps/dir/?api=1&destination=${departQuery}` : undefined}
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
      <span className="tabular-nums opacity-80">{done ? "OK" : "—"}</span>
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
