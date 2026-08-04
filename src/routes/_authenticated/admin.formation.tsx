/**
 * Admin — Formation interne convoyeurs (refonte complète).
 * Onglets : Suivi convoyeurs · Modules (édition contenu / checklist / quiz).
 */
import { createFileRoute } from "@tanstack/react-router";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  GraduationCap, Loader2, Save, BarChart3, BookOpen, Users, RefreshCw,
  CheckCircle2, Clock3, Circle, Plus, Trash2, ChevronDown, ChevronUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/formation")({
  component: AdminFormation,
});

type QuizQ = { question: string; choices: string[]; answer?: number; explanation?: string };
type ModuleRow = {
  id: string;
  order_index: number;
  title: string;
  tag: string | null;
  duration_minutes: number;
  objectives: string[];
  content: string;
  video_url: string | null;
  resource_url: string | null;
  resource_label: string | null;
  checklist_items: string[];
  case_study: { scenario?: string | null; choices?: { label: string; correct?: boolean; feedback?: string }[] };
  quiz_questions: QuizQ[];
  is_active: boolean;
  last_updated: string;
};
type Driver = {
  id: string;
  user_id: string | null;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  statut: string;
  training_status: string | null;
  has_completed_training: boolean;
  training_completed_at: string | null;
};
type TrainingModule = { id: string; title: string; sort_order: number | null };
type ProgressRow = { convoyeur_id: string; module_id: string; status: string | null; score: number | null };

type Tab = "suivi" | "modules";

