import { useEffect, useState } from "react";
import type { HubConnection } from "@microsoft/signalr";
import type { ChatSummary } from "../types/messenger";
import {
    deleteChat,
    leaveGroup,
    getChatMembers,
    promoteToAdmin,
    demoteToMember,
    type ChatMemberInfo,
} from "../api/chats";
import { getUserAvatarUrl, getPresenceBulk } from "../api/users";
import { formatChatTime } from "../lib/time";
import AvatarImage from "./AvatarImage";
import AdminListPanel from "./AdminListPanel";
import MembersManagePanel from "./MembersManagePanel";
import styles from "./ChatInfoPanel.module.css";

interface ChatInfoPanelProps {
    chat: ChatSummary;
    connection: HubConnection | null;
    onClose: () => void;
    onChatRemoved: (chatId: string) => void;
}

interface PresenceInfo {
    isOnline: boolean;
    lastSeen: string | null;
}

function statusLabel(presence: PresenceInfo | undefined): string {
    if (!presence) return "";
    if (presence.isOnline) return "online";
    return presence.lastSeen ? `last seen ${formatChatTime(presence.lastSeen)}` : "offline";
}

function sortMembers(members: ChatMemberInfo[]): ChatMemberInfo[] {
    return [...members].sort((a, b) => {
        if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
        if ((a.role === "admin") !== (b.role === "admin")) return a.role === "admin" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

// Media history and message count are previews - no backend for either yet.
export default function ChatInfoPanel({ chat, connection, onClose, onChatRemoved }: ChatInfoPanelProps) {
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [description, setDescription] = useState<string | null>(null);
    const [members, setMembers] = useState<ChatMemberInfo[]>([]);
    const [presence, setPresence] = useState<Record<string, PresenceInfo>>({});
    const [roleActionId, setRoleActionId] = useState<string | null>(null);
    const [adminListOpen, setAdminListOpen] = useState(false);
    const [manageMembersOpen, setManageMembersOpen] = useState(false);

    useEffect(() => {
        if (chat.type !== "group") return;

        let cancelled = false;
        getChatMembers(chat.id).then((data) => {
            if (cancelled || !data) return;
            setDescription(data.description);
            setMembers(data.members);

            const memberIds = data.members.map((m) => m.userId);
            getPresenceBulk(memberIds).then((items) => {
                if (cancelled) return;
                setPresence((prev) => {
                    const next = { ...prev };
                    for (const item of items) next[item.userId] = { isOnline: item.isOnline, lastSeen: item.lastSeen };
                    return next;
                });
            });
        });

        return () => {
            cancelled = true;
        };
    }, [chat.id, chat.type]);

    useEffect(() => {
        if (chat.type !== "group" || !connection) return;

        const handleUserOnline = (userId: string) => {
            setPresence((prev) => ({ ...prev, [userId]: { isOnline: true, lastSeen: null } }));
        };
        const handleUserOffline = (userId: string, lastSeen: string | null) => {
            setPresence((prev) => ({ ...prev, [userId]: { isOnline: false, lastSeen } }));
        };
        const handleMemberRoleChanged = (changedChatId: string, userId: string, role: string) => {
            if (changedChatId !== chat.id) return;
            setMembers((prev) => sortMembers(prev.map((m) => (m.userId === userId ? { ...m, role } : m))));
        };
        const handleMemberAdded = (changedChatId: string, member: ChatMemberInfo) => {
            if (changedChatId !== chat.id) return;
            setMembers((prev) => (prev.some((m) => m.userId === member.userId) ? prev : sortMembers([...prev, member])));
        };
        const handleMemberRemoved = (changedChatId: string, userId: string) => {
            if (changedChatId !== chat.id) return;
            setMembers((prev) => prev.filter((m) => m.userId !== userId));
        };

        connection.on("UserOnline", handleUserOnline);
        connection.on("UserOffline", handleUserOffline);
        connection.on("ChatMemberRoleChanged", handleMemberRoleChanged);
        connection.on("ChatMemberAdded", handleMemberAdded);
        connection.on("ChatMemberRemoved", handleMemberRemoved);

        return () => {
            connection.off("UserOnline", handleUserOnline);
            connection.off("UserOffline", handleUserOffline);
            connection.off("ChatMemberRoleChanged", handleMemberRoleChanged);
            connection.off("ChatMemberAdded", handleMemberAdded);
            connection.off("ChatMemberRemoved", handleMemberRemoved);
        };
    }, [chat.id, chat.type, connection]);

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

    const isOwner = members.some((m) => m.isSelf && m.isOwner);
    // The owner's row is stored with Role "admin" too, so this already covers both.
    const isAdmin = members.some((m) => m.isSelf && m.role === "admin");

    const handlePromote = async (userId: string) => {
        if (roleActionId) return;
        setRoleActionId(userId);
        const ok = await promoteToAdmin(chat.id, userId);
        if (ok) {
            setMembers((prev) => sortMembers(prev.map((m) => (m.userId === userId ? { ...m, role: "admin" } : m))));
        }
        setRoleActionId(null);
    };

    const handleDemote = async (userId: string) => {
        if (roleActionId) return;
        setRoleActionId(userId);
        const ok = await demoteToMember(chat.id, userId);
        if (ok) {
            setMembers((prev) => sortMembers(prev.map((m) => (m.userId === userId ? { ...m, role: "member" } : m))));
        }
        setRoleActionId(null);
    };

    return (
        <>
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
                            isOwner ? (
                                <>
                                    <h3 className={styles.confirmTitle}>Delete group?</h3>
                                    <p className={styles.confirmText}>
                                        This deletes "{chat.title}" for everyone in it.
                                    </p>
                                    <button
                                        className={styles.dangerBtn}
                                        onClick={() => handleDelete(true)}
                                        disabled={busy}
                                    >
                                        Delete group
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
                            )
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
                                    ? `${members.length} member${members.length === 1 ? "" : "s"}`
                                    : chat.type === "saved"
                                    ? "Saved Messages"
                                    : "Direct chat"}
                            </span>
                        </div>

                        {chat.type === "group" ? (
                            <>
                                {description && (
                                    <section className={styles.infoSection}>
                                        <p className={styles.description}>{description}</p>
                                    </section>
                                )}

                                <section className={styles.membersSection}>
                                    <button
                                        className={styles.adminListRow}
                                        onClick={() => setAdminListOpen(true)}
                                    >
                                        <span className={styles.adminListIcon}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
                                            </svg>
                                        </span>
                                        <span className={styles.adminListLabel}>Admins</span>
                                        <span className={styles.adminListCount}>
                                            {members.filter((m) => m.isOwner || m.role === "admin").length}
                                        </span>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 18l6-6-6-6" />
                                        </svg>
                                    </button>

                                    {isAdmin && (
                                        <button
                                            className={styles.adminListRow}
                                            onClick={() => setManageMembersOpen(true)}
                                        >
                                            <span className={styles.adminListIcon}>
                                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                                    <circle cx="9" cy="7" r="4" />
                                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                </svg>
                                            </span>
                                            <span className={styles.adminListLabel}>Manage members</span>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M9 18l6-6-6-6" />
                                            </svg>
                                        </button>
                                    )}

                                    <h3 className={styles.membersTitle}>Members</h3>
                                    <ul className={styles.memberList}>
                                        {members.map((member) => {
                                            const info = presence[member.userId];
                                            return (
                                                <li key={member.userId} className={styles.memberRow}>
                                                    <div className={styles.memberAvatar}>
                                                        <AvatarImage
                                                            src={getUserAvatarUrl(member.userId)}
                                                            fallback={member.name.charAt(0).toUpperCase()}
                                                        />
                                                        {info?.isOnline && <span className={styles.onlineDot} />}
                                                    </div>
                                                    <div className={styles.memberBody}>
                                                        <span className={styles.memberName}>{member.name}</span>
                                                        <span
                                                            className={`${styles.memberStatus} ${info?.isOnline ? styles.memberStatusOnline : ""}`}
                                                        >
                                                            {statusLabel(info)}
                                                        </span>
                                                    </div>
                                                    {member.isOwner ? (
                                                        <span className={styles.ownerBadge}>owner</span>
                                                    ) : member.role === "admin" && (
                                                        <span className={styles.adminBadge}>admin</span>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            </>
                        ) : (
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
                        )}

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
                                    {chat.type === "group" && !isOwner ? (
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                                    ) : (
                                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                                    )}
                                </svg>
                                {chat.type === "group" ? (isOwner ? "Delete group" : "Leave group") : "Delete chat"}
                            </button>
                        )}
                    </>
                )}
            </aside>
        </div>

        {adminListOpen && (
            <AdminListPanel
                members={members}
                isOwner={isOwner}
                roleActionId={roleActionId}
                onPromote={handlePromote}
                onDemote={handleDemote}
                onClose={() => setAdminListOpen(false)}
            />
        )}

        {manageMembersOpen && (
            <MembersManagePanel
                chatId={chat.id}
                members={members}
                onMembersChanged={(updated) => setMembers(sortMembers(updated))}
                onClose={() => setManageMembersOpen(false)}
            />
        )}
        </>
    );
}
