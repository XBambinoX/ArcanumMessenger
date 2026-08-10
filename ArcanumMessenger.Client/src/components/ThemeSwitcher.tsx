import styles from "./ThemeSwitcher.module.css";
import { useTheme, setTheme, type Theme } from "../lib/theme";

// Icons only, no text - same reasoning as LanguageSwitcher's own "EN/UK/DE"
// labels: understandable regardless of which language is currently active,
// so this needs no translation lookup of its own.
const SystemIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
    </svg>
);
const DarkIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
);
const LightIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
);

const OPTIONS: { id: Theme; Icon: () => React.ReactElement }[] = [
    { id: "system", Icon: SystemIcon },
    { id: "dark", Icon: DarkIcon },
    { id: "light", Icon: LightIcon },
];

export default function ThemeSwitcher() {
    const current = useTheme();

    return (
        <div className={styles.switcher}>
            {OPTIONS.map(({ id, Icon }) => (
                <button
                    key={id}
                    type="button"
                    className={`${styles.option} ${current === id ? styles.optionActive : ""}`}
                    onClick={() => setTheme(id)}
                    aria-label={id}
                >
                    <Icon />
                </button>
            ))}
        </div>
    );
}
