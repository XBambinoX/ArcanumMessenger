import { apiFetch } from "./apiFetch";
import { getMediaUrl, getMediaThumbnailUrl } from "../api/media";
import { decryptChunk, ciphertextChunkRanges } from "../crypto/chunkedMedia";
import { makeMp4Faststart } from "./mp4Faststart";

const RETRY_ATTEMPTS = 3;

async function fetchRangeOnce(mediaId: string, start: number, end: number, signal?: AbortSignal): Promise<Uint8Array> {
    const res = await apiFetch(getMediaUrl(mediaId), {
        credentials: "include",
        headers: { Range: `bytes=${start}-${end}` },
        signal,
    });
    if (!res.ok) throw new Error(`media range fetch failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
}

async function fetchRangeWithRetry(mediaId: string, start: number, end: number, signal?: AbortSignal): Promise<Uint8Array> {
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
            return await fetchRangeOnce(mediaId, start, end, signal);
        } catch (err) {
            if (attempt === RETRY_ATTEMPTS || (err instanceof DOMException && err.name === "AbortError")) throw err;
            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
    }
    throw new Error("unreachable");
}

interface DownloadableMedia {
    id: string;
    sizeBytes: number;
    mimeType: string;
}

// Downloads an encrypted media asset chunk by chunk (mirroring the
// resumable upload's own chunk boundaries) and decrypts each chunk as it
// arrives, so a large file never has to be held as one giant in-flight
// response. Returns a plaintext Blob with the asset's real mime type, ready
// for URL.createObjectURL.
export async function downloadAndDecryptMedia(
    chatKey: Uint8Array,
    chatId: string,
    media: DownloadableMedia,
    onProgress?: (loadedBytes: number, totalBytes: number) => void,
    signal?: AbortSignal,
): Promise<Blob> {
    const ranges = ciphertextChunkRanges(media.sizeBytes);
    const plainChunks: Uint8Array[] = [];
    let loaded = 0;

    for (const { index, start, length } of ranges) {
        const encrypted = await fetchRangeWithRetry(media.id, start, start + length - 1, signal);
        const plain = await decryptChunk(chatKey, chatId, index, encrypted);
        plainChunks.push(plain);
        loaded += plain.length;
        onProgress?.(loaded, media.sizeBytes);
    }

    const totalLength = plainChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let writeOffset = 0;
    for (const chunk of plainChunks) {
        combined.set(chunk, writeOffset);
        writeOffset += chunk.length;
    }

    // A no-op for anything that isn't a non-faststart MP4 (wrong magic
    // bytes, already faststart, etc.) - see mp4Faststart.ts for why some
    // otherwise-perfectly-valid videos would fail to play from a blob: URL
    // without this.
    return new Blob([makeMp4Faststart(combined) as BlobPart], { type: media.mimeType });
}

// A video thumbnail is always a single small chunk (see
// api/media.ts's uploadMediaThumbnail) - no Range/multi-chunk logic needed,
// just one fetch and one decrypt. Returns null if there's no thumbnail
// stored (404) rather than throwing, since "no thumbnail yet" is routine.
export async function downloadAndDecryptThumbnail(
    chatKey: Uint8Array,
    chatId: string,
    mediaId: string,
): Promise<Blob | null> {
    const res = await apiFetch(getMediaThumbnailUrl(mediaId), { credentials: "include" });
    if (!res.ok) return null;

    const encrypted = new Uint8Array(await res.arrayBuffer());
    const plain = await decryptChunk(chatKey, chatId, 0, encrypted);
    return new Blob([plain as BlobPart], { type: "image/jpeg" });
}
