const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5173";

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
    if (!res.ok) throw new Error("Network error");
    return res.json();
}

export async function submitEmail(
    sessionId: string,
    email: string,
    emailVisibilityConsent: boolean
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, email, emailVisibilityConsent }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
}

export async function verifyCode(
    sessionId: string,
    code: string
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, code }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
}

export async function resendCode(
    sessionId: string
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
}

export async function submitPassword(
    sessionId: string,
    password: string
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, password }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
}

export async function generateRecovery(
    sessionId: string
): Promise<{ success: boolean; phrase1?: string; phrase2?: string; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/recovery/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
}

export async function confirmRecovery(
    sessionId: string
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/recovery/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
}

export async function finalizeRegistration(
    sessionId: string
): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/register/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) throw new Error("Network error");
    return res.json();
}