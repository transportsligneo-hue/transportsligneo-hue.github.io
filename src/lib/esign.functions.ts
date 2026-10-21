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
      pdfBase64: string; expiryDays?: number;
    }) => {
      if (!KINDS.includes(d.kind)) throw new Error("Type de document invalide");
      if (!d.title?.trim()) throw new Error("Titre requis");
      if (!d.signerName?.trim()) throw new Error("Nom du signataire requis");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.signerEmail ?? "")) throw new Error("E-mail du signataire invalide");
      if (!d.pdfBase64) throw new Error("Document PDF requis");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const S = await import("@/lib/esign.server");
    const supabaseAdmin = (await import("@/integrations/supabase/client.server")).supabaseAdmin as any;
    const meta = reqMeta();

    const bytes = S.b64ToBytes(data.pdfBase64);
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

export const esignList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { refType?: string; refId?: string; limit?: number }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = (context.supabase as any)
      .from("esign_requests")
      .select("id, kind, title, ref_type, ref_id, signer_name, signer_email, signer_phone, signer_company, status, sent_at, opened_at, signed_at, declined_at, decline_reason, expires_at, signed_doc_path, dossier_path, last_reminder_at, created_at")
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
    const { data: events } = await (context.supabase as any)
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
    const out = PUBLIC_FIELDS(r);
    out.maskedEmail = S.maskEmail(r.signer_email);
    out.maskedPhone = r.signer_phone && r.signer_phone.replace(/\D/g, "").length >= 10 ? S.maskPhone(r.signer_phone) : undefined;
    let docUrl: string | null = null;
    const path = r.status === "signed" && r.signed_doc_path ? r.signed_doc_path : r.doc_path;
    if (["opened", "signed"].includes(r.status)) {
      docUrl = (await supabaseAdmin.storage.from(S.BUCKET).createSignedUrl(path, 3600)).data?.signedUrl ?? null;
    }
    return { found: true as const, request: out, docUrl };
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
  .inputValidator((d: { token: string; signaturePng: string; consent: boolean; typedName: string }) => {
    if (!d.consent) throw new Error("Le consentement est obligatoire.");
    if (!d.signaturePng?.startsWith("data:image/png")) throw new Error("Signature invalide.");
    if (d.signaturePng.length > 1_500_000) throw new Error("Signature trop volumineuse.");
    if (!d.typedName?.trim()) throw new Error("Saisissez votre nom.");
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

    await S.logEvent(r.id, "consent_given", { consent_version: r.consent_version, typed_name: data.typedName.trim().slice(0, 120) }, meta);

    const sigBytes = S.b64ToBytes(data.signaturePng);
    const signedAt = new Date().toISOString();
    const method = otp.channel === "sms" ? "Lien personnel + code SMS a usage unique" : "Lien personnel + code e-mail a usage unique";
    const signed = await S.buildSignedPdf({ original, signaturePng: sigBytes, req: r as any, signedAt, ip: meta.ip, method });
    const signedHash = await S.sha256Bytes(signed);
    const sigHash = await S.sha256Bytes(sigBytes);

    const p1 = `${r.id}/signe.pdf`, p2 = `${r.id}/signature.png`;
    const u1 = await supabaseAdmin.storage.from(S.BUCKET).upload(p1, signed, { contentType: "application/pdf", upsert: true });
    const u2 = await supabaseAdmin.storage.from(S.BUCKET).upload(p2, sigBytes, { contentType: "image/png", upsert: true });
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
        templateData: { prenom: r.signer_name.split(" ")[0], titre: r.title, date: new Date(signedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }), ctaUrl: `${S.SITE_URL}/signature/${data.token}` },
      });
      await sendTransactionalEmailServer({
        templateName: "esign-signe-admin", idempotencyKey: `esign-done-admin-${r.id}`,
        templateData: { signataire: r.signer_name, titre: r.title, type: r.kind },
      });
    } catch (e) { console.error("[esign] emails", e); }
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
