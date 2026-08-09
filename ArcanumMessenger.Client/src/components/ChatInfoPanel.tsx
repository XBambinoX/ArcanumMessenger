import { useEffect, useRef, useState } from "react";
import type { HubConnection } from "@microsoft/signalr";
import type { ChatSummary } from "../types/messenger";
import {
    deleteChat,
    leaveGroup,
    getChatMembers,
    promoteToAdmin,
    demoteToMember,
    getChatAvatarUrl,
    uploadChatAvatar,
    deleteChatAvatar,
    type ChatMemberInfo,
} from "../api/chats";
import { getUserAvatarUrl, getPresenceBulk } from "../api/users";
import { getChatStats, type ChatStats } from "../api/messages";
import { decryptText } from "../lib/chatCrypto";
import { formatChatTime } from "../lib/time";
import AvatarImage from "./AvatarImage";
import AdminListPanel from "./AdminListPanel";
import MembersManagePanel from "./MembersManagePanel";
import ChatMediaGrid from "./ChatMediaGrid";
import styles from "./ChatInfoPanel.module.css";
import { useLanguage } from "../lib/language";
import { APP_COMMON } from "../lib/appTranslations";
import { CHAT_INFO_TRANSLATIONS, type ChatInfoPanelTranslation } from "../lib/chatManagementTranslations";

interface ChatInfoPanelProps {
    chat: ChatSummary;
    connection: HubConnection | null;
    onClose: () => void;
    onChatRemoved: (chatId: string) => void;
    chatAvatarNonce: number;
    onChatAvatarChanged: () => void;
}

interface PresenceInfo {
    isOnline: boolean;
    lastSeen: string | null;
}

function statusLabel(
    presence: PresenceInfo | undefined,
    tr: ChatInfoPanelTranslation,
    online: string,
): string {
    if (!presence) return "";
    if (presence.isOnline) return online;
    return presence.lastSeen ? `${tr.lastSeenPrefix}${formatChatTime(presence.lastSeen)}` : tr.offlineStatus;
}

