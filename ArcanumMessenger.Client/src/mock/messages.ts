import type { ChatMessage } from "../types/messenger";

// Temporary data for building the layout, same idea as mock/chats.ts.

const hoursAgo = (h: number) =>
    new Date(Date.now() - h * 3_600_000).toISOString();

export const mockMessages: Record<string, ChatMessage[]> = {
    c1: [
        {
            id: "m1",
            chatId: "c1",
            senderId: "u-alice",
            senderName: "Alice",
            replyToId: null,
            content: "Hey! Are we still on for tomorrow?",
            isEdited: false,
            createdAt: hoursAgo(26),
            isOwn: false,
        },
        {
            id: "m2",
            chatId: "c1",
            senderId: "me",
            senderName: "You",
            replyToId: null,
            content: "Yes, absolutely. 10am at the usual place?",
            isEdited: false,
            createdAt: hoursAgo(25.5),
            isOwn: true,
        },
        {
            id: "m3",
            chatId: "c1",
            senderId: "u-alice",
            senderName: "Alice",
            replyToId: "m2",
            content: "Works for me. Can we make it 10:30 actually?",
            isEdited: true,
            createdAt: hoursAgo(1),
            isOwn: false,
        },
        {
            id: "m4",
            chatId: "c1",
            senderId: "u-alice",
            senderName: "Alice",
            replyToId: null,
            content: "See you tomorrow then!",
            isEdited: false,
            createdAt: hoursAgo(0.2),
            isOwn: false,
        },
    ],
    c2: [
        {
            id: "m5",
            chatId: "c2",
            senderId: "u-carol",
            senderName: "Carol",
            replyToId: null,
            content: "The login flow is merged into Development",
            isEdited: false,
            createdAt: hoursAgo(4),
            isOwn: false,
        },
        {
            id: "m6",
            chatId: "c2",
            senderId: "me",
            senderName: "You",
            replyToId: null,
            content: "Nice. I'll start on the messenger pages today",
            isEdited: false,
            createdAt: hoursAgo(3.5),
            isOwn: true,
        },
        {
            id: "m7",
            chatId: "c2",
            senderId: "u-bob",
            senderName: "Bob",
            replyToId: "m6",
            content: "pushed the fix, can someone review?",
            isEdited: false,
            createdAt: hoursAgo(1.5),
            isOwn: false,
        },
    ],
    c3: [
        {
            id: "m8",
            chatId: "c3",
            senderId: "u-bob",
            senderName: "Bob",
            replyToId: null,
            content: "That TOTP page looks clean",
            isEdited: false,
            createdAt: hoursAgo(5),
            isOwn: false,
        },
    ],
};
