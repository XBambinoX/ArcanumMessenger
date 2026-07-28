import { apiFetch } from "../lib/apiFetch";
import type { User, UserSearchResult } from "../types/messenger";

function toUser(data: {
    success: boolean;
    name: string | null;
    id: string | null;
    lastSeen: string | null;
    bio: string | null;
    email: string | null;
    phone: string | null;
    isContact: boolean;
    isBlocked: boolean;
    isBlockedByOther: boolean;
}): User | null {
    if (!data.success || data.name === null || data.id === null) return null;
    return {
        name: data.name,
        publicId: data.id,
        lastSeen: data.lastSeen,
        bio: data.bio,
        email: data.email,
        phone: data.phone,
        isContact: data.isContact,
        isBlocked: data.isBlocked,
        isBlockedByOther: data.isBlockedByOther,
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

export interface UserPresence {
    isOnline: boolean;
    lastSeen: string | null;
}

export async function getUserPresence(userId: string): Promise<UserPresence | null> {
    const res = await apiFetch(`/api/users/${userId}/presence`);
    if (!res.ok) return null;
    const data = await res.json();
    return { isOnline: data.isOnline, lastSeen: data.lastSeen };
}

export interface BulkPresenceItem {
    userId: string;
    isOnline: boolean;
    lastSeen: string | null;
}

export async function getPresenceBulk(userIds: string[]): Promise<BulkPresenceItem[]> {
    if (userIds.length === 0) return [];

    const res = await apiFetch("/api/users/presence/bulk", {
        method: "POST",
        body: JSON.stringify({ userIds }),
    });

    if (!res.ok) return [];

    const data = await res.json();
    return data.items.map((item: any) => ({
        userId: item.userId,
        isOnline: item.isOnline,
        lastSeen: item.lastSeen,
    }));
}