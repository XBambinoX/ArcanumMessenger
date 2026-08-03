import { encryptContent, decryptContent } from "../crypto/chatKey";
import { unwrapOwnChatKey } from "./chatKeys";
import type { ChatMessage } from "../types/messenger";

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

async function getChatKey(chat: KeyedChat): Promise<Uint8Array | null> {
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
    if (message.type === "system" || !message.content) return message;
    const content = await decryptText(chat, message.content);
    return { ...message, content };
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
