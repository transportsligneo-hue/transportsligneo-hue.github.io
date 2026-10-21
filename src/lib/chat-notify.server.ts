/** Envoi d'un email à l'autre partie d'une conversation après un nouveau message. */
const SITE = "https://www.transportsligneo.fr";

export async function notifyChatMessageById(messageId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendTransactionalEmailServer } = await import("@/server/email-send");
    const { data: msg } = await supabaseAdmin
      .from("chat_messages")
      .select("id, conversation_id, sender_type, body, created_at")
      .eq("id", messageId)
      .maybeSingle();
    if (!msg || msg.sender_type === "systeme") return;
    const { data: conv } = await supabaseAdmin
      .from("chat_conversations")
      .select("id, kind, mission_id, mission_reference, client_user_id, convoyeur_user_id, visitor_email, visitor_name")
      .eq("id", msg.conversation_id)
      .maybeSingle();
    if (!conv) return;

    // Anti-rafale : un seul email par conversation et expéditeur toutes les 10 min.
    const since = new Date(new Date(msg.created_at).getTime() - 600_000).toISOString();
    const { count } = await supabaseAdmin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conv.id)
      .eq("sender_type", msg.sender_type)
      .gte("created_at", since)
      .lt("created_at", msg.created_at);
    if ((count ?? 0) > 0) return;

    // Détails pour un mail lisible : nom de l'expéditeur, mission, trajet, véhicule.
    let mission: any = null;
    if (conv.mission_id) {
      const { data } = await supabaseAdmin
        .from("missions")
        .select("numero, prenom, nom, ville_depart, ville_arrivee, marque, modele, immatriculation")
        .eq("id", conv.mission_id)
        .maybeSingle();
      mission = data;
    }
    const trajet = mission ? `${mission.ville_depart ?? ""} → ${mission.ville_arrivee ?? ""}` : "";
    const vehicule = mission ? [[mission.marque, mission.modele].filter(Boolean).join(" "), mission.immatriculation].filter(Boolean).join(" · ") : "";
    let convoyeurName = "";
    if (conv.convoyeur_user_id) {
      const { data } = await supabaseAdmin.from("convoyeurs").select("prenom, nom").eq("user_id", conv.convoyeur_user_id).maybeSingle();
      convoyeurName = [data?.prenom, data?.nom].filter(Boolean).join(" ");
    }
    let clientName = mission ? [mission.prenom, mission.nom].filter(Boolean).join(" ") : "";
    if (!clientName && conv.client_user_id) {
      const { data } = await supabaseAdmin.from("profiles").select("prenom, nom, societe").eq("user_id", conv.client_user_id).maybeSingle();
      clientName = (data?.societe as string) || [data?.prenom, data?.nom].filter(Boolean).join(" ");
    }
    const ref = conv.mission_reference ? `Mission ${conv.mission_reference}` : "Conseiller Ligneo";
    const extrait = (msg.body || "Pièce jointe").slice(0, 400);
    let to: string | null = null;
    let ctaUrl = `${SITE}/login`;
    let titre = "Nouveau message de Transports Ligneo";

    if (msg.sender_type === "admin") {
      if (conv.kind === "mission_convoyeur" && conv.convoyeur_user_id) {
        const { data } = await supabaseAdmin.auth.admin.getUserById(conv.convoyeur_user_id);
        to = data?.user?.email ?? null;
        ctaUrl = `${SITE}/convoyeur/missions`;
      } else if (conv.client_user_id) {
        const { data } = await supabaseAdmin.auth.admin.getUserById(conv.client_user_id);
        to = data?.user?.email ?? null;
      } else {
        // Visiteur du site public : jamais d'email automatique (réponse en direct dans le chat).
        to = null;
      }
    } else {
      const role = msg.sender_type === "convoyeur" ? "Convoyeur" : msg.sender_type === "visiteur" ? "Visiteur" : "Client";
      const expediteur = role === "Convoyeur" ? convoyeurName : role === "Visiteur" ? [conv.visitor_name, conv.visitor_email].filter(Boolean).join(" · ") : clientName;
      const adminUrl = `${SITE}/admin/${conv.kind === "conseiller" ? "messagerie-conseiller" : "messagerie"}`;
      await sendTransactionalEmailServer({
        templateName: "chat-message-admin",
        idempotencyKey: `chat-msg-${msg.id}`,
        templateData: {
          role, expediteur: expediteur || role, reference: conv.mission_reference ?? "", trajet, vehicule,
          message: extrait, ctaUrl: adminUrl,
        },
      });
      return;
    }
    if (!to) return;
    await sendTransactionalEmailServer({
      templateName: "message-manuel",
      recipientEmail: to,
      idempotencyKey: `chat-msg-${msg.id}`,
      templateData: {
        subject: titre,
        titre,
        message: extrait,
        reference: [ref, trajet, vehicule].filter(Boolean).join(" · "),
        ctaLabel: "Répondre",
        ctaUrl,
      },
    });
  } catch (e) {
    console.error("[chat-notify] failed", e instanceof Error ? e.message : e);
  }
}
