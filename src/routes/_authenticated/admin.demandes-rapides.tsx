import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Loader2, ShieldCheck, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import { validerDemandeRapide, refuserDemandeRapide } from "@/lib/contrat-cadre.functions";

export const Route = createFileRoute("/_authenticated/admin/demandes-rapides")({
  head: () => ({ meta: [{ title: "Demandes rapides — Admin Ligneo" }] }),
  component: DemandesRapidesPage,
});

type V = "a_valider" | "validee" | "refusee";
interface Row {
  id: string; numero_dr: string | null; nom: string; prenom: string; email: string;
  depart: string; arrivee: string; date_souhaitee: string | null; heure_souhaitee: string | null;
  prix_estime: number | null; immatriculation: string | null; vehicule_immatriculation: string | null;
  validation_cadre: V | null; validation_cadre_at: string | null; motif_refus_cadre: string | null;
  preuve_contrat: Record<string, any> | null; created_at: string; message: string | null;
}
const LABEL: Record<V, string> = { a_valider: "À valider", validee: "Validée", refusee: "Refusée" };
const eur = (n: number | null) => (n ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

function DemandesRapidesPage() {
  const valider = useServerFn(validerDemandeRapide);
  const refuser = useServerFn(refuserDemandeRapide);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<V | "all">("a_valider");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [refus, setRefus] = useState<Row | null>(null);
  const [motif, setMotif] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("demandes_convoyage" as never).select("*")
      .eq("sans_devis" as never, true as never).order("created_at" as never, { ascending: false }).limit(300);
    if (error) toast.error("Demandes indisponibles", { description: error.message });
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const n = (v: V) => rows.filter((r) => r.validation_cadre === v).length;
  const visible = useMemo(() => rows.filter((r) => filtre === "all" || r.validation_cadre === filtre), [rows, filtre]);

  const ok = async (r: Row) => {
    setBusy(r.id);
    try { await valider({ data: { demandeId: r.id } }); toast.success(`${r.numero_dr} validée, missions créées`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Validation impossible"); }
    setBusy(null); void load();
  };
  const ko = async () => {
    if (!refus) return;
    if (!motif.trim()) return toast.error("Indiquez un motif");
    setBusy(refus.id);
    try { await refuser({ data: { demandeId: refus.id, motif: motif.trim() } }); toast.success("Demande refusée, client prévenu"); setRefus(null); setMotif(""); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Refus impossible"); }
    setBusy(null); void load();
  };

  return (
    <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
      <AdminSectionHeader
        breadcrumb="Demandes rapides" eyebrow="Clients & convoyeurs" title="Demandes " highlight="rapides"
        stats={[{ label: "À valider", value: n("a_valider"), tone: "accent" }, { label: "Validées", value: n("validee") }, { label: "Refusées", value: n("refusee") }]}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        {([["a_valider", "À valider"], ["validee", "Validées"], ["refusee", "Refusées"], ["all", "Toutes"]] as [string, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFiltre(k as V | "all")}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filtre === k ? "border-[#2F5FFF] bg-[#2F5FFF] text-white" : "border-slate-200 bg-white text-slate-700"}`}>{l}</button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {loading ? <div className="p-8 text-center"><Loader2 className="mx-auto animate-spin" size={18} /></div>
          : visible.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Aucune demande rapide ici.</div>
          : visible.map((r) => {
            const p = r.preuve_contrat;
            return (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e8efff] text-[#2F5FFF]"><Zap size={16} /></span>
                  <div className="min-w-0 flex-1">
                    <b className="text-sm">{r.numero_dr ?? "DR"} · {r.depart} → {r.arrivee}</b>
                    <div className="text-xs text-slate-500">
                      {r.prenom} {r.nom} · {r.date_souhaitee ?? "—"} {r.heure_souhaitee ?? ""} · {r.vehicule_immatriculation ?? r.immatriculation ?? "plaque ?"}
                    </div>
                  </div>
                  <b className="text-base">{eur(r.prix_estime)}</b>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.validation_cadre === "validee" ? "bg-emerald-100 text-emerald-700" : r.validation_cadre === "refusee" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                    {r.validation_cadre ? LABEL[r.validation_cadre] : "—"}
                  </span>
                </div>
                {r.validation_cadre === "refusee" && r.motif_refus_cadre && <p className="mt-2 text-xs font-semibold text-red-600">{r.motif_refus_cadre}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2F5FFF]">
                    <ShieldCheck size={14} /> Preuve <ChevronDown size={13} className={open === r.id ? "rotate-180" : ""} />
                  </button>
                  <span className="flex-1" />
                  {r.validation_cadre === "a_valider" && (<>
                    <button type="button" disabled={busy === r.id} onClick={() => { setRefus(r); setMotif(""); }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"><X size={14} />Refuser</button>
                    <button type="button" disabled={busy === r.id} onClick={() => ok(r)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#2F5FFF] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                      {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}Valider en 1 clic</button>
                  </>)}
                </div>

                {open === r.id && (
                  <dl className="mt-3 grid gap-x-6 gap-y-1 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-2">
                    {p ? ([
                      ["N° de preuve", p.numero_dr], ["Compte client", p.email], ["Identifiant compte", p.compte_user_id],
                      ["Adresse IP", p.ip ?? "—"], ["Envoyée le", p.envoye_le ? new Date(p.envoye_le).toLocaleString("fr-FR") : "—"],
                      ["Contrat signé le", p.contrat_signe_le ?? "—"], ["Remise contrat", `${p.remise_pct} %`],
                      ["Plafond", p.plafond_ttc ? eur(p.plafond_ttc) : "aucun"], ["Tarif appliqué (TTC)", eur(p.tarif_applique_ttc)],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k}><dt className="text-slate-500">{k}</dt><dd className="break-all font-semibold">{v}</dd></div>
                    )) : <div className="text-slate-500">Preuve non enregistrée.</div>}
                  </dl>
                )}
              </div>
            );
          })}
      </div>

      {refus && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4" onClick={() => setRefus(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-[17px] font-bold text-slate-900">Refuser {refus.numero_dr}</h4>
            <p className="mt-1 text-[13px] text-slate-600">Le client est prévenu avec ce motif.</p>
            <textarea value={motif} onChange={(e) => setMotif(e.target.value)} rows={3} placeholder="Ex. date indisponible, merci de demander un devis"
              className="mt-3 w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900" />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold" onClick={() => setRefus(null)}>Annuler</button>
              <button type="button" disabled={busy === refus.id} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white" onClick={ko}>Refuser</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
