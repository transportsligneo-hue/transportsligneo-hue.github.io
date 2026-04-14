import { useState, useMemo } from "react";
import { MapPin, Navigation, Clock, Euro, Car, Fuel, Calendar, ChevronDown } from "lucide-react";

// Pre-defined distances (km) from Tours to major French cities
const CITY_DISTANCES: Record<string, Record<string, number>> = {
  "Tours": { "Paris": 237, "Lyon": 477, "Marseille": 700, "Bordeaux": 350, "Nantes": 218, "Lille": 460, "Strasbourg": 620, "Toulouse": 530, "Nice": 840, "Montpellier": 640, "Rennes": 300, "Orléans": 117, "Poitiers": 100, "Limoges": 220, "Clermont-Ferrand": 335, "Angers": 110, "Le Mans": 82, "Blois": 60, "Chartres": 140, "Rouen": 310, "Caen": 320, "Dijon": 400, "Reims": 380, "Metz": 520, "Nancy": 500, "Brest": 530, "La Rochelle": 230, "Perpignan": 750, "Grenoble": 540, "Saint-Étienne": 430, "Amiens": 390, "Bourges": 155, "Châteauroux": 110, "Tours": 0 },
  "Paris": { "Lyon": 465, "Marseille": 775, "Bordeaux": 585, "Nantes": 385, "Lille": 225, "Strasbourg": 490, "Toulouse": 680, "Nice": 930, "Montpellier": 750, "Rennes": 350, "Orléans": 130, "Poitiers": 340, "Limoges": 395, "Clermont-Ferrand": 420, "Angers": 300, "Le Mans": 210, "Blois": 185, "Chartres": 90, "Rouen": 135, "Caen": 240, "Dijon": 310, "Reims": 145, "Metz": 330, "Nancy": 380, "Brest": 590, "La Rochelle": 470, "Perpignan": 850, "Grenoble": 570, "Saint-Étienne": 530, "Amiens": 150, "Bourges": 240, "Châteauroux": 260, "Paris": 0 },
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
  { value: "citadine", label: "Citadine" },
  { value: "berline", label: "Berline" },
  { value: "suv", label: "SUV" },
  { value: "utilitaire", label: "Utilitaire" },
  { value: "autre", label: "Autre" },
];

const ENERGY_TYPES = [
  { value: "diesel", label: "Diesel" },
  { value: "essence", label: "Essence" },
  { value: "electrique", label: "Électrique" },
  { value: "hybride", label: "Hybride" },
];

const PRESTATION_TYPES = [
  { value: "convoyage", label: "Convoyage" },
  { value: "livraison", label: "Livraison" },
  { value: "mise-a-disposition", label: "Mise à disposition" },
  { value: "autre", label: "Autre" },
];

function getDistance(from: string, to: string): number | null {
  if (from === to) return 0;
  if (CITY_DISTANCES[from]?.[to]) return CITY_DISTANCES[from][to];
  if (CITY_DISTANCES[to]?.[from]) return CITY_DISTANCES[to][from];
  // Estimate via Tours as hub
  const dFromTours = CITY_DISTANCES["Tours"]?.[from] ?? CITY_DISTANCES[from]?.["Tours"];
  const dToTours = CITY_DISTANCES["Tours"]?.[to] ?? CITY_DISTANCES[to]?.["Tours"];
  if (dFromTours != null && dToTours != null) {
    return Math.round((dFromTours + dToTours) * 0.85); // slight correction factor
  }
  return null;
}

function calculatePrice(distance: number, isLocal37: boolean): { price: number; rate: number; label: string } {
  if (isLocal37) {
    return { price: 79, rate: 0, label: "Forfait local Tours / Dept. 37" };
  }
  if (distance >= 200) {
    return { price: Math.round(distance * 0.85), rate: 0.85, label: "0,85 €/km (+ de 200 km)" };
  }
  return { price: Math.round(distance * 1), rate: 1, label: "1 €/km" };
}

