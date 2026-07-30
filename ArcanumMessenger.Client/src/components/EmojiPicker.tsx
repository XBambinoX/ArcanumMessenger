import { useState } from "react";
import { emojiCategories } from "../lib/emoji";
import styles from "./EmojiPicker.module.css";

interface EmojiPickerProps {
    onClose: () => void;
    onSelect: (emoji: string) => void;
}

export default function EmojiPicker({ onClose, onSelect }: EmojiPickerProps) {
    const [activeCategory, setActiveCategory] = useState(0);

    return (
        <aside className={styles.panel}>
            <header className={styles.header}>
                <div className={styles.tabs}>
                    {emojiCategories.map((category, i) => (
                        <button
                            key={category.label}
                            className={`${styles.tab} ${activeCategory === i ? styles.tabActive : ""}`}
                            onClick={() => setActiveCategory(i)}
                            title={category.label}
                        >
                            {category.emojis[0]}
                        </button>
                    ))}
                </div>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </header>

            <div className={styles.grid}>
                {emojiCategories[activeCategory].emojis.map((emoji, i) => (
                    <button key={i} className={styles.emojiBtn} onClick={() => onSelect(emoji)}>
                        {emoji}
                    </button>
                ))}
            </div>
        </aside>
    );
}
