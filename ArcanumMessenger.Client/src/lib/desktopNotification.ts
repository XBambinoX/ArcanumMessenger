let permissionRequested = false;

// Only ever asked once per session, and only if the browser hasn't already
// been asked before (a "denied" or "granted" answer is left alone).
export function requestDesktopNotificationPermission() {
    if (!("Notification" in window)) return;
    if (permissionRequested || Notification.permission !== "default") return;

    permissionRequested = true;
    void Notification.requestPermission();
}

export function showDesktopNotification(title: string, body: string, onClick?: () => void) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const notification = new Notification(title, { body });
    notification.onclick = () => {
        window.focus();
        onClick?.();
        notification.close();
    };
}
