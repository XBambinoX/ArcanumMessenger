import { useEffect, useRef, useState } from "react";
import type { HubConnection } from "@microsoft/signalr";
import { useNavigate } from "react-router-dom";
import { logout } from "../api/session";
import { getChats, markChatRead, setChatArchived } from "../api/chats";
import { getMe, getUserPresence, getPresenceBulk } from "../api/users";
import { createChatHubConnection } from "../lib/chatHub";
import { type UserSettingsResponse, getUserSettings  } from "../api/userSettings";
import { playNotificationSound } from "../lib/notificationSound";
import { useAuth } from "../context/AuthContext";
import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";
import ProfilePanel from "../components/ProfilePanel";
import NewChatPanel from "../components/NewChatPanel";
import type { ChatFolder, ChatMessage, ChatSummary, User } from "../types/messenger";
import styles from "./AppPage.module.css";

interface PresenceInfo {
    isOnline: boolean;
    lastSeen: string | null;
}

const folders: { id: ChatFolder; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread" },
    { id: "archive", label: "Archive" },
];

const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 340;

function readStoredSidebarWidth(): number {
    const saved = Number(localStorage.getItem("sidebarWidth"));
    return saved >= MIN_SIDEBAR_WIDTH && saved <= MAX_SIDEBAR_WIDTH
        ? saved
        : DEFAULT_SIDEBAR_WIDTH;
}

