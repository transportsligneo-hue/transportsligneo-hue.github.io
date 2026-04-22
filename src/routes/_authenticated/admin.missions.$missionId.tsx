import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  MapPin,
  Car,
  User,
  Phone,
  Mail,
  Clock,
  Camera,
  FileText,
  PenTool,
  Activity,
  CheckCircle2,
  Circle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Send,
  Truck,
  ClipboardCheck,
} from "lucide-react";
import {
  Card,
  Badge,
  Button,
  IconButton,
  Select,
  attributionStatutTone,
} from "@/components/admin/AdminUI";
import { RoleBadge } from "@/components/brand/LigneoBrand";
import { GpsMapView } from "@/components/GpsMapView";
import { MissionDocuments } from "@/components/MissionDocuments";
import { MissionReport } from "@/components/MissionReport";

export const Route = createFileRoute("/_authenticated/admin/missions/$missionId")({
  component: AdminMissionDetail,
});

interface AttributionFull {
  id: string;
  trajet_id: string;
  convoyeur_id: string;
  statut: string;
  etape_courante: string | null;
  created_at: string;
  updated_at: string;
}

interface TrajetFull {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  statut: string;
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  client_nom: string | null;
  client_email: string | null;
  client_telephone: string | null;
  prix: number | null;
  notes_internes: string | null;
}

interface ConvoyeurFull {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  ville: string | null;
}

interface InspectionRow {
  id: string;
  type: string;
  statut: string;
  notes: string | null;
  created_at: string;
  photos: { vue_type: string; url_photo: string; created_at: string }[];
}

interface GpsPoint {
  latitude: number;
  longitude: number;
  recorded_at: string;
  accuracy: number | null;
}

interface DocRow {
  id: string;
  type_document: string;
  nom_fichier: string;
  created_at: string;
}

interface EtapeHistoryRow {
  id: string;
  etape: string;
  notes: string | null;
  created_at: string;
}

const statutLabels: Record<string, string> = {
  propose: "Proposé",
  accepte: "Accepté",
  refuse: "Refusé",
  en_cours: "En cours",
  termine: "Terminé",
  annule: "Annulé",
};

/** Étapes timeline mission */
const TIMELINE_STEPS: { key: string; label: string; icon: typeof Truck }[] = [
  { key: "propose", label: "Attribué", icon: Send },
  { key: "accepte", label: "Acceptée", icon: CheckCircle2 },
  { key: "en_cours", label: "En cours", icon: Truck },
  { key: "etat_lieux", label: "État des lieux", icon: ClipboardCheck },
  { key: "termine", label: "Terminée", icon: CheckCircle2 },
];

/** Numéro mission MIS-YYYY-XXXX dérivé déterministe depuis created_at + id */
function formatMissionNumber(id: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  // Convertit les 6 derniers caractères hex de l'UUID en nombre 4 chiffres
  const hex = id.replace(/-/g, "").slice(-6);
  const num = (parseInt(hex, 16) % 9999) + 1;
  return `MIS-${year}-${String(num).padStart(4, "0")}`;
}

const vueLabels: Record<string, string> = {
  trois_quart_avant_gauche: "01. 3/4 avant gauche",
  jante_avant_gauche: "02. Jante avant gauche",
  jante_arriere_gauche: "03. Jante arrière gauche",
  trois_quart_arriere_gauche: "04. 3/4 arrière gauche",
  arriere: "05. Arrière",
  coffre_ouvert: "06. Coffre ouvert",
  roue_secours: "07. Roue de secours / kit",
  trois_quart_arriere_droite: "08. 3/4 arrière droite",
  jante_arriere_droite: "09. Jante arrière droite",
  siege_arriere: "10. Sièges arrière",
  jante_avant_droite: "11. Jante avant droite",
  trois_quart_avant_droite: "12. 3/4 avant droite",
  siege_avant: "13. Sièges avant",
  compteur: "14. Compteur (km + carburant)",
  kit_securite: "15. Kit sécurité",
  pv_livraison: "16. PV livraison / restitution",
  carte_grise: "17. Carte grise",
  signature: "18. Signature client",
};

function vueLabelFor(vueType: string): string {
  if (vueLabels[vueType]) return vueLabels[vueType];
  const m = vueType.match(/^([a-z_]+?)(?:_\d{10,})?$/);
  if (m && vueLabels[m[1]]) return vueLabels[m[1]];
  return vueType;
}

