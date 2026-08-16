/**
 * Plateformes de PV de livraison digitalisés (partenaires externes).
 * Source unique utilisée par : demande de mission (client), admin, app convoyeur.
 */
import { useState } from "react";
import modelLogo from "@/assets/pv-model.webp.asset.json";
import welcomeAutoLogo from "@/assets/pv-welcomeauto.png.asset.json";

export type PvPlateforme = "model_arval" | "welcomeauto";
export type PvChoice = "aucun" | PvPlateforme;

export interface PvPlateformeDef {
  key: PvPlateforme;
  label: string;
  hint: string;
  /** Logo distant (fallback initiales si indisponible) */
  logo: string;
  /** Lien web par défaut */
  url: string | null;
  /** Schéma d'ouverture de l'application mobile (deep link) */
  appScheme?: string;
  storeIos?: string;
  storeAndroid?: string;
}

export const PV_PLATEFORMES: PvPlateformeDef[] = [
  {
    key: "model_arval",
    label: "Model",
    hint: "PV digitalisé Model (Arval) — s'ouvre dans l'application mobile.",
    logo: "https://logo.clearbit.com/modelsolutions.fr",
    url: null,
    appScheme: "model://",
    storeIos: "https://apps.apple.com/fr/search?term=model%20arval",
    storeAndroid: "https://play.google.com/store/search?q=model%20arval&c=apps",
  },
  {
    key: "welcomeauto",
    label: "Welcome Auto",
    hint: "PV digitalisé Welcome Auto — s'ouvre sur le site internet.",
    logo: "https://logo.clearbit.com/welcomeauto.fr",
    url: "https://www.welcomeauto.fr",
  },
];

export const pvDef = (key: string | null | undefined): PvPlateformeDef | undefined =>
  PV_PLATEFORMES.find((p) => p.key === key);

/** Petit logo carré avec repli sur les initiales. */
export function PvLogo({ def, size = 28 }: { def: PvPlateformeDef; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initials = def.label
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (broken) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-lg bg-primary/10 font-bold text-primary"
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        {initials}
      </span>
    );
  }
  return (
    <img
      src={def.logo}
      alt={`Logo ${def.label}`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className="rounded-lg bg-white object-contain ring-1 ring-black/5"
      style={{ width: size, height: size }}
    />
  );
}

const isMobileDevice = () =>
  typeof navigator !== "undefined" && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * Ouvre la plateforme : application mobile en priorité (deep link) sur téléphone,
 * lien web sinon. Repli automatique vers le store si l'app n'est pas installée.
 */
export function openPvPlateforme(def: PvPlateformeDef, url?: string | null) {
  const web = url || def.url;
  const scheme = def.appScheme;

  if (scheme && isMobileDevice()) {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const store = (isIos ? def.storeIos : def.storeAndroid) || web;
    const start = Date.now();
    const fallback = window.setTimeout(() => {
      if (Date.now() - start < 2200 && store) window.location.href = store;
    }, 1400);
    const clear = () => window.clearTimeout(fallback);
    document.addEventListener("visibilitychange", clear, { once: true });
    window.location.href = scheme;
    return;
  }

  if (web) window.open(web, "_blank", "noopener,noreferrer");
}
