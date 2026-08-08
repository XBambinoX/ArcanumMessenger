import { useEffect, useState } from "react";
import { getContacts } from "../api/contacts";
import { searchUsers, getUser, getUserAvatarUrl } from "../api/users";
import { createGroupChat } from "../api/chats";
import { sealNewChatKey } from "../lib/chatKeys";
import type { ChatSummary, User, UserSearchResult } from "../types/messenger";
import UserInfoPanel from "./UserInfoPanel";
import AvatarImage from "./AvatarImage";
import styles from "./NewChatPanel.module.css";
import { useLanguage } from "../lib/language";
import { NEW_CHAT_TRANSLATIONS } from "../lib/chatManagementTranslations";

const MIN_SEARCH_LENGTH = 4;
const SEARCH_DEBOUNCE_MS = 350;

interface NewChatPanelProps {
    onClose: () => void;
    onStartChat: (chat: ChatSummary) => void;
}

type Mode = "browse" | "group-members" | "group-details";

export default function NewChatPanel({ onClose, onStartChat }: NewChatPanelProps) {
    const tr = NEW_CHAT_TRANSLATIONS[useLanguage()];
    const [mode, setMode] = useState<Mode>("browse");
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [contacts, setContacts] = useState<UserSearchResult[]>([]);
    const [viewedUser, setViewedUser] = useState<{ userId: string; user: User } | null>(null);
    const [groupMembers, setGroupMembers] = useState<Map<string, UserSearchResult>>(new Map());
    const [groupTitle, setGroupTitle] = useState("");
    const [groupDescription, setGroupDescription] = useState("");
    const [creatingGroup, setCreatingGroup] = useState(false);
    const [groupError, setGroupError] = useState<string | null>(null);
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

    const toggleGroupMember = (candidate: UserSearchResult) => {
        setGroupMembers((prev) => {
            const next = new Map(prev);
            if (next.has(candidate.id)) next.delete(candidate.id);
            else next.set(candidate.id, candidate);
            return next;
        });
    };

    const handleCreateGroup = async () => {
        const title = groupTitle.trim();
        if (!title || groupMembers.size === 0 || creatingGroup) return;

        setCreatingGroup(true);
        setGroupError(null);
        try {
            const members = [...groupMembers.values()].map((m) => ({
                userId: m.id,
                ecdhPublicKey: m.ecdhPublicKey,
            }));
            const memberKeys = await sealNewChatKey(members);
            const { chat, reason } = await createGroupChat(
                title,
                groupDescription.trim() || undefined,
                [...groupMembers.keys()],
                memberKeys,
            );
            if (chat) {
                onStartChat(chat);
                onClose();
            } else {
                setGroupError(
                    reason === "restricted_members"
                        ? tr.restrictedGroupMembersError
                        : tr.couldntCreateGroup,
                );
            }
        } finally {
            setCreatingGroup(false);
        }
    };

    const list = query.length > 0 ? results : contacts;

    return (
        <>
        <div className={styles.overlay} onClick={onClose}>
            <aside
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
            >
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        {mode !== "browse" && (
                            <button
                                className={styles.backBtn}
                                onClick={() =>
                                    setMode(mode === "group-details" ? "group-members" : "browse")
                                }
                                aria-label={tr.backAria}
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>
                        )}
                        <h2 className={styles.title}>
                            {mode === "browse"
                                ? tr.titleNewChat
                                : mode === "group-members"
                                    ? tr.titleAddMembers
                                    : tr.titleNewGroup}
                        </h2>
                    </div>
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
                </header>

                {mode === "group-details" ? (
                    <div className={styles.groupDetails}>
                        <div className={styles.groupAvatarPreview}>
                            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                        <div className={styles.groupFieldsCard}>
                            <input
                                className={styles.groupField}
                                type="text"
                                placeholder={tr.groupNamePlaceholder}
                                value={groupTitle}
                                onChange={(e) => setGroupTitle(e.target.value)}
                                autoFocus
                            />
                            <textarea
                                className={styles.groupField}
                                placeholder={tr.descriptionPlaceholder}
                                value={groupDescription}
                                onChange={(e) => setGroupDescription(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <span className={styles.memberCountPill}>
                            {tr.membersSelected(groupMembers.size)}
                        </span>
                        {groupError && <p className={styles.errorNote}>{groupError}</p>}
                        <button
                            className={styles.createBtn}
                            onClick={handleCreateGroup}
                            disabled={!groupTitle.trim() || groupMembers.size === 0 || creatingGroup}
                        >
                            {creatingGroup ? tr.creatingGroup : tr.createGroupButton}
                        </button>
                    </div>
                ) : (
                    <>
                        <div className={styles.searchWrap}>
                            <span className={styles.searchIcon}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="7" />
                                    <path d="M21 21l-4.3-4.3" />
                                </svg>
                            </span>
                            <input
                                className={styles.search}
                                type="text"
                                placeholder={tr.findUserPlaceholder}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        {mode === "browse" && (
                            <button
                                className={styles.groupBtn}
                                onClick={() => setMode("group-members")}
                            >
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
                                {tr.createAGroupButton}
                            </button>
                        )}

                        {mode === "group-members" && groupMembers.size > 0 && (
                            <div className={styles.chipsBox}>
                                <ul className={styles.selectedChips}>
                                    {[...groupMembers.values()].map((member) => (
                                        <li key={member.id} className={styles.chip}>
                                            {member.name}
                                            <button
                                                className={styles.chipRemove}
                                                onClick={() => toggleGroupMember(member)}
                                                aria-label={tr.removeChipAria(member.name)}
                                            >
                                                ×
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <h3 className={styles.sectionTitle}>
                            {query.length > 0 ? tr.searchResultsHeading : tr.contactsHeading}
                        </h3>
                        <div className={styles.listCard}>
                            {query.length > 0 && query.length < MIN_SEARCH_LENGTH ? (
                                <p className={styles.note}>
                                    {tr.typeAtLeast(MIN_SEARCH_LENGTH)}
                                </p>
                            ) : list.length === 0 ? (
                                <p className={styles.note}>
                                    {query.length > 0
                                        ? tr.noMatches
                                        : tr.noContactsYet}
                                </p>
                            ) : (
                                <ul className={styles.contactList}>
                                    {list.map((entry) => (
                                        <li key={entry.id}>
                                            <button
                                                className={styles.contactRow}
                                                onClick={() =>
                                                    mode === "group-members"
                                                        ? toggleGroupMember(entry)
                                                        : handleViewUser(entry.id)
                                                }
                                            >
                                                {mode === "group-members" && (
                                                    <span
                                                        className={`${styles.memberCheckbox} ${
                                                            groupMembers.has(entry.id) ? styles.memberCheckboxChecked : ""
                                                        }`}
                                                    />
                                                )}
                                                <div className={styles.contactAvatar}>
                                                    <AvatarImage
                                                        src={getUserAvatarUrl(entry.id)}
                                                        fallback={entry.name.charAt(0).toUpperCase()}
                                                    />
                                                </div>
                                                <span>{entry.name}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {mode === "group-members" && (
                            <button
                                className={styles.createBtn}
                                onClick={() => setMode("group-details")}
                                disabled={groupMembers.size === 0}
                            >
                                {tr.nextButton}
                            </button>
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
