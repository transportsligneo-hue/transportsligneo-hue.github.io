import { describe, expect, it } from "bun:test";
import { devisGlobalStatut, lignePrix, parseLigneType, totalLignes } from "./devis-lots";

const L = (type_ligne, prix_aller, prix_retour = 0, statut = "a_valider") => ({ type_ligne, prix_aller, prix_retour, statut });

describe("devis groupés par lots", () => {
  it("additionne aller et retour uniquement pour restitution et livraison", () => {
    expect(lignePrix(L("livraison_restitution", 70, 50))).toBe(120);
    expect(lignePrix(L("aller_simple", 70, 50))).toBe(70);
  });

  it("totalise un devis mélangé de 6 lignes", () => {
    const lignes = [L("aller_simple", 80), L("aller_simple", 90), L("livraison_simple", 60), L("livraison_simple", 65), L("livraison_restitution", 70, 50), L("livraison_restitution", 100, 75)];
    expect(totalLignes(lignes)).toBe(590);
  });

  it("passe de À valider à partiel puis entièrement validé", () => {
    expect(devisGlobalStatut([L("aller_simple", 1), L("aller_simple", 1)])).toBe("a_valider");
    expect(devisGlobalStatut([L("aller_simple", 1, 0, "validee"), L("aller_simple", 1)])).toBe("partiel");
    expect(devisGlobalStatut([L("aller_simple", 1, 0, "validee")])).toBe("complet");
    expect(devisGlobalStatut([L("aller_simple", 1)], "2020-01-01", new Date("2026-01-01"))).toBe("expire");
  });

  it("reconnaît le type importé et met Aller simple par défaut", () => {
    expect(parseLigneType("restitution et livraison")).toBe("livraison_restitution");
    expect(parseLigneType("Livraison et restitution")).toBe("livraison_restitution");
    expect(parseLigneType("Livraison + restitution")).toBe("livraison_restitution");
    expect(parseLigneType("aller-retour")).toBe("livraison_restitution");
    expect(parseLigneType("livraison simple")).toBe("livraison_simple");
    expect(parseLigneType("")).toBe("aller_simple");
  });
});
