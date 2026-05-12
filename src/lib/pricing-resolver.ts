/**
 * Pricing resolver — récupère le prix client TTC verrouillé depuis le devis source.
 *
 * Règle métier : si un devis accepté/payé existe pour la demande/trajet,
 * le prix client TTC est celui du devis (verrouillé, modifiable seulement
 * via ajustement admin promo/pénalité).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ResolvedPrice {
  prixTtc: number;
  source: string;       // ex. "DEV-TLG-2026-001"
  devisId: string;
  paid: boolean;
}

/** Récupère le prix verrouillé pour un trajet (via devis_id direct). */
export async function resolveTrajetPrice(trajetId: string): Promise<ResolvedPrice | null> {
  const { data: trajet } = await supabase
    .from("trajets")
    .select("devis_id")
    .eq("id", trajetId)
    .maybeSingle();
  if (!trajet?.devis_id) return null;
  return resolveDevisPrice(trajet.devis_id);
}

/** Récupère le prix d'un devis. */
export async function resolveDevisPrice(devisId: string): Promise<ResolvedPrice | null> {
  const { data } = await supabase
    .from("devis")
    .select("id, numero, prix_estime, paid_at, statut")
    .eq("id", devisId)
    .maybeSingle();
  if (!data) return null;
  if (!["accepte", "convertit"].includes(data.statut) && !data.paid_at) return null;
  return {
    prixTtc: Number(data.prix_estime),
    source: data.numero,
    devisId: data.id,
    paid: !!data.paid_at,
  };
}

/** Cherche le devis le plus récent accepté/payé pour un email. */
export async function resolveLatestPriceForEmail(email: string): Promise<ResolvedPrice | null> {
  if (!email) return null;
  const { data } = await supabase
    .from("devis")
    .select("id, numero, prix_estime, paid_at, statut")
    .ilike("email", email)
    .in("statut", ["accepte", "convertit"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    prixTtc: Number(data.prix_estime),
    source: data.numero,
    devisId: data.id,
    paid: !!data.paid_at,
  };
}
