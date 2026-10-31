/**
 * Signature électronique Ligneo — fonctions serveur.
 * Admin (authentifié) : créer / suivre / relancer / annuler / télécharger.
 * Public (lien secret) : consulter, recevoir un code, valider le code, signer, refuser.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Kind = "devis" | "contrat_convoyeur" | "contrat_pro" | "autre";
const KINDS: Kind[] = ["devis", "contrat_convoyeur", "contrat_pro", "autre"];

function reqMeta() {
  const ip = getRequestIP({ xForwardedFor: true }) ?? getRequestHeader("x-real-ip") ?? null;
  return { ip, ua: getRequestHeader("user-agent") ?? null };
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const [{ data: a }, { data: s }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
  ]);
  if (!a && !s) throw new Error("Accès réservé aux administrateurs.");
}

const PUBLIC_FIELDS = (r: any) => ({
  id: r.id as string,
  kind: r.kind as string,
  title: r.title as string,
  status: r.status as string,
  signerName: r.signer_name as string,
  signerCompany: (r.signer_company ?? null) as string | null,
  expiresAt: r.expires_at as string,
  signedAt: (r.signed_at ?? null) as string | null,
  declinedAt: (r.declined_at ?? null) as string | null,
  docHash: r.doc_sha256 as string,
  consentText: r.consent_text as string,
  maskedEmail: undefined as string | undefined,
  maskedPhone: undefined as string | undefined,
});

/* ======================================================================== */
/*  ADMIN                                                                    */
/* ======================================================================== */
export const esignCreate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      kind: Kind; title: string; refType?: string | null; refId?: string | null;
      signerName: string; signerEmail: string; signerPhone?: string | null; signerCompany?: string | null;
      pdfBase64?: string; pdfPath?: string; expiryDays?: number;
    }) => {
      if (!KINDS.includes(d.kind)) throw new Error("Type de document invalide");
      if (!d.title?.trim()) throw new Error("Titre requis");
      if (!d.signerName?.trim()) throw new Error("Nom du signataire requis");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.signerEmail ?? "")) throw new Error("E-mail du signataire invalide");
      if (!d.pdfBase64 && !d.pdfPath) throw new Error("Document PDF requis");
      if (d.pdfPath && !/^pending\/[0-9a-f-]{36}\.pdf$/.test(d.pdfPath)) throw new Error("Chemin du document invalide");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const meta = reqMeta();

    if (data.kind === "contrat_convoyeur" && data.refType === "convoyeur" && data.refId) {
      const missing = await S.missingConvoyeurDocs(data.refId);
      if (missing.length) throw new Error(`Pièces manquantes : ${missing.join(", ")}. Le convoyeur doit les déposer avant de signer.`);
    }
    let bytes: Uint8Array;
    if (data.pdfPath) {
      const dlr = await supabaseAdmin.storage.from(S.BUCKET).download(data.pdfPath);
      if (dlr.error || !dlr.data) throw new Error("Document envoyé introuvable, réessayez.");
      bytes = new Uint8Array(await dlr.data.arrayBuffer());
      await supabaseAdmin.storage.from(S.BUCKET).remove([data.pdfPath]);
    } else {
      bytes = S.b64ToBytes(data.pdfBase64 as string);
    }
    if (bytes.length < 200 || bytes.length > 15 * 1024 * 1024) throw new Error("PDF invalide ou trop volumineux (15 Mo max).");
    if (String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-") throw new Error("Le fichier n'est pas un PDF.");

    const docHash = await S.sha256Bytes(bytes);
    const token = S.newToken();
    const id = crypto.randomUUID();
    const path = `${id}/original.pdf`;
    const up = await supabaseAdmin.storage.from(S.BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error) throw new Error(`Stockage du document impossible : ${up.error.message}`);

    const days = Math.min(Math.max(Math.round(data.expiryDays ?? 14), 1), 60);
    const title = data.title.trim().slice(0, 200);
    const { error } = await supabaseAdmin.from("esign_requests").insert({
      id, kind: data.kind, title,
      ref_type: data.refType ?? null, ref_id: data.refId ?? null,
      signer_name: data.signerName.trim(), signer_email: data.signerEmail.trim().toLowerCase(),
      signer_phone: data.signerPhone?.trim() || null, signer_company: data.signerCompany?.trim() || null,
      token_hash: await S.sha256Text(token),
      expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
      doc_path: path, doc_sha256: docHash, doc_size: bytes.length,
      consent_version: S.CONSENT_VERSION, consent_text: S.consentText(title, docHash),
      created_by: context.userId,
    });
    if (error) throw new Error(`Création impossible : ${error.message}`);

    await S.logEvent(id, "created", { by: context.userId, doc_sha256: docHash, size: bytes.length }, meta);
    const link = `${S.SITE_URL}/signature/${token}`;
    const { sendTransactionalEmailServer } = await import("@/server/email-send");
    const mail = await sendTransactionalEmailServer({
      templateName: "esign-invitation",
      recipientEmail: data.signerEmail.trim().toLowerCase(),
      idempotencyKey: `esign-inv-${id}`,
      templateData: { prenom: data.signerName.split(" ")[0], titre: title, ctaUrl: link, jours: days },
    });
    await S.logEvent(id, mail.success ? "invitation_sent" : "invitation_failed", { to: S.maskEmail(data.signerEmail), reason: mail.reason ?? null }, meta);
    return { id, link, emailSent: mail.success };
  });

/** Étape 1 : adresse d'envoi direct vers le stockage (évite la limite de taille des requêtes du site). */
export const esignUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const path = `pending/${crypto.randomUUID()}.pdf`;
    const r = await supabaseAdmin.storage.from(S.BUCKET).createSignedUploadUrl(path);
    if (r.error || !r.data) throw new Error(`Envoi du document impossible : ${r.error?.message ?? "inconnu"}`);
    return { path, token: r.data.token as string };
  });

export const esignList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { refType?: string; refId?: string; limit?: number }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    let q = supabaseAdmin
      .from("esign_requests")
      .select("id, kind, title, ref_type, ref_id, signer_name, signer_email, signer_phone, signer_company, status, sent_at, opened_at, signed_at, declined_at, decline_reason, expires_at, signed_doc_path, dossier_path, last_reminder_at, created_at, contrat_version")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 300));
    if (data.refType) q = q.eq("ref_type", data.refType);
    if (data.refId) q = q.eq("ref_id", data.refId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    // expiration affichée sans écriture
    const now = Date.now();
    return {
      items: (rows ?? []).map((r: any) =>
        (r.status === "sent" || r.status === "opened") && new Date(r.expires_at).getTime() < now ? { ...r, status: "expired" } : r,
      ),
    };
  });

