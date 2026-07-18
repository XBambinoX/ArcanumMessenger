import { apiFetch } from "../lib/apiFetch";
import type { ChatSummary } from "../types/messenger";

export async function getChats(): Promise<ChatSummary[]> {
    const res = await apiFetch("/api/chats", { credentials: "include" });
    const data = await res.json();
    return data.chats ?? [];
}

export async function createDirectChat(otherUserId: string): Promise<ChatSummary | null> {
    const res = await apiFetch("/api/chats", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ type: "direct", otherUserId }),
    });
    const data = await res.json();
    return data.success ? data.chat : null;
}

export async function markChatRead(chatId: string): Promise<void> {
    await apiFetch(`/api/chats/${chatId}/read`, {
        method: "POST",
        credentials: "include",
    });
}

export async function setChatArchived(chatId: string, isArchived: boolean): Promise<void> {
    await apiFetch(`/api/chats/${chatId}/archive`, {
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ isArchived }),
    });
}
