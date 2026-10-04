import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { STATUS_META, isCancelled, useProMissions } from "@/hooks/useProMissions";

export const Route = createFileRoute("/_authenticated/dashboard-pro/calendrier")({
  head: () => ({
    meta: [
      { title: "Calendrier des convoyages — Espace Pro Ligneo" },
      { name: "description", content: "Vue mensuelle et hebdomadaire de vos convoyages à venir et en cours." },
    ],
  }),
  component: CalendrierPage,
});

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function CalendrierPage() {
  const { missions, loading } = useProMissions();
  const [view, setView] = useState<"mois" | "semaine">("mois");
  const [cursor, setCursor] = useState(() => new Date());

  const byDay = useMemo(() => {
    const map = new Map<string, typeof missions>();
    for (const m of missions) {
      if (isCancelled(m.statut)) continue;
      const arr = map.get(m.date_prise_en_charge) ?? [];
      arr.push(m);
      map.set(m.date_prise_en_charge, arr);
    }
    return map;
  }, [missions]);

  const days = useMemo(() => {
    const out: Date[] = [];
    if (view === "mois") {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const start = new Date(first);
      start.setDate(1 - ((first.getDay() + 6) % 7));
      for (let i = 0; i < 42; i++) out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    } else {
      const start = new Date(cursor);
      start.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
      for (let i = 0; i < 7; i++) out.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return out;
  }, [cursor, view]);

  const move = (dir: number) => {
    const d = new Date(cursor);
    if (view === "mois") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCursor(d);
  };

  const title =
    view === "mois"
      ? cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      : `Semaine du ${days[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;
  const today = key(new Date());

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-pro-accent font-semibold">Planification</p>
          <h1 className="text-2xl font-semibold text-foreground">Calendrier des convoyages</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="pp-seg">
            <button className={view === "mois" ? "on" : ""} onClick={() => setView("mois")}>Mois</button>
            <button className={view === "semaine" ? "on" : ""} onClick={() => setView("semaine")}>Semaine</button>
          </div>
          <button className="pp-icon-btn" onClick={() => move(-1)} aria-label="Précédent"><ChevronLeft size={16} /></button>
          <button className="pp-quick" onClick={() => setCursor(new Date())}>Aujourd'hui</button>
          <button className="pp-icon-btn" onClick={() => move(1)} aria-label="Suivant"><ChevronRight size={16} /></button>
        </div>
      </header>
      <h2 className="text-lg font-semibold capitalize text-foreground">{title}</h2>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" /></div>
      ) : (
        <div className="pp-cal">
          {DAYS.map((d) => <div key={d} className="pp-cal-head">{d}</div>)}
          {days.map((d) => {
            const k = key(d);
            const list = byDay.get(k) ?? [];
            const out = view === "mois" && d.getMonth() !== cursor.getMonth();
            return (
              <div key={k} className={`pp-cal-cell ${out ? "out" : ""} ${k === today ? "today" : ""} ${view === "semaine" ? "tall" : ""}`}>
                <span className="pp-cal-num">{d.getDate()}</span>
                {list.length > 3 && view === "mois" && <span className="pp-cal-load">{list.length} missions</span>}
                {list.slice(0, view === "mois" ? 3 : 20).map((m) => (
                  <Link
                    key={m.id}
                    to="/dashboard-pro/missions/$missionId"
                    params={{ missionId: m.id }}
                    className={`pp-cal-ev ${STATUS_META[m.statut]?.cls ?? "pp-st-wait"}`}
                    title={`${m.numero} · ${m.ville_depart} → ${m.ville_arrivee}`}
                  >
                    {m.heure_prise_en_charge ? m.heure_prise_en_charge.slice(0, 5) + " " : ""}
                    {m.immatriculation || m.ville_arrivee}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
