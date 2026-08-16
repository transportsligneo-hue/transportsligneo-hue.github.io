import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MapPin, Navigation, Clock, Euro, Car, Fuel, Calendar, ChevronDown, ChevronRight,
  Send, Loader2, CheckCircle, User, Phone, Mail, Download, ArrowLeft, Sparkles,
  Zap, ArrowUpDown,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateDevisPdf, downloadDevisPdf, type DevisData } from "@/lib/devis-pdf";
import { sendTransactionalEmail } from "@/lib/email/send";
import { notifyAdmin } from "@/lib/admin-notifications";
import {
  getAutocompleteSuggestions, getGoogleDistanceKm, isGoogleAvailable, loadGoogle,
  resetPlacesSession, type PlaceSuggestion,
} from "@/lib/google-places";
import { resolveLocalDeptTariff } from "@/lib/pricing-departments";
import { lookupPlate } from "@/lib/plate.functions";
import { getRecaptchaToken } from "@/lib/recaptcha";

// === Mêmes données que la version desktop ===
const CITY_DISTANCES: Record<string, Record<string, number>> = {
  "Tours": { "Paris": 237, "Lyon": 477, "Marseille": 700, "Bordeaux": 350, "Nantes": 218, "Lille": 460, "Strasbourg": 620, "Toulouse": 530, "Nice": 840, "Montpellier": 640, "Rennes": 300, "Orléans": 117, "Poitiers": 100, "Limoges": 220, "Clermont-Ferrand": 335, "Angers": 110, "Le Mans": 82, "Blois": 60, "Chartres": 140, "Rouen": 310, "Caen": 320, "Dijon": 400, "Reims": 380, "Metz": 520, "Nancy": 500, "Brest": 530, "La Rochelle": 230, "Perpignan": 750, "Grenoble": 540, "Saint-Étienne": 430, "Amiens": 390, "Bourges": 155, "Châteauroux": 110, "Tours": 0 },
  "Paris": { "Lyon": 465, "Marseille": 775, "Bordeaux": 585, "Nantes": 385, "Lille": 225, "Strasbourg": 490, "Toulouse": 680, "Nice": 930, "Montpellier": 750, "Rennes": 350, "Orléans": 130, "Poitiers": 340, "Limoges": 395, "Clermont-Ferrand": 420, "Angers": 300, "Le Mans": 210, "Blois": 185, "Chartres": 90, "Rouen": 135, "Caen": 240, "Dijon": 310, "Reims": 145, "Metz": 330, "Nancy": 380, "Brest": 590, "La Rochelle": 470, "Perpignan": 850, "Grenoble": 570, "Saint-Étienne": 530, "Amiens": 150, "Bourges": 240, "Châteauroux": 260, "Paris": 0 },
};

const CITY_DEPARTMENTS: Record<string, string> = {
  "Tours": "37-intra",
  "Châteauroux": "37-hors",
};
const FIXED_TARIFFS: Record<string, [number, number]> = {
  "37-intra": [79, 129],
  "37-hors": [99, 129],
};
const DEPARTMENT_LABELS: Record<string, string> = {
  "37-intra": "Forfait Tours intra",
  "37-hors": "Forfait hors agglomération (37)",
};

const CITIES = [
  "Tours", "Paris", "Lyon", "Marseille", "Bordeaux", "Nantes", "Lille",
  "Strasbourg", "Toulouse", "Nice", "Montpellier", "Rennes", "Orléans",
  "Poitiers", "Limoges", "Clermont-Ferrand", "Angers", "Le Mans", "Blois",
  "Chartres", "Rouen", "Caen", "Dijon", "Reims", "Metz", "Nancy", "Brest",
  "La Rochelle", "Perpignan", "Grenoble", "Saint-Étienne", "Amiens",
  "Bourges", "Châteauroux"
].sort();

const VEHICLE_TYPES = [
  { value: "citadine", label: "Citadine" }, { value: "berline", label: "Berline" },
  { value: "suv", label: "SUV" }, { value: "utilitaire", label: "Utilitaire" },
  { value: "autre", label: "Autre" },
];
const ENERGY_TYPES = [
  { value: "diesel", label: "Diesel" }, { value: "essence", label: "Essence" },
  { value: "electrique", label: "Électrique" }, { value: "hybride", label: "Hybride" },
];
const PRESTATION_TYPES = [
  { value: "convoyage", label: "Convoyage" }, { value: "livraison", label: "Livraison" },
  { value: "mise-a-disposition", label: "Mise à disposition" }, { value: "autre", label: "Autre" },
];

function extractCity(addr: string): string {
  if (!addr) return "";
  const all = new Set<string>([...CITIES, ...Object.keys(CITY_DEPARTMENTS)]);
  const sorted = [...all].sort((a, b) => b.length - a.length);
  const lower = addr.toLowerCase();
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
  const dFromTours = CITY_DISTANCES["Tours"]?.[cFrom] ?? CITY_DISTANCES[cFrom]?.["Tours"];
  const dToTours = CITY_DISTANCES["Tours"]?.[cTo] ?? CITY_DISTANCES[cTo]?.["Tours"];
  if (dFromTours != null && dToTours != null) return Math.round((dFromTours + dToTours) * 0.85);
  return null;
}

