import { apiFetch } from "../lib/apiFetch";

export async function startRegistration(username: string): Promise<{
    success: boolean;
    sessionId?: string;
    reason?: string;
}> {
    const res = await apiFetch("/api/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
    });
    return res.json();
}

export async function submitEmail(
    sessionId: string,
    email: string,
    emailVisibilityConsent: boolean,
): Promise<{ success: boolean; reason?: string }> {
    const res = await apiFetch("/api/register/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, email, emailVisibilityConsent }),
    });
    return res.json();
}

export async function verifyCode(
    sessionId: string,
    code: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await apiFetch("/api/register/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, code }),
    });
    return res.json();
}

export async function resendCode(
    sessionId: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await apiFetch("/api/register/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
    });
    return res.json();
}

// The plain password never leaves the client: we send an Argon2id-derived
// authKey plus the salt used to derive it (the server needs it again at login).
// ecdhPublicKey/wrappedEcdhPrivateKey are this account's E2EE identity keypair,
// generated in the same step - the private key wrapped with encKey, unreadable
// to the server.
export async function submitPassword(
    sessionId: string,
    authKey: string,
    kdfSalt: string,
    ecdhPublicKey: string,
    wrappedEcdhPrivateKey: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await apiFetch("/api/register/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, authKey, kdfSalt, ecdhPublicKey, wrappedEcdhPrivateKey }),
    });
    return res.json();
}

// Recovery phrases are generated on the client; only their SHA-256 hashes are sent.
export async function confirmRecovery(
    sessionId: string,
    phrase1Auth: string,
    phrase2Auth: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await apiFetch("/api/register/recovery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, phrase1Auth, phrase2Auth }),
    });
    return res.json();
}

export async function finalizeRegistration(
    sessionId: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await apiFetch("/api/register/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
    });
    return res.json();
}
