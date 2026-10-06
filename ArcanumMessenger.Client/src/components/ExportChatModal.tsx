import { useRef, useState } from "react";
import type { ChatSummary } from "../types/messenger";
import {
    exportChat,
    type ChatExportOptions,
    type ChatExportProgress,
    type ExportFormat,
    type ExportMediaKind,
} from "../lib/chatExport";
import styles from "./ExportChatModal.module.css";
import { useLanguage } from "../lib/language";
import { CHAT_EXPORT_TRANSLATIONS, type ChatExportTranslation } from "../lib/chatManagementTranslations";

interface ExportChatModalProps {
    chat: ChatSummary;
    onClose: () => void;
}

type Stage = "options" | "exporting" | "done" | "error";

const FORMATS: ExportFormat[] = ["html", "json", "both"];
const MEDIA_KINDS: ExportMediaKind[] = ["photos", "videos", "voice", "files", "gifs"];
const SIZE_LIMITS_MB: (number | null)[] = [8, 50, 200, null];

function formatLabel(tr: ChatExportTranslation, format: ExportFormat): string {
    return format === "html" ? tr.formatHtml : format === "json" ? tr.formatJson : tr.formatBoth;
}

function progressLabel(tr: ChatExportTranslation, progress: ChatExportProgress | null): string {
    if (!progress) return tr.exportingTitle;
    if (progress.phase === "messages") return tr.exportingMessages(progress.done, progress.total);
    if (progress.phase === "media") return tr.exportingMedia(progress.done, progress.total);
    return tr.packing;
}

export default function ExportChatModal({ chat, onClose }: ExportChatModalProps) {
    const tr = CHAT_EXPORT_TRANSLATIONS[useLanguage()];
    const [stage, setStage] = useState<Stage>("options");
    const [format, setFormat] = useState<ExportFormat>("html");
    const [media, setMedia] = useState<Record<ExportMediaKind, boolean>>({
        photos: true,
        videos: false,
        voice: true,
        files: true,
        gifs: false,
    });
    const [maxFileSizeMb, setMaxFileSizeMb] = useState<number | null>(50);
    const [usePassword, setUsePassword] = useState(false);
    const [password, setPassword] = useState("");
    const [progress, setProgress] = useState<ChatExportProgress | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const anyMedia = MEDIA_KINDS.some((kind) => media[kind]);
    const canStart = !usePassword || password.length > 0;
    const percent = progress?.total ? Math.min(100, (progress.done / progress.total) * 100) : null;

    const handleStart = async () => {
        if (!canStart) return;

        const options: ChatExportOptions = {
            format,
            media,
            maxFileSizeMb: anyMedia ? maxFileSizeMb : null,
            password: usePassword ? password : null,
        };
        const controller = new AbortController();
        abortRef.current = controller;
        setProgress(null);
        setStage("exporting");

        try {
            await exportChat(chat, options, setProgress, controller.signal);
            setStage("done");
        } catch (err) {
            setStage(err instanceof DOMException && err.name === "AbortError" ? "options" : "error");
        } finally {
            abortRef.current = null;
        }
    };

    // Closing mid-export cancels it rather than leaving it running unseen.
    const handleClose = () => {
        abortRef.current?.abort();
        onClose();
    };

    return (
        <div className={styles.overlay} onClick={stage === "exporting" ? undefined : handleClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {stage === "options" && (
                    <div className={styles.step}>
                        <h3 className={styles.title}>{tr.title}</h3>
                        <p className={styles.subtitle}>{chat.title}</p>

                        <div className={styles.section}>
                            <span className={styles.sectionLabel}>{tr.formatLabel}</span>
                            <div className={styles.segmented}>
                                {FORMATS.map((f) => (
                                    <button
                                        key={f}
                                        className={`${styles.segment} ${format === f ? styles.segmentActive : ""}`}
                                        onClick={() => setFormat(f)}
                                    >
                                        {formatLabel(tr, f)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.section}>
                            <span className={styles.sectionLabel}>{tr.mediaLabel}</span>
                            <div className={styles.checkList}>
                                {MEDIA_KINDS.map((kind) => (
                                    <label key={kind} className={styles.checkRow}>
                                        <input
                                            type="checkbox"
                                            checked={media[kind]}
                                            onChange={(e) => setMedia((prev) => ({ ...prev, [kind]: e.target.checked }))}
                                        />
                                        <span>{tr[kind]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className={`${styles.section} ${anyMedia ? "" : styles.sectionDisabled}`}>
                            <span className={styles.sectionLabel}>{tr.sizeLimitLabel}</span>
                            <div className={styles.segmented}>
                                {SIZE_LIMITS_MB.map((mb) => (
                                    <button
                                        key={mb ?? "none"}
                                        className={`${styles.segment} ${maxFileSizeMb === mb ? styles.segmentActive : ""}`}
                                        onClick={() => setMaxFileSizeMb(mb)}
                                        disabled={!anyMedia}
                                    >
                                        {mb === null ? tr.noLimit : tr.sizeLimitMb(mb)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.section}>
                            <label className={styles.checkRow}>
                                <input
                                    type="checkbox"
                                    checked={usePassword}
                                    onChange={(e) => setUsePassword(e.target.checked)}
                                />
                                <span>{tr.passwordToggle}</span>
                            </label>
                            {usePassword && (
                                <>
                                    <input
                                        className={styles.passwordInput}
                                        type="password"
                                        placeholder={tr.passwordPlaceholder}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoFocus
                                    />
                                    <p className={styles.hint}>{tr.passwordHint}</p>
                                </>
                            )}
                        </div>

                        <div className={styles.actions}>
                            <button className={styles.cancelBtn} onClick={handleClose}>
                                {tr.cancel}
                            </button>
                            <button className={styles.primaryBtn} onClick={handleStart} disabled={!canStart}>
                                {tr.exportButton}
                            </button>
                        </div>
                    </div>
                )}

                {stage === "exporting" && (
                    <div className={styles.step}>
                        <h3 className={styles.title}>{tr.exportingTitle}</h3>
                        <p className={styles.subtitle}>{chat.title}</p>
                        <div className={styles.progressTrack}>
                            <div
                                className={`${styles.progressFill} ${percent === null ? styles.progressIndeterminate : ""}`}
                                style={percent === null ? undefined : { width: `${percent}%` }}
                            />
                        </div>
                        <p className={styles.progressLabel}>{progressLabel(tr, progress)}</p>
                        <div className={styles.actions}>
                            <button className={styles.cancelBtn} onClick={() => abortRef.current?.abort()}>
                                {tr.cancelExport}
                            </button>
                        </div>
                    </div>
                )}

                {(stage === "done" || stage === "error") && (
                    <div className={styles.step}>
                        <h3 className={`${styles.title} ${stage === "error" ? styles.titleError : ""}`}>
                            {stage === "done" ? tr.doneTitle : tr.failedTitle}
                        </h3>
                        <p className={styles.text}>{stage === "done" ? tr.doneText : tr.failedText}</p>
                        <div className={styles.actions}>
                            <button className={styles.primaryBtn} onClick={handleClose}>
                                {tr.close}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
