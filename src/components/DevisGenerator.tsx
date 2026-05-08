import { useState, useMemo } from "react";
import { MapPin, Navigation, Clock, Euro, Car, Fuel, Calendar, ChevronDown, Send, Loader2, CheckCircle, User, Phone, Mail, Download, Shield, Wallet, Route as RouteIcon, MapPinned, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateDevisPdf, downloadDevisPdf, type DevisData } from "@/lib/devis-pdf";
import { sendTransactionalEmail } from "@/lib/email/send";
import { notifyAdmin } from "@/lib/admin-notifications";

// Pre-defined distances (km) from Tours to major French cities
const CITY_DISTANCES: Record<string, Record<string, number>> = {
  "Tours": { "Paris": 237, "Lyon": 477, "Marseille": 700, "Bordeaux": 350, "Nantes": 218, "Lille": 460, "Strasbourg": 620, "Toulouse": 530, "Nice": 840, "Montpellier": 640, "Rennes": 300, "Orléans": 117, "Poitiers": 100, "Limoges": 220, "Clermont-Ferrand": 335, "Angers": 110, "Le Mans": 82, "Blois": 60, "Chartres": 140, "Rouen": 310, "Caen": 320, "Dijon": 400, "Reims": 380, "Metz": 520, "Nancy": 500, "Brest": 530, "La Rochelle": 230, "Perpignan": 750, "Grenoble": 540, "Saint-Étienne": 430, "Amiens": 390, "Bourges": 155, "Châteauroux": 110, "Tours": 0 },
  "Paris": { "Lyon": 465, "Marseille": 775, "Bordeaux": 585, "Nantes": 385, "Lille": 225, "Strasbourg": 490, "Toulouse": 680, "Nice": 930, "Montpellier": 750, "Rennes": 350, "Orléans": 130, "Poitiers": 340, "Limoges": 395, "Clermont-Ferrand": 420, "Angers": 300, "Le Mans": 210, "Blois": 185, "Chartres": 90, "Rouen": 135, "Caen": 240, "Dijon": 310, "Reims": 145, "Metz": 330, "Nancy": 380, "Brest": 590, "La Rochelle": 470, "Perpignan": 850, "Grenoble": 570, "Saint-Étienne": 530, "Amiens": 150, "Bourges": 240, "Châteauroux": 260, "Paris": 0 },
};

