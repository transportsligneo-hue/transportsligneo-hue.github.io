import { useEffect, useMemo, useState, type ReactNode } from "react";
import { LayoutList, LayoutGrid, Kanban, CalendarDays, Calendar, MapPin, ArrowRight } from "lucide-react";
import { StatusBadge, missionStatusKind, missionStatusLabel } from "@/components/dashboard/StatusBadge";

export type MissionViewMode = "list" | "cards" | "kanban" | "planning";

export const MISSION_VIEWS: { value: MissionViewMode; label: string; icon: typeof LayoutList }[] = [
  { value: "list", label: "Liste", icon: LayoutList },
  { value: "cards", label: "Cartes", icon: LayoutGrid },
  { value: "kanban", label: "Kanban", icon: Kanban },
  { value: "planning", label: "Planning", icon: CalendarDays },
];

export interface MissionViewItem {
  id: string;
  numero: string;
  depart: string;
  arrivee: string;
  date?: string | null;
  statut: string;
  statutLabel?: string;
  meta?: string;
  amount?: string;
  badge?: ReactNode;
  /** Enveloppe le contenu (Link typé, bouton…) fournie par la page hôte. */
  wrap?: (children: ReactNode) => ReactNode;
}

type Theme = "light" | "dark";

/**
 * Mémorise le mode de vue choisi par espace.
 * Par défaut : vue Planning (dates les plus récentes en haut).
 * Le suffixe de version réinitialise les préférences enregistrées précédemment.
 */
export function useMissionView(storageKey: string, initial: MissionViewMode = "planning") {
  const key = `${storageKey}:planning-default`;
  const [view, setView] = useState<MissionViewMode>(() => {
    if (typeof window === "undefined") return initial;
    const v = window.localStorage.getItem(key) as MissionViewMode | null;
    return v && MISSION_VIEWS.some((x) => x.value === v) ? v : initial;
  });
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(key, view);
  }, [key, view]);
  return [view, setView] as const;
}

