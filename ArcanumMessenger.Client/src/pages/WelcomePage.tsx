import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type RefObject,
} from "react";
import { useNavigate } from "react-router-dom";
import styles from "./WelcomePage.module.css";

/* ── mouse glow ── */
function useMouseGlow(ref: RefObject<HTMLDivElement | null>) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const fn = (e: MouseEvent) =>
            (el.style.transform = `translate(${e.clientX}px,${e.clientY}px) translate(-50%,-50%)`);
        window.addEventListener("mousemove", fn);
        return () => window.removeEventListener("mousemove", fn);
    }, [ref]);
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
                p.x += p.dx;
                p.y += p.dy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
            }
            raf = requestAnimationFrame(draw);
        };
        draw();
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, [ref]);
}

/* ══════════════════════════════════════
   Card: Welcome (main)
══════════════════════════════════════ */
function WelcomeCard({
    onSignIn,
    onCreate,
}: {
    onSignIn: () => void;
    onCreate: () => void;
}) {
    return (
        <div className={styles.cardWelcome}>
            <img src="/logo.svg" alt="Arcanum" className={styles.wcLogo} />
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
                Secure messaging for those who value privacy. Communicate
                without limits – quickly, reliably, and fully encrypted.
            </p>
            <div className={styles.wcButtons}>
                <button className={styles.btnPrimary} onClick={onSignIn}>
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                    </svg>
                    Sign in
                </button>
                <button className={styles.btnSecondary} onClick={onCreate}>
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Create account
                </button>
            </div>
            <p className={styles.wcHint}>End-to-end encrypted · Open source</p>
            <a
                className={styles.wcVault}
                href="https://github.com/Blackcat-404/AuthVault---password-manager"
            >
                Also check out AuthVault →
            </a>
        </div>
    );
}

/* ══════════════════════════════════════
   Animated chat
══════════════════════════════════════ */
const MSGS = [
    { from: "A", text: "Hey! Have you tried Arcanum yet?" },
    { from: "S", text: "Just signed up. So fast" },
    { from: "A", text: "And nobody can read this" },
    { from: "S", text: "Finally a messenger I trust 🙏" },
] as const;

