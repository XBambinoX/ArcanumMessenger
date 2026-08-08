import type { SavedGifEntry } from "../types/messenger";
import { getSavedGifs } from "../api/media";
import { EncryptedImage, EncryptedGifVideo, type KeyedChat } from "./EncryptedMedia";
import { useEffect, useState } from "react";
import styles from "./GifPicker.module.css";
import { useLanguage } from "../lib/language";
import { GIF_PICKER_TRANSLATIONS } from "../lib/chatWindowTranslations";

// A gif "sent as video" has no thumbnail (thumbnails are only generated for
// real image/gif files at upload time, before the sender's later choice to
// treat it as a gif) - play the actual file muted/looped as its own preview.
function isVideoMime(mimeType: string): boolean {
    return mimeType.startsWith("video/");
}

interface GifPickerProps {
    savedChat: KeyedChat;
    onClose: () => void;
    onSelect: (entry: SavedGifEntry) => void;
}

export default function GifPicker({ savedChat, onClose, onSelect }: GifPickerProps) {
    const tr = GIF_PICKER_TRANSLATIONS[useLanguage()];
    const [gifs, setGifs] = useState<SavedGifEntry[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        getSavedGifs().then((result) => {
            setGifs(result);
            setLoaded(true);
        });
    }, []);

    return (
        <aside className={styles.panel}>
            <header className={styles.header}>
                <h2 className={styles.title}>{tr.title}</h2>
                <button className={styles.closeBtn} onClick={onClose} aria-label={tr.closeAria}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </header>

            {loaded && gifs.length === 0 && (
                <p className={styles.note}>
                    {tr.noGifsYet}
                </p>
            )}

            {gifs.length > 0 && (
                <div className={styles.grid}>
                    {gifs.map(({ media, sourceMediaId }) => (
                        <button
                            key={media.id}
                            className={styles.gifTile}
                            onClick={() => onSelect({ media, sourceMediaId })}
                        >
                            {isVideoMime(media.mimeType) ? (
                                <EncryptedGifVideo chat={savedChat} media={media} />
                            ) : (
                                // Same as the chat bubble - always the real file, never a
                                // thumbnail, or the gif would just sit there frozen.
                                <EncryptedImage chat={savedChat} media={media} alt={media.fileName} />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </aside>
    );
}