function AdminFormation() {
  const [tab, setTab] = useState<Tab>("suivi");
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [trainingModules, setTrainingModules] = useState<TrainingModule[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [progress, setProgress] = useState<ProgressRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [mods, tmods, convs, prog] = await Promise.all([
      supabase.from("modules").select("*").order("order_index"),
      supabase.from("formation_modules").select("id, title, sort_order").eq("is_active", true).order("sort_order"),
      supabase
        .from("convoyeurs")
        .select("id, user_id, nom, prenom, email, statut, training_status, has_completed_training, training_completed_at")
        .order("created_at", { ascending: false }),
      supabase.from("formation_progress").select("convoyeur_id, module_id, status, score"),
    ]);
    setModules((mods.data as unknown as ModuleRow[]) ?? []);
    setTrainingModules((tmods.data as unknown as TrainingModule[]) ?? []);
    setDrivers((convs.data as unknown as Driver[]) ?? []);
    setProgress((prog.data as unknown as ProgressRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <AdminSectionHeader
        breadcrumb="Formation"
        eyebrow="Académie Ligneo"
        title="Formation"
        highlight="convoyeurs"
        subtitle="Suivi des modules, progression et validation des convoyeurs."
      />


      <div className="flex gap-1 border-b border-pro-border overflow-x-auto">
        {(
          [
            ["suivi", "Suivi convoyeurs", <BarChart3 key="s" size={14} />],
            ["modules", "Modules", <BookOpen key="m" size={14} />],
          ] as [Tab, string, React.ReactNode][]
        ).map(([k, label, icon]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px ${
              tab === k ? "border-pro-accent text-pro-accent" : "border-transparent text-pro-muted hover:text-pro-text"
            }`}
          >
            {icon} {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto px-3 text-xs text-pro-muted flex items-center gap-1.5 hover:text-pro-text"
        >
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-pro-accent" />
        </div>
      ) : tab === "suivi" ? (
        <SuiviTab modules={trainingModules} drivers={drivers} progress={progress} />
      ) : (
        <ModulesTab modules={modules} onSaved={load} />
      )}
    </div>
  );
}

function SuiviTab({
  modules,
  drivers,
  progress,
}: {
  modules: TrainingModule[];
  drivers: Driver[];
  progress: ProgressRow[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const byUser = useMemo(() => {
    const map: Record<string, ProgressRow[]> = {};
    for (const p of progress) (map[p.convoyeur_id] ??= []).push(p);
    return map;
  }, [progress]);

  const stats = useMemo(() => {
    const started = drivers.filter((d) => (byUser[d.id] ?? []).length > 0 || d.has_completed_training).length;
    const done = drivers.filter((d) => d.has_completed_training).length;
    return { total: drivers.length, started, done };
  }, [drivers, byUser]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Convoyeurs", stats.total, <Users key="u" size={16} />],
          ["Formation démarrée", stats.started, <Clock3 key="c" size={16} />],
          ["Formation validée", stats.done, <CheckCircle2 key="d" size={16} />],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="rounded-2xl border border-pro-border bg-white p-4">
            <p className="text-xs text-pro-muted flex items-center gap-1.5">
              {icon as React.ReactNode} {label as string}
            </p>
            <p className="text-2xl font-semibold text-pro-text mt-1">{value as number}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-pro-border bg-white overflow-hidden">
        {drivers.map((d) => {
          const rows = byUser[d.id] ?? [];
          const total = modules.length;
          const rawDone = rows.filter((r) => r.status === "completed").length;
          // Un convoyeur validé est considéré à 100 % même si l'historique par module est incomplet.
          const done = d.has_completed_training ? total : Math.min(rawDone, total);
          const pct = total ? Math.round((done / total) * 100) : d.has_completed_training ? 100 : 0;
          const open = openId === d.id;
          return (
            <div key={d.id} className="border-b border-pro-border last:border-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : d.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-pro-bg-soft"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-pro-text truncate">
                    {d.prenom} {d.nom}
                  </p>
                  <p className="text-xs text-pro-muted truncate">{d.email}</p>
                </div>
                <div className="hidden sm:block w-40">
                  <div className="h-2 rounded-full bg-pro-bg-soft overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        d.has_completed_training
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                          : "bg-gradient-to-r from-[#B8862A] to-[#E7C76A]"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-semibold text-pro-text w-16 text-right">
                  {done}/{total}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    d.has_completed_training
                      ? "bg-emerald-100 text-emerald-700"
                      : done > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-pro-bg-soft text-pro-muted"
                  }`}
                >
                  {d.has_completed_training ? "Validée" : done > 0 ? "En cours" : "Non démarrée"}
                </span>
                {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {open && (
                <ul className="px-4 pb-4 space-y-1.5">
                  {modules.map((m, i) => {
                    const r = rows.find((x) => x.module_id === m.id);
                    const completed = r?.status === "completed" || d.has_completed_training;
                    return (
                      <li key={m.id} className="flex items-center gap-2 text-xs text-pro-text-soft">
                        {completed ? (
                          <CheckCircle2 size={13} className="text-emerald-600" />
                        ) : r ? (
                          <Clock3 size={13} className="text-amber-600" />
                        ) : (
                          <Circle size={13} className="text-pro-muted" />
                        )}
                        <span className="flex-1 truncate">
                          {m.sort_order ?? i + 1}. {m.title}
                        </span>
                        <span className="text-pro-muted">
                          {r?.score !== null && r?.score !== undefined ? `${r.score}%` : "—"}
                        </span>
                      </li>
                    );
                  })}

                </ul>
              )}
            </div>
          );
        })}
        {drivers.length === 0 && <p className="p-8 text-center text-sm text-pro-muted">Aucun convoyeur.</p>}
      </div>
    </div>
  );
}

function ModulesTab({ modules, onSaved }: { modules: ModuleRow[]; onSaved: () => void }) {
  const [editing, setEditing] = useState<ModuleRow | null>(modules[0] ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditing((e) => (e ? (modules.find((m) => m.id === e.id) ?? modules[0] ?? null) : (modules[0] ?? null)));
  }, [modules]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase
      .from("modules")
      .update({
        title: editing.title,
        tag: editing.tag,
        duration_minutes: editing.duration_minutes,
        objectives: editing.objectives,
        content: editing.content,
        video_url: editing.video_url,
        resource_url: editing.resource_url,
        resource_label: editing.resource_label,
        checklist_items: editing.checklist_items,
        quiz_questions: editing.quiz_questions as unknown as never,
        is_active: editing.is_active,
        last_updated: new Date().toISOString(),
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) toast.error("Enregistrement impossible : " + error.message);
    else {
      toast.success("Module enregistré");
      onSaved();
    }
  };

  if (!editing) return <p className="text-sm text-pro-muted">Aucun module.</p>;

  const patch = (p: Partial<ModuleRow>) => setEditing({ ...editing, ...p });

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-2xl border border-pro-border bg-white p-2 h-fit">
        {modules.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setEditing(m)}
            className={`w-full text-left rounded-lg px-3 py-2 text-sm ${
              editing.id === m.id ? "bg-pro-accent/10 text-pro-accent font-medium" : "text-pro-text-soft hover:bg-pro-bg-soft"
            }`}
          >
            {m.order_index}. {m.title}
          </button>
        ))}
      </aside>

      <div className="space-y-4">
        <div className="rounded-2xl border border-pro-border bg-white p-5 space-y-3">
          <Field label="Titre">
            <input className={inputCls} value={editing.title} onChange={(e) => patch({ title: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Tag">
              <input className={inputCls} value={editing.tag ?? ""} onChange={(e) => patch({ tag: e.target.value })} />
            </Field>
            <Field label="Durée (min)">
              <input
                type="number"
                className={inputCls}
                value={editing.duration_minutes}
                onChange={(e) => patch({ duration_minutes: Number(e.target.value) })}
              />
            </Field>
            <Field label="Actif">
              <select
                className={inputCls}
                value={editing.is_active ? "1" : "0"}
                onChange={(e) => patch({ is_active: e.target.value === "1" })}
              >
                <option value="1">Oui</option>
                <option value="0">Non</option>
              </select>
            </Field>
          </div>
          <Field label="Objectifs (une ligne par objectif)">
            <textarea
              rows={3}
              className={inputCls}
              value={editing.objectives.join("\n")}
              onChange={(e) => patch({ objectives: e.target.value.split("\n").filter(Boolean) })}
            />
          </Field>
          <Field label="Contenu (## titre, !! alerte, >> conseil, - liste, [[terme|définition]])">
            <textarea rows={14} className={`${inputCls} font-mono text-xs`} value={editing.content} onChange={(e) => patch({ content: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Vidéo (URL)">
              <input className={inputCls} value={editing.video_url ?? ""} onChange={(e) => patch({ video_url: e.target.value })} />
            </Field>
            <Field label="Ressource (URL)">
              <input className={inputCls} value={editing.resource_url ?? ""} onChange={(e) => patch({ resource_url: e.target.value })} />
            </Field>
            <Field label="Libellé ressource">
              <input
                className={inputCls}
                value={editing.resource_label ?? ""}
                onChange={(e) => patch({ resource_label: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Checklist (une ligne par point)">
            <textarea
              rows={5}
              className={inputCls}
              value={editing.checklist_items.join("\n")}
              onChange={(e) => patch({ checklist_items: e.target.value.split("\n").filter(Boolean) })}
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-pro-border bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-pro-text">Quiz ({editing.quiz_questions.length} questions)</h3>
            <button
              type="button"
              onClick={() =>
                patch({ quiz_questions: [...editing.quiz_questions, { question: "", choices: ["", ""], answer: 0, explanation: "" }] })
              }
              className="text-xs text-pro-accent font-medium flex items-center gap-1"
            >
              <Plus size={13} /> Ajouter
            </button>
          </div>
          <div className="space-y-4">
            {editing.quiz_questions.map((q, qi) => (
              <div key={qi} className="rounded-xl border border-pro-border p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    className={inputCls}
                    placeholder="Question"
                    value={q.question}
                    onChange={(e) => {
                      const next = [...editing.quiz_questions];
                      next[qi] = { ...q, question: e.target.value };
                      patch({ quiz_questions: next });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ quiz_questions: editing.quiz_questions.filter((_, i) => i !== qi) })}
                    className="text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {q.choices.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={q.answer === ci}
                      onChange={() => {
                        const next = [...editing.quiz_questions];
                        next[qi] = { ...q, answer: ci };
                        patch({ quiz_questions: next });
                      }}
                    />
                    <input
                      className={inputCls}
                      value={c}
                      onChange={(e) => {
                        const next = [...editing.quiz_questions];
                        const choices = [...q.choices];
                        choices[ci] = e.target.value;
                        next[qi] = { ...q, choices };
                        patch({ quiz_questions: next });
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const next = [...editing.quiz_questions];
                    next[qi] = { ...q, choices: [...q.choices, ""] };
                    patch({ quiz_questions: next });
                  }}
                  className="text-xs text-pro-muted"
                >
                  + Réponse
                </button>
                <input
                  className={inputCls}
                  placeholder="Explication affichée après réponse"
                  value={q.explanation ?? ""}
                  onChange={(e) => {
                    const next = [...editing.quiz_questions];
                    next[qi] = { ...q, explanation: e.target.value };
                    patch({ quiz_questions: next });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-[#0B1338] text-white text-sm font-semibold px-5 py-2.5 flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer le module
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-pro-border px-3 py-2 text-sm outline-none focus:border-pro-accent bg-white text-pro-text";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-pro-muted mb-1">{label}</span>
      {children}
    </label>
  );
}
