import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/session";
import { useAuth } from "../context/AuthContext";
import ChatList from "../components/ChatList";
import { mockChats } from "../mock/chats";
import styles from "./AppPage.module.css";

export default function AppPage() {
    const navigate = useNavigate();
    const { setAuthenticated } = useAuth();

    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const visibleChats = mockChats.filter(
        (chat) =>
            !chat.isArchived &&
            chat.title.toLowerCase().includes(search.trim().toLowerCase()),
    );

    const handleLogout = async () => {
        await logout();
        setAuthenticated(false);
        navigate("/welcome");
    };

    return (
        <div className={styles.root}>
            <aside className={styles.sidebar}>
                <header className={styles.sidebarHeader}>
                    <div className={styles.brandRow}>
                        <div className={styles.logoBox}>
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 48 48"
                                fill="none"
                            >
                                <path
                                    d="M16 12H32a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H20l-6 5v-5a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z"
                                    stroke="url(#rg)"
                                    strokeWidth="2.2"
                                    fill="none"
                                    strokeLinejoin="round"
                                />
                                <defs>
                                    <linearGradient
                                        id="rg"
                                        x1="6"
                                        y1="4"
                                        x2="42"
                                        y2="44"
                                        gradientUnits="userSpaceOnUse"
                                    >
                                        <stop stopColor="#a78bfa" />
                                        <stop offset="1" stopColor="#22d3ee" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                        <span className={styles.brand}>Arcanum</span>
                        <button
                            className={styles.iconBtn}
                            onClick={handleLogout}
                            aria-label="Log out"
                            title="Log out"
                        >
                            <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <path d="M16 17l5-5-5-5M21 12H9" />
                            </svg>
                        </button>
                    </div>
                    <input
                        className={styles.search}
                        type="text"
                        placeholder="Search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </header>

                <div className={styles.chatListArea}>
                    <ChatList
                        chats={visibleChats}
                        selectedChatId={selectedChatId}
                        onSelect={setSelectedChatId}
                    />
                </div>
            </aside>

            <main className={styles.main}>
                <div className={styles.emptyState}>
                    <svg
                        width="56"
                        height="56"
                        viewBox="0 0 48 48"
                        fill="none"
                    >
                        <path
                            d="M16 12H32a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H20l-6 5v-5a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z"
                            stroke="url(#eg)"
                            strokeWidth="2"
                            fill="none"
                            strokeLinejoin="round"
                        />
                        <defs>
                            <linearGradient
                                id="eg"
                                x1="6"
                                y1="4"
                                x2="42"
                                y2="44"
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop stopColor="#a78bfa" stopOpacity="0.5" />
                                <stop
                                    offset="1"
                                    stopColor="#22d3ee"
                                    stopOpacity="0.5"
                                />
                            </linearGradient>
                        </defs>
                    </svg>
                    <p className={styles.emptyText}>
                        Select a chat to start messaging
                    </p>
                </div>
            </main>
        </div>
    );
}
