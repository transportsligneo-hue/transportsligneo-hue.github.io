import { MapPin, Car, Calendar, Navigation, Phone, Search, FileText, HeadphonesIcon, Bell, ChevronRight } from "lucide-react";
import logoLigneo from "@/assets/logo-transports-ligneo-officiel.png";

export interface PremiumMissionHeroData {
  numeroMission: string | null;
  statutLabel: string;
  isLive: boolean;
  depart?: { ville: string; adresse?: string; date?: string; heure?: string } | null;
  arrivee?: { ville: string; adresse?: string; date?: string; heure?: string } | null;
  vehicule?: { marque?: string; modele?: string; immatriculation?: string; vin?: string } | null;
  contactDepartTel?: string | null;
  contactArriveeTel?: string | null;
  gpsTarget?: string | null;
}

export interface TimelineStep {
  index: number;
  label: string;
  state: "done" | "current" | "todo";
  sub?: string;
}

interface Props {
  data: PremiumMissionHeroData;
  steps: TimelineStep[];
  currentStepIndex: number;
  totalSteps: number;
  currentStepLabel: string;
  onOpenInspection?: () => void;
  onOpenDocuments?: () => void;
  onOpenIncident?: () => void;
}

function fmtDate(d?: string, h?: string) {
  if (!d) return null;
  try {
    const date = new Date(d);
    const s = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
    return h ? `${s} à ${h}` : s;
  } catch {
    return d;
  }
}

/**
 * Hero premium fiche mission convoyeur — calque maquette TRANSPORTS LIGNEO.
 * Header navy + or, anneau étape X/N, 3 cartes Départ/Arrivée/Véhicule,
 * raccourcis 6 boutons, timeline horizontale.
 */
