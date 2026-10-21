import { createFileRoute } from "@tanstack/react-router";
import { DriverLoader } from "@/components/driver2/DriverLoader";
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
import { AuctionSheet } from "@/components/driver2/AuctionSheet";
import { Ic } from "@/components/driver2/icons";
import "@/styles/driver-v2.css";

export const Route = createFileRoute("/_authenticated/convoyeur/catalogue")({
  component: ConvoyeurCatalogue,
  errorComponent: ({ error }) => (
    <div className="drv2">
      <div className="card" style={{ margin: 16, textAlign: "center" }}>
        <p className="sm bold">Le catalogue n'a pas pu s'afficher</p>
        <p className="tiny mut" style={{ marginTop: 8, wordBreak: "break-word" }}>{String((error as Error)?.message ?? error)}</p>
        <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>Réessayer</button>
      </div>
    </div>
  ),
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
  radiusKm: null,
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
  const [sortOpen, setSortOpen] = useState(false);
  const [auctionId, setAuctionId] = useState<string | null>(null);
  const [equip, setEquip] = useState<string[]>([]);
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
    if (data) {
      // Options du catalogue (équipements, carburant, enchères) : fonction dédiée, la vue n'est pas modifiée
      const { data: ex } = await supabase.rpc("list_catalogue_extras" as never);
      const extras = new Map<string, Partial<CatalogTrajet> & { trajet_id: string }>();
      ((ex as unknown as Array<Partial<CatalogTrajet> & { trajet_id: string }>) ?? []).forEach((e) => extras.set(e.trajet_id, e));
      setTrajets(
        (data as unknown as CatalogTrajet[]).map((t) => {
          const e = extras.get(t.id);
          return e
            ? { ...t, equipements_requis: e.equipements_requis ?? [], carburant_mode: e.carburant_mode ?? null, mise_en_main: !!e.mise_en_main, enchere: e.enchere ?? null }
            : t;
        }),
      );
    }

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
      if (equip.length && !equip.every((q) => (t.equipements_requis ?? []).includes(q))) return false;
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
  }, [enriched, filters, geo.position, equip]);

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
  const auctionTrajet = auctionId ? catalogueTrajets.find((t) => t.id === auctionId) : null;
  const openDist =
    openTrajet && geo.position
      ? enriched.find((e) => e.t.id === openTrajet.id)?.dist ?? null
      : null;

  // Verrou formation : pas d'accès au catalogue tant que l'Académie Ligneo n'est pas validée
  if (trainingLoaded && !hasTraining) {
    return <CatalogueTrainingGate />;
  }

  const zones: Array<[number | null, string]> = [[null, "Toutes zones"], [30, "< 30 km"], [50, "< 50 km"], [100, "< 100 km"]];
  const sorts: Array<[CatalogueFilterState["sort"], string]> = [["date", "Plus récentes"], ["prix", "Mieux payées"], ["distance", "Plus courtes"]];
  const EQ: Array<[string, string, string]> = [["plateau", "Plateau", "ramp"], ["wg", "W Garage", "plateW"], ["elec", "Câble recharge", "bolt"]];

  const toggleNear = async () => {
    if (geo.position) {
      geo.clear();
      setFilters((f) => ({ ...f, sort: "date" }));
      return;
    }
    const { ensureLocationPermission, isNativeApp } = await import("@/lib/native/bridge");
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
  };

  return (
    <div className="drv2">
      <div className="stack">
        <div>
          <h1>Catalogue missions</h1>
          <p className="sub">Trajets ouverts, positionnez-vous en un clic.</p>
        </div>

        <button
          className={`btn ${geo.position ? "" : "green"}`}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, ...(geo.position ? { background: "#fff", color: "#0b6b46", border: "2px solid #14B866", boxShadow: "none" } : {}) }}
          onClick={() => void toggleNear()}
        >
          <Ic n="pin" s={18} /> {geo.loading ? "Localisation…" : geo.position ? "Autour de moi : activé" : "Missions autour de moi"}
        </button>

        <div className="catbar">
          <div className="search">
            <Ic n="search" s={14} />
            <input
              className="fld"
              placeholder="Ville de départ ou d'arrivée…"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <button className={`sortbtn ${sortOpen ? "on" : ""}`} onClick={() => setSortOpen((v) => !v)} aria-label="Trier">
            <Ic n="sort" s={17} sw={2.2} />
          </button>
        </div>
        {sortOpen && (
          <div className="sortpop">
            <small>Trier par</small>
            {sorts.map(([k, l]) => {
              const on = !geo.position && filters.sort === k;
              return (
                <button key={k} className={on ? "on" : ""} onClick={() => { setSortOpen(false); setFilters((f) => ({ ...f, sort: k })); }}>
                  {l}{on && <Ic n="check2" s={14} sw={3} />}
                </button>
              );
            })}
          </div>
        )}

        <div className="filters fl2">
          {zones.map(([z, l]) => (
            <button key={l} className={`fl ${(filters.radiusKm ?? null) === z ? "on" : ""}`} onClick={() => setFilters((f) => ({ ...f, radiusKm: z }))}>{l}</button>
          ))}
          <i className="fsep" />
          {EQ.map(([k, l, ic]) => (
            <button key={k} className={`fl fle ${equip.includes(k) ? "on" : ""}`} onClick={() => setEquip((q) => (q.includes(k) ? q.filter((x) => x !== k) : [...q, k]))}>
              <Ic n={ic} s={13} sw={2.3} />{l}
            </button>
          ))}
          <i className="fsep" />
          <button className={`fl ${filters.urgent ? "on" : ""}`} onClick={() => setFilters((f) => ({ ...f, urgent: !f.urgent }))}>Urgentes</button>
          <button className={`fl ${filters.leg === "ar" ? "on" : ""}`} onClick={() => setFilters((f) => ({ ...f, leg: f.leg === "ar" ? "all" : "ar" }))}>Restitution et livraison</button>
        </div>

        {!validated && (
          <div className="card" style={{ padding: 14, fontSize: 13 }}>Votre compte doit être validé pour candidater aux missions.</div>
        )}
        {geo.error && <div className="card" style={{ padding: 14, fontSize: 13, color: "#b91c1c" }}>Position indisponible : {geo.error}</div>}

        {loading ? (
          <DriverLoader label="Chargement du catalogue…" />
        ) : filtered.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: 28 }}>
            <p className="sm semi">Aucune mission pour cette recherche.</p>
            <p className="xs mut" style={{ marginTop: 6 }}>Essayez une autre ville ou élargissez la zone.</p>
          </div>
        ) : (
          filtered.map(({ t, dist }) => {
            const mine = [t, ...(t.groupedLegs ?? [])].map((leg) => myOffers[leg.id]).find(Boolean);
            const requis = missionRequiredNiveau({ niveau_requis: t.niveau_requis, distance_km: t.distance_km, urgence: t.urgence });
            const locked = !canAccessNiveau(driverNiveau, requis);
            const openLocked = () =>
              toast.info(`Mission réservée aux convoyeurs ${niveauLabel(requis)}. Continuez à enchaîner les missions pour débloquer ce niveau.`);
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
                onAuction={() => setAuctionId(t.id)}
              />
            );
          })
        )}

        {auctionTrajet?.enchere && (
          <AuctionSheet
            trajetId={auctionTrajet.id}
            depart={auctionTrajet.depart}
            arrivee={auctionTrajet.arrivee}
            marque={[auctionTrajet.marque, auctionTrajet.modele].filter(Boolean).join(" ")}
            km={auctionTrajet.distance_km}
            dateLabel={auctionTrajet.date_trajet}
            initial={auctionTrajet.enchere}
            onClose={() => setAuctionId(null)}
            onChanged={() => fetchData()}
          />
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