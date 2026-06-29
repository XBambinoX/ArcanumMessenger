import { useEffect, useRef, useState } from "react";
import styles from "./WelcomePage.module.css";

function useReveal() {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setVisible(true); },
            { threshold: 0.15 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return { ref, visible };
}

const features = [
    {
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
        ),
        iconBg: "rgba(124,58,237,0.15)",
        iconColor: "#a78bfa",
        title: "End-to-end encryption",
        text: "All messages are encrypted on your device. Not even the server can see the content of your conversations.",
    },
    {
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
        ),
        iconBg: "rgba(6,182,212,0.12)",
        iconColor: "#22d3ee",
        title: "Lightning-fast speed",
        text: "An architecture based on SignalR and Redis enables real-time message delivery.",
    },
    {
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
            </svg>
        ),
        iconBg: "rgba(99,102,241,0.15)",
        iconColor: "#818cf8",
        title: "Group chats",
        text: "Create groups, manage members, and communicate with your team all in one place.",
    },
    {
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
        ),
        iconBg: "rgba(124,58,237,0.15)",
        iconColor: "#a78bfa",
        title: "Activity status",
        text: "You can see when the person you're chatting with is online and whether they're reading your message right now.",
    },
    {
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        ),
        iconBg: "rgba(6,182,212,0.12)",
        iconColor: "#22d3ee",
        title: "Media and Files",
        text: "Send photos, videos, and files of any size without losing quality.",
    },
    {
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
            </svg>
        ),
        iconBg: "rgba(99,102,241,0.15)",
        iconColor: "#818cf8",
        title: "Self-hosted",
        text: "Deploy on your own server using Docker. Full control over your data and infrastructure.",
    },
];

export default function WelcomePage() {
    const hero = useReveal();
    const cardRefs = features.map(() => useReveal());

    return (
        <div className={styles.root}>

            {/* ── HERO ── */}
            <section className={styles.hero}>
                <div className={styles.orb1} />
                <div className={styles.orb2} />
                <div className={styles.orb3} />
                <div className={styles.grid} />

                <div ref={hero.ref} className={`${styles.heroInner} ${hero.visible ? styles.visible : ""}`}>

                    {/* Logo */}
                    <div className={styles.logoWrap}>
                        <span className={styles.pulseRing} />
                        <div className={styles.logoBox}>
                            <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
                                <path d="M24 4L42 14.5V33.5L24 44L6 33.5V14.5L24 4Z" stroke="url(#hg)" strokeWidth="2" fill="none" />
                                <circle cx="24" cy="24" r="4.5" fill="url(#hg)" />
                                <path d="M24 14V19M24 29V34M14.5 19.5L18.5 22M29.5 26L33.5 28.5M14.5 28.5L18.5 26M29.5 22L33.5 19.5"
                                    stroke="url(#hg)" strokeWidth="1.5" strokeLinecap="round" />
                                <defs>
                                    <linearGradient id="hg" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#a78bfa" />
                                        <stop offset="1" stopColor="#22d3ee" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <h1 className={styles.brandName}>Arcanum</h1>
                        <p className={styles.brandSub}>Messenger</p>
                    </div>

                    <div className={styles.divider}>
                        <span className={styles.divLine} />
                        <span className={styles.divStar}>✦</span>
                        <span className={styles.divLineR} />
                    </div>

                    <p className={styles.description}>
                        Secure messaging for those who value privacy.
                        Communicate without limits—quickly, reliably, and in an encrypted environment.
                    </p>

                    <div className={styles.buttons}>
                        <button className={styles.btnPrimary} onClick={() => {/* navigate("/login") */ }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                            </svg>
                            Увійти
                        </button>
                        <button className={styles.btnSecondary} onClick={() => {/* navigate("/register") */ }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            Реєстрація
                        </button>
                    </div>

                    <p className={styles.footerHint}>
                        End-to-end encrypted · Open source · Self-hosted
                    </p>
                </div>

                {/* Scroll hint */}
                <div className={styles.scrollHint}>
                    <span>scroll</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section className={styles.features}>
                <div className={styles.featuresInner}>
                    <p className={styles.sectionLabel}>Features</p>
                    <h2 className={styles.sectionTitle}>Everything you need to communicate</h2>
                    <p className={styles.sectionSubtitle}>
                        Arcanum is built on a modern tech stack—.NET, PostgreSQL, Redis, and Docker.
                    </p>

                    <div className={styles.grid3}>
                        {features.map((f, i) => (
                            <div
                                key={i}
                                ref={cardRefs[i].ref}
                                className={`${styles.card} ${cardRefs[i].visible ? styles.visible : ""}`}
                                style={{ transitionDelay: `${i * 80}ms` }}
                            >
                                <div
                                    className={styles.cardIcon}
                                    style={{ background: f.iconBg, color: f.iconColor }}
                                >
                                    {f.icon}
                                </div>
                                <h3 className={styles.cardTitle}>{f.title}</h3>
                                <p className={styles.cardText}>{f.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className={styles.footer}>
                © {new Date().getFullYear()} Arcanum Messenger · Also check out {" "}
                <a href="https://github.com/Blackcat-404/AuthVault---password-manager" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(167,139,250,0.7)", textDecoration: "none" }}>
                    AuthVault
                </a>
            </footer>

        </div>
    );
}
