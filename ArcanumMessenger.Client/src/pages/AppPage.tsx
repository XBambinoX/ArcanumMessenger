import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/session";
import { useAuth } from "../context/AuthContext";
import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";
import { mockChats } from "../mock/chats";
import { mockMessages } from "../mock/messages";
import type { ChatFolder } from "../types/messenger";
import styles from "./AppPage.module.css";

const folders: { id: ChatFolder; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "archive", label: "Archive" },
];

export default function AppPage() {
    const navigate = useNavigate();
    const { setAuthenticated } = useAuth();

    // Local state seeded from mocks - becomes server data once the
    // chats API exists.
    const [chats, setChats] = useState(mockChats);
    const [folder, setFolder] = useState<ChatFolder>("all");
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const inFolder = {
        all: (isArchived: boolean, _unread: number) => !isArchived,
        unread: (isArchived: boolean, unread: number) =>
            !isArchived && unread > 0,
        archive: (isArchived: boolean, _unread: number) => isArchived,
    }[folder];

    const visibleChats = chats.filter(
        (chat) =>
            inFolder(chat.isArchived, chat.unreadCount) &&
            chat.title.toLowerCase().includes(search.trim().toLowerCase()),
    );

    const unreadChatCount = chats.filter(
        (chat) => !chat.isArchived && chat.unreadCount > 0,
    ).length;

    const selectedChat =
        chats.find((chat) => chat.id === selectedChatId) ?? null;

    const toggleArchive = (chatId: string) => {
        setChats((prev) =>
            prev.map((chat) =>
                chat.id === chatId
                    ? { ...chat, isArchived: !chat.isArchived }
                    : chat,
            ),
        );
    };

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
                    <nav className={styles.folders}>
                        {folders.map(({ id, label }) => (
                            <button
                                key={id}
                                className={`${styles.folderTab} ${folder === id ? styles.folderActive : ""}`}
                                onClick={() => setFolder(id)}
                            >
                                {label}
                                {id === "unread" && unreadChatCount > 0 && (
                                    <span className={styles.folderCount}>
                                        {unreadChatCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>
                </header>

                <div className={styles.chatListArea}>
                    <ChatList
                        chats={visibleChats}
                        selectedChatId={selectedChatId}
                        onSelect={setSelectedChatId}
                        onToggleArchive={toggleArchive}
                    />
                </div>
            </aside>

            <main className={styles.main}>
                {selectedChat ? (
                    <ChatWindow
                        key={selectedChat.id}
                        chat={selectedChat}
                        initialMessages={mockMessages[selectedChat.id] ?? []}
                    />
                ) : (
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
                                    <stop
                                        stopColor="#a78bfa"
                                        stopOpacity="0.5"
                                    />
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
                )}
            </main>
        </div>
    );
}
