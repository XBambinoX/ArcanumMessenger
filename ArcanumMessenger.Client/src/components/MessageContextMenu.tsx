import { useEffect, useRef } from "react";
import styles from "./MessageContextMenu.module.css";

export interface MessageContextMenuItem {
    label: string;
    onClick: () => void;
    danger?: boolean;
}

interface MessageContextMenuProps {
    x: number;
    y: number;
    items: MessageContextMenuItem[];
    // A row of one-tap emoji shown above the menu items, Telegram/WhatsApp
    // style - onMoreReactions opens the full emoji picker for anything not
    // in this quick set.
    quickReactions?: string[];
    onReact?: (emoji: string) => void;
    onMoreReactions?: () => void;
    onClose: () => void;
}

const MENU_WIDTH = 190;
const STRIP_HEIGHT = 50;

export default function MessageContextMenu({
    x, y, items, quickReactions, onReact, onMoreReactions, onClose,
}: MessageContextMenuProps) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const handlePointerDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    const hasStrip = !!quickReactions?.length;
    const stripHeight = hasStrip ? STRIP_HEIGHT : 0;
    const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
    const top = Math.min(y, window.innerHeight - items.length * 38 - stripHeight - 16);

    if (items.length === 0 && !hasStrip) return null;

    return (
        <div ref={ref} className={styles.menu} style={{ left, top, width: MENU_WIDTH }}>
            {hasStrip && (
                <div className={styles.reactionStrip}>
                    {quickReactions.map((emoji) => (
                        <button
                            key={emoji}
                            className={styles.reactionStripBtn}
                            // Stays open - picking a reaction here is
                            // add-only (see ChatWindow's handleAddReaction),
                            // so there's no harm in tapping several in a
                            // row without reopening the menu each time.
                            onClick={() => onReact?.(emoji)}
                        >
                            {emoji}
                        </button>
                    ))}
                    <button
                        className={styles.reactionMoreBtn}
                        onClick={() => onMoreReactions?.()}
                        aria-label="More reactions"
                    >
                        +
                    </button>
                </div>
            )}
            {items.map((item) => (
                <button
                    key={item.label}
                    className={`${styles.menuItem} ${item.danger ? styles.menuItemDanger : ""}`}
                    onClick={() => {
                        item.onClick();
                        onClose();
                    }}
                >
                    {item.label}
                </button>
            ))}
        </div>
    );
}
