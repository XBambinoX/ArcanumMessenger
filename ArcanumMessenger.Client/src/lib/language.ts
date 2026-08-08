import { useEffect, useState } from "react";

export type Language = "en" | "uk" | "de";

const STORAGE_KEY = "language";
const LANGUAGES: Language[] = ["en", "uk", "de"];
const CHANGE_EVENT = "language-change";

export function getLanguage(): Language {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (LANGUAGES as string[]).includes(stored ?? "") ? (stored as Language) : "en";
}

export function setLanguage(language: Language): void {
    localStorage.setItem(STORAGE_KEY, language);
    window.dispatchEvent(new CustomEvent<Language>(CHANGE_EVENT, { detail: language }));
}

export function useLanguage(): Language {
    const [language, setLanguageState] = useState<Language>(getLanguage());

    useEffect(() => {
        const onChange = (e: Event) =>
            setLanguageState((e as CustomEvent<Language>).detail);
        window.addEventListener(CHANGE_EVENT, onChange);
        return () => window.removeEventListener(CHANGE_EVENT, onChange);
    }, []);

    return language;
}
