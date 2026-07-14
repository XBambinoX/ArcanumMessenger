// Client-side shapes for the messenger. They mirror the server entities
// (Chat, ChatMember, Message) so the pages are built against the real
// future data shape - only the fields a chat list / chat window actually
// renders, in camelCase like every other API response.

export type ChatType = "direct" | "group";

export interface ChatSummary {
    id: string;
    type: ChatType;
    title: string;
    lastMessageText: string | null;
    lastMessageAt: string | null; // ISO timestamp
    unreadCount: number;
    isMuted: boolean;
    isArchived: boolean;
}

export interface ChatMessage {
    id: string;
    chatId: string;
    senderId: string;
    senderName: string;
    replyToId: string | null;
    content: string;
    isEdited: boolean;
    createdAt: string; // ISO timestamp
    isOwn: boolean;
}
