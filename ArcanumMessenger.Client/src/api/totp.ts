const API_PORT = window.location.protocol === "https:" ? 7039 : 5135;
const API_BASE = `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;

/**
 * Expected on the server (not built yet — this is the contract this page
 * is written against):
 *
 *   POST /api/totp/start -> { success, secret?, otpauthUri?, reason? }
 *     Must be an authenticated request — the server reads "which user" from
 *     the session/auth cookie, never from anything the client sends.
 *     Generates a fresh random TOTP secret (base32) and an otpauth:// URI
 *     ("otpauth://totp/Arcanum:<username>?secret=...&issuer=Arcanum
 *     &algorithm=SHA1&digits=6&period=30"). Keep the secret in a short-lived
 *     server-side session (same idea as RegistrationSession/LoginSession) —
 *     don't write it to the user's row yet, so an abandoned setup never
 *     half-enables 2FA.
 *
 *   POST /api/totp/confirm { code } -> { success, reason? }
 *     Verifies the 6-digit code against the secret from /start. Only on
 *     success does it persist TwoFactorSecret + TwoFactorEnabled = true on
 *     UserSettings (encrypted, same DEK pattern as the other profile
 *     fields).
 */
export async function startTotpSetup(): Promise<{
    success: boolean;
    secret?: string;
    otpauthUri?: string;
    reason?: string;
}> {
    const res = await fetch(`${API_BASE}/api/totp/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}

export async function confirmTotpSetup(code: string): Promise<{
    success: boolean;
    reason?: string;
}> {
    const res = await fetch(`${API_BASE}/api/totp/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}
