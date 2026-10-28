/**
 * Vérification d'un SIRET via l'API officielle « Recherche d'entreprises »
 * (data.gouv, gratuite, sans clé). Ne bloque jamais en cas de panne de l'API.
 */
import { createServerFn } from "@tanstack/react-start";

export type SiretCheck =
  | { status: "ok"; siret: string; nom: string; adresse: string; actif: boolean; formeJuridique?: string | null }
  | { status: "invalide" }          // format ou clé de contrôle incorrects
  | { status: "inconnu" }           // introuvable dans la base officielle
  | { status: "indisponible" };     // API injoignable : on ne bloque pas

function luhn(num: string): boolean {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = Number(num[num.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export const siretVerify = createServerFn({ method: "POST" })
  .inputValidator((d: { siret: string }) => ({ siret: String(d?.siret ?? "").replace(/\D/g, "").slice(0, 14) }))
  .handler(async ({ data }): Promise<SiretCheck> => {
    const siret = data.siret;
    if (siret.length !== 14) return { status: "invalide" };
    // La Poste (SIREN 356000000) a des SIRET qui ne passent pas Luhn : exception officielle
    if (!luhn(siret) && !siret.startsWith("356000000")) return { status: "invalide" };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=3`, {
        headers: { accept: "application/json" }, signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) return { status: "indisponible" };
      const json = (await res.json()) as any;
      for (const r of json?.results ?? []) {
        const all = [r.siege, ...(r.matching_etablissements ?? [])].filter(Boolean);
        const e = all.find((x: any) => String(x.siret) === siret);
        if (!e) continue;
        const unitActive = (r.etat_administratif ?? "A") === "A";
        const etabActive = (e.etat_administratif ?? "A") === "A";
        return {
          status: "ok", siret,
          nom: String(r.nom_complet ?? r.nom_raison_sociale ?? ""),
          adresse: String(e.adresse ?? e.geo_adresse ?? ""),
          actif: unitActive && etabActive,
          formeJuridique: r.nature_juridique ?? null,
        };
      }
      return { status: "inconnu" };
    } catch {
      return { status: "indisponible" };
    }
  });
