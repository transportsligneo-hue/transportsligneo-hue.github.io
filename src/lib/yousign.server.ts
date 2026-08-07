/**
 * Client API Yousign (Signature API v3) — SERVER ONLY.
 *
 * La clé API n'existe que côté serveur (secret `YOUSIGN_API_KEY`).
 * L'environnement est piloté par `YOUSIGN_ENVIRONMENT` ("sandbox" par défaut).
 */

export type YousignEnvironment = "sandbox" | "production";

export function yousignEnvironment(): YousignEnvironment {
  const raw = (process.env["YOUSIGN_ENVIRONMENT"] ?? "sandbox").toLowerCase();
  return raw === "production" || raw === "prod" ? "production" : "sandbox";
}

export function yousignBaseUrl(env = yousignEnvironment()): string {
  return env === "production" ? "https://api.yousign.app/v3" : "https://api-sandbox.yousign.app/v3";
}

function apiKey(): string {
  const key = process.env["YOUSIGN_API_KEY"];
  if (!key) {
    throw new Error(
      "Yousign n'est pas configuré : la clé API est manquante côté serveur.",
    );
  }
  return key;
}

async function ysFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${yousignBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...(init.headers ?? {}),
    },
  });
  return res;
}

async function ysJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await ysFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Yousign ${init.method ?? "GET"} ${path} → ${res.status} ${text.slice(0, 500)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export interface CreateSignatureRequestOptions {
  name: string;
  /** Relances automatiques Yousign (si le plan le permet). */
  reminderDays?: number;
}

export async function createSignatureRequest(opts: CreateSignatureRequestOptions) {
  return ysJson<{ id: string; status: string }>("/signature_requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: opts.name,
      delivery_mode: "email",
      timezone: "Europe/Paris",
      ordered_signers: false,
      reminder_settings: {
        interval_in_days: opts.reminderDays ?? 5,
        max_occurrences: 3,
      },
    }),
  });
}

/** Upload du PDF pré-rempli comme document signable. */
export async function uploadDocument(signatureRequestId: string, pdf: Uint8Array, filename: string) {
  const form = new FormData();
  form.append("file", new Blob([pdf as unknown as BlobPart], { type: "application/pdf" }), filename);
  form.append("nature", "signable_document");
  form.append("parse_anchors", "false");
  return ysJson<{ id: string }>(`/signature_requests/${signatureRequestId}/documents`, {
    method: "POST",
    body: form,
  });
}

export interface AddSignerOptions {
  signatureRequestId: string;
  documentId: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Format international requis par Yousign, ex. +33612345678. */
  phone?: string | null;
  /** Authentification par code SMS. */
  otpSms: boolean;
  /** Page (1-indexée) où placer le champ de signature. */
  page: number;
}

export async function addSigner(opts: AddSignerOptions) {
  const body: Record<string, unknown> = {
    info: {
      first_name: opts.firstName,
      last_name: opts.lastName,
      email: opts.email,
      locale: "fr",
      ...(opts.phone ? { phone_number: opts.phone } : {}),
    },
    signature_level: "electronic_signature",
    signature_authentication_mode: opts.otpSms && opts.phone ? "otp_sms" : "no_otp",
    fields: [
      {
        document_id: opts.documentId,
        type: "signature",
        page: opts.page,
        x: 80,
        y: 620,
        width: 180,
        height: 60,
      },
    ],
  };
  return ysJson<{ id: string }>(`/signature_requests/${opts.signatureRequestId}/signers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function activateSignatureRequest(signatureRequestId: string) {
  return ysJson<{ id: string; status: string; signers?: Array<{ id: string; signature_link?: string }> }>(
    `/signature_requests/${signatureRequestId}/activate`,
    { method: "POST" },
  );
}

export async function getSignatureRequest(signatureRequestId: string) {
  return ysJson<{
    id: string;
    status: string;
    signers?: Array<{ id: string; status: string; signature_link?: string }>;
    documents?: Array<{ id: string; nature: string }>;
  }>(`/signature_requests/${signatureRequestId}`);
}

/** Relance manuelle du signataire. */
export async function remindSigner(signatureRequestId: string, signerId: string) {
  const res = await ysFetch(`/signature_requests/${signatureRequestId}/signers/${signerId}/send_reminder`, {
    method: "POST",
  });
  if (res.ok) return true;
  // Certains plans exposent la relance au niveau de la demande.
  const alt = await ysFetch(`/signature_requests/${signatureRequestId}/reminder`, { method: "POST" });
  if (alt.ok) return true;
  throw new Error(`Relance Yousign impossible (${res.status}).`);
}

export async function cancelSignatureRequest(signatureRequestId: string, reason: string) {
  await ysFetch(`/signature_requests/${signatureRequestId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "contractualization_aborted", custom_note: reason }),
  });
}

/** Télécharge le PDF signé (avec certificat de signature Yousign). */
export async function downloadSignedDocument(
  signatureRequestId: string,
  documentId: string,
): Promise<Uint8Array> {
  const res = await ysFetch(`/signature_requests/${signatureRequestId}/documents/${documentId}/download`);
  if (!res.ok) {
    throw new Error(`Téléchargement Yousign impossible (${res.status}).`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
