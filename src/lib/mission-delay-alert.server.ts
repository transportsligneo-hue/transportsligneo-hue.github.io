/**
 * Alerte retard mission : email + SMS au client concerné, notification interne admin.
 * Server-only. Jamais bloquant : chaque canal est isolé.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendRawEmailServer } from "@/server/email-send";

function formatMin(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} h` : `${h} h ${String(r).padStart(2, "0")}`;
}

export async function sendMissionDelayAlert(params: {
  attributionId: string;
  trajetId: string | null;
  delayMinutes: number;
  etaAt: string;
}): Promise<void> {
  const { attributionId, trajetId, delayMinutes, etaAt } = params;

  let trajet: {
    numero_mission: string | null;
    depart: string | null;
    arrivee: string | null;
    client_nom: string | null;
    client_email: string | null;
    client_telephone: string | null;
    immatriculation: string | null;
  } | null = null;

  if (trajetId) {
    const { data } = await supabaseAdmin
      .from("trajets")
      .select("numero_mission, depart, arrivee, client_nom, client_email, client_telephone, immatriculation")
      .eq("id", trajetId)
      .maybeSingle();
    trajet = (data as typeof trajet) ?? null;
  }

  const numero = trajet?.numero_mission ?? "Mission";
  const retard = formatMin(delayMinutes);
  const eta = new Date(etaAt).toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
  const trajetLabel = [trajet?.depart, trajet?.arrivee].filter(Boolean).join(" → ");

  // 1) Client — email
  if (trajet?.client_email) {
    try {
      await sendRawEmailServer({
        to: trajet.client_email,
        subject: `${numero} · nouvelle heure d'arrivée estimée ${eta}`,
        label: "mission_delay_alert",
        idempotencyKey: `delay-${attributionId}-${Math.round(delayMinutes)}`,
        html: `
          <div style="font-family:Helvetica,Arial,sans-serif;color:#061238;line-height:1.6">
            <p>Bonjour${trajet.client_nom ? ` ${trajet.client_nom}` : ""},</p>
            <p>Le convoyage <strong>${numero}</strong>${trajetLabel ? ` (${trajetLabel})` : ""} accuse
            un retard estimé de <strong>${retard}</strong> sur l'horaire prévu.</p>
            <p>Nouvelle heure d'arrivée estimée : <strong>${eta}</strong>.</p>
            <p>Vous pouvez suivre la position du véhicule en temps réel depuis votre espace client.</p>
            <p style="color:#5b6688;font-size:13px">Transports Ligneo</p>
          </div>`,
        text: `${numero} : retard estimé ${retard}. Nouvelle arrivée estimée ${eta}.`,
      });
    } catch (e) {
      console.error("[delay-alert] email client échoué", e);
    }
  }

  // 2) Client — SMS
  if (trajet?.client_telephone) {
    try {
      const { sendSms } = await import("@/lib/sms.server");
      await sendSms({
        to: trajet.client_telephone,
        from: "LIGNEO",
        body: `Transports Ligneo — ${numero} : retard estime ${retard}. Arrivee estimee ${eta}.`,
      });
    } catch (e) {
      console.error("[delay-alert] SMS client échoué", e);
    }
  }

  // 3) Notification interne admin
  try {
    await supabaseAdmin.from("admin_notifications").insert({
      type: "driver_action",
      titre: `Retard ${retard} · ${numero}`,
      message: `${trajetLabel || "Mission en cours"} — nouvelle arrivée estimée ${eta}. Anticiper un appel client.`,
      link: `/admin/missions/${attributionId}`,
      entity_type: "attribution",
      entity_id: attributionId,
      metadata: { delay_minutes: Math.round(delayMinutes), eta_at: etaAt },
    } as never);
  } catch (e) {
    console.error("[delay-alert] notification admin échouée", e);
  }
}
