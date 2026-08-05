import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CGV_VERSION = "v1-2026-01";
const CODE_TTL_MINUTES = 10;
const RESEND_LIMIT_PER_WINDOW = 3;
const RESEND_WINDOW_MINUTES = 10;

function generateCode(): string {
  // 6 chiffres cryptographiquement aléatoires (000000–999999)
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const shown = user.slice(0, Math.min(2, user.length));
  return `${shown}${"*".repeat(Math.max(1, user.length - shown.length))}@${domain}`;
}

/* -------------------------------------------------------------------------- */
/*  1. Demande d'envoi d'un code OTP par e-mail                               */
/* -------------------------------------------------------------------------- */
export const requestDevisOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { devisId: string }) => {
    if (!input?.devisId || typeof input.devisId !== "string") throw new Error("devisId requis");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const jwtEmail = (claims as { email?: string } | null)?.email ?? null;

    const { data: devis, error: devisErr } = await supabase
      .from("devis")
      .select("id, numero, email, prenom, depart, arrivee, prix_estime, locked_at, statut")
      .eq("id", data.devisId)
      .single();
    if (devisErr || !devis) throw new Error("Devis introuvable ou accès refusé");
    if (devis.locked_at) throw new Error("Devis déjà signé");
    if (devis.statut === "refuse") throw new Error("Devis refusé, code impossible");

    const recipient = (devis.email ?? jwtEmail ?? "").toLowerCase();
    if (!recipient) throw new Error("Adresse e-mail introuvable pour ce devis");

    // Rate-limit : max N envois par fenêtre glissante
    const since = new Date(Date.now() - RESEND_WINDOW_MINUTES * 60_000).toISOString();
    const { count: recent } = await supabase
      .from("devis_otp_challenges")
      .select("id", { count: "exact", head: true })
      .eq("devis_id", devis.id)
      .gte("created_at", since);
    if ((recent ?? 0) >= RESEND_LIMIT_PER_WINDOW) {
      throw new Error(
        `Trop de codes envoyés. Réessayez dans ${RESEND_WINDOW_MINUTES} minutes.`,
      );
    }

    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000);

    const ip =
      getRequestIP({ xForwardedFor: true }) ??
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-real-ip") ??
      null;
    const userAgent = getRequestHeader("user-agent") ?? null;

    // Insert via admin (RLS écriture = service_role uniquement)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insertErr } = await supabaseAdmin
      .from("devis_otp_challenges")
      .insert({
        devis_id: devis.id,
        client_user_id: userId,
        email: recipient,
        code_hash: codeHash,
        method: "email",
        expires_at: expiresAt.toISOString(),
        ip_address: ip,
        user_agent: userAgent,
      });
    if (insertErr) throw new Error(`Création du code échouée : ${insertErr.message}`);

    // Envoi e-mail (jamais bloquant)
    try {
      const { sendTransactionalEmailServer } = await import("@/server/email-send");
      await sendTransactionalEmailServer({
        templateName: "devis-otp-code",
        recipientEmail: recipient,
        idempotencyKey: `devis-otp-${devis.id}-${now.getTime()}`,
        templateData: {
          prenom: devis.prenom ?? "",
          numero: devis.numero,
          code,
          depart: devis.depart,
          arrivee: devis.arrivee,
          prix: Number(devis.prix_estime).toFixed(2),
          validite: CODE_TTL_MINUTES,
        },
      });
    } catch (e) {
      console.error("[devis-otp] send email failed", e);
      throw new Error("Envoi du code e-mail impossible, réessayez.");
    }

    return {
      ok: true,
      maskedEmail: maskEmail(recipient),
      expiresAt: expiresAt.toISOString(),
      ttlSeconds: CODE_TTL_MINUTES * 60,
    };
  });

