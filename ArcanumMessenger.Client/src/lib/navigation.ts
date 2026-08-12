import type { NavigateFunction } from "react-router";
import { useNavigate } from "react-router";
import { useEffect } from "react";

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

export default function NavigationSetter() {
    const navigate = useNavigate();

    useEffect(() => {
        setNavigate(navigate);
    }, [navigate]);

    return null;
}