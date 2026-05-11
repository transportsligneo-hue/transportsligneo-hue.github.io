import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Download, Loader2, ArrowRightCircle, Trash2, Mail, Phone,
  MapPin, Car, FileText, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { generateDevisPdf, downloadDevisPdf, type DevisData } from "@/lib/devis-pdf";
import {
  PageHeader, Card, Badge, Button, IconButton, Select, devisStatutTone,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/devis/$devisId")({
  component: AdminDevisDetailPage,
});

const STATUTS = [
  { value: "envoye", label: "Envoyé" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "convertit", label: "Converti en mission" },
];

function AdminDevisDetailPage() {
  const { devisId } = Route.useParams();
  const navigate = useNavigate();
  const [devis, setDevis] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [converting, setConverting] = useState(false);

  const buildDevisData = (row: any): DevisData => ({
    numero: row.numero,
    nom: row.nom, prenom: row.prenom, email: row.email,
    telephone: row.telephone, depart: row.depart, arrivee: row.arrivee,
    distance_km: row.distance_km, duree_estimee: row.duree_estimee,
    type_vehicule: row.type_vehicule, marque: row.marque, modele: row.modele,
    carburant: row.carburant, prestation: row.prestation,
    option_trajet: row.option_trajet, date_souhaitee: row.date_souhaitee,
    heure_souhaitee: row.heure_souhaitee, prix_estime: row.prix_estime,
    tarif_label: row.tarif_label, multiplier_label: row.multiplier_label,
    message: row.message, created_at: row.created_at,
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("devis").select("*").eq("id", devisId).maybeSingle();
    if (error || !data) {
      toast.error("Devis introuvable");
      setLoading(false);
      return;
    }
    setDevis(data);
    setLoading(false);
    // Preview PDF
    try {
      const blob = await generateDevisPdf(buildDevisData(data));
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("PDF preview error", e);
    }
  };

  useEffect(() => {
    load();
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisId]);

  const handleDownload = async () => {
    if (!devis) return;
    setGenerating(true);
    try {
      const blob = await generateDevisPdf(buildDevisData(devis));
      downloadDevisPdf(blob, devis.numero);
    } finally { setGenerating(false); }
  };

  const updateStatut = async (statut: string) => {
    if (!devis) return;
    await supabase.from("devis").update({ statut }).eq("id", devis.id);
    setDevis({ ...devis, statut });
    toast.success("Statut mis à jour");
  };

  const handleConvert = async () => {
    if (!devis || devis.mission_id) return;
    if (!confirm(`Convertir ${devis.numero} en mission ?`)) return;
    setConverting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Non authentifié");
      const { data: mission, error } = await supabase.from("missions").insert({
        user_id: userId, nom: devis.nom, prenom: devis.prenom, email: devis.email,
        telephone: devis.telephone, ville_depart: devis.depart, ville_arrivee: devis.arrivee,
        date_prise_en_charge: devis.date_souhaitee ?? new Date().toISOString().slice(0, 10),
        type_trajet: devis.option_trajet === "aller_retour" ? "aller_retour" : "aller_simple",
        marque: devis.marque, modele: devis.modele, carburant: devis.carburant,
        remarques: devis.message, prix_total: devis.prix_estime, statut: "en_attente",
      }).select("id, numero").single();
      if (error) throw error;
      await supabase.from("devis").update({
        statut: "convertit", mission_id: mission.id, converted_at: new Date().toISOString(), converted_by: userId,
      }).eq("id", devis.id);
      toast.success("Mission créée", { description: mission.numero });
      setDevis({ ...devis, statut: "convertit", mission_id: mission.id });
    } catch (e) {
      toast.error("Échec conversion", { description: e instanceof Error ? e.message : "" });
    } finally { setConverting(false); }
  };

  const handleDelete = async () => {
    if (!devis) return;
    if (!confirm("Supprimer définitivement ce devis ?")) return;
    await supabase.from("devis").delete().eq("id", devis.id);
    toast.success("Devis supprimé");
    navigate({ to: "/admin/devis" });
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={32} /></div>;
  }
  if (!devis) {
    return (
      <div className="py-16 text-center">
        <p className="text-pro-text-soft mb-4">Devis introuvable.</p>
        <Link to="/admin/devis"><Button icon={<ArrowLeft size={14} />}>Retour</Button></Link>
      </div>
    );
  }

  const statut = STATUTS.find((s) => s.value === devis.statut) || STATUTS[0];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link to="/admin/devis">
          <IconButton title="Retour"><ArrowLeft size={16} /></IconButton>
        </Link>
        <PageHeader title={`Devis ${devis.numero}`} subtitle={`Créé le ${new Date(devis.created_at).toLocaleDateString("fr-FR")}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: details */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-mono text-pro-accent text-sm font-semibold">{devis.numero}</span>
              <Badge tone={devisStatutTone[devis.statut] ?? "neutral"}>{statut.label}</Badge>
              {devis.email_envoye && <Badge tone="success">Email envoyé</Badge>}
              {devis.mission_id && <Badge tone="info">Mission</Badge>}
            </div>
            <p className="text-pro-text font-medium text-lg">{devis.prenom} {devis.nom}</p>
            <div className="mt-2 space-y-1 text-xs text-pro-text-soft">
              <p className="flex items-center gap-2"><Mail size={12} />{devis.email}</p>
              {devis.telephone && <p className="flex items-center gap-2"><Phone size={12} />{devis.telephone}</p>}
            </div>
          </Card>

          <Card>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3">Trajet</p>
            <div className="space-y-2 text-sm">
              <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 text-pro-accent shrink-0" /><span><span className="text-pro-muted text-xs block">Départ</span>{devis.depart}</span></p>
              <p className="flex items-start gap-2"><MapPin size={14} className="mt-0.5 text-pro-accent shrink-0" /><span><span className="text-pro-muted text-xs block">Arrivée</span>{devis.arrivee}</span></p>
              <div className="flex gap-4 text-xs text-pro-text-soft pt-2 border-t border-pro-border">
                <span>{devis.distance_km ?? "—"} km</span>
                {devis.duree_estimee && <span>{devis.duree_estimee}</span>}
                <span className="capitalize">{devis.option_trajet}</span>
              </div>
            </div>
          </Card>

          <Card>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3">Véhicule</p>
            <div className="space-y-1 text-sm">
              <p className="flex items-center gap-2"><Car size={14} className="text-pro-accent" />{[devis.marque, devis.modele].filter(Boolean).join(" ") || devis.type_vehicule || "—"}</p>
              {devis.carburant && <p className="text-xs text-pro-text-soft">{devis.carburant}</p>}
            </div>
          </Card>

          {(devis.date_souhaitee || devis.heure_souhaitee) && (
            <Card>
              <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3">Date souhaitée</p>
              <p className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-pro-accent" />
                {devis.date_souhaitee ? new Date(devis.date_souhaitee).toLocaleDateString("fr-FR") : "—"}
                {devis.heure_souhaitee && <span className="text-pro-text-soft"> à {devis.heure_souhaitee}</span>}
              </p>
            </Card>
          )}

          <Card>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-2">Montant</p>
            <p className="text-3xl font-semibold text-pro-text">{devis.prix_estime} €</p>
            <p className="text-[10px] text-pro-muted uppercase tracking-wider">TTC</p>
            {devis.tarif_label && <p className="text-xs text-pro-text-soft mt-2">{devis.tarif_label}</p>}
          </Card>

          {devis.message && (
            <Card>
              <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-2">Message client</p>
              <p className="text-sm italic text-pro-text-soft">"{devis.message}"</p>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <p className="text-[10px] uppercase tracking-wider text-pro-muted font-medium mb-3">Actions</p>
            <div className="space-y-2">
              <Select value={devis.statut} onChange={(e) => updateStatut(e.target.value)} className="w-full text-xs">
                {STATUTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
              <Button onClick={handleDownload} disabled={generating} icon={generating ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} className="w-full">
                Télécharger PDF
              </Button>
              <Button onClick={handleConvert} disabled={converting || !!devis.mission_id} icon={converting ? <Loader2 size={12} className="animate-spin" /> : <ArrowRightCircle size={12} />} className="w-full">
                {devis.mission_id ? "Mission créée" : "Convertir en mission"}
              </Button>
              <button
                onClick={handleDelete}
                className="w-full text-xs text-red-400 hover:text-red-300 py-2 flex items-center justify-center gap-2 border border-red-500/20 rounded hover:bg-red-500/5 transition"
              >
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          </Card>
        </div>

        {/* Right: PDF preview */}
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-pro-border flex items-center gap-2">
              <FileText size={14} className="text-pro-accent" />
              <span className="text-xs uppercase tracking-wider text-pro-muted font-medium">Aperçu PDF</span>
            </div>
            {pdfUrl ? (
              <iframe src={pdfUrl} className="w-full" style={{ height: "min(85vh, 1100px)" }} title={`Devis ${devis.numero}`} />
            ) : (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin text-pro-accent" size={24} /></div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
