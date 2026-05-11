import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Download, Loader2, CheckCircle2, Trash2, FileText, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { generateFacturePdf, downloadFacturePdf, type FactureData } from "@/lib/facture-pdf";
import { PageHeader, Card, Badge, Button, IconButton, Select, factureStatutTone } from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/factures/$factureId")({
  component: AdminFactureDetailPage,
});

const STATUTS = [
  { value: "emise", label: "Émise" },
  { value: "payee", label: "Payée" },
  { value: "en_retard", label: "En retard" },
  { value: "annulee", label: "Annulée" },
];

function AdminFactureDetailPage() {
  const { factureId } = Route.useParams();
  const navigate = useNavigate();
  const [f, setF] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toData = (row: any): FactureData => ({
    numero: row.numero, type_facture: row.type_facture, statut: row.statut,
    date_facture: row.date_facture ?? row.created_at, date_mission: row.date_mission,
    date_echeance: row.date_echeance, date_paiement: row.date_paiement,
    mode_paiement: row.mode_paiement, conditions_paiement: row.conditions_paiement,
    client_nom: row.client_nom, client_prenom: row.client_prenom, client_societe: row.client_societe,
    client_email: row.client_email, client_telephone: row.client_telephone,
    client_adresse: row.client_adresse, client_siret: row.client_siret, client_tva: row.client_tva,
    designation: row.designation, depart: row.depart, arrivee: row.arrivee,
    distance_km: row.distance_km, prix_ht: Number(row.prix_ht), tva_taux: Number(row.tva_taux),
    prix_tva: Number(row.prix_tva), prix_ttc: Number(row.prix_ttc),
  });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("factures").select("*").eq("id", factureId).maybeSingle();
    if (!data) { toast.error("Facture introuvable"); setLoading(false); return; }
    setF(data); setLoading(false);
    try { setPdfUrl(URL.createObjectURL(await generateFacturePdf(toData(data)))); } catch (e) { console.error(e); }
  };

  useEffect(() => { load(); return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }; /* eslint-disable-next-line */ }, [factureId]);

  const handleDownload = async () => {
    if (!f) return;
    setBusy(true);
    try { downloadFacturePdf(await generateFacturePdf(toData(f)), f.numero); } finally { setBusy(false); }
  };

  const updateStatut = async (statut: string) => {
    if (!f) return;
    const patch: any = { statut };
    if (statut === "payee" && !f.date_paiement) patch.date_paiement = new Date().toISOString();
    await supabase.from("factures").update(patch).eq("id", f.id);
    setF({ ...f, ...patch });
    toast.success("Statut mis à jour");
    try { if (pdfUrl) URL.revokeObjectURL(pdfUrl); setPdfUrl(URL.createObjectURL(await generateFacturePdf(toData({ ...f, ...patch })))); } catch {}
  };

  const handleDelete = async () => {
    if (!f) return;
    if (!confirm("Supprimer définitivement cette facture ?")) return;
    await supabase.from("factures").delete().eq("id", f.id);
    toast.success("Facture supprimée");
    navigate({ to: "/admin/factures" });
  };

  const eur = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={32} /></div>;
  if (!f) return (
    <div className="py-16 text-center">
      <p className="text-pro-text-soft mb-4">Facture introuvable.</p>
      <Link to="/admin/factures"><Button icon={<ArrowLeft size={14} />}>Retour</Button></Link>
    </div>
  );

  const statut = STATUTS.find((s) => s.value === f.statut) || STATUTS[0];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link to="/admin/factures"><IconButton title="Retour"><ArrowLeft size={16} /></IconButton></Link>
        <PageHeader title={`Facture ${f.numero}`} subtitle={`Créée le ${new Date(f.created_at).toLocaleDateString("fr-FR")}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-mono text-pro-accent text-sm font-semibold">{f.numero}</span>
              <Badge tone={factureStatutTone[f.statut] ?? "neutral"}>{statut.label}</Badge>
              <Badge tone={f.type_facture === "b2b" ? "primary" : "info"}>{f.type_facture === "b2b" ? "B2B" : "Particulier"}</Badge>
            </div>
            <p className="text-pro-text font-medium text-lg">{f.client_societe || `${f.client_prenom ?? ""} ${f.client_nom ?? ""}`.trim() || "—"}</p>
            <div className="mt-2 space-y-1 text-xs text-pro-text-soft">
              {f.client_email && <p className="flex items-center gap-2"><Mail size={12} />{f.client_email}</p>}
              {f.client_telephone && <p className="flex items-center gap-2"><Phone size={12} />{f.client_telephone}</p>}
            </div>
          </Card>

          {(f.depart || f.arrivee) && (
            <Card>
              <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3">Trajet</p>
              <div className="space-y-2 text-sm">
                <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 text-pro-accent shrink-0" />{f.depart}</p>
                <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 text-pro-accent shrink-0" />{f.arrivee}</p>
                {f.distance_km != null && <p className="text-xs text-pro-text-soft">{f.distance_km} km</p>}
              </div>
            </Card>
          )}

          <Card>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-2">Montants</p>
            <div className="flex justify-between text-sm py-1"><span className="text-pro-text-soft">Total HT</span><span className="text-pro-text font-medium">{eur(Number(f.prix_ht))}</span></div>
            <div className="flex justify-between text-sm py-1"><span className="text-pro-text-soft">TVA ({f.tva_taux}%)</span><span className="text-pro-text font-medium">{eur(Number(f.prix_tva))}</span></div>
            <div className="flex justify-between text-base pt-2 border-t border-pro-border mt-1"><span className="font-semibold text-pro-text">Total TTC</span><span className="font-semibold text-pro-accent">{eur(Number(f.prix_ttc))}</span></div>
          </Card>

          <Card>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3">Actions</p>
            <div className="space-y-2">
              <Select value={f.statut} onChange={(e) => updateStatut(e.target.value)} className="w-full text-xs">
                {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Button onClick={handleDownload} disabled={busy} icon={busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} className="w-full">Télécharger PDF</Button>
              {f.statut !== "payee" && (
                <Button onClick={() => updateStatut("payee")} icon={<CheckCircle2 size={12} />} className="w-full">Marquer payée</Button>
              )}
              <button onClick={handleDelete} className="w-full text-xs text-red-400 hover:text-red-300 py-2 flex items-center justify-center gap-2 border border-red-500/20 rounded hover:bg-red-500/5 transition">
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card padded={false} className="overflow-hidden">
            <div className="px-4 py-3 border-b border-pro-border flex items-center gap-2">
              <FileText size={14} className="text-pro-accent" />
              <span className="text-xs uppercase tracking-wider text-pro-muted font-medium">Aperçu PDF</span>
            </div>
            {pdfUrl ? (
              <iframe src={pdfUrl} className="w-full" style={{ height: "min(85vh, 1100px)" }} title={`Facture ${f.numero}`} />
            ) : (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={24} /></div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
