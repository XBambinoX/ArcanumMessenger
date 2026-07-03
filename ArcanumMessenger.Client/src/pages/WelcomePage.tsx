import { useCallback, useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import styles from "./WelcomePage.module.css";
import { useNavigate } from "react-router-dom";

/* ── mouse glow ── */
function useMouseGlow(ref: RefObject<HTMLDivElement | null>) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const fn = (e: MouseEvent) =>
            (el.style.transform = `translate(${e.clientX}px,${e.clientY}px) translate(-50%,-50%)`);
        window.addEventListener("mousemove", fn);
        return () => window.removeEventListener("mousemove", fn);
    }, []);
}

/* ── particles ── */
function useParticles(ref: RefObject<HTMLCanvasElement | null>) {
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();
        window.addEventListener("resize", resize);
        const pts = Array.from({ length: 55 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.4 + 0.3,
            dx: (Math.random() - 0.5) * 0.25,
            dy: (Math.random() - 0.5) * 0.25,
            o: Math.random() * 0.4 + 0.06,
        }));
        let raf: number;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of pts) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(167,139,250,${p.o})`;
                ctx.fill();
                p.x += p.dx; p.y += p.dy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
            }
            raf = requestAnimationFrame(draw);
        };
        draw();
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    }, []);
}

/* ══════════════════════════════════════
   Card: Welcome (main)
══════════════════════════════════════ */
function WelcomeCard({ onCreateAccount }: { onCreateAccount: () => void }) {
    return (
        <div className={styles.cardWelcome}>
            <div className={styles.wcLogo}>
                <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
                    <path d="M24 4L42 14.5V33.5L24 44L6 33.5V14.5L24 4Z"
                        stroke="url(#wg)" strokeWidth="2" fill="none" />
                    <circle cx="24" cy="24" r="5" fill="url(#wg)" />
                    <defs>
                        <linearGradient id="wg" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#a78bfa" /><stop offset="1" stopColor="#22d3ee" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <div>
                <h1 className={styles.wcName}>Arcanum</h1>
                <p className={styles.wcSub}>Messenger</p>
            </div>
            <div className={styles.wcDivider}>
                <span className={styles.divLine} />
                <span className={styles.divStar}>✦</span>
                <span className={styles.divLineR} />
            </div>
            <p className={styles.wcTagline}>
                Secure messaging for those who value privacy. Communicate without limits — quickly, reliably, and fully encrypted.
            </p>
            <div className={styles.wcButtons}>
                <button className={styles.btnPrimary}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                    </svg>
                    Sign in
                </button>
                <button className={styles.btnSecondary} onClick={onCreateAccount}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Create account
                </button>
            </div>
            <p className={styles.wcHint}>End-to-end encrypted · Open source · Self-hosted</p>
        </div>
    );
}

/* ══════════════════════════════════════
   Card: Animated Chat
══════════════════════════════════════ */
const MSGS = [
    { from: "A", text: "Hey! Have you tried Arcanum yet?" },
    { from: "S", text: "Just signed up. So fast ⚡" },
    { from: "A", text: "And nobody can read this 🔒" },
    { from: "S", text: "Finally a messenger I trust 🙏" },
] as const;

function ChatCard() {
    const [shown, setShown] = useState<number[]>([]);
    const [typing, setTyping] = useState<"A" | "S" | null>(null);

    useEffect(() => {
        const T: ReturnType<typeof setTimeout>[] = [];
        const run = () => {
            setShown([]); setTyping(null);
            const steps: [number, () => void][] = [
                [500,   () => setTyping("A")],
                [1900,  () => { setTyping(null); setShown([0]); }],
                [3100,  () => setTyping("S")],
                [4700,  () => { setTyping(null); setShown([0, 1]); }],
                [5900,  () => setTyping("A")],
                [7400,  () => { setTyping(null); setShown([0, 1, 2]); }],
                [8600,  () => setTyping("S")],
                [10300, () => { setTyping(null); setShown([0, 1, 2, 3]); }],
            ];
            steps.forEach(([d, fn]) => T.push(setTimeout(fn, d)));
            T.push(setTimeout(() => { T.push(setTimeout(run, 600)); }, 13500));
        };
        T.push(setTimeout(run, 300));
        return () => T.forEach(clearTimeout);
    }, []);

    return (
        <div className={styles.cardChat}>
            <div className={styles.chatLabel}>Live preview</div>
            <div className={styles.chat}>
                <div className={styles.chatHead}>
                    <div className={`${styles.av} ${styles.avS}`}>S</div>
                    <div className={styles.chatHeadInfo}>
                        <div className={styles.chatName}>Sam</div>
                        <div className={styles.chatStatus}>
                            <span className={styles.onlineDot} />online
                        </div>
                    </div>
                    <span className={styles.chatMenuDots}>···</span>
                </div>

                <div className={styles.chatBody}>
                    {MSGS.map((m, i) => shown.includes(i) ? (
                        <div key={i} className={`${styles.chatRow} ${m.from === "A" ? styles.chatRowOwn : ""}`}>
                            {m.from !== "A" && <div className={`${styles.av} ${styles.avSm} ${styles.avS}`}>S</div>}
                            <div className={`${styles.bubble} ${m.from === "A" ? styles.bubbleOwn : styles.bubbleOther}`}>
                                {m.text}
                            </div>
                            {m.from === "A" && <div className={`${styles.av} ${styles.avSm} ${styles.avA}`}>A</div>}
                        </div>
                    ) : null)}
                    {typing && (
                        <div className={`${styles.chatRow} ${typing === "A" ? styles.chatRowOwn : ""}`}>
                            {typing !== "A" && <div className={`${styles.av} ${styles.avSm} ${styles.avS}`}>S</div>}
                            <div className={`${styles.bubble} ${typing === "A" ? styles.bubbleOwn : styles.bubbleOther} ${styles.bubbleTyping}`}>
                                <span className={styles.tDot} /><span className={styles.tDot} /><span className={styles.tDot} />
                            </div>
                            {typing === "A" && <div className={`${styles.av} ${styles.avSm} ${styles.avA}`}>A</div>}
                        </div>
                    )}
                </div>

                <div className={styles.chatFoot}>
                    <div className={styles.chatInput}>Type a message…</div>
                    <button className={styles.chatSend} aria-label="Send">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════
   Card: Privacy
══════════════════════════════════════ */
function PrivacyCard() {
    return (
        <div className={styles.cardFeature}>
            <div className={styles.featureIcon}>🔐</div>
            <h2 className={styles.featureTitle}>Zero Knowledge</h2>
            <p className={styles.featureDesc}>
                Messages encrypt on your device before they leave. Not even we can read them.
            </p>
            <div className={styles.privRows}>
                {([
                    ["message",  "••••••••••••••"],
                    ["sender",   "••••••••"],
                    ["metadata", "••••••••••"],
                ] as const).map(([k, v]) => (
                    <div key={k} className={styles.privRow}>
                        <span className={styles.privKey}>{k}</span>
                        <span className={styles.privVal}>{v}</span>
                    </div>
                ))}
            </div>
            <div className={styles.featureTag}>AES-256 · Zero knowledge</div>
        </div>
    );
}

/* ══════════════════════════════════════
   Card: Speed
══════════════════════════════════════ */
function SpeedCard() {
    return (
        <div className={styles.cardFeature}>
            <div className={styles.featureIcon}>⚡</div>
            <h2 className={styles.featureTitle}>Instant Delivery</h2>
            <p className={styles.featureDesc}>
                WebSocket connections via SignalR with Redis pub/sub. Messages arrive before you blink.
            </p>
            <div className={styles.speedWrap}>
                <div className={styles.speedTrack}>
                    <div className={styles.speedFill} />
                </div>
                <span className={styles.speedLabel}>avg 22ms latency</span>
            </div>
            <div className={styles.featureTag}>SignalR · Redis Streams</div>
        </div>
    );
}

/* ══════════════════════════════════════
   Card: Security
══════════════════════════════════════ */
function SecurityCard() {
    return (
        <div className={styles.cardFeature}>
            <div className={styles.featureIcon}>🗝️</div>
            <h2 className={styles.featureTitle}>Passphrase Recovery</h2>
            <p className={styles.featureDesc}>
                No recovery emails. Forgot your password? Your secret passphrase is all you need.
            </p>
            <div className={styles.phraseGrid}>
                {["forest", "moon", "river", "stone", "echo", "flame", "tide", "veil"].map(w => (
                    <span key={w} className={styles.phraseWord}>{w}</span>
                ))}
            </div>
            <div className={styles.featureTag}>Only you hold the keys</div>
        </div>
    );
}

/* ══════════════════════════════════════
   Carousel
══════════════════════════════════════ */
const CARDS = [
    { id: "welcome",  label: "Arcanum Messenger",   sub: "Your private space" },
    { id: "chat",     label: "Live preview",         sub: "See Arcanum in action" },
    { id: "privacy",  label: "Zero knowledge",       sub: "Your data. Your rules." },
    { id: "speed",    label: "Instant delivery",     sub: "Messages in milliseconds" },
    { id: "security", label: "Passphrase recovery",  sub: "Your keys. Your control." },
];

function CardContent({ id, onCreateAccount }: { id: string; onCreateAccount: () => void }) {
    if (id === "welcome") return <WelcomeCard onCreateAccount={onCreateAccount} />;
    if (id === "chat")     return <ChatCard />;
    if (id === "privacy")  return <PrivacyCard />;
    if (id === "speed")    return <SpeedCard />;
    return <SecurityCard />;
}

const GAP   = 400;
const DEPTH = 130;
const ANGLE = 28;
const SHRINK = 0.11;

function posOf(i: number, active: number, n: number): number {
    const d = ((i - active) % n + n) % n;
    return d > Math.floor(n / 2) ? d - n : d;
}

function slideStyle(pos: number): CSSProperties {
    const a = Math.abs(pos);
    return {
        transform: `translateX(-50%) translateY(-50%) translateX(${pos * GAP}px) translateZ(${-a * DEPTH}px) rotateY(${-pos * ANGLE}deg) scale(${1 - a * SHRINK})`,
        opacity: a > 2 ? 0 : a === 2 ? 0.18 : a === 1 ? 0.65 : 1,
        zIndex: 10 - a,
        pointerEvents: (a > 2 ? "none" : "auto") as "none" | "auto",
        cursor: a === 0 ? "default" : "pointer",
    };
}

/* ══════════════════════════════════════
   Page
══════════════════════════════════════ */
export default function WelcomePage() {
    const navigate = useNavigate();
    const N = CARDS.length;
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glowRef   = useRef<HTMLDivElement>(null);
    useParticles(canvasRef);
    useMouseGlow(glowRef);

    useEffect(() => {
        if (paused) return;
        const t = setInterval(() => setActive(a => (a + 1) % N), 8000);
        return () => clearInterval(t);
    }, [paused, N]);

    const go = useCallback((d: 1 | -1) => {
        setPaused(true);
        setActive(a => (a + d + N) % N);
    }, [N]);

    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft")  go(-1);
            if (e.key === "ArrowRight") go(1);
        };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [go]);

    return (
        <div className={styles.root}>
            <div ref={glowRef} className={styles.mouseGlow} />
            <canvas ref={canvasRef} className={styles.particles} />
            <div className={styles.orb1} />
            <div className={styles.orb2} />
            <div className={styles.grid} />

            {/* ── stage ── */}
            <div
                className={styles.stage}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
            >
                {CARDS.map((card, i) => {
                    const pos = posOf(i, active, N);
                    return (
                        <div
                            key={card.id}
                            className={`${styles.slide} ${pos === 0 ? styles.slideActive : ""}`}
                            style={slideStyle(pos)}
                            onClick={() => pos !== 0 && setActive(i)}
                        >
                            <CardContent id={card.id} onCreateAccount={() => navigate("/register")} />
                            {pos !== 0 && <div className={styles.slideOverlay} />}
                        </div>
                    );
                })}
            </div>

            {/* ── prev / next ── */}
            <button className={`${styles.navBtn} ${styles.navPrev}`} onClick={() => go(-1)} aria-label="Previous">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M15 18l-6-6 6-6" />
                </svg>
            </button>
            <button className={`${styles.navBtn} ${styles.navNext}`} onClick={() => go(1)} aria-label="Next">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </button>

            {/* ── bottom bar ── */}
            <div className={styles.bottomBar}>
                <p className={styles.cardCaption}>{CARDS[active].sub}</p>
                <div className={styles.dots}>
                    {CARDS.map((c, i) => (
                        <button
                            key={c.id}
                            className={`${styles.dot} ${i === active ? styles.dotActive : ""}`}
                            onClick={() => { setPaused(true); setActive(i); }}
                            aria-label={c.label}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
