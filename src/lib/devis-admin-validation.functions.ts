import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CGV_VERSION = "v1-2026-01";

export type AdminValidationCanal = "email" | "telephone" | "sur_place" | "bon_commande";

const CANAL_LABEL: Record<AdminValidationCanal, string> = {
  email: "Accord reçu par e-mail",
  telephone: "Accord reçu par téléphone",
  sur_place: "Accord donné sur place",
  bon_commande: "Bon de commande client reçu",
};

interface AdminValidateInput {
  devisId: string;
  canal: AdminValidationCanal;
  note?: string;
}

/**
 * Validation d'un devis PAR L'ADMIN pour le compte du client
 * (cas courant : devis envoyé par mail, réponse du client par mail).
 *
 * - vérifie que l'appelant est admin / super_admin
 * - enregistre une preuve d'acceptation (canal + note + horodatage + IP admin)
 * - verrouille le devis (locked_at / accepted_at) et passe le statut à "accepte"
 */
export const adminValidateDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AdminValidateInput) => {
    if (!input?.devisId || typeof input.devisId !== "string") {
      throw new Error("devisId requis");
    }
    if (!input.canal || !(input.canal in CANAL_LABEL)) {
      throw new Error("Canal de validation invalide");
    }
    if (input.note != null && typeof input.note !== "string") {
      throw new Error("Note invalide");
    }
    return { devisId: input.devisId, canal: input.canal, note: input.note?.slice(0, 500) ?? "" };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    ]);
    if (!isAdmin && !isSuper) throw new Error("Accès refusé");

    const { data: devis, error: devisErr } = await supabase
      .from("devis")
      .select("id, numero, version, prix_estime, email, user_id, locked_at, statut, depart, arrivee")
      .eq("id", data.devisId)
      .single();

    if (devisErr || !devis) throw new Error("Devis introuvable");
    if (devis.locked_at) return { ok: true, alreadyAccepted: true, numero: devis.numero };

    const adminEmail = (claims as { email?: string } | null)?.email ?? null;
    const clientEmail = (devis.email ?? "").toLowerCase();
    if (!clientEmail) throw new Error("Email client manquant sur le devis");

    const ip =
      getRequestIP({ xForwardedFor: true }) ??
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-real-ip") ??
      null;

    const label = CANAL_LABEL[data.canal];
    const now = new Date().toISOString();

    const { error: insertErr } = await supabase.from("devis_acceptations").insert({
      devis_id: devis.id,
      devis_version: devis.version ?? 1,
      client_user_id: devis.user_id ?? null,
      client_email: clientEmail,
      ip_address: ip,
      user_agent: `Validation administrateur — ${label}`,
      montant_accepte: devis.prix_estime,
      cgv_version: CGV_VERSION,
      statut: "accepte",
      validation_method: "admin_manuel",
      metadata: {
        source: "admin",
        canal: data.canal,
        canal_label: label,
        note: data.note,
        validated_by_user_id: userId,
        validated_by_email: adminEmail,
        validated_at: now,
      },
    });
    if (insertErr) throw new Error(`Enregistrement de la validation échoué : ${insertErr.message}`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error: updErr } = await supabaseAdmin
      .from("devis")
      .update({ locked_at: now, accepted_at: now, statut: "accepte" })
      .eq("id", devis.id)
      .select("id");
    if (updErr) throw new Error(`Verrouillage du devis échoué : ${updErr.message}`);
    if (!rows || rows.length === 0) throw new Error("Verrouillage du devis échoué");

    try {
      await supabaseAdmin.from("devis_status_history").insert({
        devis_id: devis.id,
        old_statut: devis.statut ?? null,
        new_statut: "accepte",
        note: `${label}${data.note ? ` — ${data.note}` : ""} (validé par ${adminEmail ?? "administrateur"})`,
      });
    } catch {
      // historique best-effort
    }

    return { ok: true, acceptedAt: now, numero: devis.numero, canalLabel: label };
  });
