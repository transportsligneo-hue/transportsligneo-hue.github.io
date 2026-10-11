import { describe, expect, it } from "bun:test";
import { invoiceSelectedOptions, invoiceSourceOptions, invoiceVehicles } from "./invoice-document-details";

describe("invoice selections and plates", () => {
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