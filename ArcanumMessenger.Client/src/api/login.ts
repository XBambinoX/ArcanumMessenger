import { apiFetch } from "../lib/apiFetch";

export async function startLogin(email: string): Promise<{
    success: boolean;
    sessionId?: string;
    kdfSalt?: string;
    reason?: string;
}> {
    const res = await apiFetch("/api/login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
    });
    return res.json();
}

export async function submitLoginPassword(
    sessionId: string,
    authKey: string,
): Promise<{
    success: boolean;
    requiresTotp: boolean;
    reason?: string;
}> {
    const res = await apiFetch("/api/login/loginPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, authKey }),
    });
    return res.json();
}

export async function submitLoginTotp(
    sessionId: string,
    code: string,
): Promise<{
    success: boolean;
    reason?: string;
}> {
    const res = await apiFetch("/api/login/loginTotp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, code }),
    });
    return res.json();
}

export async function completeLogin(sessionId: string): Promise<{
    success: boolean;
    reason?: string;
    ecdhPublicKey?: string | null;
    wrappedEcdhPrivateKey?: string | null;
}> {
    const res = await apiFetch("/api/login/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
    });
    return res.json();
}