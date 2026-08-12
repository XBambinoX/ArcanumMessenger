// Lets apiFetch.ts (a plain module, not a component) tell AuthContext
// its session just died - same module-level ref-registration pattern as
// navigation.ts's setNavigate/navigateTo. AuthProvider registers the
// handler once on mount; apiFetch calls notifySessionExpired() whenever
// a refresh attempt comes back not-ok, from any of its callers.

let handler: (() => void) | null = null;

export function setSessionExpiredHandler(fn: (() => void) | null): void {
    handler = fn;
}

export function notifySessionExpired(): void {
    handler?.();
}