export default function AppPage() {
    const navigate = useNavigate();
    const { setAuthenticated } = useAuth();

    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [profile, setProfile] = useState<User | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [folder, setFolder] = useState<ChatFolder>("all");
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [profileOpen, setProfileOpen] = useState(false);
    const [newChatOpen, setNewChatOpen] = useState(false);
    const [connection, setConnection] = useState<HubConnection | null>(null);
    const [sidebarWidth, setSidebarWidth] = useState(readStoredSidebarWidth);
    const sidebarWidthRef = useRef(sidebarWidth);
    
    const [presence, setPresence] = useState<Record<string, PresenceInfo>>({});

    const [notificationSettings, setNotificationSettings] = useState<UserSettingsResponse | null>(null);
    const chatsRef = useRef<ChatSummary[]>([]);
    const notificationSettingsRef = useRef<UserSettingsResponse | null>(null);

    useEffect(() => {
        chatsRef.current = chats;
    }, [chats]);

    useEffect(() => {
        notificationSettingsRef.current = notificationSettings;
    }, [notificationSettings]);

    useEffect(() => {
        getChats().then((loadedChats) => {
            setChats(loadedChats);

            const otherUserIds = loadedChats
                .filter((c) => c.type === "direct" && c.otherUserId)
                .map((c) => c.otherUserId!);

            if (otherUserIds.length === 0) return;

            getPresenceBulk(otherUserIds).then((items) => {
                setPresence((prev) => {
                    const next = { ...prev };
                    for (const item of items) {
                        next[item.userId] = { isOnline: item.isOnline, lastSeen: item.lastSeen };
                    }
                    return next;
                });
            });
        });

        getMe().then((me) => {
            setProfile(me);
            setDisplayName(me!.name);
        });

        getUserSettings().then((settings) => {
            if (settings) setNotificationSettings(settings);
        });
    }, []);

    useEffect(() => {
        let cancelled = false;
        const conn = createChatHubConnection();

        conn.start()
            .then(() => {
                if (!cancelled) setConnection(conn);
            })
            .catch(() => {
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

            if (isOpen) {
                markChatRead(message.chatId);
            } else if (!message.isOwn) {
                const chat = chatsRef.current.find((c) => c.id === message.chatId);
                const settings = notificationSettingsRef.current;

                if (chat && !chat.isMuted && settings) {
                    const enabled =
                        chat.type === "group"
                            ? settings.groupNotifications
                            : settings.notificationsEnabled;

                    if (enabled) playNotificationSound(settings.notificationSound);
                }
            }
        };

        const handleChatCreated = (chat: ChatSummary) => {
            setChats((prev) => [chat, ...prev]);
        };

        const handleUserOnline = (userId: string) => {
            setPresence((prev) => ({
                ...prev,
                [userId]: { isOnline: true, lastSeen: null },
            }));
        };

        const handleUserOffline = (userId: string, lastSeen: string | null) => {
            setPresence((prev) => ({
                ...prev,
                [userId]: { isOnline: false, lastSeen },
            }));
        };

        connection.on("ReceiveMessage", handleReceiveMessage);
        connection.on("ChatCreated", handleChatCreated);
        connection.on("UserOnline", handleUserOnline);
        connection.on("UserOffline", handleUserOffline);

        return () => {
            connection.off("ReceiveMessage", handleReceiveMessage);
            connection.off("ChatCreated", handleChatCreated);
            connection.off("UserOnline", handleUserOnline);
            connection.off("UserOffline", handleUserOffline);
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
        if (!chat) return;

        if (chat.unreadCount > 0) {
            setChats((prev) =>
                prev.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
            );
            markChatRead(chatId);
        }

        if (chat.type === "direct" && chat.otherUserId) {
            const otherUserId = chat.otherUserId;
            getUserPresence(otherUserId).then((data) => {
                if (!data) return;
                setPresence((prev) => ({
                    ...prev,
                    [otherUserId]: data,
                }));
            });
        }
    };

    const handleStartChat = (chat: ChatSummary) => {
        setChats((prev) =>
            prev.some((c) => c.id === chat.id) ? prev : [chat, ...prev],
        );
        setSelectedChatId(chat.id);
        setNewChatOpen(false);
    };

    const handleLogout = async () => {
        await logout();
        setAuthenticated(false);
        navigate("/welcome");
    };

    const handleSidebarResizeStart = (e: React.PointerEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = sidebarWidthRef.current;

        const handleMove = (moveEvent: PointerEvent) => {
            const next = Math.min(
                MAX_SIDEBAR_WIDTH,
                Math.max(MIN_SIDEBAR_WIDTH, startWidth + (moveEvent.clientX - startX)),
            );
            sidebarWidthRef.current = next;
            setSidebarWidth(next);
        };
        const handleUp = () => {
            window.removeEventListener("pointermove", handleMove);
            window.removeEventListener("pointerup", handleUp);
            localStorage.setItem("sidebarWidth", String(sidebarWidthRef.current));
        };

        window.addEventListener("pointermove", handleMove);
        window.addEventListener("pointerup", handleUp);
    };

    return (
        <div className={styles.root}>
            <aside className={styles.sidebar} style={{ width: sidebarWidth }}>
                <div
                    className={styles.resizeHandle}
                    onPointerDown={handleSidebarResizeStart}
                />
                <header className={styles.sidebarHeader}>
                    <div className={styles.brandRow}>
                        <button
                            className={styles.profileBtn}
                            onClick={() => setProfileOpen(true)}
                            aria-label="Profile"
                            title="Profile"
                        >
                            <span className={styles.avatarBtn}>
                                {(displayName ?? profile?.name ?? "?").charAt(0).toUpperCase()}
                            </span>

                            <span className={styles.profileName}>
                                {displayName ?? profile?.name ?? "Loading..."}
                            </span>
                        </button>
                        <button
                            className={styles.iconBtn}
                            onClick={() => setNewChatOpen(true)}
                            aria-label="New chat"
                            title="New chat"
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
                                <path d="M12 5v14M5 12h14" />
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
                        presence={presence}
                    />
                </div>
            </aside>

            <main className={styles.main}>
                {selectedChat ? (
                    <ChatWindow
                        key={selectedChat.id}
                        chat={selectedChat}
                        connection={connection}
                        onStartChat={handleStartChat}
                        presence={selectedChat.otherUserId ? presence[selectedChat.otherUserId] : undefined}
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

            {profileOpen && profile && (
                <ProfilePanel
                    profile={profile}
                    onClose={() => setProfileOpen(false)}
                    onLogout={handleLogout}
                    onUsernameChange={(username) => setDisplayName(username || profile.name)}
                />
            )}

            {newChatOpen && (
                <NewChatPanel
                    onClose={() => setNewChatOpen(false)}
                    onStartChat={handleStartChat}
                />
            )}
        </div>
    );
}