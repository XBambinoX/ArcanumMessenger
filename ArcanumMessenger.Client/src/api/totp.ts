import { apiFetch } from "../lib/apiFetch";

export async function startTotpSetup(): Promise<{
    success: boolean;
    sessionId?: string;
    secret?: string;
    otpauthUri?: string;
    reason?: string;
}> {
    const res = await apiFetch("/api/totp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
    });
    return res.json();
}

export async function confirmTotpSetup(
    sessionId: string,
    code: string,
): Promise<{
    success: boolean;
    reason?: string;
}> {
    const res = await apiFetch("/api/totp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, code }),
    });
    return res.json();
}