export const esignEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { data: events } = await supabaseAdmin
      .from("esign_events").select("seq, type, payload, ip_address, created_at, hash").eq("request_id", data.id).order("seq");
    return { events: events ?? [], chainOk: await S.chainOk(data.id) };
  });

export const esignRemind = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { data: r } = await supabaseAdmin.from("esign_requests").select("*").eq("id", data.id).single();
    if (!r || !["sent", "opened", "expired"].includes(r.status)) throw new Error("Cette demande ne peut plus être relancée.");
    // Un nouveau lien remplace l'ancien (l'ancien devient invalide) et la validité repart.
    const token = S.newToken();
    const days = 14;
    await supabaseAdmin.from("esign_requests").update({
      token_hash: await S.sha256Text(token), status: "sent",
      expires_at: new Date(Date.now() + days * 86_400_000).toISOString(), last_reminder_at: new Date().toISOString(),
    }).eq("id", r.id);
    const { sendTransactionalEmailServer } = await import("@/server/email-send");
    const mail = await sendTransactionalEmailServer({
      templateName: "esign-invitation", recipientEmail: r.signer_email,
      idempotencyKey: `esign-rem-${r.id}-${Date.now()}`,
      templateData: { prenom: r.signer_name.split(" ")[0], titre: r.title, ctaUrl: `${S.SITE_URL}/signature/${token}`, jours: days, relance: true },
    });
    await S.logEvent(r.id, "reminder_sent", { ok: mail.success }, reqMeta());
    return { ok: mail.success };
  });

export const esignCancel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { data: r } = await supabaseAdmin.from("esign_requests").select("id, status").eq("id", data.id).single();
    if (!r || r.status === "signed") throw new Error("Un document signé ne peut pas être annulé.");
    await supabaseAdmin.from("esign_requests").update({ status: "cancelled" }).eq("id", r.id);
    await S.logEvent(r.id, "cancelled", { by: context.userId }, reqMeta());
    return { ok: true };
  });

export const esignDownloadUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { data: r } = await supabaseAdmin.from("esign_requests").select("doc_path, signed_doc_path, dossier_path").eq("id", data.id).single();
    if (!r) throw new Error("Introuvable");
    try { await S.ensureModernParaphe(data.id, reqMeta()); } catch (e) { console.error("[esign] rendu du paraphe", e); }
    const sign = async (p: string | null) =>
      p ? (await supabaseAdmin.storage.from(S.BUCKET).createSignedUrl(p, 300)).data?.signedUrl ?? null : null;
    return { original: await sign(r.doc_path), signed: await sign(r.signed_doc_path), dossier: await sign(r.dossier_path) };
  });

/* ======================================================================== */
/*  PUBLIC (lien secret)                                                     */
/* ======================================================================== */
export const esignPublicGet = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const r = await S.findByToken(data.token);
    if (!r) return { found: false as const };
    if (r.status === "sent") {
      await supabaseAdmin.from("esign_requests").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", r.id);
      await S.logEvent(r.id, "opened", {}, reqMeta());
      r.status = "opened";
    }
    const missing = r.kind === "contrat_convoyeur" && r.ref_type === "convoyeur" && r.ref_id && ["opened", "sent"].includes(r.status)
      ? await S.missingConvoyeurDocs(r.ref_id) : [];
    const out = PUBLIC_FIELDS(r);
    out.maskedEmail = S.maskEmail(r.signer_email);
    out.maskedPhone = r.signer_phone && r.signer_phone.replace(/\D/g, "").length >= 10 ? S.maskPhone(r.signer_phone) : undefined;
    let docUrl: string | null = null;
    if (r.status === "signed") {
      try { await S.ensureModernParaphe(r.id, reqMeta()); } catch (e) { console.error("[esign] rendu du paraphe", e); }
    }
    const path = r.status === "signed" && r.signed_doc_path ? r.signed_doc_path : r.doc_path;
    if (["opened", "signed"].includes(r.status)) {
      docUrl = (await supabaseAdmin.storage.from(S.BUCKET).createSignedUrl(path, 3600)).data?.signedUrl ?? null;
    }
    return { found: true as const, request: out, docUrl, missingDocs: missing };
  });

export const esignPublicSendOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; channel: "email" | "sms" }) => ({ token: d.token, channel: d.channel === "sms" ? "sms" : "email" }) as { token: string; channel: "email" | "sms" })
  .handler(async ({ data }) => {
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const r = await S.findByToken(data.token);
    if (!r || !["sent", "opened"].includes(r.status)) throw new Error("Ce lien n'est plus valide.");
    const meta = reqMeta();

    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabaseAdmin.from("esign_otps").select("id", { count: "exact", head: true }).eq("request_id", r.id).gte("created_at", since);
    if ((count ?? 0) >= S.OTP_SEND_LIMIT) throw new Error("Trop de codes demandés. Réessayez dans 10 minutes.");

    const phone = (r.signer_phone ?? "").trim();
    // Contrat convoyeur : SMS obligatoire quand un numéro valide existe (plus robuste).
    if (r.kind === "contrat_convoyeur" && phone.replace(/\D/g, "").length >= 10) data.channel = "sms";
    if (data.channel === "sms" && phone.replace(/\D/g, "").length < 10) throw new Error("Aucun numéro de téléphone valide. Choisissez l'e-mail.");

    const code = S.newOtp();
    const expires = new Date(Date.now() + S.OTP_TTL_MIN * 60_000);
    const { error } = await supabaseAdmin.from("esign_otps").insert({
      request_id: r.id, code_hash: await S.sha256Text(`${r.id}:${code}`), channel: data.channel,
      destination: data.channel === "sms" ? S.maskPhone(phone) : S.maskEmail(r.signer_email),
      expires_at: expires.toISOString(), ip_address: meta.ip,
    });
    if (error) throw new Error("Création du code impossible.");

    if (data.channel === "sms") {
      const { sendSms } = await import("@/lib/sms.server");
      const res = await sendSms({ to: phone, body: `Transports Ligneo : votre code de signature est ${code}. Valable ${S.OTP_TTL_MIN} min. Ne le communiquez à personne.` });
      if (!res.ok) throw new Error("Envoi du SMS impossible, essayez par e-mail.");
    } else {
      const { sendTransactionalEmailServer } = await import("@/server/email-send");
      const m = await sendTransactionalEmailServer({
        templateName: "esign-otp-code", recipientEmail: r.signer_email,
        idempotencyKey: `esign-otp-${r.id}-${Date.now()}`,
        templateData: { prenom: r.signer_name.split(" ")[0], titre: r.title, code, validite: S.OTP_TTL_MIN },
      });
      if (!m.success) throw new Error("Envoi de l'e-mail impossible. Réessayez.");
    }
    await S.logEvent(r.id, "otp_sent", { channel: data.channel, to: data.channel === "sms" ? S.maskPhone(phone) : S.maskEmail(r.signer_email) }, meta);
    return { ok: true, channel: data.channel, to: data.channel === "sms" ? S.maskPhone(phone) : S.maskEmail(r.signer_email), ttlSeconds: S.OTP_TTL_MIN * 60 };
  });

