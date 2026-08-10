import { useState } from "react";
import { emojiCategories, type EmojiCategory } from "../lib/emoji";
import styles from "./EmojiPicker.module.css";
import { useLanguage } from "../lib/language";
import { EMOJI_PICKER_TRANSLATIONS } from "../lib/chatWindowTranslations";

interface EmojiPickerProps {
    onClose: () => void;
    onSelect: (emoji: string) => void;
    // "embedded" drops the outer panel shell and close button - used by
    // StickerPicker, which provides its own shared shell/close button
    // around this and GifPicker's content under one set of tabs.
    variant?: "standalone" | "embedded";
}

export default function EmojiPicker({ onClose, onSelect, variant = "standalone" }: EmojiPickerProps) {
    const [activeCategory, setActiveCategory] = useState(0);
    const tr = EMOJI_PICKER_TRANSLATIONS[useLanguage()];
    const categoryLabel = (category: EmojiCategory) =>
        tr.categories[category.id as keyof typeof tr.categories];

    const body = (
        <>
            <div className={styles.header}>
                <div className={styles.tabs}>
                    {emojiCategories.map((category, i) => (
                        <button
                            key={category.id}
                            className={`${styles.tab} ${activeCategory === i ? styles.tabActive : ""}`}
                            onClick={() => setActiveCategory(i)}
                            title={categoryLabel(category)}
                        >
                            {category.emojis[0]}
                        </button>
                    ))}
                </div>
                {variant === "standalone" && (
                    <button className={styles.closeBtn} onClick={onClose} aria-label={tr.closeAria}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>

            <div className={styles.grid}>
                {emojiCategories[activeCategory].emojis.map((emoji, i) => (
                    <button key={i} className={styles.emojiBtn} onClick={() => onSelect(emoji)}>
                        {emoji}
                    </button>
                ))}
            </div>
        </>
    );

    return variant === "standalone" ? <aside className={styles.panel}>{body}</aside> : body;
}
