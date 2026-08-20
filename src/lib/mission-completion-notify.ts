/**
 * notifyAdminMissionTerminee — notification admin complète lorsqu'un convoyeur
 * termine une mission (EDL arrivée + dossier envoyé).
 *
 * Envoie : notification in-app admin (/admin/notifications) + push web aux
 * admins (via notifyAdmin) + email transactionnel récapitulatif.
 * Best-effort : n'interrompt jamais le flow convoyeur.
 */
import { supabase } from "@/integrations/supabase/client";
import { notifyAdmin } from "@/lib/admin-notifications";
import { sendTransactionalEmail } from "@/lib/email/send";

const ADMIN_EMAIL = "contact@transportsligneo.fr";

export async function notifyAdminMissionTerminee(
  attributionId: string,
  opts?: { manual?: boolean },
): Promise<void> {
  try {
    const { data: attr } = await supabase
      .from("attributions")
      .select("id, numero_mission, trajet_id, convoyeur_id")
      .eq("id", attributionId)
      .maybeSingle();

    const numero =
      (attr as { numero_mission?: string | null } | null)?.numero_mission ?? attributionId.slice(0, 8);

    let trajetLabel = "";
    let vehicule = "";
    let immatriculation = "";
    let client = "";
    if (attr?.trajet_id) {
      const { data: t } = await supabase
        .from("trajets")
        .select("depart, arrivee, marque, modele, immatriculation, client_nom, client_email")
        .eq("id", attr.trajet_id)
        .maybeSingle();
      if (t) {
        trajetLabel = `${t.depart ?? ""} → ${t.arrivee ?? ""}`.trim();
        vehicule = [t.marque, t.modele].filter(Boolean).join(" ");
        immatriculation = t.immatriculation ?? "";
        client = t.client_nom ?? t.client_email ?? "";
      }
    }

    let convoyeur = "";
    if (attr?.convoyeur_id) {
      const { data: c } = await supabase
        .from("convoyeurs")
        .select("prenom, nom")
        .eq("id", attr.convoyeur_id)
        .maybeSingle();
      if (c) convoyeur = `${c.prenom ?? ""} ${c.nom ?? ""}`.trim();
    }

    const link = `/admin/missions/${attributionId}`;
    const details = [trajetLabel, vehicule, immatriculation, convoyeur && `Convoyeur : ${convoyeur}`]
      .filter(Boolean)
      .join(" · ");

    await notifyAdmin({
      type: "mission_terminee",
      titre: `Mission ${numero} terminée`,
      message: details
        ? `${details} — dossier complet transmis, en attente de validation.`
        : "Dossier complet transmis, en attente de validation.",
      link,
      entityType: "attribution",
      entityId: attributionId,
      metadata: { numero, trajet: trajetLabel, vehicule, immatriculation, convoyeur, client },
    });

    await sendTransactionalEmail({
      templateName: "mission-terminee-admin",
      recipientEmail: ADMIN_EMAIL,
      idempotencyKey: opts?.manual
        ? `mission-terminee-admin-${attributionId}-${Date.now()}`
        : `mission-terminee-admin-${attributionId}`,
      skipProfileLookup: true,
      templateData: {
        numero,
        trajet: trajetLabel,
        vehicule,
        immatriculation,
        convoyeur,
        client,
        terminee_le: new Date().toLocaleString("fr-FR"),
        lien: `https://transportsligneo.fr${link}`,
      },
    });
  } catch (err) {
    console.warn("[notifyAdminMissionTerminee] échec", err);
  }
}