export const esignPublicVerifyOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; code: string }) => d)
  .handler(async ({ data }) => {
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const r = await S.findByToken(data.token);
    if (!r || !["sent", "opened"].includes(r.status)) throw new Error("Ce lien n'est plus valide.");
    const meta = reqMeta();
    const { data: otp } = await supabaseAdmin.from("esign_otps").select("*").eq("request_id", r.id).is("verified_at", null)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!otp) throw new Error("Demandez d'abord un code.");
    if (new Date(otp.expires_at) < new Date()) throw new Error("Code expiré. Demandez-en un nouveau.");
    if (otp.attempts >= S.OTP_MAX_ATTEMPTS) throw new Error("Trop d'essais. Demandez un nouveau code.");
    await supabaseAdmin.from("esign_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
    const ok = (await S.sha256Text(`${r.id}:${(data.code ?? "").replace(/\D/g, "")}`)) === otp.code_hash;
    if (!ok) {
      await S.logEvent(r.id, "otp_failed", { attempt: otp.attempts + 1 }, meta);
      throw new Error(`Code incorrect (${Math.max(0, S.OTP_MAX_ATTEMPTS - otp.attempts - 1)} essai(s) restant(s)).`);
    }
    await supabaseAdmin.from("esign_otps").update({ verified_at: new Date().toISOString() }).eq("id", otp.id);
    await S.logEvent(r.id, "otp_verified", { channel: otp.channel }, meta);
    return { ok: true };
  });

