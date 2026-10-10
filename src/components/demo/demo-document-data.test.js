import { test, expect } from "bun:test";
import { demoDocumentData, demoAmounts } from "./demo-document-data";

test("documents démo : identité fictive, jamais celle du compte invité", () => {
  const data = demoDocumentData({ numero: "MIS-DEMO", prix_total: 230, client_user_id: "real-user", email: "real-client@company.fr", nom: "Real", ville_depart: "Tours", ville_arrivee: "Nantes" });
  expect(data.email).toBe("claire.martin@example.invalid");
  expect(data.nom).toBe("Martin");
  expect(data).not.toHaveProperty("client_user_id");
  expect(data).not.toHaveProperty("user_id");
});

test("montants démo : centimes conservés et TVA conforme au régime fourni", () => {
  expect(demoAmounts(230, 20)).toEqual({ ttc: 230, ht: 191.67, tva: 38.33 });
  expect(demoAmounts(230, 0)).toEqual({ ttc: 230, ht: 230, tva: 0 });
});