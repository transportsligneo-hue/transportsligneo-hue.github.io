import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  MapPin, MapPinned, User, Phone, Calendar, Clock, Car,
  Loader2, Send, CheckCircle, Info, Sparkles, Star, Search, Zap, Fuel, Sparkle, KeyRound, Wrench,
  Repeat,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PlacesInput from "@/components/PlacesInput";
import { notifyAdmin } from "@/lib/admin-notifications";
import { sendTransactionalEmail } from "@/lib/email/send";
import { resolveClientPrice, computeOptionSupplements, type OptionKey } from "@/lib/client-pricing";
import { calculateBasePrice, type TripType } from "@/lib/reservation-pricing";
import { resolveDistanceKm } from "@/lib/resolve-distance";
import { lookupPlate } from "@/lib/plate.functions";
import { ScanToPrefill } from "@/components/scanner/ScanToPrefill";
import { FleetDevisSuccess } from "@/components/flotte/FleetDevisSuccess";
import { QrHandoffButton } from "@/components/scanner/QrHandoffButton";
import type { ExtractedFields } from "@/lib/scanner/types";
import { toast } from "sonner";
import { PV_PLATEFORMES, PvLogo, pvDef, type PvChoice } from "@/components/mission/pv-plateformes";

type TripOption = "aller-simple" | "aller-retour" | "express" | "recharge";
type DisplayMode = "ttc" | "ht" | "exempt";

interface ProfileInfo {
  email: string;
  prenom: string;
  nom: string;
  telephone: string;
  societe: string;
  pricing_display_mode: DisplayMode;
  tva_exemption_note: string | null;
}

interface FavoriteAddress {
  id: string;
  label: string;
  address: string;
  ville: string | null;
  code_postal: string | null;
  address_type: "depart" | "arrivee" | "both";
  contact_nom: string | null;
  contact_tel: string | null;
  contact_email: string | null;
  notes_acces: string | null;
  is_default: boolean;
}


const VEHICLE_TYPES = [
  { value: "citadine", label: "Citadine" },
  { value: "berline", label: "Berline" },
  { value: "suv", label: "SUV" },
  { value: "break", label: "Break" },
  { value: "monospace", label: "Monospace" },
  { value: "coupe", label: "Coupé" },
  { value: "cabriolet", label: "Cabriolet" },
  { value: "luxe", label: "Luxe / Supercar" },
  { value: "utilitaire", label: "Utilitaire" },
  { value: "autre", label: "Autre" },
];

const ENERGIES = [
  { value: "essence", label: "Essence" },
  { value: "diesel", label: "Diesel" },
  { value: "hybride", label: "Hybride" },
  { value: "hybride_rechargeable", label: "Hybride rechargeable" },
  { value: "electrique", label: "Électrique" },
  { value: "gpl", label: "GPL" },
  { value: "autre", label: "Autre" },
];

const OPTIONS_DEF: { key: OptionKey; label: string; desc: string; Icon: typeof Zap }[] = [
  { key: "recharge_electrique", label: "Recharge électrique", desc: "Brancher pour le trajet", Icon: Zap },
  { key: "plein_essence", label: "Appoint carburant", desc: "Carburant ajouté selon le niveau souhaité", Icon: Fuel },
  { key: "nettoyage", label: "Nettoyage véhicule", desc: "Lavage extérieur si utile", Icon: Sparkle },
  { key: "mise_en_main", label: "Mise en main du véhicule", desc: "Remise en main propre avec clés et documents", Icon: KeyRound },
];

const JOKEAGE_SERVICES = [
  { key: "controle_technique", label: "Contrôle technique" },
  { key: "revision", label: "Révision / entretien" },
  { key: "lavage", label: "Lavage" },
  { key: "garage", label: "Dépôt ou récupération au garage" },
] as const;

type JokeageService = (typeof JOKEAGE_SERVICES)[number]["key"];

const VAT_RATE = 0.20;

interface Props {
  successRedirect?: string;
  /** "particulier" = version allégée (sans options réservées aux flottes). */
  variant?: "pro" | "particulier";
}

