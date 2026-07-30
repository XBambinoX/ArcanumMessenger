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
}

export type MessageType = "text" | "image" | "video" | "gif" | "file";

export interface MediaAsset {
    id: string;
    kind: "image" | "video" | "gif" | "file";
    mimeType: string;
    fileName: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    hasThumbnail: boolean;
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
}

export interface UserSearchResult {
    id: string;
    name: string;
    publicId: string;
}