// Seuls les forfaits du département 37 sont appliqués.
// Tout le reste passe en tarif au km : 0,85 €/km.
const CITY_DEPARTMENTS: Record<string, string> = {
  "Tours": "37-intra",
  "Châteauroux": "37-hors", // exemple historique d'arrivée hors agglo 37
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

function getDistance(from: string, to: string): number | null {
  if (from === to) return 0;
  if (CITY_DISTANCES[from]?.[to]) return CITY_DISTANCES[from][to];
  if (CITY_DISTANCES[to]?.[from]) return CITY_DISTANCES[to][from];
  const dFromTours = CITY_DISTANCES["Tours"]?.[from] ?? CITY_DISTANCES[from]?.["Tours"];
  const dToTours = CITY_DISTANCES["Tours"]?.[to] ?? CITY_DISTANCES[to]?.["Tours"];
  if (dFromTours != null && dToTours != null) {
    return Math.round((dFromTours + dToTours) * 0.85);
  }
  return null;
}

function calculatePrice(distance: number, departure: string, arrival: string, option: string) {
  // Forfait 37 uniquement si départ ET arrivée sont dans le 37
  const deptDep = CITY_DEPARTMENTS[departure];
  const deptArr = CITY_DEPARTMENTS[arrival];
  const dept = deptDep && deptArr ? deptArr : null;
  if (dept && FIXED_TARIFFS[dept]) {
    const [simple, retour] = FIXED_TARIFFS[dept];
    const label = DEPARTMENT_LABELS[dept] || dept;
    if (option === "aller-retour") return { price: simple, label, finalPrice: retour, multiplierLabel: "Aller-retour", hasExtra: true };
    if (option === "express") return { price: simple, label, finalPrice: Math.round(simple * 1.20), multiplierLabel: "+20% express", hasExtra: true };
    return { price: simple, label, finalPrice: simple, multiplierLabel: "", hasExtra: false };
  }
  // Hors 37 : 1,20 €/km en dessous de 200 km, 0,85 €/km au-dessus.
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

export default function DevisGenerator() {
  const [departure, setDeparture] = useState("");
  const [arrival, setArrival] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [energy, setEnergy] = useState("");
  const [prestation, setPrestation] = useState("");
  const [option, setOption] = useState("aller-simple");
  const [marque, setMarque] = useState("");
  const [modele, setModele] = useState("");
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [comment, setComment] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [savedDevis, setSavedDevis] = useState<DevisData | null>(null);

  // Contact info for devis
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");

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
  }, [distance, arrival, option]);

  const filteredDepCities = CITIES.filter(c => c.toLowerCase().includes(depFilter.toLowerCase()));
  const filteredArrCities = CITIES.filter(c => c.toLowerCase().includes(arrFilter.toLowerCase()));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricing || distance == null) return;
    setSending(true);

    try {
      // 1. Save devis to dedicated table (with auto numero)
      const { data: devisRow } = await supabase
        .from("devis")
        .insert({
          nom, prenom, telephone, email,
          depart: departure, arrivee: arrival,
          distance_km: distance,
          duree_estimee: estimateDuration(distance),
          type_vehicule: vehicleType || null,
          marque: marque || null,
          modele: modele || null,
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
        })
        .select()
        .single();

      // 2. Mirror into demandes_convoyage so it shows up in the existing admin
      await supabase.from("demandes_convoyage").insert({
        nom, prenom, telephone, email,
        depart: departure, arrivee: arrival,
        date_souhaitee: date || null,
        heure_souhaitee: heure,
        marque, modele, immatriculation: "",
        carburant: energy,
        options: [
          devisRow?.numero && `Devis: ${devisRow.numero}`,
          vehicleType && `Type: ${vehicleType}`,
          prestation && `Prestation: ${prestation}`,
          option && `Option: ${option}`,
          `Estimation: ${pricing.finalPrice}€`,
          `Distance: ${distance}km`,
          comment,
        ].filter(Boolean).join(" | "),
        message: comment,
      });

      // 2bis. Notification admin (feed temps réel) avec prix pré-rempli
      await notifyAdmin({
        type: "estimation",
        titre: `Nouvelle estimation ${devisRow?.numero ?? ""} — ${prenom} ${nom}`,
        message: `${departure} → ${arrival} · ${distance} km · ${pricing.finalPrice} €`,
        link: "/admin/devis",
        entityType: "devis",
        entityId: devisRow?.id,
        metadata: {
          email, telephone,
          prix: pricing.finalPrice,
          distance,
          option,
        },
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

      // 3. Send transactional email to client (best-effort)
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

  const selectClasses = "w-full bg-navy/60 border border-primary/20 rounded-xl px-4 py-3.5 text-cream text-sm focus:border-[#5fb6ff]/60 focus:outline-none focus:ring-2 focus:ring-[#5fb6ff]/20 transition-all appearance-none";
  const inputClasses = "w-full bg-navy/60 border border-primary/20 rounded-xl px-4 py-3.5 text-cream text-sm focus:border-[#5fb6ff]/60 focus:outline-none focus:ring-2 focus:ring-[#5fb6ff]/20 transition-all";

  // Prix HT / TVA / TTC dérivés du finalPrice
  const priceHT = pricing?.finalPrice ?? 0;
  const tva = Math.round(priceHT * 0.2);
  const priceTTC = priceHT + tva;
  const isComplete = !!(departure && arrival && vehicleType);

  return (
    <div className="py-6 md:py-8">
      <div className="max-w-6xl mx-auto px-2 md:px-4">
        <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden mb-8 group">
          <div aria-hidden className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-[#5fb6ff]/30 via-[#e7c76a]/10 to-[#5fb6ff]/20 opacity-60 blur-md transition-opacity duration-700 group-hover:opacity-90" />
          <div className="relative rounded-3xl bg-gradient-to-br from-[#0b1026]/95 via-[#0d1530]/95 to-black/95 backdrop-blur-xl border border-[#5fb6ff]/25 shadow-[0_30px_80px_-30px_rgba(95,182,255,0.45)] p-6 md:p-10">
            <div className="text-center mb-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#5fb6ff]/30 bg-[#5fb6ff]/5 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#5fb6ff]">
                <Sparkles size={11} /> Estimation instantanée
              </span>
              <h3 className="font-heading text-2xl md:text-3xl tracking-wide gold-gradient-text mt-4">
                ESTIMEZ VOTRE TRAJET
              </h3>
              <p className="text-cream/70 text-sm md:text-base mt-2 max-w-xl mx-auto">
                Obtenez un prix instantané, transparent et sans engagement.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mb-5">
              <div className="relative">
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-2">
                  <MapPin size={13} className="text-[#5fb6ff]" /> Départ
                </label>
                <div className="relative">
                  <input type="text" value={departure || depFilter}
                    onChange={(e) => { setDepFilter(e.target.value); setDeparture(""); setDepOpen(true); }}
                    onFocus={() => setDepOpen(true)}
                    placeholder="Adresse, ville ou code postal"
                    className={inputClasses} />
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5fb6ff]/60" />
                </div>
                {depOpen && depFilter && (
                  <div className="absolute z-30 w-full mt-1 bg-navy-light border border-[#5fb6ff]/25 rounded-xl max-h-48 overflow-y-auto shadow-2xl">
                    {filteredDepCities.map(city => (
                      <button key={city} type="button" className="w-full text-left px-4 py-2 text-sm text-cream/80 hover:bg-[#5fb6ff]/10 hover:text-[#5fb6ff] transition-colors"
                        onClick={() => { setDeparture(city); setDepFilter(""); setDepOpen(false); }}>{city}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-2">
                  <MapPinned size={13} className="text-[#5fb6ff]" /> Arrivée
                </label>
                <div className="relative">
                  <input type="text" value={arrival || arrFilter}
                    onChange={(e) => { setArrFilter(e.target.value); setArrival(""); setArrOpen(true); }}
                    onFocus={() => setArrOpen(true)}
                    placeholder="Adresse, ville ou code postal"
                    className={inputClasses} />
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5fb6ff]/60" />
                </div>
                {arrOpen && arrFilter && (
                  <div className="absolute z-30 w-full mt-1 bg-navy-light border border-[#5fb6ff]/25 rounded-xl max-h-48 overflow-y-auto shadow-2xl">
                    {filteredArrCities.map(city => (
                      <button key={city} type="button" className="w-full text-left px-4 py-2 text-sm text-cream/80 hover:bg-[#5fb6ff]/10 hover:text-[#5fb6ff] transition-colors"
                        onClick={() => { setArrival(city); setArrFilter(""); setArrOpen(false); }}>{city}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5 mb-6">
              <div>
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-2">
                  <Car size={13} className="text-[#5fb6ff]" /> Type de véhicule
                </label>
                <div className="relative">
                  <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={selectClasses}>
                    <option value="">Sélectionner</option>
                    {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5fb6ff]/60 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-2">
                  <Calendar size={13} className="text-[#5fb6ff]" /> Date souhaitée
                </label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClasses} />
              </div>
              <div>
                <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-cream/55 mb-2">
                  <Clock size={13} className="text-[#5fb6ff]" /> Heure souhaitée
                </label>
                <input type="time" value={heure} onChange={e => setHeure(e.target.value)} className={inputClasses} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 justify-center">
              {[
                { value: "aller-simple", label: "Aller simple" },
                { value: "aller-retour", label: "Aller-retour" },
                { value: "express", label: "Express (+20%)" },
              ].map(o => (
                <button key={o.value} type="button" onClick={() => setOption(o.value)}
                  className={`px-4 py-2 rounded-full text-[11px] uppercase tracking-[0.18em] font-heading transition-all duration-300 ${
                    option === o.value
                      ? "bg-gradient-to-r from-[#5fb6ff] to-[#3b82f6] text-white shadow-[0_0_20px_-4px_rgba(95,182,255,0.7)]"
                      : "border border-[#5fb6ff]/25 text-cream/60 hover:text-[#5fb6ff] hover:border-[#5fb6ff]/50"
                  }`}>{o.label}</button>
              ))}
            </div>

            {/* Bloc Prix en live */}
            <div className="relative rounded-2xl border border-[#5fb6ff]/20 bg-gradient-to-br from-[#0b1026]/80 to-black/60 p-6 md:p-7 mb-6 overflow-hidden">
              <div aria-hidden className="absolute -top-1/2 -right-1/2 w-[140%] h-[140%] bg-[radial-gradient(circle_at_center,rgba(95,182,255,0.12),transparent_60%)]" />
              <div className="relative">
                {!isComplete && (
                  <p className="text-cream/60 text-sm text-center py-4">Complétez votre trajet pour voir le prix</p>
                )}
                {isComplete && distance !== null && distance > 0 && pricing && (
                  <div className="animate-fade-in">
                    <div className="flex items-end justify-between flex-wrap gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-cream/50 mb-1">Prix estimé HT</p>
                        <div className="flex items-baseline gap-2">
                          <span className="font-heading text-5xl md:text-6xl gold-gradient-text leading-none">{priceHT}</span>
                          <span className="font-heading text-2xl text-[#e7c76a]">€</span>
                          <span className="text-cream/50 text-xs ml-1">HT</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-right">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Distance</p>
                          <p className="font-heading text-lg text-cream">{distance} km</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-cream/45">Durée</p>
                          <p className="font-heading text-lg text-cream">{estimateDuration(distance)}</p>
                        </div>
                      </div>
                    </div>
                    <details className="mt-5 group/det">
                      <summary className="cursor-pointer list-none inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#5fb6ff] hover:text-[#e7c76a] transition-colors">
                        <ChevronDown size={14} className="transition-transform group-open/det:rotate-180" />
                        Voir le détail du prix
                      </summary>
                      <div className="mt-4 pt-4 border-t border-[#5fb6ff]/15 text-sm space-y-2 animate-fade-in">
                        <div className="flex justify-between text-cream/75"><span>Prix de base ({pricing.label})</span><span>{pricing.price} €</span></div>
                        {pricing.hasExtra && (
                          <div className="flex justify-between text-cream/75"><span>{pricing.multiplierLabel}</span><span>+{priceHT - pricing.price} €</span></div>
                        )}
                        <div className="flex justify-between text-cream/60"><span>Péages, carburant, assurance, convoyeur pro</span><span>Inclus</span></div>
                        <div className="flex justify-between text-cream/60 pt-2 border-t border-[#5fb6ff]/10"><span>TVA 20%</span><span>{tva} €</span></div>
                        <div className="flex justify-between font-heading text-cream pt-2 border-t border-[#5fb6ff]/10"><span>Total TTC</span><span className="text-[#e7c76a]">{priceTTC} €</span></div>
                      </div>
                    </details>
                  </div>
                )}
                {isComplete && distance === 0 && (
                  <p className="text-cream/70 text-sm text-center py-4">Les villes de départ et d'arrivée sont identiques.</p>
                )}
                {isComplete && distance === null && (
                  <p className="text-cream/70 text-sm text-center py-4">Nous allons vérifier manuellement votre trajet.</p>
                )}
              </div>
            </div>

            {!showForm && (
              <div className="text-center">
                <button onClick={() => setShowForm(true)} disabled={!isComplete}
                  className="inline-flex items-center gap-3 px-10 py-4 rounded-full bg-gradient-to-r from-[#e7c76a] to-[#d4af37] text-[#0b1026] font-heading text-sm tracking-[0.2em] uppercase shadow-[0_10px_40px_-10px_rgba(231,199,106,0.6)] hover:shadow-[0_14px_50px_-10px_rgba(231,199,106,0.8)] hover:scale-[1.02] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                  <Send size={15} /> OBTENIR MON PRIX
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto mb-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.15em] text-cream/55">
          <span className="inline-flex items-center gap-1.5"><Shield size={12} className="text-[#5fb6ff]" /> Assurance incluse</span>
          <span className="inline-flex items-center gap-1.5"><RouteIcon size={12} className="text-[#5fb6ff]" /> Péages inclus</span>
          <span className="inline-flex items-center gap-1.5"><Fuel size={12} className="text-[#5fb6ff]" /> Carburant inclus</span>
          <span className="inline-flex items-center gap-1.5"><User size={12} className="text-[#5fb6ff]" /> Convoyeur professionnel</span>
          <span className="inline-flex items-center gap-1.5"><Wallet size={12} className="text-[#5fb6ff]" /> Suivi temps réel</span>
        </div>

        {/* Full Quote Form */}
        {showForm && !submitted && (
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto card-premium p-8 md:p-10 rounded gold-border-strong">
            <h3 className="font-heading text-xl text-primary tracking-[0.15em] uppercase text-center mb-8">
              Demande de devis
            </h3>

            {/* Contact info */}
            <p className="text-xs uppercase tracking-wider text-primary/80 font-heading mb-3">Vos coordonnées</p>
            <div className="grid md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50 mb-2">
                  <User size={14} className="text-primary" /> Nom *
                </label>
                <input type="text" value={nom} onChange={e => setNom(e.target.value)} className={inputClasses} required />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50 mb-2">
                  <User size={14} className="text-primary" /> Prénom *
                </label>
                <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} className={inputClasses} required />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50 mb-2">
                  <Phone size={14} className="text-primary" /> Téléphone *
                </label>
                <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} className={inputClasses} required />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50 mb-2">
                  <Mail size={14} className="text-primary" /> Email *
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClasses} required />
              </div>
            </div>

            {/* Vehicle info */}
            <p className="text-xs uppercase tracking-wider text-primary/80 font-heading mb-3">Véhicule & prestation</p>
            <div className="grid md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50 mb-2">
                  <Car size={14} className="text-primary" /> Type de véhicule
                </label>
                <div className="relative">
                  <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={selectClasses}>
                    <option value="">Sélectionner</option>
                    {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50 mb-2">
                  <Fuel size={14} className="text-primary" /> Énergie
                </label>
                <div className="relative">
                  <select value={energy} onChange={e => setEnergy(e.target.value)} className={selectClasses}>
                    <option value="">Sélectionner</option>
                    {ENERGY_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-cream/50 mb-2 block">Marque</label>
                <input type="text" value={marque} onChange={e => setMarque(e.target.value)} placeholder="Ex: Peugeot" className={inputClasses} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-cream/50 mb-2 block">Modèle</label>
                <input type="text" value={modele} onChange={e => setModele(e.target.value)} placeholder="Ex: 308" className={inputClasses} />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="text-xs uppercase tracking-wider text-cream/50 mb-2 block">Prestation</label>
                <div className="relative">
                  <select value={prestation} onChange={e => setPrestation(e.target.value)} className={selectClasses}>
                    <option value="">Sélectionner</option>
                    {PRESTATION_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50 mb-2">
                    <Calendar size={14} className="text-primary" /> Date
                  </label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClasses} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-cream/50 mb-2 block">Heure</label>
                  <input type="time" value={heure} onChange={e => setHeure(e.target.value)} className={inputClasses} />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="text-xs uppercase tracking-wider text-cream/50 mb-2 block">Commentaire</label>
              <textarea
                value={comment} onChange={e => setComment(e.target.value)}
                rows={3} placeholder="Informations complémentaires..."
                className={`${inputClasses} resize-none`}
              />
            </div>

            {pricing && (
              <div className="card-premium p-5 rounded mb-6 text-center gold-border">
                <p className="text-cream/60 text-sm mb-1">Estimation pour ce trajet</p>
                <p className="text-3xl font-heading gold-gradient-text">{pricing.finalPrice} €</p>
                <p className="text-cream/50 text-xs mt-1">{distance} km — {pricing.label}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors duration-300 disabled:opacity-60"
            >
              {sending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Envoyer ma demande de devis
                </>
              )}
            </button>
          </form>
        )}

        {submitted && (
          <div className="max-w-3xl mx-auto card-premium p-10 rounded gold-border-strong text-center">
            <div className="w-16 h-16 rounded-full gold-border flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="text-primary" size={32} />
            </div>
            <h3 className="font-heading text-xl text-primary tracking-[0.15em] uppercase mb-3">
              Devis envoyé
            </h3>
            {savedDevis && (
              <p className="text-primary/80 text-xs tracking-wider uppercase mb-2">N° {savedDevis.numero}</p>
            )}
            <p className="text-cream/70 text-sm leading-relaxed max-w-md mx-auto">
              Merci pour votre demande. Un récapitulatif vient de vous être envoyé par email
              et notre équipe vous recontactera dans les plus brefs délais.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {savedDevis && (
                <button
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-heading text-xs tracking-[0.15em] uppercase hover:bg-gold-light transition-colors"
                >
                  <Download size={14} /> Télécharger le PDF
                </button>
              )}
              <button
                onClick={() => { setSubmitted(false); setShowForm(false); setSavedDevis(null); setNom(""); setPrenom(""); setTelephone(""); setEmail(""); setComment(""); }}
                className="px-6 py-2 gold-border text-primary font-heading text-xs tracking-[0.15em] uppercase hover:bg-primary/10 transition-colors"
              >
                Nouvelle estimation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
