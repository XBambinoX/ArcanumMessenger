import { useEffect, useState } from "react";
import { deleteAccount } from "../api/userSettings";
import styles from "./DeleteAccountModal.module.css";

interface DeleteAccountModalProps {
    onClose: () => void;
    onConfirmed: () => void;
    kdfSalt: string;
}

const COOLDOWN_SECONDS = 5;
const MAX_ATTEMPTS = 5;

type Step = "warning" | "password";

export default function DeleteAccountModal({ onClose, onConfirmed, kdfSalt }: DeleteAccountModalProps) {
    const [step, setStep] = useState<Step>("warning");
    const [cooldown, setCooldown] = useState(COOLDOWN_SECONDS);
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [attempts, setAttempts] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (step !== "warning" || cooldown <= 0) return;
        const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => window.clearTimeout(t);
    }, [step, cooldown]);

    const handleContinue = () => {
        if (cooldown > 0) return;
        setStep("password");
    };

    const handleSubmit = async () => {
        if (attempts >= MAX_ATTEMPTS) {
            setError("Too many attempts. Try again later.");
            return;
        }

        setSubmitting(true);
        setError(null);

        const result = await deleteAccount(password, kdfSalt);

        if (!result.ok) {
            setAttempts((a) => a + 1);
            setError(result.reason === "invalid_password" ? "Incorrect password" : "Something went wrong");
            setSubmitting(false);
            return;
        }

        onConfirmed();
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                {step === "warning" && (
                    <div className={styles.step}>
                        <h3 className={styles.title}>Delete Account</h3>
                        <p className={styles.text}>
                            This will permanently delete your account, messages, and all
                            associated data. This action cannot be undone.
                        </p>
                        <div className={styles.actions}>
                            <button className={styles.cancelBtn} onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className={styles.dangerBtn}
                                onClick={handleContinue}
                                disabled={cooldown > 0}
                            >
                                {cooldown > 0 ? `Continue (${cooldown})` : "Continue"}
                            </button>
                        </div>
                    </div>
                )}

                {step === "password" && (
                    <div className={styles.step}>
                        <h3 className={styles.title}>Confirm Your Password</h3>
                        <p className={styles.text}>
                            Enter your password to permanently delete your account.
                        </p>
                        <input
                            className={styles.passwordInput}
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                setError(null);
                            }}
                            autoFocus
                        />
                        {error && <p className={styles.error}>{error}</p>}
                        <div className={styles.actions}>
                            <button className={styles.cancelBtn} onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className={styles.dangerBtn}
                                onClick={handleSubmit}
                                disabled={submitting || password.length === 0}
                            >
                                {submitting ? "Deleting..." : "Delete Account"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}