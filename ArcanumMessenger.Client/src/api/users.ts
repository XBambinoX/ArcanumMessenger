import { apiFetch } from "../lib/apiFetch";
import type { User, UserSearchResult } from "../types/messenger";

function toUser(data: {
    success: boolean;
    name: string | null;
    id: string | null;
    lastSeen: string | null;
    publicBio: string | null;
    publicEmail: string | null;
    publicPhone: string | null;
    isContact: boolean;
}): User | null {
    if (!data.success || data.name === null || data.id === null) return null;
    return {
        name: data.name,
        publicId: data.id,
        lastSeen: data.lastSeen,
        bio: data.publicBio,
        email: data.publicEmail,
        phone: data.publicPhone,
        isContact: data.isContact,
    };
}

export async function getMe(): Promise<User | null> {
    const res = await apiFetch("/api/users/me", { credentials: "include" });
    return toUser(await res.json());
}

export async function getUser(id: string): Promise<User | null> {
    const res = await apiFetch(`/api/users/${id}`, { credentials: "include" });
    return toUser(await res.json());
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
    const res = await apiFetch(`/api/users/search?query=${encodeURIComponent(query)}`, {
        credentials: "include",
    });
    const data = await res.json();
    return data.success ? (data.results ?? []) : [];
}
