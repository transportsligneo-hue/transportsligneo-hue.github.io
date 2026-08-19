import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";
import type { CatalogueFilterState } from "@/components/convoyeur/CatalogueFilters";
import {
  CatalogueMissionCard,
  type CatalogTrajet,
} from "@/components/convoyeur/CatalogueMissionCard";
import { MissionDetailSheet } from "@/components/convoyeur/MissionDetailSheet";
import { CatalogueTrainingGate } from "@/components/convoyeur/CatalogueTrainingGate";
import { useGeolocation } from "@/lib/geo/useGeolocation";
import { haversineKm } from "@/lib/geo/haversine";
import { geocodeAddress } from "@/lib/geocode";
import { canAccessNiveau, niveauLabel } from "@/lib/convoyeur-niveau";
import { missionRequiredNiveau } from "@/lib/mission-level";

export const Route = createFileRoute("/_authenticated/convoyeur/catalogue")({
  component: ConvoyeurCatalogue,
});

interface MyOffer {
  id: string;
  trajet_id: string;
  statut: string;
  prix_propose: number;
  type_offre: string;
}

const DEFAULT_FILTERS: CatalogueFilterState = {
  search: "",
  maxKm: "",
  minPrix: "",
  date: "",
  leg: "all",
  urgent: false,
  electric: false,
  radiusKm: 100,
  sort: "date",
};

function getMissionPrice(t: CatalogTrajet) {
  return t.prix_convoyeur_fixe ?? t.prix_convoyeur ?? t.prix_suggere ?? 0;
}

function toGroupedCatalogueTrajets(items: CatalogTrajet[]) {
  const byGroup = new Map<string, CatalogTrajet[]>();
  const singles: CatalogTrajet[] = [];

  items.forEach((t) => {
    if (t.mission_group_id && (t.leg_type === "aller" || t.leg_type === "retour")) {
      byGroup.set(t.mission_group_id, [...(byGroup.get(t.mission_group_id) ?? []), t]);
      return;
    }
    singles.push(t);
  });

  const grouped: CatalogTrajet[] = [];
  byGroup.forEach((legs) => {
    const aller = legs.find((leg) => leg.leg_type === "aller");
    const retour = legs.find((leg) => leg.leg_type === "retour");
    if (!aller || !retour) {
      grouped.push(...legs);
      return;
    }

    const totalPrice = legs.reduce((sum, leg) => sum + getMissionPrice(leg), 0);

    grouped.push({
      ...aller,
      prix_convoyeur_fixe: totalPrice || null,
      prix_convoyeur: null,
      prix_suggere: null,
      allow_counter_offer: legs.every((leg) => leg.allow_counter_offer),
      proposal_expires_at: legs
        .map((leg) => leg.proposal_expires_at)
        .filter(Boolean)
        .sort()[0] ?? null,
      leg_type: "aller",
      isGroupedAr: true,
      groupedLegs: [aller, retour],
    });
  });

  return [...grouped, ...singles];
}

