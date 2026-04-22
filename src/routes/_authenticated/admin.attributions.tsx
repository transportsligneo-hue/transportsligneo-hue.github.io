import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, RefreshCw, Eye, Clock, Image, FileText, Plus, Send } from "lucide-react";
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
  FormField,
  attributionStatutTone,
} from "@/components/admin/AdminUI";

export const Route = createFileRoute("/_authenticated/admin/attributions")({
  component: AdminAttributions,
});

interface Attribution {
  id: string;
  trajet_id: string;
  convoyeur_id: string;
  statut: string;
  created_at: string;
  trajet?: { depart: string; arrivee: string; date_trajet: string | null; statut: string };
  convoyeur?: { nom: string; prenom: string };
}

interface Trajet {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  statut: string;
}

interface Convoyeur {
  id: string;
  nom: string;
  prenom: string;
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
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [trajetsDisponibles, setTrajetsDisponibles] = useState<Trajet[]>([]);
  const [convoyeursValides, setConvoyeursValides] = useState<Convoyeur[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTrajet, setSelectedTrajet] = useState("");
  const [selectedConvoyeur, setSelectedConvoyeur] = useState("");
  const [gpsView, setGpsView] = useState<{ id: string; points: GpsPoint[] } | null>(null);
  const [photosView, setPhotosView] = useState<{ id: string; type: string; photos: InspectionPhoto[] } | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<string | null>(null);

  const fetchAttributions = useCallback(async () => {
    const { data } = await supabase
      .from("attributions")
      .select("*, trajet:trajets(depart, arrivee, date_trajet, statut), convoyeur:convoyeurs(nom, prenom)")
      .order("created_at", { ascending: false });
    if (data) setAttributions(data as unknown as Attribution[]);
  }, []);

  const fetchOptions = useCallback(async () => {
    const [trajets, convoyeurs] = await Promise.all([
      supabase
        .from("trajets")
        .select("id, depart, arrivee, date_trajet, statut")
        .in("statut", ["en_attente", "attribue"]),
      supabase.from("convoyeurs").select("id, nom, prenom, statut").eq("statut", "valide"),
    ]);
    if (trajets.data) setTrajetsDisponibles(trajets.data as Trajet[]);
    if (convoyeurs.data) setConvoyeursValides(convoyeurs.data as Convoyeur[]);
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

  const createAttribution = async () => {
    if (!selectedTrajet || !selectedConvoyeur) return;
    await supabase.from("attributions").insert({
      trajet_id: selectedTrajet,
      convoyeur_id: selectedConvoyeur,
      statut: "propose",
    });
    await supabase.from("trajets").update({ statut: "attribue" }).eq("id", selectedTrajet);
    setShowCreate(false);
    setSelectedTrajet("");
    setSelectedConvoyeur("");
    fetchAttributions();
    fetchOptions();
  };

  const updateStatut = async (id: string, statut: string) => {
    await supabase.from("attributions").update({ statut }).eq("id", id);
    fetchAttributions();
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
              Attribuer
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
                  <Select
                    value={a.statut}
                    onChange={(e) => updateStatut(a.id, e.target.value)}
                    className="text-xs py-1.5"
                  >
                    {Object.entries(statutLabels).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
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

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Attribuer un trajet" size="md">
        <div className="space-y-3">
          <FormField label="Trajet" required>
            <Select value={selectedTrajet} onChange={(e) => setSelectedTrajet(e.target.value)}>
              <option value="">Sélectionner un trajet</option>
              {trajetsDisponibles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.depart} → {t.arrivee}
                  {t.date_trajet ? ` (${new Date(t.date_trajet).toLocaleDateString("fr-FR")})` : ""}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Convoyeur" required>
            <Select value={selectedConvoyeur} onChange={(e) => setSelectedConvoyeur(e.target.value)}>
              <option value="">Sélectionner un convoyeur</option>
              {convoyeursValides.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.prenom} {c.nom}
                </option>
              ))}
            </Select>
          </FormField>
          <Button
            className="w-full"
            onClick={createAttribution}
            disabled={!selectedTrajet || !selectedConvoyeur}
            icon={<Send size={14} />}
          >
            Attribuer
          </Button>
        </div>
      </Modal>

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
    </div>
  );
}
