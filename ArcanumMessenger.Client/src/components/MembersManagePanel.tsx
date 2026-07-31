import { useEffect, useState } from "react";
import { getContacts } from "../api/contacts";
import { searchUsers } from "../api/users";
import { addChatMembers, removeChatMember, type ChatMemberInfo } from "../api/chats";
import { getUserAvatarUrl } from "../api/users";
import type { UserSearchResult } from "../types/messenger";
import AvatarImage from "./AvatarImage";
import styles from "./MembersManagePanel.module.css";

const MIN_SEARCH_LENGTH = 4;
const SEARCH_DEBOUNCE_MS = 350;

interface MembersManagePanelProps {
    chatId: string;
    members: ChatMemberInfo[];
    onMembersChanged: (members: ChatMemberInfo[]) => void;
    onClose: () => void;
}

type Mode = "list" | "add";

export default function MembersManagePanel({ chatId, members, onMembersChanged, onClose }: MembersManagePanelProps) {
    const [mode, setMode] = useState<Mode>("list");
    const [removingId, setRemovingId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [contacts, setContacts] = useState<UserSearchResult[]>([]);
    const [selected, setSelected] = useState<Map<string, UserSearchResult>>(new Map());
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const query = search.trim();
    const memberIds = new Set(members.map((m) => m.userId));

    useEffect(() => {
        if (mode !== "add") return;
        getContacts().then(setContacts);
    }, [mode]);

    useEffect(() => {
        if (mode !== "add" || query.length < MIN_SEARCH_LENGTH) {
            setResults([]);
            return;
        }

        const timer = setTimeout(() => {
            searchUsers(query).then(setResults);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [mode, query]);

    const toggleSelected = (candidate: UserSearchResult) => {
        setSelected((prev) => {
            const next = new Map(prev);
            if (next.has(candidate.id)) next.delete(candidate.id);
            else next.set(candidate.id, candidate);
            return next;
        });
    };

    const handleRemove = async (userId: string) => {
        if (removingId) return;
        setRemovingId(userId);
        const ok = await removeChatMember(chatId, userId);
        if (ok) onMembersChanged(members.filter((m) => m.userId !== userId));
        setRemovingId(null);
    };

    const handleAdd = async () => {
        if (adding || selected.size === 0) return;
        setAdding(true);
        setError(null);
        const { members: updated, reason } = await addChatMembers(chatId, [...selected.keys()]);
        setAdding(false);
        if (updated) {
            onMembersChanged(updated);
            setSelected(new Map());
            setMode("list");
        } else {
            setError(
                reason === "restricted_members"
                    ? "Someone you picked only accepts adds from their contacts."
                    : "Couldn't add these members.",
            );
        }
    };

    const list = query.length > 0 ? results : contacts;
    const candidates = list.filter((entry) => !memberIds.has(entry.id));

    return (
        <div className={styles.overlay} onClick={onClose}>
            <aside
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
            >
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        {mode === "add" && (
                            <button
                                className={styles.backBtn}
                                onClick={() => setMode("list")}
                                aria-label="Back"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                            </button>
                        )}
                        <h2 className={styles.title}>{mode === "add" ? "Add members" : "Manage members"}</h2>
                    </div>
                    <button
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                {mode === "list" ? (
                    <>
                        <button className={styles.addBtn} onClick={() => setMode("add")}>
                            <span className={styles.addIcon}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                            </span>
                            Add members
                        </button>

                        <ul className={styles.memberList}>
                            {members.map((member) => (
                                <li key={member.userId} className={styles.memberRow}>
                                    <div className={styles.memberAvatar}>
                                        <AvatarImage
                                            src={getUserAvatarUrl(member.userId)}
                                            fallback={member.name.charAt(0).toUpperCase()}
                                        />
                                    </div>
                                    <span className={styles.memberName}>{member.name}</span>
                                    {member.isOwner ? (
                                        <span className={styles.ownerBadge}>owner</span>
                                    ) : member.role === "admin" ? (
                                        <span className={styles.adminBadge}>admin</span>
                                    ) : null}
                                    {!member.isOwner && !member.isSelf && (
                                        <button
                                            className={styles.removeBtn}
                                            onClick={() => handleRemove(member.userId)}
                                            disabled={removingId === member.userId}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <>
                        <input
                            className={styles.search}
                            type="text"
                            placeholder="Find a user by ID"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />

                        {selected.size > 0 && (
                            <ul className={styles.selectedChips}>
                                {[...selected.values()].map((candidate) => (
                                    <li key={candidate.id} className={styles.chip}>
                                        {candidate.name}
                                        <button
                                            className={styles.chipRemove}
                                            onClick={() => toggleSelected(candidate)}
                                            aria-label={`Remove ${candidate.name}`}
                                        >
                                            ×
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        <h3 className={styles.sectionTitle}>
                            {query.length > 0 ? "Search results" : "Contacts"}
                        </h3>
                        {query.length > 0 && query.length < MIN_SEARCH_LENGTH ? (
                            <p className={styles.note}>Type at least {MIN_SEARCH_LENGTH} characters of the ID.</p>
                        ) : candidates.length === 0 ? (
                            <p className={styles.note}>
                                {query.length > 0 ? "No matches." : "No contacts to add."}
                            </p>
                        ) : (
                            <ul className={styles.candidateList}>
                                {candidates.map((candidate) => (
                                    <li key={candidate.id}>
                                        <button
                                            className={styles.candidateRow}
                                            onClick={() => toggleSelected(candidate)}
                                        >
                                            <span
                                                className={`${styles.memberCheckbox} ${
                                                    selected.has(candidate.id) ? styles.memberCheckboxChecked : ""
                                                }`}
                                            />
                                            <div className={styles.memberAvatar}>
                                                <AvatarImage
                                                    src={getUserAvatarUrl(candidate.id)}
                                                    fallback={candidate.name.charAt(0).toUpperCase()}
                                                />
                                            </div>
                                            <span className={styles.memberName}>{candidate.name}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {error && <p className={styles.errorNote}>{error}</p>}

                        <button
                            className={styles.addBtn}
                            onClick={handleAdd}
                            disabled={selected.size === 0 || adding}
                        >
                            {adding ? "Adding…" : `Add ${selected.size > 0 ? selected.size : ""} member${selected.size === 1 ? "" : "s"}`}
                        </button>
                    </>
                )}
            </aside>
        </div>
    );
}
