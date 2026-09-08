/**
 * Conventions de stockage centralisées.
 *
 * Chaque bucket a un rôle unique et une convention de chemin stricte :
 * le premier segment identifie TOUJOURS le propriétaire (utilisateur ou
 * organisation), ce qui est exactement ce que vérifient les policies RLS
 * de `storage.objects`. Passer par ces helpers évite qu'un chemin
 * non conforme (ou un mauvais bucket) ne rende un document accessible
 * à un autre client.
 */

/** Documents véhicule sensibles (carte grise, VIN…) — bucket PRIVÉ. */
export const BUCKET_CARTES_GRISES = "cartes-grises";
/** Logos de sociétés clientes / profils pro — bucket PUBLIC (affiché sur devis & factures). */
export const BUCKET_COMPANY_LOGOS = "company-logos";
/** Logos d'organisations flotte — bucket PRIVÉ (URL signée). */
export const BUCKET_ORGANIZATION_LOGOS = "organization-logos";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertOwner(ownerId: string, label: string): string {
  const id = (ownerId || "").trim();
  if (!UUID_RE.test(id)) {
    throw new Error(`Chemin de stockage refusé : ${label} invalide`);
  }
  return id;
}

/** Nettoie un segment libre : pas de "/", pas de "..", caractères sûrs uniquement. */
export function safeSegment(value: string, fallback = "document"): string {
  const cleaned = (value || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
  return cleaned.replace(/^-|-$/g, "") || fallback;
}

/**
 * Chemin d'une carte grise rattachée à un devis :
 * `{user_id}/{devis_id}/carte-grise-<recto|verso>-<ts>.jpg`
 */
export function carteGriseDevisPath(userId: string, devisId: string, kind: "recto" | "verso"): string {
  const uid = assertOwner(userId, "identifiant utilisateur");
  const did = assertOwner(devisId, "identifiant de devis");
  return `${uid}/${did}/carte-grise-${kind}-${Date.now()}.jpg`;
}

/**
 * Chemin d'un document véhicule personnel du client :
 * `{user_id}/mes-documents/<nom>-<ts>.<ext>`
 */
export function clientVehicleDocPath(userId: string, fileName: string, ext: string): string {
  const uid = assertOwner(userId, "identifiant utilisateur");
  const safeExt = safeSegment(`x.${ext}`.split(".").pop() ?? "bin", "bin").toLowerCase();
  return `${uid}/mes-documents/${safeSegment(fileName)}-${Date.now()}.${safeExt}`;
}

/** Chemin d'un logo de société cliente (bucket public). */
export function companyLogoPath(ownerUserId: string, ext: string): string {
  const uid = assertOwner(ownerUserId, "identifiant utilisateur");
  return `${uid}/logo-${Date.now()}.${safeSegment(ext, "png").toLowerCase()}`;
}

/** Chemin d'un logo d'organisation flotte (bucket privé). */
export function organizationLogoPath(organizationId: string, ext: string): string {
  const oid = assertOwner(organizationId, "identifiant d'organisation");
  return `${oid}/logo-${Date.now()}.${safeSegment(ext, "png").toLowerCase()}`;
}