/* -------------------------------------------------------------------------- */
/*  2. Vérification du code + signature du devis                              */
/* -------------------------------------------------------------------------- */
export const verifyDevisOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { devisId: string; code: string }) => {
    if (!input?.devisId || typeof input.devisId !== "string") throw new Error("devisId requis");
    if (!input?.code || !/^\d{6}$/.test(input.code)) throw new Error("Code invalide");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const jwtEmail = (claims as { email?: string } | null)?.email ?? null;

    const { data: devis, error: devisErr } = await supabase
      .from("devis")
      .select("id, numero, version, prix_estime, email, user_id, locked_at, depart, arrivee")
      .eq("id", data.devisId)
      .single();
    if (devisErr || !devis) throw new Error("Devis introuvable ou accès refusé");
    if (devis.locked_at) {
      return { ok: true, alreadyAccepted: true, acceptedAt: devis.locked_at };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Défi actif le plus récent
    const { data: challenge, error: chErr } = await supabaseAdmin
      .from("devis_otp_challenges")
      .select("id, code_hash, attempts, max_attempts, expires_at, consumed_at, email, created_at")
      .eq("devis_id", devis.id)
      .eq("client_user_id", userId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (chErr) throw new Error("Vérification impossible");
    if (!challenge) throw new Error("Aucun code en cours, redemandez un envoi.");
    if (new Date(challenge.expires_at).getTime() < Date.now()) {
      throw new Error("Code expiré, redemandez un envoi.");
    }
    if (challenge.attempts >= challenge.max_attempts) {
      throw new Error("Trop de tentatives, redemandez un nouveau code.");
    }

    const submittedHash = await sha256Hex(data.code);
    if (submittedHash !== challenge.code_hash) {
      await supabaseAdmin
        .from("devis_otp_challenges")
        .update({ attempts: challenge.attempts + 1 })
        .eq("id", challenge.id);
      const remaining = Math.max(0, challenge.max_attempts - (challenge.attempts + 1));
      throw new Error(`Code incorrect. ${remaining} tentative(s) restante(s).`);
    }

    // ---- Code valide : on signe le devis ----
    const now = new Date();
    const ip =
      getRequestIP({ xForwardedFor: true }) ??
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-real-ip") ??
      null;
    const userAgent = getRequestHeader("user-agent") ?? null;
    const clientEmail = (devis.email ?? challenge.email ?? jwtEmail ?? "").toLowerCase();
    if (!clientEmail) throw new Error("Email client manquant");

    // Consomme le défi
    await supabaseAdmin
      .from("devis_otp_challenges")
      .update({ consumed_at: now.toISOString() })
      .eq("id", challenge.id);

    // Insert preuve d'acceptation (validation_method = email_otp)
    const { data: accRow, error: insertErr } = await supabase
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
        validation_method: "email_otp",
        otp_sent_at: challenge.created_at,
        otp_verified_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (insertErr) throw new Error(`Enregistrement acceptation échoué : ${insertErr.message}`);

    // Verrouille le devis — écriture privilégiée : le client n'a pas de policy
    // UPDATE sur `devis` (sinon l'update ne touchait aucune ligne silencieusement).
    // La propriété du devis est déjà validée par le SELECT sous RLS ci-dessus.
    const { data: lockedRows, error: updErr } = await supabaseAdmin
      .from("devis")
      .update({ locked_at: now.toISOString(), accepted_at: now.toISOString(), statut: "accepte" })
      .eq("id", devis.id)
      .select("id");
    if (updErr) throw new Error(`Verrouillage du devis échoué : ${updErr.message}`);
    if (!lockedRows || lockedRows.length === 0) throw new Error("Verrouillage du devis échoué");


    // Notif admin (best-effort)
    try {
      await supabase.rpc("create_admin_notification", {
        _type: "devis",
        _titre: `Signature reçue — devis ${devis.numero}`,
        _message: `${clientEmail} a signé le devis ${devis.numero} par code OTP e-mail (${Number(devis.prix_estime).toFixed(2)} € TTC) · ${devis.depart} → ${devis.arrivee}`,
        _link: "/admin/devis",
        _entity_type: "devis",
        _entity_id: devis.id,
      });
    } catch { /* best-effort */ }
    try {
      const { sendPushToRole } = await import("@/lib/push/send.server");
      await sendPushToRole("admin", {
        title: `Devis signé (OTP) — ${devis.numero}`,
        body: `${clientEmail} · ${Number(devis.prix_estime).toFixed(2)} € TTC`,
        url: "/admin/devis",
        tag: `devis-signe-${devis.id}`,
      });
    } catch (e) {
      console.warn("[devis-otp] push admin failed", e);
    }

    return {
      ok: true,
      alreadyAccepted: false,
      acceptationId: accRow?.id ?? null,
      acceptedAt: now.toISOString(),
      ipAddress: ip,
      userAgent,
      numero: devis.numero,
      version: devis.version ?? 1,
    };
  });

/* -------------------------------------------------------------------------- */
/*  3. Attache le PDF figé (généré côté client) à la preuve d'acceptation     */
/* -------------------------------------------------------------------------- */
export const attachSignedDevisPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { devisId: string; pdfPath: string }) => {
    if (!input?.devisId || typeof input.devisId !== "string") throw new Error("devisId requis");
    if (!input?.pdfPath || typeof input.pdfPath !== "string") throw new Error("pdfPath requis");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!data.pdfPath.startsWith(`${userId}/`)) {
      throw new Error("Chemin de fichier non autorisé");
    }

    // Dernière preuve d'acceptation pour ce devis appartenant au user
    const { data: acc, error } = await supabase
      .from("devis_acceptations")
      .select("id, pdf_url")
      .eq("devis_id", data.devisId)
      .eq("client_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !acc) throw new Error("Preuve d'acceptation introuvable");

    // Écriture privilégiée : le client n'a pas de policy UPDATE sur devis_acceptations.
    // La ligne ciblée lui appartient (filtre client_user_id sous RLS ci-dessus).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updErr } = await supabaseAdmin
      .from("devis_acceptations")
      .update({ pdf_url: data.pdfPath })
      .eq("id", acc.id);
    if (updErr) throw new Error(`Enregistrement du PDF échoué : ${updErr.message}`);

    return { ok: true };
  });

