import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../lib/language";
import { CHAT_WINDOW_TRANSLATIONS, type ChatWindowTranslation } from "../lib/chatWindowTranslations";
import { formatAudioTime } from "./EncryptedMedia";
import { getUserMediaWithPreferredMic } from "../lib/micPreference";
import { WavRecorder } from "../lib/wavRecorder";
import styles from "./VoiceRecorderButton.module.css";

const HOLD_THRESHOLD_MS = 250;
const MIN_RECORDING_SECONDS = 1;
const MAX_VIDEO_NOTE_SECONDS = 120;
const VIDEO_NOTE_SIZE = 560;
// A perfect 1:1 recording made some mobile browsers' fullscreen player
// treat it as landscape (their orientation heuristic is almost certainly
// "width >= height -> landscape", and a square hits that at the boundary)
// and lock the screen to landscape for it, only correcting itself once
// the video had played through once. A few extra pixels of height makes
// it unambiguously not-landscape - invisible at this size, but enough to
// land on the other side of that check.
const VIDEO_NOTE_HEIGHT_PAD = 10;
const VIDEO_MIME_CANDIDATES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/mp4"];

function pickSupportedMimeType(candidates: string[]): string | undefined {
    if (typeof MediaRecorder === "undefined") return undefined;
    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function videoExtensionFor(mimeType: string): string {
    return mimeType.includes("mp4") ? "mp4" : "webm";
}

// getUserMedia rejects for very different reasons that all used to show
// the same "couldn't access" message - that's actively misleading for
// anything that isn't actually a permission problem (checking browser
// settings won't help if the mic is just busy in another app), and for a
// truly-denied permission, no amount of retrying from here can force the
// browser to re-prompt - only the user going into their own browser's
// site settings can undo that. This at least tells them which situation
// they're actually in.
function describeMediaError(err: unknown, mode: "voice" | "video", tr: ChatWindowTranslation): string {
    // OverconstrainedError isn't a DOMException (it's its own interface),
    // so this can't just be `err instanceof DOMException ? err.name : ""`
    // the way the others are checked - that silently dropped it into the
    // permission-denied bucket below, which was actively misleading.
    const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
    if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
        return mode === "video" ? tr.cameraNotFound : tr.micNotFound;
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
        return mode === "video" ? tr.cameraInUse : tr.micInUse;
    }
    // NotAllowedError/SecurityError/PermissionDeniedError, or anything
    // unrecognized - permission is by far the most common real cause.
    return mode === "video" ? tr.cameraPermissionDenied : tr.micPermissionDenied;
}

interface VoiceRecorderButtonProps {
    chatId: string;
    disabled: boolean;
    onRecorded: (file: File, durationSeconds: number) => void;
    onVideoRecorded: (file: File, durationSeconds: number) => void;
    onRecordingChange: (recording: boolean) => void;
}

