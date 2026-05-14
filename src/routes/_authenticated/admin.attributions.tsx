import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, RefreshCw, Eye, Clock, Image, FileText, Plus, Send, Receipt, Loader2, User, Truck, Car, CheckCircle2, XCircle, RotateCcw, Edit2 } from "lucide-react";
import { GpsMapView } from "@/components/GpsMapView";
import { MissionReport } from "@/components/MissionReport";
import { MissionDocuments } from "@/components/MissionDocuments";
import {
  PageHeader,
  Card,
  Badge,
  EmptyState,
  Modal,
  Button,
  IconButton,
  Select,
  attributionStatutTone,
} from "@/components/admin/AdminUI";
import { AdminDetailDrawer, DrawerSection, DrawerField, DrawerGrid, DrawerBadge } from "@/components/admin/AdminDetailDrawer";
import { AdminStepOverridesPanel } from "@/components/admin/AdminStepOverridesPanel";
import { AdminLiveControl } from "@/components/admin/AdminLiveControl";
import { InspectionPreuvesBlock } from "@/components/admin/drawers/InspectionPreuvesBlock";
import { AssignDriverDialog } from "@/components/admin/AssignDriverDialog";
import { generateFacturePdf, downloadFacturePdf } from "@/lib/facture-pdf";
import { updateAdminMissionStatus } from "@/lib/adminMissionStatus";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/attributions")({
  component: AdminAttributions,
});

interface Attribution {
  id: string;
  trajet_id: string;
  convoyeur_id: string;
  statut: string;
  etape_courante?: string | null;
  numero_mission?: string | null;
  created_at: string;
  trajet?: { depart: string; arrivee: string; date_trajet: string | null; statut: string; statut_publication?: string | null; client_nom?: string | null; type_transport?: string | null };
  convoyeur?: { nom: string; prenom: string };
}

interface Trajet {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  statut: string;
}

interface GpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

interface InspectionPhoto {
  vue_type: string;
  url_photo: string;
  created_at: string;
}

const statutLabels: Record<string, string> = {
  propose: "Proposé",
  accepte: "Accepté",
  refuse: "Refusé",
  en_cours: "En cours",
  en_attente_validation: "En attente validation",
  validee: "Validée",
  refusee: "Refusée",
  termine: "Terminé",
  annule: "Annulé",
};

const vueLabels: Record<string, string> = {
  // Parcours séquentiel — ordre métier 18 étapes
  trois_quart_avant_gauche:   "01. 3/4 avant gauche",
  jante_avant_gauche:         "02. Jante avant gauche",
  jante_arriere_gauche:       "03. Jante arrière gauche",
  trois_quart_arriere_gauche: "04. 3/4 arrière gauche",
  arriere:                    "05. Arrière",
  coffre_ouvert:              "06. Coffre ouvert",
  roue_secours:               "07. Roue de secours / kit",
  trois_quart_arriere_droite: "08. 3/4 arrière droite",
  jante_arriere_droite:       "09. Jante arrière droite",
  siege_arriere:              "10. Sièges arrière",
  jante_avant_droite:         "11. Jante avant droite",
  trois_quart_avant_droite:   "12. 3/4 avant droite",
  siege_avant:                "13. Sièges avant",
  compteur:                   "14. Compteur (km + carburant)",
  kit_securite:               "15. Kit de sécurité",
  pv_livraison:               "16. PV livraison / restitution",
  carte_grise:                "17. Carte grise",
  signature:                  "18. Signature client",
  // Legacy (anciennes inspections — conservés pour rétrocompatibilité)
  devant: "Avant",
  avant: "Avant",
  avant_droit: "Avant droit 3/4",
  cote_droit: "Côté droit",
  arriere_droit: "Arrière droit 3/4",
  arriere_gauche: "Arrière gauche 3/4",
  cote_gauche: "Côté gauche",
  avant_gauche: "Avant gauche 3/4",
  interieur_avant: "Intérieur avant",
  interieur_arriere: "Intérieur arrière",
  tableau_bord: "Tableau de bord",
  coffre_ferme: "Coffre fermé",
  jantes: "Jantes",
  cable: "Câble de recharge",
  documents: "Documents",
};

