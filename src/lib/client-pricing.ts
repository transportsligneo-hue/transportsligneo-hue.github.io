/**
 * Resolver de tarifs personnalisés client.
 * S'appuie sur la table `client_pricing_rules` (déjà existante).
 *
 * Stratégie de matching :
 *   1) règles actives uniquement
 *   2) match par client_user_id OU client_email (case-insensitive)
 *   3) filtre ville_depart / ville_arrivee (NULL = wildcard)
 *   4) filtre trip_type ("any" = wildcard)
 *   5) priorité : plus spécifique (les deux villes nommées) > une seule ville > wildcard
 *      et trip_type explicite > "any"
 */
import { supabase } from "@/integrations/supabase/client";

export type ResolverTripType = "aller" | "aller_retour";

export interface ResolvedClientPrice {
  prix_ttc: number;
  prix_ht: number | null;
  ruleId: string;
  zone_label: string | null;
  ville_depart: string | null;
  ville_arrivee: string | null;
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
  active: boolean;
}

function cityIn(needle: string | null, haystack: string | null | undefined): boolean {
  if (!needle) return true; // wildcard
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function score(rule: RuleRow, tripType: ResolverTripType): number {
  let s = 0;
  if (rule.ville_depart) s += 2;
  if (rule.ville_arrivee) s += 2;
  if (rule.trip_type === tripType) s += 1;
  return s;
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

  // Build OR filter
  const filters: string[] = [];
  if (userId) filters.push(`client_user_id.eq.${userId}`);
  if (email) filters.push(`client_email.eq.${email.toLowerCase()}`);

  const { data } = await supabase
    .from("client_pricing_rules" as never)
    .select("id,client_user_id,client_email,ville_depart,ville_arrivee,zone_label,trip_type,prix_ttc,prix_ht,active")
    .or(filters.join(","))
    .eq("active", true);

  const rules = (data as unknown as RuleRow[] | null) ?? [];
  if (rules.length === 0) return null;

  const matched = rules
    .filter((r) => r.trip_type === "any" || r.trip_type === tripType)
    .filter((r) => cityIn(r.ville_depart, depart) && cityIn(r.ville_arrivee, arrivee))
    .sort((a, b) => score(b, tripType) - score(a, tripType));

  const best = matched[0];
  if (!best) return null;

  return {
    prix_ttc: Number(best.prix_ttc),
    prix_ht: best.prix_ht != null ? Number(best.prix_ht) : null,
    ruleId: best.id,
    zone_label: best.zone_label,
    ville_depart: best.ville_depart,
    ville_arrivee: best.ville_arrivee,
  };
}
