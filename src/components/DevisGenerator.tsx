import { useState, useMemo, useEffect } from "react";
import {
  MapPin, MapPinned, Clock, Car, Fuel, Calendar, ChevronDown, Send, Loader2,
  CheckCircle, User, Download, Shield, Route as RouteIcon,
  Sparkles, ArrowRight, ArrowLeft, FileText, Lock, MailCheck
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { generateDevisPdf, downloadDevisPdf, type DevisData } from "@/lib/devis-pdf";
import { sendTransactionalEmail } from "@/lib/email/send";
import { notifyAdmin } from "@/lib/admin-notifications";
import { getRecaptchaToken } from "@/lib/recaptcha";
import PlacesInput from "@/components/PlacesInput";
import { getGoogleDistanceKm, isGoogleAvailable } from "@/lib/google-places";
import { resolveLocalDeptTariff } from "@/lib/pricing-departments";
import { useServerFn } from "@tanstack/react-start";
import { lookupPlate } from "@/lib/plate.functions";
import { resolvePersonalizedPrice } from "@/lib/pricing.functions";
import { ScanToPrefill } from "@/components/scanner/ScanToPrefill";
import { QrHandoffButton } from "@/components/scanner/QrHandoffButton";
import type { ExtractedFields } from "@/lib/scanner/types";
import { toast } from "sonner";


// === Pricing data (inchangé) ===
const CITY_DISTANCES: Record<string, Record<string, number>> = {
  "Tours": { "Paris": 237, "Lyon": 477, "Marseille": 700, "Bordeaux": 350, "Nantes": 218, "Lille": 460, "Strasbourg": 620, "Toulouse": 530, "Nice": 840, "Montpellier": 640, "Rennes": 300, "Orléans": 117, "Poitiers": 100, "Limoges": 220, "Clermont-Ferrand": 335, "Angers": 110, "Le Mans": 82, "Blois": 60, "Chartres": 140, "Rouen": 310, "Caen": 320, "Dijon": 400, "Reims": 380, "Metz": 520, "Nancy": 500, "Brest": 530, "La Rochelle": 230, "Perpignan": 750, "Grenoble": 540, "Saint-Étienne": 430, "Amiens": 390, "Bourges": 155, "Châteauroux": 110, "Tours": 0 },
  "Paris": { "Lyon": 465, "Marseille": 775, "Bordeaux": 585, "Nantes": 385, "Lille": 225, "Strasbourg": 490, "Toulouse": 680, "Nice": 930, "Montpellier": 750, "Rennes": 350, "Orléans": 130, "Poitiers": 340, "Limoges": 395, "Clermont-Ferrand": 420, "Angers": 300, "Le Mans": 210, "Blois": 185, "Chartres": 90, "Rouen": 135, "Caen": 240, "Dijon": 310, "Reims": 145, "Metz": 330, "Nancy": 380, "Brest": 590, "La Rochelle": 470, "Perpignan": 850, "Grenoble": 570, "Saint-Étienne": 530, "Amiens": 150, "Bourges": 240, "Châteauroux": 260, "Paris": 0 },
};
const CITY_DEPARTMENTS: Record<string, string> = { "Tours": "37-intra", "Châteauroux": "37-hors" };
const FIXED_TARIFFS: Record<string, [number, number]> = { "37-intra": [79, 129], "37-hors": [99, 129] };
const DEPARTMENT_LABELS: Record<string, string> = { "37-intra": "Forfait Tours intra", "37-hors": "Forfait hors agglomération (37)" };
const CITIES = ["Tours","Paris","Lyon","Marseille","Bordeaux","Nantes","Lille","Strasbourg","Toulouse","Nice","Montpellier","Rennes","Orléans","Poitiers","Limoges","Clermont-Ferrand","Angers","Le Mans","Blois","Chartres","Rouen","Caen","Dijon","Reims","Metz","Nancy","Brest","La Rochelle","Perpignan","Grenoble","Saint-Étienne","Amiens","Bourges","Châteauroux"].sort();
const VEHICLE_TYPES = [{value:"citadine",label:"Citadine"},{value:"berline",label:"Berline"},{value:"suv",label:"SUV"},{value:"utilitaire",label:"Utilitaire"},{value:"autre",label:"Autre"}];
const ENERGY_TYPES = [{value:"diesel",label:"Diesel"},{value:"essence",label:"Essence"},{value:"electrique",label:"Électrique"},{value:"hybride",label:"Hybride"}];

function extractCity(addr: string): string {
  if (!addr) return "";
  const all = new Set<string>([...CITIES, ...Object.keys(CITY_DEPARTMENTS)]);
  const lower = addr.toLowerCase();
  // priorité aux villes les plus longues pour éviter de matcher "Tours" dans "Tourcoing"
  const sorted = [...all].sort((a, b) => b.length - a.length);
  for (const c of sorted) {
    const re = new RegExp(`(^|[^a-zà-ÿ])${c.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}([^a-zà-ÿ]|$)`, "i");
    if (re.test(lower)) return c;
  }
  return "";
}

function getDistance(from: string, to: string): number | null {
  const cFrom = extractCity(from) || from;
  const cTo = extractCity(to) || to;
  if (cFrom === cTo) return 0;
  if (CITY_DISTANCES[cFrom]?.[cTo]) return CITY_DISTANCES[cFrom][cTo];
  if (CITY_DISTANCES[cTo]?.[cFrom]) return CITY_DISTANCES[cTo][cFrom];
  const a = CITY_DISTANCES["Tours"]?.[cFrom] ?? CITY_DISTANCES[cFrom]?.["Tours"];
  const b = CITY_DISTANCES["Tours"]?.[cTo] ?? CITY_DISTANCES[cTo]?.["Tours"];
  if (a != null && b != null) return Math.round((a + b) * 0.85);
  return null;
}
function calculatePrice(distance: number, departure: string, arrival: string, option: string) {
  // 1) Tarif local par département (zone agglo basée sur les codes postaux)
  const local = resolveLocalDeptTariff(departure, arrival, distance, option);
  if (local) return local;
  // 2) Trajet très court / même ville hors zone forfaitaire · minimum existant
  if (distance <= 0) {
    const [simple] = FIXED_TARIFFS["37-intra"];
    const label = "Forfait local (minimum)";
    if (option === "aller-retour") return { price: simple, label, finalPrice: FIXED_TARIFFS["37-intra"][1], multiplierLabel: "Aller-retour", hasExtra: true };
    if (option === "express") return { price: simple, label, finalPrice: Math.round(simple * 1.20), multiplierLabel: "+20% express", hasExtra: true };
    return { price: simple, label, finalPrice: simple, multiplierLabel: "", hasExtra: false };
  }
  // 3) Calcul kilométrique longue distance (inchangé)
  const rate = distance < 200 ? 1.20 : 0.85;
  const rateLabel = distance < 200 ? "1,20 €/km" : "0,85 €/km";
  const basePrice = Math.round(distance * rate);
  if (option === "aller-retour") return { price: basePrice, label: rateLabel, finalPrice: Math.round(basePrice * 1.5), multiplierLabel: "Tarif aller-retour", hasExtra: true };
  if (option === "express") return { price: basePrice, label: rateLabel, finalPrice: Math.round(basePrice * 1.20), multiplierLabel: "+20% express", hasExtra: true };
  return { price: basePrice, label: rateLabel, finalPrice: basePrice, multiplierLabel: "", hasExtra: false };
}
function estimateDuration(distance: number): string {
  const hours = distance / 80;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours); const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

export interface DevisGeneratorPrefill {
  nom?: string;
  prenom?: string;
  email?: string;
  telephone?: string;
  societe?: string;
}

export interface DevisGeneratorProps {
  /** Prefill contact fields (used when user is logged in). */
  prefill?: DevisGeneratorPrefill;
  /** Skip the account creation block (used inside authenticated dashboards). */
  hideAccountStep?: boolean;
  /** Where the "Mon espace client" CTA points after submission. */
  successRedirect?: string;
  /**
   * Visual layout of step 0.
   * - "bar"        : current full-width horizontal bar (used on /tarifs and everywhere else).
   * - "hero-card"  : compact vertical card meant to live in the right column of the hero.
   * Only the step-0 visual changes · wizard, calculations and modal are identical.
   */
  variant?: "bar" | "hero-card";
}

export default function DevisGenerator({ prefill, hideAccountStep = false, successRedirect = "/login", variant = "bar" }: DevisGeneratorProps = {}) {
  // --- core trajet ---
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [option, setOption] = useState<"aller-simple" | "aller-retour" | "express">("aller-simple");


  // --- Restitution (uniquement pour Aller-retour) ---
  const [sameDestination, setSameDestination] = useState(true);
  const [departRetour, setDepartRetour] = useState("");
  const [arriveeRetour, setArriveeRetour] = useState("");
  const [immatRetour, setImmatRetour] = useState("");
  const [marqueRetour, setMarqueRetour] = useState("");
  const [modeleRetour, setModeleRetour] = useState("");
  const [vinRetour, setVinRetour] = useState("");
  const [sivRetourLoading, setSivRetourLoading] = useState(false);
  const [sivRetourMsg, setSivRetourMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function handleSivRetourLookup() {
    setSivRetourMsg(null);
    const plate = immatRetour.trim().toUpperCase();
    if (!plate || plate.length < 4) {
      setSivRetourMsg({ type: "err", text: "Saisis une plaque valide" });
      return;
    }
    setSivRetourLoading(true);
    try {
      const captchaToken = (await getRecaptchaToken("plate_lookup")) ?? undefined;
      const r = await lookupPlateFn({ data: { plate, recaptchaToken: captchaToken } });
      if (!r.ok || !r.data) {
        setSivRetourMsg({ type: "err", text: r.error || "Recherche impossible" });
      } else {
        if (r.data.marque) setMarqueRetour(r.data.marque);
        if (r.data.modele) setModeleRetour(r.data.modele);
        if (r.data.vin) setVinRetour(r.data.vin);
        setSivRetourMsg({ type: "ok", text: "Véhicule trouvé ✓" });
      }
    } catch {
      setSivRetourMsg({ type: "err", text: "Erreur réseau" });
    } finally {
      setSivRetourLoading(false);
    }
  }

  // --- véhicule ---
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [immatriculation, setImmatriculation] = useState("");
  const [plaqueInconnue, setPlaqueInconnue] = useState(false);
  const [energy, setEnergy] = useState("");
  const [running, setRunning] = useState<"oui" | "non">("oui");
  const [vin, setVin] = useState("");
  const [annee, setAnnee] = useState("");
  const [puissance, setPuissance] = useState("");
  const [finition, setFinition] = useState("");
  const [sivLoading, setSivLoading] = useState(false);
  const [sivMsg, setSivMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const lookupPlateFn = useServerFn(lookupPlate);

  async function handleSivLookup() {
    setSivMsg(null);
    const plate = immatriculation.trim().toUpperCase();
    if (!plate || plate.length < 4) {
      setSivMsg({ type: "err", text: "Saisis une plaque valide" });
      return;
    }
    setSivLoading(true);
    try {
      const captchaToken = (await getRecaptchaToken("plate_lookup")) ?? undefined;
      const r = await lookupPlateFn({ data: { plate, recaptchaToken: captchaToken } });
      if (!r.ok || !r.data) {
        setSivMsg({ type: "err", text: r.error || "Recherche impossible" });
      } else {
        const d = r.data;
        if (d.marque) setMarque(d.marque);
        if (d.modele) setModele(d.modele);
        if (d.vin) setVin(d.vin);
        if (d.annee) setAnnee(d.annee);
        if (d.puissance) setPuissance(d.puissance);
        if (d.finition) setFinition(d.finition);
        if (d.carburant) {
          const c = d.carburant.toLowerCase();
          if (c.includes("diesel") || c.includes("go") || c.includes("gazole")) setEnergy("diesel");
          else if (c.includes("essence") || c.includes("sp") || c.includes("petrol")) setEnergy("essence");
          else if (c.includes("élec") || c.includes("elec") || c.includes("ev")) setEnergy("electrique");
          else if (c.includes("hybr")) setEnergy("hybride");
        }
        setSivMsg({ type: "ok", text: "Véhicule trouvé ✓" });
      }
    } catch (e: any) {
      setSivMsg({ type: "err", text: "Erreur réseau" });
    } finally {
      setSivLoading(false);
    }
  }

  // --- coordonnées (préremplies si l'utilisateur est connecté) ---
  const [nom, setNom] = useState(prefill?.nom ?? "");
  const [prenom, setPrenom] = useState(prefill?.prenom ?? "");
  const [telephone, setTelephone] = useState(prefill?.telephone ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [societe, setSociete] = useState(prefill?.societe ?? "");
  const [comment, setComment] = useState("");

  // Met à jour les champs quand le prefill arrive après le 1er render (chargement profil)
  useEffect(() => {
    if (!prefill) return;
    if (prefill.nom !== undefined) setNom((v) => v || prefill.nom!);
    if (prefill.prenom !== undefined) setPrenom((v) => v || prefill.prenom!);
    if (prefill.email !== undefined) setEmail((v) => v || prefill.email!);
    if (prefill.telephone !== undefined) setTelephone((v) => v || prefill.telephone!);
    if (prefill.societe !== undefined) setSociete((v) => v || prefill.societe!);
  }, [prefill?.nom, prefill?.prenom, prefill?.email, prefill?.telephone, prefill?.societe]);

  // Reprise d'un parcours guidé Vroomy : pré-remplissage sans perte de saisie
  useEffect(() => {
    if (typeof window === "undefined") return;
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem("ligneo_vroomy_order_prefill");
      if (raw) window.sessionStorage.removeItem("ligneo_vroomy_order_prefill");
    } catch { return; }
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as Record<string, string>;
      if (p.departure) setDeparture((v) => v || p.departure);
      if (p.arrival) setArrival((v) => v || p.arrival);
      if (p.vehicleType) setVehicleType((v) => v || p.vehicleType);
      if (p.date) setDate((v) => v || p.date);
      if (p.option === "aller-simple" || p.option === "aller-retour" || p.option === "express") setOption(p.option);
      if (p.comment) setComment((v) => v || p.comment);
      if (p.nom) setNom((v) => v || p.nom);
      if (p.telephone) setTelephone((v) => v || p.telephone);
    } catch { /* prefill invalide : on ignore */ }
  }, []);




  // --- compte client ---
  const [password, setPassword] = useState("");
  const [cguAccepted, setCguAccepted] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [accountError, setAccountError] = useState("");

  // --- ui ---
  const [step, setStep] = useState(0); // 0 = bar, 1 = trajet, 2 = véhicule, 3 = coordonnées+compte, 4 = récap
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [savedDevis, setSavedDevis] = useState<DevisData | null>(null);

  // Distance Google async (fallback quand pas de match local)
  const [googleDistance, setGoogleDistance] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);

  const localDistance = useMemo(() => {
    if (!departure || !arrival) return null;
    return getDistance(departure, arrival);
  }, [departure, arrival]);

  useEffect(() => {
    setGoogleDistance(null);
    if (!departure || !arrival) return;
    if (localDistance !== null) return; // pas besoin de Google
    if (!isGoogleAvailable()) return;
    let cancelled = false;
    setDistanceLoading(true);
    getGoogleDistanceKm(departure, arrival)
      .then((km) => { if (!cancelled) setGoogleDistance(km); })
      .finally(() => { if (!cancelled) setDistanceLoading(false); });
    return () => { cancelled = true; };
  }, [departure, arrival, localDistance]);

  const distance = localDistance ?? googleDistance;

  // --- Tarifs personnalisés client (lookup automatique si email connu) ---
  type CustomRule = {
    id: string;
    ville_depart: string | null;
    ville_arrivee: string | null;
    trip_type: "aller" | "aller_retour" | "any";
    prix_ttc: number;
    active: boolean;
  };
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  useEffect(() => {
    const lookupEmail = (email || prefill?.email || "").trim().toLowerCase();
    if (!lookupEmail) { setCustomRules([]); return; }
    let cancelled = false;
    supabase
      .from("client_pricing_rules" as never)
      .select("id, ville_depart, ville_arrivee, trip_type, prix_ttc, active")
      .eq("active", true)
      .eq("client_email", lookupEmail)
      .then(({ data }) => {
        if (!cancelled) setCustomRules((data as unknown as CustomRule[]) ?? []);
      });
    return () => { cancelled = true; };
  }, [email, prefill?.email]);

  const customMatch = useMemo(() => {
    if (!customRules.length || !departure || !arrival) return null;
    const dCity = (extractCity(departure) || departure).toLowerCase();
    const aCity = (extractCity(arrival) || arrival).toLowerCase();
    const wantType: CustomRule["trip_type"] = option === "aller-retour" ? "aller_retour" : "aller";
    const candidates = customRules.filter(r => r.trip_type === wantType || r.trip_type === "any");
    // Priorité : match exact ville→ville > match départ seul > match arrivée seul > wildcard
    const matchScore = (r: CustomRule) => {
      const d = (r.ville_depart ?? "").toLowerCase();
      const a = (r.ville_arrivee ?? "").toLowerCase();
      let s = 0;
      if (d && dCity.includes(d)) s += 2; else if (d) return -1;
      if (a && aCity.includes(a)) s += 2; else if (a) return -1;
      if (r.trip_type === wantType) s += 1;
      return s;
    };
    const ranked = candidates
      .map(r => ({ r, score: matchScore(r) }))
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score);
    return ranked[0]?.r ?? null;
  }, [customRules, departure, arrival, option]);

  const pricing = useMemo(() => {
    // 0) Tarif personnalisé client (priorité maximale)
    if (customMatch) {
      const ttc = Number(customMatch.prix_ttc);
      const ht = Math.round((ttc / 1.2) * 100) / 100;
      return { price: ht, label: "Tarif négocié", finalPrice: ht, multiplierLabel: "", hasExtra: false };
    }
    // Forfait local prioritaire : ne dépend pas de la distance
    if (departure && arrival) {
      const local = resolveLocalDeptTariff(departure, arrival, 0, option);
      if (local) return local;
    }
    if (distance === null) return null;
    return calculatePrice(distance, departure, arrival, option);
  }, [customMatch, distance, departure, arrival, option]);



  // Prix serveur (source de vérité unique) · aligne l'estimateur avec la règle DB
  const resolveServerPrice = useServerFn(resolvePersonalizedPrice);
  const [serverTtc, setServerTtc] = useState<number | null>(null);
  useEffect(() => {
    setServerTtc(null);
    if (!departure || !arrival || !pricing) return;
    // Les grilles publiques (forfaits dept + tarifs km) sont DÉJÀ exprimées en TTC client.
    // On envoie le TTC tel quel au serveur, sans re-majoration de TVA (sinon 79 € → 95 €).
    const fallbackTtc = pricing.finalPrice;
    let cancelled = false;
    const t = setTimeout(() => {
      resolveServerPrice({ data: {
        depart: departure, arrivee: arrival,
        isAllerRetour: option === "aller-retour",
        fallbackPrice: fallbackTtc,
      }}).then((res) => {
        if (!cancelled && res?.personalized) setServerTtc(Number(res.price));
      }).catch(() => {});
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [departure, arrival, option, pricing, resolveServerPrice]);

  const isComplete = !!(departure && arrival && vehicleType);
  // priceTTC = source de vérité affichée. En micro-entreprise (franchise en base de TVA),
  // le prix affiché est le net à payer : aucune ventilation HT / TVA.
  const localTtc = pricing?.finalPrice ?? 0;
  const priceTTC = serverTtc ?? localTtc;
  const priceHT = microRegime ? priceTTC : Math.round((priceTTC / 1.2) * 100) / 100;
  const tva = Math.max(0, Math.round((priceTTC - priceHT) * 100) / 100);



  // inputBare retiré : la barre principale utilise des styles inline premium
  const inputCard = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-cream text-sm placeholder:text-cream/40 focus:border-[#5fb6ff]/60 focus:outline-none focus:ring-1 focus:ring-[#5fb6ff]/30 transition-all";
  const selectCard = inputCard + " appearance-none";

  async function handleSubmit() {
    if (!pricing || distance == null) return;
    // CGU requise dans tous les cas
    // CGU requise UNIQUEMENT pour les visiteurs non connectés (création de compte possible)
    if (!hideAccountStep && !cguAccepted) { setAccountError("Vous devez accepter les CGU pour continuer."); return; }
    // Création de compte optionnelle : seulement si le bloc compte est visible ET un mot de passe est saisi
    const wantsAccount = !hideAccountStep && password.length > 0;
    if (wantsAccount && password.length < 8) {

      setAccountError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setAccountError("");
    setSending(true);
    try {
      // 1) Création du compte client (optionnelle)
      let isExistingAccount = false;
      if (wantsAccount) {
        try {
          const token = await getRecaptchaToken("signup_devis");
          void token;
        } catch { /* ignore */ }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/login`,
            data: {
              role: "client",
              nom, prenom, telephone,
              societe: societe || "",
            },
          },
        });

        if (signUpError) {
          const msg = signUpError.message.toLowerCase();
          if (msg.includes("already registered") || msg.includes("already been registered") || msg.includes("user already")) {
            isExistingAccount = true;
          } else {
            setAccountError(signUpError.message);
            setSending(false);
            return;
          }
        }
        setAccountCreated(!isExistingAccount);
      }

      // Préparation infos retour (uniquement pour aller-retour)
      const isAR = option === "aller-retour";
      const retourDepart = isAR ? (departRetour || arrival) : null;
      const retourArrivee = isAR ? (sameDestination ? departure : arriveeRetour) : null;
      const retourImmat = isAR ? (immatRetour || null) : null;
      const retourMarque = isAR ? (marqueRetour || null) : null;
      const retourModele = isAR ? (modeleRetour || null) : null;
      const retourVin = isAR ? (vinRetour || null) : null;

      // 2) Insertion du devis (RLS autorise anon avec validation)
      const { data: devisRow } = await supabase.from("devis").insert({
        nom, prenom, telephone, email,
        depart: departure, arrivee: arrival,
        distance_km: distance,
        duree_estimee: estimateDuration(distance),
        type_vehicule: vehicleType || null,
        marque: marque || null, modele: modele || null,
        carburant: energy || null,
        prestation: null, option_trajet: option,
        date_souhaitee: date || null, heure_souhaitee: heure || null,
        prix_estime: pricing.finalPrice, prix_base: pricing.price,
        tarif_label: pricing.label,
        multiplier_label: pricing.multiplierLabel || null,
        message: comment || null,
        depart_retour: retourDepart,
        arrivee_retour: retourArrivee,
        immatriculation_retour: retourImmat,
        marque_retour: retourMarque,
        modele_retour: retourModele,
        vin_retour: retourVin,
      }).select().single();

      await supabase.from("demandes_convoyage").insert({
        nom, prenom, telephone, email,
        depart: departure, arrivee: arrival,
        date_souhaitee: date || null, heure_souhaitee: heure,
        marque, modele,
        immatriculation: plaqueInconnue ? "" : immatriculation,
        carburant: energy,
        prix_estime: pricing.finalPrice,
        distance_km: distance,
        options: [
          devisRow?.numero && `Devis: ${devisRow.numero}`,
          vehicleType && `Type: ${vehicleType}`,
          societe && `Société: ${societe}`,
          `Prestation: ${option === "aller-retour" ? "Livraison + restitution" : option === "express" ? "Express" : "Livraison simple"}`,
          `Roulant: ${running}`,
          plaqueInconnue && "Plaque: à confirmer",
          isAR && `Restitution: ${retourDepart} → ${retourArrivee}`,
          isAR && retourImmat && `Plaque retour: ${retourImmat}`,
          `Estimation: ${pricing.finalPrice}€`,
          `Distance: ${distance}km`,
          comment,
        ].filter(Boolean).join(" | "),
        message: comment,
        depart_retour: retourDepart,
        arrivee_retour: retourArrivee,
        immatriculation_retour: retourImmat,
        marque_retour: retourMarque,
        modele_retour: retourModele,
        vin_retour: retourVin,
      });


      await notifyAdmin({
        type: "estimation",
        titre: `Nouvelle estimation ${devisRow?.numero ?? ""} · ${prenom} ${nom}`,
        message: `${departure} → ${arrival} · ${distance} km · ${pricing.finalPrice} €`,
        link: "/admin/devis",
        entityType: "devis", entityId: devisRow?.id,
        metadata: { email, telephone, prix: pricing.finalPrice, distance, option, account: !wantsAccount ? "none" : isExistingAccount ? "existing" : "created" },
      });

      const devisData: DevisData = {
        numero: devisRow?.numero || `DEV-${Date.now()}`,
        nom, prenom, email, telephone,
        depart: departure, arrivee: arrival,
        distance_km: distance, duree_estimee: estimateDuration(distance),
        type_vehicule: vehicleType, marque, modele, carburant: energy,
        prestation: "", option_trajet: option,
        date_souhaitee: date || null, heure_souhaitee: heure || null,
        prix_estime: pricing.finalPrice, tarif_label: pricing.label,
        multiplier_label: pricing.multiplierLabel,
        message: comment, created_at: devisRow?.created_at,
      };
      setSavedDevis(devisData);

      try {
        await Promise.allSettled([
          sendTransactionalEmail({
            templateName: "devis-client",
            recipientEmail: email,
            idempotencyKey: `devis-${devisRow?.id || devisData.numero}`,
            templateData: { prenom, nom, numero: devisData.numero, depart: departure, arrivee: arrival, distance, prix: pricing.finalPrice, optionTrajet: option },
          }),
          sendTransactionalEmail({
            templateName: "devis-cree-admin",
            idempotencyKey: `admin-devis-${devisRow?.id || devisData.numero}`,
            templateData: { prenom, nom, email, telephone, numero: devisData.numero, depart: departure, arrivee: arrival, date: date || " · ", prix: pricing.finalPrice },
          }),
        ]);
        if (devisRow?.id) await supabase.from("devis").update({ email_envoye: true }).eq("id", devisRow.id);
      } catch (e) { console.warn("Email devis non envoyé", e); }


      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setAccountError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSending(false);
    }
  }

  async function handleDownloadPdf() {
    if (!savedDevis) return;
    const blob = await generateDevisPdf(savedDevis);
    downloadDevisPdf(blob, savedDevis.numero);
  }

  // --- ESTIMATEUR : carte premium "chauffeur" ---
  const isHero = variant === "hero-card";

  return (
    <div className="w-full">
      <div className={isHero ? "relative z-30" : "relative z-30 max-w-5xl mx-auto"}>
        {/* Halo doré · uniquement variante bar (le hero gère son propre fond) */}
        {!isHero && (
          <div aria-hidden className="pointer-events-none absolute -inset-1 rounded-[28px] bg-gradient-to-r from-[#e7c76a]/20 via-[#5fb6ff]/10 to-[#d4af37]/20 blur-xl opacity-70" />
        )}

        {isHero ? (
          // ============================================================
          // VARIANTE HERO-CARD · layout vertical compact (maquette)
          // Mêmes états, mêmes setters, mêmes calculs. Seul l'agencement change.
          // ============================================================
          <div className="relative z-30 rounded-[26px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_40px_90px_-30px_rgba(59,130,246,0.35),0_0_0_1px_rgba(255,255,255,0.04)_inset] p-7 lg:p-8">
            {/* Filet bleu électrique supérieur */}
            <div aria-hidden className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#60a5fa]/70 to-transparent" />

            {/* Titre intégré */}
            <div className="mb-6">
              <h3 className="font-heading text-white text-[26px] lg:text-[28px] leading-[1.15] tracking-[0.01em]">
                Obtenez votre tarif
                <br />
                en <span className="text-[#60a5fa]">quelques secondes</span>
              </h3>
              <p className="text-white/75 text-[13px] leading-relaxed mt-3">
                Renseignez votre trajet et recevez un tarif immédiat, sans engagement.
              </p>
            </div>

            {/* Départ / Arrivée · 2 colonnes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] hover:border-[#60a5fa]/40 transition-colors px-4 py-3 relative">
                <label className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.22em] text-white/75 font-heading mb-1.5">
                  <MapPin size={11} className="text-[#60a5fa]" /> Départ
                </label>
                <PlacesInput
                  value={departure}
                  onChange={setDeparture}
                  placeholder="Adresse de départ"
                  className="w-full bg-transparent text-white text-[13.5px] placeholder:text-white/35 focus:outline-none h-7"
                  fallbackOptions={CITIES}
                  dropdownClassName="absolute z-[70] left-0 right-0 top-full mt-2 bg-[#061238] border border-[#60a5fa]/30 rounded-xl max-h-64 overflow-y-auto shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]"
                />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] hover:border-[#60a5fa]/40 transition-colors px-4 py-3 relative">
                <label className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.22em] text-white/75 font-heading mb-1.5">
                  <MapPinned size={11} className="text-[#60a5fa]" /> Arrivée
                </label>
                <PlacesInput
                  value={arrival}
                  onChange={setArrival}
                  placeholder="Adresse d'arrivée"
                  className="w-full bg-transparent text-white text-[13.5px] placeholder:text-white/35 focus:outline-none h-7"
                  fallbackOptions={CITIES}
                  dropdownClassName="absolute z-[70] left-0 right-0 top-full mt-2 bg-[#061238] border border-[#60a5fa]/30 rounded-xl max-h-64 overflow-y-auto shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]"
                />
              </div>
            </div>

            {/* Petit pictogramme central swap (décoratif) */}
            <div className="flex justify-center -my-1">
              <span className="h-7 w-7 rounded-full grid place-items-center bg-gradient-to-br from-[#3b82f6] to-[#60a5fa] text-white shadow-[0_6px_18px_-6px_rgba(59,130,246,0.7)]">
                <ArrowRight size={12} strokeWidth={2.5} className="rotate-90" />
              </span>
            </div>

            {/* Véhicule · pleine largeur */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 relative">
              <label className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.22em] text-white/75 font-heading mb-1.5">
                <Car size={11} className="text-[#60a5fa]" /> Véhicule
              </label>
              <select
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value)}
                className="w-full bg-transparent text-white text-[13.5px] appearance-none pr-6 cursor-pointer focus:outline-none"
              >
                <option value="">Sélectionnez votre véhicule</option>
                {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value} >{v.label}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 bottom-3.5 text-[#60a5fa]/70 pointer-events-none" />
            </div>

            {/* Date / Heure · 2 colonnes */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <label className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.22em] text-white/75 font-heading mb-1.5">
                  <Calendar size={11} className="text-[#60a5fa]" /> Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full bg-transparent text-white text-[13.5px] focus:outline-none [color-scheme:dark]"
                />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <label className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.22em] text-white/75 font-heading mb-1.5">
                  <Clock size={11} className="text-[#60a5fa]" /> Heure
                </label>
                <input
                  type="time"
                  value={heure}
                  onChange={e => setHeure(e.target.value)}
                  className="w-full bg-transparent text-white text-[13.5px] focus:outline-none [color-scheme:dark]"
                />
              </div>
            </div>

            {/* CTA principal · pleine largeur, bleu électrique */}
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!isComplete}
              className="mt-5 w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-xl bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#3b82f6] bg-[length:200%_100%] hover:bg-[position:100%_0] text-white font-heading text-[12px] tracking-[0.24em] uppercase shadow-[0_15px_40px_-10px_rgba(59,130,246,0.7)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Send size={14} /> Obtenir mon prix
            </button>

            {/* Choix de prestation · discret en bas */}
            <div className="mt-5 pt-4 border-t border-white/[0.06] flex flex-wrap items-center justify-center gap-2">
              {[
                { v: "aller-simple", l: "Aller simple" },
                { v: "aller-retour", l: "Aller-retour" },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setOption(o.v as typeof option)}
                  className={`px-3 py-1.5 rounded-full text-[10.5px] tracking-[0.12em] uppercase font-heading transition ${
                    option === o.v
                      ? "bg-[#3b82f6]/15 border border-[#60a5fa]/50 text-[#60a5fa]"
                      : "bg-white/[0.03] border border-white/10 text-white/55 hover:text-white/85 hover:border-white/20"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // ============================================================
          // VARIANTE BAR · rendu original (utilisé sur /tarifs etc.)
          // ============================================================
          <div className="relative z-30 rounded-[24px] border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_25px_80px_-20px_rgba(59,130,246,0.35),0_0_0_1px_rgba(255,255,255,0.04)_inset] p-5 md:p-7">

            {/* Type de prestation */}
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-cream/55 font-heading mb-2">Type de prestation</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: "aller-simple", l: "Livraison simple", s: "Aller simple" },
                  { v: "aller-retour", l: "Livraison + restitution", s: "Aller-retour" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setOption(o.v as typeof option)}
                    className={`rounded-xl px-3 py-2.5 border text-left transition ${
                      option === o.v
                        ? "border-[#e7c76a] bg-[#e7c76a]/10 text-[#e7c76a] shadow-[0_0_0_1px_rgba(231,199,106,0.25)]"
                        : "border-white/10 bg-white/[0.03] text-cream/75 hover:border-white/25"
                    }`}
                  >
                    <span className="block text-[11px] sm:text-xs font-heading tracking-wide">{o.l}</span>
                    <span className="block text-[9px] sm:text-[10px] uppercase tracking-[0.18em] opacity-70 mt-0.5">{o.s}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trajet : Départ ↔ Arrivée */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 md:gap-5 items-stretch">
              <div className="group relative rounded-2xl border border-white/10 bg-white/[0.03] hover:border-[#5fb6ff]/40 transition-colors px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-7 w-7 rounded-full grid place-items-center bg-[#5fb6ff]/15 border border-[#5fb6ff]/30">
                    <MapPin size={13} className="text-[#5fb6ff]" />
                  </span>
                  <label className="text-[10px] uppercase tracking-[0.22em] text-cream/65 font-heading">Adresse de départ</label>
                </div>
                <PlacesInput
                  value={departure}
                  onChange={setDeparture}
                  placeholder="Ville, rue, code postal…"
                  className="w-full bg-transparent text-cream text-base md:text-[15px] placeholder:text-cream/35 focus:outline-none h-9"
                  fallbackOptions={CITIES}
                  dropdownClassName="absolute z-[70] left-0 right-0 top-full mt-2 bg-[#061238] border border-[#60a5fa]/30 rounded-xl max-h-72 overflow-y-auto shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]"
                />
              </div>

              <div className="hidden md:flex flex-col items-center justify-center px-1">
                <div className="w-px flex-1 bg-gradient-to-b from-transparent via-[#e7c76a]/40 to-transparent" />
                <span className="my-2 h-9 w-9 rounded-full grid place-items-center bg-gradient-to-br from-[#e7c76a] to-[#d4af37] text-[#0b1026] shadow-[0_8px_25px_-8px_rgba(231,199,106,0.7)]">
                  <ArrowRight size={16} strokeWidth={2.5} />
                </span>
                <div className="w-px flex-1 bg-gradient-to-b from-transparent via-[#e7c76a]/40 to-transparent" />
              </div>
              <div className="md:hidden flex items-center justify-center -my-1">
                <span className="h-8 w-8 rounded-full grid place-items-center bg-gradient-to-br from-[#e7c76a] to-[#d4af37] text-[#0b1026] shadow-[0_6px_18px_-6px_rgba(231,199,106,0.7)]">
                  <ArrowRight size={14} strokeWidth={2.5} className="rotate-90" />
                </span>
              </div>

              <div className="group relative rounded-2xl border border-white/10 bg-white/[0.03] hover:border-[#e7c76a]/40 transition-colors px-5 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-7 w-7 rounded-full grid place-items-center bg-[#e7c76a]/15 border border-[#e7c76a]/30">
                    <MapPinned size={13} className="text-[#e7c76a]" />
                  </span>
                  <label className="text-[10px] uppercase tracking-[0.22em] text-cream/65 font-heading">Adresse d'arrivée</label>
                </div>
                <PlacesInput
                  value={arrival}
                  onChange={setArrival}
                  placeholder="Ville, rue, code postal…"
                  className="w-full bg-transparent text-cream text-base md:text-[15px] placeholder:text-cream/35 focus:outline-none h-9"
                  fallbackOptions={CITIES}
                  dropdownClassName="absolute z-[70] left-0 right-0 top-full mt-2 bg-[#061238] border border-[#60a5fa]/30 rounded-xl max-h-72 overflow-y-auto shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]"
                />
              </div>
            </div>

            {/* Détails trajet + CTA */}
            <div className="mt-5 grid grid-cols-2 md:grid-cols-[1.1fr_1fr_0.9fr_auto] gap-3 md:gap-4 items-end">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 relative">
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-cream/55 mb-1.5">
                  <Car size={11} className="text-[#e7c76a]" /> Véhicule
                </label>
                <select value={vehicleType} onChange={e => setVehicleType(e.target.value)}
                  className="w-full bg-transparent text-cream text-sm appearance-none pr-5 cursor-pointer focus:outline-none">
                  <option value="">Sélectionner</option>
                  {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value} >{v.label}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-3 bottom-4 text-[#e7c76a]/60 pointer-events-none" />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-cream/55 mb-1.5">
                  <Calendar size={11} className="text-[#e7c76a]" /> Date
                </label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full bg-transparent text-cream text-sm focus:outline-none [color-scheme:dark]" />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-cream/55 mb-1.5">
                  <Clock size={11} className="text-[#e7c76a]" /> Heure de livraison
                </label>
                <input type="time" value={heure} onChange={e => setHeure(e.target.value)}
                  className="w-full bg-transparent text-cream text-sm focus:outline-none [color-scheme:dark]" />
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={!isComplete}
                className="col-span-2 md:col-span-1 inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-[#3b82f6] via-[#2563eb] to-[#3b82f6] bg-[length:200%_100%] hover:bg-[position:100%_0] text-white font-heading text-[11px] tracking-[0.22em] uppercase shadow-[0_15px_40px_-10px_rgba(59,130,246,0.7)] hover:scale-[1.02] active:scale-[0.99] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 whitespace-nowrap"
              >
                <Send size={14} /> Obtenir mon prix
              </button>
            </div>
          </div>
        )}




        {/* Détail prix EN LIVE · visible immédiatement, sans clic */}
        {isComplete && pricing && distance !== null && (
          <div className="mt-4 rounded-2xl border border-[#5fb6ff]/15 bg-white/[0.03] backdrop-blur-md px-5 py-4 animate-fade-in">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cream/45">Prix HT</p>
                <p className="font-heading text-3xl gold-gradient-text leading-none">{priceHT} €</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cream/45">TVA 20%</p>
                <p className="font-heading text-base text-cream/85">{tva} €</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cream/45">Total TTC</p>
                <p className="font-heading text-xl text-[#e7c76a]">{priceTTC} €</p>
              </div>
              <div className="h-8 w-px bg-white/10 hidden md:block" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cream/45">Distance</p>
                <p className="font-heading text-base text-cream/85">{distance} km</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cream/45">Durée estimée</p>
                <p className="font-heading text-base text-cream/85">{distance > 0 ? estimateDuration(distance) : " · "}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-cream/45">Tarif appliqué</p>
                <p className="font-heading text-base text-cream/85">{pricing.label}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-cream/65">
              <span className="inline-flex items-center gap-1.5"><RouteIcon size={11} className="text-[#5fb6ff]" /> Péages inclus</span>
              <span className="inline-flex items-center gap-1.5"><Fuel size={11} className="text-[#5fb6ff]" /> Carburant inclus</span>
              <span className="inline-flex items-center gap-1.5"><Shield size={11} className="text-[#5fb6ff]" /> Assurance incluse</span>
              <span className="inline-flex items-center gap-1.5"><User size={11} className="text-[#5fb6ff]" /> Convoyeur professionnel</span>
              <span className="inline-flex items-center gap-1.5"><Sparkles size={11} className="text-[#e7c76a]" /> Suivi temps réel</span>
            </div>
            <p className="mt-3 pt-3 border-t border-white/10 text-[12px] text-cream/75 leading-relaxed">
              <Sparkles size={11} className="inline mr-1.5 text-[#e7c76a]" />
              Vous pouvez commander votre convoyage directement depuis cet estimateur.
              Après validation de votre estimation, vous pouvez confirmer votre demande en quelques clics.
            </p>
          </div>
        )}
        {isComplete && distance === null && distanceLoading && (
          <p className="mt-3 text-cream/60 text-xs text-center inline-flex items-center justify-center gap-2 w-full">
            <Loader2 size={12} className="animate-spin" /> Calcul de la distance en cours…
          </p>
        )}
        {isComplete && distance === null && !distanceLoading && departure && arrival && (
          <p className="mt-3 text-amber-300/80 text-xs text-center">
            Distance non calculable automatiquement. Vous pouvez continuer votre demande, nous confirmerons le tarif manuellement.
          </p>
        )}
        {!isComplete && (
          <p className="mt-3 text-cream/45 text-xs text-center tracking-wide">
            Complétez votre trajet pour voir le prix en direct
          </p>
        )}
      </div>

      {/* === MODAL MULTI-ÉTAPES === */}
      {step > 0 && !submitted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#60a5fa]/25 bg-gradient-to-br from-[#061238] via-[#0a1f5c] to-[#061238] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
            {/* Stepper */}
            <div className="sticky top-0 z-10 bg-gradient-to-b from-[#061238] to-[#061238]/95 backdrop-blur px-6 md:px-10 pt-6 pb-4 border-b border-white/5">
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#5fb6ff]/30 bg-[#5fb6ff]/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#5fb6ff]">
                  <Sparkles size={11} /> Demande de devis
                </span>
                <button onClick={() => setStep(0)} className="text-cream/50 hover:text-cream text-xs uppercase tracking-wider">Fermer</button>
              </div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
                {["Trajet", "Véhicule", "Coordonnées", "Récap"].map((label, i) => {
                  const idx = i + 1;
                  const active = step === idx; const done = step > idx;
                  return (
                    <div key={label} className="flex items-center gap-2 flex-1">
                      <div className={`flex items-center gap-2 ${active ? "text-[#e7c76a]" : done ? "text-[#5fb6ff]" : "text-cream/35"}`}>
                        <span className={`h-6 w-6 rounded-full grid place-items-center text-[11px] font-heading border ${active ? "border-[#e7c76a] bg-[#e7c76a]/10" : done ? "border-[#5fb6ff] bg-[#5fb6ff]/10" : "border-white/15"}`}>
                          {done ? "✓" : idx}
                        </span>
                        <span className="hidden sm:inline">{label}</span>
                      </div>
                      {i < 3 && <div className={`flex-1 h-px ${done ? "bg-[#5fb6ff]/40" : "bg-white/10"}`} />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 md:px-10 py-6">
              {/* STEP 1 · Trajet (récap modifiable) */}
              {step === 1 && (
                <div className="space-y-5 animate-fade-in">
                  <h4 className="font-heading text-lg text-cream tracking-wide">Confirmez votre trajet</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Départ *</label>
                      <PlacesInput value={departure} onChange={setDeparture} className={inputCard} fallbackOptions={CITIES} required />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Arrivée *</label>
                      <PlacesInput value={arrival} onChange={setArrival} className={inputCard} fallbackOptions={CITIES} required />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Date souhaitée</label>
                      <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCard + " [color-scheme:dark]"} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Heure de livraison souhaitée</label>
                      <input type="time" value={heure} onChange={e => setHeure(e.target.value)} className={inputCard + " [color-scheme:dark]"} />
                    </div>
                  </div>

                  {/* Bloc Restitution (Aller-retour uniquement) */}
                  {option === "aller-retour" && (
                    <div className="rounded-2xl border border-[#e7c76a]/25 bg-[#e7c76a]/[0.03] p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="font-heading text-xs tracking-[0.2em] uppercase text-[#e7c76a]">Restitution</p>
                        <label className="inline-flex items-center gap-2 text-[11px] text-cream/70 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sameDestination}
                            onChange={e => setSameDestination(e.target.checked)}
                            className="accent-[#e7c76a]"
                          />
                          Même destination que la livraison
                        </label>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Départ restitution</label>
                          <PlacesInput
                            value={departRetour || arrival}
                            onChange={setDepartRetour}
                            className={inputCard}
                            fallbackOptions={CITIES}
                            placeholder="Adresse de prise en charge retour"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Arrivée restitution</label>
                          {sameDestination ? (
                            <input
                              value={departure}
                              disabled
                              className={inputCard + " opacity-70 cursor-not-allowed"}
                            />
                          ) : (
                            <PlacesInput
                              value={arriveeRetour}
                              onChange={setArriveeRetour}
                              className={inputCard}
                              fallbackOptions={CITIES}
                              placeholder="Adresse de retour"
                            />
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-cream/45">
                        Les deux véhicules (livraison et restitution) peuvent être différents · vous saisirez la seconde plaque à l'étape suivante.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Instructions particulières</label>
                    <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                      placeholder="Code d'accès, contact sur place, contraintes horaires..."
                      className={inputCard + " resize-none"} />
                  </div>
                </div>
              )}

              {/* STEP 2 · Véhicule */}
              {step === 2 && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h4 className="font-heading text-lg text-cream tracking-wide">Informations véhicule</h4>
                    {(() => {
                      const applyScan = (f: ExtractedFields) => {
                        if (f.immatriculation && !immatriculation) setImmatriculation(f.immatriculation.toUpperCase());
                        if (f.vin && !vin) setVin(f.vin.toUpperCase());
                        if (f.marque && !marque) setMarque(f.marque);
                        if (f.modele && !modele) setModele(f.modele);
                        if (f.energie && !energy) setEnergy(f.energie.toLowerCase());
                        if (f.date_mec && !annee) setAnnee((f.date_mec.match(/\d{4}/)?.[0]) ?? "");
                        if (f.puissance && !puissance) setPuissance(f.puissance);
                        if (f.lieu_depart && !departure) setDeparture(f.lieu_depart);
                        if (f.lieu_arrivee && !arrival) setArrival(f.lieu_arrivee);
                        if (f.client_nom && !nom) {
                          const parts = f.client_nom.trim().split(/\s+/);
                          if (parts.length > 1) { setPrenom(parts[0]); setNom(parts.slice(1).join(" ")); }
                          else setNom(f.client_nom);
                        }
                        if (f.client_email && !email) setEmail(f.client_email);
                        if (f.client_telephone && !telephone) setTelephone(f.client_telephone);
                        toast.success("Véhicule pré-rempli depuis le document");
                      };
                      return (
                        <div className="flex flex-wrap gap-2">
                          <ScanToPrefill label="Scanner" multiPage onExtracted={applyScan} />
                          <QrHandoffButton context="client_reservation" onExtracted={applyScan} />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* 1. Plaque d'immatriculation · en premier */}
                    <div className="sm:col-span-2">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Plaque d'immatriculation</label>
                      <div className="flex gap-2">
                        <input
                          value={immatriculation}
                          onChange={e => { setImmatriculation(e.target.value.toUpperCase()); setSivMsg(null); }}
                          placeholder="AA-123-AA"
                          disabled={plaqueInconnue}
                          className={inputCard + " uppercase tracking-widest disabled:opacity-50 flex-1"}
                        />
                        <button
                          type="button"
                          onClick={handleSivLookup}
                          disabled={plaqueInconnue || sivLoading || !immatriculation}
                          className="px-5 py-3 rounded-xl border border-[#e7c76a]/60 bg-gradient-to-b from-[#e7c76a]/25 to-[#d4af37]/15 text-[#e7c76a] text-xs font-semibold uppercase tracking-wider hover:from-[#e7c76a]/35 hover:to-[#d4af37]/25 hover:border-[#e7c76a] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 whitespace-nowrap shadow-[0_0_0_1px_rgba(231,199,106,0.15)]"
                        >
                          {sivLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          {sivLoading ? "Recherche..." : "Rechercher"}
                        </button>
                      </div>
                      {sivMsg && (
                        <p className={`mt-2 text-[11px] ${sivMsg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>
                          {sivMsg.text}
                        </p>
                      )}
                      <p className="mt-2 text-[10px] text-cream/45">
                        La recherche pré-remplit automatiquement le véhicule (VIN, marque, modèle, carburant, année).
                      </p>
                      <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-cream/65 cursor-pointer">
                        <input type="checkbox" checked={plaqueInconnue} onChange={e => setPlaqueInconnue(e.target.checked)}
                          className="accent-[#5fb6ff]" />
                        Je ne connais pas encore la plaque
                      </label>
                    </div>

                    {/* 2. VIN optionnel */}
                    <div className="sm:col-span-2">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">
                        VIN <span className="text-cream/40 normal-case tracking-normal">(optionnel)</span>
                      </label>
                      <input
                        value={vin}
                        onChange={e => setVin(e.target.value.toUpperCase())}
                        placeholder="Renseigné automatiquement via la plaque"
                        className={inputCard + " uppercase tracking-widest"}
                        maxLength={17}
                      />
                    </div>

                    {/* 3. Infos auto-remplies */}
                    {(annee || puissance || finition) && (
                      <div className="sm:col-span-2 p-3 rounded-xl border border-[#e7c76a]/20 bg-[#e7c76a]/[0.04] text-[11px] text-cream/70 grid grid-cols-2 gap-x-3 gap-y-1">
                        {annee && <div><span className="text-cream/45">Année :</span> {annee}</div>}
                        {puissance && <div><span className="text-cream/45">Puissance :</span> {puissance}</div>}
                        {finition && <div className="col-span-2"><span className="text-cream/45">Finition :</span> {finition}</div>}
                      </div>
                    )}

                    {/* 4. Marque / Modèle */}
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Marque</label>
                      <input value={marque} onChange={e => setMarque(e.target.value)} placeholder="Ex: Peugeot" className={inputCard} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Modèle</label>
                      <input value={modele} onChange={e => setModele(e.target.value)} placeholder="Ex: 308" className={inputCard} />
                    </div>

                    {/* 5. Type véhicule */}
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Type de véhicule *</label>
                      <div className="relative">
                        <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={selectCard}>
                          <option value="">Sélectionner</option>
                          {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value} >{v.label}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5fb6ff]/60 pointer-events-none" />
                      </div>
                    </div>

                    {/* 6. Carburant */}
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Carburant</label>
                      <div className="relative">
                        <select value={energy} onChange={e => setEnergy(e.target.value)} className={selectCard}>
                          <option value="">Sélectionner</option>
                          {ENERGY_TYPES.map(v => <option key={v.value} value={v.value} >{v.label}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5fb6ff]/60 pointer-events-none" />
                      </div>
                    </div>

                    {/* 7. État du véhicule */}
                    <div className="sm:col-span-2">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">État du véhicule</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[{v:"oui",l:"Roulant"},{v:"non",l:"Non roulant"}].map(o => (
                          <button key={o.v} type="button" onClick={() => setRunning(o.v as "oui" | "non")}
                            className={`px-4 py-3 rounded-xl border text-sm transition ${
                              running === o.v
                                ? "border-[#5fb6ff] bg-[#5fb6ff]/10 text-[#5fb6ff]"
                                : "border-white/10 bg-white/[0.03] text-cream/70 hover:border-white/25"
                            }`}>{o.l}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Véhicule de restitution (Aller-retour uniquement) */}
                  {option === "aller-retour" && (
                    <div className="rounded-2xl border border-[#e7c76a]/25 bg-[#e7c76a]/[0.03] p-4 space-y-3">
                      <p className="font-heading text-xs tracking-[0.2em] uppercase text-[#e7c76a]">Véhicule de restitution</p>
                      <p className="text-[10px] text-cream/50 -mt-1">Laissez vide si c'est le même véhicule que la livraison.</p>
                      <div>
                        <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Plaque restitution</label>
                        <div className="flex gap-2">
                          <input
                            value={immatRetour}
                            onChange={e => { setImmatRetour(e.target.value.toUpperCase()); setSivRetourMsg(null); }}
                            placeholder="AA-123-AA"
                            className={inputCard + " uppercase tracking-widest flex-1"}
                          />
                          <button
                            type="button"
                            onClick={handleSivRetourLookup}
                            disabled={sivRetourLoading || !immatRetour}
                            className="px-4 py-3 rounded-xl border border-[#e7c76a]/60 bg-gradient-to-b from-[#e7c76a]/25 to-[#d4af37]/15 text-[#e7c76a] text-xs font-semibold uppercase tracking-wider hover:from-[#e7c76a]/35 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 whitespace-nowrap"
                          >
                            {sivRetourLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {sivRetourLoading ? "..." : "Rechercher"}
                          </button>
                        </div>
                        {sivRetourMsg && (
                          <p className={`mt-2 text-[11px] ${sivRetourMsg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}>{sivRetourMsg.text}</p>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Marque</label>
                          <input value={marqueRetour} onChange={e => setMarqueRetour(e.target.value)} className={inputCard} placeholder="Optionnel" />
                        </div>
                        <div>
                          <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Modèle</label>
                          <input value={modeleRetour} onChange={e => setModeleRetour(e.target.value)} className={inputCard} placeholder="Optionnel" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">VIN <span className="text-cream/40 normal-case">(optionnel)</span></label>
                          <input value={vinRetour} onChange={e => setVinRetour(e.target.value.toUpperCase())} className={inputCard + " uppercase tracking-widest"} maxLength={17} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3 · Coordonnées */}
              {step === 3 && (
                <div className="space-y-5 animate-fade-in">
                  <h4 className="font-heading text-lg text-cream tracking-wide">Vos coordonnées</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Prénom *</label>
                      <input value={prenom} onChange={e => setPrenom(e.target.value)} className={inputCard} required />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Nom *</label>
                      <input value={nom} onChange={e => setNom(e.target.value)} className={inputCard} required />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Email *</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCard} required />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Téléphone *</label>
                      <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} className={inputCard} required />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Société (si professionnel)</label>
                      <input value={societe} onChange={e => setSociete(e.target.value)} className={inputCard} placeholder="Optionnel" />
                    </div>
                  </div>

                  {/* Bloc compte client · masqué dans les dashboards (utilisateur déjà connecté) */}
                  {!hideAccountStep && (
                    <div className="mt-2 rounded-2xl border border-[#5fb6ff]/25 bg-[#5fb6ff]/[0.04] p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-[#5fb6ff]/15 p-2 mt-0.5">
                          <Lock size={14} className="text-[#5fb6ff]" />
                        </div>
                        <div>
                          <p className="font-heading text-sm text-cream tracking-wide">Votre espace client (optionnel)</p>
                          <p className="text-cream/55 text-xs mt-1 leading-relaxed">
                            Définissez un mot de passe pour suivre votre devis, votre mission et vos documents
                            dans un espace sécurisé. Vous pouvez aussi laisser vide et créer un compte plus tard avec le même email · vos devis y seront rattachés automatiquement.
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">
                          <Lock size={11} className="inline mr-1" /> Mot de passe (optionnel)
                        </label>
                        <input
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className={inputCard}
                          placeholder="Laisser vide ou minimum 8 caractères"
                          minLength={8}
                        />
                      </div>
                      <label className="flex items-start gap-2.5 text-[11px] text-cream/70 cursor-pointer leading-relaxed">
                        <input
                          type="checkbox"
                          checked={cguAccepted}
                          onChange={e => setCguAccepted(e.target.checked)}
                          className="accent-[#5fb6ff] mt-0.5"
                        />
                        <span>
                          J'accepte les{" "}
                          <Link to="/cgv" target="_blank" className="text-[#5fb6ff] hover:underline">CGV</Link>
                          {" "}et la{" "}
                          <Link to="/confidentialite" target="_blank" className="text-[#5fb6ff] hover:underline">politique de confidentialité</Link>
                          {" "}de Transports Ligneo, et la création d'un compte client à mon nom.
                        </span>
                      </label>
                      <p className="text-[10px] text-cream/40 leading-relaxed">
                        Si vous avez déjà un compte avec cette adresse, votre devis y sera rattaché automatiquement.
                      </p>
                    </div>
                  )}
                </div>
              )}


              {/* STEP 4 · Récap */}
              {step === 4 && (
                <div className="space-y-5 animate-fade-in">
                  <h4 className="font-heading text-lg text-cream tracking-wide">Récapitulatif</h4>
                  <div className="rounded-2xl border border-[#5fb6ff]/20 bg-white/[0.03] p-5 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3 text-cream/80">
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Trajet</p>{departure} → {arrival}</div>
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Distance</p>{distance} km · {distance ? estimateDuration(distance) : ""}</div>
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Véhicule</p>{[marque, modele].filter(Boolean).join(" ") || vehicleType || " · "}</div>
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Plaque</p>{plaqueInconnue ? "À confirmer" : (immatriculation || " · ")}</div>
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Date / Heure</p>{date || " · "} {heure}</div>
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Contact</p>{prenom} {nom}</div>
                    </div>
                    {pricing && (
                      <div className="pt-3 mt-3 border-t border-white/10 grid grid-cols-3 gap-3">
                        <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Prix HT</p><p className="font-heading text-xl gold-gradient-text">{priceHT} €</p></div>
                        <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">TVA 20%</p><p className="font-heading text-base text-cream/85">{tva} €</p></div>
                        <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Total TTC</p><p className="font-heading text-xl text-[#e7c76a]">{priceTTC} €</p></div>
                      </div>
                    )}
                    <div className="pt-3 mt-3 border-t border-white/10 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-cream/65">
                      <span className="inline-flex items-center gap-1.5"><RouteIcon size={11} className="text-[#5fb6ff]" /> Péages inclus</span>
                      <span className="inline-flex items-center gap-1.5"><Fuel size={11} className="text-[#5fb6ff]" /> Carburant inclus</span>
                      <span className="inline-flex items-center gap-1.5"><Shield size={11} className="text-[#5fb6ff]" /> Assurance incluse</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer navigation */}
            <div className="sticky bottom-0 bg-gradient-to-t from-[#061238] to-[#061238]/95 backdrop-blur px-6 md:px-10 py-4 border-t border-white/5 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(s => Math.max(1, s - 1))}
                disabled={step === 1 || sending}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-cream/70 hover:text-cream hover:border-white/25 text-xs uppercase tracking-[0.18em] disabled:opacity-30"
              >
                <ArrowLeft size={13} /> Retour
              </button>
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep(s => Math.min(4, s + 1))}
                  disabled={
                    (step === 1 && (!departure || !arrival)) ||
                    (step === 2 && !vehicleType) ||
                    (step === 3 && (!nom || !prenom || !email || !telephone || (!hideAccountStep && password.length > 0 && password.length < 8) || (!hideAccountStep && !cguAccepted)))
                  }
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#5fb6ff] to-[#3b82f6] text-white font-heading text-xs tracking-[0.2em] uppercase shadow-[0_8px_30px_-8px_rgba(95,182,255,0.6)] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Continuer <ArrowRight size={13} />
                </button>
              ) : (
                <div className="flex flex-col items-end gap-2">
                  {accountError && <p className="text-red-300 text-[11px]">{accountError}</p>}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={sending}
                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white font-heading text-xs tracking-[0.2em] uppercase shadow-[0_8px_30px_-8px_rgba(59,130,246,0.6)] hover:brightness-110 disabled:opacity-50"
                  >
                    {sending ? <><Loader2 size={13} className="animate-spin" /> Envoi…</> : <><Send size={13} /> Confirmer ma demande</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === Confirmation === */}
      {submitted && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-xl rounded-3xl border border-[#60a5fa]/25 bg-gradient-to-br from-[#061238] via-[#0a1f5c] to-[#061238] p-8 md:p-10 text-center shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
            <div className="w-16 h-16 rounded-full border border-[#e7c76a]/40 bg-[#e7c76a]/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="text-[#e7c76a]" size={30} />
            </div>
            <h3 className="font-heading text-xl text-[#e7c76a] tracking-[0.15em] uppercase mb-2">Devis envoyé</h3>
            {savedDevis && <p className="text-cream/70 text-xs tracking-wider uppercase mb-4">N° {savedDevis.numero}</p>}
            <p className="text-cream/70 text-sm leading-relaxed max-w-md mx-auto">
              Merci pour votre demande. Un récapitulatif vient de vous être envoyé par email
              et notre équipe vous recontactera dans les plus brefs délais.
            </p>

            <div className="mt-6 rounded-2xl border border-[#5fb6ff]/30 bg-[#5fb6ff]/[0.05] p-5 text-left">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-[#5fb6ff]/15 p-2 mt-0.5">
                  <MailCheck size={16} className="text-[#5fb6ff]" />
                </div>
                <div className="flex-1">
                  <p className="font-heading text-sm text-cream tracking-wide mb-1">
                    {accountCreated ? "Vérifiez votre email" : "Votre espace client est prêt"}
                  </p>
                  <p className="text-cream/60 text-xs leading-relaxed">
                    {accountCreated
                      ? <>Nous venons de vous envoyer un lien de vérification à <strong className="text-cream/90">{email}</strong>. Cliquez dessus pour activer votre compte et retrouver votre devis dans votre espace client.</>
                      : <>Un compte existe déjà avec <strong className="text-cream/90">{email}</strong>. Connectez-vous pour retrouver votre devis.</>
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <a
                href={successRedirect}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#5fb6ff] to-[#3b82f6] text-white font-heading text-xs tracking-[0.2em] uppercase shadow-[0_8px_30px_-8px_rgba(95,182,255,0.6)] hover:brightness-110">
                <User size={13} /> {hideAccountStep ? "Retour à mon espace" : "Mon espace client"}
              </a>


              {savedDevis && (
                <button onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-white font-heading text-xs tracking-[0.2em] uppercase hover:brightness-110">
                  <Download size={13} /> Télécharger le PDF
                </button>
              )}
              <button
                onClick={() => {
                  setSubmitted(false); setStep(0); setSavedDevis(null);
                  setNom(""); setPrenom(""); setTelephone(""); setEmail(""); setComment("");
                  setImmatriculation(""); setPlaqueInconnue(false);
                  setPassword(""); setCguAccepted(false); setAccountCreated(false); setAccountError("");
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-white/15 text-cream/80 hover:text-cream hover:border-white/30 font-heading text-xs tracking-[0.2em] uppercase">
                <FileText size={13} /> Nouvelle estimation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
