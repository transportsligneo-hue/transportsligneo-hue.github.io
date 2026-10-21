import { geocodeAddress, type GeoPoint } from "@/lib/geocode";

export type RetourKey =
  | "moovit" | "rome2rio" | "sncf" | "trainline" | "flixbus"
  | "blablacar" | "uber" | "bolt" | "gmaps" | "waze";

export interface RetourApp {
  key: RetourKey;
  nom: string;
  sous: string;
  groupe: "Transports en commun" | "Taxi / VTC" | "Navigation";
  /** Fond du logo (les logos fournis sont posés sur leur couleur de marque). */
  fond: string;
}

export const RETOUR_APPS: RetourApp[] = [
  { key: "moovit", nom: "Moovit", sous: "Bus, métro, tram", groupe: "Transports en commun", fond: "#ffffff" },
  { key: "rome2rio", nom: "Rome2rio", sous: "Tous les modes de transport", groupe: "Transports en commun", fond: "#ffffff" },
  { key: "sncf", nom: "SNCF Connect", sous: "Trains et TER", groupe: "Transports en commun", fond: "#0c131f" },
  { key: "trainline", nom: "Trainline", sous: "Billets train et bus", groupe: "Transports en commun", fond: "#00a88f" },
  { key: "flixbus", nom: "FlixBus", sous: "Autocars longue distance", groupe: "Transports en commun", fond: "#73d700" },
  { key: "blablacar", nom: "BlaBlaCar", sous: "Covoiturage", groupe: "Transports en commun", fond: "#ffffff" },
  { key: "uber", nom: "Uber", sous: "Voiture avec chauffeur", groupe: "Taxi / VTC", fond: "#000000" },
  { key: "bolt", nom: "Bolt", sous: "Voiture avec chauffeur", groupe: "Taxi / VTC", fond: "#ffffff" },
  { key: "gmaps", nom: "Google Maps", sous: "Itinéraire transports", groupe: "Navigation", fond: "#ffffff" },
  { key: "waze", nom: "Waze", sous: "Trajet en voiture", groupe: "Navigation", fond: "#35ccff" },
];

export interface RetourLink {
  /** Lien d'application (ouvert d'abord sur mobile), avec repli sur `web`. */
  app?: string;
  web: string;
  /** Vrai si l'application ne sait pas recevoir le trajet par lien : on copie « départ → arrivée ». */
  copier?: boolean;
}

const e = encodeURIComponent;
const ville = (a: string) => a.split(",").slice(-1)[0].replace(/\d{5}/, "").trim() || a;

export function buildRetourLink(key: RetourKey, from: string, to: string, f: GeoPoint | null, t: GeoPoint | null): RetourLink {
  switch (key) {
    case "moovit": {
      const web = "https://moovitapp.com/";
      if (!f || !t) return { web, copier: true };
      return {
        app: `moovit://directions?dest_lat=${t.lat}&dest_lon=${t.lng}&dest_name=${e(to)}&orig_lat=${f.lat}&orig_lon=${f.lng}&orig_name=${e(from)}&auto_run=true`,
        web,
        copier: true,
      };
    }
    case "rome2rio":
      return { web: `https://www.rome2rio.com/s/${e(ville(from))}/${e(ville(to))}` };
    case "sncf":
      return { web: `https://www.sncf-connect.com/app/home/search?origin=${e(ville(from))}&destination=${e(ville(to))}`, copier: true };
    case "trainline":
      return { web: "https://www.thetrainline.com/fr", copier: true };
    case "flixbus":
      return { web: `https://shop.flixbus.fr/search?departureCity=${e(ville(from))}&arrivalCity=${e(ville(to))}`, copier: true };
    case "blablacar":
      return { web: `https://www.blablacar.fr/search?fn=${e(ville(from))}&tn=${e(ville(to))}`, copier: true };
    case "uber": {
      const q = new URLSearchParams({ action: "setPickup" });
      q.set("pickup[formatted_address]", from);
      q.set("dropoff[formatted_address]", to);
      if (f) { q.set("pickup[latitude]", String(f.lat)); q.set("pickup[longitude]", String(f.lng)); }
      if (t) { q.set("dropoff[latitude]", String(t.lat)); q.set("dropoff[longitude]", String(t.lng)); }
      return { web: `https://m.uber.com/ul/?${q.toString()}` };
    }
    case "bolt":
      return { web: "https://bolt.eu/fr-fr/", copier: true };
    case "gmaps":
      return { web: `https://www.google.com/maps/dir/?api=1&origin=${e(from)}&destination=${e(to)}&travelmode=transit` };
    case "waze":
      return { web: `https://waze.com/ul?q=${e(to)}&navigate=yes` };
  }
}

/** Bornes de recharge autour de l'adresse de livraison (Google Maps). */
export function buildRechargeLink(adresse: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${e(`bornes de recharge près de ${adresse}`)}`;
}

export async function resolveRetourPoints(from: string, to: string) {
  const [f, t] = await Promise.all([geocodeAddress(from).catch(() => null), geocodeAddress(to).catch(() => null)]);
  return { f, t };
}
