import type { ChatSummary } from "../types/messenger";

export type ExportFormat = "html" | "json" | "both";
export type ExportMediaKind = "photos" | "videos" | "voice" | "files" | "gifs";

export interface ChatExportOptions {
    format: ExportFormat;
    media: Record<ExportMediaKind, boolean>;
    // null = no limit
    maxFileSizeMb: number | null;
    // null = plain, unencrypted ZIP
    password: string | null;
}

export type ChatExportPhase = "messages" | "media" | "packing";

export interface ChatExportProgress {
    phase: ChatExportPhase;
    done: number;
    // null while the total isn't known yet
    total: number | null;
}

// TODO: stub that only fakes progress for the UI - the real export (history
// paging, decryption, media download, zip.js) replaces this body.
export async function exportChat(
    _chat: Pick<ChatSummary, "id" | "title" | "wrappedChatKey">,
    _options: ChatExportOptions,
    onProgress: (progress: ChatExportProgress) => void,
    signal: AbortSignal,
): Promise<void> {
    const phases: ChatExportPhase[] = ["messages", "media", "packing"];
    const fakeTotal = 20;

    for (const phase of phases) {
        for (let done = 0; done <= fakeTotal; done++) {
            if (signal.aborted) throw new DOMException("Export cancelled", "AbortError");
            onProgress({ phase, done, total: phase === "packing" ? null : fakeTotal });
            await new Promise((resolve) => setTimeout(resolve, 60));
        }
    }
}
