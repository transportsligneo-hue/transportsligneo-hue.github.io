/**
 * Signature du contrat de partenariat convoyeur via Yousign.
 *
 * Le PDF pré-rempli est généré côté admin (jsPDF, charte Ligneo) puis transmis
 * ici en base64 : il n'est jamais exposé au candidat en dehors du parcours
 * Yousign, qui envoie lui-même le lien de signature sécurisé par email.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "contrats-convoyeurs";

function b64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function normalizePhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length === 10) return `+33${digits.slice(1)}`;
  return digits ? `+${digits}` : null;
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
  ]);
  if (!isAdmin && !isSuper) throw new Error("Accès réservé aux administrateurs.");
}

/** Statut du contrat pour un convoyeur donné (admin). */
export const getContratConvoyeur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { convoyeurId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row } = await context.supabase
      .from("convoyeur_contrats")
      .select(
        "id, statut, provider, yousign_environment, yousign_signature_request_id, sent_at, signed_at, declined_at, expired_at, last_reminder_at, decline_reason, signed_pdf_path, charte_incluse, charte_signed_at, charte_signed_pdf_path, nom_complet, email",
      )
      .eq("convoyeur_id", data.convoyeurId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { contrat: row ?? null };
  });

/** Envoie le contrat pré-rempli à Yousign et déclenche l'email de signature. */
export const sendContratYousign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      convoyeurId: string;
      pdfBase64: string;
      pageCount: number;
      chartePdfBase64?: string;
      chartePageCount?: number;
      snapshot?: Record<string, unknown>;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: conv, error } = await context.supabase
      .from("convoyeurs")
      .select("id, user_id, nom, prenom, email, telephone")
      .eq("id", data.convoyeurId)
      .maybeSingle();
    if (error || !conv) throw new Error("Convoyeur introuvable.");
    if (!conv.email) throw new Error("Ce convoyeur n'a pas d'adresse email.");

    const phone = normalizePhone(conv.telephone);
    const otpSms = Boolean(phone);

    const ys = await import("./yousign.server");
    const env = ys.yousignEnvironment();
    const nomComplet = `${conv.prenom ?? ""} ${conv.nom ?? ""}`.trim() || conv.email;

    const request = await ys.createSignatureRequest({
      name: `Contrat de partenariat + charte — ${nomComplet}`,
      reminderDays: 5,
    });

    const slug = nomComplet.replace(/\s+/g, "-").toLowerCase();
    let doc: { id: string };
    let charteDoc: { id: string } | null = null;
    try {
      doc = await ys.uploadDocument(
        request.id,
        b64ToBytes(data.pdfBase64),
        `contrat-partenariat-${slug}.pdf`,
      );
      if (data.chartePdfBase64) {
        charteDoc = await ys.uploadDocument(
          request.id,
          b64ToBytes(data.chartePdfBase64),
          `charte-presentation-discretion-${slug}.pdf`,
        );
      }
      await ys.addSigner({
        signatureRequestId: request.id,
        documents: [
          { documentId: doc.id, page: Math.max(1, data.pageCount || 1) },
          ...(charteDoc ? [{ documentId: charteDoc.id, page: Math.max(1, data.chartePageCount || 1) }] : []),
        ],
        firstName: conv.prenom || nomComplet,
        lastName: conv.nom || "Convoyeur",
        email: conv.email,
        phone,
        otpSms,
      });
      await ys.activateSignatureRequest(request.id);
    } catch (e) {
      await ys.cancelSignatureRequest(request.id, "Erreur de préparation").catch(() => {});
      throw e;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("convoyeur_contrats")
      .insert([{
        convoyeur_id: conv.id,
        user_id: conv.user_id,
        email: conv.email,
        nom_complet: nomComplet,
        statut: "envoye",
        provider: "yousign",
        yousign_environment: env,
        yousign_signature_request_id: request.id,
        yousign_document_id: doc.id,
        charte_document_id: charteDoc?.id ?? null,
        charte_incluse: Boolean(charteDoc),
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        snapshot: (data.snapshot ?? {}) as never,
        sent_at: new Date().toISOString(),
        created_by: context.userId,
      }])
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { ok: true as const, contratId: inserted.id, environment: env, otpSms };
  });

/** Relance manuelle du signataire via Yousign. */
export const relancerContratYousign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { contratId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("convoyeur_contrats")
      .select("id, statut, yousign_signature_request_id, yousign_signer_id")
      .eq("id", data.contratId)
      .maybeSingle();
    if (!row?.yousign_signature_request_id) throw new Error("Aucune demande de signature Yousign pour ce contrat.");
    if (row.statut !== "envoye") throw new Error("Ce contrat n'est plus en attente de signature.");

    const ys = await import("./yousign.server");
    let signerId = row.yousign_signer_id as string | null;
    if (!signerId) {
      const sr = await ys.getSignatureRequest(row.yousign_signature_request_id);
      signerId = sr.signers?.[0]?.id ?? null;
    }
    if (!signerId) throw new Error("Signataire Yousign introuvable.");

    await ys.remindSigner(row.yousign_signature_request_id, signerId);
    await supabaseAdmin
      .from("convoyeur_contrats")
      .update({ last_reminder_at: new Date().toISOString(), yousign_signer_id: signerId })
      .eq("id", row.id);
    return { ok: true as const };
  });

/**
 * Lien de téléchargement temporaire du contrat signé (admin ou convoyeur propriétaire).
 * La lecture passe par le client admin puis un contrôle de propriété explicite :
 * la table n'expose plus jeton, lien Yousign ni IP au client.
 */
export const getContratSigneUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { contratId: string; document?: "contrat" | "charte" }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("convoyeur_contrats")
      .select("id, signed_pdf_path, charte_signed_pdf_path, user_id, statut")
      .eq("id", data.contratId)
      .maybeSingle();
    if (!row) throw new Error("Contrat introuvable.");

    if (row.user_id !== context.userId) {
      await assertAdmin(context);
    }

    const path = data.document === "charte" ? row.charte_signed_pdf_path : row.signed_pdf_path;
    if (!path) throw new Error("Le document signé n'est pas encore disponible.");

    const { data: signed, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, 300);
    if (error || !signed) throw new Error("Lien de téléchargement indisponible.");
    return { url: signed.signedUrl };
  });

/**
 * Contrat du convoyeur connecté (espace convoyeur → Mes documents).
 * Utilise la fonction sécurisée get_my_contrat_status qui ne renvoie
 * que le statut et les chemins de documents signés.
 */
export const getMonContrat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase.rpc("get_my_contrat_status");
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { contrat: row ?? null };
  });
