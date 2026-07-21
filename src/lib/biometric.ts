// Déverrouillage biométrique local (Face ID / empreinte) via WebAuthn platform authenticator.
// Aucune vérification serveur : la promesse est "sur cet appareil, sans mon empreinte,
// personne n'ouvre le tableau de bord". La session Supabase reste persistée par défaut.

const CRED_KEY = (userId: string) => `ligneo_bio_${userId}`;
const UNLOCK_KEY = (userId: string) => `ligneo_bio_unlocked_${userId}`;
const LAST_USER_KEY = "ligneo_bio_last_user";

interface StoredCred {
  credId: string; // base64url
  email: string;
  createdAt: number;
}

function b64uEncode(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64uDecode(str: string): Uint8Array {
  const pad = str.length % 4 ? "=".repeat(4 - (str.length % 4)) : "";
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function randomBytes(len = 32): BufferSource {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return b.buffer as ArrayBuffer;
}

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export function hasBiometricEnrolled(userId: string): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(CRED_KEY(userId));
}

export function getLastBiometricUser(): { userId: string; email: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LAST_USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function markUnlocked(userId: string) {
  try { sessionStorage.setItem(UNLOCK_KEY(userId), "1"); } catch { /* ignore */ }
}
export function isUnlocked(userId: string): boolean {
  try { return sessionStorage.getItem(UNLOCK_KEY(userId)) === "1"; } catch { return false; }
}

export async function enableBiometric(userId: string, email: string): Promise<void> {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Transports Ligneo" },
      user: {
        id: new TextEncoder().encode(userId),
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
      attestation: "none",
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Aucune empreinte enregistrée");
  const stored: StoredCred = { credId: b64uEncode(cred.rawId), email, createdAt: Date.now() };
  localStorage.setItem(CRED_KEY(userId), JSON.stringify(stored));
  localStorage.setItem(LAST_USER_KEY, JSON.stringify({ userId, email }));
  markUnlocked(userId);
}

export function disableBiometric(userId: string) {
  try {
    localStorage.removeItem(CRED_KEY(userId));
    sessionStorage.removeItem(UNLOCK_KEY(userId));
    const last = getLastBiometricUser();
    if (last?.userId === userId) localStorage.removeItem(LAST_USER_KEY);
  } catch { /* ignore */ }
}

export async function verifyBiometric(userId: string): Promise<boolean> {
  const raw = localStorage.getItem(CRED_KEY(userId));
  if (!raw) return false;
  let stored: StoredCred;
  try { stored = JSON.parse(raw); } catch { return false; }
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [{ type: "public-key", id: b64uDecode(stored.credId).buffer as ArrayBuffer }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    if (!assertion) return false;
    markUnlocked(userId);
    return true;
  } catch {
    return false;
  }
}
