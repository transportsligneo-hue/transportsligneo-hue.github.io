import { test, expect } from "bun:test";
import { formatSivPlate, displayPlate, plateValidity } from "./plate-format.ts";

test("FG482KL devient FG-482-KL", () => {
  expect(formatSivPlate("fg482kl")).toBe("FG-482-KL");
});
test("caractères interdits ignorés", () => {
  expect(formatSivPlate("fg 48*2kl")).toBe("FG-482-KL");
});
test("ancienne plaque reconnue sans blocage", () => {
  expect(plateValidity("123 ABC 45")).toBe("legacy");
});
test("format inconnu signalé", () => {
  expect(plateValidity("ZZZZ")).toBe("invalid");
});
test("affichage normalisé", () => {
  expect(displayPlate("fg482kl")).toBe("FG-482-KL");
});
