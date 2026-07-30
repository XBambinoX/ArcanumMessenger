import { useEffect, useState } from "react";
import { getContacts } from "../api/contacts";
import { searchUsers, getUser, getUserAvatarUrl } from "../api/users";
import type { ChatSummary, User, UserSearchResult } from "../types/messenger";
import UserInfoPanel from "./UserInfoPanel";
import AvatarImage from "./AvatarImage";
import styles from "./NewChatPanel.module.css";

const MIN_SEARCH_LENGTH = 4;
const SEARCH_DEBOUNCE_MS = 350;

interface NewChatPanelProps {
    onClose: () => void;
    onStartChat: (chat: ChatSummary) => void;
}

// Creating a group isn't wired up yet.
export default function NewChatPanel({ onClose, onStartChat }: NewChatPanelProps) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [contacts, setContacts] = useState<UserSearchResult[]>([]);
    const [viewedUser, setViewedUser] = useState<{ userId: string; user: User } | null>(null);
    const query = search.trim();

    useEffect(() => {
        getContacts().then(setContacts);
    }, []);

    useEffect(() => {
        if (query.length < MIN_SEARCH_LENGTH) {
            setResults([]);
            return;
        }

        const timer = setTimeout(() => {
            searchUsers(query).then(setResults);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [query]);

    const handleViewUser = async (id: string) => {
        const user = await getUser(id);
        if (user) setViewedUser({ userId: id, user });
    };

    return (
        <>
        <div className={styles.overlay} onClick={onClose}>
            <aside
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
            >
                <header className={styles.header}>
                    <h2 className={styles.title}>New chat</h2>
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
                </header>

                <input
                    className={styles.search}
                    type="text"
                    placeholder="Find a user by ID"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                <button className={styles.groupBtn}>
                    <span className={styles.groupIcon}>
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
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </span>
                    Create a group
                </button>

                {query.length > 0 ? (
                    <>
                        <h3 className={styles.sectionTitle}>Search results</h3>
                        {query.length < MIN_SEARCH_LENGTH ? (
                            <p className={styles.note}>
                                Type at least {MIN_SEARCH_LENGTH} characters
                                of the ID.
                            </p>
                        ) : results.length === 0 ? (
                            <p className={styles.note}>No matches.</p>
                        ) : (
                            <ul className={styles.contactList}>
                                {results.map((result) => (
                                    <li key={result.id}>
                                        <button
                                            className={styles.contactRow}
                                            onClick={() =>
                                                handleViewUser(result.id)
                                            }
                                        >
                                            <div
                                                className={
                                                    styles.contactAvatar
                                                }
                                            >
                                                <AvatarImage
                                                    src={getUserAvatarUrl(result.id)}
                                                    fallback={result.name.charAt(0).toUpperCase()}
                                                />
                                            </div>
                                            <span>{result.name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                ) : (
                    <>
                        <h3 className={styles.sectionTitle}>Contacts</h3>
                        {contacts.length === 0 ? (
                            <p className={styles.note}>
                                No contacts yet – find someone by ID above.
                            </p>
                        ) : (
                            <ul className={styles.contactList}>
                                {contacts.map((contact) => (
                                    <li key={contact.id}>
                                        <button
                                            className={styles.contactRow}
                                            onClick={() =>
                                                handleViewUser(contact.id)
                                            }
                                        >
                                            <div
                                                className={
                                                    styles.contactAvatar
                                                }
                                            >
                                                <AvatarImage
                                                    src={getUserAvatarUrl(contact.id)}
                                                    fallback={contact.name.charAt(0).toUpperCase()}
                                                />
                                            </div>
                                            <span>{contact.name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </aside>
        </div>

        {viewedUser && (
            <UserInfoPanel
                userId={viewedUser.userId}
                user={viewedUser.user}
                onClose={() => setViewedUser(null)}
                onStartChat={onStartChat}
            />
        )}
        </>
    );
}
