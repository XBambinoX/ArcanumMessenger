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
            { threshold: 0.12 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return { ref, visible };
}

// Scroll progress (0–100)
function useScrollProgress() {
    const [progress, setProgress] = useState(0);
    useEffect(() => {
        const onScroll = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    return progress;
}

// Tracks which section id is currently in view, for navbar highlighting
function useActiveSection(ids: string[]) {
    const [active, setActive] = useState<string>(ids[0] ?? "");
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) setActive(entry.target.id);
                });
            },
            { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
        );
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [ids]);
    return active;
}

// Glow that follows the mouse
function useMouseGlow(glowRef: React.RefObject<HTMLDivElement | null>) {
    useEffect(() => {
        const el = glowRef.current;
        if (!el) return;
        const onMove = (e: MouseEvent) => {
            el.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
        };
        window.addEventListener("mousemove", onMove);
        return () => window.removeEventListener("mousemove", onMove);
    }, []);
}

// Particles
function useParticles(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();
        window.addEventListener("resize", resize);

        const particles = Array.from({ length: 60 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.5 + 0.3,
            dx: (Math.random() - 0.5) * 0.3,
            dy: (Math.random() - 0.5) * 0.3,
            o: Math.random() * 0.5 + 0.1,
        }));

        let raf: number;
        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            for (const p of particles) {
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
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    }, []);
}

const features = [
    {
        big: true,
        icon: "🔐",
        iconBg: "rgba(124,58,237,0.15)",
        title: "End-to-end encryption",
        text: "Every message is encrypted on your device before it leaves. Not even the server has access to your conversations. Your privacy is guaranteed at the protocol level — no backdoors, no exceptions.",
    },
    {
        icon: "⚡",
        iconBg: "rgba(6,182,212,0.12)",
        title: "Real-time delivery",
        text: "Powered by SignalR and Redis — messages arrive in milliseconds.",
    },
    {
        icon: "👥",
        iconBg: "rgba(99,102,241,0.15)",
        title: "Group chats",
        text: "Create groups, manage members, and collaborate in one place.",
    },
    {
        icon: "📡",
        iconBg: "rgba(124,58,237,0.15)",
        title: "Online status",
        text: "See when someone is active and when they're typing.",
    },
    {
        icon: "🗂️",
        iconBg: "rgba(6,182,212,0.12)",
        title: "Files & media",
        text: "Send photos, videos, and files of any size without quality loss.",
    },
];

const techStack = [
    { icon: "⚙️", bg: "rgba(99,102,241,0.15)", name: ".NET 9", desc: "High-performance API backend" },
    { icon: "🐘", bg: "rgba(59,130,246,0.15)", name: "PostgreSQL 16", desc: "Reliable relational database" },
    { icon: "🔴", bg: "rgba(239,68,68,0.15)", name: "Redis 7.2", desc: "In-memory cache & pub/sub" },
    { icon: "🐳", bg: "rgba(6,182,212,0.15)", name: "Docker", desc: "Fully containerized stack" },
];

