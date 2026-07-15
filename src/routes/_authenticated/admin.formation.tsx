/**
 * Admin — CMS Académie Ligneo.
 * Onglets : Tableau de bord, Modules, Examen final, Résultats, Certificats.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { uploadFormationImage } from "@/lib/formation-images.functions";
import {
  GraduationCap, Loader2, Plus, Save, Trash2, Award, BarChart3,
  BookOpen, Trophy, Users, RefreshCw, ShieldCheck, XCircle, CheckCircle2,
  GripVertical, ImageIcon, Type, ListChecks, AlertTriangle, Info, Upload,
  ChevronDown, ChevronUp, PlusCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/formation")({
  component: AdminFormation,
});

type Section =
  | { type: "text"; content: string }
  | { type: "image"; url: string; alt?: string; caption?: string }
  | { type: "video"; url: string }
  | { type: "checklist"; items: string[] }
  | { type: "callout"; tone?: "info" | "warning" | "success"; content: string };

type QuizQ = { question: string; choices: string[]; answer?: number; explanation?: string };

type Module = {
  id: string; slug: string; title: string; description: string | null; category: string;
  content_type: string; content_url: string | null; content_body: string | null;
  quiz_questions: QuizQ[]; sections: Section[];
  minimum_score: number; estimated_minutes: number; sort_order: number;
  is_active: boolean; is_required: boolean;
};

type Exam = { id: string; title: string; description: string | null; question_pool: QuizQ[]; question_count: number; time_limit_minutes: number; minimum_score: number; is_active: boolean };
type Convoyeur = { id: string; nom: string | null; prenom: string | null; email: string | null; statut: string; has_completed_training: boolean; training_status: string; training_completed_at: string | null };
type ExamAttempt = { id: string; convoyeur_id: string; score: number; passed: boolean; finished_at: string; duration_seconds: number | null };
type Progress = { convoyeur_id: string; module_id: string; status: string };
type Certificate = { id: string; convoyeur_id: string; certificate_number: string; full_name: string; issued_at: string; revoked_at: string | null; verification_token: string };

type Tab = "dashboard" | "modules" | "exam" | "results" | "certificates";

function AdminFormation() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-pro-border bg-white p-5 shadow-pro-card">
        <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold">Administration</p>
        <h1 className="text-2xl font-semibold text-pro-text mt-1 flex items-center gap-2"><GraduationCap size={22} className="text-pro-accent" /> Académie Ligneo</h1>
      </div>
      <div className="flex gap-1 border-b border-pro-border overflow-x-auto">
        {([
          ["dashboard", "Tableau de bord", <BarChart3 key="d" size={14} />],
          ["modules", "Modules", <BookOpen key="m" size={14} />],
          ["exam", "Examen final", <Trophy key="e" size={14} />],
          ["results", "Résultats", <Users key="r" size={14} />],
          ["certificates", "Certificats", <Award key="c" size={14} />],
        ] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id as Tab)} className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === id ? "border-pro-accent text-pro-accent" : "border-transparent text-pro-muted hover:text-pro-text"}`}>
            {icon} {label}
          </button>
        ))}
      </div>
      {tab === "dashboard" && <Dashboard />}
      {tab === "modules" && <ModulesTab />}
      {tab === "exam" && <ExamTab />}
      {tab === "results" && <ResultsTab />}
      {tab === "certificates" && <CertificatesTab />}
    </div>
  );
}

/* ============ DASHBOARD ============ */

