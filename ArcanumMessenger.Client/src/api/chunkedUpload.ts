import { apiFetch } from "../lib/apiFetch";
import type { MediaAsset } from "../types/messenger";
import { encryptChunk, CHUNK_SIZE, ciphertextSizeFor } from "../crypto/chunkedMedia";
import { readMediaMetadata } from "../lib/mediaMetadata";
import { encryptContent } from "../crypto/chatKey";

// Files under this keep using the simple, single-request uploadMedia - no
// per-request progress event exists for that path (fetch doesn't expose
// upload progress), so anything worth watching a progress bar for goes
// through the chunked/resumable path instead, which already tracks it
// chunk by chunk. 1MB (not e.g. a few KB) so tiny attachments - stickers,
// small images - skip the extra session/part/complete round trips for a
// transfer that's over near-instantly anyway.
export const CHUNK_THRESHOLD = 1 * 1024 * 1024;
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

// fetch has no upload-progress event at all - only XMLHttpRequest exposes
// one (xhr.upload.onprogress), which is the only reason this exists instead
// of just another apiFetch call like every other request here. Without it,
// progress only moved once per whole 10MB chunk landing, which on a slow
// connection reads as "stuck at 0%" for however long that chunk takes -
// exactly the ambiguity between slow and stalled this is meant to remove.
function putPartWithProgress(
    url: string,
    body: Blob,
    onProgress: (loadedBytes: number) => void,
    signal?: AbortSignal,
): Promise<{ ok: boolean }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader("Content-Type", "application/octet-stream");

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(e.loaded);
        };
        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                resolve({ ok: false });
                return;
            }
            try {
                resolve({ ok: JSON.parse(xhr.responseText)?.success === true });
            } catch {
                resolve({ ok: false });
            }
        };
        xhr.onerror = () => resolve({ ok: false });
        xhr.onabort = () => reject(new DOMException("The upload was aborted", "AbortError"));

        if (signal) {
            if (signal.aborted) {
                xhr.abort();
                return;
            }
            signal.addEventListener("abort", () => xhr.abort());
        }

        xhr.send(body);
    });
}

async function uploadPartOnce(
    sessionId: string,
    partNumber: number,
    chunk: Blob,
    onChunkProgress: (loadedBytes: number) => void,
    signal?: AbortSignal,
): Promise<boolean> {
    const result = await putPartWithProgress(
        `/api/media/chunked/${sessionId}/parts/${partNumber}`,
        chunk,
        onChunkProgress,
        signal,
    );
    return result.ok;
}

async function uploadPartWithRetry(
    sessionId: string,
    partNumber: number,
    chunk: Blob,
    onChunkProgress: (loadedBytes: number) => void,
    signal?: AbortSignal,
): Promise<boolean> {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        if (await uploadPartOnce(sessionId, partNumber, chunk, onChunkProgress, signal)) return true;
        onChunkProgress(0); // a failed attempt's partial progress doesn't carry over to the retry
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
    // See uploadMedia's own copy of this param for why - same MediaRecorder
    // duration unreliability applies to a long voice recording going
    // through the chunked path.
    durationSecondsOverride?: number,
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
        if (durationSecondsOverride !== undefined) meta.durationSeconds = durationSecondsOverride;
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
        const encryptedLength = encryptedBytes.length;

        const ok = await uploadPartWithRetry(
            sessionId,
            partNumber,
            new Blob([encryptedBytes as BlobPart]),
            // xhr.upload.onprogress reports ciphertext bytes actually sent
            // over the wire - scaled back to plaintext bytes so it lines up
            // with `loaded`/file.size, which are both in plaintext terms.
            (chunkLoadedBytes) => {
                const ratio = encryptedLength > 0 ? chunkLoadedBytes / encryptedLength : 0;
                onProgress(Math.min(loaded + ratio * plainChunk.size, file.size), file.size);
            },
            signal,
        );
        if (!ok) return null; // localStorage entry stays - retrying the same file resumes, not restarts

        loaded += plainChunk.size;
        onProgress(Math.min(loaded, file.size), file.size);
    }

    const media = await completeSession(sessionId, signal);
    if (media) localStorage.removeItem(key);
    return media;
}
