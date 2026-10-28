import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LABEL: Record<string, string> = {
  permis: "Permis (recto)", permis_verso: "Permis (verso)", identite: "Pièce d'identité", rib: "RIB",
  kbis: "Kbis / SIRET", assurance: "Assurance", photo_profil: "Photo de profil",
};

/**
 * Un convoyeur vient de déposer un document : cloche + push vers les admins.
 * Regroupe les dépôts rapprochés (10 min) en UNE seule alerte pour ne pas spammer.
 */
export const notifyDocumentDepose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { convoyeurId: string; typeDocument: string }) =>
    z.object({ convoyeurId: z.string().uuid(), typeDocument: z.string().max(60) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: c } = await db.from("convoyeurs").select("id, user_id, prenom, nom, email").eq("id", data.convoyeurId).maybeSingle();
    if (!c || c.user_id !== context.userId) throw new Error("Forbidden");

    const nom = `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || c.email || "Un convoyeur";
    const doc = LABEL[data.typeDocument] ?? data.typeDocument.replace(/_/g, " ");
    const depuis = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: existante } = await db.from("admin_notifications").select("id, metadata")
      .eq("type", "driver_action").eq("entity_id", c.id).eq("lu", false).gte("created_at", depuis)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    const docs: string[] = Array.isArray(existante?.metadata?.documents) ? existante.metadata.documents : [];
    if (!docs.includes(doc)) docs.push(doc);
    const message = `${nom} · ${docs.join(", ")}`;

    if (existante) {
      await db.from("admin_notifications").update({ message, metadata: { documents: docs } }).eq("id", existante.id);
      return { ok: true, regroupee: true };
    }
    await db.from("admin_notifications").insert({
      type: "driver_action",
      titre: "Document déposé par un convoyeur",
      message,
      link: "/admin/convoyeurs",
      entity_type: "convoyeur",
      entity_id: c.id,
      metadata: { documents: docs },
    });
    const { pushAdmins } = await import("@/lib/admin-alert.server");
    await pushAdmins("Document déposé par un convoyeur", message, "/admin/convoyeurs", `doc-${c.id}`);
    return { ok: true, regroupee: false };
  });
