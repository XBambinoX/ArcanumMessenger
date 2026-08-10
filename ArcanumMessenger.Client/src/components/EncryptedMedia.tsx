import { useEffect, useRef, useState } from "react";
import { getChatKey } from "../lib/chatCrypto";
import { downloadAndDecryptMedia, downloadAndDecryptThumbnail } from "../lib/mediaDownload";
import styles from "./EncryptedMedia.module.css";

export interface KeyedChat {
    id: string;
    wrappedChatKey: string | null;
}

export interface DownloadableMedia {
    id: string;
    sizeBytes: number;
    mimeType: string;
}

type DecryptStatus = "idle" | "loading" | "ready" | "error";

// Decrypts a chat media asset into a local object URL, either eagerly on
// mount (photos/gifs - small enough that there's no reason to wait) or on
// demand via the returned `start()` (video - only decrypt/download the
// (possibly huge) file once someone actually asks to watch it).
function useDecryptedMediaUrl(chat: KeyedChat, media: DownloadableMedia, auto: boolean) {
    const [url, setUrl] = useState<string | null>(null);
    const [status, setStatus] = useState<DecryptStatus>("idle");
    const urlRef = useRef<string | null>(null);
    const startedRef = useRef(false);

    const start = () => {
        if (startedRef.current) return;
        startedRef.current = true;
        setStatus("loading");

        (async () => {
            const chatKey = await getChatKey({ id: chat.id, wrappedChatKey: chat.wrappedChatKey });
            if (!chatKey) {
                startedRef.current = false;
                setStatus("error");
                return;
            }
            try {
                const blob = await downloadAndDecryptMedia(chatKey, chat.id, media);
                const objectUrl = URL.createObjectURL(blob);
                urlRef.current = objectUrl;
                setUrl(objectUrl);
                setStatus("ready");
            } catch {
                // Resetting this (rather than leaving it stuck true) is what
                // makes calling start() again - e.g. a tap on the failed
                // placeholder - actually retry instead of silently no-op'ing,
                // which is the whole point of exposing start() as a retry.
                startedRef.current = false;
                setStatus("error");
            }
        })();
    };

    useEffect(() => {
        if (auto) start();
        return () => {
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        };
        // Only re-run if the underlying asset actually changes - `start`
        // itself is stable enough for this (re-created each render, but
        // guarded by startedRef so it's a no-op past the first real call).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [media.id]);

    return { url, status, start };
}

// Same shape as useDecryptedMediaUrl but for the (always small, always
// single-chunk) video thumbnail, which lives at its own endpoint rather
// than being part of the main asset's byte range.
function useDecryptedThumbnailUrl(chat: KeyedChat, mediaId: string, hasThumbnail: boolean) {
    const [url, setUrl] = useState<string | null>(null);
    const urlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!hasThumbnail) return;
        let cancelled = false;

        (async () => {
            const chatKey = await getChatKey({ id: chat.id, wrappedChatKey: chat.wrappedChatKey });
            if (!chatKey || cancelled) return;
            const blob = await downloadAndDecryptThumbnail(chatKey, chat.id, mediaId);
            if (!blob || cancelled) return;
            const objectUrl = URL.createObjectURL(blob);
            urlRef.current = objectUrl;
            setUrl(objectUrl);
        })();

        return () => {
            cancelled = true;
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mediaId, hasThumbnail]);

    return url;
}

interface EncryptedThumbnailProps {
    chat: KeyedChat;
    mediaId: string;
    className?: string;
    alt?: string;
}

// A standalone thumbnail, decrypted on its own rather than as part of
// EncryptedVideoPlayer's placeholder - used by the compose-box "about to
// send" preview, which shows a just-uploaded video's thumbnail before any
// message (and therefore no <EncryptedVideoPlayer>) exists yet.
export function EncryptedThumbnail({ chat, mediaId, className, alt }: EncryptedThumbnailProps) {
    const url = useDecryptedThumbnailUrl(chat, mediaId, true);
    if (!url) return null;
    return <img className={className} src={url} alt={alt} />;
}

