import { useEffect, useState } from "react";
import type { ChatSummary } from "../types/messenger";
import { getChats } from "../api/chats";
import { getUserAvatarUrl } from "../api/users";
import AvatarImage from "./AvatarImage";
import styles from "./ForwardPanel.module.css";

interface ForwardPanelProps {
    onClose: () => void;
    // The full chat, not just its id - the caller needs its wrappedChatKey
    // to re-encrypt forwarded content for this specific destination.
    onPick: (chat: ChatSummary) => void;
}

// A "forward to..." destination pick is a rare, deliberate one-shot action -
// unlike the gif picker (repeat-use, anchored near its button), a centered
// modal with a dim backdrop is the right call here.
export default function ForwardPanel({ onClose, onPick }: ForwardPanelProps) {
    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        getChats().then((result) => {
            setChats(result);
            setLoaded(true);
        });
    }, []);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <aside className={styles.panel} onClick={(e) => e.stopPropagation()}>
                <header className={styles.header}>
                    <h2 className={styles.title}>Forward to…</h2>
                    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                {loaded && chats.length === 0 && (
                    <p className={styles.note}>No chats to forward to yet</p>
                )}

                <div className={styles.list}>
                    {chats.map((chat) => (
                        <button key={chat.id} className={styles.chatRow} onClick={() => onPick(chat)}>
                            <div className={`${styles.avatar} ${chat.type === "group" ? styles.avatarGroup : ""}`}>
                                <AvatarImage
                                    src={chat.type === "direct" && chat.otherUserId ? getUserAvatarUrl(chat.otherUserId) : null}
                                    fallback={chat.title.charAt(0).toUpperCase()}
                                />
                            </div>
                            <span className={styles.chatTitle}>{chat.title}</span>
                        </button>
                    ))}
                </div>
            </aside>
        </div>
    );
}
