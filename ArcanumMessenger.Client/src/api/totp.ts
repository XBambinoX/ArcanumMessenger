const API_PORT = window.location.protocol === "https:" ? 7039 : 5135;
const API_BASE = `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;

/**
 * Stopgap: there is no auth/session cookie yet, so the server has no way to
 * know "who's calling" on its own. Until that lands, startTotpSetup takes a
 * userId directly and the server trusts it. This is NOT safe once real
 * users are involved — anyone could enable 2FA for any account — and must
 * be replaced by reading the current user from the session once that
 * exists.
 *
 *   POST /api/totp/start { userId } -> { success, sessionId?, secret?, otpauthUri?, reason? }
 *     Generates a fresh random TOTP secret (base32) and an otpauth:// URI.
 *     The secret lives in a short-lived server-side session (sessionId),
 *     same idea as RegistrationSession/LoginSession — nothing is written to
 *     the user's row until /confirm succeeds, so an abandoned setup never
 *     half-enables 2FA.
 *
 *   POST /api/totp/confirm { sessionId, code } -> { success, reason? }
 *     Verifies the 6-digit code against the secret from /start. Only on
 *     success does it persist TwoFactorSecretEnc + TwoFactorEnabled = true
 *     on the user (encrypted, same DEK pattern as the other profile
 *     fields).
 */
export async function startTotpSetup(userId: string): Promise<{
    success: boolean;
    sessionId?: string;
    secret?: string;
    otpauthUri?: string;
    reason?: string;
}> {
    const res = await fetch(`${API_BASE}/api/totp/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}

export async function confirmTotpSetup(
    sessionId: string,
    code: string,
): Promise<{
    success: boolean;
    reason?: string;
}> {
    const res = await fetch(`${API_BASE}/api/totp/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}
