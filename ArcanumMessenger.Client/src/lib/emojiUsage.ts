const STORAGE_KEY = "reactionEmojiUsage";
// How many distinct emoji to remember counts for - unbounded would grow
// forever for someone who reacts with a lot of variety over time.
const MAX_TRACKED = 50;

function readCounts(): Record<string, number> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

// Per-device only (like theme/language used to be before they became
// account-synced) - this is just a personal shortcut list, not something
// that needs to follow the account across devices.
export function recordReactionEmojiUse(emoji: string): void {
    const counts = readCounts();
    counts[emoji] = (counts[emoji] ?? 0) + 1;

    const entries = Object.entries(counts);
    if (entries.length > MAX_TRACKED) {
        entries.sort((a, b) => a[1] - b[1]);
        delete counts[entries[0][0]];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
}

export function getFrequentReactionEmojis(limit: number): string[] {
    return Object.entries(readCounts())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([emoji]) => emoji);
}