function ConvoyeurCatalogue() {
  const { user, convoyeurStatut } = useAuth();
  const validated = convoyeurStatut === "valide" || convoyeurStatut === "actif";
  const [hasTraining, setHasTraining] = useState(false);
  const [trainingLoaded, setTrainingLoaded] = useState(false);
  const [convoyeurId, setConvoyeurId] = useState<string | null>(null);
  const [driverNiveau, setDriverNiveau] = useState<string>("debutant");
  const [trajets, setTrajets] = useState<CatalogTrajet[]>([]);
  const [myOffers, setMyOffers] = useState<Record<string, MyOffer>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CatalogueFilterState>(DEFAULT_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coords, setCoords] = useState<Record<string, { lat: number; lng: number }>>({});

  const geo = useGeolocation();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("convoyeurs")
      .select("id, has_completed_training, niveau")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as
          | { id?: string; has_completed_training?: boolean; niveau?: string }
          | null;
        setConvoyeurId(row?.id ?? null);
        setHasTraining(Boolean(row?.has_completed_training));
        setDriverNiveau(row?.niveau ?? "debutant");
        setTrainingLoaded(true);
      });
  }, [user]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("trajets_publies_safe" as never)
      .select(
        "id,depart,arrivee,date_trajet,heure_trajet,marque,modele,prix_convoyeur_fixe,prix_convoyeur,prix_suggere,attribution_mode,allow_counter_offer,proposal_expires_at,leg_type,mission_group_id,statut_publication,created_at,published_at,niveau_requis,vehicule_energie,publisher_nom,publisher_logo_url,publisher_verifie" as never,
      )
      .in("attribution_mode" as never, ["catalogue", "mixte"] as never)
      .order("published_at" as never, { ascending: false })
      .limit(200);
    if (data) setTrajets(data as unknown as CatalogTrajet[]);

    if (convoyeurId) {
      const { data: offers } = await supabase
        .from("mission_offres")
        .select("id,trajet_id,statut,prix_propose,type_offre")
        .eq("convoyeur_id", convoyeurId)
        .in("statut", ["en_attente", "contre_offre_admin", "accepte", "acceptee"]);
      const map: Record<string, MyOffer> = {};
      (offers ?? []).forEach((o) => {
        map[(o as MyOffer).trajet_id] = o as MyOffer;
      });
      setMyOffers(map);
    }
    setLoading(false);
  }, [convoyeurId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Géocodage des points de prise en charge (uniquement quand "Autour de moi" est actif)
  useEffect(() => {
    if (!geo.position) return;
    let cancelled = false;
    (async () => {
      for (const t of trajets.slice(0, 60)) {
        if (cancelled) return;
        if (coords[t.id] || (typeof t.depart_lat === "number" && typeof t.depart_lng === "number"))
          continue;
        const p = await geocodeAddress(t.depart);
        if (cancelled) return;
        if (p) setCoords((c) => ({ ...c, [t.id]: { lat: p.lat, lng: p.lng } }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.position, trajets]);

  useEffect(() => {
    const ch = supabase
      .channel("catalogue-live-v2")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trajets" },
        () => fetchData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mission_offres" },
        () => fetchData(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchData]);

  const catalogueTrajets = useMemo(() => toGroupedCatalogueTrajets(trajets), [trajets]);

  const enriched = useMemo(() => {
    if (!geo.position)
      return catalogueTrajets.map((t) => ({ t, dist: null as number | null }));
    return catalogueTrajets.map((t) => {
      const point =
        typeof t.depart_lat === "number" && typeof t.depart_lng === "number"
          ? { lat: t.depart_lat, lng: t.depart_lng }
          : coords[t.id];
      return {
        t,
        dist: point ? haversineKm(geo.position!, point) : (null as number | null),
      };
    });
  }, [catalogueTrajets, geo.position, coords]);


  const filtered = useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    const km = filters.maxKm ? Number(filters.maxKm) : null;
    const prixMin = filters.minPrix ? Number(filters.minPrix) : null;
    const list = enriched.filter(({ t, dist }) => {
      const price = getMissionPrice(t);
      if (
        s &&
        !`${t.depart} ${t.arrivee} ${t.marque ?? ""} ${t.modele ?? ""}`
          .toLowerCase()
          .includes(s)
      )
        return false;
      if (km && (t.distance_km ?? 0) > km) return false;
      if (prixMin && price < prixMin) return false;
      if (filters.date && t.date_trajet !== filters.date) return false;
      if (filters.leg === "simple" && t.leg_type && t.leg_type !== "simple")
        return false;
      if (filters.leg === "ar" && !t.isGroupedAr && (!t.leg_type || t.leg_type === "simple"))
        return false;
      if (
        filters.urgent &&
        !(t.urgence === "urgent" || t.urgence === "immediat")
      )
        return false;
      if (filters.electric) {
        const carb = (t.type_carburant ?? "").toLowerCase();
        const model = `${t.marque ?? ""} ${t.modele ?? ""}`.toLowerCase();
        if (
          !carb.includes("électr") &&
          !carb.includes("electr") &&
          !model.includes("tesla") &&
          !model.match(/\b(id\.|e-|ev\b|zoé|zoe|ioniq|leaf|kona ev)/)
        )
          return false;
      }
      if (
        geo.position &&
        filters.radiusKm != null &&
        dist != null &&
        dist > filters.radiusKm
      )
        return false;
      return true;
    });
    list.sort((a, b) => {
      if (filters.sort === "prix") {
        const pa = getMissionPrice(a.t);
        const pb = getMissionPrice(b.t);
        return pb - pa;
      }
      if (filters.sort === "distance") {
        return (a.t.distance_km ?? Infinity) - (b.t.distance_km ?? Infinity);
      }
      if (filters.sort === "proximite" && geo.position) {
        return (a.dist ?? Infinity) - (b.dist ?? Infinity);
      }
      return (
        new Date(b.t.published_at ?? b.t.created_at).getTime() -
        new Date(a.t.published_at ?? a.t.created_at).getTime()
      );
    });
    return list;
  }, [enriched, filters, geo.position]);

  // Auto-switch to proximity sort when geo enables
  useEffect(() => {
    if (geo.position && filters.sort === "date") {
      setFilters((f) => ({ ...f, sort: "proximite" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.position]);

  const canApply = validated && hasTraining;

  const apply = async (trajet: CatalogTrajet, price: number, message: string) => {
    if (!canApply) {
      toast.error("Formation obligatoire et documents validés avant de candidater.");
      return;
    }
    const suggested =
      getMissionPrice(trajet);
    if (price !== suggested && !trajet.allow_counter_offer) {
      toast.error("Les contre-offres ne sont pas autorisées sur cette mission");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("driver_apply_to_mission", {
      _trajet_id: trajet.id,
      _proposed_price: price,
      _message: message || undefined,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      price === suggested ? "Candidature envoyée !" : "Contre-offre envoyée !",
    );
    // Alerte email admin (best effort)
    void import("@/lib/offres.functions")
      .then(({ notifyAdminNouvelleOffre }) =>
        notifyAdminNouvelleOffre({ data: { trajetId: trajet.id, prixPropose: price, message: message || null } }),
      )
      .catch(() => undefined);
    setOpenId(null);
    fetchData();
  };

  const openTrajet = openId ? catalogueTrajets.find((t) => t.id === openId) : null;
  const openDist =
    openTrajet && geo.position
      ? enriched.find((e) => e.t.id === openTrajet.id)?.dist ?? null
      : null;

  // Verrou formation : pas d'accès au catalogue tant que l'Académie Ligneo n'est pas validée
  if (trainingLoaded && !hasTraining) {
    return <CatalogueTrainingGate />;
  }

  const zoneValue = filters.radiusKm == null ? "all" : String(filters.radiusKm);

  const chevron = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );

  const chipToutesActive =
    filters.leg === "all" && !filters.urgent && !filters.electric;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8">
      <div className="cat2">
        {/* ===== FILTRES ===== */}
        <div className="cat2-filters">
          <div className="cat2-filter-row">
            <div className="cat2-select-wrap">
              <select
                className="cat2-select"
                value={zoneValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilters((f) => ({ ...f, radiusKm: v === "all" ? null : Number(v) }));
                }}
              >
                <option value="all">Toutes zones</option>
                <option value="30">Moins de 30 km</option>
                <option value="50">Moins de 50 km</option>
                <option value="100">Moins de 100 km</option>
              </select>
              {chevron}
            </div>
            <div className="cat2-select-wrap">
              <select
                className="cat2-select"
                value={filters.sort}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, sort: e.target.value as CatalogueFilterState["sort"] }))
                }
              >
                <option value="date">Tri : Plus récentes</option>
                <option value="prix">Tri : Mieux payées</option>
                <option value="distance">Tri : Plus courtes</option>
                <option value="proximite">Tri : Autour de moi</option>
              </select>
              {chevron}
            </div>
          </div>

          <div className="cat2-chips">
            <button
              type="button"
              className={`cat2-chip is-near${geo.position ? " is-active" : ""}`}
              onClick={async () => {
                if (geo.position) {
                  geo.clear();
                  setFilters((f) => ({ ...f, sort: "date" }));
                  return;
                }
                const { ensureLocationPermission, isNativeApp } = await import(
                  "@/lib/native/bridge"
                );
                const ok = await ensureLocationPermission();
                if (!ok) {
                  toast.error(
                    isNativeApp()
                      ? "Localisation refusée. Activez-la dans Réglages > Applications > Ligneo Driver > Autorisations > Position."
                      : "Autorisez la géolocalisation dans votre navigateur.",
                  );
                  return;
                }
                geo.request();
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {geo.loading ? "Localisation…" : "Autour de moi"}
            </button>

            <button
              type="button"
              className={`cat2-chip${chipToutesActive ? " is-active" : ""}`}
              onClick={() =>
                setFilters((f) => ({ ...f, leg: "all", urgent: false, electric: false }))
              }
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Toutes
            </button>

            <button
              type="button"
              className={`cat2-chip${filters.leg === "simple" ? " is-active" : ""}`}
              onClick={() =>
                setFilters((f) => ({ ...f, leg: f.leg === "simple" ? "all" : "simple" }))
              }
            >
              Livraison simple
            </button>

            <button
              type="button"
              className={`cat2-chip${filters.leg === "ar" ? " is-active" : ""}`}
              onClick={() => setFilters((f) => ({ ...f, leg: f.leg === "ar" ? "all" : "ar" }))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
              </svg>
              Livraison + Restitution
            </button>

            <button
              type="button"
              className={`cat2-chip is-gold${filters.urgent ? " is-active" : ""}`}
              onClick={() => setFilters((f) => ({ ...f, urgent: !f.urgent }))}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
              </svg>
              Urgentes
            </button>

            <button
              type="button"
              className={`cat2-chip is-elec${filters.electric ? " is-active" : ""}`}
              onClick={() => setFilters((f) => ({ ...f, electric: !f.electric }))}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
              </svg>
              Électrique
            </button>
          </div>
        </div>

        {!validated && (
          <div className="mx-4 rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
            Votre compte doit être validé pour candidater aux missions.
          </div>
        )}
        {geo.error && (
          <div className="mx-4 mt-2 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-2 text-xs text-red-100">
            Position indisponible : {geo.error}
          </div>
        )}

        <div className="cat2-count">
          {loading
            ? "Chargement…"
            : `${filtered.length} mission${filtered.length > 1 ? "s" : ""} affichée${filtered.length > 1 ? "s" : ""}`}
          <span className="line" />
        </div>

        {/* ===== CARTES ===== */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-[#5b83ff]" size={26} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mx-4 my-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-16 text-center text-sm text-white/60">
            <RouteIcon className="mx-auto mb-3 text-white/40" size={30} />
            Aucune mission ne correspond à ces critères.
          </div>
        ) : (
          <div className="cat2-cards">
            {filtered.map(({ t, dist }) => {
              const mine = [t, ...(t.groupedLegs ?? [])]
                .map((leg) => myOffers[leg.id])
                .find(Boolean);
              const requis = missionRequiredNiveau({
                niveau_requis: t.niveau_requis,
                distance_km: t.distance_km,
                urgence: t.urgence,
              });
              const locked = !canAccessNiveau(driverNiveau, requis);
              const openLocked = () =>
                toast.info(
                  `Mission réservée aux convoyeurs ${niveauLabel(requis)}. Continuez à enchaîner les missions pour débloquer ce niveau.`,
                );
              return (
                <CatalogueMissionCard
                  key={t.id}
                  trajet={t}
                  distanceFromMe={dist}
                  myOfferStatus={mine?.statut ?? null}
                  myOfferPrice={mine?.prix_propose ?? null}
                  canApply={canApply && !locked}
                  driverNiveau={driverNiveau}
                  onOpen={() => (locked ? openLocked() : setOpenId(t.id))}
                  onQuickApply={() => (locked ? openLocked() : setOpenId(t.id))}
                />
              );
            })}
          </div>
        )}

        {openTrajet && (
          <MissionDetailSheet
            trajet={openTrajet}
            distanceFromMe={openDist}
            onClose={() => setOpenId(null)}
            canApply={canApply}
            submitting={submitting}
            onSubmit={(price, message) => apply(openTrajet, price, message)}
          />
        )}
      </div>
    </div>
  );
}

