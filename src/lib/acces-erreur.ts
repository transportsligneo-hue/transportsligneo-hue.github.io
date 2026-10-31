/** Message lisible pour un refus du verrou d'accès aux missions (contrat / dossier). */
export function messageErreurAcces(message: string | null | undefined): string {
  const m = String(message ?? "");
  const i = m.indexOf("ACCES_MISSIONS_BLOQUE:");
  return i >= 0 ? m.slice(i + "ACCES_MISSIONS_BLOQUE:".length).trim() : m;
}
