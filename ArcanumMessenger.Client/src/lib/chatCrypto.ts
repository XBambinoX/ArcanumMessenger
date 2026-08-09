import { encryptContent, decryptContent } from "../crypto/chatKey";
import { unwrapOwnChatKey } from "./chatKeys";
import type { ChatMessage, ChatSummary, SavedGifEntry } from "../types/messenger";

/**
 * Encrypts/decrypts message content client-side using a chat's own
 * symmetric key - the server only ever stores/relays the ciphertext blob.
 * Only `system` messages (server-generated metadata, not user content) skip
 * this; everything else's `content` (text, and image/video/gif/file
 * captions) goes through here before it's sent or rendered.
 */

interface KeyedChat {
    id: string;
    wrappedChatKey: string | null;
}

// Unwrapping is a bit of asymmetric-crypto work, not worth repeating for
// every message in a chat - cached in memory per chat id for the tab's
// lifetime. `null` is cached too (no key yet), so a chat stuck without one
// doesn't retry the unwrap on every single message.
const keyCache = new Map<string, Uint8Array | null>();

// Exported for the media upload/download flow (chatMediaCrypto.ts) - media
// bytes are encrypted with the same chat key as text, they just don't go
// through encryptOutgoing/decryptText since they aren't a single string.
export async function getChatKey(chat: KeyedChat): Promise<Uint8Array | null> {
    if (keyCache.has(chat.id)) return keyCache.get(chat.id)!;
    const key = chat.wrappedChatKey ? await unwrapOwnChatKey(chat.wrappedChatKey) : null;
    keyCache.set(chat.id, key);
    return key;
}

// Call after a chat's WrappedChatKey changes (e.g. just got (re)provisioned)
// so the next read/write picks up the new key instead of a stale null.
export function invalidateChatKey(chatId: string): void {
    keyCache.delete(chatId);
}

// Lets a caller that just generated a chat's key firsthand (bootstrapping
// one where nobody had one yet) make it usable immediately, without waiting
// for a stale wrappedChatKey prop to refresh from the server.
export function primeChatKey(chatId: string, key: Uint8Array): void {
    keyCache.set(chatId, key);
}

// Returns null if this chat has no usable key yet - callers must not send
// unencrypted content as a fallback; there's simply nothing safe to send.
export async function encryptOutgoing(chat: KeyedChat, plaintext: string): Promise<string | null> {
    const key = await getChatKey(chat);
    if (!key) return null;
    return encryptContent(key, chat.id, plaintext);
}

// Decrypts one ciphertext blob under a chat's key. Used directly wherever
// only a bare content string is available (e.g. a chat list's last-message
// preview), and by decryptIncoming below for full message objects.
export async function decryptText(chat: KeyedChat, ciphertext: string): Promise<string> {
    const key = await getChatKey(chat);
    if (!key) return ciphertext;

    try {
        return await decryptContent(key, chat.id, ciphertext);
    } catch {
        // Wrong/stale key, corruption, or tampering - fail closed rather than
        // show ciphertext or throw and break the whole message list.
        return "[unable to decrypt]";
    }
}

export async function decryptIncoming(chat: KeyedChat, message: ChatMessage): Promise<ChatMessage> {
    if (message.type === "system") return message;

    const content = message.content ? await decryptText(chat, message.content) : message.content;
    const media = message.media
        ? { ...message.media, fileName: await decryptText(chat, message.media.fileName) }
        : message.media;

    return { ...message, content, media };
}

export async function decryptIncomingList(chat: KeyedChat, messages: ChatMessage[]): Promise<ChatMessage[]> {
    return Promise.all(messages.map((m) => decryptIncoming(chat, m)));
}

// Same "system"/empty-content skip as decryptIncoming, for a chat list's
// last-message preview where only the bare text and type are on hand.
export async function decryptLastMessagePreview(
    chat: KeyedChat,
    lastMessageText: string | null,
    lastMessageType: string | null,
): Promise<string | null> {
    if (!lastMessageText || lastMessageType === "system") return lastMessageText;
    return decryptText(chat, lastMessageText);
}

// A group's title is ciphertext under its own chat key (see
// NewChatPanel.tsx) - direct/saved chats already get a real display name
// from the server (the other member's name, or "Saved Messages"), so this
// is a no-op for anything but a group. Falls back to a literal "Untitled
// group" - not decryptText's generic "[unable to decrypt]" - whenever
// there's no key yet (a freshly-added member before self-heal catches up)
// or decryption fails outright (pre-encryption dev data, tampering).
export async function decryptChatTitle(chat: ChatSummary): Promise<ChatSummary> {
    if (chat.type !== "group") return chat;

    const key = await getChatKey({ id: chat.id, wrappedChatKey: chat.wrappedChatKey });
    if (!key) return { ...chat, title: "Untitled group" };

    try {
        const title = await decryptContent(key, chat.id, chat.title);
        return { ...chat, title };
    } catch {
        return { ...chat, title: "Untitled group" };
    }
}

// Saved GIFs are fetched through their own endpoint, not decryptIncoming -
// each entry's file name is ciphertext under the caller's Saved Messages
// chat key (what the saved copy is actually encrypted with), not whatever
// chat it was originally saved from.
export async function decryptSavedGifEntries(
    savedChat: KeyedChat,
    entries: SavedGifEntry[],
): Promise<SavedGifEntry[]> {
    return Promise.all(entries.map(async (entry) => ({
        ...entry,
        media: { ...entry.media, fileName: await decryptText(savedChat, entry.media.fileName) },
    })));
}
