import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/language";
import { CHAT_WINDOW_TRANSLATIONS } from "../lib/chatWindowTranslations";
import { formatAudioTime } from "./EncryptedMedia";
import styles from "./VoiceRecorderButton.module.css";

const HOLD_THRESHOLD_MS = 250;
const MIN_RECORDING_SECONDS = 1;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];

function pickSupportedMimeType(): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

function extensionFor(mimeType: string): string {
    if (mimeType.includes("mp4")) return "m4a";
    if (mimeType.includes("ogg")) return "ogg";
    return "webm";
}

interface VoiceRecorderButtonProps {
    chatId: string;
    disabled: boolean;
    onRecorded: (file: File, durationSeconds: number) => void;
    onRecordingChange: (recording: boolean) => void;
}

// Records a voice message and hands the finished File back to the caller -
// deliberately knows nothing about chats/upload/sending, same split as
// EncryptedAudioPlayer knowing nothing about messages.
export default function VoiceRecorderButton({ chatId, disabled, onRecorded, onRecordingChange }: VoiceRecorderButtonProps) {
    const language = useLanguage();
    const tr = CHAT_WINDOW_TRANSLATIONS[language];

    // "video" exists so the tap-to-switch gesture and icon are already wired
    // for Stage 3 - holding while in this mode is a deliberate no-op below,
    // there's no capture path behind it yet.
    const [mode, setMode] = useState<"voice" | "video">("voice");
    const [isRecording, setIsRecording] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const holdTimerRef = useRef<number | null>(null);
    const startedAtRef = useRef(0);
    const tickIntervalRef = useRef<number | null>(null);
    const errorTimeoutRef = useRef<number | null>(null);
    // Keeps the chatId-change cleanup effect below from depending on (and
    // re-running for) a prop that's a fresh arrow function on every render.
    const onRecordingChangeRef = useRef(onRecordingChange);
    onRecordingChangeRef.current = onRecordingChange;

    // A recording shouldn't survive navigating to a different chat, or the
    // component unmounting - there'd be nothing sane to send it to.
    useEffect(() => {
        return () => {
            const recorder = mediaRecorderRef.current;
            if (recorder && recorder.state !== "inactive") {
                recorder.onstop = null;
                recorder.stop();
            }
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            if (tickIntervalRef.current !== null) {
                window.clearInterval(tickIntervalRef.current);
                tickIntervalRef.current = null;
            }
            mediaRecorderRef.current = null;
            chunksRef.current = [];
            setIsRecording(false);
            onRecordingChangeRef.current(false);
        };
    }, [chatId]);

    const cleanupStream = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (tickIntervalRef.current !== null) {
            window.clearInterval(tickIntervalRef.current);
            tickIntervalRef.current = null;
        }
        mediaRecorderRef.current = null;
        chunksRef.current = [];
    };

    const startRecording = async () => {
        if (mode !== "voice") return; // video capture is Stage 3's job
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mimeType = pickSupportedMimeType();
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            chunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };
            recorder.start();
            mediaRecorderRef.current = recorder;
            startedAtRef.current = Date.now();
            setElapsedSeconds(0);
            setIsRecording(true);
            onRecordingChange(true);
            tickIntervalRef.current = window.setInterval(() => {
                setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
            }, 250);
        } catch {
            setError(tr.micPermissionDenied);
            if (errorTimeoutRef.current !== null) window.clearTimeout(errorTimeoutRef.current);
            errorTimeoutRef.current = window.setTimeout(() => setError(null), 4000);
        }
    };

    const handlePointerDown = () => {
        if (disabled || isRecording) return;
        holdTimerRef.current = window.setTimeout(() => {
            holdTimerRef.current = null;
            void startRecording();
        }, HOLD_THRESHOLD_MS);
    };

    const handlePointerUp = () => {
        if (holdTimerRef.current === null) return; // recording already armed - keeps going regardless
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
        setMode((prev) => (prev === "voice" ? "video" : "voice"));
    };

    const handleCancel = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.onstop = null;
            recorder.stop();
        }
        cleanupStream();
        setIsRecording(false);
        onRecordingChange(false);
    };

    const handleConfirm = () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;
        const elapsed = elapsedSeconds;
        const mimeType = recorder.mimeType;
        // The codecs parameter (e.g. ";codecs=opus") is only needed to pick
        // a codec while recording - keeping it on the uploaded file's own
        // Content-Type breaks the server's S3 request signing, since that
        // header ends up part of what gets signed vs. what's actually sent.
        // A bare "audio/webm" is all DeriveKind/playback ever need anyway.
        const plainMimeType = mimeType.split(";")[0].trim();
        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: plainMimeType });
            cleanupStream();
            setIsRecording(false);
            onRecordingChange(false);
            if (elapsed < MIN_RECORDING_SECONDS) return; // a stray tap, not a real message
            const file = new File([blob], `voice-${Date.now()}.${extensionFor(mimeType)}`, { type: plainMimeType });
            onRecorded(file, elapsed);
        };
        recorder.stop();
    };

    if (isRecording) {
        return (
            <div className={styles.recordingRow}>
                <span className={styles.recordingDot} />
                <span className={styles.recordingTime}>{formatAudioTime(elapsedSeconds)}</span>
                <span className={styles.recordingSpacer} />
                <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={handleCancel}
                    aria-label={tr.cancelRecordingAria}
                    title={tr.cancelRecordingAria}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
                <button
                    type="button"
                    className={styles.confirmBtn}
                    onClick={handleConfirm}
                    aria-label={tr.sendRecordingAria}
                    title={tr.sendRecordingAria}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                    </svg>
                </button>
            </div>
        );
    }

    return (
        <div className={styles.wrap}>
            <button
                type="button"
                className={styles.micBtn}
                disabled={disabled}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                aria-label={tr.recordVoiceAria}
                title={tr.recordVoiceAria}
            >
                {mode === "voice" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 7l-7 5 7 5V7z" />
                        <rect x="1" y="5" width="15" height="14" rx="2" />
                    </svg>
                )}
            </button>
            {error && <span className={styles.error}>{error}</span>}
        </div>
    );
}
