import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type RefObject,
} from "react";
import { useNavigate } from "react-router";
import styles from "./WelcomePage.module.css";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useLanguage } from "../lib/language";
import {
    WELCOME_TRANSLATIONS,
    type WelcomeTranslation,
} from "../lib/welcomeTranslations";

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
    tr,
}: {
    onSignIn: () => void;
    onCreate: () => void;
    tr: WelcomeTranslation;
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
            <p className={styles.wcTagline}>{tr.welcomeCard.tagline}</p>
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
                    {tr.common.signIn}
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
                    {tr.common.createAccount}
                </button>
            </div>
            <p className={styles.wcHint}>{tr.welcomeCard.hint}</p>
            <a
                className={styles.wcVault}
                href="https://github.com/Blackcat-404/AuthVault---password-manager"
            >
                {tr.welcomeCard.vaultLink}
            </a>
        </div>
    );
}

/* ══════════════════════════════════════
   Animated chat
══════════════════════════════════════ */
const MSG_FROM = ["A", "S", "A", "S"] as const;

function AnimatedChat({ tr }: { tr: WelcomeTranslation }) {
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
                    <div className={styles.chatName}>{tr.chat.samName}</div>
                    <div className={styles.chatStatus}>
                        <span className={styles.onlineDot} />
                        {tr.chat.online}
                    </div>
                </div>
                <span className={styles.chatMenuDots}>···</span>
            </div>

            <div className={styles.chatBody}>
                {MSG_FROM.map((from, i) =>
                    shown.includes(i) ? (
                        <div
                            key={i}
                            className={`${styles.chatRow} ${from === "A" ? styles.chatRowOwn : ""}`}
                        >
                            {from !== "A" && (
                                <div
                                    className={`${styles.av} ${styles.avSm} ${styles.avS}`}
                                >
                                    S
                                </div>
                            )}
                            <div
                                className={`${styles.bubble} ${from === "A" ? styles.bubbleOwn : styles.bubbleOther}`}
                            >
                                {tr.chat.msgs[i]}
                            </div>
                            {from === "A" && (
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
                <div className={styles.chatInput}>{tr.chat.typeMessage}</div>
                <button className={styles.chatSend} aria-label={tr.common.send}>
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
function ChatCard({ tr }: { tr: WelcomeTranslation }) {
    return (
        <div className={styles.cardSplit}>
            <div className={styles.splitInfo}>
                <span className={styles.eyebrow}>{tr.chatCard.eyebrow}</span>
                <h2 className={styles.splitTitle}>{tr.chatCard.title}</h2>
                <p className={styles.splitDesc}>{tr.chatCard.desc}</p>
                <ul className={styles.bullets}>
                    {tr.chatCard.bullets.map((b) => (
                        <li key={b}>{b}</li>
                    ))}
                </ul>
            </div>
            <div className={styles.splitVisual}>
                <AnimatedChat tr={tr} />
            </div>
        </div>
    );
}

function PrivacyCard({ tr }: { tr: WelcomeTranslation }) {
    const rows = [
        { id: "username" as const, value: "••••••••••" },
        { id: "email" as const, value: "••••••••••••••" },
        { id: "password" as const, value: "••••••••" },
        { id: "messages" as const, value: "••••••••••••" },
    ];
    return (
        <div className={styles.cardSplit}>
            <div className={styles.splitInfo}>
                <span className={styles.eyebrow}>{tr.privacyCard.eyebrow}</span>
                <h2 className={styles.splitTitle}>{tr.privacyCard.title}</h2>
                <p className={styles.splitDesc}>{tr.privacyCard.desc}</p>
                <div className={styles.featureTag}>AES-256-GCM · Argon2id</div>
            </div>
            <div className={styles.splitVisual}>
                <div className={styles.privRows}>
                    {rows.map((row) => (
                        <div key={row.id} className={styles.privRow}>
                            <span className={styles.privKey}>
                                {tr.privacyCard.rowLabels[row.id]}
                            </span>
                            <span className={styles.privVal}>{row.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function SpeedCard({ tr }: { tr: WelcomeTranslation }) {
    return (
        <div className={styles.cardSplit}>
            <div className={styles.splitInfo}>
                <span className={styles.eyebrow}>{tr.speedCard.eyebrow}</span>
                <h2 className={styles.splitTitle}>{tr.speedCard.title}</h2>
                <p className={styles.splitDesc}>{tr.speedCard.desc}</p>
                <div className={styles.featureTag}>SignalR · Redis Streams</div>
            </div>
            <div className={styles.splitVisual}>
                <div className={styles.speedWrap}>
                    <div className={styles.speedTrack}>
                        <div className={styles.speedFill} />
                    </div>
                    <span className={styles.speedLabel}>
                        {tr.speedCard.label}
                    </span>
                </div>
            </div>
        </div>
    );
}

function SecurityCard({ tr }: { tr: WelcomeTranslation }) {
    return (
        <div className={styles.cardSplit}>
            <div className={styles.splitInfo}>
                <span className={styles.eyebrow}>{tr.securityCard.eyebrow}</span>
                <h2 className={styles.splitTitle}>{tr.securityCard.title}</h2>
                <p className={styles.splitDesc}>{tr.securityCard.desc}</p>
                <div className={styles.featureTag}>{tr.securityCard.tag}</div>
            </div>
            <div className={styles.splitVisual}>
                <div className={styles.phraseGrid}>
                    {tr.securityCard.phraseWords.map((w, i) => (
                        <span key={i} className={styles.phraseWord}>
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
const CARD_IDS = ["welcome", "chat", "privacy", "speed", "security"] as const;

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
    const N = CARD_IDS.length;
    const navigate = useNavigate();
    const language = useLanguage();
    const tr = WELCOME_TRANSLATIONS[language];
    const cards = CARD_IDS.map((id) => ({ id, ...tr.cards[id] }));
    const [active, setActive] = useState(0);
    const [paused, setPaused] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    useParticles(canvasRef);
    useMouseGlow(glowRef);

    const handleSignIn = () => navigate("/login");
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
                <WelcomeCard
                    onSignIn={handleSignIn}
                    onCreate={handleCreate}
                    tr={tr}
                />
            );
        if (id === "chat") return <ChatCard tr={tr} />;
        if (id === "privacy") return <PrivacyCard tr={tr} />;
        if (id === "speed") return <SpeedCard tr={tr} />;
        return <SecurityCard tr={tr} />;
    }

    const offWelcome = active !== 0;

    return (
        <div className={styles.root}>
            <LanguageSwitcher />
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
                        {tr.common.signIn}
                    </button>
                    <button className={styles.topCreate} onClick={handleCreate}>
                        {tr.common.createAccount}
                    </button>
                </div>
            </header>

            {/* ── stage ── */}
            <div
                className={styles.stage}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
            >
                {cards.map((card, i) => {
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
                aria-label={tr.common.previous}
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
                aria-label={tr.common.next}
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
                <p className={styles.cardCaption}>{cards[active].sub}</p>
                <div className={styles.dots}>
                    {cards.map((c, i) => (
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
