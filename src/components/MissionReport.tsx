import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Loader2, X, Download, MapPin, Clock, Car, ClipboardCheck, Camera } from "lucide-react";

interface MissionReportProps {
  attributionId: string;
  onClose: () => void;
}

interface ReportData {
  attribution: {
    id: string;
    statut: string;
    created_at: string;
  };
  trajet: {
    depart: string;
    arrivee: string;
    date_trajet: string | null;
    heure_trajet: string | null;
    marque: string | null;
    modele: string | null;
    immatriculation: string | null;
    client_nom: string | null;
    client_email: string | null;
    client_telephone: string | null;
    prix: number | null;
  };
  convoyeur: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
  };
  inspections: Array<{
    type: string;
    statut: string;
    notes: string | null;
    created_at: string;
    photos: Array<{ vue_type: string; url_photo: string; signed_url?: string | null }>;
  }>;
  gps: {
    points: number;
    startTime: string | null;
    endTime: string | null;
    durationMinutes: number | null;
  };
  documents: Array<{
    type_document: string;
    nom_fichier: string;
    url_fichier: string;
    created_at: string;
    signed_url?: string | null;
  }>;
}

const vueLabels: Record<string, string> = {
  avant: "Avant", avant_droit: "Avant droit 3/4", cote_droit: "Côté droit",
  arriere_droit: "Arrière droit 3/4", arriere: "Arrière", arriere_gauche: "Arrière gauche 3/4",
  cote_gauche: "Côté gauche", avant_gauche: "Avant gauche 3/4",
  interieur_avant: "Intérieur avant", interieur_arriere: "Intérieur arrière",
  tableau_bord: "Tableau de bord",
};

const docTypeLabels: Record<string, string> = {
  pv_livraison: "PV de livraison / restitution", pv_signature: "Signature PV",
  carte_grise: "Carte grise", contrat: "Contrat", autre: "Autre",
};

const isImageFile = (name: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(name);

async function signedStorageUrl(bucket: string, path: string, expires = 3600) {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expires);
  return data?.signedUrl ?? null;
}

