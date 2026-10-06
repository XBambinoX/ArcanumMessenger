import { ApiError, apiFetch } from "../lib/apiFetch";
import type { ChatMessage, ChatReadState, MediaAsset, MessageReaction } from "../types/messenger";

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

// Throws on an error instead of reading it as "no more messages", so an export can't silently come out cut short.
export async function getExportHistoryPage(
    chatId: string,
    before: string | null,
    signal: AbortSignal,
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const params = new URLSearchParams({ take: "100" });
    if (before) params.set("before", before);
    const res = await apiFetch(`/api/chats/${chatId}/messages?${params}`, {
        credentials: "include",
        signal,
    });
    if (!res.ok) throw new ApiError(res.status, `history page failed: ${res.status}`);
    const data = await res.json();
    return { messages: data.messages ?? [], hasMore: data.hasMore ?? false };
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

// Adds one more copy of this emoji to the caller's own reactions on this
// message - one person can stack the same emoji more than once, up to a
// per-person cap enforced server-side.
export async function addReaction(
    chatId: string,
    messageId: string,
    emoji: string,
): Promise<MessageReaction[] | null> {
    const res = await apiFetch(`/api/chats/${chatId}/messages/${messageId}/reactions`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ emoji }),
    });
    const data = await res.json();
    return data.success ? data.reactions ?? [] : null;
}

// Removes exactly one copy of this emoji from the caller's own reactions
// on this message.
export async function removeReaction(
    chatId: string,
    messageId: string,
    emoji: string,
): Promise<MessageReaction[] | null> {
    const res = await apiFetch(`/api/chats/${chatId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    return data.success ? data.reactions ?? [] : null;
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