function calculatePrice(distance: number, departure: string, arrival: string, option: string) {
  // 1) Tarif local par département (zone agglo basée sur les codes postaux)
  const local = resolveLocalDeptTariff(departure, arrival, distance, option);
  if (local) return local;
  if (distance <= 0) {
    const [simple, retour] = FIXED_TARIFFS["37-intra"];
    const label = "Forfait local (minimum)";
    if (option === "aller-retour") return { price: simple, label, finalPrice: retour, multiplierLabel: "Aller-retour", hasExtra: true };
    if (option === "express") return { price: simple, label, finalPrice: Math.round(simple * 1.20), multiplierLabel: "+20% express", hasExtra: true };
    return { price: simple, label, finalPrice: simple, multiplierLabel: "", hasExtra: false };
  }
  const rate = distance < 200 ? 1.20 : 0.85;
  const rateLabel = distance < 200 ? "1,20 €/km" : "0,85 €/km";
  const basePrice = Math.round(distance * rate);
  if (option === "aller-retour") return { price: basePrice, label: rateLabel, finalPrice: Math.round(basePrice * 1.5), multiplierLabel: "Tarif aller-retour avantageux", hasExtra: true };
  if (option === "express") return { price: basePrice, label: rateLabel, finalPrice: Math.round(basePrice * 1.20), multiplierLabel: "+20% express", hasExtra: true };
  return { price: basePrice, label: rateLabel, finalPrice: basePrice, multiplierLabel: "", hasExtra: false };
}

