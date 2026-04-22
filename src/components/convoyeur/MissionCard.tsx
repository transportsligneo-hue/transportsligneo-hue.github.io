/**
 * MissionCard — carte mission compacte pour la liste convoyeur.
 * Mobile-first, gros zones tappables, infos essentielles immédiates.
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
    client_telephone?: string | null;
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

const STATUS_META: Record<string, { label: string; cls: string; Icon: ComponentType<{ size?: number; className?: string }> }> = {
  propose:     { label: "Proposée",  cls: "bg-amber-50 text-amber-700 border-amber-200",     Icon: Clock },
  accepte:     { label: "Acceptée",  cls: "bg-blue-50 text-blue-700 border-blue-200",        Icon: ClipboardCheck },
  en_cours:    { label: "En cours",  cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: Truck },
  termine:     { label: "Terminée",  cls: "bg-slate-50 text-slate-600 border-slate-200",     Icon: Flag },
  incident:    { label: "Incident",  cls: "bg-red-50 text-red-700 border-red-200",           Icon: AlertCircle },
};

export function MissionCard({ mission, showTarif, onOpen, onCall, onNavigate, isActive }: Props) {
  const meta = STATUS_META[mission.statut] || { label: mission.statut, cls: "bg-pro-bg-soft text-pro-text border-pro-border", Icon: ClipboardCheck };
  const Icon = meta.Icon;
  const t = mission.trajet;

  const departQuery = t?.depart ? encodeURIComponent(t.depart) : "";

  return (
    <article
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
        isActive ? "border-emerald-300 ring-2 ring-emerald-500/20" : "border-pro-border hover:border-pro-border-strong"
      }`}
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${meta.cls}`}>
          <Icon size={11} />
          {meta.label}
        </span>
        {t?.date_trajet && (
          <span className="text-pro-text-soft text-[11px] flex items-center gap-1">
            <Calendar size={11} />
            {new Date(t.date_trajet).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
            {t.heure_trajet && ` · ${t.heure_trajet}`}
          </span>
        )}
      </div>

      {/* Trajet */}
      <button
        onClick={onOpen}
        className="w-full px-4 py-2 text-left hover:bg-pro-bg-soft/30 transition"
      >
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 pt-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            <div className="w-0.5 h-6 bg-pro-border" />
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 ring-2 ring-blue-100" />
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-pro-text text-sm font-medium leading-snug truncate">{t?.depart || "—"}</p>
            <p className="text-pro-text text-sm font-medium leading-snug truncate">{t?.arrivee || "—"}</p>
          </div>
          <ChevronRight size={16} className="text-pro-muted shrink-0 mt-1" />
        </div>
      </button>

      {/* Véhicule */}
      {(t?.marque || t?.immatriculation) && (
        <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-pro-text-soft border-t border-pro-border/60">
          <Car size={12} />
          <span className="truncate">{[t.marque, t.modele, t.immatriculation].filter(Boolean).join(" · ")}</span>
        </div>
      )}

      {/* Inspections + tarif */}
      <div className="px-4 py-2 flex items-center justify-between gap-2 border-t border-pro-border/60">
        <div className="flex gap-2 text-[11px]">
          <span className={`flex items-center gap-1 ${mission.inspectionDepart ? "text-emerald-600" : "text-pro-muted"}`}>
            <ClipboardCheck size={11} /> Départ {mission.inspectionDepart ? "✓" : "—"}
          </span>
          <span className={`flex items-center gap-1 ${mission.inspectionArrivee ? "text-emerald-600" : "text-pro-muted"}`}>
            <ClipboardCheck size={11} /> Arrivée {mission.inspectionArrivee ? "✓" : "—"}
          </span>
        </div>
        {showTarif && t?.tarif_convoyeur != null && (
          <span className="text-emerald-700 font-bold text-sm tabular-nums">{t.tarif_convoyeur} €</span>
        )}
      </div>

      {/* Actions rapides */}
      <div className="px-3 pb-3 grid grid-cols-3 gap-2">
        <ActionBtn
          label="GPS"
          icon={<Navigation size={14} />}
          href={departQuery ? `https://www.google.com/maps/dir/?api=1&destination=${departQuery}` : undefined}
          onClick={onNavigate}
        />
        <ActionBtn
          label="Appeler"
          icon={<Phone size={14} />}
          href={t?.client_telephone ? `tel:${t.client_telephone}` : undefined}
          disabled={!t?.client_telephone}
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
  const cls = `flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition active:scale-95 ${
    primary
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : "bg-pro-bg-soft text-pro-text-soft hover:bg-pro-bg-soft/70"
  } ${disabled ? "opacity-40 pointer-events-none" : ""}`;

  if (href && !disabled) {
    return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={cls} onClick={onClick}>{icon}{label}</a>;
  }
  return <button type="button" className={cls} onClick={onClick} disabled={disabled}>{icon}{label}</button>;
}
