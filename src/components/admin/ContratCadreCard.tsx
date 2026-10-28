/** Contrat-cadre d'un client : demandes rapides sans devis, remise, plafond, PDF signé. */
import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, Save, Upload, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminSection } from "@/components/admin/ui";
import type { ContratCadre } from "@/lib/contrat-cadre";

const REMISES = [0, 10, 13, 15];

export function ContratCadreCard({ clientUserId }: { clientUserId: string }) {
  const [c, setC] = useState<ContratCadre | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    actif: true, demandes_sans_devis: false, validation_auto: false,
    signe_le: "", valable_jusqua: "", remise_pct: "10", plafond_ttc: "", notes: "",
  });

  const load = useCallback(async () => {
    const { data } = await supabase.from("contrats_cadres" as never).select("*").eq("user_id" as never, clientUserId as never).maybeSingle();
    const row = data as unknown as ContratCadre | null;
    setC(row);
    if (row) {
      setF({
        actif: row.actif, demandes_sans_devis: row.demandes_sans_devis, validation_auto: row.validation_auto,
        signe_le: row.signe_le ?? "", valable_jusqua: row.valable_jusqua ?? "",
        remise_pct: String(row.remise_pct ?? 0), plafond_ttc: row.plafond_ttc ? String(row.plafond_ttc) : "", notes: row.notes ?? "",
      });
    }
    setLoading(false);
  }, [clientUserId]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    const remise = Number(String(f.remise_pct).replace(",", "."));
    if (!(remise >= 0 && remise <= 40)) return toast.error("Remise entre 0 et 40 %");
    const plafond = f.plafond_ttc.trim() ? Number(f.plafond_ttc.replace(",", ".")) : null;
    if (plafond !== null && !(plafond > 0)) return toast.error("Plafond invalide");
    if (f.demandes_sans_devis && !f.signe_le) return toast.error("Indiquez la date de signature du contrat");
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const row = {
      user_id: clientUserId, actif: f.actif, demandes_sans_devis: f.demandes_sans_devis,
      validation_auto: f.demandes_sans_devis && f.validation_auto,
      signe_le: f.signe_le || null, valable_jusqua: f.valable_jusqua || null,
      remise_pct: remise, plafond_ttc: plafond, notes: f.notes.trim() || null, created_by: auth.user?.id ?? null,
    };
    const { error } = await supabase.from("contrats_cadres" as never).upsert(row as never, { onConflict: "user_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Contrat-cadre enregistré");
    void load();
  };

  const upload = async (file: File) => {
    if (!c) return toast.error("Enregistrez d'abord le contrat");
    const path = `${clientUserId}/contrat-${Date.now()}.pdf`;
    const { error } = await supabase.storage.from("contrats-cadres").upload(path, file, { contentType: "application/pdf" });
    if (error) return toast.error(error.message);
    await supabase.from("contrats_cadres" as never).update({ pdf_path: path } as never).eq("id" as never, c.id as never);
    toast.success("PDF signé ajouté");
    void load();
  };

  const openPdf = async () => {
    if (!c?.pdf_path) return;
    const { data } = await supabase.storage.from("contrats-cadres").createSignedUrl(c.pdf_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const T = ({ k, label, hint, disabled }: { k: "actif" | "demandes_sans_devis" | "validation_auto"; label: string; hint?: string; disabled?: boolean }) => (
    <label className={`flex items-start gap-3 py-2 ${disabled ? "opacity-45" : ""}`}>
      <input type="checkbox" className="mt-1 h-4 w-4" disabled={disabled} checked={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.checked })} />
      <span><b className="text-sm">{label}</b>{hint && <small className="block text-xs text-slate-500">{hint}</small>}</span>
    </label>
  );

  return (
    <AdminSection
      title={<span className="inline-flex items-center gap-2"><Zap size={16} /> Contrat-cadre</span>}
      description="Autorise ce client à commander sans devis, au tarif convenu."
      actions={<button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#2F5FFF] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Enregistrer</button>}
    >
      {loading ? <Loader2 className="animate-spin" size={18} /> : (
        <div className="space-y-3">
          <T k="actif" label="Contrat actif" />
          <T k="demandes_sans_devis" label="Demandes rapides sans devis" hint="Le client voit un bouton « Demande rapide » dans son formulaire." />
          <T k="validation_auto" label="Validation automatique" hint="Désactivée par défaut : vous validez chaque demande en 1 clic." disabled={!f.demandes_sans_devis} />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-500">Signé le
              <input type="date" value={f.signe_le} onChange={(e) => setF({ ...f, signe_le: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
            </label>
            <label className="text-xs text-slate-500">Valable jusqu'au (facultatif)
              <input type="date" value={f.valable_jusqua} onChange={(e) => setF({ ...f, valable_jusqua: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
            </label>
            <div className="text-xs text-slate-500">Remise sur le tarif public
              <div className="mt-1 flex flex-wrap gap-1.5">
                {REMISES.map((r) => (
                  <button key={r} type="button" onClick={() => setF({ ...f, remise_pct: String(r) })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${Number(f.remise_pct) === r ? "border-[#2F5FFF] bg-[#2F5FFF] text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                    {r === 0 ? "Aucune" : `${r} %`}
                  </button>
                ))}
                <input value={f.remise_pct} onChange={(e) => setF({ ...f, remise_pct: e.target.value })} inputMode="decimal"
                  className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-900" aria-label="Autre remise en %" />
              </div>
            </div>
            <label className="text-xs text-slate-500">Plafond par demande (€ TTC, facultatif)
              <input value={f.plafond_ttc} onChange={(e) => setF({ ...f, plafond_ttc: e.target.value })} inputMode="decimal" placeholder="Ex. 600"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
            </label>
          </div>

          <label className="block text-xs text-slate-500">Notes internes
            <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
          </label>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
              <Upload size={14} /> {c?.pdf_path ? "Remplacer le PDF signé" : "Ajouter le PDF signé"}
              <input type="file" accept="application/pdf" hidden onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ""; if (x) void upload(x); }} />
            </label>
            {c?.pdf_path && (
              <button type="button" onClick={openPdf} className="inline-flex items-center gap-2 text-xs font-semibold text-[#2F5FFF]"><FileText size={14} />Ouvrir le contrat</button>
            )}
          </div>
        </div>
      )}
    </AdminSection>
  );
}
