/**
 * Logo saisonnier Transports Ligneo.
 *
 * Pendant le mois d'octobre uniquement (jusqu'au 1er novembre),
 * le logo carré passe en version « Octobre rose » (ruban rose).
 * Il revient automatiquement au logo officiel le 1er novembre,
 * sans intervention. Les documents officiels (PDF) et les e-mails
 * gardent le logo officiel.
 */
import logoNormal from "@/assets/logo-transports-ligneo-officiel.png";
import octAsset from "@/assets/logo-octobre-rose.png.asset.json";

/** Octobre (mois 9) = saison Octobre rose, jusqu'au 1er novembre. */
export function isOctoberRoseSeason(): boolean {
  return new Date().getUTCMonth() === 9;
}

/** Logo carré affiché selon la saison : Octobre rose en octobre, sinon officiel. */
export function logoLigneoSeasonal(): string {
  return isOctoberRoseSeason() ? octAsset.url : logoNormal;
}