function AdminMissionDetail() {
  const { missionId } = Route.useParams();
  const navigate = useNavigate();

  const [attribution, setAttribution] = useState<AttributionFull | null>(null);
  const [trajet, setTrajet] = useState<TrajetFull | null>(null);
  const [convoyeur, setConvoyeur] = useState<ConvoyeurFull | null>(null);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [gpsPoints, setGpsPoints] = useState<GpsPoint[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [history, setHistory] = useState<EtapeHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data: attr, error: attrErr } = await supabase
      .from("attributions")
      .select("id, trajet_id, convoyeur_id, statut, etape_courante, created_at, updated_at")
      .eq("id", missionId)
      .maybeSingle();

    if (attrErr || !attr) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setAttribution(attr as AttributionFull);

    const [trajRes, convRes, inspRes, gpsRes, docsRes, histRes] = await Promise.all([
      supabase.from("trajets").select("*").eq("id", attr.trajet_id).maybeSingle(),
      supabase
        .from("convoyeurs")
        .select("nom, prenom, email, telephone, ville")
        .eq("id", attr.convoyeur_id)
        .maybeSingle(),
      supabase
        .from("inspections")
        .select("id, type, statut, notes, created_at")
        .eq("attribution_id", missionId)
        .order("created_at", { ascending: true }),
      supabase
        .from("mission_locations")
        .select("latitude, longitude, recorded_at, accuracy")
        .eq("attribution_id", missionId)
        .order("recorded_at", { ascending: true }),
      supabase
        .from("mission_documents")
        .select("id, type_document, nom_fichier, created_at")
        .eq("attribution_id", missionId)
        .order("created_at", { ascending: false }),
      supabase
        .from("mission_etape_history")
        .select("id, etape, notes, created_at")
        .eq("attribution_id", missionId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (trajRes.data) setTrajet(trajRes.data as TrajetFull);
    if (convRes.data) setConvoyeur(convRes.data as ConvoyeurFull);
    if (gpsRes.data) setGpsPoints(gpsRes.data as GpsPoint[]);
    if (docsRes.data) setDocuments(docsRes.data as DocRow[]);
    if (histRes.data) setHistory(histRes.data as EtapeHistoryRow[]);
    if (trajRes.data?.notes_internes) setAdminNote(trajRes.data.notes_internes);

    // Photos par inspection (avec signed URLs)
    const inspWithPhotos: InspectionRow[] = [];
    for (const insp of inspRes.data ?? []) {
      const { data: photos } = await supabase
        .from("inspection_photos")
        .select("vue_type, url_photo, created_at")
        .eq("inspection_id", insp.id)
        .order("created_at", { ascending: true });
      const enriched = await Promise.all(
        (photos ?? []).map(async (p) => {
          if (/^https?:\/\//i.test(p.url_photo)) return p;
          const { data: signed } = await supabase.storage
            .from("inspection-photos")
            .createSignedUrl(p.url_photo, 3600);
          return { ...p, url_photo: signed?.signedUrl ?? p.url_photo };
        }),
      );
      inspWithPhotos.push({ ...(insp as Omit<InspectionRow, "photos">), photos: enriched });
    }
    setInspections(inspWithPhotos);
    setLoading(false);
  }, [missionId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime GPS
  useEffect(() => {
    const channel = supabase
      .channel(`mission-detail-${missionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mission_locations" },
        (payload) => {
          if (payload.new.attribution_id === missionId) {
            setGpsPoints((prev) => [...prev, payload.new as unknown as GpsPoint]);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mission_etape_history" },
        (payload) => {
          if (payload.new.attribution_id === missionId) {
            setHistory((prev) => [payload.new as unknown as EtapeHistoryRow, ...prev].slice(0, 20));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [missionId]);

  const updateStatut = async (statut: string) => {
    if (!attribution) return;
    await supabase.from("attributions").update({ statut }).eq("id", attribution.id);
    setAttribution({ ...attribution, statut });
  };

  const saveAdminNote = async () => {
    if (!trajet) return;
    setSavingNote(true);
    await supabase.from("trajets").update({ notes_internes: adminNote }).eq("id", trajet.id);
    setSavingNote(false);
  };

  // Signature = dernière photo "signature"
  const signaturePhoto = useMemo(() => {
    for (const insp of inspections) {
      const sig = insp.photos.find((p) => p.vue_type === "signature" || p.vue_type.startsWith("signature_"));
      if (sig) return { url: sig.url_photo, at: sig.created_at, type: insp.type };
    }
    return null;
  }, [inspections]);

  // Activité = dernier point GPS + dernière étape
  const lastGps = gpsPoints.length ? gpsPoints[gpsPoints.length - 1] : null;
  const lastEtape = history[0];

  // Index timeline courant
  const currentStepIndex = useMemo(() => {
    if (!attribution) return 0;
    if (attribution.statut === "termine") return TIMELINE_STEPS.length - 1;
    if (attribution.statut === "en_cours") {
      const hasInsp = inspections.length > 0;
      return hasInsp ? 3 : 2;
    }
    if (attribution.statut === "accepte") return 1;
    return 0;
  }, [attribution, inspections.length]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-pro-accent" size={32} />
      </div>
    );
  }

  if (notFound || !attribution || !trajet) {
    return (
      <Card>
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto text-amber-500 mb-3" size={32} />
          <p className="text-pro-text font-medium">Mission introuvable</p>
          <p className="text-pro-muted text-sm mt-1">
            La référence demandée n'existe pas ou a été supprimée.
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            icon={<ArrowLeft size={14} />}
            onClick={() => navigate({ to: "/admin/attributions" })}
          >
            Retour aux attributions
          </Button>
        </div>
      </Card>
    );
  }

  const missionNumber = formatMissionNumber(attribution.id, attribution.created_at);
  const isB2B = !!trajet.client_nom && trajet.client_nom.length > 0; // simple heuristique
  const lastUpdate = new Date(attribution.updated_at).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-5">
      {/* === Back === */}
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/admin/attributions"
          className="inline-flex items-center gap-1.5 text-sm text-pro-text-soft hover:text-pro-accent transition-colors"
        >
          <ArrowLeft size={14} />
          Toutes les missions
        </Link>
        <IconButton onClick={fetchAll} title="Rafraîchir" tone="primary">
          <RefreshCw size={15} />
        </IconButton>
      </div>

      {/* === Header mission === */}
      <Card>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold text-pro-text font-heading tracking-wide">
                {missionNumber}
              </h1>
              <Badge tone={attributionStatutTone[attribution.statut] ?? "neutral"}>
                {statutLabels[attribution.statut] ?? attribution.statut}
              </Badge>
              <RoleBadge role={isB2B ? "partner" : "client"} />
              <RoleBadge role="driver" />
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2 text-pro-text-soft">
                <Car size={14} className="text-pro-muted" />
                <span className="truncate">
                  {trajet.marque || trajet.modele
                    ? `${trajet.marque ?? ""} ${trajet.modele ?? ""}`.trim()
                    : "Véhicule —"}
                  {trajet.immatriculation && (
                    <span className="text-pro-muted ml-1">· {trajet.immatriculation}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2 text-pro-text-soft">
                <User size={14} className="text-pro-muted" />
                <span className="truncate">
                  {convoyeur ? `${convoyeur.prenom} ${convoyeur.nom}` : "Convoyeur —"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-pro-text-soft">
                <Clock size={14} className="text-pro-muted" />
                <span className="truncate">MAJ {lastUpdate}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Select
              value={attribution.statut}
              onChange={(e) => updateStatut(e.target.value)}
              className="text-xs py-1.5"
            >
              {Object.entries(statutLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              icon={<FileText size={14} />}
              onClick={() => setReportOpen(true)}
            >
              Rapport complet
            </Button>
          </div>
        </div>
      </Card>

      {/* === Timeline progression === */}
      <Card>
        <h3 className="text-sm font-semibold text-pro-text-soft uppercase tracking-wider mb-4">
          Progression
        </h3>
        <ol className="flex items-center justify-between gap-2">
          {TIMELINE_STEPS.map((step, idx) => {
            const active = idx <= currentStepIndex;
            const current = idx === currentStepIndex;
            const Icon = step.icon;
            return (
              <li key={step.key} className="flex-1 flex flex-col items-center text-center">
                <div className="flex items-center w-full">
                  <span
                    className={`h-0.5 flex-1 ${
                      idx === 0 ? "opacity-0" : active ? "bg-pro-accent" : "bg-pro-border"
                    }`}
                  />
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                      current
                        ? "role-admin-bg text-white border-transparent"
                        : active
                        ? "bg-pro-accent text-white border-pro-accent"
                        : "bg-white text-pro-muted border-pro-border"
                    }`}
                  >
                    {active ? <Icon size={15} /> : <Circle size={12} />}
                  </span>
                  <span
                    className={`h-0.5 flex-1 ${
                      idx === TIMELINE_STEPS.length - 1
                        ? "opacity-0"
                        : idx < currentStepIndex
                        ? "bg-pro-accent"
                        : "bg-pro-border"
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] sm:text-xs mt-1.5 uppercase tracking-wider ${
                    active ? "text-pro-text font-semibold" : "text-pro-muted"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* === Grid principal === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Colonne gauche : trajet + client + convoyeur */}
        <div className="space-y-5 lg:col-span-2">
          {/* Trajet */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Trajet
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-pro-accent" />
                  <span className="w-px flex-1 bg-pro-border min-h-[24px]" />
                  <span className="w-2.5 h-2.5 rounded-full role-driver-bg" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-pro-muted">Départ</p>
                    <p className="text-pro-text text-sm">{trajet.depart}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-pro-muted">Arrivée</p>
                    <p className="text-pro-text text-sm">{trajet.arrivee}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t border-pro-border">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-pro-muted">Date</p>
                  <p className="text-pro-text">
                    {trajet.date_trajet
                      ? new Date(trajet.date_trajet).toLocaleDateString("fr-FR")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-pro-muted">Heure</p>
                  <p className="text-pro-text">{trajet.heure_trajet || "—"}</p>
                </div>
                {trajet.prix !== null && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-pro-muted">Prix</p>
                    <p className="text-pro-text">{trajet.prix} €</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Photos état des lieux */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Camera size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Photos état des lieux
              </h3>
            </div>
            {inspections.length === 0 ? (
              <p className="text-pro-muted text-sm">Aucun état des lieux pour le moment.</p>
            ) : (
              <div className="space-y-5">
                {inspections.map((insp) => (
                  <div key={insp.id}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-pro-text text-sm font-medium">
                        {insp.type === "depart" ? "État des lieux — Départ" : "État des lieux — Arrivée"}
                      </p>
                      <Badge tone={insp.statut === "complete" ? "success" : "warning"}>
                        {insp.statut === "complete" ? "Complété" : insp.statut}
                      </Badge>
                    </div>
                    {insp.photos.length === 0 ? (
                      <p className="text-pro-muted text-xs">Aucune photo.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {insp.photos
                          .filter((p) => !p.vue_type.startsWith("signature"))
                          .map((p, idx) => (
                            <a
                              key={`${p.vue_type}-${idx}`}
                              href={p.url_photo}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block group"
                            >
                              <img
                                src={p.url_photo}
                                alt={vueLabelFor(p.vue_type)}
                                loading="lazy"
                                className="w-full aspect-[3/4] object-cover rounded-md border border-pro-border group-hover:border-pro-accent transition-colors"
                              />
                              <p className="text-pro-text-soft text-[10px] mt-1 truncate">
                                {vueLabelFor(p.vue_type)}
                              </p>
                            </a>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Documents */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Documents ({documents.length})
              </h3>
            </div>
            <MissionDocuments attributionId={attribution.id} userId="" isAdmin />
          </Card>

          {/* Signature */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <PenTool size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Signature client
              </h3>
            </div>
            {signaturePhoto ? (
              <div className="space-y-2">
                <a href={signaturePhoto.url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={signaturePhoto.url}
                    alt="Signature client"
                    className="bg-white max-h-48 rounded-md border border-pro-border"
                  />
                </a>
                <p className="text-pro-muted text-xs">
                  Signée le {new Date(signaturePhoto.at).toLocaleString("fr-FR")} ·{" "}
                  {signaturePhoto.type === "depart" ? "Départ" : "Arrivée"}
                </p>
              </div>
            ) : (
              <p className="text-pro-muted text-sm">Aucune signature enregistrée.</p>
            )}
          </Card>
        </div>

        {/* Colonne droite : convoyeur + client + GPS + activité + admin */}
        <div className="space-y-5">
          {/* Convoyeur */}
          {convoyeur && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <RoleBadge role="driver" />
                <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                  Convoyeur
                </h3>
              </div>
              <p className="text-pro-text font-medium">
                {convoyeur.prenom} {convoyeur.nom}
              </p>
              {convoyeur.ville && (
                <p className="text-pro-muted text-xs">{convoyeur.ville}</p>
              )}
              <div className="mt-3 space-y-1.5 text-sm">
                <a
                  href={`mailto:${convoyeur.email}`}
                  className="flex items-center gap-2 text-pro-text-soft hover:text-pro-accent transition-colors"
                >
                  <Mail size={13} /> {convoyeur.email}
                </a>
                <a
                  href={`tel:${convoyeur.telephone}`}
                  className="flex items-center gap-2 text-pro-text-soft hover:text-pro-accent transition-colors"
                >
                  <Phone size={13} /> {convoyeur.telephone}
                </a>
              </div>
            </Card>
          )}

          {/* Client */}
          {trajet.client_nom && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <RoleBadge role={isB2B ? "partner" : "client"} />
                <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                  {isB2B ? "Partenaire" : "Client"}
                </h3>
              </div>
              <p className="text-pro-text font-medium">{trajet.client_nom}</p>
              <div className="mt-3 space-y-1.5 text-sm">
                {trajet.client_email && (
                  <a
                    href={`mailto:${trajet.client_email}`}
                    className="flex items-center gap-2 text-pro-text-soft hover:text-pro-accent transition-colors"
                  >
                    <Mail size={13} /> {trajet.client_email}
                  </a>
                )}
                {trajet.client_telephone && (
                  <a
                    href={`tel:${trajet.client_telephone}`}
                    className="flex items-center gap-2 text-pro-text-soft hover:text-pro-accent transition-colors"
                  >
                    <Phone size={13} /> {trajet.client_telephone}
                  </a>
                )}
              </div>
            </Card>
          )}

          {/* GPS live */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-pro-accent" />
                <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                  Suivi GPS
                </h3>
              </div>
              {gpsPoints.length > 0 && (
                <Badge tone="info">{gpsPoints.length} pts</Badge>
              )}
            </div>
            {gpsPoints.length === 0 ? (
              <p className="text-pro-muted text-sm">Pas de position enregistrée.</p>
            ) : (
              <div className="space-y-2">
                <GpsMapView points={gpsPoints} className="h-44 rounded-md overflow-hidden" />
                {lastGps && (
                  <p className="text-pro-muted text-xs flex items-center gap-1.5">
                    <Clock size={11} />
                    Dernier point : {new Date(lastGps.recorded_at).toLocaleTimeString("fr-FR")}
                  </p>
                )}
                <a
                  href={`https://www.google.com/maps/dir/${gpsPoints
                    .map((p) => `${p.latitude},${p.longitude}`)
                    .join("/")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-pro-accent hover:underline"
                >
                  <ExternalLink size={11} /> Ouvrir dans Google Maps
                </a>
              </div>
            )}
          </Card>

          {/* Activité live */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={15} className="text-pro-accent" />
              <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider">
                Activité
              </h3>
            </div>
            {history.length === 0 && !lastGps ? (
              <p className="text-pro-muted text-sm">Aucune activité récente.</p>
            ) : (
              <ul className="space-y-2">
                {lastEtape && (
                  <li className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-pro-text">Étape : {lastEtape.etape}</p>
                      <p className="text-pro-muted text-xs">
                        {new Date(lastEtape.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  </li>
                )}
                {history.slice(1, 5).map((h) => (
                  <li key={h.id} className="flex items-start gap-2 text-sm">
                    <Circle size={10} className="text-pro-muted mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-pro-text-soft">{h.etape}</p>
                      <p className="text-pro-muted text-xs">
                        {new Date(h.created_at).toLocaleTimeString("fr-FR")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Note admin */}
          <Card>
            <h3 className="text-sm font-semibold text-pro-text uppercase tracking-wider mb-2">
              Note interne admin
            </h3>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Notes visibles uniquement par les admins…"
              rows={4}
              className="w-full px-3 py-2 bg-white border border-pro-border rounded-md text-sm text-pro-text placeholder:text-pro-muted focus:border-pro-accent focus:ring-2 focus:ring-pro-accent/20 focus:outline-none resize-none"
            />
            <Button
              size="sm"
              className="mt-2"
              onClick={saveAdminNote}
              disabled={savingNote}
              icon={savingNote ? <Loader2 size={12} className="animate-spin" /> : null}
            >
              Enregistrer
            </Button>
          </Card>
        </div>
      </div>

      {/* Rapport */}
      {reportOpen && (
        <MissionReport attributionId={attribution.id} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}
