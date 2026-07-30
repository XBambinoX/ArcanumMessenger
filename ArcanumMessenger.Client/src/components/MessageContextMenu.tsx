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
    onClose: () => void;
}

const MENU_WIDTH = 190;

export default function MessageContextMenu({ x, y, items, onClose }: MessageContextMenuProps) {
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

    const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
    const top = Math.min(y, window.innerHeight - items.length * 38 - 16);

    if (items.length === 0) return null;

    return (
        <div ref={ref} className={styles.menu} style={{ left, top, width: MENU_WIDTH }}>
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