export const esignPublicSign = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; signaturePng: string; consent: boolean; typedName: string; initialsPng?: string }) => {
    if (!d.consent) throw new Error("Le consentement est obligatoire.");
    if (!d.signaturePng?.startsWith("data:image/png")) throw new Error("Signature invalide.");
    if (d.signaturePng.length > 1_500_000) throw new Error("Signature trop volumineuse.");
    if (!d.typedName?.trim()) throw new Error("Saisissez votre nom.");
    if (d.initialsPng && (!d.initialsPng.startsWith("data:image/png") || d.initialsPng.length > 400_000)) throw new Error("Paraphe invalide.");
    return d;
  })
  .handler(async ({ data }) => {
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const meta = reqMeta();
    const r = await S.findByToken(data.token);
    if (!r) throw new Error("Lien invalide.");
    if (r.status === "signed") return { ok: true, alreadySigned: true };
    if (!["sent", "opened"].includes(r.status)) throw new Error("Ce document ne peut plus être signé.");

    if (r.kind === "contrat_convoyeur" && r.ref_type === "convoyeur" && r.ref_id) {
      const missing = await S.missingConvoyeurDocs(r.ref_id);
      if (missing.length) throw new Error(`Déposez d'abord vos documents (${missing.join(", ")}) pour pouvoir signer.`);
    }
    // code validé récemment ?
    const since = new Date(Date.now() - S.OTP_VERIFIED_VALID_MIN * 60_000).toISOString();
    const { data: otp } = await supabaseAdmin.from("esign_otps").select("id, channel").eq("request_id", r.id)
      .not("verified_at", "is", null).gte("verified_at", since).order("verified_at", { ascending: false }).limit(1).maybeSingle();
    if (!otp) throw new Error("Validez d'abord le code reçu.");

    // intégrité du document d'origine
    const dl = await supabaseAdmin.storage.from(S.BUCKET).download(r.doc_path);
    if (dl.error || !dl.data) throw new Error("Document introuvable.");
    const original = new Uint8Array(await dl.data.arrayBuffer());
    if ((await S.sha256Bytes(original)) !== r.doc_sha256) {
      await S.logEvent(r.id, "integrity_failure", { stage: "before_signature" }, meta);
      throw new Error("Le document a été altéré : signature bloquée.");
    }

    if (data.initialsPng) await S.logEvent(r.id, "initials_applied", { initials_sha256: await S.sha256Bytes(S.b64ToBytes(data.initialsPng)) }, meta);
    await S.logEvent(r.id, "consent_given", { consent_version: r.consent_version, typed_name: data.typedName.trim().slice(0, 120) }, meta);

    const sigBytes = S.b64ToBytes(data.signaturePng);
    const signedAt = new Date().toISOString();
    const method = otp.channel === "sms" ? "Lien personnel + code SMS a usage unique" : "Lien personnel + code e-mail a usage unique";
    const initialsBytes = data.initialsPng ? S.b64ToBytes(data.initialsPng) : undefined;
    const signed = await S.buildSignedPdf({ original, signaturePng: sigBytes, initialsPng: initialsBytes, req: r as any, signedAt, ip: meta.ip, method, kind: r.kind });
    const signedHash = await S.sha256Bytes(signed);
    const sigHash = await S.sha256Bytes(sigBytes);

    const p1 = `${r.id}/signe.pdf`, p2 = `${r.id}/signature.png`;
    const u1 = await supabaseAdmin.storage.from(S.BUCKET).upload(p1, signed, { contentType: "application/pdf", upsert: true });
    const u2 = await supabaseAdmin.storage.from(S.BUCKET).upload(p2, sigBytes, { contentType: "image/png", upsert: true });
    if (initialsBytes) await supabaseAdmin.storage.from(S.BUCKET).upload(`${r.id}/paraphe.png`, initialsBytes, { contentType: "image/png", upsert: true });
    if (u1.error || u2.error) throw new Error("Enregistrement du document signé impossible.");

    await supabaseAdmin.from("esign_requests").update({
      status: "signed", signed_at: signedAt, signature_path: p2, signed_doc_path: p1, signed_doc_sha256: signedHash,
    }).eq("id", r.id);
    await S.logEvent(r.id, "signed", { doc_sha256: r.doc_sha256, signed_doc_sha256: signedHash, signature_sha256: sigHash, auth: otp.channel }, meta);

    // scellement : HMAC serveur sur (document signé + tête de chaîne + date)
    const { data: head } = await supabaseAdmin.from("esign_events").select("hash").eq("request_id", r.id).order("seq", { ascending: false }).limit(1).single();
    const seal = await S.hmacSeal(`${r.id}|${signedHash}|${head?.hash}|${signedAt}`);
    await supabaseAdmin.from("esign_requests").update({ seal }).eq("id", r.id);
    await S.logEvent(r.id, "sealed", { chain_head: head?.hash, seal }, meta);

    // dossier de preuve
    const { data: fresh } = await supabaseAdmin.from("esign_requests").select("*").eq("id", r.id).single();
    const { data: events } = await supabaseAdmin.from("esign_events").select("*").eq("request_id", r.id).order("seq");
    const dossier = await S.buildDossierPdf({ req: fresh as any, events: (events ?? []) as any, chainOk: await S.chainOk(r.id) });
    const dp = `${r.id}/dossier-preuve.pdf`;
    await supabaseAdmin.storage.from(S.BUCKET).upload(dp, dossier, { contentType: "application/pdf", upsert: true });
    await supabaseAdmin.from("esign_requests").update({ dossier_path: dp, dossier_sha256: await S.sha256Bytes(dossier) }).eq("id", r.id);

    // suites métier (jamais bloquantes)
    try {
      if (r.kind === "devis" && r.ref_id) {
        await supabaseAdmin.from("devis").update({ locked_at: signedAt, accepted_at: signedAt, statut: "accepte" }).eq("id", r.ref_id).is("locked_at", null);
      }
    } catch (e) { console.error("[esign] suite devis", e); }
    try {
      const { sendTransactionalEmailServer } = await import("@/server/email-send");
      await sendTransactionalEmailServer({
        templateName: "esign-signe", recipientEmail: r.signer_email, idempotencyKey: `esign-done-${r.id}`,
        templateData: { prenom: r.signer_name.split(" ")[0], titre: r.title, date: new Date(signedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }), ctaUrl: `${S.SITE_URL}/signature/${data.token}`, pieces: true, contrat: r.kind === "contrat_convoyeur" },
        // copie PDF propre jointe : document signé (contrat + certificat) et dossier de preuve
        attachments: [
          { name: `${(r.title as string).replace(/[^A-Za-z0-9À-ÿ _.-]/g, "").trim().replace(/\s+/g, "-") || "document"}-signe.pdf`, contentBase64: Buffer.from(signed).toString("base64") },
          { name: "Dossier-de-preuve-signature.pdf", contentBase64: Buffer.from(dossier).toString("base64") },
        ],
      });
      await sendTransactionalEmailServer({
        templateName: "esign-signe-admin", idempotencyKey: `esign-done-admin-${r.id}`,
        templateData: { signataire: r.signer_name, titre: r.title, type: r.kind },
      });
    } catch (e) { console.error("[esign] emails", e); }
    // contrat convoyeur : notification dans son espace + alerte admin (jamais bloquant)
    try {
      if (r.kind === "contrat_convoyeur" && r.ref_type === "convoyeur" && r.ref_id) {
        const { data: cv } = await supabaseAdmin.from("convoyeurs").select("user_id").eq("id", r.ref_id).maybeSingle();
        if (cv?.user_id) {
          await supabaseAdmin.from("user_notifications").insert({
            user_id: cv.user_id, type: "contrat_signe", titre: "Contrat signé",
            message: "Votre contrat de partenariat est signé. Vous le retrouvez dans vos documents.", link: "/convoyeur/documents",
          });
          const { sendPushToUser } = await import("@/lib/push/send.server");
          await sendPushToUser(cv.user_id, { title: "Contrat signé", body: "Retrouvez-le dans vos documents.", url: "/convoyeur/documents", tag: `contrat-${r.id}` });
        }
        await supabaseAdmin.from("admin_notifications").insert({
          type: "contrat_signe", titre: "Contrat convoyeur signé", message: `${r.signer_name} a signé son contrat de partenariat.`,
          link: `/admin/contrats-convoyeurs`, entity_type: "convoyeur", entity_id: r.ref_id,
        });
        const { pushAdmins } = await import("@/lib/admin-alert.server");
        await pushAdmins("Contrat convoyeur signé", `${r.signer_name} a signé son contrat.`, "/admin/contrats-convoyeurs", `contrat-${r.id}`);
      }
    } catch (e) { console.error("[esign] notifications contrat", e); }
    return { ok: true, alreadySigned: false };
  });

export const esignPublicDecline = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; reason?: string }) => d)
  .handler(async ({ data }) => {
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const r = await S.findByToken(data.token);
    if (!r || !["sent", "opened"].includes(r.status)) throw new Error("Ce lien n'est plus valide.");
    const reason = (data.reason ?? "").trim().slice(0, 500) || null;
    await supabaseAdmin.from("esign_requests").update({ status: "declined", declined_at: new Date().toISOString(), decline_reason: reason }).eq("id", r.id);
    await S.logEvent(r.id, "declined", { reason }, reqMeta());
    try {
      const { sendTransactionalEmailServer } = await import("@/server/email-send");
      await sendTransactionalEmailServer({
        templateName: "esign-signe-admin", idempotencyKey: `esign-decl-admin-${r.id}`,
        templateData: { signataire: r.signer_name, titre: r.title, type: r.kind, refus: true, motif: reason ?? "" },
      });
    } catch { /* non bloquant */ }
    return { ok: true };
  });

