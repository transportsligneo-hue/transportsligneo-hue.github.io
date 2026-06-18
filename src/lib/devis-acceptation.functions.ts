import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CGV_VERSION = "v1-2026-01";

interface AcceptInput {
  devisId: string;
  /** Chemin storage (bucket devis-acceptes) de l'image de signature manuscrite */
  signaturePath?: string;
  /** Chemin storage (bucket devis-acceptes) du PDF figé signé */
  pdfPath?: string;
}

/**
 * Enregistre une preuve d'acceptation de devis (valeur légale) :
 * - capture IP + User-Agent + horodatage UTC
 * - référence la signature manuscrite et le PDF figé (bucket privé)
 * - insert dans devis_acceptations (audit trail permanent)
 * - verrouille le devis (locked_at) et passe le statut à "accepte"
 * - notifie l'administration (signature reçue)
 */
export const acceptDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: AcceptInput) => {
    if (!input?.devisId || typeof input.devisId !== "string") {
      throw new Error("devisId requis");
    }
    if (input.signaturePath && typeof input.signaturePath !== "string") {
      throw new Error("signaturePath invalide");
    }
    if (input.pdfPath && typeof input.pdfPath !== "string") {
      throw new Error("pdfPath invalide");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims as { email?: string } | null)?.email ?? null;

    // Sécurité : les fichiers doivent appartenir au dossier du user
    for (const p of [data.signaturePath, data.pdfPath]) {
      if (p && !p.startsWith(`${userId}/`)) {
        throw new Error("Chemin de fichier non autorisé");
      }
    }

    // Récupère le devis (RLS s'applique : doit appartenir au user)
    const { data: devis, error: devisErr } = await supabase
      .from("devis")
      .select("id, numero, version, prix_estime, email, user_id, locked_at, depart, arrivee")
      .eq("id", data.devisId)
      .single();

    if (devisErr || !devis) {
      throw new Error("Devis introuvable ou accès refusé");
    }

    if (devis.locked_at) {
      // Déjà accepté pour cette version — idempotent
      return { ok: true, alreadyAccepted: true };
    }

    const ip =
      getRequestIP({ xForwardedFor: true }) ??
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-real-ip") ??
      null;
    const userAgent = getRequestHeader("user-agent") ?? null;

    const clientEmail = (devis.email ?? email ?? "").toLowerCase();
    if (!clientEmail) throw new Error("Email client manquant");

    // 1. Insert preuve d'acceptation
    const { error: insertErr } = await supabase
      .from("devis_acceptations")
      .insert({
        devis_id: devis.id,
        devis_version: devis.version ?? 1,
        client_user_id: userId,
        client_email: clientEmail,
        ip_address: ip,
        user_agent: userAgent,
        montant_accepte: devis.prix_estime,
        cgv_version: CGV_VERSION,
        statut: "accepte",
        signature_url: data.signaturePath ?? null,
        pdf_url: data.pdfPath ?? null,
      });

    if (insertErr) {
      throw new Error(`Enregistrement acceptation échoué : ${insertErr.message}`);
    }

    // 2. Verrouille le devis + statut accepté (le devis ne disparaît jamais)
    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("devis")
      .update({ locked_at: now, accepted_at: now, statut: "accepte" })
      .eq("id", devis.id);
    if (updErr) {
      throw new Error(`Verrouillage du devis échoué : ${updErr.message}`);
    }

    // 3. Notification admin (best-effort, jamais bloquant)
    try {
      await supabase.rpc("create_admin_notification", {
        _type: "devis",
        _titre: `Signature reçue — devis ${devis.numero}`,
        _message: `${clientEmail} a accepté et signé le devis ${devis.numero} (${Number(devis.prix_estime).toFixed(2)} € TTC) · ${devis.depart} → ${devis.arrivee}`,
        _link: "/admin/devis",
        _entity_type: "devis",
        _entity_id: devis.id,
      });
    } catch {
      // best-effort
    }

    return { ok: true, acceptedAt: now, numero: devis.numero, version: devis.version ?? 1 };
  });

/**
 * Récupère l'état d'acceptation et le paramètre global pour un devis.
 */
export const getDevisAcceptationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { devisId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: devis }, { data: setting }, { data: profile }] = await Promise.all([
      supabase
        .from("devis")
        .select("id, version, locked_at, accepted_at, user_id")
        .eq("id", data.devisId)
        .single(),
      supabase
        .from("app_settings")
        .select("value")
        .eq("key", "devis_acceptation_obligatoire")
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("exempte_acceptation_devis")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const obligatoire = setting?.value === true || setting?.value === "true";
    const exempte = !!(profile as { exempte_acceptation_devis?: boolean } | null)?.exempte_acceptation_devis;

    return {
      obligatoire,
      exempte,
      requiresAcceptation: obligatoire && !exempte && !devis?.locked_at,
      lockedAt: devis?.locked_at ?? null,
      acceptedAt: devis?.accepted_at ?? null,
      version: devis?.version ?? 1,
    };
  });
