import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = () => setMatches(mql.matches);
        handler();
        mql.addEventListener("change", handler);
        return () => mql.removeEventListener("change", handler);
    }, [query]);

    return matches;
}

// Kept in sync with WelcomePage.module.css's pre-login carousel breakpoint -
// the one other real layout breakpoint in the app.
export const MOBILE_BREAKPOINT_QUERY = "(max-width: 760px)";

export function useIsMobile(): boolean {
    return useMediaQuery(MOBILE_BREAKPOINT_QUERY);
}
