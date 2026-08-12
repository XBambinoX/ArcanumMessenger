import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import QRCode from "qrcode";
import styles from "./TotpSetupPage.module.css";
import { startTotpSetup, confirmTotpSetup } from "../api/totp";

type Step = 0 | 1 | 2; // 0: show QR + secret (covers loading too), 1: enter code, 2: done
const CODE_LENGTH = 6;

export default function TotpSetupPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>(0);
    const [initializing, setInitializing] = useState(true);

    const [sessionId, setSessionId] = useState<string | null>(null);
    const [secret, setSecret] = useState<string | null>(null);
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const codeInputs = useRef<(HTMLInputElement | null)[]>([]);
    const isCodeComplete = code.every((d) => d !== "");

    const goBack = () => {
        setError("");
        setStep((s) => Math.max(s - 1, 0) as Step);
    };

    useEffect(() => {
        (async () => {
            try {
                const { success, sessionId, secret, otpauthUri, reason } =
                    await startTotpSetup();
                if (!success || !sessionId || !secret || !otpauthUri) {
                    setError(
                        reason === "already_enabled"
                            ? "Two-factor authentication is already on"
                            : "Something went wrong, try again",
                    );
                    return;
                }
                setSessionId(sessionId);
                setSecret(secret);
                setQrDataUrl(
                    await QRCode.toDataURL(otpauthUri, {
                        margin: 1,
                        width: 220,
                    }),
                );
            } catch {
                setError("Something went wrong, try again");
            } finally {
                setInitializing(false);
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
        if (!sessionId) {
            setError("Setup session expired, start over");
            return;
        }
        setLoading(true);
        try {
            const { success, reason } = await confirmTotpSetup(
                sessionId,
                code.join(""),
            );
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
                    <div className={styles.logoBox}>
                        <svg
                            width="28"
                            height="28"
                            viewBox="0 0 48 48"
                            fill="none"
                        >
                            <path
                                d="M16 12H32a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6H20l-6 5v-5a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z"
                                stroke="url(#rg)"
                                strokeWidth="2.2"
                                fill="none"
                                strokeLinejoin="round"
                            />
                            <defs>
                                <linearGradient
                                    id="rg"
                                    x1="6"
                                    y1="4"
                                    x2="42"
                                    y2="44"
                                    gradientUnits="userSpaceOnUse"
                                >
                                    <stop stopColor="rgb(var(--accent-light-rgb))" />
                                    <stop offset="1" stopColor="rgb(var(--accent-cyan-rgb))" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <p className={styles.brand}>Arcanum</p>
                    <span className={styles.label}>
                        Two-factor authentication
                    </span>
                </div>

                <div className={styles.dots}>
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className={`${styles.dot} ${i === step ? styles.active : ""} ${i < step ? styles.done : ""}`}
                        />
                    ))}
                </div>

                {step === 0 && initializing && (
                    <p className={styles.stepSubtitle}>Setting things up…</p>
                )}

                {step === 0 && !initializing && error && !qrDataUrl && (
                    <p
                        className={styles.errorText}
                        style={{ textAlign: "center" }}
                    >
                        {error}
                    </p>
                )}

                {step === 0 && !initializing && qrDataUrl && (
                    <>
                        <h2 className={styles.stepTitle}>Scan this QR code</h2>
                        <p className={styles.stepSubtitle}>
                            Use Google Authenticator, Authy, or any TOTP app
                        </p>

                        <div className={styles.qrBox}>
                            <img src={qrDataUrl} alt="TOTP QR code" />
                        </div>

                        <div className={styles.secretBlock}>
                            <span className={styles.label}>
                                Can't scan? Enter this key manually
                            </span>
                            <code className={styles.secretText}>{secret}</code>
                        </div>

                        <div className={styles.actions}>
                            <button
                                className={styles.btnPrimary}
                                onClick={() => setStep(1)}
                            >
                                Continue
                            </button>
                        </div>
                    </>
                )}

                {step === 1 && (
                    <>
                        <h2 className={styles.stepTitle}>
                            Enter the 6-digit code
                        </h2>
                        <p className={styles.stepSubtitle}>
                            From the app you just scanned the QR code with
                        </p>

                        <div className={styles.field}>
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
                                className={styles.btnBack}
                                onClick={goBack}
                                aria-label="Back"
                            >
                                <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                            </button>
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
                                onClick={() => navigate("/app")}
                            >
                                Done
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
