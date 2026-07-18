import { apiFetch } from "../lib/apiFetch";
import type { User } from "../types/messenger";

function toUser(data: {
    success: boolean;
    name: string | null;
    id: string | null;
    lastSeen: string | null;
}): User | null {
    if (!data.success || data.name === null || data.id === null) return null;
    // bio/email aren't returned by the server yet - see types/messenger.ts.
    return { name: data.name, publicId: data.id, lastSeen: data.lastSeen, bio: null, email: null };
}

export async function getCurrentUser(): Promise<User | null> {
    const res = await apiFetch("/api/users/me", { credentials: "include" });
    return toUser(await res.json());
}

export async function getUser(id: string): Promise<User | null> {
    const res = await apiFetch(`/api/users/${id}`, { credentials: "include" });
    return toUser(await res.json());
}
