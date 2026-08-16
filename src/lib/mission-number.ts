/**
 * Affichage normalisé d'un numéro de mission : le numéro d'origine stocké en base
 * (MIS-TLG-2026-075) est affiché avec un dièse devant la séquence → MIS-TLG-2026-#075.
 * Un éventuel suffixe de volet est affiché séparé par un tiret → MIS-TLG-2026-#075-L.
 */
export function displayNumero(numero: string): string {
  return numero.replace(/-#?(\d+)-?([ARL])?$/i, (_m, digits: string, suffix?: string) =>
    `-#${digits}${suffix ? `-${suffix.toUpperCase()}` : ""}`,
  );
}


/** Numéro mission MIS-TLG-YYYY-#XXX dérivé déterministe depuis created_at + id */
export function formatMissionNumber(id: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear();
  const hex = id.replace(/-/g, "").slice(-6);
  const num = (parseInt(hex, 16) % 999) + 1;
  return `MIS-TLG-${year}-#${String(num).padStart(3, "0")}`;
}

export function missionNumberOf(row: {
  id: string;
  created_at: string;
  numero_mission?: string | null;
}): string {
  return row.numero_mission ? displayNumero(row.numero_mission) : formatMissionNumber(row.id, row.created_at);
}


/**
 * Référence d'un trajet, suffixée A (livraison) / R (restitution)
 * pour les missions livraison + restitution. Les deux volets partagent
 * le même numéro de base (dérivé du mission_group_id).
 */
export function formatTrajetRef(opts: {
  id: string;
  createdAt: string;
  groupId?: string | null;
  isRoundTrip?: boolean;
  legType?: string | null;
  legIndex?: number | null;
}): string {
  const base = formatMissionNumber(opts.groupId ?? opts.id, opts.createdAt);
  if (!opts.isRoundTrip) return base;
  const isRetour = opts.legType === "retour" || opts.legIndex === 2;
  return `${base}${isRetour ? "R" : "L"}`;
}

/** Retire un éventuel suffixe A/R d'un numéro de mission (MIS-TLG-2026-082R → …-082) */
export function stripLegSuffix(numero: string): string {
  return numero.replace(/([-#]?\d+)[ARL]$/i, "$1");
}

/** true si le numéro porte un suffixe de volet (L = Livraison, R = Restitution) */
export function hasLegSuffix(numero: string | null | undefined): boolean {
  return !!numero && /[-#]?\d+[ARL]$/i.test(numero);
}

/** "#085" — séquence racine affichable d'un numéro de mission */
export function shortMissionSeq(numero: string): string {
  const m = stripLegSuffix(displayNumero(numero)).match(/#?(\d+)$/);
  return m ? `#${m[1]}` : stripLegSuffix(displayNumero(numero));
}

/**
 * Référence affichée : privilégie le vrai numéro de mission (attribution)
 * et applique le suffixe A / R pour les livraisons + restitutions.
 */
export function displayTrajetRef(opts: {
  id: string;
  createdAt: string;
  groupId?: string | null;
  isRoundTrip?: boolean;
  legType?: string | null;
  legIndex?: number | null;
  baseNumero?: string | null;
}): string {
  if (opts.baseNumero) {
    const base = displayNumero(stripLegSuffix(opts.baseNumero));
    if (!opts.isRoundTrip) return base;
    const isRetour = opts.legType === "retour" || opts.legIndex === 2;
    return `${base}${isRetour ? "R" : "L"}`;
  }

  return formatTrajetRef(opts);
}
