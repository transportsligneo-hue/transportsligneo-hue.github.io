import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MissionStatusBadge } from "@/components/admin/MissionStatusBadge";
import {
  MapPin, Calendar, Car, Euro, Clock, Search, Filter, Loader2, Send,
  Sparkles, Zap, ArrowLeftRight, Route as RouteIcon,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/convoyeur/catalogue")({
  component: ConvoyeurCatalogue,
});

interface CatalogTrajet {
  id: string;
  depart: string;
  arrivee: string;
  date_trajet: string | null;
  heure_trajet: string | null;
  marque: string | null;
  modele: string | null;
  distance_km: number | null;
  duree_estimee_min: number | null;
  prix_convoyeur_fixe: number | null;
  prix_convoyeur: number | null;
  prix_suggere: number | null;
  attribution_mode: "direct" | "catalogue" | "mixte";
  allow_counter_offer: boolean;
  proposal_expires_at: string | null;
  urgence: string | null;
  leg_type: string | null;
  mission_group_id: string | null;
  created_at: string;
  published_at: string | null;
}

interface MyOffer {
  id: string; trajet_id: string; statut: string; prix_propose: number; type_offre: string;
}

function isLongDistance(km: number | null | undefined) { return (km ?? 0) >= 400; }
function isRecent(iso: string | null) { return iso ? Date.now() - new Date(iso).getTime() < 24 * 3600 * 1000 : false; }

