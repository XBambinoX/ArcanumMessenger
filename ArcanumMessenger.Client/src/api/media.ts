import { apiFetch } from "../lib/apiFetch";
import type { MediaAsset } from "../types/messenger";
import { encryptChunked } from "../crypto/chunkedMedia";
import { readMediaMetadata } from "../lib/mediaMetadata";

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

    const formData = new FormData();
    formData.append("file", new Blob(encryptedChunks as BlobPart[]), file.name);
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

export async function getSavedGifs(): Promise<MediaAsset[]> {
    const res = await apiFetch("/api/media/saved-gifs", { credentials: "include" });
    const data = await res.json();
    return data.success ? (data.gifs ?? []) : [];
}

export async function saveGif(mediaId: string): Promise<boolean> {
    const res = await apiFetch(`/api/media/${mediaId}/save`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}

export async function unsaveGif(mediaId: string): Promise<boolean> {
    const res = await apiFetch(`/api/media/${mediaId}/save`, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    return data.success === true;
}
