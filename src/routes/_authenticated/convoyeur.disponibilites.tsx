import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Trash2, CalendarCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/convoyeur/disponibilites")({
  component: ConvoyeurDisponibilites,
});

type Statut = "disponible" | "indisponible";

interface DispoRow {
  id: string;
  date_dispo: string;
  statut: Statut;
  notes: string | null;
}

const FRENCH_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ConvoyeurDisponibilites() {
  const { user } = useAuth();
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispos, setDispos] = useState<DispoRow[]>([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editStatut, setEditStatut] = useState<Statut>("disponible");
  const [editNotes, setEditNotes] = useState("");

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: conv } = await supabase
      .from("convoyeurs")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!conv) { setLoading(false); return; }
    setConvoyeurId(conv.id);

    const from = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 3, 0);
    const { data } = await supabase
      .from("disponibilites_convoyeurs")
      .select("id, date_dispo, statut, notes")
      .eq("convoyeur_id", conv.id)
      .gte("date_dispo", fmtDate(from))
      .lte("date_dispo", fmtDate(to))
      .order("date_dispo", { ascending: true });
    setDispos((data as DispoRow[]) ?? []);
    setLoading(false);
  }, [user, cursor]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (!selectedDate) return;
    const existing = dispos.find((d) => d.date_dispo === selectedDate);
    setEditStatut((existing?.statut as Statut) ?? "disponible");
    setEditNotes(existing?.notes ?? "");
  }, [selectedDate, dispos]);

  const dispoMap = useMemo(() => {
    const map = new Map<string, DispoRow>();
    dispos.forEach((d) => map.set(d.date_dispo, d));
    return map;
  }, [dispos]);

  const monthGrid = useMemo(() => {
    const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const offset = (firstDay.getDay() + 6) % 7;
    const cells: { date: Date; current: boolean }[] = [];
    for (let i = 0; i < offset; i++) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth(), -offset + 1 + i);
      cells.push({ date: d, current: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), i), current: true });
    }
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      cells.push({ date: next, current: false });
    }
    return cells;
  }, [cursor]);

  const todayStr = fmtDate(new Date());

  const saveDispo = async () => {
    if (!convoyeurId || !selectedDate) return;
    setSaving(true);
    const existing = dispoMap.get(selectedDate);
    if (existing) {
      await supabase
        .from("disponibilites_convoyeurs")
        .update({ statut: editStatut, notes: editNotes || null })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("disponibilites_convoyeurs")
        .insert({ convoyeur_id: convoyeurId, date_dispo: selectedDate, statut: editStatut, notes: editNotes || null });
    }
    await loadAll();
    setSaving(false);
  };

  const removeDispo = async () => {
    if (!selectedDate) return;
    const existing = dispoMap.get(selectedDate);
    if (!existing) return;
    setSaving(true);
    await supabase.from("disponibilites_convoyeurs").delete().eq("id", existing.id);
    await loadAll();
    setSaving(false);
  };

  const stats = useMemo(() => {
    const monthRows = dispos.filter((d) => d.date_dispo.startsWith(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`
    ));
    return {
      dispo: monthRows.filter((d) => d.statut === "disponible").length,
      indispo: monthRows.filter((d) => d.statut === "indisponible").length,
    };
  }, [dispos, cursor]);

  const inputClass = "w-full bg-white border border-pro-border rounded-lg px-3 py-2.5 text-pro-text text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 focus:outline-none transition-colors";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-pro-text">Mes disponibilités</h1>
          <p className="text-pro-text-soft text-sm mt-1">Cliquez sur un jour pour indiquer votre disponibilité.</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">{stats.dispo} dispo</span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">{stats.indispo} indispo</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-600" size={24} /></div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_300px] gap-4">
          {/* Calendar */}
          <div className="bg-white rounded-xl border border-pro-border p-4 md:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                className="p-2 rounded-lg hover:bg-pro-bg-soft text-pro-text-soft hover:text-pro-text transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="font-semibold text-pro-text text-base">
                {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
              </h2>
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                className="p-2 rounded-lg hover:bg-pro-bg-soft text-pro-text-soft hover:text-pro-text transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-pro-muted mb-2 font-medium">
              {FRENCH_DAYS.map((d) => <div key={d}>{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((cell, i) => {
                const ds = fmtDate(cell.date);
                const dispo = dispoMap.get(ds);
                const isSelected = ds === selectedDate;
                const isToday = ds === todayStr;
                const isPast = ds < todayStr;

                let bg = "bg-white border-pro-border text-pro-muted";
                if (cell.current) {
                  if (dispo?.statut === "disponible") bg = "bg-emerald-50 border-emerald-200 text-emerald-800";
                  else if (dispo?.statut === "indisponible") bg = "bg-red-50 border-red-200 text-red-700";
                  else bg = "bg-pro-bg-soft border-pro-border text-pro-text";
                }
                if (isSelected) bg += " ring-2 ring-emerald-500";
                if (isToday) bg += " font-bold";

                return (
                  <button
                    key={i}
                    disabled={!cell.current || isPast}
                    onClick={() => setSelectedDate(ds)}
                    className={`aspect-square rounded-lg border text-sm transition-all ${bg} ${cell.current && !isPast ? "hover:border-emerald-400 cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-pro-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Disponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Indisponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-pro-bg-soft border border-pro-border" /> Non renseigné
              </span>
            </div>
          </div>

          {/* Editor */}
          <div className="bg-white rounded-xl border border-pro-border p-5 space-y-4 h-fit lg:sticky lg:top-4 shadow-sm">
            <h3 className="font-semibold text-sm text-pro-text flex items-center gap-2">
              <CalendarCheck size={16} className="text-emerald-600" />
              {selectedDate ? new Date(selectedDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Sélectionnez un jour"}
            </h3>

            {!selectedDate ? (
              <p className="text-pro-muted text-sm">Cliquez sur une case du calendrier.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEditStatut("disponible")}
                    className={`px-3 py-2.5 rounded-lg border text-xs uppercase tracking-wider font-medium transition-all ${
                      editStatut === "disponible"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                        : "bg-white text-pro-text-soft border-pro-border hover:border-emerald-300"
                    }`}
                  >
                    Disponible
                  </button>
                  <button
                    onClick={() => setEditStatut("indisponible")}
                    className={`px-3 py-2.5 rounded-lg border text-xs uppercase tracking-wider font-medium transition-all ${
                      editStatut === "indisponible"
                        ? "bg-red-50 text-red-700 border-red-300"
                        : "bg-white text-pro-text-soft border-pro-border hover:border-red-300"
                    }`}
                  >
                    Indisponible
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-pro-text-soft mb-1">Notes (optionnel)</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Ex : Disponible matin uniquement"
                    rows={3}
                    className={inputClass + " resize-none"}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={saveDispo}
                    disabled={saving}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
                  >
                    {saving && <Loader2 size={12} className="animate-spin" />} Enregistrer
                  </button>
                  {dispoMap.has(selectedDate) && (
                    <button
                      onClick={removeDispo}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-white text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
