/**
 * Admin · Mises à jour Driver : publie une mise à jour OBLIGATOIRE de l'appli Ligneo Driver.
 * Les convoyeurs dont l'appli est plus ancienne sont bloqués par une fenêtre jusqu'à la mise à jour.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Power, Trash2, ShieldAlert } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { supabase } from "@/integrations/supabase/client";
import { DriverUpdateCard } from "@/components/convoyeur/DriverUpdateGate";

export const Route = createFileRoute("/_authenticated/admin/mises-a-jour-driver")({
  component: AdminMisesAJourDriver,
});

// Table et fonction créées par la migration 20261026000300 (types Supabase pas encore régénérés).
const db = supabase as unknown as { from: (t: string) => any; rpc: (f: string, a: object) => Promise<{ error: unknown }> };

const PLAY = "https://play.google.com/store/apps/details?id=com.transportsligneo.driver";
interface Row { id: string; version: string; titre: string; message: string; store_url: string; active: boolean; created_at: string }

function AdminMisesAJourDriver() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ version: "", titre: "Nouvelle version disponible", message: "Une nouvelle version de l'application Ligneo Driver est disponible. Mettez-la à jour pour continuer.", store_url: PLAY });

  const load = useCallback(async () => {
    const { data, error } = await db.from("driver_app_updates").select("id, version, titre, message, store_url, active, created_at").order("created_at", { ascending: false }).limit(30);
    if (error) toast.error("Chargement impossible");
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const valid = /^[0-9]+(\.[0-9]+){0,2}$/.test(f.version.trim());
  const active = rows.find((r) => r.active);

  async function publish() {
    if (!valid) { toast.error("Numéro de version invalide (ex : 2.4.0)"); return; }
    if (!window.confirm(`Publier la mise à jour ${f.version.trim()} ? Tous les convoyeurs avec une version plus ancienne seront bloqués jusqu'à la mise à jour.`)) return;
    setSaving(true);
    const { error } = await db.rpc("publish_driver_app_update", { p_version: f.version.trim(), p_titre: f.titre.trim(), p_message: f.message.trim(), p_store_url: f.store_url.trim() });
    setSaving(false);
    if (error) { toast.error("Publication impossible"); return; }
    toast.success("Mise à jour publiée aux convoyeurs");
    void load();
  }
  async function toggle(r: Row) {
    if (!r.active) await db.from("driver_app_updates").update({ active: false }).eq("active", true);
    const { error } = await db.from("driver_app_updates").update({ active: !r.active }).eq("id", r.id);
    if (error) toast.error("Mise à jour impossible"); else void load();
  }
  async function remove(r: Row) {
    if (!window.confirm(`Supprimer la mise à jour ${r.version} ?`)) return;
    const { error } = await db.from("driver_app_updates").delete().eq("id", r.id);
    if (error) toast.error("Suppression impossible"); else void load();
  }

  const input = "w-full rounded-lg border border-pro-border bg-white px-3 py-2.5 text-sm text-pro-text focus:outline-none focus:ring-1 focus:ring-emerald-400/40";
  const lab = "block text-[11px] font-bold uppercase tracking-wide text-pro-muted mb-1.5 mt-3";

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        breadcrumb="Mises à jour Driver"
        eyebrow="Communication convoyeurs"
        title="Mises à jour"
        highlight="Driver"
        subtitle="Publiez une mise à jour obligatoire : tant que le convoyeur n'a pas mis à jour son appli, une fenêtre l'empêche de continuer. Fonctionne sur téléphone et sur PC."
        stats={[{ label: "Mise à jour active", value: active ? `v${active.version}` : "Aucune", tone: active ? "accent" : "default" }]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-pro-border bg-white p-5">
          <h3 className="font-semibold text-pro-text flex items-center gap-2"><ShieldAlert size={18} className="text-emerald-600" /> Nouvelle mise à jour obligatoire</h3>
          <label className={lab} htmlFor="mj-v">Numéro de version</label>
          <input id="mj-v" className={input} placeholder="Ex : 2.4.0" inputMode="decimal" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} />
          <p className="mt-1 text-[11.5px] text-pro-muted">Le même numéro que la version publiée sur Google Play. Les appareils avec un numéro plus petit sont bloqués.</p>
          <label className={lab} htmlFor="mj-t">Titre</label>
          <input id="mj-t" className={input} value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} />
          <label className={lab} htmlFor="mj-m">Message</label>
          <textarea id="mj-m" className={input} rows={4} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
          <label className={lab} htmlFor="mj-u">Lien Google Play</label>
          <input id="mj-u" className={input} value={f.store_url} onChange={(e) => setF({ ...f, store_url: e.target.value })} />
          <button disabled={saving || !valid} onClick={() => void publish()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Envoyer aux convoyeurs
          </button>
        </section>

        <section className="rounded-2xl border border-pro-border bg-slate-100 p-3">
          <p className="px-2 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wide text-pro-muted">Ce que verra le convoyeur</p>
          <DriverUpdateCard preview native update={{ version: f.version.trim(), titre: f.titre, message: f.message, store_url: f.store_url }} />
        </section>
      </div>

      <section className="space-y-3">
        <h3 className="font-semibold text-pro-text">Historique</h3>
        {loading && <Loader2 className="animate-spin" />}
        {!loading && rows.length === 0 && <p className="text-sm text-pro-muted">Aucune mise à jour publiée.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-pro-border bg-white p-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold">v{r.version}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{r.active ? "Active · obligatoire" : "Désactivée"}</span>
                <span className="text-[11px] text-pro-muted">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
              </div>
              <p className="mt-1 font-semibold text-pro-text">{r.titre}</p>
              <p className="mt-1 text-sm text-pro-text-soft whitespace-pre-line line-clamp-2">{r.message}</p>
            </div>
            <button onClick={() => void toggle(r)} title={r.active ? "Désactiver" : "Réactiver"} className="rounded-lg border border-pro-border p-2"><Power size={16} /></button>
            <button onClick={() => void remove(r)} title="Supprimer" className="rounded-lg border border-pro-border p-2 text-red-600"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>
    </div>
  );
}
