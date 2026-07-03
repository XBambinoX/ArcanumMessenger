const API_BASE = `${window.location.protocol}//${window.location.hostname}:5135`;

export async function startRegistration(username: string): Promise<{
    success: boolean;
    sessionId?: string;
    reason?: string;
}> {
    const res = await fetch(`${API_BASE}/api/auth/register/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}

export async function submitEmail(
    sessionId: string,
    email: string,
    emailVisibilityConsent: boolean,
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email, emailVisibilityConsent }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}

export async function verifyCode(
    sessionId: string,
    code: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}

export async function resendCode(
    sessionId: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}

// The plain password never leaves the client: we send an Argon2id-derived
// authKey plus the salt used to derive it (the server needs it again at login).
export async function submitPassword(
    sessionId: string,
    authKey: string,
    kdfSalt: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, authKey, kdfSalt }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}

// Recovery phrases are generated on the client; only their SHA-256 hashes are sent.
export async function confirmRecovery(
    sessionId: string,
    phrase1Auth: string,
    phrase2Auth: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/recovery/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, phrase1Auth, phrase2Auth }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}

export async function finalizeRegistration(
    sessionId: string,
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
    });
    if (res.status >= 500) throw new Error("Server error, try again later");
    return res.json();
}
