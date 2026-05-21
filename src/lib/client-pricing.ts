/**
 * Resolver de tarifs personnalisés client (v2).
 * - Prix séparés par type de trajet : prix_aller_simple, prix_aller_retour, prix_express
 * - Fallback rétro-compat sur prix_ttc historique
 * - Suppléments par option (jsonb)
 */
import { supabase } from "@/integrations/supabase/client";

export type ResolverTripType = "aller" | "aller_retour" | "express";

export type OptionKey =
  | "recharge_electrique"
  | "plein_essence"
  | "nettoyage"
  | "express";

export interface ResolvedClientPrice {
  prix_ttc: number;
  prix_ht: number | null;
  ruleId: string;
  zone_label: string | null;
  ville_depart: string | null;
  ville_arrivee: string | null;
  supplements: Partial<Record<OptionKey, number>>;
}

interface RuleRow {
  id: string;
  client_user_id: string | null;
  client_email: string | null;
  ville_depart: string | null;
  ville_arrivee: string | null;
  zone_label: string | null;
  trip_type: "aller" | "aller_retour" | "any";
  prix_ttc: number;
  prix_ht: number | null;
  prix_aller_simple: number | null;
  prix_aller_retour: number | null;
  prix_express: number | null;
  supplements: Partial<Record<OptionKey, number>> | null;
  active: boolean;
  priority: number | null;
}

function cityMatch(needle: string | null, haystack: string | null | undefined): boolean {
  if (!needle) return false;
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Priority scoring (higher wins):
 *   P1 = 100 : ville_depart AND ville_arrivee both match (exact trajet)
 *   P2 =  50 : ville_depart OR ville_arrivee matches, or zone_label defined
 *   P3 =  10 : general client rule (no city/zone constraints)
 * Bonus +5 if trip_type is an exact match (not "any").
 * Bonus + rule.priority (admin override, default 0).
 */
function score(rule: RuleRow, depart: string, arrivee: string, tripType: ResolverTripType): number {
  const hasDep = !!rule.ville_depart;
  const hasArr = !!rule.ville_arrivee;
  const hasZone = !!rule.zone_label;
  const depOk = hasDep ? cityMatch(rule.ville_depart, depart) : true;
  const arrOk = hasArr ? cityMatch(rule.ville_arrivee, arrivee) : true;
  if (hasDep && !depOk) return -1;
  if (hasArr && !arrOk) return -1;

  let s: number;
  if (hasDep && hasArr) s = 100;
  else if (hasDep || hasArr || hasZone) s = 50;
  else s = 10;

  if (tripType !== "express" && rule.trip_type === tripType) s += 5;
  s += rule.priority ?? 0;
  return s;
}

function pickPriceForTrip(rule: RuleRow, tripType: ResolverTripType): number | null {
  if (tripType === "express" && rule.prix_express != null) return Number(rule.prix_express);
  if (tripType === "aller_retour" && rule.prix_aller_retour != null) return Number(rule.prix_aller_retour);
  if (tripType === "aller" && rule.prix_aller_simple != null) return Number(rule.prix_aller_simple);
  if (rule.prix_ttc != null && rule.prix_ttc > 0) return Number(rule.prix_ttc);
  return null;
}

export interface ResolveInput {
  userId?: string | null;
  email?: string | null;
  depart: string;
  arrivee: string;
  tripType: ResolverTripType;
}

export async function resolveClientPrice(
  input: ResolveInput,
): Promise<ResolvedClientPrice | null> {
  const { userId, email, depart, arrivee, tripType } = input;
  if (!userId && !email) return null;

  const filters: string[] = [];
  if (userId) filters.push(`client_user_id.eq.${userId}`);
  if (email) filters.push(`client_email.eq.${email.toLowerCase()}`);

  const { data } = await supabase
    .from("client_pricing_rules" as never)
    .select(
      "id,client_user_id,client_email,ville_depart,ville_arrivee,zone_label,trip_type,prix_ttc,prix_ht,prix_aller_simple,prix_aller_retour,prix_express,supplements,active,priority",
    )
    .or(filters.join(","))
    .eq("active", true);

  const rules = (data as unknown as RuleRow[] | null) ?? [];
  if (rules.length === 0) return null;

  const allowedTripType = tripType === "express" ? null : tripType;
  const matched = rules
    .filter((r) => allowedTripType == null || r.trip_type === "any" || r.trip_type === allowedTripType)
    .map((r) => ({ r, s: score(r, depart, arrivee, tripType), price: pickPriceForTrip(r, tripType) }))
    .filter((x) => x.s >= 0 && x.price != null && x.price > 0)
    .sort((a, b) => b.s - a.s);

  const best = matched[0];
  if (!best) return null;

  const ttc = best.price!;
  const supplements = (best.r.supplements ?? {}) as Partial<Record<OptionKey, number>>;

  return {
    prix_ttc: ttc,
    prix_ht: best.r.prix_ht != null ? Number(best.r.prix_ht) : null,
    ruleId: best.r.id,
    zone_label: best.r.zone_label,
    ville_depart: best.r.ville_depart,
    ville_arrivee: best.r.ville_arrivee,
    supplements,
  };
}


/** Calcule le supplément total à partir des options cochées et du barème. */
export function computeOptionSupplements(
  supplements: Partial<Record<OptionKey, number>>,
  optionsChecked: Partial<Record<OptionKey, boolean>>,
): { total: number; lines: { key: OptionKey; label: string; amount: number }[] } {
  const labels: Record<OptionKey, string> = {
    recharge_electrique: "Recharge électrique",
    plein_essence: "Plein d'essence",
    nettoyage: "Nettoyage véhicule",
    express: "Convoyage express",
  };
  const lines: { key: OptionKey; label: string; amount: number }[] = [];
  let total = 0;
  (Object.keys(labels) as OptionKey[]).forEach((k) => {
    if (optionsChecked[k] && supplements[k] != null && Number(supplements[k]) > 0) {
      const amount = Number(supplements[k]);
      total += amount;
      lines.push({ key: k, label: labels[k], amount });
    }
  });
  return { total: Math.round(total * 100) / 100, lines };
}
