import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Route as RouteIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  CatalogueFilters,
  type CatalogueFilterState,
} from "@/components/convoyeur/CatalogueFilters";
import {
  CatalogueMissionCard,
  type CatalogTrajet,
} from "@/components/convoyeur/CatalogueMissionCard";
import { MissionDetailSheet } from "@/components/convoyeur/MissionDetailSheet";
import { CatalogueTrainingGate } from "@/components/convoyeur/CatalogueTrainingGate";
import { TrainingStatusBadge } from "@/components/convoyeur/TrainingStatusBadge";
import { useGeolocation } from "@/lib/geo/useGeolocation";
import { haversineKm } from "@/lib/geo/haversine";

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
  const [trajets, setTrajets] = useState<CatalogTrajet[]>([]);
  const [myOffers, setMyOffers] = useState<Record<string, MyOffer>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CatalogueFilterState>(DEFAULT_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const geo = useGeolocation();

  useEffect(() => {
    if (!user) return;
    supabase
      .from("convoyeurs")
      .select("id, has_completed_training")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { id?: string; has_completed_training?: boolean } | null;
        setConvoyeurId(row?.id ?? null);
        setHasTraining(Boolean(row?.has_completed_training));
        setTrainingLoaded(true);
      });
  }, [user]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("trajets_publies_safe" as never)
      .select(
        "id,depart,arrivee,date_trajet,heure_trajet,marque,modele,prix_convoyeur_fixe,prix_convoyeur,prix_suggere,attribution_mode,allow_counter_offer,proposal_expires_at,leg_type,mission_group_id,statut_publication,created_at,published_at" as never,
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
    if (!geo.position) return catalogueTrajets.map((t) => ({ t, dist: null as number | null }));
    return catalogueTrajets.map((t) => {
      if (typeof t.depart_lat === "number" && typeof t.depart_lng === "number") {
        return {
          t,
          dist: haversineKm(geo.position!, { lat: t.depart_lat, lng: t.depart_lng }),
        };
      }
      return { t, dist: null as number | null };
    });
  }, [catalogueTrajets, geo.position]);

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

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8">
      <div
        className="relative min-h-[calc(100vh-2rem)] px-4 sm:px-6 lg:px-8 pt-6 pb-24 text-white overflow-hidden"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, #0b1a44 0%, #060e28 55%, #030814 100%)",
        }}
      >
        {/* halos */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 h-[360px] w-[360px] rounded-full opacity-50 blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(212,175,55,0.35) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 -left-24 h-[300px] w-[300px] rounded-full opacity-40 blur-[110px]"
          style={{
            background: "radial-gradient(circle, rgba(59,130,246,0.35) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 mx-auto max-w-6xl space-y-5">
          {/* Titre */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-amber-300/80">
                <Sparkles size={14} /> Place de marché convoyeurs
              </div>
              <h1
                className="mt-1 text-2xl font-black text-white sm:text-3xl"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Catalogue des missions
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-white/70">
                Missions publiques disponibles. Postulez au tarif proposé ou faites
                une contre-offre. Trié en temps réel.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TrainingStatusBadge statut="validee" />
              <div className="flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Temps réel
              </div>
            </div>
          </div>

          {/* Alertes */}
          {!validated && (
            <div className="rounded-2xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Votre compte doit être validé pour candidater aux missions. Complétez
              vos documents dans l'onglet "Documents".
            </div>
          )}

          {/* Filtres */}
          <CatalogueFilters
            value={filters}
            onChange={setFilters}
            geoActive={!!geo.position}
            geoLoading={geo.loading}
            onRequestGeo={() => {
              geo.request();
              if (!geo.position) {
                toast.info("Autorisez la géolocalisation dans votre navigateur.");
              }
            }}
            onClearGeo={() => {
              geo.clear();
              setFilters((f) => ({ ...f, sort: "date" }));
            }}
          />

          {geo.error && (
            <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
              Position indisponible : {geo.error}
            </div>
          )}

          {/* Résultats */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="animate-spin text-amber-300" size={28} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] py-16 text-center text-white/60">
              <RouteIcon className="mx-auto mb-3 text-white/40" size={32} />
              Aucune mission ne correspond à ces critères.
            </div>
          ) : (
            <>
              <div className="text-xs text-white/60">
                {filtered.length} mission{filtered.length > 1 ? "s" : ""} affichée
                {filtered.length > 1 ? "s" : ""}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map(({ t, dist }) => {
                  const mine = [t, ...(t.groupedLegs ?? [])]
                    .map((leg) => myOffers[leg.id])
                    .find(Boolean);
                  return (
                    <CatalogueMissionCard
                      key={t.id}
                      trajet={t}
                      distanceFromMe={dist}
                      myOfferStatus={mine?.statut ?? null}
                      myOfferPrice={mine?.prix_propose ?? null}
                      canApply={canApply}
                      onOpen={() => setOpenId(t.id)}
                      onQuickApply={() => setOpenId(t.id)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>

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
