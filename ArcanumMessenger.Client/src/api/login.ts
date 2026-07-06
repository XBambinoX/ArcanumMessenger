const API_BASE = `${window.location.protocol}//${window.location.hostname}:5135`;

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
