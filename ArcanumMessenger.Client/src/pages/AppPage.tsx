import { useEffect, useRef, useState } from "react";
import type { HubConnection } from "@microsoft/signalr";
import { useNavigate } from "react-router";
import { logout } from "../api/session";
import { getChats, markChatRead, setChatArchived } from "../api/chats";
import { getMe, getUserPresence, getPresenceBulk, getMyAvatarUrl } from "../api/users";
import { createChatHubConnection } from "../lib/chatHub";
import { type UserSettingsResponse, getUserSettings  } from "../api/userSettings";
import { playNotificationSound } from "../lib/notificationSound";
import { requestDesktopNotificationPermission, showDesktopNotification } from "../lib/desktopNotification";
import { decryptLastMessagePreview, decryptChatTitle } from "../lib/chatCrypto";
import { useIsMobile, useVisualViewportHeight } from "../lib/useMediaQuery";
import { useAuth } from "../context/AuthContext";
import ChatList from "../components/ChatList";
import ChatWindow from "../components/ChatWindow";
import ProfilePanel from "../components/ProfilePanel";
import NewChatPanel from "../components/NewChatPanel";
import AvatarImage from "../components/AvatarImage";
import type { ChatFolder, ChatMessage, ChatSummary, MessageType, User } from "../types/messenger";
import styles from "./AppPage.module.css";
import { useLanguage, getLanguage, setLanguage, type Language } from "../lib/language";
import { getTheme, setTheme, type Theme } from "../lib/theme";
import { APP_CHROME, APP_COMMON } from "../lib/appTranslations";

interface PresenceInfo {
    isOnline: boolean;
    lastSeen: string | null;
}

const MIN_SIDEBAR_WIDTH = 260;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 340;

const IDLE_TIMEOUT_MS = 30_000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "touchstart", "scroll"] as const;

function readStoredSidebarWidth(): number {
    const saved = Number(localStorage.getItem("sidebarWidth"));
    return saved >= MIN_SIDEBAR_WIDTH && saved <= MAX_SIDEBAR_WIDTH
        ? saved
        : DEFAULT_SIDEBAR_WIDTH;
}

