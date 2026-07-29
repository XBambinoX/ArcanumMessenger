import { apiFetch } from "../lib/apiFetch";
import type { MediaAsset } from "../types/messenger";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
export const CHUNK_THRESHOLD = 50 * 1024 * 1024; // files under this keep using the simple uploadMedia
const RETRY_ATTEMPTS = 3;

// A live File handle can't survive a page reload, so this is the only way
// to recognize "this is the same file as before" and resume instead of
// starting over - the server remains the source of truth for which parts
// actually made it, this is just how the client finds its way back to them.
function fingerprintKey(file: File): string {
    return `chunked-upload:${file.name}|${file.size}|${file.lastModified}`;
}

async function startSession(file: File): Promise<string | null> {
    const res = await apiFetch("/api/media/chunked", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            totalSize: file.size,
        }),
    });
    const data = await res.json();
    return data.success ? data.sessionId : null;
}

async function getUploadedParts(sessionId: string): Promise<Set<number> | null> {
    const res = await apiFetch(`/api/media/chunked/${sessionId}`, { credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? new Set<number>(data.uploadedPartNumbers ?? []) : null;
}

async function uploadPartOnce(sessionId: string, partNumber: number, chunk: Blob): Promise<boolean> {
    const res = await apiFetch(`/api/media/chunked/${sessionId}/parts/${partNumber}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/octet-stream" },
        body: chunk,
    });
    const data = await res.json();
    return data.success === true;
}

async function uploadPartWithRetry(sessionId: string, partNumber: number, chunk: Blob): Promise<boolean> {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        if (await uploadPartOnce(sessionId, partNumber, chunk)) return true;
        if (attempt < RETRY_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
    return false;
}

async function completeSession(sessionId: string): Promise<MediaAsset | null> {
    const res = await apiFetch(`/api/media/chunked/${sessionId}/complete`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    return data.success ? data.media : null;
}

export async function uploadMediaChunked(
    file: File,
    onProgress: (loadedBytes: number, totalBytes: number) => void,
): Promise<MediaAsset | null> {
    const key = fingerprintKey(file);
    let sessionId = localStorage.getItem(key);
    let uploadedParts = new Set<number>();

    if (sessionId) {
        const parts = await getUploadedParts(sessionId);
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
        sessionId = await startSession(file);
        if (!sessionId) return null;
        localStorage.setItem(key, sessionId);
    }

    const totalParts = Math.ceil(file.size / CHUNK_SIZE);
    let loaded = uploadedParts.size * CHUNK_SIZE;
    onProgress(Math.min(loaded, file.size), file.size);

    for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (uploadedParts.has(partNumber)) continue;

        const start = (partNumber - 1) * CHUNK_SIZE;
        const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size));

        const ok = await uploadPartWithRetry(sessionId, partNumber, chunk);
        if (!ok) return null; // localStorage entry stays - retrying the same file resumes, not restarts

        loaded += chunk.size;
        onProgress(Math.min(loaded, file.size), file.size);
    }

    const media = await completeSession(sessionId);
    if (media) localStorage.removeItem(key);
    return media;
}
