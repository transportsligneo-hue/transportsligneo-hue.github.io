/** Grants cannot predate the current security configuration. */
export function isUserMfaSessionValid(
  session: { verified_at: string; expires_at: string } | null,
  settingsUpdatedAt: string,
  now = Date.now(),
): boolean {
  if (!session) return false;
  const verifiedAt = Date.parse(session.verified_at);
  const expiresAt = Date.parse(session.expires_at);
  const updatedAt = Date.parse(settingsUpdatedAt);
  return Number.isFinite(verifiedAt) && Number.isFinite(updatedAt)
    && verifiedAt >= updatedAt && expiresAt > now;
}