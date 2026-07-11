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

const API_PORT = window.location.protocol === "https:" ? 7039 : 5135;
const API_BASE = `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    let res: Response;

    try {
        res = await fetch(`${API_BASE}${path}`, {
            headers: { "Content-Type": "application/json", ...init?.headers },
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