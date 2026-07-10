import type { NavigateFunction } from "react-router-dom";

let navigateRef: NavigateFunction | null = null;

export function setNavigate(fn: NavigateFunction) {
    navigateRef = fn;
}

export function navigateTo(path: string, options?: { replace?: boolean; state?: unknown }) {
    if (!navigateRef) {
        window.location.href = path;
        return;
    }
    navigateRef(path, options);
}