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
        const refreshRes = await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
        });

        if (refreshRes.ok) {
            return apiFetch(path, init, true);
        }

        navigateTo("/login", { replace: false });
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