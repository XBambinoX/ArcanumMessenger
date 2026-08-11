import { apiFetch } from "../lib/apiFetch";
import type { ChatMessage, ChatReadState, MediaAsset } from "../types/messenger";

export interface MessageHistoryResult {
    messages: ChatMessage[];
    hasMore: boolean;
    readStates: ChatReadState[];
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
    return { messages: data.messages ?? [], hasMore: data.hasMore ?? false, readStates: data.readStates ?? [] };
}

export async function sendMessage(
    chatId: string,
    content: string,
    mediaId?: string,
    asGif?: boolean,
    replyToId?: string | null,
    asVideoNote?: boolean,
): Promise<ChatMessage | null> {
    const res = await apiFetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
            content,
            replyToId: replyToId ?? null,
            mediaId: mediaId ?? null,
            asGif: asGif ?? false,
            asVideoNote: asVideoNote ?? false,
        }),
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

export async function editMessage(chatId: string, messageId: string, content: string): Promise<ChatMessage | null> {
    const res = await apiFetch(`/api/chats/${chatId}/messages/${messageId}`, {
        method: "PUT",
        credentials: "include",
        body: JSON.stringify({ content }),
    });
    const data = await res.json();
    return data.success ? data.message : null;
}

export interface ChatMediaItem {
    messageId: string;
    createdAt: string;
    media: MediaAsset;
}

export interface ChatMediaResult {
    items: ChatMediaItem[];
    hasMore: boolean;
}

export async function getChatMedia(
    chatId: string,
    before?: string,
    kind?: "media" | "gif",
): Promise<ChatMediaResult> {
    const params = new URLSearchParams();
    if (before) params.set("before", before);
    if (kind) params.set("kind", kind);
    const query = params.toString();
    const res = await apiFetch(`/api/chats/${chatId}/messages/media${query ? `?${query}` : ""}`, {
        credentials: "include",
    });
    const data = await res.json();
    return { items: data.items ?? [], hasMore: data.hasMore ?? false };
}

export interface ChatStats {
    messageCount: number;
    mediaCount: number;
}

export async function getChatStats(chatId: string): Promise<ChatStats | null> {
    const res = await apiFetch(`/api/chats/${chatId}/messages/stats`, {
        credentials: "include",
    });
    const data = await res.json();
    return data.success ? { messageCount: data.messageCount ?? 0, mediaCount: data.mediaCount ?? 0 } : null;
}

export interface ForwardItem {
    sourceMessageId: string;
    encryptedContent: string;
    newMediaId?: string;
}

// Forwarding across chats with different keys can't happen server-side under
// E2EE - the caller already decrypted each source message to render it, and
// re-encrypts it under the destination chat's key before this call.
export async function forwardMessages(
    targetChatId: string,
    items: ForwardItem[],
): Promise<ChatMessage[] | null> {
    const res = await apiFetch(`/api/chats/${targetChatId}/messages/forward`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ items }),
    });
    const data = await res.json();
    return data.success ? data.messages : null;
}