export default function WelcomePage() {
    const hero = useReveal();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useParticles(canvasRef);

    const featRefs = features.map(() => useReveal());
    const techRefs = techStack.map(() => useReveal());

    const scrollProgress = useScrollProgress();
    const activeSection = useActiveSection(["hero-section", "features-section", "tech-section"]);
    const glowRef = useRef<HTMLDivElement>(null);
    useMouseGlow(glowRef);

    const scrollTo = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <div className={styles.root}>

            {/* Scroll progress bar */}
            <div className={styles.scrollProgress} style={{ width: `${scrollProgress}%` }} />

            {/* Mouse glow */}
            <div ref={glowRef} className={styles.mouseGlow} />

            {/* ── NAVBAR ── */}
            <nav className={styles.navbar}>
                <div className={styles.navLogo}>
                    <div className={styles.navLogoIcon}>
                        <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
                            <path d="M24 4L42 14.5V33.5L24 44L6 33.5V14.5L24 4Z" stroke="url(#ng)" strokeWidth="2.5" fill="none" />
                            <circle cx="24" cy="24" r="4" fill="url(#ng)" />
                            <defs>
                                <linearGradient id="ng" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
                                    <stop stopColor="#a78bfa" /><stop offset="1" stopColor="#22d3ee" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <span className={styles.navLogoText}>Arcanum</span>
                </div>
                <div className={styles.navLinks}>
                    <button
                        className={`${styles.navLink} ${activeSection === "features-section" ? styles.active : ""}`}
                        onClick={() => scrollTo("features-section")}
                    >
                        Features
                    </button>
                    <button
                        className={`${styles.navLink} ${activeSection === "tech-section" ? styles.active : ""}`}
                        onClick={() => scrollTo("tech-section")}
                    >
                        Tech stack
                    </button>
                    <button className={styles.navBtn}>Sign in</button>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section id="hero-section" className={styles.hero}>
                <div className={styles.orb1} />
                <div className={styles.orb2} />
                <div className={styles.orb3} />
                <div className={styles.grid} />
                <canvas ref={canvasRef} className={styles.particles} />

                <div ref={hero.ref} className={`${styles.heroInner} ${hero.visible ? styles.visible : ""}`}>

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
                        Communicate without limits — quickly, reliably, and fully encrypted.
                    </p>

                    <div className={styles.buttons}>
                        <button className={styles.btnPrimary}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                            </svg>
                            Sign in
                        </button>
                        <button className={styles.btnSecondary}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            Create account
                        </button>
                    </div>

                    <p className={styles.footerHint}>
                        End-to-end encrypted · Open source · Self-hosted
                    </p>
                </div>

                <div className={styles.scrollHint}>
                    <span>scroll</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                </div>
            </section>

            {/* ── FEATURES ── */}
            <section id="features-section" className={styles.features}>
                <div className={styles.featuresInner}>
                    <p className={styles.sectionLabel}>Features</p>
                    <h2 className={styles.sectionTitle}>Everything you need to communicate</h2>
                    <p className={styles.sectionSubtitle}>
                        Built for privacy-first users who want full control over their data.
                    </p>

                    <div className={styles.featGrid}>
                        {features.map((f, i) => (
                            <div
                                key={i}
                                ref={featRefs[i].ref}
                                className={`${styles.card} ${f.big ? styles.featCardBig : ""} ${featRefs[i].visible ? styles.visible : ""}`}
                                style={{ transitionDelay: `${i * 80}ms` }}
                            >
                                <div className={styles.cardIcon} style={{ background: f.iconBg, fontSize: f.big ? "28px" : "22px" }}>
                                    {f.icon}
                                </div>
                                <h3 className={styles.cardTitle}>{f.title}</h3>
                                <p className={styles.cardText}>{f.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── TECH STACK ── */}
            <section id="tech-section" className={styles.tech}>
                <div className={styles.techInner}>
                    <p className={styles.sectionLabel}>Tech stack</p>
                    <h2 className={styles.sectionTitle}>Built on solid foundations</h2>
                    <p className={styles.sectionSubtitle}>
                        Modern, battle-tested technologies wrapped in Docker for easy deployment.
                    </p>

                    <div className={styles.techGrid}>
                        {techStack.map((t, i) => (
                            <div
                                key={i}
                                ref={techRefs[i].ref}
                                className={`${styles.techCard} ${techRefs[i].visible ? styles.visible : ""}`}
                                style={{ transitionDelay: `${i * 100}ms` }}
                            >
                                <div className={styles.techIcon} style={{ background: t.bg }}>{t.icon}</div>
                                <p className={styles.techName}>{t.name}</p>
                                <p className={styles.techDesc}>{t.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className={styles.footer}>
                © {new Date().getFullYear()} Arcanum Messenger · Also check out{" "}
                <a
                    href="https://github.com/Blackcat-404/AuthVault---password-manager"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.footerLink}
                >
                    AuthVault
                </a>
            </footer>

        </div>
    );
}