// Opens a full-size view in a new tab using its OWN freshly-decrypted blob
// URL, deliberately independent from whatever object URL a bubble/tile
// might already be showing inline. Reusing that one would tie the new
// tab's content to this component's mount lifecycle - if the bubble
// unmounts (chat switched, list re-rendered) while the new tab is still
// loading, its URL.revokeObjectURL cleanup would invalidate the very blob
// the new tab is trying to open, and the browser reports it as an
// unsupported/corrupt file even though nothing was actually wrong with the
// decrypted bytes. This one is intentionally never revoked - it belongs to
// whatever tab the browser opened, not to this component.
async function openFullSize(chat: KeyedChat, media: DownloadableMedia): Promise<void> {
    const chatKey = await getChatKey({ id: chat.id, wrappedChatKey: chat.wrappedChatKey });
    if (!chatKey) return;
    const blob = await downloadAndDecryptMedia(chatKey, chat.id, media);
    window.open(URL.createObjectURL(blob), "_blank");
}

interface EncryptedImageProps {
    chat: KeyedChat;
    media: DownloadableMedia & { width: number | null; height: number | null };
    className?: string;
    // Applied only to the loading/failed placeholder, on top of className -
    // separate from it because the loaded <img>/<video> needs to stay free
    // to auto-size both dimensions from its own real content (so a tall
    // photo shrinks proportionally instead of being squashed to a fixed
    // width), while the placeholder - empty apart from an absolutely
    // positioned spinner that doesn't count as sizeable content - needs an
    // explicit width or its container has nothing to size itself around
    // and collapses to nothing.
    loadingClassName?: string;
    alt?: string;
    openOnClick?: boolean;
}

// Published as a custom property (see EncryptedVideoPlayer's own copy of
// this comment) so the loading placeholder reserves the photo's real shape
// instead of collapsing to 0x0 - a <div> has no intrinsic size the way an
// <img> does, so without this the spinner box is invisible until the bytes
// actually arrive, leaving only the timestamp floating in empty space.
function useMediaAspectVar(media: { width: number | null; height: number | null }) {
    return media.width && media.height
        ? ({ "--media-aspect": `${media.width} / ${media.height}` } as React.CSSProperties)
        : undefined;
}

// Retrying needs to both start() again and keep the click from also
// triggering whatever the caller's own onClick does with a tile that isn't
// actually loaded yet (GifPicker's tiles send on click, for one) - stopping
// propagation here means a caller never has to know this element might be
// in a still-failed, not-really-clickable-yet state.
function handleRetryClick(e: React.MouseEvent, start: () => void) {
    e.stopPropagation();
    start();
}

export function EncryptedImage({ chat, media, className, loadingClassName, alt, openOnClick }: EncryptedImageProps) {
    const { url, status, start } = useDecryptedMediaUrl(chat, media, true);
    const ratioVar = useMediaAspectVar(media);
    if (status === "error") {
        return (
            <div
                className={`${className ?? ""} ${loadingClassName ?? ""} ${styles.failed}`}
                style={ratioVar}
                onClick={(e) => handleRetryClick(e, start)}
            >
                <span className={styles.retryIcon}>↻</span>
            </div>
        );
    }
    if (!url) {
        return (
            <div className={`${className ?? ""} ${loadingClassName ?? ""} ${styles.loading}`} style={ratioVar}>
                <span className={styles.spinner} />
            </div>
        );
    }
    return (
        <img
            className={className}
            src={url}
            alt={alt}
            onClick={openOnClick ? () => openFullSize(chat, media) : undefined}
        />
    );
}

