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
    mediaId?: string,
    asGif?: boolean,
    replyToId?: string | null,
): Promise<ChatMessage | null> {
    const res = await apiFetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ content, replyToId: replyToId ?? null, mediaId: mediaId ?? null, asGif: asGif ?? false }),
    });
    const data = await res.json();
    return data.success ? data.message : null;
}

export async function deleteMessage(chatId: string, messageId: string): Promise<boolean> {
    const res = await apiFetch(`/api/chats/${chatId}/messages/${messageId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}