export function MissionReport({ attributionId, onClose }: MissionReportProps) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generateReport = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch attribution
      const { data: attr } = await supabase
        .from("attributions")
        .select("id, statut, created_at, trajet_id, convoyeur_id")
        .eq("id", attributionId)
        .single();
      if (!attr) { setError("Attribution introuvable."); return; }

      // Fetch trajet, convoyeur, inspections, GPS, documents in parallel
      const [trajetRes, convoyeurRes, inspectionsRes, gpsRes, docsRes] = await Promise.all([
        supabase.from("trajets").select("*").eq("id", attr.trajet_id).single(),
        supabase.from("convoyeurs").select("nom, prenom, email, telephone").eq("id", attr.convoyeur_id).single(),
        supabase.from("inspections").select("id, type, statut, notes, created_at").eq("attribution_id", attributionId),
        supabase.from("mission_locations").select("recorded_at").eq("attribution_id", attributionId).order("recorded_at", { ascending: true }),
        supabase.from("mission_documents").select("type_document, nom_fichier, created_at").eq("attribution_id", attributionId),
      ]);

      // Fetch photos for each inspection
      const inspections = [];
      for (const insp of (inspectionsRes.data || [])) {
        const { data: photos } = await supabase
          .from("inspection_photos")
          .select("vue_type, url_photo")
          .eq("inspection_id", insp.id);
        inspections.push({ ...insp, photos: photos || [] });
      }

      // GPS summary
      const gpsData = gpsRes.data || [];
      const startTime = gpsData.length > 0 ? gpsData[0].recorded_at : null;
      const endTime = gpsData.length > 0 ? gpsData[gpsData.length - 1].recorded_at : null;
      let durationMinutes: number | null = null;
      if (startTime && endTime) {
        durationMinutes = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);
      }

      setReport({
        attribution: { id: attr.id, statut: attr.statut, created_at: attr.created_at },
        trajet: trajetRes.data as ReportData["trajet"],
        convoyeur: convoyeurRes.data as ReportData["convoyeur"],
        inspections,
        gps: { points: gpsData.length, startTime, endTime, durationMinutes },
        documents: (docsRes.data || []) as ReportData["documents"],
      });
    } catch {
      setError("Erreur lors de la génération du rapport.");
    } finally {
      setLoading(false);
    }
  };

  const printReport = () => {
    window.print();
  };

  if (!report && !loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
        <div className="card-premium rounded-lg p-6 max-w-sm w-full text-center space-y-4" onClick={e => e.stopPropagation()}>
          <FileText size={32} className="mx-auto text-primary" />
          <h3 className="font-heading text-lg text-primary">Rapport de mission</h3>
          <p className="text-cream/50 text-sm">Générer un rapport complet avec toutes les informations de la mission.</p>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2 text-cream/50 border border-primary/20 rounded text-sm hover:bg-primary/5 transition-colors">
              Annuler
            </button>
            <button onClick={generateReport} className="flex-1 px-4 py-2 bg-primary text-primary-foreground font-heading text-sm tracking-wider uppercase hover:bg-gold-light transition-colors rounded">
              Générer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="card-premium rounded-lg p-8 text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-primary mx-auto" />
          <p className="text-cream/60 text-sm">Génération du rapport...</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("fr-FR") : "—";
  const formatDateTime = (d: string | null) => d ? new Date(d).toLocaleString("fr-FR") : "—";
  const inspDepart = report.inspections.find(i => i.type === "depart");
  const inspArrivee = report.inspections.find(i => i.type === "arrivee");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/60" onClick={onClose}>
      <div className="bg-navy border border-primary/20 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-navy border-b border-primary/20 px-6 py-4 flex items-center justify-between print:hidden">
          <h3 className="font-heading text-lg text-primary tracking-wider uppercase">Rapport de mission</h3>
          <div className="flex items-center gap-2">
            <button onClick={printReport} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded text-xs hover:bg-primary/20 transition-colors">
              <Download size={12} /> Imprimer / PDF
            </button>
            <button onClick={onClose} className="text-cream/50 hover:text-cream"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6 print:p-8" id="mission-report">
          {/* Title for print */}
          <div className="hidden print:block text-center mb-8">
            <h1 className="text-2xl font-bold">TRANSPORTS LIGNEO — Rapport de mission</h1>
            <p className="text-sm text-gray-500 mt-1">Généré le {new Date().toLocaleString("fr-FR")}</p>
          </div>

          {/* Mission info */}
          <Section title="Informations de mission" icon={<FileText size={16} />}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Référence" value={report.attribution.id.slice(0, 8).toUpperCase()} />
              <InfoRow label="Statut" value={report.attribution.statut} />
              <InfoRow label="Créée le" value={formatDateTime(report.attribution.created_at)} />
              {report.trajet.prix && <InfoRow label="Prix" value={`${report.trajet.prix} €`} />}
            </div>
          </Section>

          {/* Vehicle */}
          <Section title="Véhicule" icon={<Car size={16} />}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Marque" value={report.trajet.marque} />
              <InfoRow label="Modèle" value={report.trajet.modele} />
              <InfoRow label="Immatriculation" value={report.trajet.immatriculation} />
            </div>
          </Section>

          {/* Route */}
          <Section title="Trajet" icon={<MapPin size={16} />}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Départ" value={report.trajet.depart} />
              <InfoRow label="Arrivée" value={report.trajet.arrivee} />
              <InfoRow label="Date prévue" value={formatDate(report.trajet.date_trajet)} />
              <InfoRow label="Heure" value={report.trajet.heure_trajet} />
            </div>
          </Section>

          {/* Client */}
          {report.trajet.client_nom && (
            <Section title="Client">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <InfoRow label="Nom" value={report.trajet.client_nom} />
                <InfoRow label="Email" value={report.trajet.client_email} />
                <InfoRow label="Téléphone" value={report.trajet.client_telephone} />
              </div>
            </Section>
          )}

          {/* Convoyeur */}
          <Section title="Convoyeur">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Nom" value={`${report.convoyeur.prenom} ${report.convoyeur.nom}`} />
              <InfoRow label="Email" value={report.convoyeur.email} />
              <InfoRow label="Téléphone" value={report.convoyeur.telephone} />
            </div>
          </Section>

          {/* GPS Summary */}
          <Section title="Résumé GPS" icon={<Clock size={16} />}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Points enregistrés" value={String(report.gps.points)} />
              <InfoRow label="Heure départ" value={report.gps.startTime ? new Date(report.gps.startTime).toLocaleTimeString("fr-FR") : null} />
              <InfoRow label="Heure arrivée" value={report.gps.endTime ? new Date(report.gps.endTime).toLocaleTimeString("fr-FR") : null} />
              <InfoRow label="Durée" value={report.gps.durationMinutes !== null ? `${Math.floor(report.gps.durationMinutes / 60)}h${(report.gps.durationMinutes % 60).toString().padStart(2, "0")}` : null} />
            </div>
          </Section>

          {/* Inspections */}
          {[inspDepart, inspArrivee].map((insp, idx) => {
            if (!insp) return null;
            const label = idx === 0 ? "État des lieux — Départ" : "État des lieux — Arrivée";
            return (
              <Section key={idx} title={label} icon={<ClipboardCheck size={16} />}>
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <InfoRow label="Statut" value={insp.statut === "complete" ? "Complété" : insp.statut} />
                  <InfoRow label="Date" value={formatDateTime(insp.created_at)} />
                  {insp.notes && <div className="col-span-2"><InfoRow label="Notes" value={insp.notes} /></div>}
                </div>
                {insp.photos.length > 0 && (
                  <div>
                    <p className="text-cream/40 text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Camera size={10} /> {insp.photos.length} photo{insp.photos.length > 1 ? "s" : ""}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {insp.photos.map((p) => (
                        <div key={p.vue_type} className="space-y-0.5">
                          <a href={p.url_photo} target="_blank" rel="noopener noreferrer">
                            <img src={p.url_photo} alt={vueLabels[p.vue_type] || p.vue_type}
                              className="w-full aspect-[3/4] object-cover rounded border border-primary/20 hover:border-primary/50 transition-colors" />
                          </a>
                          <p className="text-cream/40 text-[9px] text-center truncate">{vueLabels[p.vue_type] || p.vue_type}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            );
          })}

          {/* Documents */}
          {report.documents.length > 0 && (
            <Section title="Documents joints" icon={<FileText size={16} />}>
              <div className="space-y-1">
                {report.documents.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-primary/5 last:border-0">
                    <span className="text-cream/80">{d.nom_fichier}</span>
                    <span className="text-cream/40 text-xs">{docTypeLabels[d.type_document] || d.type_document}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Timestamp */}
          <div className="text-center pt-4 border-t border-primary/10">
            <p className="text-cream/30 text-xs">
              Rapport généré le {new Date().toLocaleString("fr-FR")} — Transports Ligneo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-primary/10 rounded-lg p-4">
      <h4 className="font-heading text-sm text-primary tracking-wider uppercase mb-3 flex items-center gap-2">
        {icon} {title}
      </h4>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-cream/40 text-xs">{label}</span>
      <p className="text-cream/80 text-sm">{value || "—"}</p>
    </div>
  );
}
