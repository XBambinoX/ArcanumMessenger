export type Language = "en" | "uk" | "de";

const STORAGE_KEY = "language";
const LANGUAGES: Language[] = ["en", "uk", "de"];

export function getLanguage(): Language {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (LANGUAGES as string[]).includes(stored ?? "") ? (stored as Language) : "en";
}

export function setLanguage(language: Language): void {
    localStorage.setItem(STORAGE_KEY, language);
}