export function PremiumMissionHero({
  data, steps, currentStepIndex, totalSteps, currentStepLabel,
  onOpenInspection, onOpenDocuments, onOpenIncident,
}: Props) {
  const pct = totalSteps > 0 ? Math.min(100, Math.round((currentStepIndex / totalSteps) * 100)) : 0;
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;

  return (
    <div className="space-y-4 -mx-4 sm:-mx-5 md:-mx-8">
      {/* === HEADER NAVY PREMIUM === */}
      <div
        className="relative px-4 sm:px-6 pt-5 pb-6 text-cream"
        style={{ background: "linear-gradient(135deg, #0b1026 0%, #131a3d 100%)" }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-4">
            {/* Logo TRANSPORTS LIGNEO */}
            <div className="shrink-0 flex flex-col items-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                <img src={logoLigneo} alt="Transports Ligneo" className="w-full h-full object-contain" />
              </div>
              <div className="hidden sm:block mt-1 font-serif text-[10px] tracking-[0.18em] text-[var(--gold)] text-center leading-tight">
                TRANSPORTS<br/>LIGNEO
              </div>
            </div>

            {/* Centre — numéro mission + trajet */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-cream/70">
                <span>{data.statutLabel}</span>
                {data.isLive && <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] animate-pulse" />}
              </div>
              <h1 className="mt-1 font-serif text-2xl sm:text-3xl text-white tracking-tight truncate">
                {data.numeroMission ?? "—"}
              </h1>
              {(data.depart?.ville || data.arrivee?.ville) && (
                <p className="mt-1.5 text-cream/85 text-sm truncate">
                  {data.depart?.ville} <span className="text-[var(--gold)]">→</span> {data.arrivee?.ville}
                </p>
              )}
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-3 py-1 text-[11px] text-[var(--gold)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                {currentStepLabel}
              </div>
            </div>

            {/* Anneau étape + cloche */}
            <div className="shrink-0 flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button className="relative w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-cream/80 hover:bg-white/10">
                  <Bell size={15} />
                </button>
              </div>
              <div className="relative w-[88px] h-[88px]">
                <svg width="88" height="88" viewBox="0 0 88 88" className="rotate-[-90deg]">
                  <circle cx="44" cy="44" r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth="6" fill="none" />
                  <circle
                    cx="44" cy="44" r={radius}
                    stroke="var(--gold)" strokeWidth="6" fill="none" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - dash}
                    style={{ transition: "stroke-dashoffset 600ms ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-serif text-xl text-white leading-none">
                    {currentStepIndex}<span className="text-cream/60 text-base">/{totalSteps}</span>
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-cream/60 mt-0.5">Étape</span>
                </div>
              </div>
              <span className="text-[10px] text-[var(--gold)] uppercase tracking-wider">{currentStepLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* === 3 CARTES DÉPART / ARRIVÉE / VÉHICULE === */}
      <div className="px-4 sm:px-5 md:px-8 -mt-10 relative z-10">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
          <InfoCard
            label="Départ"
            iconBg="bg-[#0b1026]"
            icon={<MapPin size={16} className="text-white" />}
            title={data.depart?.ville || "—"}
            line1={data.depart?.adresse}
            footer={fmtDate(data.depart?.date, data.depart?.heure)}
          />
          <InfoCard
            label="Arrivée"
            iconBg="bg-[var(--gold)]"
            icon={<MapPin size={16} className="text-[#0b1026]" />}
            title={data.arrivee?.ville || "—"}
            line1={data.arrivee?.adresse}
            footer={fmtDate(data.arrivee?.date, data.arrivee?.heure)}
          />
          <InfoCard
            label="Véhicule"
            iconBg="bg-[#0b1026]"
            icon={<Car size={16} className="text-white" />}
            title={[data.vehicule?.marque, data.vehicule?.modele].filter(Boolean).join(" ") || "—"}
            badge={data.vehicule?.immatriculation}
            footer={data.vehicule?.vin ? `VIN : ${data.vehicule.vin}` : null}
          />
        </div>
      </div>

      {/* === RACCOURCIS 6 BOUTONS === */}
      <div className="px-4 sm:px-5 md:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          <ShortcutTile
            label="Ouvrir GPS"
            icon={<Navigation size={20} />}
            href={data.gpsTarget ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.gpsTarget)}` : undefined}
          />
          <ShortcutTile
            label="Appeler enlèvement"
            icon={<Phone size={20} />}
            href={data.contactDepartTel ? `tel:${data.contactDepartTel}` : undefined}
          />
          <ShortcutTile
            label="Appeler réception"
            icon={<Phone size={20} />}
            href={data.contactArriveeTel ? `tel:${data.contactArriveeTel}` : undefined}
          />
          <ShortcutTile label="Inspection" icon={<Search size={20} />} onClick={onOpenInspection} />
          <ShortcutTile label="Documents" icon={<FileText size={20} />} onClick={onOpenDocuments} />
          <ShortcutTile label="Aide / Incident" icon={<HeadphonesIcon size={20} />} onClick={onOpenIncident} />
        </div>
      </div>

      {/* === TIMELINE AVANCEMENT === */}
      <div className="px-4 sm:px-5 md:px-8">
        <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-pro-border p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#0b1026]">
              Avancement de la mission
            </h3>
            <span className="text-[11px] text-pro-muted">{currentStepIndex}/{totalSteps}</span>
          </div>
          <Timeline steps={steps} />
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  label, icon, iconBg, title, line1, badge, footer,
}: {
  label: string; icon: React.ReactNode; iconBg: string;
  title: string; line1?: string | null; badge?: string | null; footer?: string | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-pro-border p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-pro-muted">{label}</p>
      <div className={`mt-2 w-9 h-9 rounded-full ${iconBg} flex items-center justify-center`}>{icon}</div>
      <h4 className="mt-3 font-semibold text-[#0b1026] text-[15px] leading-tight truncate">{title}</h4>
      {line1 && <p className="mt-0.5 text-pro-text-soft text-xs truncate">{line1}</p>}
      {badge && (
        <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-md bg-[#0b1026] text-white text-[11px] font-mono tracking-wider">
          {badge}
        </span>
      )}
      {footer && (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-pro-text-soft">
          <Calendar size={11} />
          <span className="truncate">{footer}</span>
        </div>
      )}
    </div>
  );
}

function ShortcutTile({
  label, icon, href, onClick,
}: { label: string; icon: React.ReactNode; href?: string; onClick?: () => void }) {
  const disabled = !href && !onClick;
  const content = (
    <>
      <div className="text-[var(--gold)]">{icon}</div>
      <span className="text-[11px] sm:text-xs text-cream text-center leading-tight">{label}</span>
    </>
  );
  const cls = `flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl p-2 sm:p-3 transition active:scale-95 ${
    disabled
      ? "bg-[#0b1026]/40 opacity-50 pointer-events-none"
      : "bg-[#0b1026] hover:bg-[#131a3d] shadow-sm"
  }`;
  if (href) return <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className={cls}>{content}</a>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{content}</button>;
}

function Timeline({ steps }: { steps: TimelineStep[] }) {
  const lastDoneIdx = [...steps].reverse().findIndex(s => s.state !== "todo");
  const progressIdx = lastDoneIdx === -1 ? 0 : steps.length - 1 - lastDoneIdx;
  const progressPct = (progressIdx / Math.max(1, steps.length - 1)) * 100;

  return (
    <div className="relative pt-1 pb-2">
      {/* Ligne de fond */}
      <div className="absolute top-[22px] left-5 right-5 h-[3px] rounded-full bg-[#0b1026]/10" />
      {/* Ligne progression dorée */}
      <div
        className="absolute top-[22px] left-5 h-[3px] rounded-full bg-gradient-to-r from-[var(--gold)] to-[#e7c76a] transition-all duration-700 shadow-[0_0_8px_rgba(212,175,55,0.5)]"
        style={{ width: `calc((100% - 40px) * ${progressPct / 100})` }}
      />
      <ol
        className="grid gap-x-2 gap-y-1 relative"
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((s) => {
          const isDone = s.state === "done";
          const isCurrent = s.state === "current";
          const statusLabel = isDone ? "OK" : isCurrent ? "En cours" : "À venir";
          return (
            <li key={s.index} className="relative flex flex-col items-center text-center px-0.5">
              <div
                className={`relative z-10 w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold transition ${
                  isDone
                    ? "bg-gradient-to-br from-[var(--gold)] to-[#b8902c] text-[#0b1026] shadow-[0_4px_12px_rgba(212,175,55,0.45)] ring-2 ring-[var(--gold)]/30"
                    : isCurrent
                      ? "bg-[#0b1026] text-[var(--gold)] ring-[3px] ring-[var(--gold)] shadow-[0_0_0_4px_rgba(212,175,55,0.18),0_6px_16px_rgba(212,175,55,0.35)] animate-pulse"
                      : "bg-white text-[#0b1026]/45 ring-2 ring-[#0b1026]/15"
                }`}
              >
                {isDone ? "✓" : s.index}
              </div>
              <p
                className={`mt-2.5 text-[11px] sm:text-[12px] leading-snug font-semibold min-h-[28px] ${
                  isCurrent
                    ? "text-[#0b1026]"
                    : isDone
                      ? "text-[#0b1026]"
                      : "text-[#0b1026]/55"
                }`}
              >
                {s.label}
              </p>
              <span
                className={`mt-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${
                  isDone
                    ? "bg-[var(--gold)]/15 text-[#8a6a18] border border-[var(--gold)]/40"
                    : isCurrent
                      ? "bg-[#0b1026] text-[var(--gold)] border border-[var(--gold)] shadow-[0_2px_6px_rgba(11,16,38,0.2)]"
                      : "bg-[#0b1026]/5 text-[#0b1026]/50 border border-[#0b1026]/10"
                }`}
              >
                {statusLabel}
              </span>
              {s.sub && isCurrent && (
                <p className="mt-1 text-[10px] leading-tight text-[#0b1026]/70 font-medium">
                  {s.sub}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* helper export pour réutilisation */
export const StepArrow = ChevronRight;
