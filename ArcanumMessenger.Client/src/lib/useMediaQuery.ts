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

// The layout viewport (what 100svh/100dvh measure) doesn't necessarily
// shrink when a mobile on-screen keyboard opens - visualViewport is the
// one live signal for how much of the screen is actually visible right
// now. Falls back to window.innerHeight where visualViewport isn't
// supported, which just means no keyboard-aware shrinking there.
export function useVisualViewportHeight(): number {
    const [height, setHeight] = useState(
        () => window.visualViewport?.height ?? window.innerHeight,
    );

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;

        // Some mobile browsers fire "scroll" instead of (or ahead of)
        // "resize" when a keyboard opens - watching only one leaves the
        // height stale on those.
        const handler = () => setHeight(vv.height);
        handler();
        vv.addEventListener("resize", handler);
        vv.addEventListener("scroll", handler);
        return () => {
            vv.removeEventListener("resize", handler);
            vv.removeEventListener("scroll", handler);
        };
    }, []);

    return height;
}