function sortMembers(members: ChatMemberInfo[]): ChatMemberInfo[] {
    return [...members].sort((a, b) => {
        if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
        if ((a.role === "admin") !== (b.role === "admin")) return a.role === "admin" ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
}

export default function ChatInfoPanel({
    chat, connection, onClose, onChatRemoved, chatAvatarNonce, onChatAvatarChanged,
}: ChatInfoPanelProps) {
    const language = useLanguage();
    const common = APP_COMMON[language];
    const tr = CHAT_INFO_TRANSLATIONS[language];
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [description, setDescription] = useState<string | null>(null);
    const [members, setMembers] = useState<ChatMemberInfo[]>([]);
    const [presence, setPresence] = useState<Record<string, PresenceInfo>>({});
    const [roleActionId, setRoleActionId] = useState<string | null>(null);
    const [adminListOpen, setAdminListOpen] = useState(false);
    const [manageMembersOpen, setManageMembersOpen] = useState(false);
    const [infoTab, setInfoTab] = useState<"general" | "media">("general");
    const [stats, setStats] = useState<ChatStats | null>(null);
    const avatarInputRef = useRef<HTMLInputElement | null>(null);
    const tabContentRef = useRef<HTMLDivElement | null>(null);
    const prevInfoTabRef = useRef<"general" | "media">("general");
    const [tabContentHeight, setTabContentHeight] = useState<number | undefined>(undefined);
    const mediaGridTr = { noMediaYet: tr.noMediaYet, loadMore: tr.loadMore };
    const tabOrder: Record<"general" | "media", number> = { general: 0, media: 1 };
    const tabDirection = tabOrder[infoTab] >= tabOrder[prevInfoTabRef.current] ? 1 : -1;

    useEffect(() => {
        setInfoTab("general");
    }, [chat.id]);

    // Remeasures on every tab switch (the inner div remounts via key={infoTab})
    // and again whenever its content resizes itself later (e.g. media grid
    // items arriving async) - both drive the outer viewport's animated height.
    useEffect(() => {
        prevInfoTabRef.current = infoTab;
        const el = tabContentRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) setTabContentHeight(entry.contentRect.height);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [infoTab]);

    useEffect(() => {
        let cancelled = false;
        getChatStats(chat.id).then((data) => {
            if (!cancelled) setStats(data);
        });
        return () => {
            cancelled = true;
        };
    }, [chat.id]);

    useEffect(() => {
        if (chat.type !== "group") return;

        let cancelled = false;
        getChatMembers(chat.id).then(async (data) => {
            if (cancelled || !data) return;
            setDescription(data.description ? await decryptText(chat, data.description) : data.description);
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

    const handleAvatarClick = () => avatarInputRef.current?.click();

    const handleAvatarFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        const ok = await uploadChatAvatar(chat.id, file);
        if (ok) onChatAvatarChanged();
    };

    const handleRemoveAvatar = async () => {
        const ok = await deleteChatAvatar(chat.id);
        if (ok) onChatAvatarChanged();
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
                    aria-label={tr.closeAria}
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
                                    <h3 className={styles.confirmTitle}>{tr.deleteGroupTitle}</h3>
                                    <p className={styles.confirmText}>
                                        {tr.deleteGroupText(chat.title)}
                                    </p>
                                    <button
                                        className={styles.dangerBtn}
                                        onClick={() => handleDelete(true)}
                                        disabled={busy}
                                    >
                                        {tr.deleteGroupButton}
                                    </button>
                                    <button
                                        className={styles.cancelBtn}
                                        onClick={() => setConfirming(false)}
                                        disabled={busy}
                                    >
                                        {common.cancel}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <h3 className={styles.confirmTitle}>{tr.leaveGroupTitle}</h3>
                                    <p className={styles.confirmText}>
                                        {tr.leaveGroupText(chat.title)}
                                    </p>
                                    <button
                                        className={styles.dangerBtn}
                                        onClick={handleLeave}
                                        disabled={busy}
                                    >
                                        {tr.leaveGroupButton}
                                    </button>
                                    <button
                                        className={styles.cancelBtn}
                                        onClick={() => setConfirming(false)}
                                        disabled={busy}
                                    >
                                        {common.cancel}
                                    </button>
                                </>
                            )
                        ) : (
                            <>
                                <h3 className={styles.confirmTitle}>{tr.deleteChatTitle}</h3>
                                <p className={styles.confirmText}>
                                    {tr.deleteChatText}
                                </p>
                                <button
                                    className={styles.dangerBtn}
                                    onClick={() => handleDelete(false)}
                                    disabled={busy}
                                >
                                    {tr.deleteForMe}
                                </button>
                                <button
                                    className={styles.dangerBtn}
                                    onClick={() => handleDelete(true)}
                                    disabled={busy}
                                >
                                    {tr.deleteForEveryone}
                                </button>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => setConfirming(false)}
                                    disabled={busy}
                                >
                                    {common.cancel}
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className={styles.chatHeader}>
                            {chat.type === "group" && isAdmin && (
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={avatarInputRef}
                                    className={styles.hiddenFileInput}
                                    onChange={handleAvatarFileSelected}
                                />
                            )}
                            <div
                                className={`${styles.chatAvatar} ${chat.type === "group" ? styles.chatAvatarGroup : ""} ${chat.type === "saved" ? styles.chatAvatarSaved : ""} ${chat.type === "group" && isAdmin ? styles.chatAvatarEditable : ""}`}
                                onClick={chat.type === "group" && isAdmin ? handleAvatarClick : undefined}
                            >
                                {chat.type === "saved" ? (
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
                                    </svg>
                                ) : (
                                    <AvatarImage
                                        src={
                                            chat.type === "direct" && chat.otherUserId
                                                ? getUserAvatarUrl(chat.otherUserId)
                                                : chat.type === "group"
                                                    ? `${getChatAvatarUrl(chat.id)}${chatAvatarNonce ? `?t=${chatAvatarNonce}` : ""}`
                                                    : null
                                        }
                                        fallback={chat.title.charAt(0).toUpperCase()}
                                    />
                                )}
                                {chat.type === "group" && isAdmin && (
                                    <span className={styles.chatAvatarOverlay}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                            <circle cx="12" cy="13" r="4" />
                                        </svg>
                                    </span>
                                )}
                            </div>
                            <span className={styles.chatTitle}>
                                {chat.title}
                            </span>
                            <span className={styles.chatSubtitle}>
                                {chat.type === "group"
                                    ? tr.membersCount(members.length)
                                    : chat.type === "saved"
                                    ? tr.savedMessages
                                    : tr.directChat}
                            </span>
                            {chat.type === "group" && isAdmin && (
                                <button className={styles.avatarRemoveBtn} onClick={handleRemoveAvatar}>
                                    {tr.removePhoto}
                                </button>
                            )}
                        </div>

                        {chat.type === "group" ? (
                            <>
                                <div className={styles.tabBar}>
                                    <button
                                        className={`${styles.tabBtn} ${infoTab === "general" ? styles.tabBtnActive : ""}`}
                                        onClick={() => setInfoTab("general")}
                                    >
                                        {tr.generalTab}
                                    </button>
                                    <button
                                        className={`${styles.tabBtn} ${infoTab === "media" ? styles.tabBtnActive : ""}`}
                                        onClick={() => setInfoTab("media")}
                                    >
                                        {tr.mediaTab}
                                    </button>
                                </div>

                                <div className={styles.tabContentViewport} style={{ height: tabContentHeight }}>
                                    <div
                                        key={infoTab}
                                        ref={tabContentRef}
                                        className={`${styles.tabContentInner} ${tabDirection === 1 ? styles.tabSlideRight : styles.tabSlideLeft}`}
                                    >
                                        {infoTab === "general" ? (
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
                                                        <span className={styles.adminListLabel}>{tr.adminsLabel}</span>
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
                                                            <span className={styles.adminListLabel}>{tr.manageMembersLabel}</span>
                                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M9 18l6-6-6-6" />
                                                            </svg>
                                                        </button>
                                                    )}

                                                    <h3 className={styles.membersTitle}>{tr.membersHeading}</h3>
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
                                                                            {statusLabel(info, tr, common.online)}
                                                                        </span>
                                                                    </div>
                                                                    {member.isOwner ? (
                                                                        <span className={styles.ownerBadge}>{tr.ownerBadge}</span>
                                                                    ) : member.role === "admin" && (
                                                                        <span className={styles.adminBadge}>{tr.adminBadge}</span>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                </section>
                                            </>
                                        ) : (
                                            <section className={styles.mediaSection}>
                                                <ChatMediaGrid
                                                    chat={{ id: chat.id, wrappedChatKey: chat.wrappedChatKey }}
                                                    tr={mediaGridTr}
                                                />
                                            </section>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <section className={styles.infoSection}>
                                    <div className={styles.infoRow}>
                                        <span className={styles.infoLabel}>
                                            {tr.messagesLabel}
                                        </span>
                                        <span className={styles.infoValue}>
                                            {stats ? stats.messageCount : ""}
                                        </span>
                                    </div>
                                </section>
                                <section className={styles.mediaSection}>
                                    <h3 className={styles.membersTitle}>{tr.mediaLabel}</h3>
                                    <ChatMediaGrid
                                        chat={{ id: chat.id, wrappedChatKey: chat.wrappedChatKey }}
                                        tr={mediaGridTr}
                                    />
                                </section>
                            </>
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
                                {chat.type === "group" ? (isOwner ? tr.deleteGroupButton : tr.leaveGroupButton) : tr.deleteChatButton}
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
                myWrappedChatKey={chat.wrappedChatKey}
                onMembersChanged={(updated) => setMembers(sortMembers(updated))}
                onClose={() => setManageMembersOpen(false)}
            />
        )}
        </>
    );
}