function estimateDuration(distance: number): string {
  const hours = distance / 80;
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

/**
 * Estimateur dédié mobile · UX premium type app native.
 * Visible uniquement < md. Le composant desktop reste inchangé.
 */
export default function MobileDevisGenerator() {
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [energy, setEnergy] = useState("");
  const [prestation, setPrestation] = useState("");
  const [option, setOption] = useState("aller-simple");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [immatriculation, setImmatriculation] = useState("");
  const [vin, setVin] = useState("");
  const [annee, setAnnee] = useState("");
  const [puissance, setPuissance] = useState("");
  const [finition, setFinition] = useState("");
  const [sivLoading, setSivLoading] = useState(false);
  const [sivMsg, setSivMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const lookupPlateFn = useServerFn(lookupPlate);
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [comment, setComment] = useState("");

  // Restitution (aller-retour)
  const [sameRetourAddress, setSameRetourAddress] = useState(true);
  const [sameRetourVehicle, setSameRetourVehicle] = useState(true);
  const [departRetour, setDepartRetour] = useState("");
  const [arriveeRetour, setArriveeRetour] = useState("");
  const [dateRetour, setDateRetour] = useState("");
  const [heureRetour, setHeureRetour] = useState("");
  const [immatRetour, setImmatRetour] = useState("");
  const [vinRetour, setVinRetour] = useState("");
  const [marqueRetour, setMarqueRetour] = useState("");
  const [modeleRetour, setModeleRetour] = useState("");
  const [sivRetourLoading, setSivRetourLoading] = useState(false);
  const [sivRetourMsg, setSivRetourMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [savedDevis, setSavedDevis] = useState<DevisData | null>(null);

  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");

  // Bottom-sheet de sélection ville
  const [pickerType, setPickerType] = useState<"dep" | "arr" | null>(null);
  const [pickerFilter, setPickerFilter] = useState("");

  const [googleDistance, setGoogleDistance] = useState<number | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [googleSuggestions, setGoogleSuggestions] = useState<PlaceSuggestion[]>([]);

  const localDistance = useMemo(() => {
    if (!departure || !arrival) return null;
    return getDistance(departure, arrival);
  }, [departure, arrival]);

  useEffect(() => {
    setGoogleDistance(null);
    if (!departure || !arrival) return;
    if (localDistance !== null) return;
    if (!isGoogleAvailable()) return;
    let cancelled = false;
    setDistanceLoading(true);
    getGoogleDistanceKm(departure, arrival)
      .then((km) => { if (!cancelled) setGoogleDistance(km); })
      .finally(() => { if (!cancelled) setDistanceLoading(false); });
    return () => { cancelled = true; };
  }, [departure, arrival, localDistance]);

  const distance = localDistance ?? googleDistance;

  const pricing = useMemo(() => {
    if (departure && arrival) {
      const local = resolveLocalDeptTariff(departure, arrival, 0, option);
      if (local) return local;
    }
    if (distance === null) return null;
    return calculatePrice(distance, departure, arrival, option);
  }, [distance, departure, arrival, option]);

  const filteredCities = CITIES.filter(c =>
    c.toLowerCase().includes(pickerFilter.toLowerCase())
  );

  // Précharge Google et alimente les suggestions du picker
  useEffect(() => { if (isGoogleAvailable()) loadGoogle().catch(() => {}); }, []);
  useEffect(() => {
    if (!pickerType) { setGoogleSuggestions([]); return; }
    if (!isGoogleAvailable() || pickerFilter.length < 2) { setGoogleSuggestions([]); return; }
    const t = setTimeout(async () => {
      const res = await getAutocompleteSuggestions(pickerFilter);
      setGoogleSuggestions(res);
    }, 220);
    return () => clearTimeout(t);
  }, [pickerFilter, pickerType]);

  const openPicker = (type: "dep" | "arr") => {
    setPickerType(type);
    setPickerFilter("");
  };

  const selectCity = (city: string) => {
    if (pickerType === "dep") setDeparture(city);
    if (pickerType === "arr") setArrival(city);
    setPickerType(null);
  };

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
    } catch {
      setSivMsg({ type: "err", text: "Erreur réseau" });
    } finally {
      setSivLoading(false);
    }
  }

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
        const d = r.data;
        if (d.marque) setMarqueRetour(d.marque);
        if (d.modele) setModeleRetour(d.modele);
        if (d.vin) setVinRetour(d.vin);
        setSivRetourMsg({ type: "ok", text: "Véhicule retour trouvé ✓" });
      }
    } catch {
      setSivRetourMsg({ type: "err", text: "Erreur réseau" });
    } finally {
      setSivRetourLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricing || distance == null) return;
    if (!date || !heure) {
      window.alert("Merci d'indiquer la date et l'heure souhaitées.");
      return;
    }
    if (option === "aller-retour" && (!dateRetour || !heureRetour)) {
      window.alert("Merci d'indiquer la date et l'heure de restitution.");
      return;
    }
    setSending(true);
    try {
      const { data: devisRow } = await supabase.from("devis").insert({
        nom, prenom, telephone, email,
        depart: departure, arrivee: arrival,
        distance_km: distance,
        duree_estimee: estimateDuration(distance),
        type_vehicule: vehicleType || null,
        marque: marque || null, modele: modele || null,
        carburant: energy || null,
        prestation: prestation || null,
        option_trajet: option,
        date_souhaitee: date || null,
        heure_souhaitee: heure || null,
        prix_estime: pricing.finalPrice,
        prix_base: pricing.price,
        tarif_label: pricing.label,
        multiplier_label: pricing.multiplierLabel || null,
        message: comment || null,
      }).select().single();

      await supabase.from("demandes_convoyage").insert({
        nom, prenom, telephone, email,
        depart: departure, arrivee: arrival,
        date_souhaitee: date || null,
        heure_souhaitee: heure,
        marque, modele, immatriculation,
        carburant: energy,
        prix_estime: pricing.finalPrice,
        distance_km: distance,
        options: [
          devisRow?.numero && `Devis: ${devisRow.numero}`,
          vehicleType && `Type: ${vehicleType}`,
          prestation && `Prestation: ${prestation}`,
          option && `Option: ${option}`,
          `Estimation: ${pricing.finalPrice}€`,
          `Distance: ${distance}km`,
          option === "aller-retour" && `Retour: ${sameRetourAddress ? `${arrival} → ${departure}` : `${departRetour || "?"} → ${arriveeRetour || "?"}`}${dateRetour ? ` le ${dateRetour}` : ""}${heureRetour ? ` à ${heureRetour}` : ""}`,
          option === "aller-retour" && !sameRetourVehicle && `Véhicule retour: ${[marqueRetour, modeleRetour].filter(Boolean).join(" ")}${immatRetour ? ` (${immatRetour})` : ""}${vinRetour ? ` VIN ${vinRetour}` : ""}`,
          comment,
        ].filter(Boolean).join(" | "),
        message: comment,
      });


      await notifyAdmin({
        type: "estimation",
        titre: `Nouvelle estimation ${devisRow?.numero ?? ""} · ${prenom} ${nom}`,
        message: `${departure} → ${arrival} · ${distance} km · ${pricing.finalPrice} €`,
        link: "/admin/devis",
        entityType: "devis",
        entityId: devisRow?.id,
        metadata: { email, telephone, prix: pricing.finalPrice, distance, option, source: "mobile" },
      });

      const devisData: DevisData = {
        numero: devisRow?.numero || `DEV-${Date.now()}`,
        nom, prenom, email, telephone,
        depart: departure, arrivee: arrival,
        distance_km: distance,
        duree_estimee: estimateDuration(distance),
        type_vehicule: vehicleType,
        marque, modele, carburant: energy,
        prestation, option_trajet: option,
        date_souhaitee: date || null,
        heure_souhaitee: heure || null,
        prix_estime: pricing.finalPrice,
        tarif_label: pricing.label,
        multiplier_label: pricing.multiplierLabel,
        message: comment,
        created_at: devisRow?.created_at,
      };
      setSavedDevis(devisData);

      try {
        await sendTransactionalEmail({
          templateName: "devis-client",
          recipientEmail: email,
          idempotencyKey: `devis-${devisRow?.id || devisData.numero}`,
          templateData: {
            prenom, nom, numero: devisData.numero,
            depart: departure, arrivee: arrival,
            distance, prix: pricing.finalPrice,
            optionTrajet: option,
          },
        });
        if (devisRow?.id) {
          await supabase.from("devis").update({ email_envoye: true }).eq("id", devisRow.id);
        }
      } catch (mailErr) {
        console.warn("Email devis non envoyé", mailErr);
      }

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setSubmitted(true);
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!savedDevis) return;
    const blob = await generateDevisPdf(savedDevis);
    downloadDevisPdf(blob, savedDevis.numero);
  };

  const inputCls = "w-full bg-[rgba(11,16,38,0.55)] border border-[rgba(212,175,55,0.22)] rounded-xl px-4 py-3.5 text-cream text-[15px] placeholder:text-cream/35 focus:border-[#e7c76a]/70 focus:ring-2 focus:ring-[#e7c76a]/15 focus:outline-none transition-all";
  const labelCls = "block text-[10.5px] uppercase tracking-[0.22em] text-[#e7c76a]/85 mb-1.5 font-heading";
  // Carte premium navy verre-fumé avec hairline doré → bleu électrique en haut
  const premiumCardCls =
    "relative rounded-2xl border border-[rgba(212,175,55,0.22)] bg-gradient-to-b from-[rgba(20,28,60,0.78)] to-[rgba(11,16,38,0.88)] shadow-[0_22px_60px_-24px_rgba(0,0,0,0.75)] backdrop-blur-xl overflow-hidden";
  const hairline = (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#e7c76a]/70 to-transparent"
    />
  );

  return (
    <section className="md:hidden">
      <div>
        {/* === STAGE 1 · Carte "Estimer mon trajet" (design HTML v3 bleu néon) === */}
        {!showForm && !submitted && (
          <div className="mdev-card">
            <div className="mdev-inner">
              {/* Header */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: "linear-gradient(135deg, rgba(63,123,255,0.4), rgba(217,181,74,0.15))",
                      border: "1px solid rgba(122,163,255,0.4)",
                    }}
                  >
                    <Zap size={15} className="text-[#8fb4ff]" strokeWidth={2} />
                  </span>
                  <h3
                    className="font-bold text-[16.5px] tracking-[-0.01em] text-white"
                    style={{ fontFamily: "'Space Grotesk',sans-serif" }}
                  >
                    Estimer mon trajet
                  </h3>
                </div>
                <span className="flex items-center gap-1.5 text-[9.5px] font-bold text-[#4ad0a0] bg-[rgba(74,208,160,0.1)] px-2.5 py-1 rounded-full">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[#4ad0a0] mdev-pulse"
                    style={{ boxShadow: "0 0 6px #4ad0a0" }}
                  />
                  Live
                </span>
              </div>

              {/* Départ */}
              <button
                type="button"
                onClick={() => openPicker("dep")}
                className="mdev-addr w-full text-left"
              >
                <span className="mdev-addr-ic">
                  <MapPin size={13} className="text-[#8fb4ff]" strokeWidth={2} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] tracking-[0.1em] uppercase text-[#9aa6c9] font-bold mb-0.5">
                    Départ
                  </div>
                  <div
                    className={`text-[13px] truncate ${
                      departure ? "text-white not-italic" : "text-[#c3cbe6] italic"
                    }`}
                  >
                    {departure || "Choisir une adresse"}
                  </div>
                </div>
                {departure && arrival && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label="Inverser départ et arrivée"
                    onClick={(e) => {
                      e.stopPropagation();
                      const d = departure;
                      setDeparture(arrival);
                      setArrival(d);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{
                      background: "rgba(122,163,255,0.16)",
                      border: "1px solid rgba(122,163,255,0.35)",
                    }}
                  >
                    <ArrowUpDown size={12} className="text-[#8fb4ff]" strokeWidth={2.4} />
                  </span>
                )}
              </button>

              {/* Connector */}
              <div className="mdev-conn">
                <div className="mdev-conn-line">
                  <div className="mdev-travel" />
                </div>
                <span className="text-[9.5px] italic text-[#9aa6c9]">
                  {distanceLoading
                    ? "Calcul en cours…"
                    : distance != null && distance > 0
                    ? `~ ${distance} km estimés`
                    : "Distance estimée en direct"}
                </span>
              </div>

              {/* Arrivée */}
              <button
                type="button"
                onClick={() => openPicker("arr")}
                className="mdev-addr w-full text-left"
              >
                <span className="mdev-addr-ic">
                  <Navigation size={13} className="text-[#8fb4ff]" strokeWidth={2} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] tracking-[0.1em] uppercase text-[#9aa6c9] font-bold mb-0.5">
                    Arrivée
                  </div>
                  <div
                    className={`text-[13px] truncate ${
                      arrival ? "text-white not-italic" : "text-[#c3cbe6] italic"
                    }`}
                  >
                    {arrival || "Choisir une adresse"}
                  </div>
                </div>
              </button>

              {/* Toggle Aller simple / Aller-retour */}
              <div
                className="relative flex mt-4 rounded-full p-1"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  border: "1px solid rgba(122,163,255,0.18)",
                }}
              >
                <span
                  className="absolute top-1 left-1 rounded-full transition-transform duration-300"
                  style={{
                    width: "calc(50% - 4px)",
                    height: "calc(100% - 8px)",
                    background: "linear-gradient(120deg,#2f5fff,#4f8cff)",
                    boxShadow: "0 8px 20px rgba(47,95,255,0.45)",
                    transform: option === "aller-retour" ? "translateX(100%)" : "translateX(0)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setOption("aller-simple")}
                  className={`relative z-[1] flex-1 text-center py-2.5 rounded-full text-[11.5px] font-bold transition-colors ${
                    option === "aller-simple" ? "text-white" : "text-[#9aa6c9]"
                  }`}
                >
                  Livraison simple
                </button>
                <button
                  type="button"
                  onClick={() => setOption("aller-retour")}
                  className={`relative z-[1] flex-1 text-center py-2.5 rounded-full text-[11.5px] font-bold transition-colors ${
                    option === "aller-retour" ? "text-white" : "text-[#9aa6c9]"
                  }`}
                >
                  Livraison + Restitution
                </button>
              </div>

              {/* Estimation preview */}
              <div
                className="flex items-center justify-between mt-3.5 rounded-[14px] px-3.5 py-3"
                style={{
                  background: "rgba(0,0,0,0.22)",
                  border: "1px solid rgba(122,163,255,0.16)",
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-[0.06em] text-[#9aa6c9] font-bold mb-1.5">
                    Estimation
                  </div>
                  {pricing ? (
                    <div
                      className="text-white text-[20px] font-extrabold leading-none"
                      style={{ fontFamily: "'Space Grotesk',sans-serif" }}
                    >
                      {pricing.finalPrice} €
                    </div>
                  ) : (
                    <div className="h-[9px] rounded mdev-shimmer" style={{ width: 88 }} />
                  )}
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span
                    className="text-[9px] font-bold text-[#4f8cff] px-2.5 py-1 rounded-full inline-block"
                    style={{ background: "rgba(63,123,255,0.14)" }}
                  >
                    {pricing
                      ? distance != null && distance > 0
                        ? `${distance} km · ${estimateDuration(distance)}`
                        : "Forfait local"
                      : distanceLoading
                      ? "Calcul en cours…"
                      : departure && arrival
                      ? "En attente"
                      : "Choisir un trajet"}
                  </span>
                </div>
              </div>

              {/* CTA "Voir mon tarif" */}
              <button
                type="button"
                disabled={!pricing}
                onClick={() => setShowForm(true)}
                className="mdev-cta mt-[18px] w-full flex items-center justify-center gap-2.5 rounded-full py-4 text-[14.5px] font-bold tracking-wide text-white disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <span className="relative z-[1]">Voir mon tarif</span>
                <ChevronRight size={16} strokeWidth={2.4} className="relative z-[1]" />
              </button>
              <p className="text-center text-[10.5px] text-[#9aa6c9] mt-2.5">
                Réponse instantanée · sans engagement
              </p>
            </div>
          </div>
        )}

        {/* === Styles locaux (design v3 bleu néon) === */}
        <style>{`
          .mdev-card {
            position: relative;
            background: rgba(14,20,44,0.94);
            border-radius: 30px;
            padding: 3px;
            box-shadow: 0 30px 60px rgba(4,8,22,0.6);
            animation: mdevFloat 6s ease-in-out infinite;
          }
          .mdev-card::before {
            content: ''; position: absolute; inset: 0; border-radius: 30px; padding: 1.4px;
            background: linear-gradient(135deg, rgba(122,163,255,0.7), rgba(217,181,74,0.35), rgba(122,163,255,0.15), rgba(79,140,255,0.6));
            background-size: 280% 280%; animation: mdevBorder 7s linear infinite;
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;
          }
          .mdev-inner {
            position: relative; background: rgba(13,19,42,0.96); border-radius: 27px;
            padding: 22px 20px; backdrop-filter: blur(18px); overflow: hidden;
          }
          .mdev-inner::before {
            content: ''; position: absolute; top: 0; left: 8%; right: 8%; height: 1px;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
          }
          @keyframes mdevFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
          @keyframes mdevBorder { 0%{background-position:0% 50%} 100%{background-position:280% 50%} }
          @keyframes mdevPulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
          .mdev-pulse { animation: mdevPulse 1.6s ease-in-out infinite; }

          .mdev-addr {
            display: flex; align-items: center; gap: 12px;
            background: rgba(0,0,0,0.25);
            border: 1px solid rgba(122,163,255,0.16);
            border-radius: 16px; padding: 13px 14px;
            position: relative; transition: border-color .2s ease, box-shadow .2s ease;
          }
          .mdev-addr:hover, .mdev-addr:focus-visible {
            border-color: rgba(122,163,255,0.55);
            box-shadow: 0 0 0 3px rgba(63,123,255,0.12);
            outline: none;
          }
          .mdev-addr-ic {
            width: 32px; height: 32px; border-radius: 50%;
            background: linear-gradient(135deg, rgba(63,123,255,0.35), rgba(47,95,255,0.1));
            border: 1px solid rgba(122,163,255,0.4); flex-shrink: 0;
            box-shadow: 0 0 10px rgba(63,123,255,0.3);
            display: flex; align-items: center; justify-content: center;
          }
          .mdev-conn {
            position: relative; display: flex; align-items: center; gap: 10px;
            padding-left: 14px; margin: 6px 0; height: 22px;
          }
          .mdev-conn-line {
            position: relative; width: 1.5px; height: 22px; margin-left: 15px; overflow: hidden;
            background: repeating-linear-gradient(180deg, rgba(122,163,255,0.5) 0 3px, transparent 3px 6px);
          }
          .mdev-travel {
            position: absolute; left: -2.5px; top: 0; width: 6px; height: 6px; border-radius: 50%;
            background: #d9b54a; box-shadow: 0 0 8px 2px rgba(217,181,74,0.7);
            animation: mdevTravel 2.4s ease-in-out infinite;
          }
          @keyframes mdevTravel { 0%{top:0;opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{top:100%;opacity:0} }

          .mdev-shimmer {
            background: linear-gradient(90deg, rgba(122,163,255,0.15) 25%, rgba(122,163,255,0.4) 50%, rgba(122,163,255,0.15) 75%);
            background-size: 200% 100%;
            animation: mdevShim 1.6s ease-in-out infinite;
          }
          @keyframes mdevShim { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

          .mdev-cta {
            position: relative; overflow: hidden;
            background: linear-gradient(120deg, #2f5fff 0%, #2450e0 60%, #4f8cff 130%);
            box-shadow: 0 16px 36px rgba(47,95,255,0.5);
          }
          .mdev-cta:not(:disabled)::after {
            content: ''; position: absolute; top: 0; left: -60%; width: 40%; height: 100%;
            background: linear-gradient(120deg, transparent, rgba(255,255,255,0.35), transparent);
            transform: skewX(-20deg); animation: mdevShine 3.4s ease-in-out infinite;
          }
          @keyframes mdevShine { 0%{left:-60%} 45%{left:130%} 100%{left:130%} }
        `}</style>

        {/* Loading / non-calculable · messages hors carte */}
        {!showForm && !submitted && departure && arrival && distance === null && !distanceLoading && (
          <p className="mt-2 text-center text-[10.5px] text-[#e7c76a]/90">
            Distance non calculable automatiquement · nous confirmerons manuellement.
          </p>
        )}



        {/* Formulaire complet */}
        {showForm && !submitted && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 text-primary text-xs font-heading tracking-wider uppercase mb-2"
            >
              <ArrowLeft size={14} /> Retour
            </button>

            {/* Récap trajet */}
            {pricing && (
              <div className={`${premiumCardCls} p-4`}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-cream/55 text-[10px] uppercase tracking-wider">Trajet</p>
                    <p className="text-cream text-sm font-heading truncate">
                      {departure} → {arrival}
                    </p>
                    <p className="text-cream/45 text-[11px]">{distance} km · {estimateDuration(distance!)}</p>
                  </div>
                  <p className="font-heading gold-gradient-text text-2xl ml-3 shrink-0">
                    {pricing.finalPrice}€
                  </p>
                </div>
              </div>
            )}

            {/* Coordonnées */}
            <div className={`${premiumCardCls} p-5 space-y-4`}>
              <p className="font-heading text-primary/80 text-[11px] tracking-[0.2em] uppercase">
                Vos coordonnées
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}><User size={11} className="inline mr-1" />Nom *</label>
                  <input type="text" value={nom} onChange={e => setNom(e.target.value)} className={inputCls} required />
                </div>
                <div>
                  <label className={labelCls}><User size={11} className="inline mr-1" />Prénom *</label>
                  <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} className={inputCls} required />
                </div>
              </div>
              <div>
                <label className={labelCls}><Phone size={11} className="inline mr-1" />Téléphone *</label>
                <input type="tel" inputMode="tel" value={telephone} onChange={e => setTelephone(e.target.value)} className={inputCls} required />
              </div>
              <div>
                <label className={labelCls}><Mail size={11} className="inline mr-1" />Email *</label>
                <input type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} required />
              </div>
            </div>

            {/* Véhicule */}
            <div className={`${premiumCardCls} p-5 space-y-4`}>
              <p className="font-heading text-primary/80 text-[11px] tracking-[0.2em] uppercase">
                Véhicule
              </p>

              {/* 1. Plaque + recherche */}
              <div>
                <label className={labelCls}>Plaque d'immatriculation</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={immatriculation}
                    onChange={e => { setImmatriculation(e.target.value.toUpperCase()); setSivMsg(null); }}
                    placeholder="AA-123-AA"
                    className={`${inputCls} uppercase tracking-widest flex-1`}
                  />
                  <button
                    type="button"
                    onClick={handleSivLookup}
                    disabled={sivLoading || !immatriculation}
                    className="px-4 rounded-xl border border-[#e7c76a]/60 bg-gradient-to-b from-[#e7c76a]/25 to-[#d4af37]/15 text-[#e7c76a] text-xs font-semibold uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {sivLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {sivLoading ? "..." : "Rechercher"}
                  </button>
                </div>
                {sivMsg && (
                  <p className={`mt-2 text-[11px] ${sivMsg.type === "ok" ? "text-emerald-500" : "text-red-500"}`}>
                    {sivMsg.text}
                  </p>
                )}
                <p className="mt-1.5 text-[10px] text-primary/50">
                  Pré-remplit le véhicule automatiquement.
                </p>
              </div>

              {/* 2. VIN optionnel */}
              <div>
                <label className={labelCls}>VIN <span className="opacity-60 normal-case">(optionnel)</span></label>
                <input
                  type="text"
                  value={vin}
                  onChange={e => setVin(e.target.value.toUpperCase())}
                  placeholder="Auto-rempli via la plaque"
                  className={`${inputCls} uppercase tracking-widest`}
                  maxLength={17}
                />
              </div>

              {/* 3. Infos auto-remplies */}
              {(annee || puissance || finition) && (
                <div className="p-3 rounded-xl border border-[#e7c76a]/30 bg-[#e7c76a]/[0.06] text-[11px] text-primary/75 grid grid-cols-2 gap-x-3 gap-y-1">
                  {annee && <div><span className="opacity-60">Année :</span> {annee}</div>}
                  {puissance && <div><span className="opacity-60">Puissance :</span> {puissance}</div>}
                  {finition && <div className="col-span-2"><span className="opacity-60">Finition :</span> {finition}</div>}
                </div>
              )}

              {/* 4. Marque / Modèle */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Marque</label>
                  <input type="text" value={marque} onChange={e => setMarque(e.target.value)} placeholder="Peugeot" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Modèle</label>
                  <input type="text" value={modele} onChange={e => setModele(e.target.value)} placeholder="308" className={inputCls} />
                </div>
              </div>

              {/* 5 & 6. Type + Carburant */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}><Car size={11} className="inline mr-1" />Type</label>
                  <div className="relative">
                    <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
                      <option value=""> · </option>
                      {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}><Fuel size={11} className="inline mr-1" />Énergie</label>
                  <div className="relative">
                    <select value={energy} onChange={e => setEnergy(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
                      <option value=""> · </option>
                      {ENERGY_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Prestation & date */}
            <div className={`${premiumCardCls} p-5 space-y-4`}>
              <p className="font-heading text-primary/80 text-[11px] tracking-[0.2em] uppercase">
                Prestation
              </p>
              <div>
                <label className={labelCls}>Type de prestation</label>
                <div className="relative">
                  <select value={prestation} onChange={e => setPrestation(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
                    <option value=""> · </option>
                    {PRESTATION_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}><Calendar size={11} className="inline mr-1" />Date *</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Heure de livraison *</label>
                  <input type="time" required value={heure} onChange={e => setHeure(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Commentaire</label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  rows={3}
                  placeholder="Infos complémentaires..."
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            {/* Restitution (Aller-retour) */}
            {option === "aller-retour" && (
              <div className={`${premiumCardCls} p-5 space-y-4`}>
                <p className="font-heading text-primary/80 text-[11px] tracking-[0.2em] uppercase">
                  Restitution (retour)
                </p>

                {/* Adresses */}
                <label className="flex items-center gap-2 text-cream/85 text-[12px]">
                  <input
                    type="checkbox"
                    checked={sameRetourAddress}
                    onChange={(e) => setSameRetourAddress(e.target.checked)}
                    className="w-4 h-4 accent-[#e7c76a]"
                  />
                  Mêmes adresses (retour = arrivée → départ)
                </label>
                {!sameRetourAddress && (
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>Départ retour</label>
                      <input
                        type="text"
                        value={departRetour}
                        onChange={(e) => setDepartRetour(e.target.value)}
                        placeholder="Adresse de prise en charge du retour"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Arrivée retour</label>
                      <input
                        type="text"
                        value={arriveeRetour}
                        onChange={(e) => setArriveeRetour(e.target.value)}
                        placeholder="Adresse de restitution"
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}

                {/* Date / Heure retour */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}><Calendar size={11} className="inline mr-1" />Date retour *</label>
                    <input type="date" required value={dateRetour} onChange={e => setDateRetour(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Heure retour *</label>
                    <input type="time" required value={heureRetour} onChange={e => setHeureRetour(e.target.value)} className={inputCls} />
                  </div>
                </div>

                {/* Véhicule retour */}
                <label className="flex items-center gap-2 text-cream/85 text-[12px]">
                  <input
                    type="checkbox"
                    checked={sameRetourVehicle}
                    onChange={(e) => setSameRetourVehicle(e.target.checked)}
                    className="w-4 h-4 accent-[#e7c76a]"
                  />
                  Même véhicule à l'aller et au retour
                </label>
                {!sameRetourVehicle && (
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>Plaque retour</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={immatRetour}
                          onChange={e => { setImmatRetour(e.target.value.toUpperCase()); setSivRetourMsg(null); }}
                          placeholder="AA-123-AA"
                          className={`${inputCls} uppercase tracking-widest flex-1`}
                        />
                        <button
                          type="button"
                          onClick={handleSivRetourLookup}
                          disabled={sivRetourLoading || !immatRetour}
                          className="px-4 rounded-xl border border-[#e7c76a]/60 bg-gradient-to-b from-[#e7c76a]/25 to-[#d4af37]/15 text-[#e7c76a] text-xs font-semibold uppercase tracking-wider disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          {sivRetourLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                          {sivRetourLoading ? "..." : "Rechercher"}
                        </button>
                      </div>
                      {sivRetourMsg && (
                        <p className={`mt-2 text-[11px] ${sivRetourMsg.type === "ok" ? "text-emerald-500" : "text-red-500"}`}>
                          {sivRetourMsg.text}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>VIN retour <span className="opacity-60 normal-case">(optionnel)</span></label>
                      <input
                        type="text"
                        value={vinRetour}
                        onChange={e => setVinRetour(e.target.value.toUpperCase())}
                        className={`${inputCls} uppercase tracking-widest`}
                        maxLength={17}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Marque retour</label>
                        <input type="text" value={marqueRetour} onChange={e => setMarqueRetour(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Modèle retour</label>
                        <input type="text" value={modeleRetour} onChange={e => setModeleRetour(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}



            {/* CTA submit fixe en bas du formulaire */}
            <button
              type="submit"
              disabled={sending}
              className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase tap-scale flex items-center justify-center gap-2 disabled:opacity-60 shadow-[0_10px_30px_-10px_rgba(212,175,55,0.5)]"
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Envoyer ma demande
                </>
              )}
            </button>
          </form>
        )}

        {/* Confirmation */}
        {submitted && (
          <div className={`${premiumCardCls} p-6 text-center`}>
            <div className="w-16 h-16 rounded-full gold-border flex items-center justify-center mx-auto mb-5 bg-primary/10">
              <CheckCircle className="text-primary" size={32} />
            </div>
            <h3 className="font-heading text-lg text-primary tracking-[0.1em] uppercase mb-2">
              Devis envoyé
            </h3>
            {savedDevis && (
              <p className="text-primary/70 text-[11px] tracking-wider uppercase mb-3">
                N° {savedDevis.numero}
              </p>
            )}
            <p className="text-cream/70 text-sm leading-relaxed">
              Un récapitulatif vient de vous être envoyé par email.
              Notre équipe vous recontactera rapidement.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {savedDevis && (
                <button
                  onClick={handleDownloadPdf}
                  className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-heading text-xs tracking-[0.15em] uppercase tap-scale inline-flex items-center justify-center gap-2"
                >
                  <Download size={14} /> Télécharger le PDF
                </button>
              )}
              <button
                onClick={() => {
                  setSubmitted(false); setShowForm(false); setSavedDevis(null);
                  setNom(""); setPrenom(""); setTelephone(""); setEmail(""); setComment("");
                }}
                className="w-full h-12 rounded-xl gold-border text-primary font-heading text-xs tracking-[0.15em] uppercase tap-scale"
              >
                Nouvelle estimation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom sheet · Sélecteur de villes (portal pour échapper à tout
          ancêtre avec filter / backdrop-filter / transform qui briserait
          le position: fixed) */}
      {pickerType && typeof document !== "undefined" && createPortal((
        <div className="fixed inset-0 z-50 flex flex-col">
          <button
            type="button"
            onClick={() => setPickerType(null)}
            className="flex-1 bg-black/60 backdrop-blur-sm animate-fade-in"
            aria-label="Fermer"
          />
          <div className="bg-navy-light border-t gold-border-strong rounded-t-3xl max-h-[80vh] flex flex-col animate-sheet-up safe-bottom">
            <div className="px-5 pt-3 pb-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-cream/20 mx-auto mb-3" />
              <p className="font-heading text-primary text-base tracking-wide text-center">
                {pickerType === "dep" ? "Ville de départ" : "Ville d'arrivée"}
              </p>
            </div>
            <div className="px-5 pb-3 shrink-0">
              <input
                autoFocus
                type="text"
                value={pickerFilter}
                onChange={e => setPickerFilter(e.target.value)}
                placeholder="Rechercher..."
                className="w-full bg-navy/60 border border-primary/20 rounded-xl px-4 py-3 text-cream text-base focus:border-primary/60 focus:outline-none"
              />
            </div>
            <div className="overflow-y-auto px-3 pb-6 flex-1">
              {googleSuggestions.length > 0 && (
                <>
                  <p className="px-4 pt-1 pb-2 text-[10px] uppercase tracking-[0.2em] text-primary/70 font-heading">
                    Suggestions Google
                  </p>
                  {googleSuggestions.map((s) => (
                    <button
                      key={s.placeId || s.label}
                      type="button"
                      onClick={() => { resetPlacesSession(); selectCity(s.label); }}
                      className="w-full text-left px-4 py-3 rounded-xl text-cream hover:bg-primary/10 active:bg-primary/15 transition-colors flex items-start gap-3"
                    >
                      <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{s.label}</p>
                        {s.secondary && (
                          <p className="text-[11px] text-cream/50 truncate">{s.secondary}</p>
                        )}
                      </div>
                    </button>
                  ))}
                  <div className="h-px bg-primary/15 my-2 mx-4" />
                </>
              )}

              {(googleSuggestions.length > 0 || filteredCities.length > 0) && (
                <p className="px-4 pt-1 pb-2 text-[10px] uppercase tracking-[0.2em] text-cream/45 font-heading">
                  Villes fréquentes
                </p>
              )}
              {filteredCities.map(city => (
                <button
                  key={city}
                  type="button"
                  onClick={() => selectCity(city)}
                  className="w-full text-left px-4 py-3.5 rounded-xl text-cream hover:bg-primary/10 active:bg-primary/15 transition-colors flex items-center justify-between"
                >
                  <span>{city}</span>
                  {((pickerType === "dep" && city === departure) ||
                    (pickerType === "arr" && city === arrival)) && (
                    <CheckCircle size={16} className="text-primary" />
                  )}
                </button>
              ))}
              {filteredCities.length === 0 && googleSuggestions.length === 0 && (
                <p className="text-center text-cream/50 text-sm py-8">
                  {pickerFilter.length < 2
                    ? "Tapez au moins 2 caractères pour rechercher une adresse"
                    : "Aucun résultat"}
                </p>
              )}
            </div>
          </div>
        </div>
      ), document.body)}
    </section>
  );
}
