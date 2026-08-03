import { apiFetch } from "../lib/apiFetch";

export async function startRecovery(
    email: string,
): Promise<{ success: boolean; sessionId?: string; reason?: string }> {
    const res = await apiFetch("/api/recovery/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
    });
    return res.json();
}

export async function verifyRecovery(
    sessionId: string,
    email: string,
    phraseAuth: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await apiFetch("/api/recovery/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, email, phraseAuth }),
    });
    return res.json();
}

// A password reset can't know the old password, so it can't recover the old
// encKey either - ecdhPublicKey/wrappedEcdhPrivateKey are a brand-new E2EE
// identity keypair, wrapped with the new encKey. The server invalidates this
// user's stale wrapped chat keys server-side once it sees a new public key.
export async function resetPassword(
    sessionId: string,
    authKey: string,
    kdfSalt: string,
    ecdhPublicKey: string,
    wrappedEcdhPrivateKey: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await apiFetch("/api/recovery/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, authKey, kdfSalt, ecdhPublicKey, wrappedEcdhPrivateKey }),
    });
    return res.json();
}
