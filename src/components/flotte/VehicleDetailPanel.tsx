import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { confirmToast } from "@/lib/confirm-toast";
import {
  X, FileText, ShieldCheck, Wrench, Loader2, Gauge, MapPin,
  Upload, Trash2, Download, Plus, AlertCircle,
} from "lucide-react";
import { DocScanButton } from "@/components/scanner/DocScanButton";



export type FleetVehicle = {
  id: string;
  organization_id: string;
  site_id: string | null;
  vin: string | null;
  immatriculation: string | null;
  marque: string | null;
  modele: string | null;
  energie: string | null;
  type_vehicule: string | null;
  couleur: string | null;
  kilometrage: number | null;
  statut: "actif" | "en_mission" | "indispo" | "archive";
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  assurance_expire_le: string | null;
  controle_technique_expire_le: string | null;
  carte_grise_expire_le: string | null;
  mise_en_circulation: string | null;
  assurance_cout_annuel: number | null;
  prochaine_revision_km: number | null;
  intervalle_revision_km: number | null;
};

type Maintenance = {
  id: string;
  effectue_le: string;
  kilometrage: number | null;
  type_intervention: string;
  cout: number | null;
  garage: string | null;
  notes: string | null;
};

type VehicleDocument = {
  id: string;
  vehicle_id: string;
  doc_type: string;
  nom: string;
  storage_path: string;
  mime_type: string | null;
  taille_octets: number | null;
  expire_le: string | null;
  created_at: string;
};

const DOC_TYPES = [
  { id: "assurance", label: "Assurance" },
  { id: "controle_technique", label: "Contrôle technique" },
  { id: "carte_grise", label: "Carte grise" },
  { id: "autre", label: "Autre document" },
];

const MAX_DOC_MB = 15;


type HistoryRow = {
  id: string;
  occurred_at: string;
  type: string;
  from_address: string | null;
  to_address: string | null;
  mission: { numero: string; ville_depart: string; ville_arrivee: string; prix_total: number; statut: string } | null;
};

export type DocStatus = "ok" | "warn" | "expired" | "unknown";

export function docStatus(date: string | null | undefined): DocStatus {
  if (!date) return "unknown";
  const d = new Date(date).getTime();
  const now = Date.now();
  if (Number.isNaN(d)) return "unknown";
  if (d < now) return "expired";
  if (d - now < 30 * 24 * 3600 * 1000) return "warn";
  return "ok";
}

