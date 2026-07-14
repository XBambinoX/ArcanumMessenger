// Short timestamps for the chat list: time for today, weekday for the
// last week, date for anything older.
export function formatChatTime(iso: string): string {
    const date = new Date(iso);
    const now = new Date();

    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
        return date.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    const ageDays = (now.getTime() - date.getTime()) / 86_400_000;
    if (ageDays < 7) {
        return date.toLocaleDateString([], { weekday: "short" });
    }

    return date.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
}

// Full time for message bubbles.
export function formatMessageTime(iso: string): string {
    return new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}
