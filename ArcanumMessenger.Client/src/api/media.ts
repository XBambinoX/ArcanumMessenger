import { apiFetch } from "../lib/apiFetch";
import type { MediaAsset, SavedGifEntry } from "../types/messenger";
import { encryptChunked, encryptChunk } from "../crypto/chunkedMedia";
import { readMediaMetadata } from "../lib/mediaMetadata";
import { encryptContent } from "../crypto/chatKey";

export function getMediaUrl(mediaId: string): string {
    return `/api/media/${mediaId}`;
}

export function getMediaThumbnailUrl(mediaId: string): string {
    return `/api/media/${mediaId}/thumbnail`;
}

export async function uploadMedia(
    file: File,
    chatKey: Uint8Array,
    chatId: string,
    signal?: AbortSignal,
): Promise<MediaAsset | null> {
    const encryptedChunks: Uint8Array[] = [];
    for await (const chunk of encryptChunked(chatKey, chatId, file)) {
        encryptedChunks.push(chunk);
    }
    const meta = await readMediaMetadata(file);
    const encryptedFileName = await encryptContent(chatKey, chatId, file.name);

    const formData = new FormData();
    // The Blob's own filename arg isn't a safe place for ciphertext (raw
    // multipart header) - the real, encrypted name goes in "fileName" below,
    // this is just a harmless placeholder.
    formData.append("file", new Blob(encryptedChunks as BlobPart[]), "file.bin");
    formData.append("fileName", encryptedFileName);
    formData.append("mimeType", file.type || "application/octet-stream");
    if (meta.width) formData.append("width", String(meta.width));
    if (meta.height) formData.append("height", String(meta.height));
    if (meta.durationSeconds) formData.append("durationSeconds", String(meta.durationSeconds));

    const res = await apiFetch("/api/media", {
        method: "POST",
        credentials: "include",
        body: formData,
        signal,
    });
    const data = await res.json();
    return data.success ? data.media : null;
}

// Attaches an encrypted first-frame thumbnail to an already-uploaded video
// (see lib/mediaMetadata.ts's extractVideoFirstFrame) - a single chunk is
// plenty for a small JPEG, so this reuses the same per-chunk primitive
// directly instead of the multi-chunk generator uploadMedia uses.
export async function uploadMediaThumbnail(
    mediaId: string,
    frame: Blob,
    chatKey: Uint8Array,
    chatId: string,
): Promise<boolean> {
    const plainBytes = new Uint8Array(await frame.arrayBuffer());
    const encrypted = await encryptChunk(chatKey, chatId, 0, plainBytes);

    const formData = new FormData();
    formData.append("file", new Blob([encrypted as BlobPart]), "thumb.bin");

    const res = await apiFetch(`/api/media/${mediaId}/thumbnail`, {
        method: "POST",
        credentials: "include",
        body: formData,
    });
    const data = await res.json();
    return data.success === true;
}

// Only succeeds for an upload nobody has sent/used yet (see MediaService.DeleteUnusedAsync) -
// this is for discarding a picked-but-unsent attachment, not deleting real messages' media.
export async function deleteMedia(mediaId: string): Promise<boolean> {
    const res = await apiFetch(`/api/media/${mediaId}`, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}

export async function getSavedGifs(): Promise<SavedGifEntry[]> {
    const res = await apiFetch("/api/media/saved-gifs", { credentials: "include" });
    const data = await res.json();
    return data.success ? (data.gifs ?? []) : [];
}

// sourceMediaId is the gif as it's currently visible (whatever chat it's
// in); newMediaId is the already-uploaded, re-encrypted-under-Saved-
// Messages-key copy (see lib/mediaReencrypt.ts) that becomes the actual
// saved item.
export async function saveGif(sourceMediaId: string, newMediaId: string): Promise<boolean> {
    const res = await apiFetch(`/api/media/${sourceMediaId}/save`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ newMediaId }),
    });
    const data = await res.json();
    return data.success === true;
}

export async function unsaveGif(sourceMediaId: string): Promise<boolean> {
    const res = await apiFetch(`/api/media/${sourceMediaId}/save`, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}
