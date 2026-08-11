import { supabase } from "@/integrations/supabase/client";

export type PoHistoryAction = "po_change" | "pdf_regenerate";

export interface PoHistoryEntry {
  id: string;
  attribution_id: string | null;
  facture_id: string | null;
  facture_numero: string | null;
  action: PoHistoryAction;
  old_po: string | null;
  new_po: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

async function currentActor(): Promise<{ id: string | null; name: string | null }> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { id: null, name: null };
  let name: string | null = (user.user_metadata?.["full_name"] as string | undefined) ?? null;
  if (!name) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("prenom, nom, email")
      .eq("id", user.id)
      .maybeSingle();
    const p = prof as { prenom?: string | null; nom?: string | null; email?: string | null } | null;
    name = p ? [p.prenom, p.nom].filter(Boolean).join(" ").trim() || p.email || null : null;
  }
  return { id: user.id, name: name ?? user.email ?? null };
}

/** Journalise un changement de PO ou une régénération de PDF de facture. */
export async function logPoEvent(input: {
  action: PoHistoryAction;
  attributionId?: string | null;
  factureId?: string | null;
  factureNumero?: string | null;
  oldPo?: string | null;
  newPo?: string | null;
}): Promise<void> {
  try {
    const actor = await currentActor();
    await (supabase as any).from("po_pdf_history").insert({
      action: input.action,
      attribution_id: input.attributionId ?? null,
      facture_id: input.factureId ?? null,
      facture_numero: input.factureNumero ?? null,
      old_po: input.oldPo ?? null,
      new_po: input.newPo ?? null,
      actor_id: actor.id,
      actor_name: actor.name,
    });
  } catch {
    // journalisation non bloquante
  }
}

export async function fetchPoHistory(filter: {
  attributionId?: string | null;
  factureId?: string | null;
  limit?: number;
}): Promise<PoHistoryEntry[]> {
  let q = (supabase as any)
    .from("po_pdf_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 30);
  if (filter.attributionId) q = q.eq("attribution_id", filter.attributionId);
  if (filter.factureId) q = q.eq("facture_id", filter.factureId);
  const { data } = await q;
  return (data ?? []) as PoHistoryEntry[];
}

export function formatPoValue(v: string | null): string {
  return v && v.trim() ? v : "—";
}
