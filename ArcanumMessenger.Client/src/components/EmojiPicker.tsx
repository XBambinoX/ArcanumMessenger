import { useState } from "react";
import { emojiCategories, type EmojiCategory } from "../lib/emoji";
import { getFrequentReactionEmojis } from "../lib/emojiUsage";
import { isRegionalIndicator, ZERO_WIDTH_SPACE } from "../lib/regionalIndicator";
import styles from "./EmojiPicker.module.css";
import { useLanguage } from "../lib/language";
import { EMOJI_PICKER_TRANSLATIONS } from "../lib/chatWindowTranslations";

const FREQUENT_LIMIT = 32;

interface EmojiPickerProps {
    onClose: () => void;
    onSelect: (emoji: string) => void;
    // "embedded" drops the outer panel shell and close button - used by
    // StickerPicker, which provides its own shared shell/close button
    // around this and GifPicker's content under one set of tabs.
    variant?: "standalone" | "embedded";
    // Which side of the anchor point the panel opens toward. "up" (default)
    // matches the compose bar's own emoji button, which sits at the bottom
    // of the screen. A picker anchored to an arbitrary message instead
    // needs to flip to "down" when there isn't enough room above it.
    placement?: "up" | "down";
    // Leading "Frequently Used" tab, built from this device's own reaction
    // history (see lib/emojiUsage.ts) - only meaningful for the reaction
    // picker, not the compose bar's general emoji-insert picker.
    showFrequent?: boolean;
}

export default function EmojiPicker({
    onClose, onSelect, variant = "standalone", placement = "up", showFrequent = false,
}: EmojiPickerProps) {
    // Read once per time the picker opens (it's remounted each open) -
    // doesn't need to reorder live while a single session is still open.
    const [frequentEmojis] = useState(() => (showFrequent ? getFrequentReactionEmojis(FREQUENT_LIMIT) : []));
    const categories: EmojiCategory[] = frequentEmojis.length > 0
        ? [{ id: "frequent", label: "Frequently Used", emojis: frequentEmojis }, ...emojiCategories]
        : emojiCategories;
    const [activeCategory, setActiveCategory] = useState(0);
    const tr = EMOJI_PICKER_TRANSLATIONS[useLanguage()];
    const categoryLabel = (category: EmojiCategory) =>
        tr.categories[category.id as keyof typeof tr.categories];

    const body = (
        <>
            <div className={styles.header}>
                <div className={styles.tabs}>
                    {categories.map((category, i) => (
                        <button
                            key={category.id}
                            className={`${styles.tab} ${activeCategory === i ? styles.tabActive : ""}`}
                            onClick={() => setActiveCategory(i)}
                            title={categoryLabel(category)}
                        >
                            {category.id === "frequent" ? "🕐" : category.emojis[0]}
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
                {categories[activeCategory].emojis.map((emoji, i) => (
                    <button
                        key={i}
                        className={styles.emojiBtn}
                        onClick={() => onSelect(isRegionalIndicator(emoji) ? emoji + ZERO_WIDTH_SPACE : emoji)}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </>
    );

    return variant === "standalone" ? (
        <aside className={`${styles.panel} ${placement === "down" ? styles.panelDown : ""}`}>{body}</aside>
    ) : body;
}
