import type { ZipWriter } from "@zip.js/zip.js/lib/zip-native.js";
import type { ChatMessage, ChatSummary, MediaAsset } from "../types/messenger";
import { getExportHistoryPage } from "../api/messages";
import { decryptIncomingList, getChatKey } from "./chatCrypto";
import { downloadAndDecryptMedia } from "./mediaDownload";

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

// Also the folder each kind lands in inside the archive.
const MEDIA_FOLDERS: Record<MediaAsset["kind"], ExportMediaKind> = {
    image: "photos",
    video: "videos",
    videoNote: "videos",
    audio: "voice",
    file: "files",
    gif: "gifs",
};

type MediaSkipReason = "not_selected" | "too_large" | "download_failed";

interface MediaOutcome {
    // relative to the archive's root folder
    file: string | null;
    skipped: MediaSkipReason | null;
}

interface MediaDownload {
    media: MediaAsset;
    path: string;
    outcome: MediaOutcome;
}

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
    media: (Omit<MediaAsset, "id" | "hasThumbnail"> & MediaOutcome) | null;
}

export async function exportChat(
    chat: ExportableChat,
    options: ChatExportOptions,
    onProgress: (progress: ChatExportProgress) => void,
    signal: AbortSignal,
): Promise<void> {
    const chatKey = await getChatKey(chat);
    if (!chatKey) throw new Error("this device has no key for the chat");

    const messages = await collectHistory(chat, onProgress, signal);

    const { ZipWriter, BlobWriter, TextReader } = await import("@zip.js/zip.js/lib/zip-native.js");
    const baseName = archiveBaseName(chat.title);
    const zip = new ZipWriter(new BlobWriter("application/zip"));

    const { outcomes, downloads } = planMedia(messages, options);
    await addMediaFiles(zip, `${baseName}/`, chat.id, chatKey, downloads, onProgress, signal);

    onProgress({ phase: "packing", done: 0, total: null });
    // TODO: messages.html for "html"/"both" - until then every format gets result.json.
    const result = {
        name: chat.title,
        type: chat.type,
        id: chat.id,
        exportedAt: new Date().toISOString(),
        messages: messages.map((m) => toExportedMessage(m, outcomes)),
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

function planMedia(messages: ChatMessage[], options: ChatExportOptions) {
    const outcomes = new Map<string, MediaOutcome>();
    const downloads: MediaDownload[] = [];
    const usedPaths = new Set<string>();
    const maxBytes = options.maxFileSizeMb === null ? Infinity : options.maxFileSizeMb * 1024 * 1024;

    for (const { media } of messages) {
        if (!media || outcomes.has(media.id)) continue;

        const folder = MEDIA_FOLDERS[media.kind];
        if (!options.media[folder]) {
            outcomes.set(media.id, { file: null, skipped: "not_selected" });
        } else if (media.sizeBytes > maxBytes) {
            outcomes.set(media.id, { file: null, skipped: "too_large" });
        } else {
            const path = uniquePath(folder, media.fileName, usedPaths);
            const outcome: MediaOutcome = { file: path, skipped: null };
            outcomes.set(media.id, outcome);
            downloads.push({ media, path, outcome });
        }
    }

    return { outcomes, downloads };
}

async function addMediaFiles(
    zip: ZipWriter<Blob>,
    root: string,
    chatId: string,
    chatKey: Uint8Array,
    downloads: MediaDownload[],
    onProgress: (progress: ChatExportProgress) => void,
    signal: AbortSignal,
): Promise<void> {
    if (downloads.length === 0) return;

    const { BlobReader } = await import("@zip.js/zip.js/lib/zip-native.js");
    onProgress({ phase: "media", done: 0, total: downloads.length });

    for (const [index, { media, path, outcome }] of downloads.entries()) {
        let blob: Blob | null = null;
        try {
            blob = await downloadAndDecryptMedia(chatKey, chatId, media, undefined, signal);
        } catch {
            // One missing file shouldn't sink the whole export - it's flagged in result.json instead.
            signal.throwIfAborted();
            outcome.file = null;
            outcome.skipped = "download_failed";
        }

        // Stored as is: most media is already compressed, deflating it again only burns CPU.
        if (blob) await zip.add(`${root}${path}`, new BlobReader(blob), { level: 0, signal });
        onProgress({ phase: "media", done: index + 1, total: downloads.length });
    }
}

function toExportedMessage(m: ChatMessage, mediaOutcomes: Map<string, MediaOutcome>): ExportedMessage {
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
            ...mediaOutcomes.get(m.media.id)!,
        },
    };
}

// Paths are compared lowercased, since Windows and macOS file systems ignore case.
function uniquePath(folder: string, fileName: string, used: Set<string>): string {
    const dot = fileName.lastIndexOf(".");
    const stem = safeFileName(dot > 0 ? fileName.slice(0, dot) : fileName, 100) || "file";
    const ext = dot > 0 ? safeFileName(fileName.slice(dot), 16) : "";

    for (let n = 1; ; n++) {
        const path = `${folder}/${n === 1 ? stem : `${stem} (${n})`}${ext}`;
        if (!used.has(path.toLowerCase())) {
            used.add(path.toLowerCase());
            return path;
        }
    }
}

// Drops what Windows forbids in a file name, which covers the other systems too.
function safeFileName(name: string, maxLength: number): string {
    return name.replace(/[\\/:*?"<>|\p{Cc}]/gu, "_").slice(0, maxLength).replace(/[. ]+$/, "");
}

function archiveBaseName(title: string): string {
    const safeTitle = safeFileName(title, 64) || "chat";
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
