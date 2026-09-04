/**
 * Option « véhicule lourd » sur les transports plateau.
 *
 * Un véhicule de plus de 1,1 tonne impose un porte-voiture plus puissant :
 * consommation et carburant supérieurs, d'où une majoration forfaitaire.
 * Ce module centralise le seuil, le montant et l'écriture/lecture des lignes
 * correspondantes dans le récapitulatif `message` d'un devis.
 */

/** Seuil de déclenchement de la majoration (en kg). */
export const HEAVY_THRESHOLD_KG = 1100

/** Majoration forfaitaire TTC pour un véhicule de plus de 1,1 t sur plateau. */
export const HEAVY_SURCHARGE = 200

/** Libellé affiché partout (formulaires, PDF, récapitulatifs). */
export const HEAVY_LABEL = 'Véhicule de plus de 1,1 t (majoration carburant)'

/** Libellé court pour les cases à cocher. */
export const HEAVY_CHECKBOX_LABEL = `Véhicule de plus de 1,1 t (+${HEAVY_SURCHARGE} €)`

const FLAG_RE = /^\s*V[ée]hicule de plus de 1[,.]1\s*t\s*:/i
const POIDS_RE = /^\s*Poids v[ée]hicule\s*:\s*([\d\s.,]+)\s*kg/i
const SUPP_RE = /^\s*Suppl[ée]ment\s*:\s*V[ée]hicule de plus de 1[,.]1\s*t/i

/** Relit l'option « véhicule lourd » et le poids depuis le récapitulatif. */
export function parsePlateauPoids(message?: string | null): { lourd: boolean; poidsKg: number | null } {
  const out = { lourd: false, poidsKg: null as number | null }
  if (!message) return out
  for (const raw of message.split('\n')) {
    if (FLAG_RE.test(raw)) out.lourd = /oui/i.test(raw)
    const m = raw.match(POIDS_RE)
    if (m) {
      const n = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'))
      if (Number.isFinite(n)) out.poidsKg = n
    }
  }
  if (out.poidsKg != null && out.poidsKg > HEAVY_THRESHOLD_KG) out.lourd = true
  return out
}

/**
 * Réécrit les lignes « véhicule lourd » dans le récapitulatif message :
 * l'indicateur, le poids et la ligne de supplément facturé.
 */
export function applyPlateauPoidsToMessage(
  message: string,
  opts: { plateau: boolean; lourd: boolean; poidsKg?: number | null; surcharge?: number | null },
): string {
  const montant =
    opts.surcharge != null && Number.isFinite(opts.surcharge) && opts.surcharge > 0
      ? opts.surcharge
      : HEAVY_SURCHARGE
  const lines = message
    .split('\n')
    .filter((l) => !FLAG_RE.test(l) && !POIDS_RE.test(l) && !SUPP_RE.test(l))
  if (opts.plateau) {
    if (opts.poidsKg != null && Number.isFinite(opts.poidsKg)) {
      lines.push(`Poids véhicule : ${Math.round(opts.poidsKg)} kg`)
    }
    lines.push(`Véhicule de plus de 1,1 t : ${opts.lourd ? 'oui' : 'non'}`)
    if (opts.lourd) lines.push(`Supplément : ${HEAVY_LABEL} = ${montant} €`)
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
