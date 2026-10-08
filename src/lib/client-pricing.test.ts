import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_RECHARGE_SURCHARGE,
  computeOptionSupplements,
  normalizeDeliveryRechargeSurcharge,
} from "./client-pricing";

describe("delivery electric recharge surcharge", () => {
  it("uses the requested 25 euro default", () => {
    expect(DEFAULT_DELIVERY_RECHARGE_SURCHARGE).toBe(25);
    expect(normalizeDeliveryRechargeSurcharge(undefined)).toBe(25);
  });

  it("adds only the configured delivery recharge surcharge", () => {
    expect(computeOptionSupplements(
      { recharge_electrique_livraison: 31.5 },
      { recharge_electrique_livraison: true },
    )).toEqual({
      total: 31.5,
      lines: [{
        key: "recharge_electrique_livraison",
        label: "Recharge électrique pour livraison",
        amount: 31.5,
      }],
    });
  });

  it("does not change the existing trip recharge amount", () => {
    expect(computeOptionSupplements(
      { recharge_electrique: 18, recharge_electrique_livraison: 25 },
      { recharge_electrique: true },
    ).total).toBe(18);
  });
});