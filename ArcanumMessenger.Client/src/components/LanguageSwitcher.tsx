import styles from "./LanguageSwitcher.module.css";
import { useLanguage, setLanguage, type Language } from "../lib/language";

const OPTIONS: { id: Language; label: string }[] = [
    { id: "en", label: "EN" },
    { id: "uk", label: "UK" },
    { id: "de", label: "DE" },
];

export default function LanguageSwitcher() {
    const current = useLanguage();

    return (
        <div className={styles.switcher}>
            {OPTIONS.map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    className={`${styles.option} ${current === opt.id ? styles.optionActive : ""}`}
                    onClick={() => setLanguage(opt.id)}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
