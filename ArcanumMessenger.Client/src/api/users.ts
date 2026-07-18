import { apiFetch } from "../lib/apiFetch";
import type { User } from "../types/messenger";

export async function getCurrentUser(): Promise<User | null> {
    const res = await apiFetch("/api/users/me", { credentials: "include" });
    const data = await res.json();
    if (!data.success) return null;

    return { name: data.name, publicId: data.id, lastSeen: data.lastSeen };
}
