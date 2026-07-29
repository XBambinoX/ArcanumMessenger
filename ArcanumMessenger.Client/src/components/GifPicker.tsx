import type { MediaAsset } from "../types/messenger";
import { getSavedGifs, getMediaUrl } from "../api/media";
import { useEffect, useState } from "react";
import styles from "./GifPicker.module.css";

// A gif "sent as video" has no thumbnail (thumbnails are only generated for
// real image/gif files at upload time, before the sender's later choice to
// treat it as a gif) - play the actual file muted/looped as its own preview.
function isVideoMime(mimeType: string): boolean {
    return mimeType.startsWith("video/");
}

interface GifPickerProps {
    onClose: () => void;
    onSelect: (gif: MediaAsset) => void;
}

export default function GifPicker({ onClose, onSelect }: GifPickerProps) {
    const [gifs, setGifs] = useState<MediaAsset[]>([]);
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
                <h2 className={styles.title}>Saved GIFs</h2>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </header>

            {loaded && gifs.length === 0 && (
                <p className={styles.note}>
                    No saved GIFs yet - send or receive one, then save it from the chat to see it here.
                </p>
            )}

            {gifs.length > 0 && (
                <div className={styles.grid}>
                    {gifs.map((gif) => (
                        <button key={gif.id} className={styles.gifTile} onClick={() => onSelect(gif)}>
                            {isVideoMime(gif.mimeType) ? (
                                <video src={getMediaUrl(gif.id)} autoPlay loop muted playsInline />
                            ) : (
                                // Same as the chat bubble - the thumbnail is a static single
                                // frame, showing it here would make every saved GIF look frozen.
                                <img src={getMediaUrl(gif.id)} alt={gif.fileName} />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </aside>
    );
}
