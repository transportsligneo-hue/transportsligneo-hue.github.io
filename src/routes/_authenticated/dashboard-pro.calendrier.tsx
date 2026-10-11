import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { daysUntil, dueTone, nextRevision } from "@/lib/vehicle-schedule";
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

type Echeance = { id: string; date: string; type: string; label: string; plate: string; tone: string };
const ECH_TYPES = [
  { id: "ct", label: "Contrôle technique" },
  { id: "assurance", label: "Assurance" },
  { id: "revision", label: "Révision" },
  { id: "contrat", label: "Fin de contrat" },
];

function useEcheances() {
  const [list, setList] = useState<Echeance[]>([]);
  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("vehicles")
        .select("id, immatriculation, statut, archived_at, controle_technique_expire_le, assurance_expire_le, fin_contrat_le, derniere_revision_le, derniere_revision_km, kilometrage, intervalle_revision_km, intervalle_revision_mois, km_moyen_mois, automatismes")
        .is("archived_at", null);
      const out: Echeance[] = [];
      for (const v of (data ?? []) as any[]) {
        if (v.statut === "archive") continue;
        if (v.automatismes?.calendrier?.on === false) continue;
        const plate = v.immatriculation ?? "Véhicule";
        const push = (type: string, date: string | null) => {
          if (!date) return;
          out.push({ id: `${v.id}-${type}`, date, type, label: ECH_TYPES.find((t) => t.id === type)!.label, plate, tone: dueTone(daysUntil(date)) });
        };
        push("ct", v.controle_technique_expire_le);
        push("assurance", v.assurance_expire_le);
        push("contrat", v.fin_contrat_le);
        if (v.kilometrage != null || v.derniere_revision_le) {
          const r = nextRevision({ lastDate: v.derniere_revision_le, lastKm: v.derniere_revision_km, currentKm: v.kilometrage,
            intervalKm: v.intervalle_revision_km || 15000, intervalMonths: v.intervalle_revision_mois || 12, kmPerMonth: v.km_moyen_mois || 1500 });
          push("revision", r.date);
        }
      }
      setList(out);
    })();
  }, []);
  return list;
}

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function CalendrierPage() {
  const { missions, loading } = useProMissions();
  const [view, setView] = useState<"mois" | "semaine">("mois");
  const [cursor, setCursor] = useState(() => new Date());
  const echeances = useEcheances();
  const [showEch, setShowEch] = useState(true);
  const [types, setTypes] = useState<string[]>(ECH_TYPES.map((t) => t.id));
  const echByDay = useMemo(() => {
    const map = new Map<string, Echeance[]>();
    if (!showEch) return map;
    for (const e of echeances) {
      if (!types.includes(e.type)) continue;
      map.set(e.date, [...(map.get(e.date) ?? []), e]);
    }
    return map;
  }, [echeances, showEch, types]);

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
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`pp-quick ${showEch ? "ring-2 ring-pro-accent" : ""}`} aria-pressed={showEch} onClick={() => setShowEch((v) => !v)}>
          {showEch ? "Masquer" : "Afficher"} les échéances des véhicules
        </button>
        {showEch && ECH_TYPES.map((t) => (
          <button key={t.id} type="button" aria-pressed={types.includes(t.id)}
            className={`pp-quick ${types.includes(t.id) ? "ring-2 ring-pro-accent" : "opacity-60"}`}
            onClick={() => setTypes((l) => (l.includes(t.id) ? l.filter((x) => x !== t.id) : [...l, t.id]))}>{t.label}</button>
        ))}
      </div>
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
                {(echByDay.get(k) ?? []).map((e) => (
                  <Link key={e.id} to="/dashboard-pro/flotte" className={`pp-cal-ev pp-ech pp-ech-${e.tone}`} title={`${e.label} · ${e.plate}`}>
                    {e.label} · <span className="font-mono">{e.plate}</span>
                  </Link>
                ))}
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
