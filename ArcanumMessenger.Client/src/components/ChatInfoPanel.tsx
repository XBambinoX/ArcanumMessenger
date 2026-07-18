import { useState } from "react";
import type { ChatSummary } from "../types/messenger";
import styles from "./ChatInfoPanel.module.css";

interface ChatInfoPanelProps {
    chat: ChatSummary;
    onClose: () => void;
}

// Media history and message count are previews - no backend for either
// yet. Deleting a chat isn't wired up either; picking an option below
// just says so instead of pretending to delete anything.
export default function ChatInfoPanel({ chat, onClose }: ChatInfoPanelProps) {
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleteNote, setDeleteNote] = useState(false);

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

                {confirmingDelete ? (
                    <div className={styles.confirmView}>
                        <h3 className={styles.confirmTitle}>Delete chat?</h3>
                        <p className={styles.confirmText}>
                            Choose who this disappears for.
                        </p>

                        {deleteNote ? (
                            <p className={styles.note}>
                                Deleting chats isn't connected yet – nothing
                                was deleted.
                            </p>
                        ) : (
                            <>
                                <button
                                    className={styles.dangerBtn}
                                    onClick={() => setDeleteNote(true)}
                                >
                                    Delete for me
                                </button>
                                <button
                                    className={styles.dangerBtn}
                                    onClick={() => setDeleteNote(true)}
                                >
                                    Delete for everyone
                                </button>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => setConfirmingDelete(false)}
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
                                className={`${styles.chatAvatar} ${chat.type === "group" ? styles.chatAvatarGroup : ""}`}
                            >
                                {chat.title.charAt(0).toUpperCase()}
                            </div>
                            <span className={styles.chatTitle}>
                                {chat.title}
                            </span>
                            <span className={styles.chatSubtitle}>
                                {chat.type === "group"
                                    ? "Group chat"
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

                        <button
                            className={styles.deleteBtn}
                            onClick={() => setConfirmingDelete(true)}
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
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                            </svg>
                            Delete chat
                        </button>
                    </>
                )}
            </aside>
        </div>
    );
}
