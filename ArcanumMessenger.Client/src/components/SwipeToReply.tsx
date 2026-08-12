import { useRef, useState } from "react";
import styles from "./SwipeToReply.module.css";

interface SwipeToReplyProps {
    onReply: () => void;
    // Off on desktop - there Up/Down-to-reply already covers this, and
    // attaching pointer handlers here would fight with selecting message
    // text by click-dragging.
    disabled?: boolean;
    // Own messages hug the right edge of their row (.bubbleRow.own is
    // justify-content:flex-end) with barely any room to their right before
    // .messages' own overflow-x:hidden clips the slide - so for those the
    // gesture reverses to swipe left, into the open space on that side,
    // same as everyone else's messages swipe right into the open space on
    // theirs.
    reverse?: boolean;
    children: React.ReactNode;
}

const SWIPE_THRESHOLD = 64;
const MAX_SWIPE = 80;

export default function SwipeToReply({ onReply, disabled, reverse, children }: SwipeToReplyProps) {
    const [dragX, setDragX] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startRef = useRef<{ x: number; y: number } | null>(null);
    const armedRef = useRef(false);

    if (disabled) return <>{children}</>;

    const handlePointerDown = (e: React.PointerEvent) => {
        startRef.current = { x: e.clientX, y: e.clientY };
        armedRef.current = false;
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const start = startRef.current;
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;

        if (!armedRef.current) {
            // Decide once, on the first real movement: a mostly-horizontal
            // drag claims the gesture as a swipe; a mostly-vertical one is
            // just the message list scrolling, so it's left alone.
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
            if (Math.abs(dy) > Math.abs(dx)) {
                startRef.current = null;
                return;
            }
            armedRef.current = true;
            setIsDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
        }

        const clamped = reverse
            ? Math.max(-MAX_SWIPE, Math.min(dx, 0))
            : Math.max(0, Math.min(dx, MAX_SWIPE));
        setDragX(clamped);
    };

    const endDrag = () => {
        if (armedRef.current && Math.abs(dragX) >= SWIPE_THRESHOLD) {
            onReply();
        }
        startRef.current = null;
        armedRef.current = false;
        setIsDragging(false);
        setDragX(0);
    };

    return (
        <div
            className={styles.wrap}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            <span
                className={`${styles.replyIcon} ${reverse ? styles.replyIconEnd : ""}`}
                style={{ opacity: Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1) }}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 17l-5-5 5-5" />
                    <path d="M4 12h11a4 4 0 0 1 4 4v1" />
                </svg>
            </span>
            <div
                className={styles.slide}
                style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? "none" : undefined }}
            >
                {children}
            </div>
        </div>
    );
}
