import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, FileText, CheckCircle2, Eye, MapPin, User, Building2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { generateFacturePdf, downloadFacturePdf, type FactureData } from "@/lib/facture-pdf";
import {
  PageHeader,
  Card,
  KpiCard,
  Badge,
  EmptyState,
  Button,
  IconButton,
  Select,
  SearchInput,
  factureStatutTone,
} from "@/components/admin/AdminUI";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import { EditableNumero } from "@/components/admin/EditableNumero";
import { PoHistoryPanel } from "@/components/admin/PoHistoryPanel";
import { logPoEvent } from "@/lib/po-history";

export const Route = createFileRoute("/_authenticated/admin/factures")({
  component: AdminFacturesPage,
});

interface FactureRow {
  id: string;
  numero: string;
  type_facture: "particulier" | "b2b";
  statut: string;
  date_facture: string | null;
  date_mission: string | null;
  date_echeance: string | null;
  mode_paiement: string | null;
  conditions_paiement: string | null;
  client_email: string | null;
  client_nom: string | null;
  client_prenom: string | null;
  client_societe: string | null;
  client_adresse: string | null;
  client_siret: string | null;
  client_tva: string | null;
  designation: string | null;
  depart: string | null;
  arrivee: string | null;
  distance_km: number | null;
  prix_ht: number;
  tva_taux: number;
  prix_tva: number;
  prix_ttc: number;
  created_at: string;
  reference_client: string | null;
  reference_label: string | null;
}

const REFERENCE_LABEL_PRESETS = [
  "Référence client",
  "N° de commande",
  "N° BC",
  "N° dossier",
  "N° de marché",
];

const STATUTS = [
  { value: "emise", label: "Émise" },
  { value: "payee", label: "Payée" },
  { value: "en_retard", label: "En retard" },
  { value: "annulee", label: "Annulée" },
];