/* -------------------------------------------------------------------------- */
/*  4. Refus du devis                                                         */
/* -------------------------------------------------------------------------- */
export const refuseDevis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { devisId: string; motif?: string }) => {
    if (!input?.devisId || typeof input.devisId !== "string") throw new Error("devisId requis");
    if (input.motif && typeof input.motif !== "string") throw new Error("motif invalide");
    if (input.motif && input.motif.length > 500) throw new Error("Motif trop long (max 500 caractères)");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const jwtEmail = (claims as { email?: string } | null)?.email ?? null;

    const { data: devis, error: devisErr } = await supabase
      .from("devis")
      .select("id, numero, email, locked_at, statut, prix_estime, depart, arrivee")
      .eq("id", data.devisId)
      .single();
    if (devisErr || !devis) throw new Error("Devis introuvable ou accès refusé");
    if (devis.locked_at) throw new Error("Devis déjà signé, refus impossible");
    if (devis.statut === "refuse") return { ok: true, alreadyRefused: true };

    const now = new Date().toISOString();
    const motif = data.motif?.trim() || null;

    const { error: updErr } = await supabase
      .from("devis")
      .update({ statut: "refuse", refused_at: now, refus_motif: motif })
      .eq("id", devis.id);
    if (updErr) throw new Error(`Refus impossible : ${updErr.message}`);

    // Historique (best-effort — la table peut avoir un trigger auto)
    try {
      await supabase.from("devis_status_history").insert({
        devis_id: devis.id,
        new_statut: "refuse",
        note: motif,
        changed_by: userId,
      });
    } catch { /* best-effort */ }

    const clientEmail = (devis.email ?? jwtEmail ?? "").toLowerCase();
    // Notif admin
    try {
      await supabase.rpc("create_admin_notification", {
        _type: "devis",
        _titre: `Devis refusé — ${devis.numero}`,
        _message: `${clientEmail} a refusé le devis ${devis.numero} (${Number(devis.prix_estime).toFixed(2)} € TTC) · ${devis.depart} → ${devis.arrivee}${motif ? ` · Motif : ${motif}` : ""}`,
        _link: "/admin/devis",
        _entity_type: "devis",
        _entity_id: devis.id,
      });
    } catch { /* best-effort */ }
    try {
      const { sendPushToRole } = await import("@/lib/push/send.server");
      await sendPushToRole("admin", {
        title: `Devis refusé — ${devis.numero}`,
        body: motif ? `Motif : ${motif}` : `${clientEmail}`,
        url: "/admin/devis",
        tag: `devis-refuse-${devis.id}`,
      });
    } catch (e) {
      console.warn("[devis-otp] push admin (refus) failed", e);
    }

    return { ok: true, refusedAt: now, motif };
  });
