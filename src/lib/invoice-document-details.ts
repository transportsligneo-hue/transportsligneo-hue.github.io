type DocumentSource = Record<string, unknown>;

export interface InvoiceVehicle {
  marque: string | null;
  modele: string | null;
  immatriculation: string | null;
  vin: string | null;
}

const text = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
const record = (v: unknown): DocumentSource => v && typeof v === "object" && !Array.isArray(v) ? v as DocumentSource : {};

export function invoiceSourceOptions(source: DocumentSource): string[] | null {
  if (Array.isArray(source.options)) return source.options.filter((v): v is string => typeof v === "string");
  if (source.options_meta && typeof source.options_meta === "object") {
    return Object.entries(record(source.options_meta)).filter(([, value]) => value === true).map(([key]) => key);
  }
  return null;
}

/** Explicit selection, including an empty array, always overrides legacy text. */
export function invoiceSelectedOptions(options?: string[] | null, message?: string | null): string[] {
  const selected = options ?? (message?.match(/^Options?\s*:\s*(.*)$/im)?.[1]?.split(",") ?? []);
  return [...new Set(selected.map((value) => {
    const normalized = value.trim().replace(/_/g, " ");
    if (/^recharge\s+(?:électrique|electrique|elec|livraison)(?:\s|$)/i.test(normalized)) return "Recharge électrique";
    if (/^mise\s+en\s+main(?:\s+du\s+v[ée]hicule)?$/i.test(normalized)) return "Mise en main";
    return normalized;
  }).filter(Boolean))];
}

/** Recover document vehicle data without guessing a plate from a model/name. */
export function invoiceVehicles(source: DocumentSource): InvoiceVehicle[] {
  const raw = Array.isArray(source.vehicules) && source.vehicules.length ? source.vehicules : [source];
  return raw.flatMap((value) => {
    const v = record(value);
    const delivered = {
      marque: text(v.vehicule_marque) ?? text(v.marque),
      modele: text(v.vehicule_modele) ?? text(v.modele),
      immatriculation: text(v.vehicule_immatriculation) ?? text(v.immatriculation),
      vin: text(v.vehicule_vin) ?? text(v.vin),
    };
    const returned = { marque: text(v.marque_retour), modele: text(v.modele_retour), immatriculation: text(v.immatriculation_retour), vin: text(v.vin_retour) };
    return [delivered, ...(returned.immatriculation ? [returned] : [])].filter((vehicle) => Object.values(vehicle).some(Boolean));
  });
}