import { test, expect } from "bun:test";
import { groupedPrestationLabel } from "./devis-groupe-types";

test("devis groupé mixte : livraison simple et livraison + restitution", () => {
  const msg = "Véhicule 1 : RENAULT MASTER (HM-741-EK)\nVéhicule 2 : RENAULT 5 (HL-673-KT) · Retour : RENAULT ZOE (GA-425-BJ)";
  expect(groupedPrestationLabel([{}, {}], msg)).toBe("Livraison simple (1) · Livraison + restitution (1)");
});
