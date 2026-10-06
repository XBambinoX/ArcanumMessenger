import type { ChatMessage, ChatSummary, MediaAsset } from "../types/messenger";
import { getExportHistoryPage } from "../api/messages";
import { decryptIncomingList, getChatKey } from "./chatCrypto";

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

type ExportableChat = Pick<ChatSummary, "id" | "type" | "title" | "wrappedChatKey">;

interface ExportedMessage {
    id: string;
    type: ChatMessage["type"];
    date: string;
    from: string;
    fromId: string;
    text: string;
    replyToId: string | null;
    forwardedFrom: string | null;
    edited: boolean;
    reactions: { emoji: string; count: number }[];
    media: Omit<MediaAsset, "id" | "hasThumbnail"> | null;
}

export async function exportChat(
    chat: ExportableChat,
    _options: ChatExportOptions,
    onProgress: (progress: ChatExportProgress) => void,
    signal: AbortSignal,
): Promise<void> {
    if (!(await getChatKey(chat))) throw new Error("this device has no key for the chat");

    const messages = await collectHistory(chat, onProgress, signal);

    onProgress({ phase: "packing", done: 0, total: null });
    const { ZipWriter, BlobWriter, TextReader } = await import("@zip.js/zip.js/lib/zip-native.js");
    const baseName = archiveBaseName(chat.title);
    const zip = new ZipWriter(new BlobWriter("application/zip"));

    // TODO: messages.html for "html"/"both" - until then every format gets result.json.
    const result = {
        name: chat.title,
        type: chat.type,
        id: chat.id,
        exportedAt: new Date().toISOString(),
        messages: messages.map(toExportedMessage),
    };
    await zip.add(`${baseName}/result.json`, new TextReader(JSON.stringify(result, null, 2)), { signal });

    const archive = await zip.close();
    signal.throwIfAborted();
    saveBlob(archive, `${baseName}.zip`);
}

async function collectHistory(
    chat: ExportableChat,
    onProgress: (progress: ChatExportProgress) => void,
    signal: AbortSignal,
): Promise<ChatMessage[]> {
    const pages: ChatMessage[][] = [];
    let count = 0;
    let before: string | null = null;

    onProgress({ phase: "messages", done: 0, total: null });
    for (;;) {
        const page = await getExportHistoryPage(chat.id, before, signal);
        const decrypted = await decryptIncomingList(chat, page.messages);
        signal.throwIfAborted();

        pages.push(decrypted);
        count += decrypted.length;
        onProgress({ phase: "messages", done: count, total: null });

        if (!page.hasMore || page.messages.length === 0) break;
        before = page.messages[0].id;
    }

    // Pages come newest first, each one sorted oldest to newest.
    return pages.reverse().flat();
}

function toExportedMessage(m: ChatMessage): ExportedMessage {
    return {
        id: m.id,
        type: m.type,
        date: m.createdAt,
        from: m.senderName,
        fromId: m.senderId,
        text: m.content,
        replyToId: m.replyToId,
        forwardedFrom: m.forwardedFromSenderName,
        edited: m.isEdited,
        reactions: m.reactions.map(({ emoji, count }) => ({ emoji, count })),
        media: m.media && {
            kind: m.media.kind,
            fileName: m.media.fileName,
            mimeType: m.media.mimeType,
            sizeBytes: m.media.sizeBytes,
            width: m.media.width,
            height: m.media.height,
            durationSeconds: m.media.durationSeconds,
        },
    };
}

function archiveBaseName(title: string): string {
    const safeTitle = title.replace(/[\\/:*?"<>|\p{Cc}]/gu, "_").slice(0, 64).replace(/[. ]+$/, "") || "chat";
    const now = new Date();
    const date = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
        .map((part) => String(part).padStart(2, "0"))
        .join("-");
    return `Arcanum_${safeTitle}_${date}`;
}

function saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Revoking right away can cut off a large download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
