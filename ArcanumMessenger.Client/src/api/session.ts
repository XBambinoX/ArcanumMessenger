// Kestrel serves HTTP on 5135 and HTTPS on 7039. If the page itself was
// loaded over HTTPS, the browser blocks plain-HTTP fetches from it (mixed
// content), so we have to follow the same protocol for the API too.
const API_PORT = window.location.protocol === "https:" ? 7039 : 5135;
const API_BASE = `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;

export async function checkSession(): Promise<{ success: boolean; userId?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
    if (!res.ok) return { success: false };
    return res.json();
}

export async function refreshSession(): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
    });
    return res.json();
}

export async function logout(): Promise<void> {
    await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
    });
}