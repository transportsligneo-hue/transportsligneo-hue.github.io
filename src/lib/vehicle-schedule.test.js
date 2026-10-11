import { test, expect } from "bun:test";
import { dueTone, firstTechnicalControl, nextRevision, annualCost } from "./vehicle-schedule.ts";

test("premier contrôle technique 4 ans après mise en circulation", () => {
  expect(firstTechnicalControl("2022-03-15")).toBe("2026-03-15");
});
test("badges d'échéance : rose à 30 jours ou moins, violet 31 à 60, rouge expiré", () => {
  expect(dueTone(30)).toBe("urgent");
  expect(dueTone(45)).toBe("soon");
  expect(dueTone(61)).toBe("ok");
  expect(dueTone(-1)).toBe("late");
});
test("prochaine révision au kilométrage", () => {
  const r = nextRevision({ lastDate: null, lastKm: 40000, currentKm: 52000, intervalKm: 15000, intervalMonths: 12, kmPerMonth: 1500, now: new Date("2026-01-01") });
  expect(r.nextKm).toBe(55000);
  expect(r.remainingKm).toBe(3000);
});
test("coût annuel = loyer x 12 + assurance + entretien", () => {
  expect(annualCost(400, 900, 600)).toBe(6300);
});
