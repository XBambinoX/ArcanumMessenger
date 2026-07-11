import { apiFetch } from "../lib/apiFetch";

export async function startRecovery(
    email: string
): Promise<{ success: boolean; sessionId?: string; reason?: string }> {
    const res = await apiFetch("/api/auth/recovery/start", {
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
    phraseAuth: string
): Promise<{ success: boolean; reason?: string }> {
    const res = await apiFetch("/api/auth/recovery/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, email, phraseAuth }),
    });
    return res.json();
}

export async function resetPassword(
    sessionId: string,
    authKey: string,
    kdfSalt: string
): Promise<{ success: boolean; reason?: string }> {
    const res = await apiFetch("/api/auth/recovery/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, authKey, kdfSalt }),
    });
    return res.json();
}