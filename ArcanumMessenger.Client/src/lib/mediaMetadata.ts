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

const THUMBNAIL_MAX_EDGE = 320;

// Grabs the first frame of a local video file as a small JPEG - done here,
// on the plain local File before it's ever encrypted, because that's the
// only point this is cheap: no network, no decrypting anything, the
// browser just needs to decode one frame of a file already sitting on
// disk. The result gets encrypted separately and uploaded as the video's
// thumbnail (see chatMediaCrypto.ts).
export async function extractVideoFirstFrame(file: File): Promise<Blob | null> {
    return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "auto";
        video.muted = true;
        video.playsInline = true;
        const url = URL.createObjectURL(file);
        video.src = url;

        const cleanup = () => URL.revokeObjectURL(url);

        video.onloadeddata = () => {
            // Not currentTime = 0: the element is already there after
            // loadeddata, so assigning the same value can complete without
            // ever firing `seeked` (leaving this promise hanging), and
            // frame zero is a black/blank fade-in often enough that the
            // resulting "preview" is just a dark rectangle. Nudging a
            // fraction of a second in guarantees a real seek and lands on
            // actual picture, while staying inside even very short clips.
            video.currentTime = Math.min(0.3, (video.duration || 1) / 2);
        };
        video.onseeked = () => {
            const scale = Math.min(1, THUMBNAIL_MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                cleanup();
                resolve(null);
                return;
            }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => {
                    cleanup();
                    resolve(blob);
                },
                "image/jpeg",
                0.8,
            );
        };
        video.onerror = () => {
            cleanup();
            resolve(null);
        };
    });
}
