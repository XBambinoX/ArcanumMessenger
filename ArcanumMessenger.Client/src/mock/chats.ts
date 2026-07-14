import type { ChatSummary } from "../types/messenger";

// Temporary data for building the layout. Removed once the chats API
// exists - the shapes already match what the server will send.

const hoursAgo = (h: number) =>
    new Date(Date.now() - h * 3_600_000).toISOString();
const daysAgo = (d: number) =>
    new Date(Date.now() - d * 86_400_000).toISOString();

export const mockChats: ChatSummary[] = [
    {
        id: "c1",
        type: "direct",
        title: "Alice",
        lastMessageText: "See you tomorrow then!",
        lastMessageAt: hoursAgo(0.2),
        unreadCount: 2,
        isMuted: false,
        isArchived: false,
    },
    {
        id: "c2",
        type: "group",
        title: "Arcanum Dev",
        lastMessageText: "Bob: pushed the fix, can someone review?",
        lastMessageAt: hoursAgo(1.5),
        unreadCount: 14,
        isMuted: true,
        isArchived: false,
    },
    {
        id: "c3",
        type: "direct",
        title: "Bob",
        lastMessageText: "That TOTP page looks clean",
        lastMessageAt: hoursAgo(5),
        unreadCount: 0,
        isMuted: false,
        isArchived: false,
    },
    {
        id: "c4",
        type: "group",
        title: "Weekend Plans",
        lastMessageText: "Carol: I vote for the mountains",
        lastMessageAt: daysAgo(1.2),
        unreadCount: 0,
        isMuted: false,
        isArchived: false,
    },
    {
        id: "c5",
        type: "direct",
        title: "Carol",
        lastMessageText: "Thanks, got it",
        lastMessageAt: daysAgo(2.5),
        unreadCount: 0,
        isMuted: false,
        isArchived: false,
    },
    {
        id: "c6",
        type: "direct",
        title: "Old Project",
        lastMessageText: "Closing this one out",
        lastMessageAt: daysAgo(30),
        unreadCount: 0,
        isMuted: true,
        isArchived: true,
    },
    {
        id: "c7",
        type: "group",
        title: "University Group",
        lastMessageText: "Dan: exam results are up",
        lastMessageAt: daysAgo(60),
        unreadCount: 0,
        isMuted: false,
        isArchived: true,
    },
];
