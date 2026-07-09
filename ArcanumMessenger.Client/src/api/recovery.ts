// Kestrel serves HTTP on 5135 and HTTPS on 7039. If the page itself was
// loaded over HTTPS, the browser blocks plain-HTTP fetches from it (mixed
// content), so we have to follow the same protocol for the API too.
const API_PORT = window.location.protocol === "https:" ? 7039 : 5135;
const API_BASE = `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;

export async function startRecovery(
    email: string
): Promise<{ success: boolean; sessionId?: string; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/recovery/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
}

export async function verifyRecovery(
    sessionId: string,
    email: string,
    phraseAuth: string
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/recovery/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email, phraseAuth }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
}

export async function resetPassword(
    sessionId: string,
    authKey: string,
    kdfSalt: string
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/recovery/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, authKey, kdfSalt }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
}