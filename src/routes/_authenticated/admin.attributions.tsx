import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, RefreshCw, Eye, Clock, Image } from "lucide-react";

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
  propose: "Proposé", accepte: "Accepté", refuse: "Refusé",
  en_cours: "En cours", termine: "Terminé", annule: "Annulé",
};
const statutColors: Record<string, string> = {
  propose: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  accepte: "bg-green-500/20 text-green-300 border-green-500/30",
  refuse: "bg-red-500/20 text-red-300 border-red-500/30",
  en_cours: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  termine: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  annule: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

const vueLabels: Record<string, string> = {
  avant: "Avant", avant_droit: "Avant droit 3/4", cote_droit: "Côté droit",
  arriere_droit: "Arrière droit 3/4", arriere: "Arrière", arriere_gauche: "Arrière gauche 3/4",
  cote_gauche: "Côté gauche", avant_gauche: "Avant gauche 3/4",
  interieur_avant: "Intérieur avant", interieur_arriere: "Intérieur arrière", tableau_bord: "Tableau de bord",
};

function AdminAttributions() {
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [trajetsDisponibles, setTrajetsDisponibles] = useState<Trajet[]>([]);
  const [convoyeursValides, setConvoyeursValides] = useState<Convoyeur[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTrajet, setSelectedTrajet] = useState("");
  const [selectedConvoyeur, setSelectedConvoyeur] = useState("");
  const [gpsView, setGpsView] = useState<{ id: string; points: GpsPoint[] } | null>(null);
  const [photosView, setPhotosView] = useState<{ id: string; type: string; photos: InspectionPhoto[] } | null>(null);

  const fetchAttributions = useCallback(async () => {
    const { data } = await supabase
      .from("attributions")
      .select("*, trajet:trajets(depart, arrivee, date_trajet, statut), convoyeur:convoyeurs(nom, prenom)")
      .order("created_at", { ascending: false });
    if (data) setAttributions(data as unknown as Attribution[]);
  }, []);

  const fetchOptions = useCallback(async () => {
    const [trajets, convoyeurs] = await Promise.all([
      supabase.from("trajets").select("id, depart, arrivee, date_trajet, statut").in("statut", ["en_attente", "attribue"]),
      supabase.from("convoyeurs").select("id, nom, prenom, statut").eq("statut", "valide"),
    ]);
    if (trajets.data) setTrajetsDisponibles(trajets.data as Trajet[]);
    if (convoyeurs.data) setConvoyeursValides(convoyeurs.data as Convoyeur[]);
  }, []);

  useEffect(() => { fetchAttributions(); fetchOptions(); }, [fetchAttributions, fetchOptions]);

  // Realtime GPS updates
  useEffect(() => {
    const channel = supabase
      .channel("gps-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mission_locations" }, (payload) => {
        if (gpsView && payload.new.attribution_id === gpsView.id) {
          setGpsView(prev => prev ? {
            ...prev,
            points: [...prev.points, payload.new as unknown as GpsPoint],
          } : null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gpsView?.id]);

  const createAttribution = async () => {
    if (!selectedTrajet || !selectedConvoyeur) return;
    await supabase.from("attributions").insert({
      trajet_id: selectedTrajet, convoyeur_id: selectedConvoyeur, statut: "propose",
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
      .single();
    if (!inspection) return;
    const { data: photos } = await supabase
      .from("inspection_photos")
      .select("vue_type, url_photo, created_at")
      .eq("inspection_id", inspection.id);
    setPhotosView({ id: attributionId, type, photos: photos || [] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl text-primary tracking-[0.1em] uppercase">Attributions</h1>
          <p className="text-cream/50 text-sm mt-1">{attributions.length} attribution{attributions.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { fetchOptions(); setShowCreate(true); }} className="inline-flex items-center gap-2 px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded text-sm hover:bg-primary/20 transition-colors">
            + Attribuer
          </button>
          <button onClick={fetchAttributions} className="p-2 text-cream/50 hover:text-primary transition-colors"><RefreshCw size={16} /></button>
        </div>
      </div>

      {attributions.length === 0 ? (
        <div className="card-premium p-8 rounded text-center text-cream/40">Aucune attribution pour le moment.</div>
      ) : (
        <div className="space-y-3">
          {attributions.map((a) => (
            <div key={a.id} className="card-premium p-4 rounded">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-cream text-sm">
                    {a.trajet ? `${a.trajet.depart} → ${a.trajet.arrivee}` : a.trajet_id.slice(0, 8)}
                  </p>
                  <p className="text-cream/40 text-xs">
                    {a.convoyeur ? `${a.convoyeur.prenom} ${a.convoyeur.nom}` : "—"}
                    {a.trajet?.date_trajet ? ` · ${new Date(a.trajet.date_trajet).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select value={a.statut} onChange={(e) => updateStatut(a.id, e.target.value)}
                    className={`px-2 py-0.5 rounded text-xs border focus:outline-none appearance-none ${statutColors[a.statut] ?? "bg-primary/10 text-primary border-primary/20"}`}>
                    {Object.entries(statutLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button onClick={() => viewGps(a.id)} className="p-1.5 text-cream/40 hover:text-primary transition-colors" title="Voir GPS">
                    <MapPin size={14} />
                  </button>
                  <button onClick={() => viewPhotos(a.id, "depart")} className="p-1.5 text-cream/40 hover:text-blue-400 transition-colors" title="Photos départ">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => viewPhotos(a.id, "arrivee")} className="p-1.5 text-cream/40 hover:text-green-400 transition-colors" title="Photos arrivée">
                    <Image size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowCreate(false)}>
          <div className="card-premium rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading text-lg text-primary mb-4">Attribuer un trajet</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">Trajet *</label>
                <select value={selectedTrajet} onChange={(e) => setSelectedTrajet(e.target.value)}
                  className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none appearance-none">
                  <option value="">Sélectionner un trajet</option>
                  {trajetsDisponibles.map((t) => (
                    <option key={t.id} value={t.id}>{t.depart} → {t.arrivee} {t.date_trajet ? `(${new Date(t.date_trajet).toLocaleDateString("fr-FR")})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-cream/40 mb-1">Convoyeur *</label>
                <select value={selectedConvoyeur} onChange={(e) => setSelectedConvoyeur(e.target.value)}
                  className="w-full bg-navy/60 border border-primary/20 rounded px-3 py-2 text-cream text-sm focus:border-primary/60 focus:outline-none appearance-none">
                  <option value="">Sélectionner un convoyeur</option>
                  {convoyeursValides.map((c) => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom}</option>
                  ))}
                </select>
              </div>
              <button onClick={createAttribution} disabled={!selectedTrajet || !selectedConvoyeur}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground font-heading text-sm tracking-[0.1em] uppercase hover:bg-gold-light transition-colors disabled:opacity-50">
                Attribuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GPS View Modal */}
      {gpsView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setGpsView(null)}>
          <div className="card-premium rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-primary">Suivi GPS</h3>
              <button onClick={() => setGpsView(null)} className="text-cream/50 hover:text-cream">✕</button>
            </div>
            {gpsView.points.length === 0 ? (
              <p className="text-cream/50 text-sm">Aucune position enregistrée.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-cream/50 text-xs">{gpsView.points.length} position(s) enregistrée(s)</p>
                <div className="max-h-60 overflow-auto space-y-1">
                  {gpsView.points.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs text-cream/60 py-1 border-b border-primary/5">
                      <Clock size={10} className="text-primary shrink-0" />
                      <span>{new Date(p.recorded_at).toLocaleTimeString("fr-FR")}</span>
                      <span className="text-cream/30">|</span>
                      <span>{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</span>
                      {p.accuracy && <span className="text-cream/20">±{Math.round(p.accuracy)}m</span>}
                    </div>
                  ))}
                </div>
                {/* Simple map link */}
                <a
                  href={`https://www.google.com/maps/dir/${gpsView.points.map(p => `${p.latitude},${p.longitude}`).join("/")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:text-gold-light transition-colors"
                >
                  <MapPin size={12} /> Voir sur Google Maps
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photos View Modal */}
      {photosView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setPhotosView(null)}>
          <div className="card-premium rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg text-primary">
                Photos — État des lieux {photosView.type === "depart" ? "départ" : "arrivée"}
              </h3>
              <button onClick={() => setPhotosView(null)} className="text-cream/50 hover:text-cream">✕</button>
            </div>
            {photosView.photos.length === 0 ? (
              <p className="text-cream/50 text-sm">Aucune photo pour cet état des lieux.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {photosView.photos.map((p) => (
                  <div key={p.vue_type} className="space-y-1">
                    <a href={p.url_photo} target="_blank" rel="noopener noreferrer">
                      <img src={p.url_photo} alt={vueLabels[p.vue_type] || p.vue_type} className="w-full aspect-[3/4] object-cover rounded border border-primary/20" />
                    </a>
                    <p className="text-cream/50 text-xs text-center">{vueLabels[p.vue_type] || p.vue_type}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
