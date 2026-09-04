import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { confirmToast } from "@/lib/confirm-toast";
import {
  Loader2, Plus, Paperclip, Trash2, Download, Euro, Gauge, CalendarClock, TrendingUp, FileDown,
} from "lucide-react";
import {
  COST_CATEGORIES, type CostCategory, addVehicleCost, archiveVehicleCost, getCostReceiptUrl,
  getVehicleCostDetail, saveFinanceContract, saveServiceEvent, type VehicleTco,
} from "@/lib/fleet-tco.functions";
import { costsToCsv, downloadCsv } from "@/lib/fleet-tco-export";

const fmtEur = (n: number) =>
  Number(n || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const catLabel = (id: string) => COST_CATEGORIES.find((c) => c.id === id)?.label ?? id;

type CostRow = {
  id: string; categorie: string; montant: number; date_cout: string; libelle: string | null;
  source: string; statut: string; justificatif_path: string | null; kilometrage: number | null;
};

const CONTRACT_TYPES = [
  { id: "achat", label: "Achat comptant" },
  { id: "credit", label: "Crédit" },
  { id: "lld", label: "LLD" },
  { id: "loa", label: "LOA" },
];

const EVENT_TYPES = [
  { id: "revision", label: "Révision" },
  { id: "controle_technique", label: "Contrôle technique" },
  { id: "pneumatiques", label: "Pneumatiques" },
  { id: "autre", label: "Autre" },
];

export default function VehicleCostsTab({
  vehicleId,
  organizationId,
  vehicleLabel,
  canManage,
}: {
  vehicleId: string;
  organizationId: string;
  vehicleLabel: string;
  canManage: boolean;
}) {
  const detailFn = useServerFn(getVehicleCostDetail);
  const addFn = useServerFn(addVehicleCost);
  const archiveFn = useServerFn(archiveVehicleCost);
  const receiptFn = useServerFn(getCostReceiptUrl);
  const contractFn = useServerFn(saveFinanceContract);
  const eventFn = useServerFn(saveServiceEvent);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tco, setTco] = useState<VehicleTco | null>(null);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [serie, setSerie] = useState<{ date: string; cumul: number }[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [period, setPeriod] = useState<"12m" | "ytd" | "all">("12m");
  const [form, setForm] = useState<null | {
    categorie: CostCategory; montant: string; date_cout: string; libelle: string; kilometrage: string; notes: string;
  }>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [contractForm, setContractForm] = useState<any | null>(null);
  const [eventForm, setEventForm] = useState<any | null>(null);

  const range = useMemo(() => {
    const now = new Date();
    if (period === "all") return { from: null as string | null, to: null as string | null };
    if (period === "ytd") return { from: `${now.getFullYear()}-01-01`, to: null };
    const d = new Date(now);
    d.setMonth(d.getMonth() - 12);
    return { from: d.toISOString().slice(0, 10), to: null };
  }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await detailFn({ data: { vehicleId, from: range.from, to: range.to } });
      setTco(res.tco);
      setCosts(res.costs as CostRow[]);
      setSerie(res.serie);
      setContracts(res.contracts);
      setEvents(res.events);
    } catch (e) {
      toast.error((e as Error).message || "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [detailFn, vehicleId, range.from, range.to]);

  useEffect(() => { void load(); }, [load]);

  const submitCost = async () => {
    if (!form) return;
    const montant = Number(form.montant.replace(",", "."));
    if (!(montant > 0)) { toast.error("Montant invalide"); return; }
    if (!file) { toast.error("Un justificatif est obligatoire"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 15 Mo)"); return; }

    setBusy(true);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${organizationId}/${vehicleId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("vehicle-costs")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { setBusy(false); toast.error(upErr.message); return; }

    try {
      await addFn({
        data: {
          vehicleId,
          categorie: form.categorie,
          montant,
          dateCout: form.date_cout,
          libelle: form.libelle || null,
          notes: form.notes || null,
          kilometrage: form.kilometrage ? Number(form.kilometrage) : null,
          justificatifPath: path,
        },
      });
      toast.success("Coût enregistré");
      setForm(null); setFile(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  };

  const openReceipt = async (path: string) => {
    try {
      const { url } = await receiptFn({ data: { path } });
      window.open(url, "_blank", "noopener");
    } catch (e) { toast.error((e as Error).message); }
  };

  const archive = async (c: CostRow) => {
    if (!(await confirmToast(`Archiver « ${c.libelle || catLabel(c.categorie)} » ?`))) return;
    try {
      await archiveFn({ data: { costId: c.id } });
      await load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const cats = tco?.par_categorie ?? {};
  const catRows = Object.entries(cats)
    .filter(([, v]) => Number(v) !== 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const maxCat = Math.max(1, ...catRows.map(([, v]) => Number(v)));

  if (loading) return <Loader2 className="animate-spin text-[#2f5fff]" size={20} />;

  return (
    <div>
      {/* Période */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {([["12m", "12 mois"], ["ytd", "Année en cours"], ["all", "Depuis l'origine"]] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPeriod(id)}
              className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition ${
                period === id
                  ? "border-[#14161c] bg-[#14161c] text-white"
                  : "border-[#eaeaee] bg-white text-[#70727d] hover:bg-[#f2f2f5]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => downloadCsv(`couts-${vehicleLabel}.csv`, costsToCsv(costs))}
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] px-3 py-1.5 text-[12px] font-semibold text-[#14161c] transition hover:bg-[#f2f2f5]"
        >
          <FileDown size={13} /> Export CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5">
        <Kpi icon={<Euro size={13} />} label="TCO sur la période" value={fmtEur(tco?.total ?? 0)} strong />
        <Kpi icon={<Gauge size={13} />} label="Coût au kilomètre"
          value={tco?.tco_km ? `${Number(tco.tco_km).toFixed(3).replace(".", ",")} €` : "—"} />
        <Kpi icon={<CalendarClock size={13} />} label="Coût mensuel moyen" value={fmtEur(tco?.tco_mensuel ?? 0)} />
        <Kpi icon={<TrendingUp size={13} />} label="Valeur de revente déduite" value={fmtEur(tco?.revente ?? 0)} />
      </div>

      {/* Répartition */}
      <p className="mt-7 mb-2.5 text-[11px] font-medium text-[#a3a4ac]">Répartition par poste</p>
      {catRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#eaeaee] py-6 text-center text-[12.5px] text-[#70727d]">
          Aucun coût enregistré sur cette période.
        </p>
      ) : (
        catRows.map(([id, v]) => (
          <div key={id} className="mb-2.5">
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="font-semibold text-[#14161c]">{catLabel(id)}</span>
              <span className="text-[#70727d]">{fmtEur(Number(v))}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-[#eaeaee]">
              <div className="h-full rounded bg-[#2f5fff] transition-[width] duration-700"
                style={{ width: `${(Number(v) / maxCat) * 100}%` }} />
            </div>
          </div>
        ))
      )}

      {/* Courbe cumulée */}
      {serie.length > 1 && <Sparkline points={serie} />}

      {/* Saisie */}
      <div className="mt-7 flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#a3a4ac]">Écritures de coûts ({costs.length})</p>
        {canManage && !form && (
          <button
            onClick={() => setForm({
              categorie: "entretien", montant: "", date_cout: new Date().toISOString().slice(0, 10),
              libelle: "", kilometrage: "", notes: "",
            })}
            className="inline-flex items-center gap-1.5 rounded-[9px] fleet-btn-violet px-3 py-1.5 text-[12px] font-semibold"
          >
            <Plus size={13} /> Ajouter un coût
          </button>
        )}
      </div>

      {form && (
        <div className="mt-2.5 rounded-xl border border-[#eaeaee] p-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-[#a3a4ac]">Poste</span>
              <select
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value as CostCategory })}
                className="w-full rounded-[9px] border border-[#eaeaee] bg-white px-2.5 py-2 text-[12.5px] outline-none"
              >
                {COST_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <Mini label="Montant TTC (€)" type="number" value={form.montant} onChange={(v) => setForm({ ...form, montant: v })} />
            <Mini label="Date" type="date" value={form.date_cout} onChange={(v) => setForm({ ...form, date_cout: v })} />
            <Mini label="Kilométrage" type="number" value={form.kilometrage} onChange={(v) => setForm({ ...form, kilometrage: v })} />
            <Mini label="Libellé" value={form.libelle} onChange={(v) => setForm({ ...form, libelle: v })} />
            <Mini label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] px-3 py-1.5 text-[12px] font-semibold text-[#14161c] hover:bg-[#f2f2f5]"
            >
              <Paperclip size={13} /> {file ? "Changer le justificatif" : "Justificatif (obligatoire)"}
            </button>
            <span className="truncate text-[11.5px] text-[#70727d]">{file?.name ?? "Aucun fichier"}</span>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => { setForm(null); setFile(null); }}
              className="rounded-[9px] border border-[#eaeaee] px-3 py-1.5 text-[12px] font-semibold text-[#70727d]">
              Annuler
            </button>
            <button disabled={busy} onClick={submitCost}
              className="inline-flex items-center gap-1.5 rounded-[9px] fleet-btn-violet px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50">
              {busy && <Loader2 size={13} className="animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      )}

      <div className="mt-2.5">
        {costs.length === 0 ? (
          <p className="py-3 text-[13px] text-[#70727d]">Aucune écriture pour ce véhicule.</p>
        ) : (
          costs.map((c) => (
            <div key={c.id}
              className={`flex items-start gap-3 border-b border-[#eaeaee] py-3 ${c.statut === "archive" ? "opacity-45" : ""}`}>
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2f5fff]" />
              <div className="min-w-0 flex-1">
                <b className="text-[13px] font-semibold text-[#14161c]">
                  {c.libelle || catLabel(c.categorie)}
                </b>
                <p className="mt-0.5 text-[11.5px] text-[#70727d]">
                  {fmtDate(c.date_cout)} · {catLabel(c.categorie)} · {fmtEur(Number(c.montant))}
                  {c.source !== "manuel" && " · automatique"}
                  {c.kilometrage != null && ` · ${c.kilometrage.toLocaleString("fr-FR")} km`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {c.justificatif_path && (
                  <button onClick={() => openReceipt(c.justificatif_path!)} title="Justificatif"
                    className="rounded p-1.5 text-[#70727d] hover:bg-[#f2f2f5] hover:text-[#14161c]">
                    <Download size={14} />
                  </button>
                )}
                {canManage && c.statut === "actif" && (
                  <button onClick={() => archive(c)} title="Archiver"
                    className="rounded p-1.5 text-[#a3a4ac] hover:bg-[#fdeaea] hover:text-[#dc2626]">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Financement */}
      <div className="mt-8 flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#a3a4ac]">Financement & acquisition</p>
        {canManage && !contractForm && (
          <button
            onClick={() => setContractForm({
              type: "achat", valeur_acquisition: "", loyer_mensuel: "", duree_mois: "",
              date_debut: "", date_fin: "", valeur_residuelle: "", organisme: "",
            })}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] px-3 py-1.5 text-[12px] font-semibold text-[#14161c] hover:bg-[#f2f2f5]">
            <Plus size={13} /> Contrat
          </button>
        )}
      </div>
      {contractForm && (
        <div className="mt-2.5 rounded-xl border border-[#eaeaee] p-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-[#a3a4ac]">Type</span>
              <select value={contractForm.type} onChange={(e) => setContractForm({ ...contractForm, type: e.target.value })}
                className="w-full rounded-[9px] border border-[#eaeaee] bg-white px-2.5 py-2 text-[12.5px] outline-none">
                {CONTRACT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <Mini label="Organisme" value={contractForm.organisme} onChange={(v) => setContractForm({ ...contractForm, organisme: v })} />
            <Mini label="Valeur d'acquisition (€)" type="number" value={contractForm.valeur_acquisition}
              onChange={(v) => setContractForm({ ...contractForm, valeur_acquisition: v })} />
            <Mini label="Loyer mensuel (€)" type="number" value={contractForm.loyer_mensuel}
              onChange={(v) => setContractForm({ ...contractForm, loyer_mensuel: v })} />
            <Mini label="Durée (mois)" type="number" value={contractForm.duree_mois}
              onChange={(v) => setContractForm({ ...contractForm, duree_mois: v })} />
            <Mini label="Valeur résiduelle (€)" type="number" value={contractForm.valeur_residuelle}
              onChange={(v) => setContractForm({ ...contractForm, valeur_residuelle: v })} />
            <Mini label="Début" type="date" value={contractForm.date_debut}
              onChange={(v) => setContractForm({ ...contractForm, date_debut: v })} />
            <Mini label="Fin" type="date" value={contractForm.date_fin}
              onChange={(v) => setContractForm({ ...contractForm, date_fin: v })} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setContractForm(null)}
              className="rounded-[9px] border border-[#eaeaee] px-3 py-1.5 text-[12px] font-semibold text-[#70727d]">Annuler</button>
            <button disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await contractFn({ data: {
                    id: contractForm.id ?? null, vehicleId, type: contractForm.type,
                    valeurAcquisition: contractForm.valeur_acquisition ? Number(contractForm.valeur_acquisition) : null,
                    loyerMensuel: contractForm.loyer_mensuel ? Number(contractForm.loyer_mensuel) : null,
                    dureeMois: contractForm.duree_mois ? Number(contractForm.duree_mois) : null,
                    dateDebut: contractForm.date_debut || null, dateFin: contractForm.date_fin || null,
                    valeurResiduelle: contractForm.valeur_residuelle ? Number(contractForm.valeur_residuelle) : null,
                    organisme: contractForm.organisme || null,
                  } });
                  setContractForm(null); await load();
                } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
              }}
              className="inline-flex items-center gap-1.5 rounded-[9px] fleet-btn-violet px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50">
              {busy && <Loader2 size={13} className="animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      )}
      {contracts.length === 0 ? (
        <p className="py-3 text-[13px] text-[#70727d]">Aucun contrat renseigné.</p>
      ) : contracts.map((k) => (
        <button key={k.id} onClick={() => canManage && setContractForm({
          id: k.id, type: k.type, organisme: k.organisme ?? "",
          valeur_acquisition: k.valeur_acquisition ?? "", loyer_mensuel: k.loyer_mensuel ?? "",
          duree_mois: k.duree_mois ?? "", valeur_residuelle: k.valeur_residuelle ?? "",
          date_debut: k.date_debut ?? "", date_fin: k.date_fin ?? "",
        })} className="w-full border-b border-[#eaeaee] py-3 text-left">
          <b className="text-[13px] font-semibold text-[#14161c]">
            {CONTRACT_TYPES.find((t) => t.id === k.type)?.label ?? k.type}
          </b>
          <p className="mt-0.5 text-[11.5px] text-[#70727d]">
            {k.organisme ? `${k.organisme} · ` : ""}
            {k.loyer_mensuel ? `${fmtEur(Number(k.loyer_mensuel))}/mois · ` : ""}
            {k.valeur_acquisition ? `${fmtEur(Number(k.valeur_acquisition))} à l'achat · ` : ""}
            {fmtDate(k.date_debut)} → {fmtDate(k.date_fin)}
          </p>
        </button>
      ))}

      {/* Révisions */}
      <div className="mt-8 flex items-center justify-between">
        <p className="text-[11px] font-medium text-[#a3a4ac]">Révisions & contrôles planifiés</p>
        {canManage && !eventForm && (
          <button onClick={() => setEventForm({ type: "revision", date_prevue: "", kilometrage_prevu: "", notes: "" })}
            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] px-3 py-1.5 text-[12px] font-semibold text-[#14161c] hover:bg-[#f2f2f5]">
            <Plus size={13} /> Échéance
          </button>
        )}
      </div>
      {eventForm && (
        <div className="mt-2.5 rounded-xl border border-[#eaeaee] p-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-[#a3a4ac]">Type</span>
              <select value={eventForm.type} onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                className="w-full rounded-[9px] border border-[#eaeaee] bg-white px-2.5 py-2 text-[12.5px] outline-none">
                {EVENT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <Mini label="Date prévue" type="date" value={eventForm.date_prevue}
              onChange={(v) => setEventForm({ ...eventForm, date_prevue: v })} />
            <Mini label="Kilométrage prévu" type="number" value={eventForm.kilometrage_prevu}
              onChange={(v) => setEventForm({ ...eventForm, kilometrage_prevu: v })} />
            <Mini label="Notes" value={eventForm.notes} onChange={(v) => setEventForm({ ...eventForm, notes: v })} />
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setEventForm(null)}
              className="rounded-[9px] border border-[#eaeaee] px-3 py-1.5 text-[12px] font-semibold text-[#70727d]">Annuler</button>
            <button disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await eventFn({ data: {
                    id: eventForm.id ?? null, vehicleId, type: eventForm.type,
                    datePrevue: eventForm.date_prevue || null,
                    dateRealisee: eventForm.date_realisee || null,
                    kilometragePrevu: eventForm.kilometrage_prevu ? Number(eventForm.kilometrage_prevu) : null,
                    statut: eventForm.statut ?? "planifie", notes: eventForm.notes || null,
                  } });
                  setEventForm(null); await load();
                } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
              }}
              className="inline-flex items-center gap-1.5 rounded-[9px] fleet-btn-violet px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50">
              {busy && <Loader2 size={13} className="animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      )}
      {events.length === 0 ? (
        <p className="py-3 pb-1 text-[13px] text-[#70727d]">Aucune échéance planifiée.</p>
      ) : events.map((ev) => (
        <button key={ev.id} onClick={() => canManage && setEventForm({
          id: ev.id, type: ev.type, date_prevue: ev.date_prevue ?? "", date_realisee: ev.date_realisee ?? "",
          kilometrage_prevu: ev.kilometrage_prevu ?? "", statut: ev.statut, notes: ev.notes ?? "",
        })} className="w-full border-b border-[#eaeaee] py-3 text-left">
          <b className="text-[13px] font-semibold text-[#14161c]">
            {EVENT_TYPES.find((t) => t.id === ev.type)?.label ?? ev.type}
          </b>
          <p className="mt-0.5 text-[11.5px] text-[#70727d]">
            {ev.date_realisee ? `Réalisée le ${fmtDate(ev.date_realisee)}` : `Prévue le ${fmtDate(ev.date_prevue)}`}
            {ev.kilometrage_prevu != null && ` · ${Number(ev.kilometrage_prevu).toLocaleString("fr-FR")} km`}
            {` · ${ev.statut}`}
          </p>
        </button>
      ))}
    </div>
  );
}

function Kpi({ icon, label, value, strong }: { icon: React.ReactNode; label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3.5 ${strong ? "border-[1.5px] border-[#14161c]" : "border-[#eaeaee]"}`}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#a3a4ac]">{icon} {label}</span>
      <p className={`mt-1.5 font-extrabold tracking-[-0.02em] text-[#14161c] ${strong ? "text-[22px]" : "text-[16px]"}`}>
        {value}
      </p>
    </div>
  );
}

function Mini({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[#a3a4ac]">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[9px] border border-[#eaeaee] bg-white px-2.5 py-2 text-[12.5px] outline-none focus:border-[#2f5fff]"
      />
    </label>
  );
}

function Sparkline({ points }: { points: { date: string; cumul: number }[] }) {
  const w = 520, h = 90;
  const max = Math.max(...points.map((p) => p.cumul), 1);
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - (p.cumul / max) * (h - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <div className="mt-6 rounded-xl border border-[#eaeaee] p-3.5">
      <p className="mb-2 text-[11px] font-medium text-[#a3a4ac]">Coût cumulé sur la période</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[90px] w-full" preserveAspectRatio="none">
        <path d={`${d} L${w},${h} L0,${h} Z`} fill="rgba(47,95,255,0.10)" />
        <path d={d} fill="none" stroke="#2f5fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}