function estimateDuration(distance: number): string {
  const hours = distance / 80; // average speed 80 km/h
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

  const [depFilter, setDepFilter] = useState("");
  const [arrFilter, setArrFilter] = useState("");
  const [depOpen, setDepOpen] = useState(false);
  const [arrOpen, setArrOpen] = useState(false);

  const isLocal37 = departure === "Tours" && arrival === "Tours";
  const distance = useMemo(() => {
    if (!departure || !arrival) return null;
    return getDistance(departure, arrival);
  }, [departure, arrival]);

  const pricing = useMemo(() => {
    if (distance === null || distance === 0) return null;
    const base = calculatePrice(distance, isLocal37);
    let finalPrice = base.price;
    let multiplierLabel = "";
    if (option === "aller-retour") {
      finalPrice = Math.round(base.price + base.price * 0.5);
      multiplierLabel = "Retour à -50%";
    } else if (option === "express") {
      finalPrice = Math.round(base.price * 1.20);
      multiplierLabel = "+20% express";
    }
    return {
      ...base,
      finalPrice,
      multiplierLabel,
      hasExtra: option !== "aller-simple",
    };
  }, [distance, isLocal37, option]);

  const filteredDepCities = CITIES.filter(c => c.toLowerCase().includes(depFilter.toLowerCase()));
  const filteredArrCities = CITIES.filter(c => c.toLowerCase().includes(arrFilter.toLowerCase()));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const selectClasses = "w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors appearance-none";
  const inputClasses = "w-full bg-navy/60 border border-primary/20 rounded px-4 py-3 text-cream text-sm focus:border-primary/60 focus:outline-none transition-colors";

  return (
    <section id="devis" className="py-24 section-bg">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="gold-divider-short mb-4" />
          <h2 className="font-heading text-3xl md:text-4xl tracking-[0.2em] uppercase text-primary">
            Estimez votre trajet
          </h2>
          <p className="text-cream/60 mt-4 max-w-lg mx-auto text-sm">
            Sélectionnez vos villes de départ et d'arrivée pour obtenir une estimation instantanée.
          </p>
          <div className="gold-divider-short mt-4" />
        </div>

        {/* Quick Estimator */}
        <div className="max-w-3xl mx-auto card-premium p-8 md:p-10 rounded gold-border-strong mb-8">
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Departure */}
            <div className="relative">
              <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50 mb-2">
                <MapPin size={14} className="text-primary" /> Ville de départ
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={departure || depFilter}
                  onChange={(e) => { setDepFilter(e.target.value); setDeparture(""); setDepOpen(true); }}
                  onFocus={() => setDepOpen(true)}
                  placeholder="Rechercher une ville..."
                  className={inputClasses}
                />
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50" />
              </div>
              {depOpen && depFilter && (
                <div className="absolute z-20 w-full mt-1 bg-navy-light border border-primary/20 rounded max-h-48 overflow-y-auto shadow-xl">
                  {filteredDepCities.map(city => (
                    <button
                      key={city}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-cream/80 hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => { setDeparture(city); setDepFilter(""); setDepOpen(false); }}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Arrival */}
            <div className="relative">
              <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50 mb-2">
                <Navigation size={14} className="text-primary" /> Ville d'arrivée
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={arrival || arrFilter}
                  onChange={(e) => { setArrFilter(e.target.value); setArrival(""); setArrOpen(true); }}
                  onFocus={() => setArrOpen(true)}
                  placeholder="Rechercher une ville..."
                  className={inputClasses}
                />
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50" />
              </div>
              {arrOpen && arrFilter && (
                <div className="absolute z-20 w-full mt-1 bg-navy-light border border-primary/20 rounded max-h-48 overflow-y-auto shadow-xl">
                  {filteredArrCities.map(city => (
                    <button
                      key={city}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-cream/80 hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => { setArrival(city); setArrFilter(""); setArrOpen(false); }}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Option selector */}
          <div className="flex flex-wrap gap-3 mb-8 justify-center">
            {[
              { value: "aller-simple", label: "Aller simple" },
              { value: "aller-retour", label: "Aller-retour (retour -50%)" },
              { value: "express", label: "Express (+20%)" },
            ].map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => setOption(o.value)}
                className={`px-5 py-2 rounded text-xs uppercase tracking-wider font-heading transition-all duration-300 ${
                  option === o.value
                    ? "bg-primary text-primary-foreground"
                    : "gold-border text-cream/60 hover:text-primary hover:border-primary/50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Result */}
          {distance !== null && distance > 0 && pricing && (
            <>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="card-premium p-5 rounded">
                  <Navigation size={20} className="text-primary mx-auto mb-2" />
                  <p className="text-2xl font-heading gold-gradient-text">{distance} km</p>
                  <p className="text-cream/50 text-xs mt-1">Distance estimée</p>
                </div>
                <div className="card-premium p-5 rounded">
                  <Clock size={20} className="text-primary mx-auto mb-2" />
                  <p className="text-2xl font-heading gold-gradient-text">{estimateDuration(distance)}</p>
                  <p className="text-cream/50 text-xs mt-1">Durée estimée</p>
                </div>
                <div className="card-premium p-5 rounded">
                  <Euro size={20} className="text-primary mx-auto mb-2" />
                  <p className="text-2xl font-heading gold-gradient-text">{pricing.finalPrice} €</p>
                  <p className="text-cream/50 text-xs mt-1">{pricing.label}</p>
                  {pricing.hasExtra && (
                    <p className="text-primary/70 text-xs mt-1">
                      {pricing.multiplierLabel}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-center text-primary/70 text-xs mt-4 font-heading tracking-wider uppercase">
                Péage et carburant inclus
              </p>
            </>
          )}

          {distance === 0 && departure && arrival && (
            <div className="text-center card-premium p-5 rounded">
              <p className="text-cream/60 text-sm">Les villes de départ et d'arrivée sont identiques.</p>
            </div>
          )}

          {distance !== null && distance > 0 && !showForm && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowForm(true)}
                className="px-8 py-3 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors duration-300"
              >
                Demander un devis détaillé
              </button>
            </div>
          )}
        </div>

        {/* Full Quote Form */}
        {showForm && !submitted && (
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto card-premium p-8 md:p-10 rounded gold-border-strong">
            <h3 className="font-heading text-xl text-primary tracking-[0.15em] uppercase text-center mb-8">
              Demande de devis
            </h3>

            <div className="grid md:grid-cols-2 gap-5 mb-6">
              <div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-wider text-cream/50 mb-2">
                  <Car size={14} className="text-primary" /> Type de véhicule
                </label>
                <div className="relative">
                  <select value={vehicleType} onChange={e => setVehicleType(e.target.value)} className={selectClasses} required>
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
                  <select value={energy} onChange={e => setEnergy(e.target.value)} className={selectClasses} required>
                    <option value="">Sélectionner</option>
                    {ENERGY_TYPES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/50 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mb-6">
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
                  <select value={prestation} onChange={e => setPrestation(e.target.value)} className={selectClasses} required>
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
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClasses} required />
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
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder="Informations complémentaires..."
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
              className="w-full px-8 py-4 bg-primary text-primary-foreground font-heading text-sm tracking-[0.15em] uppercase hover:bg-gold-light transition-colors duration-300"
            >
              Envoyer ma demande de devis
            </button>
          </form>
        )}

        {submitted && (
          <div className="max-w-3xl mx-auto card-premium p-10 rounded gold-border-strong text-center">
            <div className="w-16 h-16 rounded-full gold-border flex items-center justify-center mx-auto mb-6">
              <span className="text-primary text-2xl">✓</span>
            </div>
            <h3 className="font-heading text-xl text-primary tracking-[0.15em] uppercase mb-3">
              Demande envoyée
            </h3>
            <p className="text-cream/70 text-sm leading-relaxed max-w-md mx-auto">
              Merci pour votre demande de devis. Notre équipe vous recontactera dans les plus brefs délais.
            </p>
            <button
              onClick={() => { setSubmitted(false); setShowForm(false); }}
              className="mt-6 px-6 py-2 gold-border text-primary font-heading text-xs tracking-[0.15em] uppercase hover:bg-primary/10 transition-colors"
            >
              Nouvelle estimation
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
