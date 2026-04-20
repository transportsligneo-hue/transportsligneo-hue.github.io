import { useState, useMemo } from "react";
import {
  MapPin,
  Navigation,
  Clock,
  Euro,
  Car,
  Fuel,
  Calendar,
  ChevronDown,
  ChevronRight,
  Send,
  Loader2,
  CheckCircle,
  User,
  Phone,
  Mail,
  Download,
  ArrowLeft,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateDevisPdf, downloadDevisPdf, type DevisData } from "@/lib/devis-pdf";
import { sendTransactionalEmail } from "@/lib/email/send";

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

function getDistance(from: string, to: string): number | null {
  if (from === to) return 0;
  if (CITY_DISTANCES[from]?.[to]) return CITY_DISTANCES[from][to];
  if (CITY_DISTANCES[to]?.[from]) return CITY_DISTANCES[to][from];
  const dFromTours = CITY_DISTANCES["Tours"]?.[from] ?? CITY_DISTANCES[from]?.["Tours"];
  const dToTours = CITY_DISTANCES["Tours"]?.[to] ?? CITY_DISTANCES[to]?.["Tours"];
  if (dFromTours != null && dToTours != null) return Math.round((dFromTours + dToTours) * 0.85);
  return null;
}

function calculatePrice(distance: number, departure: string, arrival: string, option: string) {
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
 * Estimateur dédié mobile — UX premium type app native.
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
  const [date, setDate] = useState("");
  const [heure, setHeure] = useState("");
  const [comment, setComment] = useState("");
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

  const distance = useMemo(() => {
    if (!departure || !arrival) return null;
    return getDistance(departure, arrival);
  }, [departure, arrival]);

  const pricing = useMemo(() => {
    if (distance === null || distance === 0) return null;
    return calculatePrice(distance, departure, arrival, option);
  }, [distance, arrival, option]);

  const filteredCities = CITIES.filter(c =>
    c.toLowerCase().includes(pickerFilter.toLowerCase())
  );

  const openPicker = (type: "dep" | "arr") => {
    setPickerType(type);
    setPickerFilter("");
  };

  const selectCity = (city: string) => {
    if (pickerType === "dep") setDeparture(city);
    if (pickerType === "arr") setArrival(city);
    setPickerType(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pricing || distance == null) return;
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

  const inputCls = "w-full bg-navy/60 border border-primary/20 rounded-xl px-4 py-3.5 text-cream text-base focus:border-primary/60 focus:outline-none transition-colors";
  const labelCls = "block text-[11px] uppercase tracking-[0.15em] text-cream/55 mb-1.5 font-heading";

  return (
    <section className="md:hidden section-bg pt-2 pb-8">
      <div className="px-5">
        {/* Titre */}
        <div className="text-center mb-6">
          <p className="font-heading text-primary/70 text-[11px] tracking-[0.3em] uppercase mb-1">
            Estimation
          </p>
          <h2 className="font-heading text-primary text-2xl tracking-[0.05em]">
            Estimez votre trajet
          </h2>
          <p className="text-cream/55 text-xs mt-2">Péages & carburant inclus</p>
        </div>

        {/* Carte trajet */}
        {!showForm && !submitted && (
          <div className="mobile-card p-5 mb-4">
            <p className={labelCls}>Trajet</p>

            {/* Picker départ */}
            <button
              type="button"
              onClick={() => openPicker("dep")}
              className="w-full flex items-center gap-3 py-3.5 px-4 bg-navy/40 border border-primary/20 rounded-xl tap-scale active:bg-navy/60 transition-colors mb-2"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-cream/45">Départ</p>
                <p className={`text-sm truncate ${departure ? "text-cream" : "text-cream/40"}`}>
                  {departure || "Choisir une ville"}
                </p>
              </div>
              <ChevronRight size={16} className="text-primary/60 shrink-0" />
            </button>

            {/* Picker arrivée */}
            <button
              type="button"
              onClick={() => openPicker("arr")}
              className="w-full flex items-center gap-3 py-3.5 px-4 bg-navy/40 border border-primary/20 rounded-xl tap-scale active:bg-navy/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Navigation size={16} className="text-primary" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-cream/45">Arrivée</p>
                <p className={`text-sm truncate ${arrival ? "text-cream" : "text-cream/40"}`}>
                  {arrival || "Choisir une ville"}
                </p>
              </div>
              <ChevronRight size={16} className="text-primary/60 shrink-0" />
            </button>

            {/* Type trajet — segmented control */}
            <div className="mt-4">
              <p className={labelCls}>Type de trajet</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "aller-simple", label: "Simple" },
                  { value: "aller-retour", label: "A/R" },
                  { value: "express", label: "Express" },
                ].map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOption(o.value)}
                    className={`py-2.5 rounded-lg text-xs font-heading tracking-wide uppercase transition-all ${
                      option === o.value
                        ? "bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_rgba(212,175,55,0.5)]"
                        : "bg-navy/40 border border-primary/20 text-cream/65"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Résultat */}
        {!showForm && !submitted && distance !== null && distance > 0 && pricing && (
          <div className="mobile-card p-5 mb-4 gold-border-strong">
            <div className="text-center mb-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cream/55 mb-1">
                Estimation
              </p>
              <p className="font-heading gold-gradient-text text-5xl leading-none">
                {pricing.finalPrice}<span className="text-2xl ml-1">€</span>
              </p>
              {pricing.hasExtra && (
                <p className="font-heading text-primary/80 text-[11px] mt-2 tracking-wider uppercase">
                  {pricing.multiplierLabel}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-navy/40 rounded-lg p-3 text-center">
                <Navigation size={14} className="text-primary mx-auto mb-1" />
                <p className="text-cream font-heading text-sm">{distance} km</p>
                <p className="text-cream/45 text-[10px] mt-0.5">Distance</p>
              </div>
              <div className="bg-navy/40 rounded-lg p-3 text-center">
                <Clock size={14} className="text-primary mx-auto mb-1" />
                <p className="text-cream font-heading text-sm">{estimateDuration(distance)}</p>
                <p className="text-cream/45 text-[10px] mt-0.5">Durée</p>
              </div>
            </div>
            <p className="text-center text-primary/60 text-[10px] mt-3 tracking-wider uppercase">
              Péages & carburant inclus
            </p>

            <button
              onClick={() => setShowForm(true)}
              className="mt-5 w-full h-13 py-4 rounded-xl bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase tap-scale flex items-center justify-center gap-2"
            >
              Demander un devis
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {distance === 0 && departure && arrival && !showForm && !submitted && (
          <div className="mobile-card p-4 text-center">
            <p className="text-cream/60 text-sm">Les villes sont identiques.</p>
          </div>
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
              <div className="mobile-card p-4 gold-border">
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
            <div className="mobile-card p-5 space-y-4">
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
            <div className="mobile-card p-5 space-y-4">
              <p className="font-heading text-primary/80 text-[11px] tracking-[0.2em] uppercase">
                Véhicule
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}><Car size={11} className="inline mr-1" />Type</label>
                  <div className="relative">
                    <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
                      <option value="">—</option>
                      {VEHICLE_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className={labelCls}><Fuel size={11} className="inline mr-1" />Énergie</label>
                  <div className="relative">
                    <select value={energy} onChange={e => setEnergy(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
                      <option value="">—</option>
                      {ENERGY_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none" />
                  </div>
                </div>
              </div>
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
            </div>

            {/* Prestation & date */}
            <div className="mobile-card p-5 space-y-4">
              <p className="font-heading text-primary/80 text-[11px] tracking-[0.2em] uppercase">
                Prestation
              </p>
              <div>
                <label className={labelCls}>Type de prestation</label>
                <div className="relative">
                  <select value={prestation} onChange={e => setPrestation(e.target.value)} className={`${inputCls} appearance-none pr-9`}>
                    <option value="">—</option>
                    {PRESTATION_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}><Calendar size={11} className="inline mr-1" />Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Heure</label>
                  <input type="time" value={heure} onChange={e => setHeure(e.target.value)} className={inputCls} />
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
          <div className="mobile-card p-6 text-center gold-border-strong">
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

      {/* Bottom sheet — Sélecteur de villes */}
      {pickerType && (
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
              {filteredCities.length === 0 && (
                <p className="text-center text-cream/50 text-sm py-8">Aucune ville trouvée</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