// For real animated GIF files sent as (or converted to) a video-mime asset -
// same eager-decrypt treatment as a photo, just rendered as a looping,
// controls-less <video> instead of an <img>.
export function EncryptedGifVideo({ chat, media, className, loadingClassName, openOnClick }: EncryptedImageProps) {
    const { url, status, start } = useDecryptedMediaUrl(chat, media, true);
    const ratioVar = useMediaAspectVar(media);
    if (status === "error") {
        return (
            <div
                className={`${className ?? ""} ${loadingClassName ?? ""} ${styles.failed}`}
                style={ratioVar}
                onClick={(e) => handleRetryClick(e, start)}
            >
                <span className={styles.retryIcon}>↻</span>
            </div>
        );
    }
    if (!url) {
        return (
            <div className={`${className ?? ""} ${loadingClassName ?? ""} ${styles.loading}`} style={ratioVar}>
                <span className={styles.spinner} />
            </div>
        );
    }
    return (
        <video
            className={className}
            autoPlay
            loop
            muted
            playsInline
            onClick={openOnClick ? () => openFullSize(chat, media) : undefined}
        >
            <source src={url} type={media.mimeType} />
        </video>
    );
}

interface EncryptedVideoPlayerProps {
    chat: KeyedChat;
    media: DownloadableMedia & { hasThumbnail: boolean; width: number | null; height: number | null };
    className?: string;
    placeholderClassName?: string;
    playIconClassName?: string;
    spinnerClassName?: string;
    // A small grid tile is too cramped a place to actually watch a video -
    // this opens it in a new tab (same as a photo's openOnClick) instead of
    // decrypting inline and handing off to <video controls> in place.
    openInNewTab?: boolean;
}

// Never auto-decrypts - a full video can be large, so nothing downloads
// until someone explicitly asks to watch it. Until then this shows the
// first-frame thumbnail the client grabbed at upload time (if any) as a
// static preview with a play icon on top; after a click it downloads+
// decrypts the real video fully, then hands off to a normal
// <video controls> - seeking from there on is local, no further
// network/decryption involved.
export function EncryptedVideoPlayer({
    chat, media, className, placeholderClassName, playIconClassName, spinnerClassName, openInNewTab,
}: EncryptedVideoPlayerProps) {
    const { url, status, start } = useDecryptedMediaUrl(chat, media, false);
    const thumbnailUrl = useDecryptedThumbnailUrl(chat, media.id, media.hasThumbnail);
    // Published as a custom property rather than a plain inline
    // `aspect-ratio` so each caller's own CSS decides whether to use it:
    // a chat bubble wants the video's real shape reserved up front (or the
    // element sits at its tiny 300x150 intrinsic default and visibly snaps
    // to size once metadata loads), while the chat-info media grid wants
    // its tiles square regardless. An inline aspect-ratio would beat both.
    const ratioVar = media.width && media.height
        ? ({ "--media-aspect": `${media.width} / ${media.height}` } as React.CSSProperties)
        : undefined;

    if (status === "ready" && url) {
        return (
            // No autoPlay: by the time decryption finishes, the click that
            // started it is no longer a "recent user gesture" as far as the
            // browser's autoplay policy is concerned, so it either silently
            // blocks playback or starts it unpredictably later - neither is
            // what starting the video via <video controls> alone would give.
            <video className={className} style={ratioVar} controls>
                <source src={url} type={media.mimeType} />
            </video>
        );
    }

    return (
        <div
            className={placeholderClassName}
            style={{
                ...ratioVar,
                ...(thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : {}),
            }}
            onClick={openInNewTab ? () => openFullSize(chat, media) : start}
        >
            {status === "loading" && !openInNewTab ? (
                <span className={spinnerClassName} />
            ) : (
                <span className={playIconClassName}>{status === "error" && !openInNewTab ? "!" : "▶"}</span>
            )}
        </div>
    );
}

// Decrypts a media asset fully and triggers a normal browser "save file"
// download - used for the file-attachment card and the "Save as…" context
// menu action, since a plain <a href> can no longer point straight at the
// (now ciphertext) media URL.
export async function downloadMediaToDisk(
    chat: KeyedChat,
    media: DownloadableMedia & { fileName: string },
): Promise<void> {
    const chatKey = await getChatKey({ id: chat.id, wrappedChatKey: chat.wrappedChatKey });
    if (!chatKey) return;

    const blob = await downloadAndDecryptMedia(chatKey, chat.id, media);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = media.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