function AdminFacturesPage() {
  const [selected, setSelected] = useState<FactureRow | null>(null);
  const [factures, setFactures] = useState<FactureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const fetchFactures = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("factures")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erreur de chargement", { description: error.message });
    } else {
      setFactures((data ?? []) as FactureRow[]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchFactures(); }, []);

  const handleStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("factures").update({ statut }).eq("id", id);
    if (error) {
      toast.error("Mise à jour impossible", { description: error.message });
    } else {
      setFactures(prev => prev.map(f => f.id === id ? { ...f, statut } : f));
    }
  };

  const handlePaymentMode = async (id: string, mode_paiement: string) => {
    const conditions_paiement = mode_paiement === "Virement différé" ? "Paiement différé par virement selon accord client." : "Paiement par carte bancaire.";
    const { error } = await supabase.from("factures").update({ mode_paiement, conditions_paiement }).eq("id", id);
    if (error) return toast.error("Mode de paiement impossible", { description: error.message });
    setFactures(prev => prev.map(f => f.id === id ? { ...f, mode_paiement, conditions_paiement } : f));
    if (selected?.id === id) setSelected({ ...selected, mode_paiement, conditions_paiement });
  };

  const [poHistoryKey, setPoHistoryKey] = useState(0);

  const saveReference = async (id: string, ref: string | null, label: string | null) => {
    const before = factures.find(f => f.id === id);
    const previous = before?.reference_client ?? null;
    const { error } = await supabase
      .from("factures")
      .update({ reference_client: ref, reference_label: label })
      .eq("id", id);
    if (error) {
      toast.error("Sauvegarde référence impossible", { description: error.message });
      return false;
    }
    setFactures(prev => prev.map(f => f.id === id ? { ...f, reference_client: ref, reference_label: label } : f));
    if (selected?.id === id) setSelected(s => s ? { ...s, reference_client: ref, reference_label: label } : s);
    if ((previous ?? "") !== (ref ?? "")) {
      await logPoEvent({
        action: "po_change",
        factureId: id,
        factureNumero: before?.numero ?? null,
        oldPo: previous,
        newPo: ref,
      });
      setPoHistoryKey(k => k + 1);
    }
    return true;
  };


  const handleDownload = async (row: FactureRow) => {
    let refClient = row.reference_client ?? null;
    let refLabel = row.reference_label ?? null;

    // Prompt si B2B sans réf : éviter les dépôts plateforme sans code
    if (row.type_facture === "b2b" && !refClient) {
      const input = window.prompt(
        `Référence client à reporter sur la facture ${row.numero} ?\n(ex. n° de commande, n° de dossier — laisser vide pour ignorer)`,
        ""
      );
      if (input === null) return; // cancel
      const trimmed = input.trim();
      if (trimmed.length > 0) {
        refClient = trimmed;
        if (!refLabel) refLabel = "Référence client";
        await saveReference(row.id, refClient, refLabel);
      }
    }

    setGeneratingId(row.id);
    try {
      const data: FactureData = {
        numero: row.numero,
        type_facture: row.type_facture,
        date_facture: row.date_facture ?? row.created_at,
        date_mission: row.date_mission,
        date_echeance: row.date_echeance,
        mode_paiement: row.mode_paiement,
        conditions_paiement: row.conditions_paiement,
        client_nom: row.client_nom,
        client_prenom: row.client_prenom,
        client_societe: row.client_societe,
        client_email: row.client_email,
        client_adresse: row.client_adresse,
        client_siret: row.client_siret,
        client_tva: row.client_tva,
        designation: row.designation,
        depart: row.depart,
        arrivee: row.arrivee,
        distance_km: row.distance_km,
        prix_ht: Number(row.prix_ht),
        tva_taux: Number(row.tva_taux),
        prix_tva: Number(row.prix_tva),
        prix_ttc: Number(row.prix_ttc),
        reference_client: refClient,
        reference_label: refLabel,
      };
      const blob = await generateFacturePdf(data);
      downloadFacturePdf(blob, row.numero);
      toast.success("Facture téléchargée");
    } catch (e) {
      toast.error("Erreur PDF", { description: (e as Error).message });
    } finally {
      setGeneratingId(null);
    }
  };

  const filtered = factures.filter(f => {
    if (statutFilter && f.statut !== statutFilter) return false;
    if (typeFilter && f.type_facture !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${f.numero} ${f.client_nom ?? ""} ${f.client_prenom ?? ""} ${f.client_societe ?? ""} ${f.client_email ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totalTTC = factures.reduce((s, f) => s + Number(f.prix_ttc || 0), 0);
  const paid = factures.filter(f => f.statut === "payee").reduce((s, f) => s + Number(f.prix_ttc || 0), 0);
  const pending = factures.filter(f => f.statut === "emise" || f.statut === "en_retard").reduce((s, f) => s + Number(f.prix_ttc || 0), 0);

  const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div>
      <PageHeader
        title="Factures"
        subtitle={`${factures.length} facture${factures.length > 1 ? "s" : ""} émise${factures.length > 1 ? "s" : ""}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Total facturé" value={eur(totalTTC)} />
        <KpiCard label="Encaissé" value={eur(paid)} tone="success" />
        <KpiCard label="En attente" value={eur(pending)} tone="warning" />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <SearchInput value={search} onChange={setSearch} placeholder="Rechercher (numéro, client, société)…" />
          </div>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-sm">
            <option value="">Tous types</option>
            <option value="particulier">Particulier</option>
            <option value="b2b">B2B / Flotte</option>
          </Select>
          <Select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="text-sm">
            <option value="">Tous statuts</option>
            {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-pro-muted" size={28} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={FileText} title="Aucune facture" description="Les factures émises apparaîtront ici." />
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => (
            <Card key={f.id}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-pro-text font-medium">{f.numero}</p>
                    <EditableNumero
                      table="factures"
                      id={f.id}
                      value={f.numero}
                      onSaved={(next: string) => setFactures((list) => list.map((x) => x.id === f.id ? { ...x, numero: next } : x))}
                    />
                    <Badge tone={factureStatutTone[f.statut] ?? "neutral"}>
                      {STATUTS.find(s => s.value === f.statut)?.label ?? f.statut}
                    </Badge>
                    <Badge tone={f.type_facture === "b2b" ? "primary" : "info"}>
                      {f.type_facture === "b2b" ? "B2B" : "Particulier"}
                    </Badge>
                  </div>
                  <p className="text-pro-muted text-xs mt-1">
                    {f.client_societe || `${f.client_prenom ?? ""} ${f.client_nom ?? ""}`.trim() || "—"}
                    {f.client_email && <> · {f.client_email}</>}
                  </p>
                  {(f.depart || f.arrivee) && (
                    <p className="text-pro-text-soft text-xs mt-0.5">
                      {f.depart} → {f.arrivee}
                      {f.distance_km != null && <> · {f.distance_km} km</>}
                    </p>
                  )}
                  <div className="mt-1.5">
                    <ReferenceInline row={f} onSave={saveReference} />
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-right">
                    <p className="text-pro-text font-semibold">{eur(Number(f.prix_ttc))}</p>
                    <p className="text-pro-muted text-[10px]">TTC ({eur(Number(f.prix_ht))} HT)</p>
                  </div>
                  <Select
                    value={f.statut}
                    onChange={(e) => handleStatut(f.id, e.target.value)}
                    className="text-xs py-1.5"
                  >
                    {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                  <Select value={f.mode_paiement ?? "Carte bancaire"} onChange={(e) => handlePaymentMode(f.id, e.target.value)} className="text-xs py-1.5">
                    <option value="Carte bancaire">Carte bancaire</option>
                    <option value="Virement différé">Virement différé</option>
                  </Select>
                  <IconButton title="Voir détail" tone="neutral" onClick={() => setSelected(f)}>
                    <Eye size={15} />
                  </IconButton>
                  <IconButton
                    onClick={() => handleDownload(f)}
                    title="Télécharger PDF"
                    tone="primary"
                    disabled={generatingId === f.id}
                  >
                    {generatingId === f.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  </IconButton>
                  {f.statut !== "payee" && (
                    <IconButton onClick={() => handleStatut(f.id, "payee")} title="Marquer payée" tone="success">
                      <CheckCircle2 size={15} />
                    </IconButton>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <AdminDetailDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected.numero}
          subtitle={selected.client_societe || `${selected.client_prenom ?? ""} ${selected.client_nom ?? ""}`.trim()}
          badge={
            <div className="flex flex-wrap gap-2">
              <DrawerBadge tone={selected.statut === "payee" ? "green" : selected.statut === "en_retard" ? "red" : "blue"}>
                {STATUTS.find(s => s.value === selected.statut)?.label ?? selected.statut}
              </DrawerBadge>
              <DrawerBadge tone="slate">{selected.type_facture === "b2b" ? "B2B" : "Particulier"}</DrawerBadge>
            </div>
          }
          footer={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleDownload(selected)} icon={<Download size={12} />}>Télécharger PDF</Button>
              <Button size="sm" variant="secondary" onClick={() => handlePaymentMode(selected.id, selected.mode_paiement === "Virement différé" ? "Carte bancaire" : "Virement différé")}>Basculer paiement</Button>
              {selected.statut !== "payee" && (
                <Button size="sm" onClick={() => { handleStatut(selected.id, "payee"); setSelected({ ...selected, statut: "payee" }); }} className="bg-emerald-500 hover:bg-emerald-600 text-white" icon={<CheckCircle2 size={12} />}>Marquer payée</Button>
              )}
            </div>
          }
        >
          <DrawerSection title="Client" icon={<User size={12} />}>
            <DrawerGrid>
              <DrawerField label="Nom" value={`${selected.client_prenom ?? ""} ${selected.client_nom ?? ""}`.trim()} />
              <DrawerField label="Email" value={selected.client_email} />
              <DrawerField label="Société" value={selected.client_societe} />
              <DrawerField label="Adresse" value={selected.client_adresse} />
              <DrawerField label="SIRET" value={selected.client_siret} mono />
              <DrawerField label="TVA" value={selected.client_tva} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title="Numéro de commande (PO) — Bon de commande" icon={<Receipt size={12} />}>
            <ReferenceDrawerEditor row={selected} onSave={saveReference} />
          </DrawerSection>

          <DrawerSection title="Trajet" icon={<MapPin size={12} />}>
            <DrawerGrid>
              <DrawerField label="Départ" value={selected.depart} />
              <DrawerField label="Arrivée" value={selected.arrivee} />
              <DrawerField label="Distance" value={selected.distance_km ? `${selected.distance_km} km` : null} />
              <DrawerField label="Désignation" value={selected.designation} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title="Dates & paiement" icon={<Building2 size={12} />}>
            <DrawerGrid>
              <DrawerField label="Date facture" value={selected.date_facture ? new Date(selected.date_facture).toLocaleDateString("fr-FR") : null} />
              <DrawerField label="Date mission" value={selected.date_mission ? new Date(selected.date_mission).toLocaleDateString("fr-FR") : null} />
              <DrawerField label="Échéance" value={selected.date_echeance ? new Date(selected.date_echeance).toLocaleDateString("fr-FR") : null} />
              <DrawerField label="Mode paiement" value={selected.mode_paiement} />
              <DrawerField label="Conditions" value={selected.conditions_paiement} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title="Montants" icon={<Receipt size={12} />}>
            <DrawerGrid>
              <DrawerField label="Prix HT" value={eur(Number(selected.prix_ht))} />
              <DrawerField label={`TVA ${selected.tva_taux}%`} value={eur(Number(selected.prix_tva))} />
            </DrawerGrid>
            <div className="mt-3 pt-3 border-t border-white/10 flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-white/50">Total TTC</span>
              <span className="text-3xl font-semibold text-white">{eur(Number(selected.prix_ttc))}</span>
            </div>
          </DrawerSection>
        </AdminDetailDrawer>
      )}
    </div>
  );
}

function ReferenceInline({ row, onSave }: { row: FactureRow; onSave: (id: string, ref: string | null, label: string | null) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(row.reference_client ?? "");
  const [saving, setSaving] = useState(false);

  if (!editing) {
    const hasRef = !!row.reference_client;
    return (
      <button
        type="button"
        onClick={() => { setVal(row.reference_client ?? ""); setEditing(true); }}
        className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border transition ${
          hasRef
            ? "border-amber-400/60 bg-amber-50 text-amber-800 hover:bg-amber-100"
            : "border-dashed border-pro-border text-pro-muted hover:border-pro-accent hover:text-pro-accent"
        }`}
        title={hasRef ? "Modifier le numéro de commande (PO)" : "Ajouter un numéro de commande / Bon de commande (PO)"}
      >
        <span className="font-medium">{row.reference_label || "N° commande"}</span>
        <span className="font-mono">{hasRef ? row.reference_client : "+ N° commande"}</span>
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setEditing(false); }
          if (e.key === "Enter") {
            e.preventDefault();
            (async () => {
              setSaving(true);
              const ok = await onSave(row.id, val.trim() || null, row.reference_label || (val.trim() ? "N° commande (PO)" : null));
              setSaving(false);
              if (ok) setEditing(false);
            })();
          }
        }}
        placeholder="Ex. CMD-2024-1234"
        className="text-[11px] px-2 py-0.5 rounded-full border border-pro-accent bg-white font-mono w-44"
      />
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          const ok = await onSave(row.id, val.trim() || null, row.reference_label || (val.trim() ? "N° commande (PO)" : null));
          setSaving(false);
          if (ok) setEditing(false);
        }}
        className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium"
      >
        {saving ? "…" : "✓"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-[11px] text-pro-muted hover:text-pro-text"
      >
        ✕
      </button>
    </div>
  );
}

function ReferenceDrawerEditor({ row, onSave }: { row: FactureRow; onSave: (id: string, ref: string | null, label: string | null) => Promise<boolean> }) {
  const [ref, setRef] = useState(row.reference_client ?? "");
  const [label, setLabel] = useState(row.reference_label ?? "N° commande (PO)");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(row.id, ref.trim() || null, ref.trim() ? label : null);
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-white/60 leading-snug">
        Ce code apparaîtra sur le PDF dans le bloc info, en or, à reporter sur les plateformes type CCAT, Hiflow, etc.
      </p>
      <div className="flex flex-col gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-1">Libellé</label>
          <select
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-md bg-white/5 border border-white/15 text-white"
          >
            {REFERENCE_LABEL_PRESETS.map((p) => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-1">Valeur</label>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            onBlur={save}
            placeholder="Ex. CMD-2024-1234"
            className="w-full text-xs px-2 py-1.5 rounded-md bg-white/5 border border-white/15 text-white font-mono"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-[11px] px-3 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium disabled:opacity-50"
          >
            {saving ? "Sauvegarde…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
