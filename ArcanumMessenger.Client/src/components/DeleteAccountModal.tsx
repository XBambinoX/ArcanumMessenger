import { useEffect, useState } from "react";
import { deleteAccount } from "../api/userSettings";
import styles from "./DeleteAccountModal.module.css";
import { useLanguage } from "../lib/language";
import { DELETE_ACCOUNT_TRANSLATIONS } from "../lib/profileTranslations";

interface DeleteAccountModalProps {
    onClose: () => void;
    onConfirmed: () => void;
    kdfSalt: string;
}

const COOLDOWN_SECONDS = 5;
const MAX_ATTEMPTS = 5;

type Step = "warning" | "password";

export default function DeleteAccountModal({ onClose, onConfirmed, kdfSalt }: DeleteAccountModalProps) {
    const tr = DELETE_ACCOUNT_TRANSLATIONS[useLanguage()];
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
            setError(tr.tooManyAttempts);
            return;
        }

        setSubmitting(true);
        setError(null);

        const result = await deleteAccount(password, kdfSalt);

        if (!result.ok) {
            setAttempts((a) => a + 1);
            setError(result.reason === "invalid_password" ? tr.incorrectPassword : tr.somethingWrong);
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
                        <h3 className={styles.title}>{tr.warningTitle}</h3>
                        <p className={styles.text}>
                            {tr.warningText}
                        </p>
                        <div className={styles.actions}>
                            <button className={styles.cancelBtn} onClick={onClose}>
                                {tr.cancel}
                            </button>
                            <button
                                className={styles.dangerBtn}
                                onClick={handleContinue}
                                disabled={cooldown > 0}
                            >
                                {cooldown > 0 ? tr.continueWithCountdown(cooldown) : tr.continueLabel}
                            </button>
                        </div>
                    </div>
                )}

                {step === "password" && (
                    <div className={styles.step}>
                        <h3 className={styles.title}>{tr.confirmPasswordTitle}</h3>
                        <p className={styles.text}>
                            {tr.confirmPasswordText}
                        </p>
                        <input
                            className={styles.passwordInput}
                            type="password"
                            placeholder={tr.passwordPlaceholder}
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
                                {tr.cancel}
                            </button>
                            <button
                                className={styles.dangerBtn}
                                onClick={handleSubmit}
                                disabled={submitting || password.length === 0}
                            >
                                {submitting ? tr.deleting : tr.deleteAccountButton}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}