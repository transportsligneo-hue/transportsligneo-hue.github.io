import { describe, expect, it } from "bun:test";
import { isUserMfaSessionValid } from "./user-mfa-policy";

describe("optional SMS session protection", () => {
  const verified_at = "2026-10-11T08:00:00Z";
  const expires_at = "2026-10-11T20:00:00Z";
  it("accepts verification within its 12 hour window", () => {
    expect(isUserMfaSessionValid({ verified_at, expires_at }, verified_at, Date.parse("2026-10-11T19:59:59Z"))).toBe(true);
  });
  it("requires another code after 12 hours", () => {
    expect(isUserMfaSessionValid({ verified_at, expires_at }, verified_at, Date.parse(expires_at))).toBe(false);
  });
  it("rejects verification from before reactivation", () => {
    expect(isUserMfaSessionValid({ verified_at, expires_at }, "2026-10-11T09:00:00Z", Date.parse("2026-10-11T10:00:00Z"))).toBe(false);
  });
  it("rejects missing verification", () => {
    expect(isUserMfaSessionValid(null, verified_at)).toBe(false);
  });
});