/** Normalise un vue_type (peut être "devant" ou "devant_<timestamp>" pour multi-photos) */
function vueLabelFor(vueType: string): string {
  if (vueLabels[vueType]) return vueLabels[vueType];
  // Strip timestamp suffix : "devant_1729600000000" → "devant"
  const m = vueType.match(/^([a-z_]+?)(?:_\d{10,})?$/);
  if (m && vueLabels[m[1]]) return vueLabels[m[1]];
  return vueType;
}

function AdminAttributions() {
  const navigate = useNavigate();
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [trajetsDisponibles, setTrajetsDisponibles] = useState<Trajet[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [assignTrajet, setAssignTrajet] = useState<Trajet | null>(null);
  const [gpsView, setGpsView] = useState<{ id: string; points: GpsPoint[] } | null>(null);
  const [photosView, setPhotosView] = useState<{ id: string; type: string; photos: InspectionPhoto[] } | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<string | null>(null);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);
  const [selectedAttr, setSelectedAttr] = useState<Attribution | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [attrDetail, setAttrDetail] = useState<{ vin?: string | null; carte_grise_recto_url?: string | null; carte_grise_verso_url?: string | null; marque?: string | null; modele?: string | null; immatriculation?: string | null; client_email?: string | null; client_telephone?: string | null; prix?: number | null; numero_mission?: string | null; etape_courante?: string | null; cgRectoSigned?: string | null; cgVersoSigned?: string | null } | null>(null);

  useEffect(() => {
    if (!selectedAttr) { setAttrDetail(null); return; }
    (async () => {
      const { data: t } = await supabase.from("trajets").select("vin, carte_grise_recto_url, carte_grise_verso_url, marque, modele, immatriculation, client_email, client_telephone, prix").eq("id", selectedAttr.trajet_id).maybeSingle();
      const { data: a } = await supabase.from("attributions").select("numero_mission, etape_courante").eq("id", selectedAttr.id).maybeSingle();
      const sign = async (path: string | null | undefined) => {
        if (!path) return null;
        if (/^https?:\/\//.test(path)) return path;
        const { data } = await supabase.storage.from("cartes-grises").createSignedUrl(path, 3600);
        return data?.signedUrl ?? null;
      };
      setAttrDetail({
        ...(t ?? {}),
        ...(a ?? {}),
        cgRectoSigned: await sign(t?.carte_grise_recto_url),
        cgVersoSigned: await sign(t?.carte_grise_verso_url),
      });
    })();
  }, [selectedAttr]);

  const handleEmitFacture = async (a: Attribution) => {
    setInvoicingId(a.id);
    try {
      // 1. Refuse si une facture existe déjà
      const { data: existing } = await supabase
        .from("factures")
        .select("id, numero")
        .eq("attribution_id", a.id)
        .maybeSingle();
      if (existing) {
        toast.info("Facture déjà émise", { description: existing.numero });
        return;
      }
      // 2. Charge trajet
      const { data: trajet, error: tErr } = await supabase
        .from("trajets")
        .select("id, depart, arrivee, date_trajet, client_email, client_nom, client_telephone, marque, modele, immatriculation, prix")
        .eq("id", a.trajet_id)
        .maybeSingle();
      if (tErr || !trajet) throw new Error("Trajet introuvable");
      if (!trajet.client_email) throw new Error("Email client manquant sur le trajet");

      const prixHT = Number(trajet.prix ?? 0) > 0 ? Number(trajet.prix) / 1.2 : 0;
      const prixTTC = Number(trajet.prix ?? 0);
      const prixTVA = +(prixTTC - prixHT).toFixed(2);
      const isB2B = false; // par défaut particulier (B2B = via factures B2B flow)

      // 3. Insertion — trigger remplit numero automatiquement
      const today = new Date();
      const echeance = new Date(today.getTime() + 30 * 86400000);
      const [prenom, ...rest] = (trajet.client_nom || "").trim().split(/\s+/);
      const nomFamille = rest.join(" ") || prenom || "Client";

      const { data: inserted, error: iErr } = await supabase
        .from("factures")
        .insert({
          numero: "AUTO", // remplacé par le trigger
          type_facture: isB2B ? "b2b" : "particulier",
          attribution_id: a.id,
          mission_id: trajet.id,
          client_email: trajet.client_email,
          client_nom: nomFamille,
          client_prenom: rest.length ? prenom : null,
          date_facture: today.toISOString().slice(0, 10),
          date_mission: trajet.date_trajet,
          date_echeance: echeance.toISOString().slice(0, 10),
          mode_paiement: "Virement bancaire",
          designation: "Prestation de convoyage automobile",
          depart: trajet.depart,
          arrivee: trajet.arrivee,
          prix_ht: +prixHT.toFixed(2),
          prix_tva: prixTVA,
          prix_ttc: prixTTC,
          tva_taux: 20,
          statut: "emise",
        })
        .select("*")
        .single();
      if (iErr || !inserted) throw new Error(iErr?.message || "Insertion impossible");

      // 4. PDF + téléchargement
      const blob = await generateFacturePdf({
        numero: inserted.numero,
        type_facture: inserted.type_facture as "particulier" | "b2b",
        date_facture: inserted.date_facture,
        date_mission: inserted.date_mission,
        date_echeance: inserted.date_echeance,
        mode_paiement: inserted.mode_paiement,
        conditions_paiement: inserted.conditions_paiement,
        client_nom: inserted.client_nom,
        client_prenom: inserted.client_prenom,
        client_societe: inserted.client_societe,
        client_email: inserted.client_email,
        client_adresse: inserted.client_adresse,
        client_siret: inserted.client_siret,
        client_tva: inserted.client_tva,
        designation: inserted.designation,
        depart: inserted.depart,
        arrivee: inserted.arrivee,
        distance_km: inserted.distance_km,
        prix_ht: Number(inserted.prix_ht),
        tva_taux: Number(inserted.tva_taux),
        prix_tva: Number(inserted.prix_tva),
        prix_ttc: Number(inserted.prix_ttc),
      });
      downloadFacturePdf(blob, inserted.numero);
      toast.success(`Facture ${inserted.numero} émise`);
    } catch (e) {
      toast.error("Impossible d'émettre la facture", { description: (e as Error).message });
    } finally {
      setInvoicingId(null);
    }
  };

  const fetchAttributions = useCallback(async () => {
    const { data } = await supabase
      .from("attributions")
      .select("id, trajet_id, convoyeur_id, statut, etape_courante, numero_mission, created_at, trajet:trajets(depart, arrivee, date_trajet, statut, statut_publication, client_nom, type_transport), convoyeur:convoyeurs(nom, prenom)")
      .order("created_at", { ascending: false });
    if (data) setAttributions(data as unknown as Attribution[]);
  }, []);

  const fetchOptions = useCallback(async () => {
    const { data: trajets } = await supabase
      .from("trajets")
      .select("id, depart, arrivee, date_trajet, statut")
      .in("statut", ["en_attente", "attribue"]);
    if (trajets) setTrajetsDisponibles(trajets as Trajet[]);
  }, []);

  useEffect(() => {
    fetchAttributions();
    fetchOptions();
  }, [fetchAttributions, fetchOptions]);

  useEffect(() => {
    const channel = supabase
      .channel("gps-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mission_locations" },
        (payload) => {
          if (gpsView && payload.new.attribution_id === gpsView.id) {
            setGpsView((prev) =>
              prev
                ? {
                    ...prev,
                    points: [...prev.points, payload.new as unknown as GpsPoint],
                  }
                : null,
            );
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gpsView?.id]);

  const updateStatut = async (attribution: Attribution, statut: string, options?: { resetStep?: boolean; note?: string }) => {
    const actionKey = `${attribution.id}-${statut}`;
    setBusyAction(actionKey);
    try {
      const payload = await updateAdminMissionStatus({
        attributionId: attribution.id,
        trajetId: attribution.trajet_id,
        statut,
        note: options?.note,
        resetStep: options?.resetStep,
      });

      if (selectedAttr?.id === attribution.id) {
        setSelectedAttr((prev) => (prev ? { ...prev, statut, etape_courante: payload.etape_courante as string | null | undefined ?? prev.etape_courante } : prev));
      }

      toast.success(`Attribution mise à jour : ${statutLabels[statut] ?? statut}`);
      await Promise.all([fetchAttributions(), fetchOptions()]);
    } catch (error) {
      toast.error("Impossible de mettre à jour l'attribution", {
        description: error instanceof Error ? error.message : "Réessayez dans quelques secondes.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const renderAttributionActions = (attribution: Attribution) => {
    const buttons: Array<{ key: string; label: string; icon: typeof CheckCircle2; variant: "secondary" | "success" | "danger"; onClick: () => void }> = [];

    if (attribution.statut === "propose") {
      buttons.push({ key: "confirm", label: "Confirmer", icon: CheckCircle2, variant: "success", onClick: () => void updateStatut(attribution, "accepte", { note: "Attribution confirmée par l'admin" }) });
      buttons.push({ key: "refuse", label: "Refuser", icon: XCircle, variant: "danger", onClick: () => void updateStatut(attribution, "refusee", { note: "Attribution refusée par l'admin" }) });
    }

    if (["propose", "accepte", "en_cours", "en_attente_validation", "refusee", "annule"].includes(attribution.statut)) {
      buttons.push({ key: "edit", label: "Modifier", icon: Edit2, variant: "secondary", onClick: () => setAssignTrajet({ id: attribution.trajet_id, depart: attribution.trajet?.depart ?? "", arrivee: attribution.trajet?.arrivee ?? "", date_trajet: attribution.trajet?.date_trajet ?? null, statut: attribution.trajet?.statut ?? "attribue" }) });
    }

    if (attribution.statut === "en_attente_validation") {
      buttons.push({ key: "validate", label: "Valider", icon: CheckCircle2, variant: "success", onClick: () => void updateStatut(attribution, "validee", { note: "Mission validée par l'admin" }) });
    }

    if (!["annule", "validee", "termine"].includes(attribution.statut)) {
      buttons.push({ key: "cancel", label: "Annuler", icon: XCircle, variant: "danger", onClick: () => {
        if (!confirm("Annuler définitivement cette mission ?")) return;
        void updateStatut(attribution, "annule", { note: "Mission annulée par l'admin" });
      } });
    }

    if (["refusee", "annule"].includes(attribution.statut)) {
      buttons.push({ key: "reset", label: "Réinitialiser", icon: RotateCcw, variant: "secondary", onClick: () => void updateStatut(attribution, "propose", { resetStep: true, note: "Attribution réinitialisée par l'admin" }) });
    }

    return buttons.map((action) => (
      <Button
        key={action.key}
        size="sm"
        variant={action.variant}
        icon={<action.icon size={12} />}
        onClick={action.onClick}
        disabled={busyAction === `${attribution.id}-${action.key}` || busyAction === `${attribution.id}-${action.key === "confirm" ? "accepte" : action.key === "refuse" ? "refusee" : action.key === "cancel" ? "annule" : action.key === "validate" ? "validee" : action.key === "reset" ? "propose" : attribution.statut}`}
      >
        {action.label}
      </Button>
    ));
  };

  const viewGps = async (attributionId: string) => {
    const { data } = await supabase
      .from("mission_locations")
      .select("latitude, longitude, recorded_at, accuracy")
      .eq("attribution_id", attributionId)
      .order("recorded_at", { ascending: true });
    setGpsView({ id: attributionId, points: data || [] });
  };

  const viewPhotos = async (attributionId: string, type: string) => {
    const { data: inspection } = await supabase
      .from("inspections")
      .select("id")
      .eq("attribution_id", attributionId)
      .eq("type", type)
      .maybeSingle();
    if (!inspection) {
      setPhotosView({ id: attributionId, type, photos: [] });
      return;
    }
    const { data: photos } = await supabase
      .from("inspection_photos")
      .select("vue_type, url_photo, created_at")
      .eq("inspection_id", inspection.id)
      .order("created_at", { ascending: true });

    // Génère des signed URLs pour le bucket privé inspection-photos
    const enriched = await Promise.all(
      (photos ?? []).map(async (p) => {
        // url_photo peut déjà être une URL complète (ancien format) ou un path stockage
        if (/^https?:\/\//i.test(p.url_photo)) return p;
        const { data: signed } = await supabase.storage
          .from("inspection-photos")
          .createSignedUrl(p.url_photo, 3600);
        return { ...p, url_photo: signed?.signedUrl ?? p.url_photo };
      })
    );
    setPhotosView({ id: attributionId, type, photos: enriched });
  };

  return (
    <div>
      <PageHeader
        title="Attributions"
        subtitle={`${attributions.length} attribution${attributions.length > 1 ? "s" : ""}`}
        actions={
          <>
            <Button
              icon={<Plus size={14} />}
              onClick={() => {
                fetchOptions();
                setShowCreate(true);
              }}
            >
              Attribuer un trajet
            </Button>
            <IconButton onClick={fetchAttributions} title="Actualiser">
              <RefreshCw size={15} />
            </IconButton>
          </>
        }
      />

      {attributions.length === 0 ? (
        <EmptyState icon={Send} title="Aucune attribution" description="Attribuez un trajet à un convoyeur pour commencer." />
      ) : (
        <div className="space-y-3">
          {attributions.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-pro-text font-medium">
                    {a.trajet ? `${a.trajet.depart} → ${a.trajet.arrivee}` : a.trajet_id.slice(0, 8)}
                  </p>
                  <p className="text-pro-muted text-xs mt-0.5">
                    Convoyeur :{" "}
                    <span className="text-pro-text-soft">
                      {a.convoyeur ? `${a.convoyeur.prenom} ${a.convoyeur.nom}` : "—"}
                    </span>
                    {a.trajet?.date_trajet && (
                      <> · {new Date(a.trajet.date_trajet).toLocaleDateString("fr-FR")}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={attributionStatutTone[a.statut] ?? "neutral"}>
                    {statutLabels[a.statut] ?? a.statut}
                  </Badge>
                  {renderAttributionActions(a)}
                  <IconButton
                    onClick={() => setSelectedAttr(a)}
                    title="Ouvrir la fiche mission"
                    tone="primary"
                  >
                    <Eye size={15} />
                  </IconButton>
                  <IconButton onClick={() => viewGps(a.id)} title="Suivi GPS" tone="primary">
                    <MapPin size={15} />
                  </IconButton>
                  <IconButton onClick={() => viewPhotos(a.id, "depart")} title="Photos départ" tone="primary">
                    <Eye size={15} />
                  </IconButton>
                  <IconButton onClick={() => viewPhotos(a.id, "arrivee")} title="Photos arrivée" tone="success">
                    <Image size={15} />
                  </IconButton>
                  <IconButton onClick={() => setReportId(a.id)} title="Rapport mission" tone="primary">
                    <FileText size={15} />
                  </IconButton>
                  {(a.statut === "termine" || a.statut === "validee") && (
                    <IconButton
                      onClick={() => handleEmitFacture(a)}
                      title="Émettre la facture"
                      tone="success"
                      disabled={invoicingId === a.id}
                    >
                      {invoicingId === a.id ? <Loader2 size={15} className="animate-spin" /> : <Receipt size={15} />}
                    </IconButton>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-pro-border">
                <button
                  onClick={() => setExpandedDocs(expandedDocs === a.id ? null : a.id)}
                  className="flex items-center gap-1.5 text-xs text-pro-text-soft hover:text-pro-accent transition-colors"
                >
                  <FileText size={12} />
                  Documents
                  <span className="text-[10px] ml-1">{expandedDocs === a.id ? "▲" : "▼"}</span>
                </button>
                {expandedDocs === a.id && (
                  <div className="mt-2">
                    <MissionDocuments attributionId={a.id} userId="" isAdmin />
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Étape 1 : choix du trajet à assigner */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Choisir un trajet à attribuer" size="md">
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {trajetsDisponibles.length === 0 ? (
            <p className="text-sm text-pro-muted text-center py-6">Aucun trajet en attente.</p>
          ) : (
            trajetsDisponibles.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setAssignTrajet(t);
                  setShowCreate(false);
                }}
                className="w-full text-left p-3 rounded-xl border border-pro-border hover:border-pro-gold/40 hover:bg-pro-bg-soft/50 transition-all"
              >
                <p className="font-medium text-pro-text">
                  {t.depart} → {t.arrivee}
                </p>
                <p className="text-xs text-pro-text-soft mt-0.5">
                  {t.date_trajet
                    ? new Date(t.date_trajet).toLocaleDateString("fr-FR")
                    : "Date à définir"}{" "}
                  · {statutLabels[t.statut] ?? t.statut}
                </p>
              </button>
            ))
          )}
        </div>
      </Modal>

      {/* Étape 2 : assignation premium */}
      {assignTrajet && (
        <AssignDriverDialog
          open={!!assignTrajet}
          onClose={() => setAssignTrajet(null)}
          trip={{
            id: assignTrajet.id,
            depart: assignTrajet.depart,
            arrivee: assignTrajet.arrivee,
            date: assignTrajet.date_trajet,
            source: "trajet",
          }}
          onAssigned={(t) => {
            toast.success(`Trajet assigné à ${t.label}`);
            fetchAttributions();
            fetchOptions();
          }}
        />
      )}

      {/* GPS modal */}
      <Modal open={!!gpsView} onClose={() => setGpsView(null)} title="Suivi GPS en temps réel" size="lg">
        {gpsView && gpsView.points.length === 0 ? (
          <p className="text-pro-muted text-sm">Aucune position enregistrée.</p>
        ) : gpsView ? (
          <div className="space-y-3">
            <GpsMapView points={gpsView.points} className="h-[400px]" />
            <div className="flex items-center justify-between text-xs text-pro-text-soft">
              <span>{gpsView.points.length} position(s) enregistrée(s)</span>
              <a
                href={`https://www.google.com/maps/dir/${gpsView.points
                  .map((p) => `${p.latitude},${p.longitude}`)
                  .join("/")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-pro-accent hover:underline"
              >
                <MapPin size={12} /> Google Maps
              </a>
            </div>
            <div className="max-h-32 overflow-auto space-y-1">
              {gpsView.points
                .slice(-10)
                .reverse()
                .map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-xs text-pro-text-soft py-1.5 px-2 rounded bg-pro-bg-soft/50"
                  >
                    <Clock size={11} className="text-pro-accent shrink-0" />
                    <span>{new Date(p.recorded_at).toLocaleTimeString("fr-FR")}</span>
                    <span className="text-pro-muted">|</span>
                    <span>
                      {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                    </span>
                    {p.accuracy && <span className="text-pro-muted">±{Math.round(p.accuracy)}m</span>}
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Photos modal */}
      <Modal
        open={!!photosView}
        onClose={() => setPhotosView(null)}
        title={`Photos — État des lieux ${photosView?.type === "depart" ? "départ" : "arrivée"}`}
        size="lg"
      >
        {photosView && photosView.photos.length === 0 ? (
          <p className="text-pro-muted text-sm">Aucune photo pour cet état des lieux.</p>
        ) : photosView ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {photosView.photos.map((p) => (
              <div key={p.vue_type} className="space-y-1">
                <a href={p.url_photo} target="_blank" rel="noopener noreferrer">
                  <img
                    src={p.url_photo}
                    alt={vueLabelFor(p.vue_type)}
                    className="w-full aspect-[3/4] object-cover rounded-md border border-pro-border"
                  />
                </a>
                <p className="text-pro-text-soft text-xs text-center">
                  {vueLabelFor(p.vue_type)}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Modal>

      {/* Mission Report Modal */}
      {reportId && <MissionReport attributionId={reportId} onClose={() => setReportId(null)} />}

      {/* Drawer bleu — détail attribution */}
      {selectedAttr && (
        <AdminDetailDrawer
          open={!!selectedAttr}
          onClose={() => setSelectedAttr(null)}
          title={attrDetail?.numero_mission || `Mission ${selectedAttr.id.slice(0, 8)}`}
          subtitle={selectedAttr.trajet ? `${selectedAttr.trajet.depart} → ${selectedAttr.trajet.arrivee}` : undefined}
          badge={
            <DrawerBadge tone={selectedAttr.statut === "termine" || selectedAttr.statut === "validee" ? "green" : selectedAttr.statut === "en_cours" ? "blue" : "amber"}>
              {statutLabels[selectedAttr.statut] ?? selectedAttr.statut}
            </DrawerBadge>
          }
          footer={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setReportId(selectedAttr.id)} icon={<FileText size={12} />}>Rapport mission</Button>
              <Button size="sm" onClick={() => viewGps(selectedAttr.id)} icon={<MapPin size={12} />}>Suivi GPS</Button>
              <Button size="sm" onClick={() => viewPhotos(selectedAttr.id, "depart")} icon={<Image size={12} />}>Photos départ</Button>
              <Button size="sm" onClick={() => viewPhotos(selectedAttr.id, "arrivee")} icon={<Image size={12} />}>Photos arrivée</Button>
            </div>
          }
        >
          <DrawerSection title="Convoyeur" icon={<User size={12} />}>
            <DrawerGrid>
              <DrawerField label="Nom" value={selectedAttr.convoyeur ? `${selectedAttr.convoyeur.prenom} ${selectedAttr.convoyeur.nom}` : null} />
              <DrawerField label="Étape courante" value={attrDetail?.etape_courante} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title="Trajet" icon={<MapPin size={12} />}>
            <DrawerGrid>
              <DrawerField label="Départ" value={selectedAttr.trajet?.depart} />
              <DrawerField label="Arrivée" value={selectedAttr.trajet?.arrivee} />
              <DrawerField label="Date" value={selectedAttr.trajet?.date_trajet ? new Date(selectedAttr.trajet.date_trajet).toLocaleDateString("fr-FR") : null} />
              <DrawerField label="Prix client" value={attrDetail?.prix ? `${attrDetail.prix} €` : null} />
            </DrawerGrid>
          </DrawerSection>

          <DrawerSection title="Véhicule" icon={<Car size={12} />}>
            <DrawerGrid>
              <DrawerField label="Marque / modèle" value={[attrDetail?.marque, attrDetail?.modele].filter(Boolean).join(" ")} />
              <DrawerField label="Immatriculation" value={attrDetail?.immatriculation} mono />
              <DrawerField label="VIN" value={attrDetail?.vin} mono />
              <DrawerField label="Email client" value={attrDetail?.client_email} />
              <DrawerField label="Téléphone" value={attrDetail?.client_telephone} />
            </DrawerGrid>
            {(attrDetail?.cgRectoSigned || attrDetail?.cgVersoSigned) && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {attrDetail.cgRectoSigned && (
                  <a href={attrDetail.cgRectoSigned} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-white/10 hover:border-blue-400/50">
                    <img src={attrDetail.cgRectoSigned} alt="Carte grise recto" className="w-full h-32 object-cover" />
                    <p className="text-[10px] text-center text-white/60 py-1">Carte grise — recto</p>
                  </a>
                )}
                {attrDetail.cgVersoSigned && (
                  <a href={attrDetail.cgVersoSigned} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-white/10 hover:border-blue-400/50">
                    <img src={attrDetail.cgVersoSigned} alt="Carte grise verso" className="w-full h-32 object-cover" />
                    <p className="text-[10px] text-center text-white/60 py-1">Carte grise — verso</p>
                  </a>
                )}
              </div>
            )}
          </DrawerSection>

          <InspectionPreuvesBlock
            attributionId={selectedAttr.id}
            fallbackCarteGriseRecto={attrDetail?.carte_grise_recto_url}
            fallbackCarteGriseVerso={attrDetail?.carte_grise_verso_url}
            fallbackVin={attrDetail?.vin}
          />

          <DrawerSection title="Documents mission (uploads convoyeur)" icon={<FileText size={12} />}>
            <MissionDocuments attributionId={selectedAttr.id} userId="" isAdmin />
          </DrawerSection>
        </AdminDetailDrawer>
      )}
    </div>
  );
}