export function MissionViewSwitcher({
  view,
  onChange,
  theme = "light",
  className = "",
}: {
  view: MissionViewMode;
  onChange: (v: MissionViewMode) => void;
  theme?: Theme;
  className?: string;
}) {
  const wrapCls =
    theme === "dark"
      ? "inline-flex rounded border border-primary/20 bg-navy/40 p-0.5"
      : "inline-flex rounded-lg border border-pro-border bg-white p-0.5";
  return (
    <div className={`${wrapCls} ${className}`} role="tablist" aria-label="Mode d'affichage">
      {MISSION_VIEWS.map((v) => {
        const Icon = v.icon;
        const active = view === v.value;
        const cls =
          theme === "dark"
            ? active
              ? "bg-primary text-navy"
              : "text-cream/60 hover:text-cream"
            : active
              ? "bg-pro-accent text-white"
              : "text-pro-text-soft hover:bg-pro-bg-soft";
        return (
          <button
            key={v.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v.value)}
            title={v.label}
            aria-label={v.label}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] uppercase tracking-wider rounded-md transition-all ${cls}`}
          >
            <Icon size={13} />
            <span className="hidden md:inline">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const KANBAN_COLUMNS: { key: string; label: string; match: (s: string) => boolean }[] = [
  { key: "attente", label: "En attente", match: (s) => ["en_attente", "en_recherche", "nouvelle", "brouillon", "publiee", "a_attribuer", "propose", "proposee", "en_attente_attribution"].includes(s) },
  { key: "planifiee", label: "Planifiées", match: (s) => ["confirmee", "attribuee", "acceptee", "accepte", "planifiee", "programmee", "a_venir"].includes(s) },
  { key: "en_cours", label: "En cours", match: (s) => ["en_cours", "demarree", "en_route", "en_livraison"].includes(s) },
  { key: "terminee", label: "Terminées", match: (s) => ["livree", "terminee", "termine", "validee", "en_attente_validation", "annulee", "refusee", "cloturee", "facturee"].includes(s) },
];

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "Date à définir");

function Shell({ item, theme, children }: { item: MissionViewItem; theme: Theme; children: ReactNode }) {
  return <>{item.wrap ? item.wrap(children) : <div className={theme === "dark" ? "block" : "block"}>{children}</div>}</>;
}

/** Vues Cartes / Kanban / Planning génériques. */
export function MissionViewsBody({
  view,
  items,
  theme = "light",
}: {
  view: Exclude<MissionViewMode, "list">;
  items: MissionViewItem[];
  theme?: Theme;
}) {
  const card =
    theme === "dark"
      ? "card-premium p-4 rounded hover:border-primary/40 transition-all"
      : "bg-white rounded-xl border border-pro-border p-4 hover:border-pro-accent/60 hover:shadow-sm transition-all";
  const muted = theme === "dark" ? "text-cream/50" : "text-pro-text-soft";
  const strong = theme === "dark" ? "text-cream" : "text-pro-text";
  const panel =
    theme === "dark"
      ? "card-premium p-3 rounded"
      : "bg-white rounded-xl border border-pro-border p-3";
  const chip = theme === "dark" ? "bg-navy/60 text-cream/60" : "bg-pro-bg-soft text-pro-text-soft";

  const columns = useMemo(
    () =>
      KANBAN_COLUMNS.map((c) => ({
        ...c,
        items: items.filter((i) => c.match(i.statut)),
      })),
    [items],
  );

  const planning = useMemo(() => {
    const groups = new Map<string, MissionViewItem[]>();
    for (const i of items) {
      const key = i.date ? new Date(i.date).toISOString().slice(0, 10) : "sans-date";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(i);
    }
    // Plus récentes en haut, "sans date" toujours en bas.
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "sans-date") return 1;
      if (b === "sans-date") return -1;
      return a > b ? -1 : 1;
    });
  }, [items]);

  if (view === "cards") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <Shell key={i.id} item={i} theme={theme}>
            <div className={`${card} flex flex-col gap-2 h-full`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className={`text-[10px] uppercase tracking-wider font-mono ${muted}`}>{i.numero}</span>
                {i.badge ?? <StatusBadge kind={missionStatusKind(i.statut)}>{i.statutLabel ?? missionStatusLabel(i.statut)}</StatusBadge>}
              </div>
              <p className={`text-sm flex items-center gap-2 ${strong}`}>
                <MapPin size={12} className="text-pro-accent shrink-0" />
                <span className="truncate">{i.depart}</span>
              </p>
              <p className={`text-sm flex items-center gap-2 ${strong}`}>
                <ArrowRight size={12} className="opacity-60 shrink-0" />
                <span className="truncate">{i.arrivee}</span>
              </p>
              <div className={`flex items-center gap-3 text-[11px] flex-wrap pt-2 mt-auto border-t ${theme === "dark" ? "border-primary/10" : "border-pro-border"} ${muted}`}>
                <span className="flex items-center gap-1"><Calendar size={11} />{fmtDate(i.date)}</span>
                {i.meta && <span className="truncate">{i.meta}</span>}
                {i.amount && <span className={`ml-auto font-semibold ${strong}`}>{i.amount}</span>}
              </div>
            </div>
          </Shell>
        ))}
      </div>
    );
  }

  if (view === "kanban") {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {columns.map((col) => (
          <div key={col.key} className={`${panel} flex flex-col min-h-[280px]`}>
            <div className={`flex items-center justify-between px-1 pb-2 mb-2 border-b ${theme === "dark" ? "border-primary/15" : "border-pro-border"}`}>
              <h3 className={`text-[11px] uppercase tracking-wider font-semibold ${strong}`}>{col.label}</h3>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${chip}`}>{col.items.length}</span>
            </div>
            <div className="space-y-2 flex-1">
              {col.items.length === 0 ? (
                <p className={`text-[11px] text-center py-6 ${muted}`}>—</p>
              ) : (
                col.items.map((i) => (
                  <Shell key={i.id} item={i} theme={theme}>
                    <div
                      className={
                        theme === "dark"
                          ? "block p-3 rounded bg-navy/50 border border-primary/15 hover:border-primary/40 transition-all"
                          : "block p-3 rounded-lg bg-pro-bg-soft border border-pro-border hover:border-pro-accent/60 transition-all"
                      }
                    >
                      <div className={`text-[10px] uppercase tracking-wider font-mono mb-1 ${muted}`}>{i.numero}</div>
                      <p className={`text-xs leading-snug ${strong}`}>
                        <span className="truncate block">{i.depart}</span>
                        <span className="opacity-50">↓</span>
                        <span className="truncate block">{i.arrivee}</span>
                      </p>
                      <div className={`flex items-center gap-1 text-[10px] mt-2 ${muted}`}>
                        <Calendar size={10} />{fmtDate(i.date)}
                        {i.amount && <span className={`ml-auto font-semibold ${strong}`}>{i.amount}</span>}
                      </div>
                    </div>
                  </Shell>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Planning
  return (
    <div className="space-y-3">
      {planning.map(([dateKey, list]) => {
        const d = dateKey === "sans-date" ? null : new Date(dateKey);
        const label = d
          ? d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
          : "Sans date";
        const isToday = d && d.toDateString() === new Date().toDateString();
        return (
          <div key={dateKey} className={`${theme === "dark" ? "card-premium" : "bg-white border border-pro-border"} rounded-xl overflow-hidden`}>
            <div
              className={`flex items-center justify-between px-4 py-2.5 border-b ${theme === "dark" ? "border-primary/15" : "border-pro-border"} ${
                isToday ? (theme === "dark" ? "bg-primary/10" : "bg-pro-accent/10") : theme === "dark" ? "bg-navy/60" : "bg-pro-bg-soft"
              }`}
            >
              <span className={`text-[11px] uppercase tracking-wider font-semibold ${isToday ? "text-pro-accent" : strong}`}>
                {label}
                {isToday && <span className="ml-2 text-[10px] normal-case">· Aujourd'hui</span>}
              </span>
              <span className={`text-[10px] ${muted}`}>{list.length} mission{list.length > 1 ? "s" : ""}</span>
            </div>
            <div className={`divide-y ${theme === "dark" ? "divide-primary/10" : "divide-pro-border"}`}>
              {list.map((i) => (
                <Shell key={i.id} item={i} theme={theme}>
                  <div className={`flex items-center gap-3 p-3 transition-colors ${theme === "dark" ? "hover:bg-primary/5" : "hover:bg-pro-bg-soft/70"}`}>
                    <div className={`flex flex-col items-center justify-center min-w-[54px] px-2 py-1 rounded ${chip}`}>
                      <span className="text-xs font-semibold tabular-nums">
                        {i.date ? new Date(i.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-[10px] uppercase tracking-wider font-mono ${muted}`}>{i.numero}</span>
                        {i.badge ?? <StatusBadge kind={missionStatusKind(i.statut)}>{i.statutLabel ?? missionStatusLabel(i.statut)}</StatusBadge>}
                      </div>
                      <p className={`text-sm truncate ${strong}`}>
                        {i.depart} <span className="opacity-40">→</span> {i.arrivee}
                      </p>
                    </div>
                    {i.amount && <span className={`text-sm font-semibold ${strong}`}>{i.amount}</span>}
                    <ArrowRight size={14} className="opacity-40 shrink-0" />
                  </div>
                </Shell>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
