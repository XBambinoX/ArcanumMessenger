import { useEffect, useState } from "react";

export type Theme = "system" | "dark" | "light";

const STORAGE_KEY = "theme";
const THEMES: Theme[] = ["system", "dark", "light"];
const CHANGE_EVENT = "theme-change";

export function getTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (THEMES as string[]).includes(stored ?? "") ? (stored as Theme) : "system";
}

function applyTheme(theme: Theme): void {
    document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme: Theme): void {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme);
    window.dispatchEvent(new CustomEvent<Theme>(CHANGE_EVENT, { detail: theme }));
}

// Runs as soon as this module is imported (see main.tsx) so the very first
// paint already uses the stored theme - waiting for a React effect would
// flash the default "system" look first.
applyTheme(getTheme());

export function useTheme(): Theme {
    const [theme, setThemeState] = useState<Theme>(getTheme());

    useEffect(() => {
        const onChange = (e: Event) =>
            setThemeState((e as CustomEvent<Theme>).detail);
        window.addEventListener(CHANGE_EVENT, onChange);
        return () => window.removeEventListener(CHANGE_EVENT, onChange);
    }, []);

    return theme;
}
