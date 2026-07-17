import { apiFetch } from "../lib/apiFetch";
import type { ChatMessage } from "../types/messenger";

export interface MessageHistoryResult {
    messages: ChatMessage[];
    hasMore: boolean;
}

export async function getMessageHistory(
    chatId: string,
    before?: string,
): Promise<MessageHistoryResult> {
    const params = before ? `?before=${before}` : "";
    const res = await apiFetch(`/api/chats/${chatId}/messages${params}`, {
        credentials: "include",
    });
    const data = await res.json();
    return { messages: data.messages ?? [], hasMore: data.hasMore ?? false };
}

export async function sendMessage(
    chatId: string,
    content: string,
): Promise<ChatMessage | null> {
    const res = await apiFetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ content, replyToId: null }),
    });
    const data = await res.json();
    return data.success ? data.message : null;
}