export default function AppPage() {
    const navigate = useNavigate();
    const { setAuthenticated } = useAuth();
    const language = useLanguage();
    const tr = APP_CHROME[language];
    const common = APP_COMMON[language];

    const folders: { id: ChatFolder; label: string }[] = [
        { id: "all", label: tr.folderAll },
        { id: "unread", label: tr.folderUnread },
        { id: "archive", label: tr.folderArchive },
    ];

    const isMobile = useIsMobile();
    const vvHeight = useVisualViewportHeight();
    const [chats, setChats] = useState<ChatSummary[]>([]);
    const [profile, setProfile] = useState<User | null>(null);
    const [displayName, setDisplayName] = useState<string | null>(null);
    const [avatarNonce, setAvatarNonce] = useState(0);
    const [chatAvatarNonce, setChatAvatarNonce] = useState(0);
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
    const isIdleRef = useRef(false);
    const baseTitleRef = useRef(document.title);
    const selectedChatIdRef = useRef<string | null>(null);

    const handleNotificationSettingsChange = (
        sound: string,
        notificationsEnabled: boolean,
        groupNotifications: boolean,
    ) => {
        setNotificationSettings((prev) =>
            prev
                ? { ...prev, notificationSound: sound, notificationsEnabled, groupNotifications }
                : prev,
        );
    };

    // Only worth nagging the tab title while the user is away - if they're
    // actively looking at the app, the in-app badges already say enough.
    const applyTitleBadge = () => {
        if (!isIdleRef.current) return;

        const totalUnread = chatsRef.current.reduce(
            (sum, c) => sum + (c.isArchived ? 0 : c.unreadCount), 0,
        );
        document.title = totalUnread > 0 ? `(${totalUnread}) ${baseTitleRef.current}` : baseTitleRef.current;
    };

    useEffect(() => {
        chatsRef.current = chats;
        applyTitleBadge();
    }, [chats]);

    useEffect(() => {
        selectedChatIdRef.current = selectedChatId;
    }, [selectedChatId]);

    useEffect(() => {
        notificationSettingsRef.current = notificationSettings;
    }, [notificationSettings]);

    useEffect(() => {
        getChats().then(async (loadedChats) => {
            const decrypted = await Promise.all(
                loadedChats.map(async (chat) => {
                    const titled = await decryptChatTitle(chat);
                    return {
                        ...titled,
                        lastMessageText: await decryptLastMessagePreview(titled, titled.lastMessageText, titled.lastMessageType),
                    };
                }),
            );
            setChats(decrypted);

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
            if (!settings) return;
            setNotificationSettings(settings);

            // The account's saved language preference is the source of
            // truth on login - it may differ from whatever this browser
            // last had stored (e.g. first time on a new device).
            const accountLanguage = settings.language as Language;
            if (accountLanguage && accountLanguage !== getLanguage()) {
                setLanguage(accountLanguage);
            }

            // Same reasoning as language above - the account's saved theme
            // is the source of truth on login.
            const accountTheme = settings.theme as Theme;
            if (accountTheme && accountTheme !== getTheme()) {
                setTheme(accountTheme);
            }
        });

        requestDesktopNotificationPermission();
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

        let idleTimer: number | null = null;

        const goIdle = () => {
            isIdleRef.current = true;
            connection.invoke("GoIdle").catch(() => {});
            applyTitleBadge();
        };

        const resetIdleTimer = () => {
            if (isIdleRef.current) {
                isIdleRef.current = false;
                connection.invoke("GoActive").catch(() => {});
                document.title = baseTitleRef.current;

                // The chat that was open while idle stayed selected the whole
                // time - coming back to it shouldn't leave a stale unread badge.
                const openChatId = selectedChatIdRef.current;
                if (openChatId) {
                    setChats((prev) =>
                        prev.map((c) => (c.id === openChatId ? { ...c, unreadCount: 0 } : c)),
                    );
                    markChatRead(openChatId);
                }
            }
            if (idleTimer) window.clearTimeout(idleTimer);
            idleTimer = window.setTimeout(goIdle, IDLE_TIMEOUT_MS);
        };

        resetIdleTimer();
        ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetIdleTimer));

        return () => {
            if (idleTimer) window.clearTimeout(idleTimer);
            ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetIdleTimer));
        };
    }, [connection]);

    useEffect(() => {
        if (!connection) return;

    const handleReceiveMessage = async (message: ChatMessage) => {
            // A chat can be "open" in the UI while the user is idle - they're
            // not actually reading it, so it shouldn't auto-mark-read or skip
            // the away notification just because it happens to be selected.
            const isViewing = message.chatId === selectedChatId && !isIdleRef.current;

            const chat = chatsRef.current.find((c) => c.id === message.chatId);
            const previewText = chat
                ? await decryptLastMessagePreview(chat, message.content, message.type)
                : message.content;

            setChats((prev) =>
                prev.map((c) =>
                    c.id === message.chatId
                        ? {
                            ...c,
                            lastMessageText: previewText,
                            lastMessageType: message.type,
                            lastMessageAt: message.createdAt,
                            unreadCount: isViewing || message.isOwn ? c.unreadCount : c.unreadCount + 1,
                        }
                        : c,
                ),
            );

            if (isViewing) {
                markChatRead(message.chatId);
            } else if (!message.isOwn) {
                const settings = notificationSettingsRef.current;

                if (chat && !chat.isMuted && settings) {
                    const enabled =
                        chat.type === "group"
                            ? settings.groupNotifications
                            : settings.notificationsEnabled;

                    if (enabled) {
                        playNotificationSound(settings.notificationSound);

                        if (isIdleRef.current) {
                            showDesktopNotification(chat.title, previewText ?? "", () => {
                                setSelectedChatId(message.chatId);
                            });
                        }
                    }
                }
            }
        };

        // Your own sends/forwards now arrive here too (see MessageService),
        // which is what makes the case above need the isOwn check - without
        // it, forwarding into a chat you're not currently looking at would
        // mark your own outgoing message as unread.

        const handleMessageDeleted = async (
            chatId: string,
            _messageId: string,
            lastMessageText: string | null,
            lastMessageType: MessageType | null,
            lastMessageAt: string | null,
        ) => {
            const chat = chatsRef.current.find((c) => c.id === chatId);
            const decrypted = chat
                ? await decryptLastMessagePreview(chat, lastMessageText, lastMessageType)
                : lastMessageText;

            setChats((prev) =>
                prev.map((c) =>
                    c.id === chatId ? { ...c, lastMessageText: decrypted, lastMessageType, lastMessageAt } : c,
                ),
            );
        };

        // An edit only needs to touch the sidebar preview if it changed the
        // message that's currently shown as the chat's last one - comparing
        // timestamps (edits don't change createdAt) says exactly that without
        // the chat list needing to track message ids at all.
        const handleMessageEdited = async (message: ChatMessage) => {
            const chat = chatsRef.current.find((c) => c.id === message.chatId);
            if (!chat || chat.lastMessageAt !== message.createdAt) return;

            const content = await decryptLastMessagePreview(chat, message.content, message.type);
            setChats((prev) =>
                prev.map((c) =>
                    c.id === message.chatId && c.lastMessageAt === message.createdAt
                        ? { ...c, lastMessageText: content }
                        : c,
                ),
            );
        };

        const handleChatCreated = async (chat: ChatSummary) => {
            const titled = await decryptChatTitle(chat);
            setChats((prev) => [titled, ...prev]);

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

        const handleChatDeleted = (chatId: string) => handleChatRemoved(chatId);

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
        connection.on("MessageDeleted", handleMessageDeleted);
        connection.on("MessageEdited", handleMessageEdited);
        connection.on("ChatCreated", handleChatCreated);
        connection.on("ChatDeleted", handleChatDeleted);
        connection.on("UserOnline", handleUserOnline);
        connection.on("UserOffline", handleUserOffline);

        return () => {
            connection.off("ReceiveMessage", handleReceiveMessage);
            connection.off("MessageDeleted", handleMessageDeleted);
            connection.off("MessageEdited", handleMessageEdited);
            connection.off("ChatCreated", handleChatCreated);
            connection.off("ChatDeleted", handleChatDeleted);
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

    const handleStartChat = async (chat: ChatSummary) => {
        const titled = await decryptChatTitle(chat);
        setChats((prev) =>
            prev.some((c) => c.id === titled.id) ? prev : [titled, ...prev],
        );
        setSelectedChatId(titled.id);
        setNewChatOpen(false);

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

    const handleChatRemoved = (chatId: string) => {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        setSelectedChatId((prev) => (prev === chatId ? null : prev));
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
        <div className={styles.root} style={{ height: isMobile ? vvHeight : undefined }}>
            {(!isMobile || !selectedChatId) && (
            <aside className={styles.sidebar} style={{ width: isMobile ? undefined : sidebarWidth }}>
                {!isMobile && (
                    <div
                        className={styles.resizeHandle}
                        onPointerDown={handleSidebarResizeStart}
                    />
                )}
                <header className={styles.sidebarHeader}>
                    <div className={styles.brandRow}>
                        <button
                            className={styles.profileBtn}
                            onClick={() => setProfileOpen(true)}
                            aria-label={tr.profileAria}
                            title={tr.profileAria}
                        >
                            <span className={styles.avatarBtn}>
                                <AvatarImage
                                    src={getMyAvatarUrl() + (avatarNonce ? `?t=${avatarNonce}` : "")}
                                    fallback={(displayName ?? profile?.name ?? "?").charAt(0).toUpperCase()}
                                />
                            </span>

                            <span className={styles.profileName}>
                                {displayName ?? profile?.name ?? common.loading}
                            </span>
                        </button>
                        <button
                            className={styles.iconBtn}
                            onClick={() => setNewChatOpen(true)}
                            aria-label={tr.newChatAria}
                            title={tr.newChatAria}
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
                        placeholder={tr.searchPlaceholder}
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
                        chatAvatarNonce={chatAvatarNonce}
                    />
                </div>
            </aside>
            )}

            {(!isMobile || selectedChatId) && (
            <main className={styles.main}>
                {selectedChat ? (
                    <ChatWindow
                        key={selectedChat.id}
                        chat={selectedChat}
                        connection={connection}
                        onStartChat={handleStartChat}
                        onChatRemoved={handleChatRemoved}
                        presence={selectedChat.otherUserId ? presence[selectedChat.otherUserId] : undefined}
                        chatAvatarNonce={chatAvatarNonce}
                        onChatAvatarChanged={() => setChatAvatarNonce(Date.now())}
                        onBack={isMobile ? () => setSelectedChatId(null) : undefined}
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
                            {tr.emptyStateText}
                        </p>
                    </div>
                )}
            </main>
            )}

            {profileOpen && profile && (
                <ProfilePanel
                    profile={profile}
                    onClose={() => setProfileOpen(false)}
                    onLogout={handleLogout}
                    onUsernameChange={(username) => setDisplayName(username || profile.name)}
                    onNotificationSettingsChange={handleNotificationSettingsChange}
                    onAvatarChange={() => setAvatarNonce(Date.now())}
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