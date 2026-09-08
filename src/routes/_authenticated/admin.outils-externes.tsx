/**
 * Admin · Outils externes client (états des lieux réalisés dans l'outil du donneur d'ordre).
 * Permet d'ajouter un client avec son outil, son logo et ses liens, sans intervention développeur.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Plus, Trash2, Upload, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BUCKET_OUTILS_LOGOS,
  DEFAULT_OUTIL_LOGO,
  resolveLogoUrl,
  sanitizeLogoName,
  type OutilExterneType,
} from "@/lib/outils-externes";

export const Route = createFileRoute("/_authenticated/admin/outils-externes")({
  component: OutilsExternesPage,
  head: () => ({
    meta: [
      { title: "Outils externes client · Transports Ligneo" },
      { name: "description", content: "Gestion des outils d'état des lieux imposés par les donneurs d'ordre." },
      { property: "og:title", content: "Outils externes client · Transports Ligneo" },
      { property: "og:description", content: "Associer un client à son outil d'état des lieux externe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

interface Row {
  id: string;
  nom: string;
  logo_url: string | null;
  type: OutilExterneType;
  url_web: string | null;
  deeplink: string | null;
  android_package: string | null;
  play_store_url: string | null;
  app_store_url: string | null;
  organization_id: string | null;
  user_id: string | null;
  client_nom: string | null;
  instructions: string | null;
  actif: boolean;
}

const EMPTY: Omit<Row, "id"> = {
  nom: "",
  logo_url: null,
  type: "web",
  url_web: "",
  deeplink: "",
  android_package: "",
  play_store_url: "",
  app_store_url: "",
  organization_id: null,
  user_id: null,
  client_nom: "",
  instructions: "",
  actif: true,
};

function OutilsExternesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Omit<Row, "id"> & { id?: string }>({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>(DEFAULT_OUTIL_LOGO);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("outils_externes_client" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Chargement impossible", { description: error.message });
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void resolveLogoUrl(form.logo_url).then(setLogoPreview); }, [form.logo_url]);

  const uploadLogo = async (file: File) => {
    const path = `${crypto.randomUUID()}-${sanitizeLogoName(file.name)}`;
    const { error } = await supabase.storage.from(BUCKET_OUTILS_LOGOS).upload(path, file, { upsert: false });
    if (error) { toast.error("Envoi du logo impossible", { description: error.message }); return; }
    setForm(f => ({ ...f, logo_url: path }));
    toast.success("Logo enregistré");
  };

  const save = async () => {
    if (!form.nom.trim()) { toast.error("Nom de l'outil obligatoire"); return; }
    setSaving(true);
    const payload = {
      nom: form.nom.trim(),
      logo_url: form.logo_url,
      type: form.type,
      url_web: form.url_web?.trim() || null,
      deeplink: form.deeplink?.trim() || null,
      android_package: form.android_package?.trim() || null,
      play_store_url: form.play_store_url?.trim() || null,
      app_store_url: form.app_store_url?.trim() || null,
      client_nom: form.client_nom?.trim() || null,
      instructions: form.instructions?.trim() || null,
      actif: form.actif,
    };
    const q = form.id
      ? supabase.from("outils_externes_client" as never).update(payload as never).eq("id", form.id)
      : supabase.from("outils_externes_client" as never).insert(payload as never);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error("Enregistrement impossible", { description: error.message }); return; }
    toast.success(form.id ? "Outil mis à jour" : "Outil ajouté");
    setForm({ ...EMPTY });
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("outils_externes_client" as never).delete().eq("id", id);
    if (error) { toast.error("Suppression impossible", { description: error.message }); return; }
    toast.success("Outil supprimé");
    void load();
  };

  const field = "w-full rounded-lg border border-pro-border bg-pro-surface px-3 py-2 text-sm text-pro-text";
  const label = "block text-[11px] uppercase tracking-wider text-pro-muted mb-1";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <header className="flex items-center gap-3">
        <Wrench className="text-pro-accent" size={20} />
        <div>
          <h1 className="text-lg font-bold text-pro-text">Outils externes client</h1>
          <p className="text-[12px] text-pro-muted">
            Associez un donneur d'ordre à son outil d'état des lieux. Le convoyeur n'a rien à choisir : la détection est automatique.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-pro-border bg-pro-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-pro-text">{form.id ? "Modifier l'outil" : "Nouvel outil"}</h2>

        <div className="flex items-center gap-4">
          <img src={logoPreview} alt="Logo de l'outil" className="h-16 w-16 rounded-xl object-contain bg-white border border-pro-border" />
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-pro-border px-3 py-2 text-xs font-semibold text-pro-text"
            >
              <Upload size={14} /> Téléverser un logo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }}
            />
            <p className="mt-1 text-[11px] text-pro-muted">PNG/JPG, 5 Mo max. Vérifiez l'accord du partenaire avant usage en production.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className={label}>Nom de l'outil</span>
            <input className={field} value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Welcome Auto" />
          </div>
          <div>
            <span className={label}>Type</span>
            <select className={field} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as OutilExterneType })}>
              <option value="web">Site web</option>
              <option value="app">Application mobile</option>
            </select>
          </div>
          <div>
            <span className={label}>Nom du client (rattachement)</span>
            <input className={field} value={form.client_nom ?? ""} onChange={e => setForm({ ...form, client_nom: e.target.value })} placeholder="ALD Automotive / Ayvens" />
          </div>
          <div>
            <span className={label}>URL du site</span>
            <input className={field} value={form.url_web ?? ""} onChange={e => setForm({ ...form, url_web: e.target.value })} placeholder="https://..." />
          </div>
          {form.type === "app" && (
            <>
              <div>
                <span className={label}>Deep link</span>
                <input className={field} value={form.deeplink ?? ""} onChange={e => setForm({ ...form, deeplink: e.target.value })} placeholder="monapp://edl" />
              </div>
              <div>
                <span className={label}>Package Android</span>
                <input className={field} value={form.android_package ?? ""} onChange={e => setForm({ ...form, android_package: e.target.value })} placeholder="com.exemple.app" />
              </div>
              <div>
                <span className={label}>Lien Google Play</span>
                <input className={field} value={form.play_store_url ?? ""} onChange={e => setForm({ ...form, play_store_url: e.target.value })} />
              </div>
              <div>
                <span className={label}>Lien App Store</span>
                <input className={field} value={form.app_store_url ?? ""} onChange={e => setForm({ ...form, app_store_url: e.target.value })} />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <span className={label}>Consigne affichée au convoyeur (optionnel)</span>
            <input className={field} value={form.instructions ?? ""} onChange={e => setForm({ ...form, instructions: e.target.value })} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-pro-text">
            <input type="checkbox" checked={form.actif} onChange={e => setForm({ ...form, actif: e.target.checked })} className="h-4 w-4 accent-pro-accent" />
            Actif
          </label>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-pro-accent px-4 py-2 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
            {form.id ? "Enregistrer" : "Ajouter"}
          </button>
          {form.id && (
            <button onClick={() => setForm({ ...EMPTY })} className="rounded-lg border border-pro-border px-3 py-2 text-xs text-pro-text">
              Annuler
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-pro-border bg-pro-card divide-y divide-pro-border">
        {loading ? (
          <div className="p-6 flex items-center gap-2 text-sm text-pro-muted"><Loader2 className="animate-spin" size={16} /> Chargement…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-pro-muted">Aucun outil externe configuré.</div>
        ) : rows.map(r => (
          <div key={r.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-pro-text truncate">
                {r.nom} <span className="text-[11px] font-normal text-pro-muted">· {r.type === "app" ? "Application" : "Site web"}</span>
              </p>
              <p className="text-[11px] text-pro-muted truncate">
                {[r.client_nom, r.url_web ?? r.deeplink, r.actif ? "Actif" : "Inactif"].filter(Boolean).join(" · ")}
              </p>
            </div>
            <button onClick={() => setForm({ ...r })} className="rounded-lg border border-pro-border px-3 py-1.5 text-xs text-pro-text">Modifier</button>
            <button onClick={() => void remove(r.id)} className="rounded-lg border border-red-200 px-2 py-1.5 text-red-600" aria-label={`Supprimer ${r.nom}`}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
