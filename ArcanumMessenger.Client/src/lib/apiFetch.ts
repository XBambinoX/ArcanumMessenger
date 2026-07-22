import { navigateTo } from "./navigation";

export class ApiError extends Error {
    status: number;
    body?: unknown;

    constructor(status: number, message: string, body?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.body = body;
    }
}

interface ServerErrorDetails {
    status: number;
    path: string;
    message: string;
    timestamp: string;
}

// Only one refresh call in flight at a time — if several requests hit 401
// simultaneously (e.g. multiple widgets fetching on mount), they all await
// the same refresh instead of racing each other and burning refresh tokens.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
    if (!refreshPromise) {
        refreshPromise = fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
        })
            .then((res) => res.ok)
            .catch(() => false)
            .finally(() => {
                refreshPromise = null;
            });
    }
    return refreshPromise;
}

function handleSessionExpired() {
    window.dispatchEvent(new CustomEvent("auth:expired"));
    navigateTo("/welcome", { replace: true });
}

export async function apiFetch(
    path: string,
    init?: RequestInit,
    _isRetry = false,
): Promise<Response> {
    let res: Response;

    try {
        res = await fetch(path, {
            headers: { "Content-Type": "application/json", ...init?.headers },
            credentials: "include",
            ...init,
        });
    } catch (networkErr) {
        reportServerError({
            status: 0,
            path,
            message: "Could not reach the server",
            timestamp: new Date().toISOString(),
        });
        throw networkErr;
    }

    if (res.status === 401 && !_isRetry) {
        const refreshed = await tryRefresh();

        if (refreshed) {
            return apiFetch(path, init, true);
        }

        handleSessionExpired();
        throw new ApiError(401, "Session expired");
    }

    if (res.status >= 500) {
        let message = `Server error (${res.status})`;
        try {
            const body = await res.clone().json();
            if (body?.message) message = body.message;
        } catch { }

        reportServerError({
            status: res.status,
            path,
            message,
            timestamp: new Date().toISOString(),
        });

        throw new ApiError(res.status, message);
    }

    return res;
}

function reportServerError(details: ServerErrorDetails) {
    sessionStorage.setItem("lastServerError", JSON.stringify(details));
    navigateTo("/error", { replace: false });
}