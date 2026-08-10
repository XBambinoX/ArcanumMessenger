import type { SavedGifEntry } from "../types/messenger";
import { getSavedGifs, unsaveGif } from "../api/media";
import { EncryptedImage, EncryptedGifVideo, type KeyedChat } from "./EncryptedMedia";
import { decryptSavedGifEntries } from "../lib/chatCrypto";
import { useEffect, useRef, useState } from "react";
import styles from "./GifPicker.module.css";
import { useLanguage } from "../lib/language";
import { GIF_PICKER_TRANSLATIONS } from "../lib/chatWindowTranslations";
import MessageContextMenu from "./MessageContextMenu";

// A gif "sent as video" has no thumbnail (thumbnails are only generated for
// real image/gif files at upload time, before the sender's later choice to
// treat it as a gif) - play the actual file muted/looped as its own preview.
function isVideoMime(mimeType: string): boolean {
    return mimeType.startsWith("video/");
}

const LONG_PRESS_MS = 450;

interface GifPickerProps {
    savedChat: KeyedChat;
    onClose: () => void;
    onSelect: (entry: SavedGifEntry) => void;
    // "embedded" drops the outer panel shell, title, and close button -
    // used by StickerPicker, which provides its own shared shell/close
    // button around this and EmojiPicker's content under one set of tabs.
    variant?: "standalone" | "embedded";
}

export default function GifPicker({ savedChat, onClose, onSelect, variant = "standalone" }: GifPickerProps) {
    const tr = GIF_PICKER_TRANSLATIONS[useLanguage()];
    const [gifs, setGifs] = useState<SavedGifEntry[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ sourceMediaId: string; x: number; y: number } | null>(null);
    const longPressTimer = useRef<number | null>(null);
    // A long-press that opens the menu also ends in a native click on
    // release in most mobile browsers - without this the same touch would
    // both open the "remove" menu and send the gif into the chat.
    const suppressClickRef = useRef(false);

    useEffect(() => {
        getSavedGifs().then(async (result) => {
            setGifs(await decryptSavedGifEntries(savedChat, result));
            setLoaded(true);
        });
    }, [savedChat]);

    const clearLongPressTimer = () => {
        if (longPressTimer.current !== null) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleTouchStart = (e: React.TouchEvent, sourceMediaId: string) => {
        const { clientX: x, clientY: y } = e.touches[0];
        clearLongPressTimer();
        longPressTimer.current = window.setTimeout(() => {
            suppressClickRef.current = true;
            setContextMenu({ sourceMediaId, x, y });
        }, LONG_PRESS_MS);
    };

    const handleRemoveSaved = async (sourceMediaId: string) => {
        const ok = await unsaveGif(sourceMediaId);
        if (ok) setGifs((prev) => prev.filter((g) => g.sourceMediaId !== sourceMediaId));
    };

    const body = (
        <>
            {variant === "standalone" && (
                <div className={styles.header}>
                    <h2 className={styles.title}>{tr.title}</h2>
                    <button className={styles.closeBtn} onClick={onClose} aria-label={tr.closeAria}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            )}

            {loaded && gifs.length === 0 && (
                <p className={styles.note}>
                    {tr.noGifsYet}
                </p>
            )}

            {gifs.length > 0 && (
                <div className={styles.grid}>
                    {gifs.map(({ media, sourceMediaId }) => {
                        const isVideo = isVideoMime(media.mimeType);
                        return (
                            <button
                                key={media.id}
                                className={`${styles.gifTile} ${isVideo ? styles.gifTileVideo : ""}`}
                                onClick={() => {
                                    if (suppressClickRef.current) {
                                        suppressClickRef.current = false;
                                        return;
                                    }
                                    onSelect({ media, sourceMediaId });
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ sourceMediaId, x: e.clientX, y: e.clientY });
                                }}
                                onTouchStart={(e) => handleTouchStart(e, sourceMediaId)}
                                onTouchEnd={clearLongPressTimer}
                                onTouchMove={clearLongPressTimer}
                            >
                                {isVideo ? (
                                    <EncryptedGifVideo
                                        chat={savedChat}
                                        media={media}
                                        loadingClassName={styles.gifTileLoading}
                                    />
                                ) : (
                                    // Same as the chat bubble - always the real file, never a
                                    // thumbnail, or the gif would just sit there frozen.
                                    <EncryptedImage
                                        chat={savedChat}
                                        media={media}
                                        alt={media.fileName}
                                        loadingClassName={styles.gifTileLoading}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {contextMenu && (
                <MessageContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    items={[{
                        label: tr.removeFromGifs,
                        danger: true,
                        onClick: () => handleRemoveSaved(contextMenu.sourceMediaId),
                    }]}
                />
            )}
        </>
    );

    return variant === "standalone" ? <aside className={styles.panel}>{body}</aside> : body;
}
