import {
  MapPin, Car, Calendar, Navigation, Phone, Search, FileText, HeadphonesIcon,
  Bell, ChevronRight, Check, MapPinned, ClipboardCheck, Truck, PackageCheck,
  ClipboardList, ShieldCheck, Loader2,
} from "lucide-react";
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
  /** Contact livraison enrichi (réceptionnaire), édité par l'admin. */
  contactArriveeNom?: string | null;
  contactArriveeTel2?: string | null;
  contactArriveeInstructions?: string | null;
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
 * Hero premium fiche mission convoyeur — layout 2 colonnes (desktop) :
 *   • Gauche : header navy + cartes Départ/Arrivée/Véhicule + raccourcis
 *   • Droite : timeline VERTICALE 6 étapes (sticky desktop, sous le reste sur mobile)
 *
 * Timeline 6 étapes ordre fixe :
 *   1. Arrivé au lieu d'enlèvement
 *   2. Inspection d'enlèvement
 *   3. Trajet
 *   4. Arrivé au lieu de livraison
 *   5. Inspection de livraison
 *   6. Validation admin
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
    <div className="-mx-4 sm:-mx-5 md:-mx-8">
      {/* === HEADER NAVY PREMIUM (pleine largeur) === */}
      <div
        className="relative px-4 sm:px-6 pt-5 pb-6 text-cream"
        style={{ background: "linear-gradient(135deg, #0b1026 0%, #131a3d 100%)" }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="shrink-0 flex flex-col items-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                <img src={logoLigneo} alt="Transports Ligneo" className="w-full h-full object-contain" />
              </div>
              <div className="hidden sm:block mt-1 font-serif text-[10px] tracking-[0.18em] text-[var(--gold)] text-center leading-tight">
                TRANSPORTS<br/>LIGNEO
              </div>
            </div>

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

            <div className="shrink-0 flex flex-col items-end gap-2">
              <button className="relative w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-cream/80 hover:bg-white/10">
                <Bell size={15} />
              </button>
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
            </div>
          </div>
        </div>
      </div>

      {/* === LAYOUT 2 COLONNES : INFOS GAUCHE + TIMELINE DROITE === */}
      <div className="px-4 sm:px-5 md:px-8 -mt-10 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 lg:gap-6 items-start">
          {/* === COLONNE GAUCHE : cartes + raccourcis === */}
          <div className="space-y-4 min-w-0">
            {/* 3 cartes Départ / Arrivée / Véhicule */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            {/* Raccourcis 6 boutons */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
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

          {/* === COLONNE DROITE : TIMELINE VERTICALE STICKY === */}
          <aside className="lg:sticky lg:top-4 self-start w-full">
            <VerticalTimeline steps={steps} currentStepIndex={currentStepIndex} totalSteps={totalSteps} />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* === Sub-components === */

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

/* === TIMELINE VERTICALE — style EDL Inspection Driver === */

const STEP_ICONS = [
  MapPinned,        // 1. Arrivé au lieu d'enlèvement
  ClipboardCheck,   // 2. Inspection d'enlèvement
  Truck,            // 3. Trajet
  PackageCheck,     // 4. Arrivé au lieu de livraison
  ClipboardList,    // 5. Inspection de livraison
  ShieldCheck,      // 6. Validation admin
];

function VerticalTimeline({
  steps, currentStepIndex, totalSteps,
}: { steps: TimelineStep[]; currentStepIndex: number; totalSteps: number }) {
  const pct = totalSteps > 0 ? Math.min(100, Math.round(((currentStepIndex - 1) / (totalSteps - 1)) * 100)) : 0;

  return (
    <div className="edl-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="edl-eyebrow">Avancement</p>
          <h3 className="font-heading text-cream text-base mt-0.5">Mission</h3>
        </div>
        <span className="edl-chip">
          {currentStepIndex}/{totalSteps}
        </span>
      </div>

      <ol className="relative">
        {/* Rail vertical de fond */}
        <div className="absolute left-[18px] top-2 bottom-2 w-[2px] rounded-full bg-white/10" />
        {/* Rail vertical de progression */}
        <div
          className="absolute left-[18px] top-2 w-[2px] rounded-full bg-gradient-to-b from-[#5fb6ff] via-[#2c6bff] to-[#e7c76a] transition-all duration-700"
          style={{ height: `calc((100% - 16px) * ${pct / 100})`, boxShadow: "0 0 12px rgba(95,182,255,0.55)" }}
        />

        {steps.map((s, i) => {
          const Icon = STEP_ICONS[i] ?? Check;
          const isDone = s.state === "done";
          const isCurrent = s.state === "current";
          const statusLabel = isDone ? "Terminée" : isCurrent ? "En cours" : "À venir";

          return (
            <li key={s.index} className="relative pl-12 pb-5 last:pb-0">
              {/* Pastille étape */}
              <div
                className={`absolute left-0 top-0 w-9 h-9 rounded-full flex items-center justify-center transition ${
                  isDone
                    ? "bg-gradient-to-br from-[#5fb6ff] to-[#2c6bff] text-white shadow-[0_4px_14px_rgba(44,107,255,0.55)] ring-2 ring-[#5fb6ff]/30"
                    : isCurrent
                      ? "bg-[#0a1335] text-[#5fb6ff] ring-[3px] ring-[#5fb6ff] shadow-[0_0_0_4px_rgba(95,182,255,0.18),0_6px_18px_rgba(44,107,255,0.45)] edl-pulse"
                      : "bg-white/5 text-cream/45 ring-1 ring-white/15"
                }`}
              >
                {isDone ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}
              </div>

              {/* Contenu */}
              <div className={`pt-1 ${isCurrent ? "" : ""}`}>
                <p
                  className={`text-[13px] leading-tight font-semibold ${
                    isDone ? "text-cream/90" : isCurrent ? "text-cream" : "text-cream/55"
                  }`}
                >
                  {s.label}
                </p>
                <span
                  className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    isDone
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/40"
                      : isCurrent
                        ? "bg-[#5fb6ff]/15 text-[#5fb6ff] border border-[#5fb6ff]/50"
                        : "bg-white/5 text-cream/45 border border-white/10"
                  }`}
                >
                  {isCurrent && <Loader2 size={9} className="animate-spin" />}
                  {statusLabel}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* helper export pour réutilisation */
export const StepArrow = ChevronRight;