function ConvoyeurCatalogue() {
  const { user, convoyeurStatut } = useAuth();
  const validated = convoyeurStatut === "valide" || convoyeurStatut === "actif";
  const [hasTraining, setHasTraining] = useState(false);
  const [trajets, setTrajets] = useState<CatalogTrajet[]>([]);
  const [myOffers, setMyOffers] = useState<Record<string, MyOffer>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [maxKm, setMaxKm] = useState<string>("");
  const [minPrix, setMinPrix] = useState<string>("");
  const [sort, setSort] = useState<"prix" | "distance" | "date">("date");
  const [openId, setOpenId] = useState<string | null>(null);
  const [prix, setPrix] = useState("");
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("convoyeurs").select("id, has_completed_training").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const row = data as { id?: string; has_completed_training?: boolean } | null;
        setConvoyeurId(row?.id ?? null);
        setHasTraining(Boolean(row?.has_completed_training));
      });
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("trajets")
      .select("id,depart,arrivee,date_trajet,heure_trajet,marque,modele,distance_km,duree_estimee_min,prix_convoyeur_fixe,prix_convoyeur,prix_suggere,attribution_mode,allow_counter_offer,proposal_expires_at,urgence,leg_type,mission_group_id,created_at,published_at")
      .in("attribution_mode", ["catalogue", "mixte"])
      .eq("statut_publication", "publie")
      .order("published_at", { ascending: false })
      .limit(200);
    if (!error && data) setTrajets(data as unknown as CatalogTrajet[]);

    if (convoyeurId) {
      const { data: offers } = await supabase
        .from("mission_offres")
        .select("id,trajet_id,statut,prix_propose,type_offre")
        .eq("convoyeur_id", convoyeurId)
        .in("statut", ["en_attente", "contre_offre_admin", "accepte"]);
      const map: Record<string, MyOffer> = {};
      (offers ?? []).forEach((o) => { map[(o as MyOffer).trajet_id] = o as MyOffer; });
      setMyOffers(map);
    }
    setLoading(false);
  };

  useEffect(() => { if (convoyeurId) fetchData(); }, [convoyeurId]);

  useEffect(() => {
    if (!convoyeurId) return;
    const ch = supabase
      .channel("catalogue-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "trajets" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_offres" }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoyeurId]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const km = maxKm ? Number(maxKm) : null;
    const prixMin = minPrix ? Number(minPrix) : null;
    return trajets
      .filter((t) => {
        const price = t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? 0;
        if (s && !`${t.depart} ${t.arrivee} ${t.marque ?? ""} ${t.modele ?? ""}`.toLowerCase().includes(s)) return false;
        if (km && (t.distance_km ?? 0) > km) return false;
        if (prixMin && price < prixMin) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "prix") return (b.prix_convoyeur_fixe ?? b.prix_convoyeur ?? 0) - (a.prix_convoyeur_fixe ?? a.prix_convoyeur ?? 0);
        if (sort === "distance") return (a.distance_km ?? 0) - (b.distance_km ?? 0);
        return new Date(b.published_at ?? b.created_at).getTime() - new Date(a.published_at ?? a.created_at).getTime();
      });
  }, [trajets, search, maxKm, minPrix, sort]);

  const openMission = (t: CatalogTrajet) => {
    setOpenId(t.id);
    setPrix(String(t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? ""));
    setMsg("");
  };

  const submitApplication = async () => {
    if (!openId) return;
    const t = trajets.find((x) => x.id === openId);
    if (!t) return;
    if (!hasTraining) {
      toast.error("Formation obligatoire à terminer avant de candidater.");
      return;
    }
    const suggested = t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? 0;
    const val = prix ? Number(prix) : suggested;
    if (!Number.isFinite(val) || val <= 0) { toast.error("Prix invalide"); return; }
    if (val !== suggested && !t.allow_counter_offer) {
      toast.error("Les contre-offres ne sont pas autorisées sur cette mission");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("driver_apply_to_mission", {
      _trajet_id: openId,
      _proposed_price: val,
      _message: msg || undefined,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(val === suggested ? "Candidature envoyée !" : "Contre-offre envoyée !");
    setOpenId(null); setPrix(""); setMsg("");
    fetchData();
  };

  if (!validated) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center rounded-2xl border border-amber-200 bg-amber-50">
        <p className="text-amber-900 font-semibold">Votre compte doit être validé pour candidater aux missions.</p>
        <p className="text-amber-800/80 text-sm mt-2">Complétez vos documents dans l'onglet "Documents".</p>
      </div>
    );
  }

  const canApply = validated && hasTraining;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-pro-text flex items-center gap-2">
            <Sparkles className="text-pro-gold" size={22} /> Catalogue des missions
          </h1>
          <p className="text-sm text-pro-text-soft mt-1">
            Missions publiques disponibles. Postulez au tarif proposé ou faites une contre-offre.
          </p>
        </div>
        {!hasTraining && (
          <Link
            to="/convoyeur/formation"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100 transition-colors"
          >
            <strong>Formation obligatoire à finaliser.</strong> Terminez les modules avant de postuler aux missions.
          </Link>
        )}
        <div className="text-xs text-pro-muted flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Temps réel
        </div>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 rounded-xl border border-pro-border bg-white shadow-pro-card">
        <div className="md:col-span-2 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pro-muted" />
          <input placeholder="Ville, marque, modèle…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-pro-border text-sm focus:ring-2 focus:ring-pro-gold/40" />
        </div>
        <input type="number" placeholder="Distance max (km)" value={maxKm} onChange={(e) => setMaxKm(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-pro-border text-sm" />
        <input type="number" placeholder="Prix min (€)" value={minPrix} onChange={(e) => setMinPrix(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-pro-border text-sm" />
        <select value={sort} onChange={(e) => setSort(e.target.value as "prix" | "distance" | "date")}
          className="w-full px-3 py-2 rounded-lg border border-pro-border text-sm">
          <option value="date">Tri : Plus récentes</option>
          <option value="prix">Tri : Rémunération</option>
          <option value="distance">Tri : Distance</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-pro-gold" size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-pro-text-soft rounded-xl border border-dashed border-pro-border bg-white">
          <RouteIcon className="mx-auto mb-3 text-pro-muted" size={32} />
          Aucune mission disponible pour ces critères.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const price = t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? 0;
            const mine = myOffers[t.id];
            const isAR = t.leg_type && t.leg_type !== "simple";
            const urgent = t.urgence === "immediat" || t.urgence === "urgent";
            const longDist = isLongDistance(t.distance_km);
            const fresh = isRecent(t.published_at);
            return (
              <div key={t.id} className="group relative rounded-2xl border border-pro-border bg-white p-5 hover:shadow-pro-elevated transition-all overflow-hidden">
                {fresh && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-sm animate-pulse">
                    NOUVELLE
                  </span>
                )}

                <div className="flex flex-wrap items-center gap-1.5 mb-3">
                  {urgent && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1"><Zap size={10} /> URGENT</span>}
                  {isAR && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1"><ArrowLeftRight size={10} /> A/R</span>}
                  {longDist && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-700 border border-violet-200">LONGUE DISTANCE</span>}
                  {t.allow_counter_offer && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">Contre-offre ✓</span>}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin size={15} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-pro-text truncate">{t.depart}</div>
                      <div className="text-pro-text-soft text-xs">↓</div>
                      <div className="font-semibold text-pro-text truncate">{t.arrivee}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-pro-text-soft pt-1">
                    {t.date_trajet && <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(t.date_trajet).toLocaleDateString("fr-FR")}</span>}
                    {t.heure_trajet && <span className="flex items-center gap-1"><Clock size={12} /> {t.heure_trajet}</span>}
                    {t.distance_km && <span>· {Math.round(t.distance_km)} km</span>}
                  </div>
                  {(t.marque || t.modele) && (
                    <div className="flex items-center gap-1.5 text-xs text-pro-text-soft">
                      <Car size={12} /> {[t.marque, t.modele].filter(Boolean).join(" ")}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-pro-border flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-pro-muted">Rémunération</div>
                    <div className="text-2xl font-bold text-pro-text flex items-center gap-1">
                      {price.toFixed(0)} <Euro size={16} className="text-pro-gold" />
                    </div>
                  </div>
                  {mine ? (
                    <div className="text-right">
                      <MissionStatusBadge status={mine.statut === "contre_offre_admin" ? "propose" : mine.statut} short />
                      <div className="text-[10px] text-pro-muted mt-1">{mine.prix_propose.toFixed(0)} €</div>
                    </div>
                  ) : (
                    <button onClick={() => canApply ? openMission(t) : toast.error("Formation obligatoire à terminer avant de candidater.")}
                      className="px-4 py-2 rounded-lg bg-pro-brand-strip text-white text-sm font-semibold hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50"
                      disabled={!canApply}
                      title={!canApply ? "Formation obligatoire" : undefined}>
                      <Send size={14} /> Postuler
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal candidature */}
      {openId && (() => {
        const t = trajets.find((x) => x.id === openId);
        if (!t) return null;
        const suggested = t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? 0;
        return (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setOpenId(null)}>
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-lg text-pro-text mb-1">Postuler à cette mission</h3>
              <p className="text-sm text-pro-text-soft mb-4">{t.depart} → {t.arrivee}</p>

              <div className="mb-3">
                <label className="text-xs font-semibold text-pro-text-soft">Votre tarif (€)</label>
                <input type="number" value={prix} onChange={(e) => setPrix(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-pro-border text-lg font-bold text-pro-text" />
                <div className="text-[11px] text-pro-muted mt-1">Tarif proposé : <strong>{suggested.toFixed(0)} €</strong></div>
                {t.allow_counter_offer && (
                  <div className="flex gap-1 mt-2">
                    {[0, 5, 10, 20].map((inc) => (
                      <button key={inc} type="button" onClick={() => setPrix(String(suggested + inc))}
                        className="flex-1 px-2 py-1 rounded border border-pro-border text-xs hover:bg-pro-bg-soft">
                        {inc === 0 ? "Au tarif" : `+${inc}€`}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <label className="text-xs font-semibold text-pro-text-soft">Message (facultatif)</label>
                <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3}
                  placeholder="Précisez vos disponibilités, votre expérience…"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-pro-border text-sm resize-none" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setOpenId(null)} className="flex-1 px-4 py-2 rounded-lg border border-pro-border text-sm">Annuler</button>
                <button onClick={submitApplication} disabled={submitting}
                  className="flex-1 px-4 py-2 rounded-lg bg-pro-brand-strip text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={14} />} Envoyer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="text-center pt-2">
        <Link to="/convoyeur/missions" className="text-xs text-pro-muted hover:text-pro-text">← Retour à mes missions</Link>
      </div>
    </div>
  );
}
