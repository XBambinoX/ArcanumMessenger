// Shared between EmojiPicker (which appends a trailing zero-width space
// after picking one of the bare A-Z regional-indicator letter tiles, so
// consecutive picks don't get merged into a flag by the browser's own
// text rendering - see EmojiPicker.tsx for why) and ChatWindow (which
// needs to delete that pairing as one unit on backspace, and treat a
// leftover lone zero-width space as an empty draft).

// Built from its code point, not typed as a literal character in the
// source - an invisible character sitting directly in a source file is
// impossible to visually verify and risks getting silently mangled by
// some tool along the way.
export const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);

// U+1F1E6-U+1F1FF.
export function isRegionalIndicator(char: string): boolean {
    const codePoint = char.codePointAt(0);
    return codePoint !== undefined && codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff;
}

// .trim() alone doesn't count a zero-width space as whitespace, so a
// leftover one on its own would otherwise look empty in the compose box
// but not actually be - this is what "is there really nothing here"
// checks (the send button, the reply-cycle shortcut) should use instead.
export function isBlankDraft(text: string): boolean {
    return text.replaceAll(ZERO_WIDTH_SPACE, "").trim().length === 0;
}
