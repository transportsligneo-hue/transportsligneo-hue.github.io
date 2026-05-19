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
  return addr.trim() === c2 ? addr : (addr.trim().split(",")[0] || "");
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
  const dDep = CITY_DEPARTMENTS[departure]; const dArr = CITY_DEPARTMENTS[arrival];
  const dept = dDep && dArr ? dArr : null;
  if (dept && FIXED_TARIFFS[dept]) {
    const [simple, retour] = FIXED_TARIFFS[dept];
    const label = DEPARTMENT_LABELS[dept] || dept;
    if (option === "aller-retour") return { price: simple, label, finalPrice: retour, multiplierLabel: "Aller-retour", hasExtra: true };
    if (option === "express") return { price: simple, label, finalPrice: Math.round(simple * 1.20), multiplierLabel: "+20% express", hasExtra: true };
    return { price: simple, label, finalPrice: simple, multiplierLabel: "", hasExtra: false };
  }
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

export default function DevisGenerator() {
  // --- core trajet ---
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [option] = useState("aller-simple");

  // --- véhicule ---
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [immatriculation, setImmatriculation] = useState("");
  const [plaqueInconnue, setPlaqueInconnue] = useState(false);
  const [energy, setEnergy] = useState("");
  const [running, setRunning] = useState<"oui" | "non">("oui");

  // --- coordonnées ---
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [societe, setSociete] = useState("");
  const [comment, setComment] = useState("");

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

  const [depFilter, setDepFilter] = useState("");
  const [arrFilter, setArrFilter] = useState("");
  const [depOpen, setDepOpen] = useState(false);
  const [arrOpen, setArrOpen] = useState(false);

  const distance = useMemo(() => {
    if (!departure || !arrival) return null;
    return getDistance(departure, arrival);
  }, [departure, arrival]);

  const pricing = useMemo(() => {
    if (distance === null || distance === 0) return null;
    return calculatePrice(distance, departure, arrival, option);
  }, [distance, departure, arrival, option]);

  const filteredDep = CITIES.filter(c => c.toLowerCase().includes(depFilter.toLowerCase()));
  const filteredArr = CITIES.filter(c => c.toLowerCase().includes(arrFilter.toLowerCase()));

  const isComplete = !!(departure && arrival && vehicleType);
  const priceHT = pricing?.finalPrice ?? 0;
  const tva = Math.round(priceHT * 0.2);
  const priceTTC = priceHT + tva;

  const inputBare = "w-full bg-transparent text-cream text-sm placeholder:text-cream/40 focus:outline-none";
  const inputCard = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-cream text-sm placeholder:text-cream/40 focus:border-[#5fb6ff]/60 focus:outline-none focus:ring-1 focus:ring-[#5fb6ff]/30 transition-all";
  const selectCard = inputCard + " appearance-none";

  async function handleSubmit() {
    if (!pricing || distance == null) return;
    if (!cguAccepted) { setAccountError("Vous devez accepter les CGU pour continuer."); return; }
    if (password.length < 8) { setAccountError("Le mot de passe doit contenir au moins 8 caractères."); return; }
    setAccountError("");
    setSending(true);
    try {
      // 1) Création du compte client (vérification email requise côté Supabase)
      try {
        const token = await getRecaptchaToken("signup_devis");
        // reCAPTCHA token is optional; signup proceeds even if unavailable
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

      let isExistingAccount = false;
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
      }).select().single();

      await supabase.from("demandes_convoyage").insert({
        nom, prenom, telephone, email,
        depart: departure, arrivee: arrival,
        date_souhaitee: date || null, heure_souhaitee: heure,
        marque, modele,
        immatriculation: plaqueInconnue ? "" : immatriculation,
        carburant: energy,
        options: [
          devisRow?.numero && `Devis: ${devisRow.numero}`,
          vehicleType && `Type: ${vehicleType}`,
          societe && `Société: ${societe}`,
          `Roulant: ${running}`,
          plaqueInconnue && "Plaque: à confirmer",
          `Estimation: ${pricing.finalPrice}€`,
          `Distance: ${distance}km`,
          comment,
        ].filter(Boolean).join(" | "),
        message: comment,
      });

      await notifyAdmin({
        type: "estimation",
        titre: `Nouvelle estimation ${devisRow?.numero ?? ""} — ${prenom} ${nom}`,
        message: `${departure} → ${arrival} · ${distance} km · ${pricing.finalPrice} €`,
        link: "/admin/devis",
        entityType: "devis", entityId: devisRow?.id,
        metadata: { email, telephone, prix: pricing.finalPrice, distance, option, account: isExistingAccount ? "existing" : "created" },
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
        await sendTransactionalEmail({
          templateName: "devis-client",
          recipientEmail: email,
          idempotencyKey: `devis-${devisRow?.id || devisData.numero}`,
          templateData: { prenom, nom, numero: devisData.numero, depart: departure, arrivee: arrival, distance, prix: pricing.finalPrice, optionTrajet: option },
        });
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

  // --- ESTIMATEUR : barre flottante + détail prix ---
  return (
    <div className="w-full">
      {/* Barre estimateur premium */}
      <div className="relative max-w-5xl mx-auto">
        <div aria-hidden className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-[#5fb6ff]/20 via-transparent to-[#e7c76a]/15 blur-md opacity-70" />
        <div className="relative rounded-2xl border border-[#5fb6ff]/25 bg-white/[0.04] backdrop-blur-xl shadow-[0_20px_60px_-25px_rgba(0,0,0,0.7)]">
          <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1.3fr_1fr_0.9fr_0.7fr_auto] divide-y md:divide-y-0 md:divide-x divide-white/10">
            {/* Départ */}
            <div className="relative px-4 py-3">
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-cream/55 mb-1">
                <MapPin size={11} className="text-[#5fb6ff]" /> Départ
              </label>
              <input
                type="text"
                value={departure || depFilter}
                onChange={(e) => { setDepFilter(e.target.value); setDeparture(""); setDepOpen(true); }}
                onFocus={() => setDepOpen(true)}
                onBlur={() => setTimeout(() => setDepOpen(false), 150)}
                placeholder="Ville de départ"
                className={inputBare}
              />
              {depOpen && depFilter && filteredDep.length > 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 mx-2 bg-[#0b1026] border border-[#5fb6ff]/25 rounded-xl max-h-56 overflow-y-auto shadow-2xl">
                  {filteredDep.map(c => (
                    <button key={c} type="button"
                      className="w-full text-left px-4 py-2 text-sm text-cream/80 hover:bg-[#5fb6ff]/10 hover:text-[#5fb6ff]"
                      onClick={() => { setDeparture(c); setDepFilter(""); setDepOpen(false); }}>{c}</button>
                  ))}
                </div>
              )}
            </div>
            {/* Arrivée */}
            <div className="relative px-4 py-3">
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-cream/55 mb-1">
                <MapPinned size={11} className="text-[#5fb6ff]" /> Arrivée
              </label>
              <input
                type="text"
                value={arrival || arrFilter}
                onChange={(e) => { setArrFilter(e.target.value); setArrival(""); setArrOpen(true); }}
                onFocus={() => setArrOpen(true)}
                onBlur={() => setTimeout(() => setArrOpen(false), 150)}
                placeholder="Ville d'arrivée"
                className={inputBare}
              />
              {arrOpen && arrFilter && filteredArr.length > 0 && (
                <div className="absolute z-30 left-0 right-0 top-full mt-1 mx-2 bg-[#0b1026] border border-[#5fb6ff]/25 rounded-xl max-h-56 overflow-y-auto shadow-2xl">
                  {filteredArr.map(c => (
                    <button key={c} type="button"
                      className="w-full text-left px-4 py-2 text-sm text-cream/80 hover:bg-[#5fb6ff]/10 hover:text-[#5fb6ff]"
                      onClick={() => { setArrival(c); setArrFilter(""); setArrOpen(false); }}>{c}</button>
                  ))}
                </div>
              )}
            </div>
            {/* Type véhicule */}
            <div className="px-4 py-3 relative">
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-cream/55 mb-1">
                <Car size={11} className="text-[#5fb6ff]" /> Véhicule
              </label>
              <select value={vehicleType} onChange={e => setVehicleType(e.target.value)}
                className={inputBare + " appearance-none pr-5 cursor-pointer"}>
                <option value="" className="bg-[#0b1026]">Sélectionner</option>
                {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value} className="bg-[#0b1026]">{v.label}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-3 bottom-4 text-[#5fb6ff]/60 pointer-events-none" />
            </div>
            {/* Date */}
            <div className="px-4 py-3">
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-cream/55 mb-1">
                <Calendar size={11} className="text-[#5fb6ff]" /> Date
              </label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className={inputBare + " [color-scheme:dark]"} />
            </div>
            {/* Heure */}
            <div className="px-4 py-3">
              <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-cream/55 mb-1">
                <Clock size={11} className="text-[#5fb6ff]" /> Heure
              </label>
              <input type="time" value={heure} onChange={e => setHeure(e.target.value)}
                className={inputBare + " [color-scheme:dark]"} />
            </div>
            {/* CTA */}
            <div className="p-2 flex items-stretch">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={!isComplete}
                className="inline-flex items-center justify-center gap-2 px-5 md:px-6 rounded-xl bg-gradient-to-r from-[#e7c76a] to-[#d4af37] text-[#0b1026] font-heading text-[11px] tracking-[0.2em] uppercase shadow-[0_8px_30px_-8px_rgba(231,199,106,0.6)] hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Send size={13} /> Obtenir mon prix
              </button>
            </div>
          </div>
        </div>

        {/* Détail prix EN LIVE — visible immédiatement, sans clic */}
        {isComplete && pricing && distance !== null && distance > 0 && (
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
                <p className="font-heading text-base text-cream/85">{estimateDuration(distance)}</p>
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
          </div>
        )}
        {isComplete && distance === 0 && (
          <p className="mt-3 text-cream/60 text-xs text-center">Les villes de départ et d'arrivée sont identiques.</p>
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
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#5fb6ff]/25 bg-gradient-to-br from-[#0b1026] via-[#0d1530] to-black shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
            {/* Stepper */}
            <div className="sticky top-0 z-10 bg-gradient-to-b from-[#0b1026] to-[#0b1026]/95 backdrop-blur px-6 md:px-10 pt-6 pb-4 border-b border-white/5">
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
              {/* STEP 1 — Trajet (récap modifiable) */}
              {step === 1 && (
                <div className="space-y-5 animate-fade-in">
                  <h4 className="font-heading text-lg text-cream tracking-wide">Confirmez votre trajet</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Départ *</label>
                      <input value={departure} onChange={e => setDeparture(e.target.value)} className={inputCard} required />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Arrivée *</label>
                      <input value={arrival} onChange={e => setArrival(e.target.value)} className={inputCard} required />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Date souhaitée</label>
                      <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCard + " [color-scheme:dark]"} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Heure souhaitée</label>
                      <input type="time" value={heure} onChange={e => setHeure(e.target.value)} className={inputCard + " [color-scheme:dark]"} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Instructions particulières</label>
                    <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                      placeholder="Code d'accès, contact sur place, contraintes horaires..."
                      className={inputCard + " resize-none"} />
                  </div>
                </div>
              )}

              {/* STEP 2 — Véhicule */}
              {step === 2 && (
                <div className="space-y-5 animate-fade-in">
                  <h4 className="font-heading text-lg text-cream tracking-wide">Informations véhicule</h4>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Marque</label>
                      <input value={marque} onChange={e => setMarque(e.target.value)} placeholder="Ex: Peugeot" className={inputCard} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Modèle</label>
                      <input value={modele} onChange={e => setModele(e.target.value)} placeholder="Ex: 308" className={inputCard} />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Type de véhicule *</label>
                      <div className="relative">
                        <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={selectCard}>
                          <option value="" className="bg-[#0b1026]">Sélectionner</option>
                          {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value} className="bg-[#0b1026]">{v.label}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5fb6ff]/60 pointer-events-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Carburant</label>
                      <div className="relative">
                        <select value={energy} onChange={e => setEnergy(e.target.value)} className={selectCard}>
                          <option value="" className="bg-[#0b1026]">Sélectionner</option>
                          {ENERGY_TYPES.map(v => <option key={v.value} value={v.value} className="bg-[#0b1026]">{v.label}</option>)}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5fb6ff]/60 pointer-events-none" />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">Plaque d'immatriculation</label>
                      <input
                        value={immatriculation}
                        onChange={e => setImmatriculation(e.target.value.toUpperCase())}
                        placeholder="AA-123-AA"
                        disabled={plaqueInconnue}
                        className={inputCard + " uppercase tracking-widest disabled:opacity-50"}
                      />
                      <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-cream/65 cursor-pointer">
                        <input type="checkbox" checked={plaqueInconnue} onChange={e => setPlaqueInconnue(e.target.checked)}
                          className="accent-[#5fb6ff]" />
                        Je ne connais pas encore la plaque
                      </label>
                    </div>
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
                </div>
              )}

              {/* STEP 3 — Coordonnées */}
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

                  {/* Bloc compte client */}
                  <div className="mt-2 rounded-2xl border border-[#5fb6ff]/25 bg-[#5fb6ff]/[0.04] p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-[#5fb6ff]/15 p-2 mt-0.5">
                        <Lock size={14} className="text-[#5fb6ff]" />
                      </div>
                      <div>
                        <p className="font-heading text-sm text-cream tracking-wide">Votre espace client</p>
                        <p className="text-cream/55 text-xs mt-1 leading-relaxed">
                          Un compte est créé automatiquement pour suivre votre devis, votre mission et vos documents
                          dans un espace sécurisé. Vous recevrez un email de vérification.
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-1.5 block">
                        <Lock size={11} className="inline mr-1" /> Mot de passe *
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className={inputCard}
                        placeholder="Minimum 8 caractères"
                        minLength={8}
                        required
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
                </div>
              )}

              {/* STEP 4 — Récap */}
              {step === 4 && (
                <div className="space-y-5 animate-fade-in">
                  <h4 className="font-heading text-lg text-cream tracking-wide">Récapitulatif</h4>
                  <div className="rounded-2xl border border-[#5fb6ff]/20 bg-white/[0.03] p-5 space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3 text-cream/80">
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Trajet</p>{departure} → {arrival}</div>
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Distance</p>{distance} km · {distance ? estimateDuration(distance) : ""}</div>
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Véhicule</p>{[marque, modele].filter(Boolean).join(" ") || vehicleType || "—"}</div>
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Plaque</p>{plaqueInconnue ? "À confirmer" : (immatriculation || "—")}</div>
                      <div><p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Date / Heure</p>{date || "—"} {heure}</div>
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
            <div className="sticky bottom-0 bg-gradient-to-t from-[#0b1026] to-[#0b1026]/95 backdrop-blur px-6 md:px-10 py-4 border-t border-white/5 flex items-center justify-between gap-3">
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
                    (step === 3 && (!nom || !prenom || !email || !telephone || password.length < 8 || !cguAccepted))
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
                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-[#e7c76a] to-[#d4af37] text-[#0b1026] font-heading text-xs tracking-[0.2em] uppercase shadow-[0_8px_30px_-8px_rgba(231,199,106,0.6)] hover:brightness-110 disabled:opacity-50"
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
          <div className="relative w-full max-w-xl rounded-3xl border border-[#5fb6ff]/25 bg-gradient-to-br from-[#0b1026] via-[#0d1530] to-black p-8 md:p-10 text-center shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
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
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#5fb6ff] to-[#3b82f6] text-white font-heading text-xs tracking-[0.2em] uppercase shadow-[0_8px_30px_-8px_rgba(95,182,255,0.6)] hover:brightness-110">
                <User size={13} /> Mon espace client
              </Link>
              {savedDevis && (
                <button onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#e7c76a] to-[#d4af37] text-[#0b1026] font-heading text-xs tracking-[0.2em] uppercase hover:brightness-110">
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
