import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Loader2, Trash2, CalendarCheck } from "lucide-react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

export const Route = createFileRoute("/_authenticated/convoyeur/disponibilites")({
  component: ConvoyeurDisponibilites,
});

type Statut = "disponible" | "indisponible";

interface DispoRow {
  id: string;
  date_dispo: string; // YYYY-MM-DD
  statut: Statut;
  notes: string | null;
}

const FRENCH_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  // Load convoyeur id + dispos
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

    // fenêtre : 6 mois autour
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

  // Pré-remplir le formulaire quand on sélectionne un jour
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

  // Construit la grille du mois courant (lundi-dim)
  const monthGrid = useMemo(() => {
    const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    // jour de la semaine du 1er (0=dim, 1=lun…). On veut commencer lundi.
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
        .insert({
          convoyeur_id: convoyeurId,
          date_dispo: selectedDate,
          statut: editStatut,
          notes: editNotes || null,
        });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Mes disponibilités</h1>
          <p className="text-cream/50 text-sm mt-1">
            Cliquez sur un jour pour indiquer votre disponibilité.
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <StatusBadge kind="success" size="md">{stats.dispo} dispo</StatusBadge>
          <StatusBadge kind="danger" size="md">{stats.indispo} indispo</StatusBadge>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          {/* Calendrier */}
          <div className="card-premium rounded-lg p-4 md:p-5">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
                className="p-2 rounded hover:bg-primary/10 text-cream/70 hover:text-primary transition-colors"
                aria-label="Mois précédent"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="font-heading text-lg text-primary tracking-wider">
                {MONTH_NAMES[cursor.getMonth()]} {cursor.getFullYear()}
              </h2>
              <button
                onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
                className="p-2 rounded hover:bg-primary/10 text-cream/70 hover:text-primary transition-colors"
                aria-label="Mois suivant"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wider text-cream/40 mb-2">
              {FRENCH_DAYS.map((d) => <div key={d}>{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((cell, i) => {
                const ds = fmtDate(cell.date);
                const dispo = dispoMap.get(ds);
                const isSelected = ds === selectedDate;
                const isToday = ds === todayStr;
                const isPast = ds < todayStr;

                let bg = "bg-card/40 border-primary/10 text-cream/40";
                if (cell.current) {
                  if (dispo?.statut === "disponible") bg = "bg-green-500/15 border-green-500/40 text-green-200";
                  else if (dispo?.statut === "indisponible") bg = "bg-red-500/15 border-red-500/40 text-red-200";
                  else bg = "bg-navy/40 border-primary/15 text-cream/80";
                }
                if (isSelected) bg += " ring-2 ring-primary";
                if (isToday) bg += " font-bold";

                return (
                  <button
                    key={i}
                    disabled={!cell.current || isPast}
                    onClick={() => setSelectedDate(ds)}
                    className={`aspect-square rounded border text-sm transition-all ${bg} ${cell.current && !isPast ? "hover:border-primary/60 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                  >
                    {cell.date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-cream/50">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-green-500/40 border border-green-500/60" /> Disponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500/40 border border-red-500/60" /> Indisponible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-navy/40 border border-primary/15" /> Non renseigné
              </span>
            </div>
          </div>

          {/* Editeur */}
          <div className="card-premium rounded-lg p-5 space-y-4 h-fit lg:sticky lg:top-4">
            <h3 className="font-heading text-base text-primary tracking-wider flex items-center gap-2">
              <CalendarCheck size={16} /> {selectedDate ? new Date(selectedDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Sélectionnez un jour"}
            </h3>

            {!selectedDate ? (
              <p className="text-cream/40 text-sm">
                Cliquez sur une case du calendrier pour modifier votre disponibilité de ce jour-là.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEditStatut("disponible")}
                    className={`px-3 py-2.5 rounded border text-xs uppercase tracking-wider transition-all ${
                      editStatut === "disponible"
                        ? "bg-green-500/20 text-green-300 border-green-500/50"
                        : "bg-navy/60 text-cream/50 border-primary/15 hover:border-green-500/30"
                    }`}
                  >
                    Disponible
                  </button>
                  <button
                    onClick={() => setEditStatut("indisponible")}
                    className={`px-3 py-2.5 rounded border text-xs uppercase tracking-wider transition-all ${
                      editStatut === "indisponible"
                        ? "bg-red-500/20 text-red-300 border-red-500/50"
                        : "bg-navy/60 text-cream/50 border-primary/15 hover:border-red-500/30"
                    }`}
                  >
                    Indisponible
                  </button>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-cream/40 mb-1">Notes (optionnel)</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Ex : Disponible matin uniquement"
                    rows={3}
                    className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={saveDispo}
                    disabled={saving}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-navy text-xs uppercase tracking-wider font-heading hover:bg-gold-light transition-colors disabled:opacity-60 rounded"
                  >
                    {saving && <Loader2 size={12} className="animate-spin" />} Enregistrer
                  </button>
                  {dispoMap.has(selectedDate) && (
                    <button
                      onClick={removeDispo}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-destructive/15 text-destructive border border-destructive/30 rounded text-xs hover:bg-destructive/25 transition-colors"
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
