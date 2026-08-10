import { supabase } from "@/integrations/supabase/client";
import { fetchActiveRegime } from "@/lib/pricing/fetch";

export interface InvoiceMentionResolved {
  mention: string | null;
  active: boolean;
  pricingDisplayMode: "ttc" | "ht" | "exempt";
  tvaExemptionNote: string | null;
}

/**
 * Résout la mention légale et le mode fiscal à imprimer sur une facture.
 * Priorité de la mention : profil client (si actif + non vide) > app_settings global > rien.
 * En régime micro-entreprise (franchise en base), la TVA est toujours exonérée.
 */
export async function resolveInvoiceMention(opts: {
  userId?: string | null;
}): Promise<InvoiceMentionResolved> {
  const { regime, exemptionNote } = await fetchActiveRegime();
  const micro = regime !== "societe";

  const out: InvoiceMentionResolved = {
    mention: null,
    active: false,
    pricingDisplayMode: micro ? "exempt" : "ttc",

    tvaExemptionNote: micro ? exemptionNote : null,
  };

  // Charge le défaut global (lecture autorisée à tout authenticated)
  try {
    const { data: globalRow } = await supabase
      .from("app_settings" as never)
      .select("value")
      .eq("key" as never, "facture_mention_default" as never)
      .maybeSingle();
    const g = (globalRow as { value?: { text?: string; active?: boolean } } | null)?.value;
    if (g?.active && g.text && g.text.trim().length > 0) {
      out.mention = g.text.trim();
      out.active = true;
    }
  } catch { /* ignore */ }

  if (!opts.userId) return out;

  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("pricing_display_mode, tva_exemption_note, facture_mention_legale, facture_mention_active")
      .eq("user_id", opts.userId)
      .maybeSingle();
    const p = prof as {
      pricing_display_mode?: string | null;
      tva_exemption_note?: string | null;
      facture_mention_legale?: string | null;
      facture_mention_active?: boolean | null;
    } | null;
    if (p) {
      // En micro-entreprise, le régime global prime : jamais de TVA facturée.
      if (!micro && (p.pricing_display_mode === "ht" || p.pricing_display_mode === "ttc" || p.pricing_display_mode === "exempt")) {
        out.pricingDisplayMode = p.pricing_display_mode;
      }
      out.tvaExemptionNote = p.tva_exemption_note?.trim() || out.tvaExemptionNote;

      // Override mention si le client en a une active et non vide
      if (p.facture_mention_active && p.facture_mention_legale && p.facture_mention_legale.trim().length > 0) {
        out.mention = p.facture_mention_legale.trim();
        out.active = true;
      }
    }
  } catch { /* ignore */ }

  return out;
}
