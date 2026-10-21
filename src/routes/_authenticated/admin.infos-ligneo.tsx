/**
 * Admin · Infos Ligneo : messages courts publiés à tous les convoyeurs
 * (bulles de l'accueil + plein écran avec Vroomy).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Save, Trash2, Eye, EyeOff } from "lucide-react";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/admin/infos-ligneo")({
  component: AdminInfosLigneo,
});

// Table créée par la migration 20261022000000 (types Supabase pas encore régénérés).
const db = supabase as unknown as { from: (t: string) => any };

type Kind = "urgent" | "maintenance" | "changement" | "nouveau";
interface Row {
  id: string;
  kind: Kind;
  titre: string;
  corps: string;
  publie: boolean;
  publie_le: string | null;
}

const KINDS: Array<{ k: Kind; label: string; hint: string }> = [
  { k: "urgent", label: "Urgent", hint: "Rouge · à lire avant la prochaine mission" },
  { k: "maintenance", label: "Maintenance", hint: "Bleu · coupure ou entretien de l'appli" },
  { k: "changement", label: "Changement", hint: "Violet · une règle ou une consigne change" },
  { k: "nouveau", label: "Nouveauté", hint: "Vert · une nouvelle fonction" },
];

function AdminInfosLigneo() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<{ kind: Kind; titre: string; corps: string }>({ kind: "nouveau", titre: "", corps: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await db.from("infos_ligneo").select("id, kind, titre, corps, publie, publie_le").order("created_at", { ascending: false });
    if (error) toast.error("Chargement impossible");
    setRows((data as Row[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(publie: boolean) {
    if (!draft.titre.trim()) { toast.error("Donnez un titre"); return; }
    setSaving(true);
    const { error } = await db.from("infos_ligneo").insert({ ...draft, titre: draft.titre.trim(), publie, created_by: user?.id ?? null });
    setSaving(false);
    if (error) { toast.error("Enregistrement impossible"); return; }
    toast.success(publie ? "Info publiée aux convoyeurs" : "Brouillon enregistré");
    setDraft({ kind: "nouveau", titre: "", corps: "" });
    void load();
  }

  async function togglePublie(r: Row) {
    const { error } = await db.from("infos_ligneo").update({ publie: !r.publie, publie_le: !r.publie ? new Date().toISOString() : r.publie_le }).eq("id", r.id);
    if (error) toast.error("Mise à jour impossible"); else void load();
  }

  async function remove(r: Row) {
    if (!window.confirm(`Supprimer « ${r.titre} » ?`)) return;
    const { error } = await db.from("infos_ligneo").delete().eq("id", r.id);
    if (error) toast.error("Suppression impossible"); else void load();
  }

  const input = "w-full rounded-lg border border-pro-border bg-white px-3 py-2.5 text-sm text-pro-text focus:outline-none focus:ring-1 focus:ring-emerald-400/40";

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        breadcrumb="Infos Ligneo"
        eyebrow="Communication convoyeurs"
        title="Infos"
        highlight="Ligneo"
        subtitle="Publiez une consigne, une maintenance ou une nouveauté : elle apparaît en bulle sur l'accueil de chaque convoyeur."
      />

      <section className="rounded-2xl border border-pro-border bg-white p-5 space-y-4">
        <h3 className="font-semibold text-pro-text">Nouvelle info</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {KINDS.map((x) => (
            <button
              key={x.k}
              type="button"
              onClick={() => setDraft({ ...draft, kind: x.k })}
              className={`rounded-xl border p-3 text-left text-sm transition ${draft.kind === x.k ? "border-emerald-500 bg-emerald-50 font-semibold" : "border-pro-border"}`}
            >
              {x.label}
              <span className="block text-[11px] font-normal text-pro-muted mt-0.5">{x.hint}</span>
            </button>
          ))}
        </div>
        <input className={input} placeholder="Titre court (ex : Rappel carburant)" value={draft.titre} onChange={(e) => setDraft({ ...draft, titre: e.target.value })} />
        <textarea className={input} rows={6} placeholder="Texte complet. Une ligne vide sépare les paragraphes." value={draft.corps} onChange={(e) => setDraft({ ...draft, corps: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <button disabled={saving} onClick={() => void create(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Publier maintenant
          </button>
          <button disabled={saving} onClick={() => void create(false)} className="inline-flex items-center gap-2 rounded-xl border border-pro-border px-4 py-2.5 text-sm font-semibold text-pro-text disabled:opacity-50">
            <Save size={16} /> Enregistrer en brouillon
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-pro-text">Toutes les infos</h3>
        {loading && <Loader2 className="animate-spin" />}
        {!loading && rows.length === 0 && <p className="text-sm text-pro-muted">Aucune info pour le moment.</p>}
        {rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-pro-border bg-white p-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">{KINDS.find((x) => x.k === r.kind)?.label}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.publie ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{r.publie ? "Publiée" : "Brouillon"}</span>
                {r.publie_le && <span className="text-[11px] text-pro-muted">{new Date(r.publie_le).toLocaleDateString("fr-FR")}</span>}
              </div>
              <p className="mt-1 font-semibold text-pro-text">{r.titre}</p>
              <p className="mt-1 text-sm text-pro-text-soft whitespace-pre-line line-clamp-3">{r.corps}</p>
            </div>
            <button onClick={() => void togglePublie(r)} title={r.publie ? "Dépublier" : "Publier"} className="rounded-lg border border-pro-border p-2">
              {r.publie ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <button onClick={() => void remove(r)} title="Supprimer" className="rounded-lg border border-pro-border p-2 text-red-600"><Trash2 size={16} /></button>
          </div>
        ))}
      </section>
    </div>
  );
}
