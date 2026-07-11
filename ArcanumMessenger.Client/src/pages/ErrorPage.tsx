import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./ErrorPage.module.css";

interface ServerErrorDetails {
    status: number;
    path: string;
    message: string;
    timestamp: string;
}

export default function ErrorPage() {
    const navigate = useNavigate();
    const [details, setDetails] = useState<ServerErrorDetails | null>(null);

    useEffect(() => {
        const raw = sessionStorage.getItem("lastServerError");
        if (raw) {
            try {
                setDetails(JSON.parse(raw));
            } catch {
                setDetails(null);
            }
        }
    }, []);

    const statusLabel = !details?.status || details.status === 0
        ? "Connection lost"
        : `Error ${details.status}`;

    return (
        <div className={styles.root}>
            <div className={styles.orb1} />
            <div className={styles.orb2} />
            <div className={styles.grid} />

            <div className={styles.card}>
                <div className={styles.iconBox}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                </div>

                <p className={styles.statusLabel}>{statusLabel}</p>
                <h1 className={styles.title}>Something went wrong on our end</h1>
                <p className={styles.subtitle}>
                    {details?.message ?? "The server ran into a problem. It's not something you did — try again in a moment."}
                </p>

                {details && (
                    <div className={styles.detailsBox}>
                        <div className={styles.detailsRow}>
                            <span>Path</span>
                            <span>{details.path}</span>
                        </div>
                        <div className={styles.detailsRow}>
                            <span>Time</span>
                            <span>{new Date(details.timestamp).toLocaleString()}</span>
                        </div>
                    </div>
                )}

                <div className={styles.actions}>
                    <button className={styles.btnSecondary} onClick={() => navigate("/welcome")}>
                        Go home
                    </button>
                    <button className={styles.btnPrimary} onClick={() => window.location.reload()}>
                        Try again
                    </button>
                </div>
            </div>
        </div>
    );
}