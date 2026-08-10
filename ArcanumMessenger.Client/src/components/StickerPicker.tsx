import { useState } from "react";
import type { SavedGifEntry } from "../types/messenger";
import type { KeyedChat } from "./EncryptedMedia";
import EmojiPicker from "./EmojiPicker";
import GifPicker from "./GifPicker";
import styles from "./StickerPicker.module.css";
import { useLanguage } from "../lib/language";
import { CHAT_WINDOW_TRANSLATIONS, GIF_PICKER_TRANSLATIONS } from "../lib/chatWindowTranslations";

interface StickerPickerProps {
    savedChat: KeyedChat;
    onClose: () => void;
    onSelectEmoji: (emoji: string) => void;
    onSelectGif: (entry: SavedGifEntry) => void;
}

// One button/panel for both emoji and GIFs, switched by a top-level tab -
// two separate buttons crowded the compose row enough to push the send
// button off narrow screens.
export default function StickerPicker({ savedChat, onClose, onSelectEmoji, onSelectGif }: StickerPickerProps) {
    const language = useLanguage();
    const tr = CHAT_WINDOW_TRANSLATIONS[language];
    const closeAria = GIF_PICKER_TRANSLATIONS[language].closeAria;
    const [tab, setTab] = useState<"emoji" | "gif">("emoji");

    return (
        <aside className={styles.panel}>
            <div className={styles.topBar}>
                <div className={styles.topTabs}>
                    <button
                        className={`${styles.topTab} ${tab === "emoji" ? styles.topTabActive : ""}`}
                        onClick={() => setTab("emoji")}
                        aria-label={tr.emojiAria}
                        title={tr.emojiAria}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                            <path d="M9 9h.01M15 9h.01" />
                        </svg>
                    </button>
                    <button
                        className={`${styles.topTab} ${tab === "gif" ? styles.topTabActive : ""}`}
                        onClick={() => setTab("gif")}
                        aria-label={tr.savedGifsAria}
                        title={tr.savedGifsAria}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="5" width="18" height="14" rx="2" />
                            <path d="M7 9v6M11 9v6M11 12h2M16 9v6M16 9h3M16 12h2" />
                        </svg>
                    </button>
                </div>
                <button className={styles.closeBtn} onClick={onClose} aria-label={closeAria}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {tab === "emoji" ? (
                <EmojiPicker variant="embedded" onClose={onClose} onSelect={onSelectEmoji} />
            ) : (
                <GifPicker variant="embedded" savedChat={savedChat} onClose={onClose} onSelect={onSelectGif} />
            )}
        </aside>
    );
}
