import { describe, expect, it } from "bun:test";
import {
  groupedDestination,
  groupedResolverTrip,
  groupedStandardTrip,
  groupedTripLabel,
} from "./grouped-mission-type";

describe("grouped mission vehicle types", () => {
  it("keeps a simple delivery as a one-way trip", () => {
    expect(groupedTripLabel("aller-simple")).toBe("Livraison simple");
    expect(groupedResolverTrip("aller-simple")).toBe("aller");
  });

  it("prices delivery plus restitution as a round trip", () => {
    expect(groupedTripLabel("aller-retour")).toBe("restitution et livraison");
    expect(groupedResolverTrip("aller-retour")).toBe("aller_retour");
    expect(groupedStandardTrip("aller-retour")).toBe("aller_retour");
  });

  it("uses the pickup address for recharge-only vehicles", () => {
    expect(groupedTripLabel("recharge")).toBe("Recharge uniquement");
    expect(groupedDestination("recharge", "Tours", "Orléans")).toBe("Tours");
  });
});