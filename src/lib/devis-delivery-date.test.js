import { test, expect } from "bun:test";
import { resolveDevisDeliverySchedule } from "./devis-delivery-date";

test("devis 120 : livraison le 21 octobre, indépendamment de l'enlèvement le 20", () => {
  expect(resolveDevisDeliverySchedule({ date_souhaitee: "2026-10-20", heure_souhaitee: "10:30", date_livraison: "2026-10-21", heure_livraison: "17:00" })).toEqual({ date: "2026-10-21", time: "17:00" });
});

test("sans date de livraison, ne pas reprendre la date d'enlèvement", () => {
  expect(resolveDevisDeliverySchedule({ date_souhaitee: "2026-10-20" })).toEqual({ date: null, time: null });
});