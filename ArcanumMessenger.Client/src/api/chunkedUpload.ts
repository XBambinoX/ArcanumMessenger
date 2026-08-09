import { apiFetch } from "../lib/apiFetch";
import type { MediaAsset } from "../types/messenger";
import { encryptChunk, CHUNK_SIZE, ciphertextSizeFor } from "../crypto/chunkedMedia";
import { readMediaMetadata } from "../lib/mediaMetadata";
import { encryptContent } from "../crypto/chatKey";

export const CHUNK_THRESHOLD = 50 * 1024 * 1024; // files under this keep using the simple uploadMedia
const RETRY_ATTEMPTS = 3;

// A live File handle can't survive a page reload, so this is the only way
// to recognize "this is the same file as before" and resume instead of
// starting over - the server remains the source of truth for which parts
// actually made it, this is just how the client finds its way back to them.
function fingerprintKey(file: File): string {
    return `chunked-upload:${file.name}|${file.size}|${file.lastModified}`;
}

async function startSession(
    file: File,
    encryptedFileName: string,
    encryptedTotalSize: number,
    meta: { width?: number; height?: number; durationSeconds?: number },
    signal?: AbortSignal,
): Promise<string | null> {
    const res = await apiFetch("/api/media/chunked", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
            fileName: encryptedFileName,
            mimeType: file.type || "application/octet-stream",
            totalSize: encryptedTotalSize,
            width: meta.width,
            height: meta.height,
            durationSeconds: meta.durationSeconds,
        }),
        signal,
    });
    const data = await res.json();
    return data.success ? data.sessionId : null;
}

async function getUploadedParts(sessionId: string, signal?: AbortSignal): Promise<Set<number> | null> {
    const res = await apiFetch(`/api/media/chunked/${sessionId}`, { credentials: "include", signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? new Set<number>(data.uploadedPartNumbers ?? []) : null;
}

async function uploadPartOnce(sessionId: string, partNumber: number, chunk: Blob, signal?: AbortSignal): Promise<boolean> {
    const res = await apiFetch(`/api/media/chunked/${sessionId}/parts/${partNumber}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk,
        signal,
    });
    const data = await res.json();
    return data.success === true;
}

async function uploadPartWithRetry(sessionId: string, partNumber: number, chunk: Blob, signal?: AbortSignal): Promise<boolean> {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        if (await uploadPartOnce(sessionId, partNumber, chunk, signal)) return true;
        if (attempt < RETRY_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
    return false;
}

async function completeSession(sessionId: string, signal?: AbortSignal): Promise<MediaAsset | null> {
    const res = await apiFetch(`/api/media/chunked/${sessionId}/complete`, {
        method: "POST",
        credentials: "include",
        signal,
    });
    const data = await res.json();
    return data.success ? data.media : null;
}

export function clearChunkedUploadResumeState(file: File): void {
    localStorage.removeItem(fingerprintKey(file));
}

// Best-effort cleanup for a session the user cancelled mid-upload - drops
// the server-side multipart upload and whatever parts already landed.
export async function abortChunkedUpload(sessionId: string): Promise<boolean> {
    try {
        const res = await apiFetch(`/api/media/chunked/${sessionId}`, {
            method: "DELETE",
            credentials: "include",
        });
        const data = await res.json();
        return data.success === true;
    } catch {
        return false;
    }
}

export async function uploadMediaChunked(
    file: File,
    chatKey: Uint8Array,
    chatId: string,
    onProgress: (loadedBytes: number, totalBytes: number) => void,
    signal?: AbortSignal,
    onSessionStart?: (sessionId: string) => void,
): Promise<MediaAsset | null> {
    const key = fingerprintKey(file);
    let sessionId = localStorage.getItem(key);
    let uploadedParts = new Set<number>();

    const encryptedTotalSize = ciphertextSizeFor(file.size);

    if (sessionId) {
        const parts = await getUploadedParts(sessionId, signal);
        if (parts) {
            uploadedParts = parts;
        } else {
            // Session expired or never existed server-side - the stale
            // pointer is useless, drop it and start fresh below.
            localStorage.removeItem(key);
            sessionId = null;
        }
    }

    if (!sessionId) {
        const meta = await readMediaMetadata(file);
        const encryptedFileName = await encryptContent(chatKey, chatId, file.name);
        sessionId = await startSession(file, encryptedFileName, encryptedTotalSize, meta, signal);
        if (!sessionId) return null;
        localStorage.setItem(key, sessionId);
    }

    onSessionStart?.(sessionId);

    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    let loaded = uploadedParts.size * CHUNK_SIZE;
    onProgress(Math.min(loaded, file.size), file.size);

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (uploadedParts.has(partNumber)) continue;

        const start = (partNumber - 1) * CHUNK_SIZE;
        const plainChunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));
        const plainBytes = new Uint8Array(await plainChunk.arrayBuffer());
        const encryptedBytes = await encryptChunk(chatKey, chatId, partNumber - 1, plainBytes);

        const ok = await uploadPartWithRetry(sessionId, partNumber, new Blob([encryptedBytes as BlobPart]), signal);
        if (!ok) return null; // localStorage entry stays - retrying the same file resumes, not restarts

        loaded += plainChunk.size;
        onProgress(Math.min(loaded, file.size), file.size);
    }

    const media = await completeSession(sessionId, signal);
    if (media) localStorage.removeItem(key);
    return media;
}