/** Vérification publique : l'empreinte d'un PDF (calculée dans le navigateur) correspond-elle à un document signé ? */
export const esignVerifyHash = createServerFn({ method: "POST" })
  .inputValidator((d: { hash: string }) => {
    if (!/^[a-f0-9]{64}$/i.test(d?.hash ?? "")) throw new Error("Empreinte invalide");
    return { hash: d.hash.toLowerCase() };
  })
  .handler(async ({ data }) => {
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const { data: signed } = await supabaseAdmin.from("esign_requests").select("*").eq("signed_doc_sha256", data.hash).maybeSingle();
    const { data: orig } = signed ? { data: null } : await supabaseAdmin.from("esign_requests").select("*").eq("doc_sha256", data.hash).maybeSingle();
    const r: any = signed ?? orig;
    if (!r) return { match: "none" as const };
    let sealOk = false;
    const ch = await S.chainOk(r.id);
    if (r.status === "signed" && r.seal) {
      const { data: sealed } = await supabaseAdmin.from("esign_events").select("payload").eq("request_id", r.id).eq("type", "sealed").limit(1).maybeSingle();
      const head = (sealed?.payload as any)?.chain_head;
      sealOk = !!head && (await S.hmacSeal(`${r.id}|${r.signed_doc_sha256}|${head}|${new Date(r.signed_at).toISOString()}`)) === r.seal;
    }
    return {
      match: signed ? ("signed" as const) : ("original" as const),
      title: r.title as string, signerName: r.signer_name as string, status: r.status as string,
      signedAt: (r.signed_at ?? null) as string | null, chainOk: ch, sealOk, reference: r.id as string,
    };
  });

/* ---------------------- Convoyeur : mon contrat à signer ---------------------- */
async function myConvoyeurId(context: { supabase: any; userId: string }): Promise<string | null> {
  const { data } = await context.supabase.from("convoyeurs").select("id").eq("user_id", context.userId).maybeSingle();
  return data?.id ?? null;
}

export const esignMyContrat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const cid = await myConvoyeurId(context);
    if (!cid) return { exists: false as const };
    const { data: row } = await supabaseAdmin.from("esign_requests")
      .select("id, status, title, signed_at, expires_at, contrat_version").eq("kind", "contrat_convoyeur").eq("ref_type", "convoyeur").eq("ref_id", cid)
      .in("status", ["sent", "opened", "signed", "expired"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) return { exists: false as const };
    const { data: vc } = await supabaseAdmin.rpc("contrat_version_courante");
    const versionCourante = Number(vc ?? 1);
    const version = Number(row.contrat_version ?? 1);
    const missing = row.status === "signed" ? [] : await S.missingConvoyeurDocs(cid);
    const expired = row.status === "expired" || (row.status !== "signed" && new Date(row.expires_at) < new Date());
    // contrat signé dans une ancienne version : une nouvelle signature est requise
    const outdated = row.status === "signed" && version < versionCourante;
    return { exists: true as const, id: row.id as string, status: (expired ? "expired" : row.status) as string, title: row.title as string, signedAt: (row.signed_at ?? null) as string | null, missing, version, versionCourante, outdated };
  });

/** Convoyeur : liens de téléchargement (5 min) de SON contrat signé et de son dossier de preuve. */
export const esignMyContratFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const cid = await myConvoyeurId(context);
    if (!cid) throw new Error("Fiche convoyeur introuvable.");
    const { data: r } = await supabaseAdmin.from("esign_requests")
      .select("id, signed_doc_path, dossier_path").eq("kind", "contrat_convoyeur").eq("ref_type", "convoyeur").eq("ref_id", cid)
      .eq("status", "signed").order("signed_at", { ascending: false }).limit(1).maybeSingle();
    if (!r) throw new Error("Aucun contrat signé.");
    try { await S.ensureModernParaphe(r.id, reqMeta()); } catch (e) { console.error("[esign] rendu du paraphe", e); }
    const sign = async (p: string | null, name: string) =>
      p ? (await supabaseAdmin.storage.from(S.BUCKET).createSignedUrl(p, 300, { download: name })).data?.signedUrl ?? null : null;
    return { signed: await sign(r.signed_doc_path, "Contrat-de-partenariat-signe.pdf"), dossier: await sign(r.dossier_path, "Preuve-de-signature.pdf") };
  });

/** Nouveau lien de signature pour le convoyeur connecté (remplace l'ancien). */
export const esignMyLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const cid = await myConvoyeurId(context);
    if (!cid) throw new Error("Fiche convoyeur introuvable.");
    const missing = await S.missingConvoyeurDocs(cid);
    if (missing.length) throw new Error(`Déposez d'abord vos documents : ${missing.join(", ")}.`);
    const { data: row } = await supabaseAdmin.from("esign_requests").select("id, status")
      .eq("kind", "contrat_convoyeur").eq("ref_type", "convoyeur").eq("ref_id", cid)
      .in("status", ["sent", "opened", "expired"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row) throw new Error("Aucun contrat en attente de signature.");
    const token = S.newToken();
    await supabaseAdmin.from("esign_requests").update({
      token_hash: await S.sha256Text(token), status: "sent", expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    }).eq("id", row.id);
    await S.logEvent(row.id, "link_regenerated", { by: "signer_account" }, reqMeta());
    return { link: `${S.SITE_URL}/signature/${token}` };
  });

/** Admin : pièces manquantes d'un convoyeur. */
export const esignConvoyeurDocsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { convoyeurId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const S = await import("@/lib/esign.server");
    return { missing: await S.missingConvoyeurDocs(data.convoyeurId) };
  });

/**
 * Admin : lit le Kbis déposé par le convoyeur et en extrait SIRET, dénomination et adresse du siège,
 * pour pré-remplir le contrat de partenariat (aucune saisie à refaire).
 */
type KbisResult = { ok: boolean; siret: string | null; adresse: string | null; denomination: string | null; error?: string };

