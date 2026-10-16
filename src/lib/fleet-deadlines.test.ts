import { describe, expect, it } from "vitest";
import { computeFleetDeadlines } from "./fleet-deadlines";

const base = { id: "v", marque: null, modele: null, immatriculation: null, controle_technique_expire_le: null, assurance_expire_le: null, derniere_revision_le: null, intervalle_revision_mois: null };
const now = new Date(2026, 9, 16);

describe("échéances du parc", () => {
  it("garde un CT dépassé et l'affiche en premier", () => {
    const r = computeFleetDeadlines([{ ...base, id: "a", controle_technique_expire_le: "2026-11-01" }, { ...base, id: "b", controle_technique_expire_le: "2026-10-12" }], now);
    expect(r.map((d) => [d.vehicle.id, d.days])).toEqual([["b", -4], ["a", 16]]);
  });
  it("ignore les échéances au-delà de 60 jours", () => {
    expect(computeFleetDeadlines([{ ...base, controle_technique_expire_le: "2026-12-16" }], now)).toEqual([]);
  });
  it("calcule la révision à partir de la dernière révision + intervalle (12 mois par défaut)", () => {
    const r = computeFleetDeadlines([{ ...base, derniere_revision_le: "2025-11-01" }], now);
    expect(r[0]).toMatchObject({ kind: "revision", date: "2026-11-01", days: 16 });
  });
});