export default function QuickMissionForm({
  successRedirect = "/dashboard-pro/missions",
  variant = "pro",
}: Props) {
  const isParticulier = variant === "particulier";
  const { user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteAddress[]>([]);

  // Form
  const [tripType, setTripType] = useState<TripOption>("aller-simple");
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>(null);
  const [depart, setDepart] = useState("");
  const [arrivee, setArrivee] = useState("");
  const [contactDepartNom, setContactDepartNom] = useState("");
  const [contactDepartTel, setContactDepartTel] = useState("");
  const [contactDepartNote, setContactDepartNote] = useState("");
  const [contactArriveeNom, setContactArriveeNom] = useState("");
  const [contactArriveeTel, setContactArriveeTel] = useState("");
  const [contactArriveeNote, setContactArriveeNote] = useState("");

  // Véhicule
  const [vehicleType, setVehicleType] = useState("berline");
  const [immat, setImmat] = useState("");
  const [vin, setVin] = useState("");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [energie, setEnergie] = useState("");
  const [couleur, setCouleur] = useState("");
  const [km, setKm] = useState("");
  const [vehNotes, setVehNotes] = useState("");
  const [plateBusy, setPlateBusy] = useState(false);
  const [previousTrip, setPreviousTrip] = useState<{ numero: string; ville_depart: string; ville_arrivee: string; date_prise_en_charge: string; marque: string | null; modele: string | null; vin: string | null } | null>(null);

  // Restitution (Aller-retour) · 2e véhicule + adresses différentes
  const [sameRetourAddress, setSameRetourAddress] = useState(true);
  const [departRetour, setDepartRetour] = useState("");
  const [arriveeRetour, setArriveeRetour] = useState("");
  const [sameRetourVehicle, setSameRetourVehicle] = useState(false);
  const [immatRetour, setImmatRetour] = useState("");
  const [marqueRetour, setMarqueRetour] = useState("");
  const [modeleRetour, setModeleRetour] = useState("");
  const [vinRetour, setVinRetour] = useState("");
  const [dateRetour, setDateRetour] = useState("");
  const [heureRetour, setHeureRetour] = useState("");
  const [plateRetourBusy, setPlateRetourBusy] = useState(false);

  // Options
  const [options, setOptions] = useState<Partial<Record<OptionKey, boolean>>>({});
  const [jokeage, setJokeage] = useState(false);
  const [jokeageServices, setJokeageServices] = useState<Partial<Record<JokeageService, boolean>>>({});
  const [autreNote, setAutreNote] = useState("");
  const [pvDigitalise, setPvDigitalise] = useState<PvChoice>("aucun");

  // Planning
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [dateLivraison, setDateLivraison] = useState("");
  const [heureLivraison, setHeureLivraison] = useState("");
  const [message, setMessage] = useState("");

  // Brouillons (numéro de devis réservé à la création du brouillon)
  type Draft = { id: string; numero: string; form: Record<string, unknown> };
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftNumero, setDraftNumero] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase.from("devis_brouillons" as never).select("id, numero, form")
      .is("consumed_at", null).order("created_at", { ascending: false })
      .then(({ data }) => setDrafts(((data ?? []) as unknown) as Draft[]));
  }, [user]);

  const snapshot = () => ({
    tripType, depart, arrivee, contactDepartNom, contactDepartTel, contactDepartNote,
    contactArriveeNom, contactArriveeTel, contactArriveeNote, vehicleType, immat, vin, marque, modele,
    energie, couleur, km, vehNotes, sameRetourAddress, departRetour, arriveeRetour, sameRetourVehicle,
    immatRetour, marqueRetour, modeleRetour, vinRetour, dateRetour, heureRetour, options, jokeage,
    jokeageServices, autreNote, pvDigitalise, date, heure, dateLivraison, heureLivraison, message,
  });

  function loadDraft(d: Draft) {
    const f = d.form as Record<string, any>;
    const s = (v: unknown) => (typeof v === "string" ? v : "");
    setTripType((f.tripType as TripOption) ?? "aller-simple");
    setDepart(s(f.depart)); setArrivee(s(f.arrivee));
    setContactDepartNom(s(f.contactDepartNom)); setContactDepartTel(s(f.contactDepartTel)); setContactDepartNote(s(f.contactDepartNote));
    setContactArriveeNom(s(f.contactArriveeNom)); setContactArriveeTel(s(f.contactArriveeTel)); setContactArriveeNote(s(f.contactArriveeNote));
    setVehicleType(s(f.vehicleType) || "berline"); setImmat(s(f.immat)); setVin(s(f.vin)); setMarque(s(f.marque)); setModele(s(f.modele));
    setEnergie(s(f.energie)); setCouleur(s(f.couleur)); setKm(s(f.km)); setVehNotes(s(f.vehNotes));
    setSameRetourAddress(f.sameRetourAddress !== false); setDepartRetour(s(f.departRetour)); setArriveeRetour(s(f.arriveeRetour));
    setSameRetourVehicle(!!f.sameRetourVehicle); setImmatRetour(s(f.immatRetour)); setMarqueRetour(s(f.marqueRetour));
    setModeleRetour(s(f.modeleRetour)); setVinRetour(s(f.vinRetour)); setDateRetour(s(f.dateRetour)); setHeureRetour(s(f.heureRetour));
    setOptions(f.options ?? {}); setJokeage(!!f.jokeage); setJokeageServices(f.jokeageServices ?? {}); setAutreNote(s(f.autreNote));
    if (f.pvDigitalise) setPvDigitalise(f.pvDigitalise as PvChoice);
    setDate(s(f.date)); setHeure(s(f.heure)); setDateLivraison(s(f.dateLivraison)); setHeureLivraison(s(f.heureLivraison)); setMessage(s(f.message));
    setDraftId(d.id); setDraftNumero(d.numero);
    toast.success(`Brouillon ${d.numero} repris`);
  }

  async function saveDraft() {
    if (!user) return;
    setSavingDraft(true);
    try {
      const form = snapshot();
      if (draftId) {
        const { error } = await supabase.from("devis_brouillons" as never)
          .update({ form, updated_at: new Date().toISOString() } as never).eq("id", draftId);
        if (error) throw error;
        setDrafts((ds) => ds.map((d) => (d.id === draftId ? { ...d, form } : d)));
        toast.success(`Brouillon ${draftNumero} mis à jour`);
      } else {
        const { data, error } = await supabase.rpc("create_devis_brouillon" as never, { _form: form } as never);
        if (error) throw error;
        const row = data as unknown as Draft;
        setDraftId(row.id); setDraftNumero(row.numero);
        setDrafts((ds) => [row, ...ds]);
        toast.success(`Brouillon enregistré · numéro ${row.numero} réservé`);
      }
    } catch {
      toast.error("Impossible d'enregistrer le brouillon");
    } finally {
      setSavingDraft(false);
    }
  }

  // Pricing
  const [pricing, setPricing] = useState<{
    base: number;
    baseLabel: string;
    supplements: Partial<Record<OptionKey, number>>;
  } | null>(null);
  const [resolving, setResolving] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successDevisId, setSuccessDevisId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load profile + favorites
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: fav }] = await Promise.all([
        supabase
          .from("profiles")
          .select("email, prenom, nom, telephone, societe, pricing_display_mode, tva_exemption_note")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("client_default_addresses" as never)
          .select("id, label, address, ville, code_postal, address_type, contact_nom, contact_tel, contact_email, notes_acces, is_default")
          .eq("active", true)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false }),

      ]);
      if (cancelled) return;
      const pp = p as Partial<ProfileInfo> | null;
      setProfile({
        email: pp?.email ?? user.email ?? "",
        prenom: pp?.prenom ?? "",
        nom: pp?.nom ?? "",
        telephone: pp?.telephone ?? "",
        societe: pp?.societe ?? "",
        pricing_display_mode: (pp?.pricing_display_mode as DisplayMode) ?? "ttc",
        tva_exemption_note: pp?.tva_exemption_note ?? null,
      });
      setFavorites((fav as unknown as FavoriteAddress[]) ?? []);
      setProfileLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Apply favorite address (departure or arrival, depending on type)
  const applyFavorite = (f: FavoriteAddress, forceTarget?: "depart" | "arrivee") => {
    setDefaultAddressId(f.id);
    const target = forceTarget ?? (f.address_type === "arrivee" ? "arrivee" : "depart");
    const fullAddr = [f.address, [f.code_postal, f.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    if (target === "depart") {
      setDepart(fullAddr);
      if (f.contact_nom) setContactDepartNom(f.contact_nom);
      if (f.contact_tel) setContactDepartTel(f.contact_tel);
      if (f.notes_acces) setContactDepartNote(f.notes_acces);
    } else {
      setArrivee(fullAddr);
      if (f.contact_nom) setContactArriveeNom(f.contact_nom);
      if (f.contact_tel) setContactArriveeTel(f.contact_tel);
      if (f.notes_acces) setContactArriveeNote(f.notes_acces);
    }
    toast.success(`Adresse « ${f.label} » utilisée (${target === "depart" ? "départ" : "arrivée"})`);
  };

  // Auto-prefill default addresses on first load
  useEffect(() => {
    if (favorites.length === 0) return;
    const defDep = favorites.find(f => f.is_default && (f.address_type === "depart" || f.address_type === "both"));
    const defArr = favorites.find(f => f.is_default && (f.address_type === "arrivee" || f.address_type === "both"));
    if (defDep && !depart) applyFavorite(defDep, "depart");
    if (defArr && !arrivee) applyFavorite(defArr, "arrivee");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favorites]);


  // Reprise rapide : retrouve la dernière mission du même véhicule (RLS = missions du client)
  useEffect(() => {
    const raw = immat.trim().toUpperCase();
    const compact = raw.replace(/[^A-Z0-9]/g, "");
    if (compact.length < 5) { setPreviousTrip(null); return; }
    const dashed = compact.length === 7 ? `${compact.slice(0, 2)}-${compact.slice(2, 5)}-${compact.slice(5)}` : raw;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("missions")
        .select("numero, ville_depart, ville_arrivee, date_prise_en_charge, marque, modele, vin")
        .or(`immatriculation.ilike.${compact},immatriculation.ilike.${dashed}`)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!cancelled) setPreviousTrip(data?.[0] ?? null);
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [immat]);

  // Resolve price whenever inputs change
  useEffect(() => {
    if (!profile || !depart || !arrivee) {
      setPricing(null);
      return;
    }
    let cancelled = false;
    setResolving(true);
    (async () => {
      const resolverTrip = tripType === "aller-retour" ? "aller_retour" : tripType === "express" ? "express" : "aller";
      const custom = await resolveClientPrice({
        userId: user?.id ?? null,
        email: profile.email,
        depart, arrivee, tripType: resolverTrip,
      });
      if (cancelled) return;
      if (custom) {
        setPricing({
          base: custom.prix_ttc,
          baseLabel: custom.zone_label
            ? `Tarif personnalisé · ${custom.zone_label}`
            : "Tarif personnalisé",
          supplements: custom.supplements,
        });
        setResolving(false);
        return;
      }
      const tt: TripType = tripType === "aller-retour" ? "aller_retour" : tripType === "express" ? "express" : "aller_simple";
      let std = calculateBasePrice(depart, arrivee, tt);
      if (std.base <= 0) {
        const km = await resolveDistanceKm(depart, arrivee);
        if (cancelled) return;
        std = calculateBasePrice(depart, arrivee, tt, km);
      }
      if (std.base > 0) {
        setPricing({ base: std.base, baseLabel: std.label, supplements: {} });
      } else {
        setPricing(null);
      }
      setResolving(false);
    })();
    return () => { cancelled = true; };
  }, [depart, arrivee, tripType, profile, user]);

  // Recharge uniquement : pas de livraison, l'adresse d'arrivée = adresse d'intervention
  useEffect(() => {
    if (tripType === "recharge") setArrivee(depart);
  }, [tripType, depart]);

  // Auto-set express option when tripType is express
  useEffect(() => {
    if (tripType === "express") {
      setOptions((o) => ({ ...o, express: true }));
    }
  }, [tripType]);

  useEffect(() => {
    if (tripType === "aller-retour") setSameRetourVehicle(false);
  }, [tripType]);

  // Computed pricing view (incl. supplements)
  const priceView = useMemo(() => {
    if (!pricing) return null;
    const mode: DisplayMode = profile?.pricing_display_mode ?? "ttc";
    const sup = computeOptionSupplements(pricing.supplements, options);
    const ttc = Math.round((pricing.base + sup.total) * 100) / 100;
    const ht = Math.round((ttc / (1 + VAT_RATE)) * 100) / 100;
    const tva = Math.round((ttc - ht) * 100) / 100;
    return { base: pricing.base, baseLabel: pricing.baseLabel, supLines: sup.lines, ttc, ht, tva, mode };
  }, [pricing, options, profile]);

  // Plate lookup
  const handlePlateLookup = async () => {
    if (!immat || immat.length < 4) {
      toast.error("Saisissez une plaque valide");
      return;
    }
    setPlateBusy(true);
    try {
      const result = await lookupPlate({ data: { plate: immat } });
      if (!result.ok || !result.data) {
        toast.error(result.error || "Aucune donnée trouvée · vous pouvez remplir manuellement");
        return;
      }
      const d = result.data;
      if (d.marque && !marque) setMarque(d.marque);
      if (d.modele && !modele) setModele(d.modele);
      if (d.vin && !vin) setVin(d.vin);
      let found = energie;
      if (!energie) {
        if (d.energie) found = d.energie === "hydrogene" || d.energie === "gnv" ? "autre" : d.energie;
        else if (d.carburant) {
          const c = d.carburant.toLowerCase();
          if (c.includes("élec") || c.includes("elec") || c.includes("ev")) found = "electrique";
          else if (c.includes("hyb") && c.includes("rech")) found = "hybride_rechargeable";
          else if (c.includes("hyb")) found = "hybride";
          else if (c.includes("diesel") || c.includes("go") || c.includes("gazole")) found = "diesel";
          else if (c.includes("gpl")) found = "gpl";
          else if (c.includes("ess")) found = "essence";
        }
        if (!found && guessElectricFromModel(d.marque ?? marque, d.modele ?? modele)) found = "electrique";
        if (found) setEnergie(found);
      }
      if (d.categorie) {
        setVehicleType(VEHICLE_TYPES.some((v) => v.value === d.categorie) ? d.categorie : "autre");
      }
      const label = ENERGIES.find((x) => x.value === found)?.label;
      toast.success(label ? `Véhicule récupéré · ${label}` : "Véhicule récupéré · précisez l'énergie");

    } catch {
      toast.error("Service indisponible · vous pouvez remplir manuellement");
    } finally {
      setPlateBusy(false);
    }
  };

  // Plate lookup for return vehicle
  const handlePlateRetourLookup = async () => {
    if (!immatRetour || immatRetour.length < 4) {
      toast.error("Saisissez une plaque retour valide");
      return;
    }
    setPlateRetourBusy(true);
    try {
      const result = await lookupPlate({ data: { plate: immatRetour } });
      if (!result.ok || !result.data) {
        toast.error(result.error || "Aucune donnée trouvée");
        return;
      }
      const d = result.data;
      if (d.marque) setMarqueRetour(d.marque);
      if (d.modele) setModeleRetour(d.modele);
      if (d.vin) setVinRetour(d.vin);
      toast.success("Véhicule retour récupéré");
    } catch {
      toast.error("Service indisponible");
    } finally {
      setPlateRetourBusy(false);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setError(null);

    if (!depart || !arrivee || !date || !heure) {
      setError("Merci de renseigner départ, arrivée, date et heure.");
      return;
    }
    if (tripType === "aller-retour" && (!dateRetour || !heureRetour)) {
      setError("Merci de renseigner la date et l'heure de restitution.");
      return;
    }
    if (tripType === "aller-retour" && !sameRetourVehicle && !immatRetour.trim()) {
      setError("Merci de renseigner la plaque du véhicule de restitution, ou de cocher qu'il s'agit du même véhicule.");
      return;
    }


    setSubmitting(true);
    try {
      const optionsMeta: Record<string, unknown> = {};
      (Object.keys(options) as OptionKey[]).forEach((k) => {
        if (options[k]) optionsMeta[k] = true;
      });
      if (autreNote.trim()) optionsMeta.autre_note = autreNote.trim();
      if (jokeage) {
        optionsMeta.jokeage = true;
        optionsMeta.jokeage_prestations = JOKEAGE_SERVICES
          .filter(({ key }) => jokeageServices[key])
          .map(({ key }) => key);
      }

      const prixTtc = priceView?.ttc ?? null;

      // 1) Crée d'abord un DEVIS (statut "envoye") pour que le client reçoive
      //    immédiatement son estimation par email et le retrouve dans son espace.
      let devisId: string | null = null;
      let devisNumero: string | null = null;
      if (prixTtc && prixTtc > 0) {
        const { data: devisRow, error: devisErr } = await supabase
          .from("devis")
          .insert({
            user_id: user.id,
            ...(draftNumero ? { numero: draftNumero } : {}),
            nom: profile.nom || "Client",
            prenom: profile.prenom || "",
            email: profile.email,
            telephone: profile.telephone || "",
            depart,
            arrivee,
            date_souhaitee: date || null,
            heure_souhaitee: heure || null,
            date_livraison: tripType !== "recharge" && dateLivraison ? dateLivraison : null,
            heure_livraison: tripType !== "recharge" && heureLivraison ? heureLivraison : null,
            marque: marque || null,
            modele: modele || null,
            vin: vin || null,
            carburant: energie || null,
            option_trajet: tripType === "aller-retour" ? "aller_retour" : tripType === "express" ? "express" : tripType === "recharge" ? "recharge_seule" : "aller_simple",
            prix_estime: prixTtc,
            statut: "envoye",
            origine: "demande_client",
            message: message || null,
          } as never)
          .select("id, numero")
          .single();
        if (devisErr) {
          console.warn("[QuickMissionForm] devis insert failed", devisErr);
        } else {
          devisId = (devisRow as { id: string } | null)?.id ?? null;
          devisNumero = (devisRow as { numero: string } | null)?.numero ?? null;
        }
      }

      const payload = {
        user_id: user.id,
        nom: profile.nom || "Client",
        prenom: profile.prenom || "",
        email: profile.email,
        telephone: profile.telephone || "",
        depart,
        arrivee,
        date_souhaitee: date,
        heure_souhaitee: heure || "",
        date_livraison: tripType !== "recharge" && dateLivraison ? dateLivraison : null,
        heure_livraison: tripType !== "recharge" && heureLivraison ? heureLivraison : null,
        message: [
          message,
          profile.societe ? `Société : ${profile.societe}` : "",
        ].filter(Boolean).join("\n"),
        options: tripType,
        options_meta: optionsMeta,
        statut: "nouvelle",
        prix_estime: prixTtc,
        pricing_display_mode: profile.pricing_display_mode,
        default_address_id: defaultAddressId,
        contact_depart_nom: contactDepartNom || null,
        contact_depart_tel: contactDepartTel || null,
        contact_depart_note: contactDepartNote || null,
        contact_arrivee_nom: contactArriveeNom || null,
        contact_arrivee_tel: contactArriveeTel || null,
        contact_arrivee_note: contactArriveeNote || null,
        // Véhicule détaillé
        vehicule_immatriculation: immat || null,
        vehicule_vin: vin || null,
        vehicule_marque: marque || null,
        vehicule_modele: modele || null,
        vehicule_energie: energie || null,
        vehicule_type: vehicleType || null,
        vehicule_couleur: couleur || null,
        vehicule_km: km ? parseInt(km, 10) : null,
        vehicule_notes: vehNotes || null,
        // Rétro-compat
        immatriculation: immat || "",
        marque: marque || "",
        modele: modele || "",
        carburant: energie || "",
        // PV de livraison digitalisé demandé par le client
        pv_digitalise: pvDigitalise,
        // Lien vers le devis auto-généré
        ...(devisId ? { devis_id: devisId, devis_genere_at: new Date().toISOString() } : {}),
        // Restitution (Aller-retour)
        ...(tripType === "aller-retour"
          ? {
              depart_retour: departRetour || arrivee,
              arrivee_retour: sameRetourAddress ? depart : (arriveeRetour || depart),
              recuperation_retour_identique: sameRetourAddress,
              adresse_recuperation_retour: sameRetourAddress ? null : (departRetour || null),
              immatriculation_retour: sameRetourVehicle ? (immat || null) : (immatRetour || null),
              marque_retour: sameRetourVehicle ? (marque || null) : (marqueRetour || null),
              modele_retour: sameRetourVehicle ? (modele || null) : (modeleRetour || null),
              vin_retour: sameRetourVehicle ? (vin || null) : (vinRetour || null),
              date_retour: dateRetour || null,
              heure_retour: heureRetour || null,
            }
          : {}),
      } as never;

      const { data: inserted, error: insErr } = await supabase
        .from("demandes_convoyage")
        .insert(payload)
        .select("id")
        .single();

      if (insErr) throw insErr;

      const demandeId = inserted?.id;
      const numero = devisNumero ?? (demandeId ? `DEM-${String(demandeId).slice(0, 8).toUpperCase()}` : "");
      const clientLabel = profile.societe || `${profile.prenom} ${profile.nom}`.trim() || profile.email;

      // Lier la demande au devis côté devis également (best-effort)
      if (devisId && demandeId) {
        void supabase.from("devis").update({ demande_id: demandeId }).eq("id", devisId);
      }

      // Notification admin (in-app + push web)
      notifyAdmin({
        type: "client_action",
        titre: `Nouvelle demande · ${clientLabel}`,
        message: `${depart} → ${arrivee}${prixTtc ? ` · ${prixTtc.toFixed(0)} €` : ""}${devisNumero ? ` · Devis ${devisNumero}` : ""}`,
        link: devisId ? "/admin/devis" : "/admin/demandes",
        entityType: devisId ? "devis" : "demande",
        entityId: devisId ?? demandeId,
      }).catch(() => {});

      // Emails transactionnels : devis client + notif admin · non bloquants
      void Promise.allSettled([
        devisId
          ? sendTransactionalEmail({
              templateName: "devis-client",
              recipientEmail: profile.email,
              idempotencyKey: `devis-${devisId}`,
              templateData: {
                prenom: profile.prenom,
                nom: profile.nom,
                numero,
                depart,
                arrivee,
                prix: prixTtc,
                optionTrajet: tripType,
              },
            })
          : sendTransactionalEmail({
              templateName: "demande-confirmation",
              recipientEmail: profile.email,
              idempotencyKey: demandeId ? `demande-confirm-${demandeId}` : undefined,
              templateData: {
                prenom: profile.prenom,
                nom: profile.nom,
                depart,
                arrivee,
              },
            }),
        sendTransactionalEmail({
          templateName: devisId ? "devis-cree-admin" : "nouvelle-demande-admin",
          idempotencyKey: devisId
            ? `admin-devis-${devisId}`
            : (demandeId ? `admin-demande-${demandeId}` : undefined),
          templateData: {
            prenom: profile.prenom,
            nom: profile.nom,
            email: profile.email,
            telephone: profile.telephone,
            depart,
            arrivee,
            date: date || " · ",
            prix: prixTtc,
            numero,
            type: tripType,
          },
        }),
      ]).then(() => {
        if (devisId) void supabase.from("devis").update({ email_envoye: true }).eq("id", devisId);
      }).catch(() => {});


      if (draftId && !devisId) void supabase.from("devis_brouillons" as never).delete().eq("id", draftId);
      setSuccess(true);
      setSubmitting(false);
      if (devisId) {
        setSuccessDevisId(devisId);
      } else {
        setTimeout(() => navigate({ to: successRedirect }), 1600);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi";
      setError(msg);
      setSubmitting(false);
    }
  }

  if (profileLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-pro-accent" size={28} />
      </div>
    );
  }

  if (successDevisId) {
    return (
      <FleetDevisSuccess
        devisId={successDevisId}
        subtitle="Votre demande a bien été transmise à notre équipe."
        onNewRequest={() => {
          setSuccessDevisId(null);
          setSuccess(false);
          setError(null);
          setDepart(""); setArrivee("");
          setContactDepartNom(""); setContactDepartTel(""); setContactDepartNote("");
          setContactArriveeNom(""); setContactArriveeTel(""); setContactArriveeNote("");
          setImmat(""); setVin(""); setMarque(""); setModele(""); setEnergie("");
          setCouleur(""); setKm(""); setVehNotes("");
          setDepartRetour(""); setArriveeRetour(""); setImmatRetour("");
          setMarqueRetour(""); setModeleRetour(""); setVinRetour("");
          setDateRetour(""); setHeureRetour("");
          setSameRetourAddress(true); setSameRetourVehicle(false);
          setOptions({}); setJokeage(false); setJokeageServices({}); setAutreNote(""); setPvDigitalise("aucun");
          setDate(""); setHeure(""); setMessage("");
          setPricing(null);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    );
  }

  if (success) {
    return (
      <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center">
        <CheckCircle className="text-emerald-500 mx-auto mb-3" size={40} />
        <h2 className="text-lg font-semibold text-pro-text">Demande envoyée</h2>
        <p className="text-pro-text-soft text-sm mt-2">
          Votre demande a bien été transmise à notre équipe. Vous la retrouverez dans vos missions.
        </p>
      </div>
    );
  }


  const inp = "qm-input";
  const lbl = "qm-label";


  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {(drafts.length > 0 || draftNumero) && (
        <section className="qm-card p-4">
          <h2 className="qm-section-title mb-2"><Save size={14} className="text-pro-accent" /> Brouillons</h2>
          {draftNumero && (
            <p className="text-xs text-pro-text mb-2">Brouillon en cours : <strong className="text-pro-accent">{draftNumero}</strong> — ce numéro sera conservé à la validation.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {drafts.filter((d) => d.id !== draftId).map((d) => (
              <button key={d.id} type="button" onClick={() => loadDraft(d)}
                className="rounded-full border border-pro-border px-3 py-1.5 text-xs font-medium text-pro-text hover:border-pro-accent">
                {d.numero} · {String((d.form as Record<string, unknown>).depart ?? "").slice(0, 24) || "sans adresse"}
              </button>
            ))}
          </div>
        </section>
      )}
      {/* Type de prestation */}
      <section className="qm-card p-5 md:p-6">
        <h2 className="qm-section-title mb-4">
          <Sparkles size={14} className="text-pro-accent" /> Type de prestation
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { v: "aller-simple", label: "Livraison simple", desc: "Aller à destination" },
            { v: "aller-retour", label: "Livraison + restitution", desc: "Aller-retour" },
            { v: "recharge", label: "Recharge uniquement", desc: "Recharge du véhicule, sans livraison" },
          ].map((opt) => {
            const active = tripType === (opt.v as TripOption);
            return (
              <button
                key={opt.v} type="button"
                onClick={() => setTripType(opt.v as TripOption)}
                className={`qm-choice ${active ? "is-active" : ""}`}
              >
                <p className="qm-choice-title">{opt.label}</p>
                <p className="qm-choice-desc">{opt.desc}</p>

              </button>
            );
          })}
        </div>
      </section>

      {/* Départ */}
      <section className="qm-card p-5 md:p-6">
        <h2 className="qm-section-title mb-4">
          <MapPin size={14} className="text-pro-accent" /> Lieu d'enlèvement
        </h2>

        {!isParticulier && favorites.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-pro-text-soft mb-2 flex items-center gap-1">
              <Star size={11} className="text-amber-500" /> Adresses favorites
            </p>
            <div className="flex flex-wrap gap-2">
              {favorites.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => applyFavorite(f)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    defaultAddressId === f.id
                      ? "bg-amber-50 border-amber-300 text-amber-900"
                      : "bg-white border-pro-border text-pro-text hover:border-pro-accent/50"
                  }`}
                  title={f.address}
                >
                  {f.is_default && <Star size={11} className="fill-amber-500 text-amber-500" />}
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className={lbl}>Adresse de départ</label>
            <PlacesInput
              value={depart}
              onChange={(v) => { setDepart(v); if (defaultAddressId) setDefaultAddressId(null); }}
              placeholder="Ex : 14 rue Nationale, Tours"
              className={inp}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}><User size={11} className="inline mr-1" /> Contact sur place</label>
              <input className={inp} value={contactDepartNom} onChange={(e) => setContactDepartNom(e.target.value)} placeholder="Nom du contact" />
            </div>
            <div>
              <label className={lbl}><Phone size={11} className="inline mr-1" /> Téléphone</label>
              <input className={inp} value={contactDepartTel} onChange={(e) => setContactDepartTel(e.target.value)} placeholder="06 12 34 56 78" inputMode="tel" />
            </div>
          </div>
          <div>
            <label className={lbl}>Commentaire (clés, horaires, parking...)</label>
            <input className={inp} value={contactDepartNote} onChange={(e) => setContactDepartNote(e.target.value)} placeholder="Optionnel" />
          </div>
        </div>
      </section>

      {/* Arrivée */}
      {tripType === "recharge" ? (
        <section className="qm-card p-5 md:p-6">
          <h2 className="qm-section-title mb-2">
            <MapPinned size={14} className="text-pro-accent" /> Pas de livraison
          </h2>
          <p className="text-xs text-pro-text-soft">
            Recharge uniquement : le véhicule est rechargé puis restitué à la même adresse
            ({depart || "adresse d'enlèvement"}). Aucune adresse de livraison n'est nécessaire.
          </p>
        </section>
      ) : (
      <section className="qm-card p-5 md:p-6">
        <h2 className="qm-section-title mb-4">
          <MapPinned size={14} className="text-pro-accent" /> Lieu de livraison
        </h2>
        <div className="space-y-3">
          <div>
            <label className={lbl}>Adresse d'arrivée</label>
            <PlacesInput
              value={arrivee}
              onChange={setArrivee}
              placeholder="Ex : 5 avenue de la République, Le Mans"
              className={inp}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}><User size={11} className="inline mr-1" /> Contact sur place</label>
              <input className={inp} value={contactArriveeNom} onChange={(e) => setContactArriveeNom(e.target.value)} placeholder="Nom du contact" />
            </div>
            <div>
              <label className={lbl}><Phone size={11} className="inline mr-1" /> Téléphone</label>
              <input className={inp} value={contactArriveeTel} onChange={(e) => setContactArriveeTel(e.target.value)} placeholder="06 12 34 56 78" inputMode="tel" />
            </div>
          </div>
          <div>
            <label className={lbl}>Commentaire (horaires, code, étage...)</label>
            <input className={inp} value={contactArriveeNote} onChange={(e) => setContactArriveeNote(e.target.value)} placeholder="Optionnel" />
          </div>
        </div>
      </section>
      )}


      {/* Véhicule de livraison */}
      <section className="qm-card p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <h2 className="qm-section-title">
            <Car size={14} className="text-pro-accent" /> {tripType === "aller-retour" ? "Véhicule livraison" : "Véhicule"}
          </h2>
          {(() => {
            const applyExtracted = (f: ExtractedFields) => {
              // Le document fait foi pour le véhicule : on écrase les champs.
              if (f.immatriculation) setImmat(f.immatriculation.toUpperCase());
              if (f.vin) setVin(f.vin.toUpperCase());
              if (f.marque) setMarque(f.marque);
              if (f.modele) setModele(f.modele);
              if (f.energie) setEnergie(f.energie.toLowerCase());
              if (f.couleur) setCouleur(f.couleur);
              if (f.kilometrage) setKm(f.kilometrage.replace(/\D/g, ""));
              if (f.lieu_depart && !depart) setDepart(f.lieu_depart);
              if (f.lieu_arrivee && !arrivee) setArrivee(f.lieu_arrivee);
              if (f.client_nom && !contactArriveeNom) setContactArriveeNom(f.client_nom);
              if (f.client_telephone && !contactArriveeTel) setContactArriveeTel(f.client_telephone);
              toast.success("Champs pré-remplis depuis le document");
            };
            return (
              <div className="flex flex-wrap gap-2">
                <ScanToPrefill label="Scanner" multiPage variant="blue" onExtracted={applyExtracted} />
                <QrHandoffButton context="pro_demande" variant="blue" onExtracted={applyExtracted} />
              </div>
            );
          })()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className={lbl}>Immatriculation</label>
            <div className="flex gap-2">
              <input
                className={`${inp} uppercase`}
                value={immat}
                onChange={(e) => setImmat(e.target.value.toUpperCase())}
                placeholder="AA-123-BB"
                maxLength={15}
              />
              <button
                type="button"
                onClick={handlePlateLookup}
                disabled={plateBusy || !immat}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pro-accent text-white text-xs font-medium hover:bg-pro-accent-hover disabled:opacity-50 whitespace-nowrap"
              >
                {plateBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Récupérer
              </button>
            </div>
            <p className="text-[11px] text-pro-text-soft mt-1">
              Récupération automatique des infos véhicule (marque, modèle, énergie). Modifiez si nécessaire.
            </p>
            {(immat || energie) && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-pro-accent/40 px-2 py-1 text-xs font-semibold text-pro-text">
                <Fuel size={12} className="text-pro-accent" />
                Énergie : {energie ? (ENERGIES.find((x) => x.value === energie)?.label ?? energie) : "à préciser"}
              </p>
            )}
            {previousTrip && (
              <div className="qm-repeat mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-pro-accent/40 bg-pro-bg-soft px-3 py-2 text-xs text-pro-text">
                <Repeat size={13} className="text-pro-accent shrink-0" />
                <span className="flex-1 min-w-0">
                  Déjà convoyé : <strong>{previousTrip.ville_depart} → {previousTrip.ville_arrivee}</strong>
                  {" "}({new Date(previousTrip.date_prise_en_charge).toLocaleDateString("fr-FR")})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDepart(previousTrip.ville_depart);
                    if (tripType !== "recharge") setArrivee(previousTrip.ville_arrivee);
                    if (previousTrip.marque && !marque) setMarque(previousTrip.marque);
                    if (previousTrip.modele && !modele) setModele(previousTrip.modele);
                    if (previousTrip.vin && !vin) setVin(previousTrip.vin);
                    toast.success("Trajet repris : vérifiez les adresses exactes");
                  }}
                  className="rounded-md bg-pro-accent px-2.5 py-1 font-semibold text-white hover:bg-pro-accent-hover"
                >
                  Reprendre ce trajet
                </button>
              </div>
            )}
          </div>
          <div>
            <label className={lbl}>VIN / châssis</label>
            <input className={inp} value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="17 caractères" maxLength={17} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className={lbl}>Marque</label>
            <input className={inp} value={marque} onChange={(e) => setMarque(e.target.value)} placeholder="Peugeot" />
          </div>
          <div>
            <label className={lbl}>Modèle</label>
            <input className={inp} value={modele} onChange={(e) => setModele(e.target.value)} placeholder="3008" />
          </div>
          <div>
            <label className={lbl}>Énergie</label>
            <select className={inp} value={energie} onChange={(e) => setEnergie(e.target.value)}>
              <option value=""> · </option>
              {ENERGIES.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Type</label>
            <select className={inp} value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          {!isParticulier && (
            <>
              <div>
                <label className={lbl}>Couleur</label>
                <input className={inp} value={couleur} onChange={(e) => setCouleur(e.target.value)} placeholder="Optionnel" />
              </div>
              <div>
                <label className={lbl}>Kilométrage</label>
                <input type="number" className={inp} value={km} onChange={(e) => setKm(e.target.value)} placeholder="Optionnel" />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <label className={lbl}>{isParticulier ? "Précisions sur le véhicule" : "Notes véhicule"}</label>
            <input className={inp} value={vehNotes} onChange={(e) => setVehNotes(e.target.value)} placeholder="Particularités, état..." />
          </div>
        </div>
      </section>

      {/* Restitution (Aller-retour) */}
      {tripType === "aller-retour" && (
        <section className="qm-card qm-card-purple p-5 md:p-6">
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <h2 className="qm-section-title qm-section-title-purple">
              <Car size={14} /> Véhicule restitution
            </h2>
            {(() => {
              const applyExtractedRetour = (f: ExtractedFields) => {
                if (f.immatriculation) setImmatRetour(f.immatriculation.toUpperCase());
                if (f.vin) setVinRetour(f.vin.toUpperCase());
                if (f.marque) setMarqueRetour(f.marque);
                if (f.modele) setModeleRetour(f.modele);
                toast.success("Champs restitution pré-remplis depuis le document");
              };
              return (
                <div className="flex flex-wrap gap-2">
                  <ScanToPrefill label="Scanner" multiPage variant="purple" onExtracted={applyExtractedRetour} />
                  <QrHandoffButton context="pro_demande" variant="purple" onExtracted={applyExtractedRetour} />
                </div>
              );
            })()}
          </div>
          <p className="text-[12px] text-pro-text-soft mb-4">
            Par défaut, on reprend le véhicule à l'adresse de livraison et on le ramène au point de départ.
            Renseignez sa plaque, ou cochez ci-dessous s'il s'agit du véhicule de livraison.
          </p>

          {/* Adresse de récupération retour */}
          <div className="space-y-3 mb-4">
            <label className="flex items-start gap-2 text-sm text-pro-text cursor-pointer">
              <input
                type="checkbox"
                checked={!sameRetourAddress}
                onChange={(e) => setSameRetourAddress(!e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-pro-accent"
              />
              <span>
                Adresse de récupération retour <em className="text-pro-text-soft">différente</em> de la livraison
              </span>
            </label>
            {!sameRetourAddress && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
                <div>
                  <label className={lbl}>Adresse de récupération retour</label>
                  <PlacesInput value={departRetour} onChange={setDepartRetour} placeholder="Où récupérer le véhicule ?" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Adresse de retour (livraison finale)</label>
                  <PlacesInput value={arriveeRetour} onChange={setArriveeRetour} placeholder={`Par défaut : ${depart || "départ initial"}`} className={inp} />
                </div>
              </div>
            )}
          </div>

          {/* Véhicule retour (réservé aux comptes professionnels) */}
          {!isParticulier && (
          <div className="space-y-3 mb-4">
            <label className="flex items-start gap-2 text-sm text-pro-text cursor-pointer">
              <input
                type="checkbox"
                checked={sameRetourVehicle}
                onChange={(e) => setSameRetourVehicle(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-pro-accent"
              />
              <span>
                Même véhicule que la livraison
              </span>
            </label>
            {!sameRetourVehicle && (
              <div className="pl-6 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                     <label className={lbl}>Plaque restitution *</label>
                    <div className="flex gap-2">
                      <input
                        className={`${inp} uppercase`}
                        value={immatRetour}
                        onChange={(e) => setImmatRetour(e.target.value.toUpperCase())}
                        placeholder="AA-123-BB"
                        maxLength={15}
                        required={!sameRetourVehicle}
                      />
                      <button
                        type="button"
                        onClick={handlePlateRetourLookup}
                        disabled={plateRetourBusy || !immatRetour}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pro-accent text-white text-xs font-medium hover:bg-pro-accent-hover disabled:opacity-50 whitespace-nowrap"
                      >
                        {plateRetourBusy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        Récupérer
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>VIN retour</label>
                    <input className={inp} value={vinRetour} onChange={(e) => setVinRetour(e.target.value.toUpperCase())} maxLength={17} placeholder="Optionnel" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Marque retour</label>
                    <input className={inp} value={marqueRetour} onChange={(e) => setMarqueRetour(e.target.value)} placeholder="Peugeot" />
                  </div>
                  <div>
                    <label className={lbl}>Modèle retour</label>
                    <input className={inp} value={modeleRetour} onChange={(e) => setModeleRetour(e.target.value)} placeholder="208" />
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Date et heure retour */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}><Calendar size={11} className="inline mr-1" /> Date retour *</label>
              <input type="date" className={inp} value={dateRetour} onChange={(e) => setDateRetour(e.target.value)} required min={date || new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className={lbl}><Clock size={11} className="inline mr-1" /> Heure retour *</label>
              <input type="time" className={inp} value={heureRetour} onChange={(e) => setHeureRetour(e.target.value)} required />
            </div>
          </div>

        </section>
      )}

      {/* Options & planning */}
      <section className="qm-card p-5 md:p-6">
        <h2 className="qm-section-title mb-4">
          <Sparkles size={14} className="text-pro-accent" /> Options & planning
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {OPTIONS_DEF.map(({ key, label, desc, Icon }) => {
            const checked = !!options[key];
            const sup = pricing?.supplements?.[key];
            return (
              <label
                key={key}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  checked
                    ? "border-pro-accent bg-pro-accent/5"
                    : "border-pro-border hover:border-pro-accent/40 bg-white"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-pro-accent"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-pro-text flex items-center gap-1.5">
                    <Icon size={13} className="text-pro-accent" /> {label}
                    {sup != null && sup > 0 && (
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        +{sup} €
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-pro-text-soft mt-0.5">{desc}</p>
                </div>
              </label>
            );
          })}
        </div>

        {!isParticulier && (
          <div className="mb-4 rounded-lg border border-pro-border bg-white p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={jokeage}
                onChange={(e) => setJokeage(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-pro-accent"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-pro-text">
                  <Wrench size={13} className="text-pro-accent" /> Jockeyage
                </span>
                <span className="mt-0.5 block text-xs text-pro-text-soft">
                  Déplacement du véhicule vers un prestataire pour une intervention.
                </span>
              </span>
            </label>
            {jokeage && (
              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-pro-border pt-3 sm:grid-cols-2">
                {JOKEAGE_SERVICES.map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-pro-text">
                    <input
                      type="checkbox"
                      checked={!!jokeageServices[key]}
                      onChange={(e) => setJokeageServices((current) => ({ ...current, [key]: e.target.checked }))}
                      className="h-4 w-4 accent-pro-accent"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PV de livraison digitalisé (comptes professionnels) */}
        {!isParticulier && (
        <div className="mb-4">
          <label className={lbl}>PV de livraison digitalisé</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {([{ key: "aucun" as const, label: "Aucun" }, ...PV_PLATEFORMES.map((p) => ({ key: p.key, label: p.label }))]).map(({ key, label }) => {
              const def = pvDef(key);
              const checked = pvDigitalise === key;
              return (
                <label
                  key={key}
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    checked ? "border-pro-accent bg-pro-accent/5" : "border-pro-border hover:border-pro-accent/40 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="pv_digitalise"
                    checked={checked}
                    onChange={() => setPvDigitalise(key)}
                    className="h-4 w-4 accent-pro-accent"
                  />
                  {def ? <PvLogo def={def} size={24} /> : null}
                  <span className="text-sm font-medium text-pro-text">{label}</span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-pro-text-soft mt-1.5">
            Model s'ouvre directement dans l'application mobile du convoyeur, Welcome Auto sur le site internet.
          </p>
        </div>
        )}

        <div className="mb-4">
          <label className={lbl}>Autre demande / commentaire</label>
          <input className={inp} value={autreNote} onChange={(e) => setAutreNote(e.target.value)} placeholder="Optionnel" />
        </div>


        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={lbl}><Calendar size={11} className="inline mr-1" /> Date d'enlèvement *</label>
            <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} required min={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label className={lbl}><Clock size={11} className="inline mr-1" /> Heure d'enlèvement *</label>
            <input type="time" className={inp} value={heure} onChange={(e) => setHeure(e.target.value)} required />
          </div>
        </div>

        {tripType !== "recharge" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div>
              <label className={lbl}><Calendar size={11} className="inline mr-1" /> Date de livraison</label>
              <input type="date" className={inp} value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} min={date || new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className={lbl}><Clock size={11} className="inline mr-1" /> Heure de livraison</label>
              <input type="time" className={inp} value={heureLivraison} onChange={(e) => setHeureLivraison(e.target.value)} />
            </div>
          </div>
        )}

        <div className="mt-3">
          <label className={lbl}>Informations complémentaires</label>
          <textarea className={`${inp} min-h-[70px] resize-y`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Particularités, accès, conditions..." />
        </div>
      </section>

      {/* Récap prix */}
      <section className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-pro-border p-5 md:p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-pro-text">Récapitulatif & estimation</h2>
          {priceView && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
              priceView.mode === "exempt"
                ? "bg-slate-200 text-slate-800"
                : priceView.mode === "ht"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-emerald-100 text-emerald-800"
            }`}>
              {priceView.mode === "exempt" ? "Non soumis TVA" : priceView.mode === "ht" ? "Affichage HT" : "Affichage TTC"}
            </span>
          )}
        </div>
        {resolving ? (
          <div className="flex items-center gap-2 text-pro-text-soft text-sm">
            <Loader2 size={14} className="animate-spin" /> Calcul en cours...
          </div>
        ) : !priceView ? (
          <p className="text-pro-text-soft text-sm">
            Renseignez les adresses pour obtenir une estimation.
          </p>
        ) : (
          <PriceRecap view={priceView} note={profile?.tva_exemption_note ?? null} />
        )}
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* CTA sticky mobile */}
      <div className="sticky bottom-0 -mx-3 sm:mx-0 sm:static z-10 bg-white/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-0 border-t border-pro-border sm:border-0 px-3 sm:px-0 py-3 sm:py-0 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <p className="text-xs text-pro-text-soft flex items-center gap-1.5">
          <Info size={12} /> Votre demande sera traitée sous 24h par notre équipe.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={saveDraft}
          disabled={savingDraft || submitting}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border border-pro-accent text-pro-accent bg-transparent text-sm font-medium hover:bg-pro-accent/10 disabled:opacity-50"
        >
          {savingDraft ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {draftNumero ? `Mettre à jour le brouillon ${draftNumero}` : "Enregistrer en brouillon"}
        </button>
        <button
          type="submit"
          disabled={submitting || !depart || !arrivee || !date || !heure || (tripType === "aller-retour" && (!dateRetour || !heureRetour || (!sameRetourVehicle && !immatRetour.trim())))}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-pro-accent text-white text-sm font-medium hover:bg-pro-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {draftNumero ? `Valider le devis ${draftNumero}` : "Créer la demande de mission"}
        </button>
        </div>
      </div>
    </form>
  );
}

function PriceRecap({
  view, note,
}: {
  view: {
    base: number;
    baseLabel: string;
    supLines: { key: OptionKey; label: string; amount: number }[];
    ttc: number;
    ht: number;
    tva: number;
    mode: DisplayMode;
  };
  note: string | null;
}) {
  const fmt = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
  const isExempt = view.mode === "exempt";

  return (
    <div className="space-y-3 text-pro-text">
      <p className="text-xs text-pro-text-soft uppercase tracking-wide">{view.baseLabel}</p>

      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-pro-text-soft">Prestation de base</span>
          <span className="font-medium text-pro-text">{fmt(view.base)}</span>
        </div>
        {view.supLines.map((l) => (
          <div key={l.key} className="flex items-center justify-between text-emerald-700">
            <span>+ {l.label}</span>
            <span className="font-medium">{fmt(l.amount)}</span>
          </div>
        ))}
      </div>

      <div className="flex items-end justify-between flex-wrap gap-3 border-t border-pro-border pt-3">
        {isExempt ? (
          <>
            <div>
              <p className="text-xs text-pro-text-soft uppercase tracking-wide">Montant</p>
              <p className="text-2xl font-bold text-pro-text">{fmt(view.ttc)}</p>
              <p className="text-[11px] text-pro-text-soft">{note || "TVA non applicable"}</p>
            </div>
          </>
        ) : view.mode === "ht" ? (
          <>
            <div>
              <p className="text-xs text-pro-text-soft uppercase tracking-wide">Total HT</p>
              <p className="text-2xl font-bold text-pro-text">{fmt(view.ht)}</p>
              <p className="text-[11px] text-pro-text-soft">TVA 20 % : {fmt(view.tva)} · TTC : {fmt(view.ttc)}</p>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-pro-text-soft uppercase tracking-wide">Total TTC</p>
              <p className="text-2xl font-bold text-pro-text">{fmt(view.ttc)}</p>
              <p className="text-[11px] text-pro-text-soft">HT : {fmt(view.ht)} · TVA 20 % : {fmt(view.tva)}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
