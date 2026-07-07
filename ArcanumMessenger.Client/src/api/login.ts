// Kestrel serves HTTP on 5135 and HTTPS on 7039. If the page itself was
// loaded over HTTPS, the browser blocks plain-HTTP fetches from it (mixed
// content), so we have to follow the same protocol for the API too.
const API_PORT = window.location.protocol === "https:" ? 7039 : 5135;
const API_BASE = `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;

export async function startLogin(email: string): Promise<{
    success: boolean;
    sessionId?: string;
    kdfSalt?: string;
    reason?: string;
}> {
    const res = await fetch(`${API_BASE}/api/login/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
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
    const res = await fetch(`${API_BASE}/api/login/loginPassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, authKey }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}

export async function submitLoginTotp(
    sessionId: string,
    code: string,
): Promise<{
    success: boolean;
    reason?: string;
}> {
    const res = await fetch(`${API_BASE}/api/login/loginTotp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}
