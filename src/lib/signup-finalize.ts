/**
 * Finalisation d'inscription côté client.
 *
 * La confirmation d'email étant active, `signUp` ne renvoie pas de session :
 * les uploads de documents, les emails et la notification admin doivent passer
 * par le endpoint serveur. Best-effort : ne casse jamais le parcours utilisateur.
 */
export type SignupKind = "convoyeur" | "client" | "pro" | "flotte";

export async function finalizeSignup(
  userId: string,
  kind: SignupKind,
  documents?: Record<string, File | null>,
): Promise<void> {
  try {
    const form = new FormData();
    form.append("userId", userId);
    form.append("kind", kind);
    for (const [type, file] of Object.entries(documents ?? {})) {
      if (file) form.append(`doc_${type}`, file, file.name);
    }
    await fetch("/api/public/signup/finalize", { method: "POST", body: form });
  } catch (err) {
    console.warn("[finalizeSignup] failed", err);
  }
}
