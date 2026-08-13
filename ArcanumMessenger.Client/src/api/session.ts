import { apiFetch, refreshOnce } from "../lib/apiFetch";
import * as sessionKeys from "../lib/sessionKeys";

export async function checkSession(): Promise<{ success: boolean; userId?: string }> {
    const res = await apiFetch("/api/auth/me", { credentials: "include" });
    return res.json();
}

// Routed through apiFetch's own refreshOnce() rather than a separate
// fetch - this is called proactively (a keepalive timer, and a
// visibilitychange catch-up for when the timer got throttled in a
// backgrounded tab), and used to fire its own independent request that
// could race apiFetch's reactive 401-retry for the same single-use
// refresh-token cookie. Sharing the one guard makes that race
// impossible instead of just unlikely.
export async function refreshSession(): Promise<{ success: boolean; reason?: string }> {
    const res = await refreshOnce();
    return res.json();
}

export async function logout(): Promise<void> {
    await apiFetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
    });
    sessionKeys.clearIdentity();
}