/** Base officielle (recherche-entreprises) : retrouve le SIRET d'un indépendant par son nom quand le Kbis est illisible. */
async function siretParNom(prenom: string, nom: string, codePostal?: string | null): Promise<KbisResult | null> {
  const q = `${prenom} ${nom}`.trim();
  if (q.length < 4) return null;
  const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(q)}&etat_administratif=A&page=1&per_page=10${codePostal && /^\d{5}$/.test(codePostal) ? `&code_postal=${codePostal}` : ""}`;
  const res = await fetch(url, { headers: { accept: "application/json" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as any;
  const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const n = norm(nom), p = norm(prenom);
  const hits = (res?.results ?? []).filter((r: any) => {
    const dir = (r?.dirigeants ?? []).some((d: any) => norm(String(d?.nom ?? "")).includes(n) && norm(String(d?.prenoms ?? "")).includes(p));
    const nc = norm(String(r?.nom_complet ?? ""));
    return dir || (nc.includes(n) && nc.includes(p));
  });
  if (hits.length !== 1) return null; // ambigu ou absent : on ne devine pas
  const siege = hits[0]?.siege;
  const siret = String(siege?.siret ?? "");
  if (siret.length !== 14) return null;
  return {
    ok: true,
    siret: siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1 $2 $3 $4"),
    adresse: String(siege?.adresse ?? "").replace(/\s+/g, " ").trim() || null,
    denomination: String(hits[0]?.nom_complet ?? "").trim() || null,
  };
}

async function lireKbisConvoyeur(convoyeurId: string): Promise<KbisResult> {
    const none = { ok: false, siret: null, adresse: null, denomination: null };
    try {
      const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
      const db = admin as any;
      const { normalizeConvoyeurDocType } = await import("@/lib/convoyeur-documents");
      const { data: docs } = await db
        .from("documents_convoyeurs")
        .select("type_document, url_fichier, nom_fichier, statut_validation, created_at")
        .eq("convoyeur_id", convoyeurId)
        .order("created_at", { ascending: false });
      const kbis = (docs ?? []).find(
        (d: any) => normalizeConvoyeurDocType(d.type_document) === "kbis" && d.statut_validation !== "refuse",
      );
      if (!kbis) return { ...none, error: "Aucun Kbis déposé." };

      const { data: blob, error } = await db.storage.from("convoyeur-documents").download(kbis.url_fichier);
      if (error || !blob) return { ...none, error: "Kbis illisible." };
      if (blob.size > 9_000_000) return { ...none, error: "Kbis trop volumineux." };
      const ext = String(kbis.nom_fichier ?? kbis.url_fichier).toLowerCase().split(".").pop() ?? "";
      const mime = blob.type && blob.type !== "application/octet-stream"
        ? blob.type
        : ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
      const buf = Buffer.from(await blob.arrayBuffer());
      const b64 = buf.toString("base64");

      // 1) Lecture directe du texte du PDF (sans IA) + base officielle pour nom/adresse.
      if (mime === "application/pdf") {
        try {
          const { extractText, getDocumentProxy } = await import("unpdf");
          const pdf = await getDocumentProxy(new Uint8Array(buf));
          const { text } = await extractText(pdf, { mergePages: true });
          const t = String(text ?? "").replace(/\u00a0/g, " ");
          const luhnOk = (n: string) => { let s = 0; for (let i = 0; i < n.length; i++) { let d = Number(n[n.length - 1 - i]); if (i % 2) { d *= 2; if (d > 9) d -= 9; } s += d; } return s % 10 === 0; };
          const sirets = [...t.matchAll(/(?<!\d)(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})(?!\d)/g)].map((m) => m[1].replace(/\s/g, "")).filter(luhnOk);
          const sirens = [...t.matchAll(/(?<!\d)(\d{3}\s?\d{3}\s?\d{3})(?!\d)/g)].map((m) => m[1].replace(/\s/g, "")).filter(luhnOk);
          const q = sirets[0] ?? sirens[0];
          if (q) {
            const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${q}&page=1&per_page=1`, { headers: { accept: "application/json" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as any;
            const r0 = res?.results?.[0];
            const etab = q.length === 14 ? [r0?.siege, ...(r0?.matching_etablissements ?? [])].find((x: any) => x && String(x.siret) === q) : r0?.siege;
            const siretFinal = (q.length === 14 ? q : etab?.siret ? String(etab.siret) : "");
            if (siretFinal) {
              return {
                ok: true,
                siret: siretFinal.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1 $2 $3 $4"),
                adresse: String(etab?.adresse ?? "").replace(/\s+/g, " ").trim() || null,
                denomination: String(r0?.nom_complet ?? "").trim() || null,
              };
            }
          }
        } catch { /* on tente l'IA ensuite */ }
      }

      const apiKey = process.env.GEMINI_API_KEY ?? process.env.LOVABLE_API_KEY;
      if (!apiKey) return { ...none, error: "Service IA non configuré." };
      const { callVisionTool, pickModel, getServerAiSettings } = await import("@/lib/ai/gateway.server");
      const settings = await getServerAiSettings();
      if (settings && !settings.ai_enabled) return { ...none, error: "IA désactivée." };
      const res = await callVisionTool<{ siret?: string; denomination?: string; adresse?: string }>({
        apiKey,
        model: pickModel("ocr_documents", settings?.model_overrides),
        systemPrompt:
          "Tu lis un extrait Kbis / avis de situation SIRENE français. Renvoie uniquement ce qui est écrit sur le document : " +
          "SIRET à 14 chiffres (ou SIREN à 9 chiffres + NIC), dénomination ou nom de l'entrepreneur, adresse complète du siège ou de l'établissement. " +
          "Si une information est absente ou illisible, laisse le champ vide. N'invente rien.",
        userText: "Extrais le SIRET, la dénomination et l'adresse de ce document.",
        imageUrls: [`data:${mime};base64,${b64}`],
        tool: {
          name: "report_kbis",
          description: "Retourne les informations du Kbis.",
          parameters: {
            type: "object",
            properties: {
              siret: { type: "string" },
              denomination: { type: "string" },
              adresse: { type: "string" },
            },
            required: [],
          },
        },
        timeoutMs: 25_000,
      });
      if (!res.ok) return { ...none, error: res.error };
      let digits = String(res.data.siret ?? "").replace(/\D/g, "");
      // SIREN seul (9 chiffres) : on récupère le SIRET complet du siège dans la base officielle
      if (digits.length === 9) {
        const rs = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${digits}&page=1&per_page=1`, { headers: { accept: "application/json" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null) as any;
        const sie = String(rs?.results?.[0]?.siege?.siret ?? "");
        if (sie.length === 14) digits = sie;
      }
      const siret = digits.length === 14 ? digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, "$1 $2 $3 $4") : digits.length === 9 ? digits.replace(/^(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3") : null;
      const adresse = String(res.data.adresse ?? "").replace(/\s+/g, " ").trim() || null;
      const denomination = String(res.data.denomination ?? "").trim() || null;
      return { ok: !!(siret || adresse), siret, adresse, denomination, error: siret || adresse ? undefined : "Rien de lisible sur le Kbis." };
    } catch {
      return { ...none, error: "Lecture du Kbis impossible." };
    }
}

export const esignConvoyeurKbisInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { convoyeurId: string }) => d)
  .handler(async ({ data, context }): Promise<KbisResult> => {
    await assertAdmin(context);
    const r = await lireKbisConvoyeur(data.convoyeurId);
    if (r.siret) return r;
    // Kbis absent ou illisible : recherche dans la base officielle par nom du convoyeur
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: c } = await (supabaseAdmin as any).from("convoyeurs").select("prenom, nom, code_postal").eq("id", data.convoyeurId).maybeSingle();
      const byName = c ? await siretParNom(String(c.prenom ?? ""), String(c.nom ?? ""), c.code_postal) : null;
      if (byName) return { ...byName, adresse: r.adresse || byName.adresse };
    } catch { /* non bloquant */ }
    return r;
  });

/**
 * Admin : complète automatiquement la fiche convoyeur (naissance, adresse, SIRET)
 * à partir des infos saisies à l'inscription, puis du Kbis / de la base officielle.
 * Ne remplace jamais une valeur déjà renseignée. Enregistre ce qui a été trouvé.
 */
export const convoyeurAutoRemplir = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { convoyeurId: string }) => d)
  .handler(async ({ data, context }): Promise<{ ok: boolean; rempli: Record<string, string>; source: string[] }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: c } = await db.from("convoyeurs").select("*").eq("id", data.convoyeurId).maybeSingle();
    if (!c) return { ok: false, rempli: {}, source: [] };
    const vide = (v: unknown) => v == null || String(v).trim() === "";
    const rempli: Record<string, string> = {};
    const source: string[] = [];
    const poser = (k: string, v: unknown) => { const s = String(v ?? "").trim(); if (s && vide(c[k]) && !rempli[k]) rempli[k] = s; };

    // 1) Infos saisies dans le formulaire d'inscription (métadonnées du compte)
    if (c.user_id) {
      const { data: u } = await db.auth.admin.getUserById(c.user_id);
      const m = (u?.user?.user_metadata ?? {}) as Record<string, string>;
      const avant = Object.keys(rempli).length;
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(m.date_naissance ?? ""))) poser("date_naissance", m.date_naissance);
      poser("lieu_naissance", m.lieu_naissance);
      poser("siret", String(m.siret ?? "").replace(/\D/g, "").length === 14 ? String(m.siret).replace(/\D/g, "") : "");
      poser("adresse", m.adresse);
      poser("adresse_rue", m.adresse_rue);
      poser("code_postal", m.code_postal);
      poser("ville", m.ville);
      if (!vide(m.adresse) && (vide(c.adresse_rue) || vide(c.code_postal))) {
        const mm = String(m.adresse).match(/^(.*?)[,\s]+(\d{5})\s+(.+)$/);
        if (mm) { poser("adresse_rue", mm[1]); poser("code_postal", mm[2]); poser("ville", mm[3]); }
      }
      if (Object.keys(rempli).length > avant) source.push("inscription");
    }

    // 2) SIRET + adresse lus sur le Kbis, sinon base officielle par nom
    if (vide(c.siret) && !rempli.siret) {
      let k = await lireKbisConvoyeur(data.convoyeurId).catch(() => null);
      if (!k?.siret) k = await siretParNom(String(c.prenom ?? ""), String(c.nom ?? ""), c.code_postal ?? rempli.code_postal).catch(() => null);
      if (k?.siret) {
        poser("siret", k.siret.replace(/\D/g, ""));
        if (k.adresse) {
          poser("adresse", k.adresse);
          const mm = k.adresse.match(/^(.*?)[,\s]+(\d{5})\s+(.+)$/);
          if (mm) { poser("adresse_rue", mm[1]); poser("code_postal", mm[2]); poser("ville", mm[3]); }
        }
        source.push("kbis");
      }
    }

    if (Object.keys(rempli).length) {
      const { error } = await db.from("convoyeurs").update(rempli).eq("id", data.convoyeurId);
      if (error) {
        console.warn(`[convoyeurAutoRemplir] ${error.message}`);
        return { ok: false, rempli: {}, source: [] };
      }
    }
    return { ok: true, rempli, source };
  });

/**
 * Admin : lit le permis déposé par le convoyeur (recto) et en extrait le numéro et la date de délivrance,
 * pour le contrat de partenariat.
 */
export const esignConvoyeurPermisInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { convoyeurId: string }) => d)
  .handler(async ({ data, context }): Promise<{ ok: boolean; numero: string | null; delivre: string | null; error?: string }> => {
    await assertAdmin(context);
    const none = { ok: false, numero: null, delivre: null };
    try {
      const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
      const { normalizeConvoyeurDocType } = await import("@/lib/convoyeur-documents");
      const { data: docs } = await db.from("documents_convoyeurs")
        .select("type_document, url_fichier, nom_fichier, statut_validation, created_at")
        .eq("convoyeur_id", data.convoyeurId).order("created_at", { ascending: false });
      const list = (docs ?? []).filter((d: any) => normalizeConvoyeurDocType(d.type_document) === "permis" && d.statut_validation !== "refuse");
      const doc = list.find((d: any) => String(d.type_document).toLowerCase() === "permis") ?? list[0];
      if (!doc) return { ...none, error: "Aucun permis déposé." };
      const { data: blob, error } = await db.storage.from("convoyeur-documents").download(doc.url_fichier);
      if (error || !blob) return { ...none, error: "Permis illisible." };
      if (blob.size > 9_000_000) return { ...none, error: "Fichier trop volumineux." };
      const ext = String(doc.nom_fichier ?? doc.url_fichier).toLowerCase().split(".").pop() ?? "";
      const mime = blob.type && blob.type !== "application/octet-stream" ? blob.type : ext === "pdf" ? "application/pdf" : ext === "png" ? "image/png" : "image/jpeg";
      const b64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
      const apiKey = process.env.GEMINI_API_KEY ?? process.env.LOVABLE_API_KEY;
      if (!apiKey) return { ...none, error: "Service IA non configuré." };
      const { callVisionTool, pickModel, getServerAiSettings } = await import("@/lib/ai/gateway.server");
      const settings = await getServerAiSettings();
      if (settings && !settings.ai_enabled) return { ...none, error: "IA désactivée." };
      const res = await callVisionTool<{ numero?: string; delivre?: string }>({
        apiKey,
        model: pickModel("ocr_documents", settings?.model_overrides),
        systemPrompt:
          "Tu lis le recto d'un permis de conduire français/européen. Renvoie uniquement ce qui est écrit : " +
          "le numéro du permis (rubrique 5, souvent 12 chiffres/lettres) et la date de délivrance (rubrique 4a, format JJ/MM/AAAA). " +
          "Si illisible, laisse vide. N'invente rien.",
        userText: "Extrais le numéro du permis (rubrique 5) et la date de délivrance (rubrique 4a).",
        imageUrls: [`data:${mime};base64,${b64}`],
        tool: { name: "report_permis", description: "Informations du permis.", parameters: { type: "object", properties: { numero: { type: "string" }, delivre: { type: "string" } }, required: [] } },
        timeoutMs: 25_000,
      });
      if (!res.ok) return { ...none, error: res.error };
      const numero = String(res.data.numero ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase() || null;
      const d = String(res.data.delivre ?? "").match(/(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})/);
      const delivre = d ? `${d[1]}/${d[2]}/${d[3]}` : null;
      return { ok: !!numero, numero, delivre, error: numero ? undefined : "Numéro illisible sur le permis." };
    } catch {
      return { ...none, error: "Lecture du permis impossible." };
    }
  });

/* ======================================================================== */
/*  RELAIS TÉLÉPHONE : signer sur le mobile, la signature revient sur le PC   */
/*  Sans table : lien signé (HMAC, 15 min) + fichier temporaire dans le       */
/*  stockage privé. Le consentement et le nom restent validés sur le PC.      */
/* ======================================================================== */
const HANDOFF_TTL_MS = 15 * 60_000;
const handoffPath = (id: string) => `handoff/${id}.png`;

async function handoffMake(requestId: string) {
  const S = await import("@/lib/esign.server");
  const exp = Date.now() + HANDOFF_TTL_MS;
  const sig = await S.hmacSeal(`handoff|${requestId}|${exp}`);
  return `${requestId}.${exp}.${sig}`;
}
async function handoffCheck(ht: string) {
  const S = await import("@/lib/esign.server");
  const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
  const [id, exp, sig] = String(ht ?? "").split(".");
  if (!id || !exp || !sig) throw new Error("Lien invalide.");
  if (Number(exp) < Date.now()) throw new Error("Ce QR code a expiré. Générez-en un nouveau sur l'ordinateur.");
  if ((await S.hmacSeal(`handoff|${id}|${exp}`)) !== sig) throw new Error("Lien invalide.");
  const { data: r } = await supabaseAdmin.from("esign_requests").select("*").eq("id", id).maybeSingle();
  if (!r || !["sent", "opened"].includes(r.status)) throw new Error("Ce document ne peut plus être signé.");
  return { S, supabaseAdmin, r };
}

/** PC : crée le lien du QR code (paraphe ou signature dessinés sur le téléphone). */
export const esignHandoffStart = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const r = await S.findByToken(data.token);
    if (!r || !["sent", "opened"].includes(r.status)) throw new Error("Ce lien n'est plus valide.");
    // le code SMS/e-mail est demandé en toute dernière étape : le QR code (paraphe ou signature) ne le requiert plus
    await supabaseAdmin.storage.from(S.BUCKET).remove([handoffPath(r.id), handoffPath(r.id).replace(/\.png$/, "-p.png")]);
    return { ht: await handoffMake(r.id), ttlSeconds: HANDOFF_TTL_MS / 1000 };
  });

/** Téléphone : infos minimales à afficher. */
export const esignHandoffResolve = createServerFn({ method: "POST" })
  .inputValidator((d: { ht: string }) => d)
  .handler(async ({ data }) => {
    const { r } = await handoffCheck(data.ht);
    return { title: r.title as string, signerName: r.signer_name as string };
  });

/** Téléphone : dépose le dessin de la signature. */
export const esignHandoffSubmit = createServerFn({ method: "POST" })
  .inputValidator((d: { ht: string; signaturePng: string; initialsPng?: string }) => {
    if (!d.signaturePng?.startsWith("data:image/png;base64,")) throw new Error("Signature invalide.");
    if (d.signaturePng.length > 1_500_000) throw new Error("Signature trop volumineuse.");
    if (d.initialsPng && (!d.initialsPng.startsWith("data:image/png;base64,") || d.initialsPng.length > 400_000)) throw new Error("Paraphe invalide.");
    return d;
  })
  .handler(async ({ data }) => {
    const { S, supabaseAdmin, r } = await handoffCheck(data.ht);
    const bytes = S.b64ToBytes(data.signaturePng.split(",")[1]);
    const up = await supabaseAdmin.storage.from(S.BUCKET).upload(handoffPath(r.id), bytes, { contentType: "image/png", upsert: true });
    if (up.error) throw new Error("Envoi impossible, réessayez.");
    if (data.initialsPng) {
      await supabaseAdmin.storage.from(S.BUCKET).upload(handoffPath(r.id).replace(/\.png$/, "-p.png"), S.b64ToBytes(data.initialsPng.split(",")[1]), { contentType: "image/png", upsert: true });
    }
    try { await S.logEvent(r.id, "signature_drawn_on_phone", {}, reqMeta()); } catch { /* journal facultatif */ }
    return { ok: true };
  });

/** PC : attend (poll) la signature dessinée sur le téléphone. */
export const esignHandoffPoll = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; ht: string }) => d)
  .handler(async ({ data }) => {
    const { S, supabaseAdmin, r } = await handoffCheck(data.ht);
    const own = await S.findByToken(data.token);
    if (!own || own.id !== r.id) throw new Error("Lien invalide.");
    const dl = await supabaseAdmin.storage.from(S.BUCKET).download(handoffPath(r.id));
    if (dl.error || !dl.data) return { ready: false as const };
    const buf = Buffer.from(await dl.data.arrayBuffer());
    await supabaseAdmin.storage.from(S.BUCKET).remove([handoffPath(r.id)]);
    let initialsPng: string | undefined;
    const pp = handoffPath(r.id).replace(/\.png$/, "-p.png");
    const dl2 = await supabaseAdmin.storage.from(S.BUCKET).download(pp);
    if (!dl2.error && dl2.data) {
      initialsPng = `data:image/png;base64,${Buffer.from(await dl2.data.arrayBuffer()).toString("base64")}`;
      await supabaseAdmin.storage.from(S.BUCKET).remove([pp]);
    }
    return { ready: true as const, png: `data:image/png;base64,${buf.toString("base64")}`, initialsPng };
  });
