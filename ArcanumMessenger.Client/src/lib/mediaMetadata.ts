/**
 * Reads dimensions/duration from a local file before it's encrypted and
 * uploaded. The server can no longer decode chat media itself once it's
 * ciphertext, so this - not SkiaSharp on the server - is now the only place
 * this information can come from.
 */

export interface MediaDimensions {
    width?: number;
    height?: number;
    durationSeconds?: number;
}

export async function readMediaMetadata(file: File): Promise<MediaDimensions> {
    if (file.type.startsWith("image/")) {
        try {
            const bitmap = await createImageBitmap(file);
            const { width, height } = bitmap;
            bitmap.close();
            return { width, height };
        } catch {
            return {};
        }
    }

    if (file.type.startsWith("video/")) {
        return new Promise((resolve) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.muted = true;
            const url = URL.createObjectURL(file);
            video.src = url;
            video.onloadedmetadata = () => {
                const result = { width: video.videoWidth, height: video.videoHeight, durationSeconds: video.duration };
                URL.revokeObjectURL(url);
                resolve(result);
            };
            video.onerror = () => {
                URL.revokeObjectURL(url);
                resolve({});
            };
        });
    }

    return {};
}
