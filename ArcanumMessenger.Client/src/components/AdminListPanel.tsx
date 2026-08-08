import type { ChatMemberInfo } from "../api/chats";
import { getUserAvatarUrl } from "../api/users";
import AvatarImage from "./AvatarImage";
import styles from "./AdminListPanel.module.css";
import { useLanguage } from "../lib/language";
import { ADMIN_LIST_TRANSLATIONS } from "../lib/chatManagementTranslations";

interface AdminListPanelProps {
    members: ChatMemberInfo[];
    isOwner: boolean;
    roleActionId: string | null;
    onPromote: (userId: string) => void;
    onDemote: (userId: string) => void;
    onClose: () => void;
}

export default function AdminListPanel({
    members,
    isOwner,
    roleActionId,
    onPromote,
    onDemote,
    onClose,
}: AdminListPanelProps) {
    const tr = ADMIN_LIST_TRANSLATIONS[useLanguage()];
    const owner = members.find((m) => m.isOwner);
    const admins = members.filter((m) => !m.isOwner && m.role === "admin");
    const others = members.filter((m) => !m.isOwner && m.role !== "admin");

    return (
        <div className={styles.overlay} onClick={onClose}>
            <aside
                className={styles.panel}
                onClick={(e) => e.stopPropagation()}
            >
                <header className={styles.header}>
                    <h2 className={styles.title}>{tr.title}</h2>
                    <button
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label={tr.closeAria}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                    </button>
                </header>

                {!isOwner && (
                    <p className={styles.note}>{tr.ownerOnlyNote}</p>
                )}

                <ul className={styles.memberList}>
                    {owner && (
                        <li key={owner.userId} className={styles.memberRow}>
                            <div className={styles.memberAvatar}>
                                <AvatarImage
                                    src={getUserAvatarUrl(owner.userId)}
                                    fallback={owner.name.charAt(0).toUpperCase()}
                                />
                            </div>
                            <span className={styles.memberName}>{owner.name}</span>
                            <span className={styles.ownerBadge}>{tr.ownerBadge}</span>
                        </li>
                    )}
                    {admins.map((member) => (
                        <li key={member.userId} className={styles.memberRow}>
                            <div className={styles.memberAvatar}>
                                <AvatarImage
                                    src={getUserAvatarUrl(member.userId)}
                                    fallback={member.name.charAt(0).toUpperCase()}
                                />
                            </div>
                            <span className={styles.memberName}>{member.name}</span>
                            {isOwner ? (
                                <button
                                    className={styles.actionBtn}
                                    onClick={() => onDemote(member.userId)}
                                    disabled={roleActionId === member.userId}
                                >
                                    {tr.removeButton}
                                </button>
                            ) : (
                                <span className={styles.adminBadge}>{tr.adminBadge}</span>
                            )}
                        </li>
                    ))}
                </ul>

                {isOwner && (
                    <>
                        <h3 className={styles.sectionTitle}>{tr.addAdminsHeading}</h3>
                        {others.length === 0 ? (
                            <p className={styles.note}>{tr.everyoneIsAdminNote}</p>
                        ) : (
                            <ul className={styles.memberList}>
                                {others.map((member) => (
                                    <li key={member.userId} className={styles.memberRow}>
                                        <div className={styles.memberAvatar}>
                                            <AvatarImage
                                                src={getUserAvatarUrl(member.userId)}
                                                fallback={member.name.charAt(0).toUpperCase()}
                                            />
                                        </div>
                                        <span className={styles.memberName}>{member.name}</span>
                                        <button
                                            className={styles.actionBtn}
                                            onClick={() => onPromote(member.userId)}
                                            disabled={roleActionId === member.userId}
                                        >
                                            {tr.addButton}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </aside>
        </div>
    );
}
