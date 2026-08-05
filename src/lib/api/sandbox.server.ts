/**
 * Environnement sandbox de l'API Développeur.
 *
 * Les clés `sk_test_…` n'écrivent aucune mission réelle et n'attribuent aucun
 * convoyeur : les réponses sont générées de façon déterministe à partir des
 * identifiants, avec les mêmes formats et des délais simulés.
 *
 * Server-only.
 */
import { createHash } from "node:crypto";

/** Petit hash déterministe → entier positif, pour des réponses stables par id. */
function seed(id: string): number {
  return parseInt(createHash("sha256").update(id).digest("hex").slice(0, 8), 16);
}

export function sandboxId(prefix: string, source: string): string {
  return `${prefix}_test_${createHash("sha256").update(source).digest("hex").slice(0, 12)}`;
}

/** Délai simulé pour reproduire la latence de la production. */
export function sandboxDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 120));
}

const SANDBOX_STATUSES = ["pending", "assigned", "in_transit", "delivered"] as const;

export function sandboxMission(missionId: string, extra?: Record<string, unknown>) {
  const s = seed(missionId);
  const status = SANDBOX_STATUSES[s % SANDBOX_STATUSES.length] ?? "pending";
  return {
    id: missionId,
    object: "mission",
    livemode: false,
    status,
    reference: `MIS-TEST-${(s % 9000) + 1000}`,
    pickup_address: "12 rue de la Paix, 75002 Paris",
    delivery_address: "45 av. Jean Jaurès, 69007 Lyon",
    vehicle_plate: "AA-123-BB",
    price_ht: 285,
    price_ttc: 342,
    currency: "EUR",
    created_at: new Date().toISOString(),
    ...extra,
  };
}

export function sandboxTracking(missionId: string) {
  const s = seed(missionId);
  const progress = s % 100;
  return {
    mission_id: missionId,
    status: progress >= 100 ? "delivered" : progress > 5 ? "in_transit" : "assigned",
    livemode: false,
    driver: { name: "Karim B.", phone: "+33 6 ** ** ** 12" },
    current_location: { lat: 46.603354, lng: 1.888334 },
    progress_percent: progress,
    eta: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    history: [
      { step: "assigned", at: new Date(Date.now() - 7200 * 1000).toISOString() },
      { step: "started", at: new Date(Date.now() - 5400 * 1000).toISOString() },
    ],
  };
}
