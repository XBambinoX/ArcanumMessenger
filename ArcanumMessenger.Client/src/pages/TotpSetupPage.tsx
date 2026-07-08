import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import styles from "./TotpSetupPage.module.css";
import { startTotpSetup, confirmTotpSetup } from "../api/totp";

type Step = 0 | 1 | 2; // 0: fetching secret/QR, 1: enter code, 2: done
const CODE_LENGTH = 6;

export default function TotpSetupPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>(0);

    const [secret, setSecret] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const codeInputs = useRef<(HTMLInputElement | null)[]>([]);
    const isCodeComplete = code.every((d) => d !== "");

    useEffect(() => {
        (async () => {
            try {
                const { success, secret, otpauthUri, reason } =
                    await startTotpSetup();
                if (!success || !secret || !otpauthUri) {
                    setError(
                        reason === "already_enabled"
                            ? "Two-factor authentication is already on"
                            : "Something went wrong, try again",
                    );
                    return;
                }
                setSecret(secret);
                setQrDataUrl(
                    await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 }),
                );
                setStep(1);
            } catch {
                setError("Something went wrong, try again");
            }
        })();
    }, []);

    const handleCodeChange = (index: number, value: string) => {
        if (!/^[0-9]?$/.test(value)) return;
        const next = [...code];
        next[index] = value;
        setCode(next);
        if (value && index < CODE_LENGTH - 1) {
            codeInputs.current[index + 1]?.focus();
        }
    };

    const handleCodeKeyDown = (
        index: number,
        e: React.KeyboardEvent<HTMLInputElement>,
    ) => {
        if (e.key === "Backspace" && !code[index] && index > 0) {
            codeInputs.current[index - 1]?.focus();
        }
    };

    const handleConfirm = async () => {
        if (!isCodeComplete) {
            setError("Enter the full 6-digit code");
            return;
        }
        setLoading(true);
        try {
            const { success, reason } = await confirmTotpSetup(code.join(""));
            if (!success) {
                setError(
                    reason === "invalid_code"
                        ? "Incorrect code, try again"
                        : reason === "session_expired"
                          ? "Setup session expired, start over"
                          : "Something went wrong, try again",
                );
                setCode(Array(CODE_LENGTH).fill(""));
                codeInputs.current[0]?.focus();
                return;
            }
            setStep(2);
        } catch {
            setError("Something went wrong, try again");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.root}>
            <div className={styles.orb1} />
            <div className={styles.orb2} />
            <div className={styles.grid} />

            <div className={styles.card}>
                <div className={styles.header}>
                    <p className={styles.brand}>Two-factor authentication</p>
                </div>

                <div className={styles.dots}>
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className={`${styles.dot} ${i === step ? styles.active : ""} ${i < step ? styles.done : ""}`}
                        />
                    ))}
                </div>

                {step === 0 && (
                    <p className={styles.stepSubtitle}>Setting things up…</p>
                )}

                {step === 1 && (
                    <>
                        <h2 className={styles.stepTitle}>Scan this QR code</h2>
                        <p className={styles.stepSubtitle}>
                            Use Google Authenticator, Authy, or any TOTP app
                        </p>

                        {qrDataUrl && (
                            <div className={styles.qrBox}>
                                <img src={qrDataUrl} alt="TOTP QR code" />
                            </div>
                        )}

                        <div className={styles.secretBlock}>
                            <span className={styles.label}>
                                Can't scan? Enter this key manually
                            </span>
                            <code className={styles.secretText}>{secret}</code>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>
                                Enter the 6-digit code from your app
                            </label>
                            <div className={styles.codeRow}>
                                {code.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={(el) => {
                                            codeInputs.current[i] = el;
                                        }}
                                        className={styles.codeDigit}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) =>
                                            handleCodeChange(i, e.target.value)
                                        }
                                        onKeyDown={(e) =>
                                            handleCodeKeyDown(i, e)
                                        }
                                        autoFocus={i === 0}
                                    />
                                ))}
                            </div>
                            {error && (
                                <p
                                    className={styles.errorText}
                                    style={{ textAlign: "center" }}
                                >
                                    {error}
                                </p>
                            )}
                        </div>

                        <div className={styles.actions}>
                            <button
                                className={styles.btnPrimary}
                                onClick={handleConfirm}
                                disabled={loading}
                            >
                                {loading ? "Verifying…" : "Turn on 2FA"}
                            </button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <h2 className={styles.stepTitle}>
                            Two-factor authentication is on
                        </h2>
                        <p className={styles.stepSubtitle}>
                            You'll need a code from your app the next time you
                            sign in
                        </p>
                        <div className={styles.actions}>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => navigate("/welcome")}
                            >
                                Done
                            </button>
                        </div>
                    </>
                )}

                {error && step === 0 && (
                    <p className={styles.errorText} style={{ textAlign: "center" }}>
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}