// Records a voice message or a square video note and hands the finished
// File back to the caller - deliberately knows nothing about chats/upload/
// sending, same split as EncryptedAudioPlayer knowing nothing about
// messages.
export default function VoiceRecorderButton({
    chatId, disabled, onRecorded, onVideoRecorded, onRecordingChange,
}: VoiceRecorderButtonProps) {
    const language = useLanguage();
    const tr = CHAT_WINDOW_TRANSLATIONS[language];

    const [mode, setMode] = useState<"voice" | "video">("voice");
    const [isRecording, setIsRecording] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    // null = not checked yet (checked lazily on first video recording,
    // since device labels/count are more reliable once permission has
    // actually been granted at least once).
    const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const holdTimerRef = useRef<number | null>(null);
    const startedAtRef = useRef(0);
    const tickIntervalRef = useRef<number | null>(null);
    const errorTimeoutRef = useRef<number | null>(null);

    // Voice-only: the mic stream, and the WavRecorder capturing raw PCM
    // from it (see wavRecorder.ts for why voice uses this instead of
    // MediaRecorder).
    const streamRef = useRef<MediaStream | null>(null);
    const wavRecorderRef = useRef<WavRecorder | null>(null);

    // Video-only: the camera feed driving the live preview, the stable
    // audio track (never touched by a flip), the canvas doing the actual
    // square crop + relay, and the combined stream MediaRecorder records -
    // see startVideoRecording's comment for why the recorder is never
    // pointed at the raw camera stream directly. The canvas/video elements
    // themselves are always mounted (see the JSX below) specifically so
    // these refs are already valid the moment a recording starts, instead
    // of racing a setState-triggered re-render to mount them.
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const audioTrackRef = useRef<MediaStreamTrack | null>(null);
    const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
    const canvasElRef = useRef<HTMLCanvasElement | null>(null);
    const combinedStreamRef = useRef<MediaStream | null>(null);
    const rafIdRef = useRef<number | null>(null);

    // Keeps the chatId-change cleanup effect below from depending on (and
    // re-running for) a prop that's a fresh arrow function on every render.
    const onRecordingChangeRef = useRef(onRecordingChange);
    onRecordingChangeRef.current = onRecordingChange;

    const cleanupStream = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        wavRecorderRef.current = null;
        if (tickIntervalRef.current !== null) {
            window.clearInterval(tickIntervalRef.current);
            tickIntervalRef.current = null;
        }
        mediaRecorderRef.current = null;
        chunksRef.current = [];
    };

    const cleanupCamera = () => {
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
        cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
        audioTrackRef.current?.stop();
        audioTrackRef.current = null;
        combinedStreamRef.current?.getTracks().forEach((track) => track.stop());
        combinedStreamRef.current = null;
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    };

    // A recording shouldn't survive navigating to a different chat, or the
    // component unmounting - there'd be nothing sane to send it to.
    useEffect(() => {
        return () => {
            const recorder = mediaRecorderRef.current;
            if (recorder && recorder.state !== "inactive") {
                recorder.onstop = null;
                recorder.stop();
            }
            wavRecorderRef.current?.cancel();
            cleanupStream();
            cleanupCamera();
            setIsRecording(false);
            onRecordingChangeRef.current(false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId]);

    const startVoiceRecording = async () => {
        const stream = await getUserMediaWithPreferredMic();
        streamRef.current = stream;
        wavRecorderRef.current = new WavRecorder(stream);
        startedAtRef.current = Date.now();
        setElapsedSeconds(0);
        setIsRecording(true);
        onRecordingChange(true);
        tickIntervalRef.current = window.setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }, 250);
    };

    const startVideoRecording = async () => {
        // canvasElRef/videoPreviewRef are always mounted (see the JSX at the
        // bottom of this component) precisely so they're already attached
        // here - grabbing them used to happen right after setIsRecording(true),
        // but React never re-renders synchronously inside the same function,
        // so the elements those refs pointed at didn't exist yet if they were
        // only ever mounted while isRecording was true.
        const canvas = canvasElRef.current;
        const video = videoPreviewRef.current;
        if (!canvas || !video) return;

        const cameraStream = await getUserMediaWithPreferredMic({ facingMode });
        cameraStreamRef.current = cameraStream;
        audioTrackRef.current = cameraStream.getAudioTracks()[0] ?? null;
        video.srcObject = cameraStream;
        await video.play().catch(() => { });

        if (hasMultipleCameras === null) {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                setHasMultipleCameras(devices.filter((d) => d.kind === "videoinput").length > 1);
            } catch {
                setHasMultipleCameras(false);
            }
        }

        const ctx = canvas.getContext("2d");
        const draw = () => {
            if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
                const vw = video.videoWidth;
                const vh = video.videoHeight;
                const size = Math.min(vw, vh);
                const sx = (vw - size) / 2;
                const sy = (vh - size) / 2;
                // A phone's camera sensor reports a landscape-shaped buffer
                // even while the phone is held upright to record a note -
                // canvas capture doesn't get the same orientation
                // correction a plain <video> display does, so without this
                // the recording comes out sideways. Gated on the screen
                // itself being portrait too, not just the buffer being
                // landscape - a desktop webcam's buffer is landscape as
                // well, but correctly so, and rotating that made desktop
                // recordings come out sideways instead of fixing anything.
                const screenIsPortrait = window.innerHeight > window.innerWidth;
                // The rotation/crop below all happens within the square
                // VIDEO_NOTE_SIZE x VIDEO_NOTE_SIZE region at the top of the
                // canvas - VIDEO_NOTE_HEIGHT_PAD's extra strip at the bottom
                // is intentionally never drawn to, on purpose (see its own
                // comment above), so canvas.width/height aren't used here.
                ctx.save();
                if (vw > vh && screenIsPortrait) {
                    // Square-to-square, so a plain 90° rotation about the
                    // region's center needs no width/height swapping.
                    ctx.translate(VIDEO_NOTE_SIZE / 2, VIDEO_NOTE_SIZE / 2);
                    ctx.rotate(Math.PI / 2);
                    ctx.translate(-VIDEO_NOTE_SIZE / 2, -VIDEO_NOTE_SIZE / 2);
                }
                ctx.drawImage(video, sx, sy, size, size, 0, 0, VIDEO_NOTE_SIZE, VIDEO_NOTE_SIZE);
                ctx.restore();
            }
            rafIdRef.current = requestAnimationFrame(draw);
        };
        rafIdRef.current = requestAnimationFrame(draw);

        const canvasStream = canvas.captureStream(30);
        const audioTrack = audioTrackRef.current;
        const combined = audioTrack
            ? new MediaStream([...canvasStream.getVideoTracks(), audioTrack])
            : canvasStream;
        combinedStreamRef.current = combined;

        const mimeType = pickSupportedMimeType(VIDEO_MIME_CANDIDATES);
        const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
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
            const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
            setElapsedSeconds(elapsed);
            if (elapsed >= MAX_VIDEO_NOTE_SECONDS) handleConfirm();
        }, 250);
    };

    const startRecording = async () => {
        try {
            if (mode === "video") await startVideoRecording();
            else await startVoiceRecording();
        } catch (err) {
            setError(describeMediaError(err, mode, tr));
            if (errorTimeoutRef.current !== null) window.clearTimeout(errorTimeoutRef.current);
            errorTimeoutRef.current = window.setTimeout(() => setError(null), 6000);
            cleanupStream();
            cleanupCamera();
            setIsRecording(false);
            onRecordingChange(false);
        }
    };

    const flipCamera = async () => {
        const nextFacing = facingMode === "user" ? "environment" : "user";
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: nextFacing },
                audio: false,
            });
            const oldStream = cameraStreamRef.current;
            cameraStreamRef.current = newStream;
            const video = videoPreviewRef.current;
            if (video) {
                video.srcObject = newStream;
                await video.play().catch(() => { });
            }
            // Stop only the video track(s) - the stable audio track in
            // audioTrackRef is never part of this stream after the first
            // flip and must keep feeding the recorder either way.
            oldStream?.getVideoTracks().forEach((track) => track.stop());
            setFacingMode(nextFacing);
        } catch {
            // Requested camera unavailable/busy - keep recording with
            // whichever camera is already active rather than failing the
            // whole recording over a flip.
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
        if (mode === "video") {
            const recorder = mediaRecorderRef.current;
            if (recorder && recorder.state !== "inactive") {
                recorder.onstop = null;
                recorder.stop();
            }
        } else {
            wavRecorderRef.current?.cancel();
        }
        cleanupStream();
        cleanupCamera();
        setIsRecording(false);
        onRecordingChange(false);
    };

    const handleConfirm = () => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);

        if (mode === "video") {
            const recorder = mediaRecorderRef.current;
            if (!recorder) return;
            const mimeType = recorder.mimeType;
            // The codecs parameter (e.g. ";codecs=vp9,opus") is only needed
            // to pick a codec while recording - keeping it on the uploaded
            // file's own Content-Type breaks the server's S3 request
            // signing, since that header ends up part of what gets signed
            // vs. what's actually sent. A bare "video/webm" is all
            // DeriveKind/playback ever need anyway.
            const plainMimeType = mimeType.split(";")[0].trim();
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: plainMimeType });
                cleanupStream();
                cleanupCamera();
                setIsRecording(false);
                onRecordingChange(false);
                if (elapsed < MIN_RECORDING_SECONDS) return; // a stray tap, not a real message
                const file = new File([blob], `video-note-${Date.now()}.${videoExtensionFor(mimeType)}`, { type: plainMimeType });
                onVideoRecorded(file, elapsed);
            };
            recorder.stop();
            return;
        }

        // WavRecorder.stop() is synchronous (it's just encoding already-
        // captured samples, no event to wait for), unlike MediaRecorder's
        // async onstop above.
        const wav = wavRecorderRef.current;
        if (!wav) return;
        const blob = wav.stop();
        cleanupStream();
        cleanupCamera();
        setIsRecording(false);
        onRecordingChange(false);
        if (elapsed < MIN_RECORDING_SECONDS) return; // a stray tap, not a real message
        const file = new File([blob], `voice-${Date.now()}.wav`, { type: "audio/wav" });
        onRecorded(file, elapsed);
    };

    const showVideoPanel = isRecording && mode === "video";

    return (
        <div className={isRecording ? `${styles.wrap} ${styles.wrapRecording}` : styles.wrap}>
            {/* Rendered into document.body via a portal, not inline here -
                position: fixed is only reliably relative to the viewport
                when nothing in its ancestor chain sets a transform/filter/
                will-change (any of those quietly turns "fixed" into
                "fixed relative to that ancestor instead"). A portal sidesteps
                the question entirely rather than auditing every ancestor.
                Always mounted (never conditional on isRecording/mode) so
                canvasElRef/videoPreviewRef are already valid the instant a
                recording starts - only visibility/position is conditional. */}
            {createPortal(
                <div className={showVideoPanel ? styles.videoPanel : styles.videoPanelHidden}>
                    {/* Clipping lives on this non-transformed layer, separate
                        from .videoPanel's own centering transform above.
                        The canvas itself used to get a CSS mirror transform
                        for the front camera, which combined with this clip
                        to break the rounded corners specifically in that
                        mode on mobile (a CSS-transformed child escaping its
                        parent's own clip is a known WebKit-family bug) - not
                        mirroring the live preview anymore is what actually,
                        reliably fixed it, rather than another CSS workaround. */}
                    <div className={styles.videoPanelClip}>
                        <canvas
                            ref={canvasElRef}
                            width={VIDEO_NOTE_SIZE}
                            height={VIDEO_NOTE_SIZE + VIDEO_NOTE_HEIGHT_PAD}
                            className={styles.previewCanvas}
                        />
                    </div>
                    {showVideoPanel && hasMultipleCameras && (
                        <button
                            type="button"
                            className={styles.flipBtn}
                            onClick={flipCamera}
                            aria-label={tr.flipCameraAria}
                            title={tr.flipCameraAria}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 2l4 4-4 4" />
                                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                <path d="M7 22l-4-4 4-4" />
                                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                            </svg>
                        </button>
                    )}
                    <video ref={videoPreviewRef} autoPlay muted playsInline className={styles.hiddenVideo} />
                </div>,
                document.body,
            )}

            {isRecording ? (
                <div className={styles.recordingRow}>
                    <span className={styles.recordingDot} />
                    <span className={styles.recordingTime}>
                        {mode === "video"
                            ? `${formatAudioTime(elapsedSeconds)} / ${formatAudioTime(MAX_VIDEO_NOTE_SECONDS)}`
                            : formatAudioTime(elapsedSeconds)}
                    </span>
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
            ) : (
                <>
                    <button
                        type="button"
                        className={styles.micBtn}
                        disabled={disabled}
                        onPointerDown={handlePointerDown}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                        aria-label={mode === "video" ? tr.recordVideoNoteAria : tr.recordVoiceAria}
                        title={mode === "video" ? tr.recordVideoNoteAria : tr.recordVoiceAria}
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
                </>
            )}
        </div>
    );
}
