import { describe, expect, it } from "bun:test";
import { invoicePoNumber, invoiceSelectedOptions, invoiceSourceOptions, invoiceVehicles } from "./invoice-document-details";

describe("invoice selections and plates", () => {
  it("keeps the full CAT France PO when supplied", () => {
    expect(invoicePoNumber("450001234567890", "N° de PO")).toBe("450001234567890");
    expect(invoicePoNumber("MIS-TLG-2026-401", "Mission", "450001234567890")).toBe("450001234567890");
  });
  it("does not invent a PO for invoices without one", () => {
    expect(invoicePoNumber(null, null)).toBeNull();
    expect(invoicePoNumber("DEV-TLG-2026-120", "Devis")).toBeNull();
    expect(invoicePoNumber("MIS-TLG-2026-401", "Mission")).toBeNull();
    expect(invoicePoNumber("123456", "Référence dossier")).toBeNull();
  });
  it("includes selected electric recharge", () => {
    expect(invoiceSelectedOptions(["recharge_electrique"])).toEqual(["Recharge électrique"]);
    expect(invoiceSelectedOptions(null, "Options : Recharge électrique")).toEqual(["Recharge électrique"]);
  });
  it("includes selected handover", () => {
    expect(invoiceSelectedOptions(["mise_en_main"])).toEqual(["Mise en main"]);
    expect(invoiceSelectedOptions(null, "Options : Mise en main du véhicule")).toEqual(["Mise en main"]);
  });
  it("never adds either option when not selected", () => {
    expect(invoiceSelectedOptions([], "Options : Recharge électrique, Mise en main")).toEqual([]);
    expect(invoiceSelectedOptions(null, "Véhicule électrique avec câble de recharge")).toEqual([]);
    expect(invoiceSelectedOptions(invoiceSourceOptions({ options_meta: { recharge_electrique: false, mise_en_main: true } }))).toEqual(["Mise en main"]);
  });
  it("labels jockeyage services on the invoice", () => {
    expect(invoiceSelectedOptions(["jockey_controle_technique"])).toEqual(["Jockeyage : Contrôle technique"]);
    expect(invoiceSelectedOptions(["jockey_revision", "jockey_pneumatiques"])).toEqual(["Jockeyage : Révision / entretien constructeur", "Jockeyage : Pneumatiques (changement, permutation, saisonnier)"]);
    expect(invoiceSelectedOptions(invoiceSourceOptions({ options_meta: { jockey_garage: true, jockey_lavage: false } }))).toEqual(["Jockeyage : Dépôt ou récupération au garage"]);
    expect(invoiceSelectedOptions([], "Options : jockey_controle_technique")).toEqual([]);
  });
  it("keeps both grouped delivered and returned plates", () => {
    expect(invoiceVehicles({ vehicules: [{ immatriculation: "AB-123-CD", immatriculation_retour: "EF-456-GH" }] }).map((v) => v.immatriculation)).toEqual(["AB-123-CD", "EF-456-GH"]);
  });
});
import { invoiceDocumentName as docName } from "./invoice-document-details";
it("nom facture avec PO", () => {
  expect(docName("FAC-2026-0120", "CAT France", "4500987654")).toBe("#0120 - CAT FR - 4500987654");
});
it("nom facture sans PO", () => {
  expect(docName("FAC-2026-0121", "Jean Dupont", null)).toBe("#0121 - Jean Dupont");
});
