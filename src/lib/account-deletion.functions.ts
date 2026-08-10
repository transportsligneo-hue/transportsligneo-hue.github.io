import { createServerFn } from "@tanstack/react-start";
import { submitAccountDeletionRequest } from "./account-deletion.server";

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .inputValidator((data) => {
    const parsed = data as { email?: string; telephone?: string; raison?: string };
    if (!parsed.email || typeof parsed.email !== "string" || !parsed.email.includes("@")) {
      throw new Error("Adresse e-mail invalide");
    }
    return {
      email: parsed.email.trim().toLowerCase(),
      telephone: typeof parsed.telephone === "string" ? parsed.telephone.trim() : undefined,
      raison: typeof parsed.raison === "string" ? parsed.raison.trim() : undefined,
    };
  })
  .handler(async ({ data }) => {
    return submitAccountDeletionRequest(data);
  });