export function worstDocStatus(v: FleetVehicle): DocStatus {
  const all = [v.assurance_expire_le, v.controle_technique_expire_le, v.carte_grise_expire_le].map(docStatus);
  if (all.includes("expired")) return "expired";
  if (all.includes("warn")) return "warn";
  if (all.every((s) => s === "unknown")) return "unknown";
  return "ok";
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtEur = (n: number) =>
  n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const TABS = [
  { id: "general", label: "Général" },
  { id: "documents", label: "Documents" },
  { id: "entretien", label: "Entretien & TCO" },
  { id: "historique", label: "Historique" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function VehicleDetailPanel({
  vehicle,
  siteName,
  canManage = false,
  initialTab = "general",
  onEdit,
  onClose,
}: {
  vehicle: FleetVehicle | null;
  siteName?: string | null;
  canManage?: boolean;
  initialTab?: TabId;
  onEdit?: (v: FleetVehicle) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("general");
  const [maint, setMaint] = useState<Maintenance[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [docs, setDocs] = useState<VehicleDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<string>("assurance");
  const [maintForm, setMaintForm] = useState<{
    effectue_le: string; type_intervention: string; kilometrage: string; cout: string; garage: string; notes: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { setTab(initialTab); setError(null); setMaintForm(null); }, [vehicle?.id, initialTab]);

  const reloadDocs = async (vehicleId: string) => {
    const { data } = await supabase
      .from("vehicle_documents").select("*")
      .eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
    setDocs((data ?? []) as VehicleDocument[]);
  };

  const reloadMaint = async (vehicleId: string) => {
    const { data } = await supabase
      .from("vehicle_maintenances").select("*")
      .eq("vehicle_id", vehicleId).order("effectue_le", { ascending: false });
    setMaint((data ?? []) as Maintenance[]);
  };

  useEffect(() => {
    if (!vehicle) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [m, h, d] = await Promise.all([
        supabase.from("vehicle_maintenances").select("*")
          .eq("vehicle_id", vehicle.id).order("effectue_le", { ascending: false }),
        supabase.from("vehicle_movements")
          .select("id, occurred_at, type, from_address, to_address, mission:missions(numero, ville_depart, ville_arrivee, prix_total, statut)")
          .eq("vehicle_id", vehicle.id).order("occurred_at", { ascending: false }).limit(30),
        supabase.from("vehicle_documents").select("*")
          .eq("vehicle_id", vehicle.id).order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setMaint((m.data ?? []) as Maintenance[]);
      setHistory((h.data ?? []) as unknown as HistoryRow[]);
      setDocs((d.data ?? []) as VehicleDocument[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [vehicle?.id]);

  const uploadDoc = async (file: File) => {
    if (!vehicle) return;
    setError(null);
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!allowed.includes(file.type)) {
      setError("Format non supporté (PDF, JPG, PNG ou WEBP uniquement).");
      return;
    }
    if (file.size > MAX_DOC_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${MAX_DOC_MB} Mo).`);
      return;
    }
    setBusy(true);
    const ext = file.name.split(".").pop() || "bin";
    const path = `${vehicle.organization_id}/${vehicle.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("vehicle-documents").upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (upErr) { setBusy(false); setError(upErr.message); return; }
    const { error: insErr } = await supabase.from("vehicle_documents").insert({
      vehicle_id: vehicle.id,
      doc_type: docType,
      nom: file.name,
      storage_path: path,
      mime_type: file.type,
      taille_octets: file.size,
    });
    if (insErr) {
      await supabase.storage.from("vehicle-documents").remove([path]);
      setError(insErr.message);
    } else {
      await reloadDocs(vehicle.id);
    }
    setBusy(false);
  };

  const openDoc = async (d: VehicleDocument) => {
    const { data, error: e } = await supabase.storage
      .from("vehicle-documents").createSignedUrl(d.storage_path, 300);
    if (e || !data?.signedUrl) { setError(e?.message ?? "Lien indisponible."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const deleteDoc = async (d: VehicleDocument) => {
    if (!vehicle) return;
    if (!(await confirmToast(`Supprimer « ${d.nom} » ?`))) return;
    setBusy(true);
    await supabase.storage.from("vehicle-documents").remove([d.storage_path]);
    const { error: e } = await supabase.from("vehicle_documents").delete().eq("id", d.id);
    if (e) setError(e.message);
    else await reloadDocs(vehicle.id);
    setBusy(false);
  };

  const saveMaintenance = async () => {
    if (!vehicle || !maintForm) return;
    if (!maintForm.type_intervention.trim()) { setError("Indiquez le type d'intervention."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.from("vehicle_maintenances").insert({
      vehicle_id: vehicle.id,
      effectue_le: maintForm.effectue_le || new Date().toISOString().slice(0, 10),
      type_intervention: maintForm.type_intervention.trim(),
      kilometrage: maintForm.kilometrage ? Number(maintForm.kilometrage) : null,
      cout: maintForm.cout ? Number(maintForm.cout) : null,
      garage: maintForm.garage.trim() || null,
      notes: maintForm.notes.trim() || null,
    });
    if (e) setError(e.message);
    else { setMaintForm(null); await reloadMaint(vehicle.id); }
    setBusy(false);
  };

  const deleteMaintenance = async (m: Maintenance) => {
    if (!vehicle) return;
    if (!(await confirmToast(`Supprimer l'intervention « ${m.type_intervention} » ?`))) return;
    setBusy(true);
    const { error: e } = await supabase.from("vehicle_maintenances").delete().eq("id", m.id);
    if (e) setError(e.message);
    else await reloadMaint(vehicle.id);
    setBusy(false);
  };


  const year = new Date().getFullYear();

  const tco = useMemo(() => {
    const entretien = maint
      .filter((m) => new Date(m.effectue_le).getFullYear() === year)
      .reduce((s, m) => s + Number(m.cout ?? 0), 0);
    const assurance = Number(vehicle?.assurance_cout_annuel ?? 0);
    const convoyage = history
      .filter((h) => h.mission && new Date(h.occurred_at).getFullYear() === year)
      .reduce((s, h) => s + Number(h.mission?.prix_total ?? 0), 0);
    const total = entretien + assurance + convoyage;
    const km = vehicle?.kilometrage ?? 0;
    return { entretien, assurance, convoyage, total, parKm: km > 0 ? total / km : 0 };
  }, [maint, history, vehicle, year]);

  const gauge = useMemo(() => {
    const km = vehicle?.kilometrage ?? 0;
    const next = vehicle?.prochaine_revision_km ?? null;
    const interval = vehicle?.intervalle_revision_km ?? 20000;
    if (!next || !km) return null;
    const start = next - interval;
    const pct = Math.max(0, Math.min(100, ((km - start) / interval) * 100));
    return { pct, next, remaining: next - km };
  }, [vehicle]);

  const open = !!vehicle;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-[#14161c]/40 transition-opacity duration-250 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />
      <aside
        className="fixed top-0 right-0 z-[51] h-screen w-full sm:w-[600px] max-w-full overflow-y-auto border-l border-[#eaeaee] bg-white shadow-[-24px_0_60px_rgba(20,22,28,0.12)] transition-transform duration-300 ease-[cubic-bezier(.2,.9,.25,1)]"
        style={{ transform: open ? "translateX(0)" : "translateX(105%)" }}
        aria-hidden={!open}
      >
        {vehicle && (
          <>
            <header className="px-7 pt-6 pb-5 border-b border-[#eaeaee]">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#a3a4ac] mb-2.5">
                    Fiche véhicule
                  </p>
                  <h2 className="text-xl font-extrabold tracking-[-0.02em] text-[#14161c] mb-2">
                    {[vehicle.marque, vehicle.modele].filter(Boolean).join(" ") || "Véhicule"}
                  </h2>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[11px] text-[#a3a4ac]">{vehicle.immatriculation || "—"}</span>
                    <StatusPill statut={vehicle.statut} />
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-[9px] border border-[#eaeaee] bg-white text-[#70727d] flex items-center justify-center transition hover:bg-[#14161c] hover:text-white"
                  aria-label="Fermer"
                >
                  <X size={15} />
                </button>
              </div>
            </header>

            <nav className="sticky top-0 z-[2] flex px-7 border-b border-[#eaeaee] bg-white">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative mr-6 py-3.5 text-[12.5px] font-semibold transition-colors ${tab === t.id ? "text-[#14161c]" : "text-[#a3a4ac] hover:text-[#70727d]"}`}
                >
                  {t.label}
                  <span
                    className={`absolute -bottom-px left-0 h-0.5 w-full bg-[#14161c] transition-transform duration-200 ${tab === t.id ? "scale-x-100" : "scale-x-0"}`}
                  />
                </button>
              ))}
            </nav>

            <div key={tab} className="px-7 pt-6 pb-9 animate-[fleetFade_.25s_ease]">
              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg bg-[#fdeaea] px-3 py-2 text-[12px] text-[#b91c1c]">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
              )}
              {tab === "general" && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Marque / Modèle" value={[vehicle.marque, vehicle.modele].filter(Boolean).join(" ") || "—"} />
                  <Field label="Immatriculation" value={vehicle.immatriculation || "—"} mono />
                  <Field label="VIN" value={vehicle.vin || "—"} mono />
                  <Field label="Énergie" value={vehicle.energie || "—"} />
                  <Field label="Site de rattachement" value={siteName || "—"} />
                  <Field label="Mise en circulation" value={fmtDate(vehicle.mise_en_circulation)} />
                  <Field
                    label="Kilométrage actuel"
                    value={vehicle.kilometrage != null ? `${vehicle.kilometrage.toLocaleString("fr-FR")} km` : "—"}
                  />
                  <Field label="Couleur" value={vehicle.couleur || "—"} />
                  {vehicle.notes && (
                    <div className="col-span-2">
                      <Field label="Notes" value={vehicle.notes} />
                    </div>
                  )}
                  {canManage && onEdit && (
                    <div className="col-span-2 pt-1">
                      <button
                        onClick={() => onEdit(vehicle)}
                        className="rounded-[9px] border border-[#eaeaee] px-3.5 py-2 text-[12px] font-semibold text-[#14161c] transition hover:bg-[#f2f2f5]"
                      >
                        Modifier la fiche
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tab === "documents" && (
                <div>
                  <p className="mb-2 text-[11px] font-medium text-[#a3a4ac]">Échéances réglementaires</p>
                  <DocRow name="Assurance" date={vehicle.assurance_expire_le} icon={<ShieldCheck size={15} />} />
                  <DocRow name="Contrôle technique" date={vehicle.controle_technique_expire_le} icon={<Wrench size={15} />} />
                  <DocRow name="Carte grise" date={vehicle.carte_grise_expire_le} icon={<FileText size={15} />} />
                  <p className="mt-2 text-[11.5px] text-[#a3a4ac]">
                    Les dates se renseignent depuis le formulaire d'édition du véhicule.
                  </p>

                  <div className="mt-7 flex items-center justify-between">
                    <p className="text-[11px] font-medium text-[#a3a4ac]">Fichiers ({docs.length})</p>
                    {canManage && (
                      <div className="flex items-center gap-2">
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                          className="rounded-[9px] border border-[#eaeaee] bg-white px-2 py-1.5 text-[12px] outline-none"
                        >
                          {DOC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadDoc(f);
                            e.target.value = "";
                          }}
                        />
                        <DocScanButton
                          label="Scanner"
                          maxPages={4}
                          mergeToPdf
                          filenameBase={docType}
                          onFiles={async (files) => {
                            for (const f of files) await uploadDoc(f);
                          }}
                        />
                        <button
                          disabled={busy}
                          onClick={() => fileRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-[9px] fleet-btn-violet px-3 py-1.5 text-[12px] font-semibold transition disabled:opacity-50"
                        >
                          {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Ajouter
                        </button>

                      </div>
                    )}
                  </div>

                  <div className="mt-2.5">
                    {docs.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[#eaeaee] py-6 text-center text-[12.5px] text-[#70727d]">
                        Aucun fichier joint pour ce véhicule.
                      </p>
                    ) : (
                      docs.map((d) => (
                        <div key={d.id} className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#eaeaee] p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-[#eaeaee] bg-[#fbfbfc] text-[#70727d]">
                              <FileText size={15} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-[#14161c]">{d.nom}</p>
                              <p className="mt-0.5 text-[11.5px] text-[#70727d]">
                                {DOC_TYPES.find((t) => t.id === d.doc_type)?.label ?? d.doc_type}
                                {d.taille_octets ? ` · ${(d.taille_octets / 1024 / 1024).toFixed(1)} Mo` : ""}
                                {` · ${fmtDate(d.created_at)}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              onClick={() => openDoc(d)}
                              title="Ouvrir"
                              className="rounded p-1.5 text-[#70727d] hover:bg-[#f2f2f5] hover:text-[#14161c]"
                            >
                              <Download size={14} />
                            </button>
                            {canManage && (
                              <button
                                onClick={() => deleteDoc(d)}
                                title="Supprimer"
                                className="rounded p-1.5 text-[#a3a4ac] hover:bg-[#fdeaea] hover:text-[#dc2626]"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tab === "entretien" && (
                <div>
                  {loading ? (
                    <Loader2 className="animate-spin text-[#2f5fff]" size={20} />
                  ) : (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-[11px] font-medium text-[#a3a4ac]">Historique des interventions</p>
                        {canManage && !maintForm && (
                          <button
                            onClick={() => setMaintForm({
                              effectue_le: new Date().toISOString().slice(0, 10),
                              type_intervention: "", kilometrage: "", cout: "", garage: "", notes: "",
                            })}
                            className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#eaeaee] px-3 py-1.5 text-[12px] font-semibold text-[#14161c] transition hover:bg-[#f2f2f5]"
                          >
                            <Plus size={13} /> Intervention
                          </button>
                        )}
                      </div>

                      {maintForm && (
                        <div className="mb-4 rounded-xl border border-[#eaeaee] p-3.5">
                          <div className="grid grid-cols-2 gap-2.5">
                            <MiniField label="Date" type="date" value={maintForm.effectue_le}
                              onChange={(v) => setMaintForm({ ...maintForm, effectue_le: v })} />
                            <MiniField label="Type d'intervention" value={maintForm.type_intervention}
                              onChange={(v) => setMaintForm({ ...maintForm, type_intervention: v })} />
                            <MiniField label="Kilométrage" type="number" value={maintForm.kilometrage}
                              onChange={(v) => setMaintForm({ ...maintForm, kilometrage: v })} />
                            <MiniField label="Coût (€)" type="number" value={maintForm.cout}
                              onChange={(v) => setMaintForm({ ...maintForm, cout: v })} />
                            <MiniField label="Garage" value={maintForm.garage}
                              onChange={(v) => setMaintForm({ ...maintForm, garage: v })} />
                            <MiniField label="Notes" value={maintForm.notes}
                              onChange={(v) => setMaintForm({ ...maintForm, notes: v })} />
                          </div>
                          <div className="mt-3 flex justify-end gap-2">
                            <button onClick={() => setMaintForm(null)}
                              className="rounded-[9px] border border-[#eaeaee] px-3 py-1.5 text-[12px] font-semibold text-[#70727d]">
                              Annuler
                            </button>
                            <button disabled={busy} onClick={saveMaintenance}
                              className="inline-flex items-center gap-1.5 rounded-[9px] fleet-btn-violet px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50">
                              {busy && <Loader2 size={13} className="animate-spin" />} Enregistrer
                            </button>
                          </div>
                        </div>
                      )}

                      {maint.length === 0 ? (
                        <p className="py-3 text-[13px] text-[#70727d]">Aucune intervention enregistrée.</p>
                      ) : (
                        maint.map((m) => (
                          <div key={m.id} className="flex items-start gap-3 border-b border-[#eaeaee] py-3.5">
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#16a34a]" />
                            <div className="min-w-0 flex-1">
                              <b className="text-[13px] font-semibold text-[#14161c]">{m.type_intervention}</b>
                              <p className="mt-0.5 text-[11.5px] text-[#70727d]">
                                {fmtDate(m.effectue_le)}
                                {m.kilometrage != null && ` · ${m.kilometrage.toLocaleString("fr-FR")} km`}
                                {m.cout != null && ` · ${fmtEur(Number(m.cout))}`}
                                {m.garage && ` · ${m.garage}`}
                              </p>
                              {m.notes && <p className="mt-0.5 text-[11.5px] text-[#a3a4ac]">{m.notes}</p>}
                            </div>
                            {canManage && (
                              <button
                                onClick={() => deleteMaintenance(m)}
                                title="Supprimer"
                                className="rounded p-1 text-[#a3a4ac] hover:bg-[#fdeaea] hover:text-[#dc2626]"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        ))
                      )}


                      {gauge && (
                        <div className="mt-6">
                          <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#a3a4ac]">
                            <Gauge size={12} /> Prochaine révision à {gauge.next.toLocaleString("fr-FR")} km
                          </p>
                          <div className="mt-2.5 h-1.5 overflow-hidden rounded bg-[#eaeaee]">
                            <div
                              className="h-full rounded bg-[#d97706] transition-[width] duration-700"
                              style={{ width: `${gauge.pct}%` }}
                            />
                          </div>
                          <p className="mt-1.5 text-[11.5px] text-[#70727d]">
                            {gauge.remaining > 0
                              ? `${gauge.remaining.toLocaleString("fr-FR")} km restants`
                              : "Révision dépassée"}
                          </p>
                        </div>
                      )}

                      <p className="mt-7 mb-2 text-[11px] font-medium text-[#a3a4ac]">
                        Coût total de possession — {year}
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        <TcoItem k="Entretien cumulé" v={fmtEur(tco.entretien)} />
                        <TcoItem k="Assurance annuelle" v={fmtEur(tco.assurance)} />
                        <TcoItem k="Coûts de convoyage" v={fmtEur(tco.convoyage)} />
                        <TcoItem
                          k="Coût au kilomètre"
                          v={tco.parKm ? `${tco.parKm.toFixed(3).replace(".", ",")} €` : "—"}
                        />
                      </div>
                      <div className="mt-3.5 rounded-[14px] border-[1.5px] border-[#14161c] p-5 text-center">
                        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#a3a4ac]">
                          TCO consolidé {year}
                        </p>
                        <p className="text-[30px] font-extrabold tracking-[-0.02em] text-[#14161c]">
                          {fmtEur(tco.total)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab === "historique" && (
                <div>
                  {loading ? (
                    <Loader2 className="animate-spin text-[#2f5fff]" size={20} />
                  ) : history.length === 0 ? (
                    <p className="text-[13px] text-[#70727d]">Aucun convoyage enregistré pour ce véhicule.</p>
                  ) : (
                    history.map((h) => (
                      <div key={h.id} className="flex gap-3 border-b border-[#eaeaee] py-3.5">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2f5fff]" />
                        <div className="min-w-0">
                          <b className="text-[13px] font-semibold text-[#14161c]">
                            {h.mission?.numero || h.type}
                          </b>
                          <p className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[#70727d]">
                            <MapPin size={11} />
                            {h.mission
                              ? `${h.mission.ville_depart} → ${h.mission.ville_arrivee}`
                              : `${h.from_address || "—"} → ${h.to_address || "—"}`}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-[#a3a4ac]">
                            {fmtDate(h.occurred_at)}
                            {h.mission ? ` · ${fmtEur(Number(h.mission.prix_total))}` : ""}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] font-medium text-[#a3a4ac]">{label}</span>
      <p className={`text-sm font-semibold text-[#14161c] break-words ${mono ? "font-mono text-[13px]" : ""}`}>{value}</p>
    </div>
  );
}

function TcoItem({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-[#eaeaee] p-3.5">
      <p className="mb-1.5 text-[11px] text-[#a3a4ac]">{k}</p>
      <p className="text-[17px] font-bold text-[#14161c]">{v}</p>
    </div>
  );
}

function DocRow({ name, date, icon }: { name: string; date: string | null; icon: React.ReactNode }) {
  const st = docStatus(date);
  const badge =
    st === "ok"
      ? { cls: "bg-[#e9f7ee] text-[#16a34a]", label: "À jour" }
      : st === "warn"
        ? { cls: "bg-[#fef3e2] text-[#d97706]", label: "À renouveler" }
        : st === "expired"
          ? { cls: "bg-[#fdeaea] text-[#dc2626]", label: "Expiré" }
          : { cls: "bg-[#f2f2f5] text-[#70727d]", label: "Non renseigné" };
  return (
    <div className={`mb-2 flex items-center justify-between rounded-xl border p-3.5 ${st === "warn" ? "border-[#f3d9b0]" : st === "expired" ? "border-[#f3bcbc]" : "border-[#eaeaee]"}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border border-[#eaeaee] bg-[#fbfbfc] text-[#70727d]">
          {icon}
        </span>
        <div>
          <p className="text-[13px] font-semibold text-[#14161c]">{name}</p>
          <p className="mt-0.5 text-[11.5px] text-[#70727d]">Expire le {fmtDate(date)}</p>
        </div>
      </div>
      <span className={`rounded-full px-2.5 py-[5px] text-[10.5px] font-semibold ${badge.cls}`}>{badge.label}</span>
    </div>
  );
}

export function StatusPill({ statut }: { statut: FleetVehicle["statut"] }) {
  const map: Record<FleetVehicle["statut"], { label: string; dot: string }> = {
    actif: { label: "Disponible", dot: "bg-[#16a34a]" },
    en_mission: { label: "En mission", dot: "bg-[#2f5fff]" },
    indispo: { label: "Immobilisé", dot: "bg-[#dc2626]" },
    archive: { label: "Archivé", dot: "bg-[#a3a4ac]" },
  };
  const s = map[statut];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#eaeaee] bg-[#fbfbfc] px-2.5 py-1 text-[11px] font-semibold text-[#14161c]">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function MiniField({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-[#a3a4ac]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[9px] border border-[#eaeaee] bg-white px-2.5 py-2 text-[12.5px] outline-none focus:border-[#2f5fff]/40"
      />
    </label>
  );
}