function AnimatedChat() {
    const [shown, setShown] = useState<number[]>([]);
    const [typing, setTyping] = useState<"A" | "S" | null>(null);

    useEffect(() => {
        const T: ReturnType<typeof setTimeout>[] = [];
        const run = () => {
            setShown([]);
            setTyping(null);
            const steps: [number, () => void][] = [
                [500, () => setTyping("A")],
                [
                    1900,
                    () => {
                        setTyping(null);
                        setShown([0]);
                    },
                ],
                [3100, () => setTyping("S")],
                [
                    4700,
                    () => {
                        setTyping(null);
                        setShown([0, 1]);
                    },
                ],
                [5900, () => setTyping("A")],
                [
                    7400,
                    () => {
                        setTyping(null);
                        setShown([0, 1, 2]);
                    },
                ],
                [8600, () => setTyping("S")],
                [
                    10300,
                    () => {
                        setTyping(null);
                        setShown([0, 1, 2, 3]);
                    },
                ],
            ];
            steps.forEach(([d, fn]) => T.push(setTimeout(fn, d)));
            T.push(
                setTimeout(() => {
                    T.push(setTimeout(run, 600));
                }, 13500),
            );
        };
        T.push(setTimeout(run, 300));
        return () => T.forEach(clearTimeout);
    }, []);

    return (
        <div className={styles.chatFrame}>
            <div className={styles.chatHead}>
                <div className={`${styles.av} ${styles.avS}`}>S</div>
                <div className={styles.chatHeadInfo}>
                    <div className={styles.chatName}>Sam</div>
                    <div className={styles.chatStatus}>
                        <span className={styles.onlineDot} />
                        online
                    </div>
                </div>
                <span className={styles.chatMenuDots}>···</span>
            </div>

            <div className={styles.chatBody}>
                {MSGS.map((m, i) =>
                    shown.includes(i) ? (
                        <div
                            key={i}
                            className={`${styles.chatRow} ${m.from === "A" ? styles.chatRowOwn : ""}`}
                        >
                            {m.from !== "A" && (
                                <div
                                    className={`${styles.av} ${styles.avSm} ${styles.avS}`}
                                >
                                    S
                                </div>
                            )}
                            <div
                                className={`${styles.bubble} ${m.from === "A" ? styles.bubbleOwn : styles.bubbleOther}`}
                            >
                                {m.text}
                            </div>
                            {m.from === "A" && (
                                <div
                                    className={`${styles.av} ${styles.avSm} ${styles.avA}`}
                                >
                                    A
                                </div>
                            )}
                        </div>
                    ) : null,
                )}
                {typing && (
                    <div
                        className={`${styles.chatRow} ${typing === "A" ? styles.chatRowOwn : ""}`}
                    >
                        {typing !== "A" && (
                            <div
                                className={`${styles.av} ${styles.avSm} ${styles.avS}`}
                            >
                                S
                            </div>
                        )}
                        <div
                            className={`${styles.bubble} ${typing === "A" ? styles.bubbleOwn : styles.bubbleOther} ${styles.bubbleTyping}`}
                        >
                            <span className={styles.tDot} />
                            <span className={styles.tDot} />
                            <span className={styles.tDot} />
                        </div>
                        {typing === "A" && (
                            <div
                                className={`${styles.av} ${styles.avSm} ${styles.avA}`}
                            >
                                A
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className={styles.chatFoot}>
                <div className={styles.chatInput}>Type a message…</div>
                <button className={styles.chatSend} aria-label="Send">
                    <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════
   Split cards (landscape: text left, visual right)
══════════════════════════════════════ */
function ChatCard() {
    return (
        <div className={styles.cardSplit}>
            <div className={styles.splitInfo}>
                <span className={styles.eyebrow}>Live preview</span>
                <h2 className={styles.splitTitle}>Messages that stay yours</h2>
                <p className={styles.splitDesc}>
                    This is how Arcanum looks in action. Every message is
                    encrypted on your device before it leaves – the server only
                    ever relays ciphertext.
                </p>
                <ul className={styles.bullets}>
                    <li>End-to-end encrypted delivery</li>
                    <li>Typing indicators in real time</li>
                    <li>No plain-text storage, ever</li>
                </ul>
            </div>
            <div className={styles.splitVisual}>
                <AnimatedChat />
            </div>
        </div>
    );
}

function PrivacyCard() {
    return (
        <div className={styles.cardSplit}>
            <div className={styles.splitInfo}>
                <span className={styles.eyebrow}>Privacy</span>
                <h2 className={styles.splitTitle}>Zero knowledge</h2>
                <p className={styles.splitDesc}>
                    Passwords and recovery phrases never leave your browser in
                    plain form, and profile data is sealed with a separate
                    encryption key for every user. Even a full database leak
                    reveals nothing but ciphertext.
                </p>
                <div className={styles.featureTag}>AES-256-GCM · Argon2id</div>
            </div>
            <div className={styles.splitVisual}>
                <div className={styles.privRows}>
                    {(
                        [
                            ["username", "••••••••••"],
                            ["email", "••••••••••••••"],
                            ["password", "••••••••"],
                            ["messages", "••••••••••••"],
                        ] as const
                    ).map(([k, v]) => (
                        <div key={k} className={styles.privRow}>
                            <span className={styles.privKey}>{k}</span>
                            <span className={styles.privVal}>{v}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function SpeedCard() {
    return (
        <div className={styles.cardSplit}>
            <div className={styles.splitInfo}>
                <span className={styles.eyebrow}>Performance</span>
                <h2 className={styles.splitTitle}>Instant delivery</h2>
                <p className={styles.splitDesc}>
                    WebSocket connections with Redis pub/sub under the hood.
                    Messages arrive before you blink – no polling, no delays.
                </p>
                <div className={styles.featureTag}>SignalR · Redis Streams</div>
            </div>
            <div className={styles.splitVisual}>
                <div className={styles.speedWrap}>
                    <div className={styles.speedTrack}>
                        <div className={styles.speedFill} />
                    </div>
                    <span className={styles.speedLabel}>
                        delivered in milliseconds
                    </span>
                </div>
            </div>
        </div>
    );
}

function SecurityCard() {
    return (
        <div className={styles.cardSplit}>
            <div className={styles.splitInfo}>
                <span className={styles.eyebrow}>Recovery</span>
                <h2 className={styles.splitTitle}>Your keys, your control</h2>
                <p className={styles.splitDesc}>
                    No recovery emails, no support tickets. Forgot your
                    password? Your secret passphrase – generated right in your
                    browser, never sent anywhere – is all you need.
                </p>
                <div className={styles.featureTag}>
                    12 words · Only you hold the keys
                </div>
            </div>
            <div className={styles.splitVisual}>
                <div className={styles.phraseGrid}>
                    {[
                        "forest",
                        "moon",
                        "river",
                        "stone",
                        "echo",
                        "flame",
                        "tide",
                        "veil",
                        "amber",
                        "drift",
                        "haze",
                        "north",
                    ].map((w) => (
                        <span key={w} className={styles.phraseWord}>
                            {w}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ══════════════════════════════════════
   Carousel
══════════════════════════════════════ */
const CARDS = [
    { id: "welcome", label: "Arcanum Messenger", sub: "Your private space" },
    { id: "chat", label: "Live preview", sub: "See Arcanum in action" },
    { id: "privacy", label: "Zero knowledge", sub: "Your data. Your rules." },
    { id: "speed", label: "Instant delivery", sub: "Messages in milliseconds" },
    {
        id: "security",
        label: "Passphrase recovery",
        sub: "Your keys. Your control.",
    },
];

function posOf(i: number, active: number, n: number): number {
    const d = (((i - active) % n) + n) % n;
    return d > Math.floor(n / 2) ? d - n : d;
}

function slideStyle(pos: number): CSSProperties {
    const a = Math.abs(pos);
    // Side-by-side slide: neighbours sit next to the active card and the
    // whole row shifts by one card width on switch.
    // Flat 2D only (translateX + scale) — a 3D transform here produces
    // hairline seams on rounded/blurred children in Chromium/Firefox.
    return {
        transform: `translate(-50%, -50%) translateX(calc(${pos} * (min(85vw, 1460px) + 28px))) scale(${1 - a * 0.06})`,
        opacity: a > 1 ? 0 : a === 1 ? 0.55 : 1,
        zIndex: 10 - a,
        pointerEvents: (a > 1 ? "none" : "auto") as "none" | "auto",
        cursor: a === 0 ? "default" : "pointer",
    };
}

/* ══════════════════════════════════════
   Page
══════════════════════════════════════ */
export default function WelcomePage() {
    const N = CARDS.length;
    const navigate = useNavigate();
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    useParticles(canvasRef);
    useMouseGlow(glowRef);

    // Login page doesn't exist yet — wire it up when it does
    const handleSignIn = () => {};
    const handleCreate = () => navigate("/register");

    useEffect(() => {
        if (paused) return;
        const t = setInterval(() => setActive((a) => (a + 1) % N), 8000);
        return () => clearInterval(t);
    }, [paused, N]);

    const go = useCallback(
        (d: 1 | -1) => {
            setPaused(true);
            setActive((a) => (a + d + N) % N);
        },
        [N],
    );

    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") go(-1);
            if (e.key === "ArrowRight") go(1);
        };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [go]);

    function CardContent({ id }: { id: string }) {
        if (id === "welcome")
            return (
                <WelcomeCard onSignIn={handleSignIn} onCreate={handleCreate} />
            );
        if (id === "chat") return <ChatCard />;
        if (id === "privacy") return <PrivacyCard />;
        if (id === "speed") return <SpeedCard />;
        return <SecurityCard />;
    }

    const offWelcome = active !== 0;

    return (
        <div className={styles.root}>
            <div ref={glowRef} className={styles.mouseGlow} />
            <canvas ref={canvasRef} className={styles.particles} />
            <div className={styles.orb1} />
            <div className={styles.orb2} />
            <div className={styles.grid} />

            {/* ── top bar: appears when the welcome card scrolls away ── */}
            <header className={styles.topBar}>
                <div
                    className={`${styles.topBrand} ${offWelcome ? styles.topShown : ""}`}
                >
                    <img
                        src="/logo.svg"
                        alt="Arcanum"
                        className={styles.topMark}
                    />
                    Arcanum
                </div>
                <div
                    className={`${styles.topActions} ${offWelcome ? styles.topShown : ""}`}
                >
                    <button className={styles.topSignIn} onClick={handleSignIn}>
                        Sign in
                    </button>
                    <button className={styles.topCreate} onClick={handleCreate}>
                        Create account
                    </button>
                </div>
            </header>

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
                            className={styles.slide}
                            style={slideStyle(pos)}
                            onClick={() => pos !== 0 && setActive(i)}
                        >
                            <div
                                className={`${styles.slideCard} ${pos === 0 ? styles.slideActive : ""}`}
                            >
                                <CardContent id={card.id} />
                                {pos !== 0 && (
                                    <div className={styles.slideOverlay} />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── prev / next ── */}
            <button
                className={`${styles.navBtn} ${styles.navPrev}`}
                onClick={() => go(-1)}
                aria-label="Previous"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                >
                    <path d="M15 18l-6-6 6-6" />
                </svg>
            </button>
            <button
                className={`${styles.navBtn} ${styles.navNext}`}
                onClick={() => go(1)}
                aria-label="Next"
            >
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                >
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
                            onClick={() => {
                                setPaused(true);
                                setActive(i);
                            }}
                            aria-label={c.label}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
