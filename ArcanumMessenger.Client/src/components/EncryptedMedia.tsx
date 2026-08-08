import { useEffect, useRef, useState } from "react";
import { getChatKey } from "../lib/chatCrypto";
import { downloadAndDecryptMedia } from "../lib/mediaDownload";

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

interface EncryptedImageProps {
    chat: KeyedChat;
    media: DownloadableMedia;
    className?: string;
    alt?: string;
    onClick?: (url: string) => void;
}

export function EncryptedImage({ chat, media, className, alt, onClick }: EncryptedImageProps) {
    const { url, status } = useDecryptedMediaUrl(chat, media, true);
    if (status === "error") return <div className={className} />;
    if (!url) return <div className={className} />;
    return <img className={className} src={url} alt={alt} onClick={() => onClick?.(url)} />;
}

// For real animated GIF files sent as (or converted to) a video-mime asset -
// same eager-decrypt treatment as a photo, just rendered as a looping,
// controls-less <video> instead of an <img>.
export function EncryptedGifVideo({ chat, media, className, onClick }: EncryptedImageProps) {
    const { url, status } = useDecryptedMediaUrl(chat, media, true);
    if (status === "error" || !url) return <div className={className} />;
    return (
        <video
            className={className}
            src={url}
            autoPlay
            loop
            muted
            playsInline
            onClick={() => onClick?.(url)}
        />
    );
}

interface EncryptedVideoPlayerProps {
    chat: KeyedChat;
    media: DownloadableMedia;
    className?: string;
    placeholderClassName?: string;
}

// Never auto-decrypts - a full video can be large, so nothing downloads
// until someone explicitly asks to watch it. Until then this just shows a
// click-to-play placeholder (a real first-frame thumbnail is added
// separately); after a click it downloads+decrypts fully, then hands off
// to a normal <video controls> - seeking from there on is local, no
// further network/decryption involved.
export function EncryptedVideoPlayer({ chat, media, className, placeholderClassName }: EncryptedVideoPlayerProps) {
    const { url, status, start } = useDecryptedMediaUrl(chat, media, false);

    if (status === "ready" && url) {
        return <video className={className} src={url} controls autoPlay />;
    }

    return (
        <div className={placeholderClassName} onClick={start}>
            {status === "loading" ? "Loading…" : status === "error" ? "Failed to load - tap to retry" : "▶"}
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
