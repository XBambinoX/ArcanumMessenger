import { apiFetch } from "../lib/apiFetch";
import * as sessionKeys from "../lib/sessionKeys";

export async function checkSession(): Promise<{ success: boolean; userId?: string }> {
    const res = await apiFetch("/api/auth/me", { credentials: "include" });
    return res.json();
}

export async function refreshSession(): Promise<{ success: boolean; reason?: string }> {
    const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
    });
    return res.json();
}

export async function logout(): Promise<void> {
    await apiFetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
    });
    sessionKeys.clearIdentity();
}