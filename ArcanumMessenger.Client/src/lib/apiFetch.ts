import { navigateTo } from "./navigation";
import { notifySessionExpired } from "./authEvents";

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

let refreshPromise: Promise<Response> | null = null;

// The one shared refresh gateway for the whole app - every caller
// (this file's own 401 retry below, api/session.ts's proactive
// keepalive timer, and its visibilitychange catch-up) goes through this
// same in-flight guard, so two of them racing to redeem the same
// single-use refresh-token cookie can never both fire a real request.
// Whichever caller's request actually reaches the network decides the
// outcome for everyone waiting on it.
export async function refreshOnce(): Promise<Response> {
    if (!refreshPromise) {
        refreshPromise = fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
        }).then((res) => {
            if (!res.ok) notifySessionExpired();
            return res;
        }).finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
}

interface ServerErrorDetails {
    status: number;
    path: string;
    message: string;
    timestamp: string;
}

const skipRefresh = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/refresh",
    "/api/auth/logout",
];

export async function apiFetch(
    path: string,
    init?: RequestInit,
    _isRetry = false,
): Promise<Response> {
    let res: Response;

    try {
        // A FormData body needs the browser to set its own multipart
        // Content-Type (with the boundary) - forcing application/json here
        // would break it.
        const headers = init?.body instanceof FormData
            ? init?.headers
            : { "Content-Type": "application/json", ...init?.headers };

        res = await fetch(path, {
            headers,
            credentials: "include",
            ...init,
        });
    } catch (networkErr) {
        if (networkErr instanceof DOMException && networkErr.name === "AbortError") {
            throw networkErr;
        }

        reportServerError({
            status: 0,
            path,
            message: "Could not reach the server",
            timestamp: new Date().toISOString(),
        });
        throw networkErr;
    }

    if (res.status === 401 && !_isRetry && !skipRefresh.some(endpoint => path.startsWith(endpoint))) {
        const refreshRes = await refreshOnce();

        if (refreshRes.ok) {
            return apiFetch(path, init, true);
        }

        return res;
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