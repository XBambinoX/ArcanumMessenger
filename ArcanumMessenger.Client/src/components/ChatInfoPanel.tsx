import { useState } from "react";
import type { ChatSummary } from "../types/messenger";
import { deleteChat, leaveGroup } from "../api/chats";
import { getUserAvatarUrl } from "../api/users";
import AvatarImage from "./AvatarImage";
import styles from "./ChatInfoPanel.module.css";

interface ChatInfoPanelProps {
    chat: ChatSummary;
    onClose: () => void;
    onChatRemoved: (chatId: string) => void;
}

// Media history and message count are previews - no backend for either yet.
export default function ChatInfoPanel({ chat, onClose, onChatRemoved }: ChatInfoPanelProps) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    const handleDelete = async (forEveryone: boolean) => {
        if (busy) return;
        setBusy(true);
        const ok = await deleteChat(chat.id, forEveryone);
        setBusy(false);
        if (ok) onChatRemoved(chat.id);
    };

    const handleLeave = async () => {
        if (busy) return;
        setBusy(true);
        const ok = await leaveGroup(chat.id);
        setBusy(false);
        if (ok) onChatRemoved(chat.id);
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <aside
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className={styles.closeBtn}
                    onClick={onClose}
                    aria-label="Close"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                    >
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>

                {confirming ? (
                    <div className={styles.confirmView}>
                        {chat.type === "group" ? (
                            <>
                                <h3 className={styles.confirmTitle}>Leave group?</h3>
                                <p className={styles.confirmText}>
                                    You won't receive messages from "{chat.title}" anymore.
                                </p>
                                <button
                                    className={styles.dangerBtn}
                                    onClick={handleLeave}
                                    disabled={busy}
                                >
                                    Leave group
                                </button>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => setConfirming(false)}
                                    disabled={busy}
                                >
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <h3 className={styles.confirmTitle}>Delete chat?</h3>
                                <p className={styles.confirmText}>
                                    Choose who this disappears for.
                                </p>
                                <button
                                    className={styles.dangerBtn}
                                    onClick={() => handleDelete(false)}
                                    disabled={busy}
                                >
                                    Delete for me
                                </button>
                                <button
                                    className={styles.dangerBtn}
                                    onClick={() => handleDelete(true)}
                                    disabled={busy}
                                >
                                    Delete for everyone
                                </button>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => setConfirming(false)}
                                    disabled={busy}
                                >
                                    Cancel
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className={styles.chatHeader}>
                            <div
                                className={`${styles.chatAvatar} ${chat.type === "group" ? styles.chatAvatarGroup : ""} ${chat.type === "saved" ? styles.chatAvatarSaved : ""}`}
                            >
                                {chat.type === "saved" ? (
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                                    </svg>
                                ) : (
                                    <AvatarImage
                                        src={chat.type === "direct" && chat.otherUserId ? getUserAvatarUrl(chat.otherUserId) : null}
                                        fallback={chat.title.charAt(0).toUpperCase()}
                                    />
                                )}
                            </div>
                            <span className={styles.chatTitle}>
                                {chat.title}
                            </span>
                            <span className={styles.chatSubtitle}>
                                {chat.type === "group"
                                    ? "Group chat"
                                    : chat.type === "saved"
                                    ? "Saved Messages"
                                    : "Direct chat"}
                            </span>
                        </div>

                        <section className={styles.infoSection}>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>
                                    Media
                                </span>
                                <span className={styles.infoValue}>
                                    No media yet
                                </span>
                            </div>
                            <div className={styles.infoRow}>
                                <span className={styles.infoLabel}>
                                    Messages
                                </span>
                                <span className={styles.infoValue}>
                                    Coming soon
                                </span>
                            </div>
                        </section>

                        {chat.type !== "saved" && (
                            <button
                                className={styles.deleteBtn}
                                onClick={() => setConfirming(true)}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    {chat.type === "group" ? (
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                                    ) : (
                                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                                    )}
                                </svg>
                                {chat.type === "group" ? "Leave group" : "Delete chat"}
                            </button>
                        )}
                    </>
                )}
            </aside>
        </div>
    );
}
