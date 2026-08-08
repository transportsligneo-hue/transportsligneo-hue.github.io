import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2, Save, Eye, EyeOff, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Card, Button, IconButton, Badge, EmptyState, FormField, Select } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/contenu")({
  component: AdminContenu,
});

type Tab = "faq" | "avis" | "articles" | "newsletter" | "app";

type Faq = { id: string; question: string; reponse: string; ordre: number; publie: boolean };
type Avis = {
  id: string; note: number; commentaire: string; nom_affiche: string;
  ville: string | null; type_client: string | null; statut: string; date_avis: string;
};
type Article = {
  id: string; titre: string; slug: string; extrait: string | null; contenu: string;
  image_url: string | null; statut: string; published_at: string | null;
};
type Abonne = { id: string; email: string; source: string | null; created_at: string; unsubscribed_at: string | null };

const input = "w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text focus:border-pro-accent focus:outline-none";

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

function AdminContenu() {
  const [tab, setTab] = useState<Tab>("faq");
  const [faq, setFaq] = useState<Faq[]>([]);
  const [avis, setAvis] = useState<Avis[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [abonnes, setAbonnes] = useState<Abonne[]>([]);
  const [stores, setStores] = useState<{ ios: string; android: string }>({ ios: "", android: "" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [f, a, ar, ab, st] = await Promise.all([
      supabase.from("faq").select("*").order("ordre"),
      supabase.from("avis_clients").select("*").order("date_avis", { ascending: false }),
      supabase.from("articles").select("*").order("created_at", { ascending: false }),
      supabase.from("newsletter_abonnes").select("id, email, source, created_at, unsubscribed_at").order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", "store_links").maybeSingle(),
    ]);
    setFaq((f.data ?? []) as Faq[]);
    setAvis((a.data ?? []) as Avis[]);
    setArticles((ar.data ?? []) as Article[]);
    setAbonnes((ab.data ?? []) as Abonne[]);
    const v = (st.data?.value ?? {}) as Record<string, string>;
    setStores({ ios: v["ios"] ?? "", android: v["android"] ?? "" });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* ---------- FAQ ---------- */
  const addFaq = async () => {
    const { error } = await supabase.from("faq").insert({ question: "Nouvelle question", reponse: "Réponse à compléter.", ordre: faq.length, publie: false });
    if (error) return toast.error(error.message);
    void load();
  };
  const saveFaq = async (f: Faq) => {
    const { error } = await supabase.from("faq").update({ question: f.question, reponse: f.reponse, ordre: f.ordre, publie: f.publie }).eq("id", f.id);
    error ? toast.error(error.message) : toast.success("Question enregistrée");
  };
  const delFaq = async (id: string) => {
    const { error } = await supabase.from("faq").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setFaq((p) => p.filter((x) => x.id !== id));
  };

  /* ---------- Avis ---------- */
  const setAvisStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("avis_clients").update({ statut }).eq("id", id);
    if (error) return toast.error(error.message);
    setAvis((p) => p.map((x) => (x.id === id ? { ...x, statut } : x)));
  };
  const addAvis = async () => {
    const { error } = await supabase.from("avis_clients").insert({
      note: 5, commentaire: "Témoignage à compléter.", nom_affiche: "Client", statut: "en_attente",
    });
    if (error) return toast.error(error.message);
    void load();
  };
  const saveAvis = async (a: Avis) => {
    const { error } = await supabase.from("avis_clients").update({
      note: a.note, commentaire: a.commentaire, nom_affiche: a.nom_affiche, ville: a.ville, type_client: a.type_client,
    }).eq("id", a.id);
    error ? toast.error(error.message) : toast.success("Avis enregistré");
  };
  const delAvis = async (id: string) => {
    const { error } = await supabase.from("avis_clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setAvis((p) => p.filter((x) => x.id !== id));
  };

  /* ---------- Articles ---------- */
  const addArticle = async () => {
    const titre = "Nouvel article";
    const { error } = await supabase.from("articles").insert({
      titre, slug: `${slugify(titre)}-${Date.now().toString(36)}`, contenu: "", statut: "brouillon",
    });
    if (error) return toast.error(error.message);
    void load();
  };
  const saveArticle = async (a: Article) => {
    const { error } = await supabase.from("articles").update({
      titre: a.titre, slug: a.slug || slugify(a.titre), extrait: a.extrait, contenu: a.contenu,
      image_url: a.image_url, statut: a.statut,
      published_at: a.statut === "publie" ? (a.published_at ?? new Date().toISOString()) : a.published_at,
    }).eq("id", a.id);
    error ? toast.error(error.message) : toast.success("Article enregistré");
    if (!error) void load();
  };
  const delArticle = async (id: string) => {
    const { error } = await supabase.from("articles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setArticles((p) => p.filter((x) => x.id !== id));
  };

  /* ---------- Stores ---------- */
  const saveStores = async () => {
    const { error } = await supabase.from("app_settings").upsert({ key: "store_links", value: stores }, { onConflict: "key" });
    error ? toast.error(error.message) : toast.success("Liens enregistrés");
  };

  const exportAbonnes = () => {
    const csv = ["email;source;inscrit_le;desabonne_le", ...abonnes.map((a) => `${a.email};${a.source ?? ""};${a.created_at};${a.unsubscribed_at ?? ""}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "newsletter-abonnes.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "faq", label: `FAQ (${faq.length})` },
    { id: "avis", label: `Avis (${avis.length})` },
    { id: "articles", label: `Articles (${articles.length})` },
    { id: "newsletter", label: `Newsletter (${abonnes.length})` },
    { id: "app", label: "Liens app" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contenu du site"
        subtitle="FAQ, avis clients, actualités, newsletter et liens de téléchargement."
        actions={<Button variant="secondary" icon={<RefreshCw size={14} />} onClick={() => void load()}>Actualiser</Button>}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${tab === t.id ? "admin-btn-blue text-white" : "bg-white border border-pro-border text-pro-text-soft hover:bg-pro-bg-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "faq" && (
        <Card>
          <div className="mb-4 flex justify-end">
            <Button icon={<Plus size={14} />} onClick={() => void addFaq()}>Ajouter une question</Button>
          </div>
          {faq.length === 0 && !loading && <EmptyState title="Aucune question" description="Ajoutez votre première question fréquente." />}
          <div className="space-y-4">
            {faq.map((f) => (
              <div key={f.id} className="rounded-xl border border-pro-border p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Badge tone={f.publie ? "success" : "neutral"}>{f.publie ? "Publiée" : "Masquée"}</Badge>
                  <div className="flex items-center gap-1">
                    <IconButton title={f.publie ? "Masquer" : "Publier"} tone="primary" onClick={() => { const n = { ...f, publie: !f.publie }; setFaq((p) => p.map((x) => (x.id === f.id ? n : x))); void saveFaq(n); }}>
                      {f.publie ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconButton>
                    <IconButton title="Enregistrer" tone="success" onClick={() => void saveFaq(f)}><Save size={15} /></IconButton>
                    <IconButton title="Supprimer" tone="danger" onClick={() => void delFaq(f.id)}><Trash2 size={15} /></IconButton>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_100px]">
                  <FormField label="Question">
                    <input className={input} value={f.question} onChange={(e) => setFaq((p) => p.map((x) => (x.id === f.id ? { ...x, question: e.target.value } : x)))} />
                  </FormField>
                  <FormField label="Ordre">
                    <input type="number" className={input} value={f.ordre} onChange={(e) => setFaq((p) => p.map((x) => (x.id === f.id ? { ...x, ordre: Number(e.target.value) } : x)))} />
                  </FormField>
                </div>
                <div className="mt-3">
                  <FormField label="Réponse">
                    <textarea rows={3} className={input} value={f.reponse} onChange={(e) => setFaq((p) => p.map((x) => (x.id === f.id ? { ...x, reponse: e.target.value } : x)))} />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "avis" && (
        <Card>
          <div className="mb-4 flex justify-end">
            <Button icon={<Plus size={14} />} onClick={() => void addAvis()}>Ajouter un avis</Button>
          </div>
          {avis.length === 0 && !loading && <EmptyState title="Aucun avis" description="Les avis publiés apparaissent sur la page d'accueil." />}
          <div className="space-y-4">
            {avis.map((a) => (
              <div key={a.id} className="rounded-xl border border-pro-border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <Select value={a.statut} onChange={(e) => void setAvisStatut(a.id, e.target.value)}>
                    <option value="en_attente">En attente</option>
                    <option value="publie">Publié</option>
                    <option value="rejete">Rejeté</option>
                  </Select>
                  <div className="flex items-center gap-1">
                    <IconButton title="Enregistrer" tone="success" onClick={() => void saveAvis(a)}><Save size={15} /></IconButton>
                    <IconButton title="Supprimer" tone="danger" onClick={() => void delAvis(a.id)}><Trash2 size={15} /></IconButton>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <FormField label="Nom affiché"><input className={input} value={a.nom_affiche} onChange={(e) => setAvis((p) => p.map((x) => (x.id === a.id ? { ...x, nom_affiche: e.target.value } : x)))} /></FormField>
                  <FormField label="Ville"><input className={input} value={a.ville ?? ""} onChange={(e) => setAvis((p) => p.map((x) => (x.id === a.id ? { ...x, ville: e.target.value } : x)))} /></FormField>
                  <FormField label="Type de client"><input className={input} placeholder="Particulier / Concession" value={a.type_client ?? ""} onChange={(e) => setAvis((p) => p.map((x) => (x.id === a.id ? { ...x, type_client: e.target.value } : x)))} /></FormField>
                  <FormField label="Note (1-5)"><input type="number" min={1} max={5} className={input} value={a.note} onChange={(e) => setAvis((p) => p.map((x) => (x.id === a.id ? { ...x, note: Math.min(5, Math.max(1, Number(e.target.value))) } : x)))} /></FormField>
                </div>
                <div className="mt-3">
                  <FormField label="Commentaire">
                    <textarea rows={3} className={input} value={a.commentaire} onChange={(e) => setAvis((p) => p.map((x) => (x.id === a.id ? { ...x, commentaire: e.target.value } : x)))} />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "articles" && (
        <Card>
          <div className="mb-4 flex justify-end">
            <Button icon={<Plus size={14} />} onClick={() => void addArticle()}>Nouvel article</Button>
          </div>
          {articles.length === 0 && !loading && <EmptyState title="Aucun article" description="Publiez votre première actualité." />}
          <div className="space-y-4">
            {articles.map((a) => (
              <div key={a.id} className="rounded-xl border border-pro-border p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <Select value={a.statut} onChange={(e) => setArticles((p) => p.map((x) => (x.id === a.id ? { ...x, statut: e.target.value } : x)))}>
                    <option value="brouillon">Brouillon</option>
                    <option value="publie">Publié</option>
                  </Select>
                  <div className="flex items-center gap-1">
                    <IconButton title="Enregistrer" tone="success" onClick={() => void saveArticle(a)}><Save size={15} /></IconButton>
                    <IconButton title="Supprimer" tone="danger" onClick={() => void delArticle(a.id)}><Trash2 size={15} /></IconButton>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <FormField label="Titre"><input className={input} value={a.titre} onChange={(e) => setArticles((p) => p.map((x) => (x.id === a.id ? { ...x, titre: e.target.value } : x)))} /></FormField>
                  <FormField label="Slug (URL)"><input className={input} value={a.slug} onChange={(e) => setArticles((p) => p.map((x) => (x.id === a.id ? { ...x, slug: slugify(e.target.value) } : x)))} /></FormField>
                  <FormField label="Image (URL https)"><input className={input} value={a.image_url ?? ""} onChange={(e) => setArticles((p) => p.map((x) => (x.id === a.id ? { ...x, image_url: e.target.value } : x)))} /></FormField>
                  <FormField label="Extrait"><input className={input} value={a.extrait ?? ""} onChange={(e) => setArticles((p) => p.map((x) => (x.id === a.id ? { ...x, extrait: e.target.value } : x)))} /></FormField>
                </div>
                <div className="mt-3">
                  <FormField label="Contenu (paragraphes séparés par une ligne vide)">
                    <textarea rows={8} className={input} value={a.contenu} onChange={(e) => setArticles((p) => p.map((x) => (x.id === a.id ? { ...x, contenu: e.target.value } : x)))} />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "newsletter" && (
        <Card>
          <div className="mb-4 flex justify-end">
            <Button variant="secondary" icon={<Download size={14} />} onClick={exportAbonnes} disabled={abonnes.length === 0}>Exporter CSV</Button>
          </div>
          {abonnes.length === 0 ? (
            <EmptyState title="Aucun abonné" description="Les inscriptions du footer apparaîtront ici." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pro-border text-left text-xs uppercase tracking-wide text-pro-muted">
                    <th className="py-2">E-mail</th><th>Source</th><th>Inscrit le</th><th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {abonnes.map((a) => (
                    <tr key={a.id} className="border-b border-pro-border/60">
                      <td className="py-2 text-pro-text">{a.email}</td>
                      <td className="text-pro-text-soft">{a.source ?? "—"}</td>
                      <td className="text-pro-text-soft">{new Date(a.created_at).toLocaleDateString("fr-FR")}</td>
                      <td>{a.unsubscribed_at ? <Badge tone="neutral">Désabonné</Badge> : <Badge tone="success">Actif</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "app" && (
        <Card>
          <p className="mb-4 text-sm text-pro-text-soft">
            Renseignez les liens des stores : les badges s'afficheront automatiquement sur le site public.
            Laissez vide tant que l'application n'est pas publiée.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="App Store (iOS)"><input className={input} placeholder="https://apps.apple.com/..." value={stores.ios} onChange={(e) => setStores((s) => ({ ...s, ios: e.target.value }))} /></FormField>
            <FormField label="Google Play (Android)"><input className={input} placeholder="https://play.google.com/..." value={stores.android} onChange={(e) => setStores((s) => ({ ...s, android: e.target.value }))} /></FormField>
          </div>
          <div className="mt-4">
            <Button icon={<Save size={14} />} onClick={() => void saveStores()}>Enregistrer</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
