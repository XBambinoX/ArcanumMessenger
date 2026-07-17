import { useEffect, useState } from "react";
import type { HubConnection } from "@microsoft/signalr";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/session";
import { getChats, markChatRead, setChatArchived } from "../api/chats";
import { createChatHubConnection } from "../lib/chatHub";
import { useAuth } from "../context/AuthContext";
import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";
import SettingsPanel from "../components/SettingsPanel";
import type { ChatFolder, ChatMessage, ChatSummary } from "../types/messenger";
import styles from "./AppPage.module.css";

const folders: { id: ChatFolder; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "archive", label: "Archive" },
];

export default function AppPage() {
    const navigate = useNavigate();
    const { setAuthenticated } = useAuth();

    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [folder, setFolder] = useState<ChatFolder>("all");
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [connection, setConnection] = useState<HubConnection | null>(null);

    useEffect(() => {
        getChats().then(setChats);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const conn = createChatHubConnection();

        conn.start()
            .then(() => {
                if (!cancelled) setConnection(conn);
            })
            .catch(() => {
                // Expected under StrictMode's mount->cleanup->mount in dev:
                // the cleanup below stops the connection before start() finishes.
            });

        return () => {
            cancelled = true;
            conn.stop();
        };
    }, []);

    useEffect(() => {
        if (!connection) return;

        const handleReceiveMessage = (message: ChatMessage) => {
            const isOpen = message.chatId === selectedChatId;

            setChats((prev) =>
                prev.map((c) =>
                    c.id === message.chatId
                        ? {
                              ...c,
                              lastMessageText: message.content,
                              lastMessageAt: message.createdAt,
                              unreadCount: isOpen ? c.unreadCount : c.unreadCount + 1,
                          }
                        : c,
                ),
            );

            if (isOpen) markChatRead(message.chatId);
        };

        const handleChatCreated = (chat: ChatSummary) => {
            setChats((prev) => [chat, ...prev]);
        };

        connection.on("ReceiveMessage", handleReceiveMessage);
        connection.on("ChatCreated", handleChatCreated);

        return () => {
            connection.off("ReceiveMessage", handleReceiveMessage);
            connection.off("ChatCreated", handleChatCreated);
        };
    }, [connection, selectedChatId]);

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
        const chat = chats.find((c) => c.id === chatId);
        if (!chat) return;
        const isArchived = !chat.isArchived;

        setChats((prev) =>
            prev.map((c) => (c.id === chatId ? { ...c, isArchived } : c)),
        );
        setChatArchived(chatId, isArchived);
    };

    const handleSelectChat = (chatId: string) => {
        setSelectedChatId(chatId);

        const chat = chats.find((c) => c.id === chatId);
        if (!chat || chat.unreadCount === 0) return;

        setChats((prev) =>
            prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
        );
        markChatRead(chatId);
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
                            <img
                                className={styles.logoImg}
                                src="/logo.svg"
                                alt="Arcanum"
                            />
                        </div>
                        <span className={styles.brand}>Arcanum</span>
                        <button
                            className={styles.iconBtn}
                            onClick={() => setSettingsOpen(true)}
                            aria-label="Settings"
                            title="Settings"
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
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
                        onSelect={handleSelectChat}
                        onToggleArchive={toggleArchive}
                    />
                </div>
            </aside>

            <main className={styles.main}>
                {selectedChat ? (
                    <ChatWindow
                        key={selectedChat.id}
                        chat={selectedChat}
                        connection={connection}
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

            {settingsOpen && (
                <SettingsPanel
                    onClose={() => setSettingsOpen(false)}
                    onLogout={handleLogout}
                />
            )}
        </div>
    );
}