function Dashboard() {
  const [stats, setStats] = useState<{ certified: number; inProgress: number; notStarted: number; avgScore: number; recentCerts: Certificate[] } | null>(null);

  useEffect(() => {
    (async () => {
      const [convs, atts, certs] = await Promise.all([
        supabase.from("convoyeurs").select("id, training_status").eq("statut", "valide"),
        supabase.from("formation_exam_attempts" as never).select("score, passed" as never),
        supabase.from("formation_certificates" as never).select("id, convoyeur_id, certificate_number, full_name, issued_at, revoked_at, verification_token" as never).order("issued_at" as never, { ascending: false }).limit(5),
      ]);
      const cList = (convs.data ?? []) as { training_status: string }[];
      const aList = (atts.data ?? []) as { score: number; passed: boolean }[];
      setStats({
        certified: cList.filter(c => c.training_status === "completed").length,
        inProgress: cList.filter(c => c.training_status === "in_progress").length,
        notStarted: cList.filter(c => c.training_status === "not_started").length,
        avgScore: aList.length ? Math.round(aList.reduce((s, a) => s + a.score, 0) / aList.length) : 0,
        recentCerts: (certs.data ?? []) as unknown as Certificate[],
      });
    })();
  }, []);

  if (!stats) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-pro-accent" /></div>;

  const cards = [
    { label: "Certifiés", value: stats.certified, color: "emerald" },
    { label: "En cours", value: stats.inProgress, color: "blue" },
    { label: "Non commencés", value: stats.notStarted, color: "amber" },
    { label: "Score moyen examen", value: `${stats.avgScore}%`, color: "purple" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl border border-pro-border bg-white p-4 shadow-pro-card">
            <p className="text-[11px] uppercase tracking-wider text-pro-muted font-semibold">{c.label}</p>
            <p className="text-3xl font-bold text-pro-text mt-2">{c.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-pro-border bg-white p-5 shadow-pro-card">
        <h2 className="text-lg font-semibold text-pro-text mb-3">Derniers certificats</h2>
        {stats.recentCerts.length === 0 ? <p className="text-sm text-pro-muted">Aucun certificat délivré.</p> : (
          <ul className="divide-y divide-pro-border">
            {stats.recentCerts.map(c => (
              <li key={c.id} className="py-2 flex items-center justify-between gap-3">
                <div><p className="font-semibold text-sm">{c.full_name}</p><p className="text-xs text-pro-muted font-mono">{c.certificate_number}</p></div>
                <p className="text-xs text-pro-muted">{new Date(c.issued_at).toLocaleDateString("fr-FR")}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ============ MODULES ============ */

function ModulesTab() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("formation_modules" as never).select("*" as never).order("sort_order" as never, { ascending: true });
    setModules((data ?? []) as unknown as Module[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const createNew = async () => {
    const { data, error } = await supabase.from("formation_modules" as never).insert({
      slug: `module-${Date.now()}`, title: "Nouveau module", description: "",
      content_type: "text", content_body: "", quiz_questions: [], sections: [],
      minimum_score: 80, estimated_minutes: 10, sort_order: modules.length * 10, is_active: false, is_required: true, category: "general",
    } as never).select().single();
    if (error) return toast.error(error.message);
    toast.success("Module créé");
    await load();
    setEditingId((data as { id: string }).id);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce module ?")) return;
    const { error } = await supabase.from("formation_modules" as never).delete().eq("id" as never, id as never);
    if (error) return toast.error(error.message);
    toast.success("Module supprimé");
    await load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-pro-accent" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-pro-text-soft">{modules.length} module{modules.length > 1 ? "s" : ""}</p>
        <button onClick={createNew} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"><Plus size={15} /> Nouveau module</button>
      </div>
      <div className="space-y-3">
        {modules.map(m => (
          <ModuleEditor key={m.id} module={m} isOpen={editingId === m.id} onToggle={() => setEditingId(editingId === m.id ? null : m.id)} onSaved={load} onDelete={() => remove(m.id)} />
        ))}
      </div>
    </div>
  );
}

function ModuleEditor({ module: m, isOpen, onToggle, onSaved, onDelete }: { module: Module; isOpen: boolean; onToggle: () => void; onSaved: () => void; onDelete: () => void }) {
  const [form, setForm] = useState({
    title: m.title, description: m.description ?? "", category: m.category,
    content_type: m.content_type, content_url: m.content_url ?? "", content_body: m.content_body ?? "",
    minimum_score: m.minimum_score, estimated_minutes: m.estimated_minutes, sort_order: m.sort_order,
    is_active: m.is_active, is_required: m.is_required,
    quiz_json: JSON.stringify(m.quiz_questions ?? [], null, 2),
  });
  const [sections, setSections] = useState<Section[]>(Array.isArray(m.sections) ? m.sections : []);
  const [saving, setSaving] = useState(false);
  const uploadImageFn = useServerFn(uploadFormationImage);

  const save = async () => {
    let quiz;
    try { quiz = JSON.parse(form.quiz_json); if (!Array.isArray(quiz)) throw new Error(); }
    catch { return toast.error("JSON de questions invalide"); }
    setSaving(true);
    const { error } = await supabase.from("formation_modules" as never).update({
      title: form.title, description: form.description, category: form.category,
      content_type: form.content_type, content_url: form.content_url || null, content_body: form.content_body || null,
      minimum_score: form.minimum_score, estimated_minutes: form.estimated_minutes, sort_order: form.sort_order,
      is_active: form.is_active, is_required: form.is_required, quiz_questions: quiz, sections,
    } as never).eq("id" as never, m.id as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Module enregistré");
    onSaved();
  };

  const addSection = (type: Section["type"]) => {
    const base: Record<string, Section> = {
      text: { type: "text", content: "" },
      image: { type: "image", url: "", alt: "", caption: "" },
      video: { type: "video", url: "" },
      checklist: { type: "checklist", items: [""] },
      callout: { type: "callout", tone: "info", content: "" },
    };
    setSections((prev) => [...prev, base[type]]);
  };

  const updateSection = (index: number, patch: Partial<Section>) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } as Section : s)));
  };

  const moveSection = (index: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeSection = (index: number) => {
    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageUpload = async (index: number, file: File) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const res = await uploadImageFn({ data: { fileBase64: base64, fileName: file.name, contentType: file.type } });
        updateSection(index, { url: res.signedUrl });
        toast.success("Image uploadée");
      };
    } catch (e) {
      toast.error("Échec de l'upload");
    }
  };

  return (
    <div className="rounded-xl border border-pro-border bg-white">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-pro-bg-soft">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-pro-text">{m.title}</span>
            {m.is_active ? <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">Actif</span> : <span className="text-[10px] rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">Inactif</span>}
            {m.is_required && <span className="text-[10px] rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">Obligatoire</span>}
          </div>
          <p className="text-xs text-pro-muted mt-1">Ordre {m.sort_order} · {m.estimated_minutes} min · {m.category}</p>
        </div>
        {isOpen ? <ChevronUp size={18} className="text-pro-muted" /> : <ChevronDown size={18} className="text-pro-muted" />}
      </button>
      {isOpen && (
        <div className="border-t border-pro-border p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Titre"><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>
            <Field label="Catégorie"><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>
            <Field label="Ordre"><input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: +e.target.value }))} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>
            <Field label="Durée estimée (min)"><input type="number" value={form.estimated_minutes} onChange={e => setForm(f => ({ ...f, estimated_minutes: +e.target.value }))} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>
            <Field label="Score min (%)"><input type="number" min={0} max={100} value={form.minimum_score} onChange={e => setForm(f => ({ ...f, minimum_score: +e.target.value }))} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>
            <Field label="Type de contenu">
              <select value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm">
                <option value="text">Texte</option><option value="video">Vidéo</option><option value="quiz">Quiz</option>
              </select>
            </Field>
          </div>
          <Field label="Description"><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>

          {/* Sections editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-pro-text">Contenu pédagogique</p>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => addSection("text")} className="inline-flex items-center gap-1 rounded-lg border border-pro-border px-2 py-1.5 text-xs hover:bg-pro-bg-soft"><Type size={12} /> Texte</button>
                <button onClick={() => addSection("image")} className="inline-flex items-center gap-1 rounded-lg border border-pro-border px-2 py-1.5 text-xs hover:bg-pro-bg-soft"><ImageIcon size={12} /> Image</button>
                <button onClick={() => addSection("checklist")} className="inline-flex items-center gap-1 rounded-lg border border-pro-border px-2 py-1.5 text-xs hover:bg-pro-bg-soft"><ListChecks size={12} /> Checklist</button>
                <button onClick={() => addSection("callout")} className="inline-flex items-center gap-1 rounded-lg border border-pro-border px-2 py-1.5 text-xs hover:bg-pro-bg-soft"><Info size={12} /> Encadré</button>
              </div>
            </div>
            {sections.map((s, i) => (
              <div key={i} className="rounded-xl border border-pro-border bg-pro-bg-soft/50 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-pro-muted uppercase flex items-center gap-1">
                    {s.type === "text" && <Type size={12} />}
                    {s.type === "image" && <ImageIcon size={12} />}
                    {s.type === "video" && <Info size={12} />}
                    {s.type === "checklist" && <ListChecks size={12} />}
                    {s.type === "callout" && <AlertTriangle size={12} />}
                    {s.type}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-1 rounded hover:bg-pro-bg-soft disabled:opacity-30"><ChevronUp size={14} className="text-pro-muted" /></button>
                    <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1} className="p-1 rounded hover:bg-pro-bg-soft disabled:opacity-30"><ChevronDown size={14} className="text-pro-muted" /></button>
                    <button onClick={() => removeSection(i)} className="p-1 rounded hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                  </div>
                </div>
                {s.type === "text" && <textarea value={s.content} onChange={e => updateSection(i, { content: e.target.value })} rows={4} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" placeholder="Contenu texte..." />}
                {s.type === "callout" && (
                  <>
                    <select value={s.tone ?? "info"} onChange={e => updateSection(i, { tone: e.target.value as "info" | "warning" | "success" })} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm mb-2">
                      <option value="info">Info</option><option value="warning">Avertissement</option><option value="success">Succès</option>
                    </select>
                    <textarea value={s.content} onChange={e => updateSection(i, { content: e.target.value })} rows={3} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" placeholder="Contenu de l'encadré..." />
                  </>
                )}
                {s.type === "image" && (
                  <div className="space-y-2">
                    <input value={s.url} onChange={e => updateSection(i, { url: e.target.value })} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" placeholder="URL de l'image ou upload..." />
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 rounded-lg bg-pro-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 cursor-pointer">
                        <Upload size={12} /> Upload
                        <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(i, e.target.files[0])} />
                      </label>
                      {s.url && <img src={s.url} alt={s.alt} className="h-12 w-12 rounded object-cover border border-pro-border" />}
                    </div>
                    <input value={s.alt ?? ""} onChange={e => updateSection(i, { alt: e.target.value })} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" placeholder="Texte alternatif" />
                    <input value={s.caption ?? ""} onChange={e => updateSection(i, { caption: e.target.value })} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" placeholder="Légende" />
                  </div>
                )}
                {s.type === "video" && <input value={s.url} onChange={e => updateSection(i, { url: e.target.value })} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" placeholder="URL vidéo ou YouTube" />}
                {s.type === "checklist" && (
                  <div className="space-y-2">
                    {s.items.map((item, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input value={item} onChange={e => {
                          const next = [...s.items];
                          next[idx] = e.target.value;
                          updateSection(i, { items: next });
                        }} className="flex-1 rounded-lg border border-pro-border px-3 py-2 text-sm" placeholder="Élément de checklist" />
                        <button onClick={() => {
                          const next = s.items.filter((_, ii) => ii !== idx);
                          updateSection(i, { items: next });
                        }} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <button onClick={() => updateSection(i, { items: [...s.items, ""] })} className="inline-flex items-center gap-1 text-xs text-pro-accent hover:underline"><PlusCircle size={12} /> Ajouter un élément</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Field label='Questions QCM (JSON) — [{"question":"...","choices":["A","B","C"],"answer":0,"explanation":"..."}]'>
            <textarea value={form.quiz_json} onChange={e => setForm(f => ({ ...f, quiz_json: e.target.value }))} rows={8} className="w-full rounded-lg border border-pro-border px-3 py-2 text-xs font-mono" />
          </Field>
          <div className="flex gap-4">
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Actif</label>
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_required} onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} /> Obligatoire</label>
          </div>
          <div className="flex gap-2 pt-2 border-t border-pro-border">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer</button>
            <button onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg border border-red-200 text-red-700 px-4 py-2 text-sm hover:bg-red-50"><Trash2 size={14} /> Supprimer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-pro-text-soft block mb-1">{label}</span>{children}</label>;
}

/* ============ EXAM ============ */

function ExamTab() {
  const [exam, setExam] = useState<Exam | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; question_count: number; time_limit_minutes: number; minimum_score: number; is_active: boolean; pool_json: string }>({ title: "", description: "", question_count: 50, time_limit_minutes: 50, minimum_score: 80, is_active: true, pool_json: "[]" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("formation_exams" as never).select("*" as never).order("created_at" as never, { ascending: false }).limit(1);
    const e = ((data ?? [])[0] ?? null) as unknown as Exam | null;
    setExam(e);
    if (e) setForm({ title: e.title, description: e.description ?? "", question_count: e.question_count, time_limit_minutes: e.time_limit_minutes, minimum_score: e.minimum_score, is_active: e.is_active, pool_json: JSON.stringify(e.question_pool, null, 2) });
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    let pool;
    try { pool = JSON.parse(form.pool_json); if (!Array.isArray(pool)) throw new Error(); } catch { return toast.error("JSON de questions invalide"); }
    setSaving(true);
    const payload = { title: form.title, description: form.description || null, question_pool: pool, question_count: form.question_count, time_limit_minutes: form.time_limit_minutes, minimum_score: form.minimum_score, is_active: form.is_active };
    const { error } = exam
      ? await supabase.from("formation_exams" as never).update(payload as never).eq("id" as never, exam.id as never)
      : await supabase.from("formation_exams" as never).insert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Examen enregistré");
    await load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-pro-accent" /></div>;

  return (
    <div className="rounded-2xl border border-pro-border bg-white p-5 shadow-pro-card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Titre"><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>
        <Field label="Nombre de questions tirées"><input type="number" min={1} value={form.question_count} onChange={e => setForm(f => ({ ...f, question_count: +e.target.value }))} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>
        <Field label="Durée (min)"><input type="number" min={1} value={form.time_limit_minutes} onChange={e => setForm(f => ({ ...f, time_limit_minutes: +e.target.value }))} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>
        <Field label="Score min (%)"><input type="number" min={0} max={100} value={form.minimum_score} onChange={e => setForm(f => ({ ...f, minimum_score: +e.target.value }))} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>
      </div>
      <Field label="Description"><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full rounded-lg border border-pro-border px-3 py-2 text-sm" /></Field>
      <Field label={`Pool de questions (JSON) — ${form.question_count} questions tirées parmi ${(() => { try { return JSON.parse(form.pool_json).length; } catch { return "?"; } })()} disponibles`}>
        <textarea value={form.pool_json} onChange={e => setForm(f => ({ ...f, pool_json: e.target.value }))} rows={16} className="w-full rounded-lg border border-pro-border px-3 py-2 text-xs font-mono" />
      </Field>
      <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Actif</label>
      <div><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-pro-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer l'examen</button></div>
    </div>
  );
}

/* ============ RESULTS ============ */

function ResultsTab() {
  const [convs, setConvs] = useState<Convoyeur[]>([]);
  const [atts, setAtts] = useState<ExamAttempt[]>([]);
  const [prog, setProg] = useState<Progress[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [c, a, p, m] = await Promise.all([
      supabase.from("convoyeurs").select("id, nom, prenom, email, statut, has_completed_training, training_status, training_completed_at").eq("statut", "valide").order("nom", { ascending: true }),
      supabase.from("formation_exam_attempts" as never).select("id, convoyeur_id, score, passed, finished_at, duration_seconds" as never).order("finished_at" as never, { ascending: false }),
      supabase.from("formation_progress" as never).select("convoyeur_id, module_id, status" as never),
      supabase.from("formation_modules" as never).select("*" as never).eq("is_active" as never, true as never).eq("is_required" as never, true as never),
    ]);
    setConvs((c.data ?? []) as unknown as Convoyeur[]);
    setAtts((a.data ?? []) as unknown as ExamAttempt[]);
    setProg((p.data ?? []) as unknown as Progress[]);
    setModules((m.data ?? []) as unknown as Module[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const rows = useMemo(() => convs.map(c => {
    const completedCount = prog.filter(p => p.convoyeur_id === c.id && p.status === "completed" && modules.some(m => m.id === p.module_id)).length;
    const lastAttempt = atts.find(a => a.convoyeur_id === c.id);
    return { c, percent: modules.length ? Math.round((completedCount / modules.length) * 100) : 0, lastAttempt, attemptsCount: atts.filter(a => a.convoyeur_id === c.id).length };
  }), [convs, atts, prog, modules]);

  const forceCertify = async (id: string) => {
    if (!confirm("Certifier manuellement ce convoyeur ?")) return;
    const { error } = await supabase.from("convoyeurs").update({ has_completed_training: true, training_status: "completed", training_completed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Convoyeur certifié");
    await load();
  };

  const reset = async (id: string) => {
    if (!confirm("Réinitialiser toute la progression et la certification ?")) return;
    await supabase.from("formation_progress" as never).delete().eq("convoyeur_id" as never, id as never);
    await supabase.from("formation_exam_attempts" as never).delete().eq("convoyeur_id" as never, id as never);
    await supabase.from("convoyeurs").update({ has_completed_training: false, training_status: "not_started", training_completed_at: null }).eq("id", id);
    toast.success("Progression réinitialisée");
    await load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-pro-accent" /></div>;

  return (
    <div className="rounded-2xl border border-pro-border bg-white p-5 shadow-pro-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-pro-muted uppercase">
          <tr><th className="pb-2">Convoyeur</th><th className="pb-2">Statut</th><th className="pb-2">Progression modules</th><th className="pb-2">Examen</th><th className="pb-2">Certifié le</th><th className="pb-2 text-right">Actions</th></tr>
        </thead>
        <tbody className="divide-y divide-pro-border">
          {rows.map(({ c, percent, lastAttempt, attemptsCount }) => (
            <tr key={c.id}>
              <td className="py-2"><div className="font-semibold">{c.prenom} {c.nom}</div><div className="text-xs text-pro-muted">{c.email}</div></td>
              <td className="py-2">
                {c.has_completed_training ? <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">Certifié</span>
                  : c.training_status === "in_progress" ? <span className="text-[10px] rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">En cours</span>
                  : <span className="text-[10px] rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">Non commencé</span>}
              </td>
              <td className="py-2"><div className="w-32 h-2 bg-pro-bg-soft rounded-full overflow-hidden inline-block align-middle"><div className="h-full bg-pro-brand-strip" style={{ width: `${percent}%` }} /></div> <span className="text-xs text-pro-muted ml-2">{percent}%</span></td>
              <td className="py-2 text-xs">{lastAttempt ? <>{lastAttempt.score}% {lastAttempt.passed ? "✅" : "❌"} <span className="text-pro-muted">({attemptsCount} tent.)</span></> : "—"}</td>
              <td className="py-2 text-xs">{c.training_completed_at ? new Date(c.training_completed_at).toLocaleDateString("fr-FR") : "—"}</td>
              <td className="py-2 text-right whitespace-nowrap">
                {!c.has_completed_training && <button onClick={() => forceCertify(c.id)} title="Certifier manuellement" className="inline-flex items-center gap-1 rounded border border-emerald-200 text-emerald-700 px-2 py-1 text-xs hover:bg-emerald-50 mr-1"><ShieldCheck size={12} /></button>}
                <button onClick={() => reset(c.id)} title="Réinitialiser" className="inline-flex items-center gap-1 rounded border border-pro-border px-2 py-1 text-xs hover:bg-pro-bg-soft"><RefreshCw size={12} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============ CERTIFICATES ============ */

function CertificatesTab() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("formation_certificates" as never).select("*" as never).order("issued_at" as never, { ascending: false });
    setCerts((data ?? []) as unknown as Certificate[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const revoke = async (id: string) => {
    if (!confirm("Révoquer ce certificat ? Il ne sera plus vérifiable publiquement.")) return;
    const { error } = await supabase.from("formation_certificates" as never).update({ revoked_at: new Date().toISOString() } as never).eq("id" as never, id as never);
    if (error) return toast.error(error.message);
    toast.success("Certificat révoqué");
    await load();
  };

  const restore = async (id: string) => {
    const { error } = await supabase.from("formation_certificates" as never).update({ revoked_at: null } as never).eq("id" as never, id as never);
    if (error) return toast.error(error.message);
    toast.success("Certificat réactivé");
    await load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-pro-accent" /></div>;

  return (
    <div className="rounded-2xl border border-pro-border bg-white p-5 shadow-pro-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-pro-muted uppercase">
          <tr><th className="pb-2">N°</th><th className="pb-2">Titulaire</th><th className="pb-2">Délivré le</th><th className="pb-2">Statut</th><th className="pb-2 text-right">Actions</th></tr>
        </thead>
        <tbody className="divide-y divide-pro-border">
          {certs.map(c => (
            <tr key={c.id}>
              <td className="py-2 font-mono text-xs">{c.certificate_number}</td>
              <td className="py-2 font-semibold">{c.full_name}</td>
              <td className="py-2 text-xs">{new Date(c.issued_at).toLocaleDateString("fr-FR")}</td>
              <td className="py-2">{c.revoked_at ? <span className="text-[10px] rounded-full bg-red-100 text-red-700 px-2 py-0.5">Révoqué</span> : <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">Actif</span>}</td>
              <td className="py-2 text-right whitespace-nowrap">
                <a href={`/verify-certificat/${c.verification_token}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-pro-border px-2 py-1 text-xs hover:bg-pro-bg-soft mr-1"><CheckCircle2 size={12} /> Vérifier</a>
                {c.revoked_at
                  ? <button onClick={() => restore(c.id)} className="inline-flex items-center gap-1 rounded border border-emerald-200 text-emerald-700 px-2 py-1 text-xs hover:bg-emerald-50">Réactiver</button>
                  : <button onClick={() => revoke(c.id)} className="inline-flex items-center gap-1 rounded border border-red-200 text-red-700 px-2 py-1 text-xs hover:bg-red-50"><XCircle size={12} /> Révoquer</button>}
              </td>
            </tr>
          ))}
          {certs.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-pro-muted text-sm">Aucun certificat.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
