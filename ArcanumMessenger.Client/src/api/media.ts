import { apiFetch } from "../lib/apiFetch";
import type { MediaAsset } from "../types/messenger";

export function getMediaUrl(mediaId: string): string {
    return `/api/media/${mediaId}`;
}

export function getMediaThumbnailUrl(mediaId: string): string {
    return `/api/media/${mediaId}/thumbnail`;
}

export async function uploadMedia(file: File): Promise<MediaAsset | null> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await apiFetch("/api/media", {
        method: "POST",
        credentials: "include",
        body: formData,
    });
    const data = await res.json();
    return data.success ? data.media : null;
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
