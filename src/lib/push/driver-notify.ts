/**
 * Helper client (non bloquant) pour déclencher une notification convoyeur
 * depuis l'espace admin. N'échoue jamais : l'action métier reste prioritaire.
 */
import { notifyConvoyeurEvent } from "@/lib/push/driver-notify.functions";

export type DriverNotifyInput = {
  convoyeurId?: string | null;
  userId?: string | null;
  event:
    | "mission_proposee"
    | "mission_attribuee"
    | "mission_validee"
    | "mission_annulee"
    | "mission_modifiee"
    | "paiement_effectue"
    | "document_valide"
    | "document_refuse"
    | "compte_valide"
    | "message"
    | "test";
  attributionId?: string | null;
  trajetId?: string | null;
  title?: string | null;
  body?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  detail?: string | null;
};

export function notifyDriver(input: DriverNotifyInput) {
  void (async () => {
    try {
      await notifyConvoyeurEvent({ data: input as never });
    } catch (e) {
      console.warn("[notifyDriver] échec silencieux", e);
    }
  })();
}
