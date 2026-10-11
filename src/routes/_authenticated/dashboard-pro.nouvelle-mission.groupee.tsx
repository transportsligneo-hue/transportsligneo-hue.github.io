import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { createGroupedMission } from "@/lib/grouped-mission.functions";
import { calculateBasePrice } from "@/lib/reservation-pricing";
import { resolveDistanceKm } from "@/lib/resolve-distance";
import { resolveClientPrice, computeOptionSupplements, fetchDeliveryRechargeSurcharge, DEFAULT_DELIVERY_RECHARGE_SURCHARGE, type OptionKey } from "@/lib/client-pricing";
import { isValidVinFormat, normalizeVin } from "@/lib/vin";
import { lookupPlate } from "@/lib/plate.functions";
import PlacesInput from "@/components/PlacesInput";
import {
  ArrowLeft, Layers, Search, Loader2, Plus, X, Check, Zap, Fuel, Sparkle,
  Clock, Send, Star, ChevronDown, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { FleetDevisSuccess } from "@/components/flotte/FleetDevisSuccess";
import {
  GROUPED_TRIP_CHOICES,
  groupedDestination,
  groupedResolverTrip,
  groupedStandardTrip,
  groupedTripLabel,
  type GroupedTripType,
} from "@/lib/grouped-mission-type";

export const Route = createFileRoute("/_authenticated/dashboard-pro/nouvelle-mission/groupee")({
  head: () => ({
    meta: [
      { title: "Mission groupée | Transports Ligneo" },
      { name: "description", content: "Créer une mission groupée avec plusieurs types de trajet dans votre espace Transports Ligneo." },
      { property: "og:title", content: "Mission groupée | Transports Ligneo" },
      { property: "og:description", content: "Créer une mission groupée avec plusieurs types de trajet dans votre espace Transports Ligneo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GroupedMissionForm,
});

const VAT_RATE = 0.2;

const OPTIONS_DEF: { key: OptionKey; label: string; desc: string; Icon: typeof Zap }[] = [
  { key: "recharge_electrique", label: "Recharge électrique pour trajet", desc: "Brancher pour le trajet", Icon: Zap },
  { key: "recharge_electrique_livraison", label: "Recharge électrique pour livraison", desc: "Recharge avant la remise du véhicule", Icon: Zap },
  { key: "plein_essence", label: "Appoint carburant", desc: "Carburant ajouté selon le niveau souhaité", Icon: Fuel },
  { key: "lavage_ext", label: "Lavage extérieur", desc: "Nettoyage de la carrosserie", Icon: Sparkle },
  { key: "lavage_int", label: "Lavage intérieur", desc: "Nettoyage de l’habitacle", Icon: Sparkle },
  { key: "lavage_full", label: "Lavage extérieur + intérieur", desc: "Nettoyage complet du véhicule", Icon: Sparkle },
  { key: "mise_en_main", label: "Mise en main du véhicule", desc: "Remise en main propre avec clés et documents", Icon: KeyRound },
];

interface FavoriteAddress {
  id: string;
  label: string;
  address: string;
  ville: string | null;
  code_postal: string | null;
  address_type: "depart" | "arrivee" | "both";
  contact_nom: string | null;
  contact_tel: string | null;
  is_default: boolean;
}

type VehicleRow = {
  key: string;
  immat: string;
  marque: string;
  modele: string;
  energie: string;
  type: string;
  vin: string;
  km: string;
  notes: string;
  arrivee: string;
  tripType: GroupedTripType;
  immatRetour: string;
  marqueRetour: string;
  modeleRetour: string;
  vinRetour: string;
  energieRetour: string;
  busyRetour: boolean;
  open: boolean;
  busy: boolean;
  options: Partial<Record<OptionKey, boolean>>;
  optionsOverride: boolean;
};

const newRow = (): VehicleRow => ({
  key: crypto.randomUUID(),
  immat: "", marque: "", modele: "", energie: "", type: "", vin: "", km: "", notes: "",
  arrivee: "", tripType: "aller-simple", immatRetour: "", marqueRetour: "", modeleRetour: "", vinRetour: "", energieRetour: "", busyRetour: false, open: false, busy: false, options: {}, optionsOverride: false,
});

const fieldCls = "qm-input";
const labelCls = "qm-label";

function eur(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

function GroupedMissionForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createGrouped = useServerFn(createGroupedMission);
  const lookup = useServerFn(lookupPlate);
  const plateRequests = useRef(new Map<string, string>());
  const plateRows = useRef<VehicleRow[]>([]);

  const [profile, setProfile] = useState<{ email: string; display: "ttc" | "ht" | "exempt" } | null>(null);
  const [favorites, setFavorites] = useState<FavoriteAddress[]>([]);

  // Bloc 1 — trajet commun
  const [depart, setDepart] = useState("");
  const [contactNom, setContactNom] = useState("");
  const [contactTel, setContactTel] = useState("");
  const [sameDest, setSameDest] = useState(true);
  const [commonArrivee, setCommonArrivee] = useState("");

  // Bloc 2 — véhicules
  const [rows, setRows] = useState<VehicleRow[]>([newRow(), newRow()]);

  // Bloc 3 — options communes
  const [options, setOptions] = useState<Partial<Record<OptionKey, boolean>>>({});

  // Bloc 4 — planning
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [message, setMessage] = useState("");

  const [prices, setPrices] = useState<Record<string, number>>({});
  const [pricing, setPricing] = useState(false);
  const [deliveryRechargeSurcharge, setDeliveryRechargeSurcharge] = useState(DEFAULT_DELIVERY_RECHARGE_SURCHARGE);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ref: string; count: number; devisId: string | null } | null>(null);

  useEffect(() => {
    void fetchDeliveryRechargeSurcharge().then(setDeliveryRechargeSurcharge);
  }, []);

  // Chargement profil + adresses favorites
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: fav }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, pricing_display_mode")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("client_default_addresses" as never)
          .select("id, label, address, ville, code_postal, address_type, contact_nom, contact_tel, is_default")
          .eq("active", true)
          .order("is_default", { ascending: false }),
      ]);
      if (cancelled) return;
      const pp = p as { email?: string; pricing_display_mode?: string } | null;
      setProfile({
        email: pp?.email ?? user.email ?? "",
        display: (pp?.pricing_display_mode as "ttc" | "ht" | "exempt") ?? "ttc",
      });
      setFavorites(((fav as unknown as FavoriteAddress[]) ?? []));
    })();
    return () => { cancelled = true; };
  }, [user]);

  const fullAddress = (f: FavoriteAddress) =>
    [f.address, [f.code_postal, f.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  // Préremplissage adresse d'enlèvement par défaut
  useEffect(() => {
    if (!favorites.length || depart) return;
    const def = favorites.find((f) => f.is_default && (f.address_type === "depart" || f.address_type === "both"))
      ?? favorites.find((f) => f.address_type === "depart" || f.address_type === "both");
    if (def) {
      setDepart(fullAddress(def));
      if (def.contact_nom) setContactNom(def.contact_nom);
      if (def.contact_tel) setContactTel(def.contact_tel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites]);

  const patchRow = useCallback((key: string, patch: Partial<VehicleRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }, []);

  // Récupération auto par plaque (même logique que Mission simple)
  const fetchPlate = async (row: VehicleRow, retour = false) => {
    const plate = (retour ? row.immatRetour : row.immat).trim();
    const requestKey = `${row.key}:${retour ? "retour" : "livraison"}`;
    if (plateRequests.current.get(requestKey) === plate) return;
    plateRequests.current.set(requestKey, plate);
    if (plate.length < 4) {
      toast.error("Saisissez une plaque valide");
      return;
    }
    patchRow(row.key, retour ? { busyRetour: true } : { busy: true });
    try {
      const result = await lookup({ data: { plate } });
      const current = plateRows.current.find((r) => r.key === row.key);
      if (!current || (retour ? current.immatRetour : current.immat).trim() !== plate) return;
      if (!result.ok || !result.data) {
        toast.error(result.error || "Aucune donnée trouvée · remplissez manuellement");
        return;
      }
      const d = result.data;
      if (retour) {
        patchRow(row.key, { marqueRetour: d.marque || "", modeleRetour: d.modele || "", vinRetour: normalizeVin(d.vin || ""), energieRetour: d.energie || d.carburant || "" });
        return;
      }
      const patch: Partial<VehicleRow> = {};
      if (d.marque) patch.marque = d.marque;
      if (d.modele) patch.modele = d.modele;
      if (d.vin) patch.vin = normalizeVin(d.vin);
      patch.energie = d.energie || "";
      if (!d.energie && d.carburant) {
        const c = d.carburant.toLowerCase();
        if (c.includes("élec") || c.includes("elec") || c.includes("ev")) patch.energie = "electrique";
        else if (c.includes("hyb") && c.includes("rech")) patch.energie = "hybride_rechargeable";
        else if (c.includes("hyb")) patch.energie = "hybride";
        else if (c.includes("diesel") || c.includes("gazole")) patch.energie = "diesel";
        else if (c.includes("gpl")) patch.energie = "gpl";
        else if (c.includes("ess")) patch.energie = "essence";
      }
      patchRow(row.key, patch);
      toast.success("Informations véhicule récupérées");
    } catch {
      plateRequests.current.delete(requestKey);
      toast.error("Service indisponible · remplissez manuellement");
    } finally {
      patchRow(row.key, retour ? { busyRetour: false } : { busy: false });
    }
  };

  plateRows.current = rows;
  const plateSignature = rows.map((r) => `${r.key}:${r.immat}:${r.tripType}:${r.immatRetour}`).join("|");
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const row of plateRows.current) {
        if (/^(?:[A-Z]{2}[- ]?\d{3}[- ]?[A-Z]{2}|\d{1,4}[- ]?[A-Z]{1,3}[- ]?\d{2,3})$/.test(row.immat.trim())) void fetchPlate(row);
        if (row.tripType === "aller-retour" && /^(?:[A-Z]{2}[- ]?\d{3}[- ]?[A-Z]{2}|\d{1,4}[- ]?[A-Z]{1,3}[- ]?\d{2,3})$/.test(row.immatRetour.trim())) void fetchPlate(row, true);
      }
    }, 650);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plateSignature]);

  const enteredDestFor = useCallback(
    (r: VehicleRow) => (sameDest ? commonArrivee : r.arrivee),
    [sameDest, commonArrivee],
  );

  const destFor = useCallback(
    (r: VehicleRow) => groupedDestination(r.tripType, depart, enteredDestFor(r)),
    [depart, enteredDestFor],
  );

  const filledRows = useMemo(
    () => rows.filter((r) => r.immat.trim().length >= 4 && destFor(r).trim().length >= 2),
    [rows, destFor],
  );

  // Estimation par véhicule — même moteur tarifaire que Mission simple
  const rowsSignature = filledRows.map((r) => `${r.key}|${r.tripType}|${destFor(r)}|${JSON.stringify(r.optionsOverride ? r.options : options)}`).join(";");
  useEffect(() => {
    if (!profile || !depart) { setPrices({}); return; }
    if (filledRows.length === 0) { setPrices({}); return; }
    let cancelled = false;
    setPricing(true);
    (async () => {
      const out: Record<string, number> = {};
      for (const r of filledRows) {
        const arr = destFor(r);
        const opts = r.optionsOverride ? r.options : options;
        try {
          const custom = await resolveClientPrice({
            userId: user?.id ?? null,
            email: profile.email,
            depart,
            arrivee: arr,
            tripType: groupedResolverTrip(r.tripType),
          });
          if (custom) {
            const sup = computeOptionSupplements({
              ...custom.supplements,
              recharge_electrique_livraison: deliveryRechargeSurcharge,
            }, opts);
            out[r.key] = Math.round((custom.prix_ttc + sup.total) * 100) / 100;
            continue;
          }
        } catch { /* fallback standard */ }
        let std = calculateBasePrice(depart, arr, groupedStandardTrip(r.tripType));
        if (std.base <= 0) {
          const km = await resolveDistanceKm(depart, arr);
          std = calculateBasePrice(depart, arr, groupedStandardTrip(r.tripType), km);
        }
        if (std.base > 0) {
          const sup = computeOptionSupplements({
            recharge_electrique_livraison: deliveryRechargeSurcharge,
          }, opts);
          out[r.key] = Math.round((std.base + sup.total) * 100) / 100;
        }
      }
      if (!cancelled) { setPrices(out); setPricing(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depart, rowsSignature, profile, user, deliveryRechargeSurcharge]);

  const total = useMemo(
    () => filledRows.reduce((s, r) => s + (prices[r.key] ?? 0), 0),
    [filledRows, prices],
  );

  const canSubmit =
    depart.trim().length >= 2 &&
    !!date &&
    !!heure &&
    filledRows.length > 0 &&
    rows.every((r) => (r.immat.trim() ? destFor(r).trim().length >= 2 : true)) &&
    // VIN obligatoire et valide pour chaque véhicule (rapprochement automatique des bons de commande)
    filledRows.every((r) => isValidVinFormat(r.vin)) &&
    !submitting;

  const invalidVinRows = filledRows.filter((r) => !isValidVinFormat(r.vin));

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await createGrouped({
        data: {
          depart,
          date,
          heure,
          contactDepartNom: contactNom,
          contactDepartTel: contactTel,
          message,
          vehicles: filledRows.map((r) => ({
            vehicleId: null,
            immatriculation: r.immat.trim().toUpperCase(),
            vin: normalizeVin(r.vin),
            marque: r.marque || null,
            modele: r.modele || null,
            energie: r.energie || null,
            type: r.type || null,
            km: r.km ? parseInt(r.km, 10) : null,
            notes: r.notes || null,
            arrivee: destFor(r),
            tripType: r.tripType,
            immatriculationRetour: r.tripType === "aller-retour" && r.immatRetour.trim() ? r.immatRetour.trim().toUpperCase() : null,
            marqueRetour: r.tripType === "aller-retour" ? r.marqueRetour || null : null,
            modeleRetour: r.tripType === "aller-retour" ? r.modeleRetour || null : null,
            vinRetour: r.tripType === "aller-retour" ? r.vinRetour || null : null,
            energieRetour: r.tripType === "aller-retour" ? r.energieRetour || null : null,
            prixTtc: prices[r.key] ?? 0,
            optionsMeta: Object.fromEntries(
              Object.entries(r.optionsOverride ? r.options : options).filter(([, v]) => !!v),
            ) as Record<string, boolean>,
          })),
        },
      });
      setResult({ ref: res.groupReference, count: res.count, devisId: res.devisId ?? null });
      toast.success(`Mission groupée créée · ${res.groupReference}`);
    } catch (e) {
      console.error("[grouped-mission] submit failed", e);
      toast.error(`Impossible de créer la mission : ${(e as { message?: string })?.message ?? e}`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setResult(null);
    setRows([newRow(), newRow()]);
    setPrices({});
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (result?.devisId) {
    return (
      <FleetDevisSuccess
        devisId={result.devisId}
        title="Mission groupée envoyée"
        subtitle={`${result.count} véhicule${result.count > 1 ? "s" : ""} · référence de groupe ${result.ref}.`}
        onNewRequest={resetForm}
      />
    );
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#e9f7ee] text-[#16a34a]">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Mission groupée envoyée</h1>
        <p className="text-slate-500 text-sm">
          {result.count} véhicule{result.count > 1 ? "s" : ""} · référence de groupe{" "}
          <b className="text-slate-900">{result.ref}</b>. Votre demande sera traitée sous 24 h.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => navigate({ to: "/dashboard-pro/missions" })}
            className="fleet-btn-violet rounded-[11px] px-5 py-3 text-[13.5px] font-semibold text-white"
          >
            Voir mes missions
          </button>
          <button
            onClick={resetForm}
            className="rounded-[11px] border border-slate-200 px-5 py-3 text-[13.5px] font-semibold text-slate-600 hover:border-slate-300"
          >
            Nouvelle mission groupée
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-[920px] mx-auto pb-16">
      <Link
        to="/dashboard-pro/nouvelle-mission"
        className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour au choix
      </Link>
      <div className="mt-3 text-xs text-slate-400">
        Espace Flotte / Nouvelle mission / <b className="text-slate-900 font-semibold">Mission groupée</b>
      </div>
      <h1 className="mt-1.5 flex items-center gap-2 text-[24px] font-extrabold tracking-[-0.02em] text-slate-900">
        <Layers className="h-6 w-6 text-[#7c5cff]" /> Mission groupée
      </h1>
      <div className="mt-4 rounded-xl border border-[#7c5cff]/25 bg-[#7c5cff]/[0.05] p-4">
        <p className="text-[13.5px] font-semibold text-slate-900">Une seule demande, des prestations mixées</p>
        <ul className="mt-2 grid gap-1.5 text-[13px] text-slate-600 sm:grid-cols-2">
          <li><b className="text-slate-900">1. Enlèvement commun</b> : un départ pour tous vos véhicules.</li>
          <li><b className="text-slate-900">2. Prestation par véhicule</b> : livraison simple, restitution et livraison, ou recharge électrique.</li>
          <li><b className="text-slate-900">3. Destinations</b> : même adresse pour tous ou une adresse par véhicule, depuis vos adresses favorites.</li>
          <li><b className="text-slate-900">4. Documents automatiques</b> : devis, bon de commande, PV et factures générés en PDF.</li>
        </ul>
      </div>
      <p className="mt-1 text-[13.5px] text-slate-500">
        Convoyez plusieurs véhicules de votre parc en une seule demande.
      </p>
      <span className="mt-3 mb-6 inline-flex items-center gap-2 rounded-full bg-[#e9f7ee] px-3.5 py-1.5 text-xs font-semibold text-[#16a34a]">
        <Zap className="h-3.5 w-3.5" /> ~3× plus rapide qu'une saisie mission par mission
      </span>

      {/* 1 — Trajet commun */}
      <Card num="1" title="Trajet commun">
        <span className={labelCls}>Lieu d'enlèvement</span>
        {favorites.filter((f) => f.address_type !== "arrivee").length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {favorites.filter((f) => f.address_type !== "arrivee").map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setDepart(fullAddress(f));
                  if (f.contact_nom) setContactNom(f.contact_nom);
                  if (f.contact_tel) setContactTel(f.contact_tel);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#f0e0b8] bg-[#fbf3e0] px-3 py-1.5 text-xs font-semibold text-[#a8791f]"
              >
                <Star className="h-3 w-3" /> {f.label}
              </button>
            ))}
          </div>
        )}
        <PlacesInput value={depart} onChange={setDepart} placeholder="Adresse d'enlèvement" className={fieldCls} />
        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Contact sur place</span>
            <input className={fieldCls} value={contactNom} onChange={(e) => setContactNom(e.target.value)} placeholder="Nom du contact" />
          </div>
          <div>
            <span className={labelCls}>Téléphone</span>
            <input className={fieldCls} value={contactTel} onChange={(e) => setContactTel(e.target.value)} placeholder="06 12 34 56 78" />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-[11px] border border-slate-200 bg-slate-50/70 px-4 py-3">
          <div>
            <div className="text-[13px] font-semibold text-slate-900">Livraison identique pour tous les véhicules</div>
            <div className="text-[11.5px] text-slate-500">Désactivez si chaque véhicule a une destination différente</div>
          </div>
          <button
            type="button"
            onClick={() => setSameDest((v) => !v)}
            aria-pressed={sameDest}
            className={`relative h-[22px] w-[38px] flex-shrink-0 rounded-full transition ${sameDest ? "bg-[#2f5fff]" : "bg-slate-300"}`}
          >
            <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${sameDest ? "left-[18px]" : "left-0.5"}`} />
          </button>
        </div>

        {sameDest && (
          <div className="mt-4">
            <span className={labelCls}>Lieu de livraison (commun)</span>
            <PlacesInput
              value={commonArrivee}
              onChange={setCommonArrivee}
              placeholder="Ex : 5 avenue de la République, Le Mans"
              className={fieldCls}
            />
          </div>
        )}
      </Card>

      {/* 2 — Véhicules */}
      <Card
        num="2"
        title="Véhicules à convoyer"
        badge={`${rows.length} véhicule${rows.length > 1 ? "s" : ""}`}
      >
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => {
            const info = [r.marque, r.modele].filter(Boolean).join(" ");
            return (
              <div key={r.key} className="grouped-vehicle-panel p-4">
                <div className="flex flex-wrap items-end gap-2.5">
                  <div className="w-[170px]">
                    <span className={labelCls}>Plaque livraison</span>
                    <input
                      className={`${fieldCls} font-mono font-bold tracking-[0.05em] uppercase`}
                      value={r.immat}
                      onChange={(e) => patchRow(r.key, { immat: e.target.value.toUpperCase() })}
                      placeholder="AA-000-AA"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchPlate(r)}
                    disabled={r.busy}
                    className="flex items-center gap-1.5 rounded-[9px] bg-[#7c5cff] px-3.5 py-2.5 text-[12.5px] font-semibold text-white disabled:opacity-60"
                  >
                    {r.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    Récupérer
                  </button>
                  <div className={`flex flex-1 min-w-[160px] items-center gap-2 px-1 py-2.5 text-[13px] ${info ? "font-semibold text-slate-900" : "text-slate-400"}`}>
                    {info ? <Check className="h-3.5 w-3.5 text-[#16a34a]" /> : null}
                    {info || "En attente de la plaque…"}
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                      className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      aria-label="Retirer ce véhicule"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {!sameDest && (
                  <div className="mt-2.5 border-t border-dashed border-slate-200 pt-2.5">
                    <span className={labelCls}>Lieu de livraison de ce véhicule</span>
                    <PlacesInput
                      value={r.arrivee}
                      onChange={(v) => patchRow(r.key, { arrivee: v })}
                      placeholder="Adresse de livraison"
                      className={fieldCls}
                    />
                  </div>
                )}

                <div className="mt-3">
                  <span className={labelCls}>Type de trajet</span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {GROUPED_TRIP_CHOICES.map((choice) => (
                      <button
                        key={choice.value}
                        type="button"
                        onClick={() => patchRow(r.key, { tripType: choice.value })}
                        className={`rounded-[9px] border px-3 py-2 text-left text-[12px] font-semibold transition ${
                          r.tripType === choice.value
                            ? "border-[#2f5fff] bg-[#eef2ff] text-[#2f5fff]"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                  {r.tripType === "aller-retour" && (
                    <div className="mt-2.5">
                      <div>
                        <span className={labelCls}>Plaque retour (restitution)</span>
                        <input
                          className={`${fieldCls} uppercase tracking-widest`}
                          value={r.immatRetour}
                          onChange={(e) => patchRow(r.key, { immatRetour: e.target.value.toUpperCase() })}
                          placeholder="AB-123-CD"
                          maxLength={32}
                        />
                        {r.busyRetour && <Loader2 className="mt-2 h-4 w-4 animate-spin text-pro-accent" />}
                        {(r.marqueRetour || r.modeleRetour) && <p className="mt-2 text-sm font-semibold text-pro-text">{[r.marqueRetour, r.modeleRetour].filter(Boolean).join(" ")}</p>}
                        <input aria-label="VIN du véhicule restitué" className={`${fieldCls} mt-2 font-mono`} value={r.vinRetour} maxLength={17} onChange={(e) => patchRow(r.key, { vinRetour: normalizeVin(e.target.value) })} placeholder="VIN du véhicule restitué" />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => patchRow(r.key, { open: !r.open })}
                  className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#2f5fff]"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition ${r.open ? "rotate-180" : ""}`} />
                  Détails (VIN, kilométrage, notes, options)
                </button>

                {r.open && (
                  <div className="mt-3 border-t border-slate-200 pt-3 space-y-2.5">
                    <div className="grid gap-2.5 sm:grid-cols-3">
                      <div>
                        <input
                          className={`${fieldCls} uppercase tracking-widest ${r.vin && !isValidVinFormat(r.vin) ? "border-red-400" : ""}`}
                          value={r.vin}
                          maxLength={17}
                          onChange={(e) => patchRow(r.key, { vin: normalizeVin(e.target.value) })}
                          placeholder="VIN / Châssis (obligatoire)"
                        />
                        {r.vin.length > 0 && !isValidVinFormat(r.vin) && (
                          <p className="mt-1 text-[11px] text-red-500">VIN invalide — 17 caractères, hors I/O/Q</p>
                        )}
                      </div>
                      <input className={fieldCls} value={r.km} onChange={(e) => patchRow(r.key, { km: e.target.value.replace(/\D/g, "") })} placeholder="Kilométrage" inputMode="numeric" />
                      <input className={fieldCls} value={r.notes} onChange={(e) => patchRow(r.key, { notes: e.target.value })} placeholder="Notes véhicule" />
                    </div>
                    <label className="flex items-center gap-2 text-[11.5px] font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={r.optionsOverride}
                        onChange={(e) =>
                          patchRow(r.key, { optionsOverride: e.target.checked, options: e.target.checked ? { ...options } : {} })
                        }
                      />
                      Options spécifiques à ce véhicule
                    </label>
                    {r.optionsOverride && (
                      <div className="grid gap-2 sm:grid-cols-3">
                        {OPTIONS_DEF.map((o) => (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => patchRow(r.key, { options: { ...r.options, [o.key]: !r.options[o.key] } })}
                            className={`rounded-[9px] border px-3 py-2 text-left text-[12px] font-semibold transition ${
                              r.options[o.key] ? "border-[#2f5fff] bg-[#eef2ff] text-[#2f5fff]" : "border-slate-200 bg-white text-slate-600"
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, newRow()])}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-dashed border-slate-300 py-3 text-[13px] font-semibold text-slate-500 transition hover:border-[#2f5fff] hover:bg-[#eef2ff] hover:text-[#2f5fff]"
        >
          <Plus className="h-4 w-4" /> Ajouter un véhicule
        </button>
      </Card>

      {/* 3 — Options communes */}
      <Card num="3" title="Options communes">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {OPTIONS_DEF.map((o) => {
            const checked = !!options[o.key];
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => setOptions((p) => ({ ...p, [o.key]: !p[o.key] }))}
                className={`flex items-start gap-2.5 rounded-[11px] border p-3 text-left transition ${
                  checked ? "border-[#2f5fff] bg-[#eef2ff]" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className={`mt-0.5 flex h-[17px] w-[17px] flex-shrink-0 items-center justify-center rounded-[5px] border-[1.5px] ${
                  checked ? "border-[#2f5fff] bg-[#2f5fff] text-white" : "border-slate-300"
                }`}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span>
                  <b className="block text-[12.5px] text-slate-900">
                    {o.label}
                  </b>
                  <span className="text-[11px] text-slate-400">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11.5px] text-slate-400">
          Ces options s'appliquent aux {rows.length} véhicules de la demande. Ajustez-les individuellement dans « Détails » si besoin.
        </p>
      </Card>

      {/* 4 — Planning */}
      <Card num="4" title="Planning">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <span className={labelCls}>Date souhaitée *</span>
            <input type="date" required className={fieldCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <span className={labelCls}>Heure souhaitée *</span>
            <input type="time" required className={fieldCls} value={heure} onChange={(e) => setHeure(e.target.value)} />
          </div>
        </div>
        <div className="mt-3.5">
          <span className={labelCls}>Informations complémentaires</span>
          <textarea rows={2} className={fieldCls} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Particularités, accès, conditions…" />
        </div>
      </Card>

      {/* Récapitulatif */}
      <Card title="Récapitulatif & estimation">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="border-b border-slate-200 px-2.5 py-2 text-left text-[10.5px] font-bold uppercase text-slate-400">Véhicule</th>
              <th className="border-b border-slate-200 px-2.5 py-2 text-left text-[10.5px] font-bold uppercase text-slate-400">Trajet</th>
              <th className="border-b border-slate-200 px-2.5 py-2 text-right text-[10.5px] font-bold uppercase text-slate-400">Prix estimé</th>
            </tr>
          </thead>
          <tbody>
            {filledRows.map((r) => (
              <tr key={r.key}>
                <td className="border-b border-slate-200 px-2.5 py-3 text-slate-900">
                  {[r.marque, r.modele].filter(Boolean).join(" ") || "Véhicule"}{" "}
                  <span className="text-[11px] text-slate-400">{r.immat}</span>
                </td>
                <td className="border-b border-slate-200 px-2.5 py-3 text-slate-600">
                  <span className="block font-semibold text-slate-900">{groupedTripLabel(r.tripType)}</span>
                  {depart || "—"} → {destFor(r) || "—"}
                </td>
                <td className="border-b border-slate-200 px-2.5 py-3 text-right font-semibold text-slate-900">
                  {prices[r.key] != null ? eur(prices[r.key]) : pricing ? "…" : "Sur devis"}
                </td>
              </tr>
            ))}
            {rows.length > filledRows.length && (
              <tr>
                <td colSpan={3} className="border-b border-slate-200 px-2.5 py-3 italic text-slate-400">
                  Renseignez les plaques et destinations restantes pour compléter l'estimation
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-1 pt-4">
          <span className="text-[12.5px] text-slate-500">
            Total estimé ({filledRows.length}/{rows.length} véhicules)
            {profile?.display === "ht" ? " HT" : ""}
          </span>
          <span className="font-heading text-2xl font-extrabold text-slate-900">
            {eur(profile?.display === "ht" ? Math.round((total / (1 + VAT_RATE)) * 100) / 100 : total)}
          </span>
        </div>

        {invalidVinRows.length > 0 && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            VIN manquant ou invalide sur {invalidVinRows.length} véhicule(s) :{" "}
            {invalidVinRows.map((r) => r.immat.toUpperCase() || "—").join(", ")} — ouvrez « Détails » pour le renseigner.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="h-3.5 w-3.5" /> Votre demande sera traitée sous 24 h par notre équipe.
          </span>

          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="fleet-btn-violet flex items-center gap-2 rounded-[11px] px-5 py-3 text-[13.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Créer la mission groupée
          </button>
        </div>
      </Card>
    </div>
  );
}

function Card({
  num, title, badge, children,
}: { num?: string; title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="qm-card mb-4 p-5 md:px-6 md:py-[22px]">
      <header className="mb-4 flex items-center gap-2.5">
        {num && (
          <span className="flex h-6 w-6 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#2f5fff] to-[#7c5cff] text-xs font-bold text-white shadow-[0_6px_14px_-6px_rgba(47,95,255,.8)]">
            {num}
          </span>
        )}
        <h3 className="qm-section-title">{title}</h3>
        {badge && (
          <span className="ml-auto rounded-full bg-[#eef2ff] px-3 py-1 text-[11.5px] font-bold text-[#2f5fff]">
            {badge}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}
