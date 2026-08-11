// Client-side shapes for the messenger. They mirror the server entities
// (Chat, ChatMember, Message) so the pages are built against the real
// future data shape - only the fields a chat list / chat window actually
// renders, in camelCase like every other API response.

export type ChatType = "direct" | "group" | "saved";

// Fixed categories, not user-defined folders. "unread" is computed from
// unreadCount, "archive" maps to ChatMember.IsArchived on the server.
export type ChatFolder = "all" | "unread" | "archive";

export interface ChatSummary {
    id: string;
    type: ChatType;
    title: string;
    lastMessageText: string | null;
    lastMessageAt: string | null; // ISO timestamp
    unreadCount: number;
    isMuted: boolean;
    isArchived: boolean;
    otherUserId: string | null; // the other member's real id, direct chats only
    isBlocked: boolean; // blocked either way with the other member, direct chats only
    // This device's own copy of the chat's symmetric key, sealed to its
    // identity public key - null means it still needs (re)provisioning.
    wrappedChatKey: string | null;
    // Type of the message lastMessageText came from - "system" (or null,
    // no last message) means it's plain text, never ciphertext.
    lastMessageType: MessageType | null;
}

export type MessageType = "text" | "image" | "video" | "gif" | "audio" | "file" | "system";

export interface MediaAsset {
    id: string;
    kind: "image" | "video" | "gif" | "audio" | "file";
    mimeType: string;
    fileName: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    hasThumbnail: boolean;
}

// A saved GIF is its own MediaAsset (re-encrypted under the Saved Messages
// chat's key), plus which in-chat media it was originally saved from - see
// SavedGif.cs for why the two ids differ.
export interface SavedGifEntry {
    media: MediaAsset;
    sourceMediaId: string;
}

export interface ChatReadState {
    userId: string;
    lastReadAt: string; // ISO timestamp
}

export interface ChatMessage {
    id: string;
    chatId: string;
    senderId: string;
    senderName: string;
    replyToId: string | null;
    content: string;
    type: MessageType;
    media: MediaAsset | null;
    isEdited: boolean;
    createdAt: string; // ISO timestamp
    isOwn: boolean;
    forwardedFromSenderId: string | null;
    forwardedFromSenderName: string | null;
}

export interface User {
    name: string;
    publicId: string;
    lastSeen: string | null; // ISO timestamp
    bio: string | null;
    email: string | null;
    phone: string | null;
    isContact: boolean;
    isBlocked: boolean; // have I blocked them
    isBlockedByOther: boolean; // have they blocked me
    // This user's E2EE identity public key (base64, raw ECDH P-256 point) -
    // needed to seal a chat key to them. Null only if they haven't logged in
    // since E2EE shipped.
    ecdhPublicKey: string | null;
}

export interface UserSearchResult {
    id: string;
    name: string;
    publicId: string;
    ecdhPublicKey: string | null;
}
