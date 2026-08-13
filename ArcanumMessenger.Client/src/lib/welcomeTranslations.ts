import type { Language } from "./language";

export interface WelcomeTranslation {
    common: {
        signIn: string;
        createAccount: string;
        previous: string;
        next: string;
        send: string;
    };
    welcomeCard: {
        tagline: string;
        hint: string;
        vaultLink: string;
    };
    chat: {
        samName: string;
        online: string;
        typeMessage: string;
        msgs: readonly [string, string, string, string];
    };
    chatCard: {
        eyebrow: string;
        title: string;
        desc: string;
        bullets: readonly [string, string, string];
    };
    privacyCard: {
        eyebrow: string;
        title: string;
        desc: string;
        rowLabels: {
            username: string;
            email: string;
            password: string;
            messages: string;
        };
    };
    speedCard: {
        eyebrow: string;
        title: string;
        desc: string;
        label: string;
    };
    securityCard: {
        eyebrow: string;
        title: string;
        desc: string;
        tag: string;
        phraseWords: readonly string[];
    };
    cards: {
        welcome: { label: string; sub: string };
        chat: { label: string; sub: string };
        privacy: { label: string; sub: string };
        speed: { label: string; sub: string };
        security: { label: string; sub: string };
    };
}

export const WELCOME_TRANSLATIONS: Record<Language, WelcomeTranslation> = {
    en: {
        common: {
            signIn: "Sign in",
            createAccount: "Create account",
            previous: "Previous",
            next: "Next",
            send: "Send",
        },
        welcomeCard: {
            tagline:
                "Secure messaging for those who value privacy. Communicate without limits – quickly, reliably, and fully encrypted.",
            hint: "End-to-end encrypted · Open source",
            vaultLink: "Also check out AuthVault →",
        },
        chat: {
            samName: "Sam",
            online: "online",
            typeMessage: "Type a message…",
            msgs: [
                "Hey! Have you tried Arcanum yet?",
                "Just signed up. So fast",
                "And nobody can read this",
                "Finally a messenger I trust 🙏",
            ],
        },
        chatCard: {
            eyebrow: "Live preview",
            title: "Messages that stay yours",
            desc: "This is how Arcanum looks in action. Every message is encrypted on your device before it leaves – the server only ever relays ciphertext.",
            bullets: [
                "End-to-end encrypted delivery",
                "Typing indicators in real time",
                "No plain-text storage, ever",
            ],
        },
        privacyCard: {
            eyebrow: "Privacy",
            title: "Zero knowledge",
            desc: "Passwords and recovery phrases never leave your browser in plain form, and profile data is sealed with a separate encryption key for every user. Even a full database leak reveals nothing but ciphertext.",
            rowLabels: {
                username: "username",
                email: "email",
                password: "password",
                messages: "messages",
            },
        },
        speedCard: {
            eyebrow: "Performance",
            title: "Instant delivery",
            desc: "WebSocket connections with Redis pub/sub under the hood. Messages arrive before you blink – no polling, no delays.",
            label: "delivered in milliseconds",
        },
        securityCard: {
            eyebrow: "Recovery",
            title: "Your keys, your control",
            desc: "No recovery emails, no support tickets. Forgot your password? Your secret passphrase – generated right in your browser, never sent anywhere – is all you need.",
            tag: "12 words · Only you hold the keys",
            phraseWords: [
                "forest",
                "moon",
                "river",
                "stone",
                "echo",
                "flame",
                "tide",
                "veil",
                "amber",
                "drift",
                "haze",
                "north",
            ],
        },
        cards: {
            welcome: { label: "Arcanum Messenger", sub: "Your private space" },
            chat: { label: "Live preview", sub: "See Arcanum in action" },
            privacy: { label: "Zero knowledge", sub: "Your data. Your rules." },
            speed: {
                label: "Instant delivery",
                sub: "Messages in milliseconds",
            },
            security: {
                label: "Passphrase recovery",
                sub: "Your keys. Your control.",
            },
        },
    },
    uk: {
        common: {
            signIn: "Увійти",
            createAccount: "Створити акаунт",
            previous: "Попередній",
            next: "Наступний",
            send: "Надіслати",
        },
        welcomeCard: {
            tagline:
                "Безпечний месенджер для тих, хто цінує приватність. Спілкуйтеся без обмежень – швидко, надійно й повністю зашифровано.",
            hint: "Наскрізне шифрування · Відкритий код",
            vaultLink: "Також спробуйте AuthVault →",
        },
        chat: {
            samName: "Sam",
            online: "онлайн",
            typeMessage: "Введіть повідомлення…",
            msgs: [
                "Привіт! Ти вже спробував Arcanum?",
                "Щойно зареєструвався. Так швидко",
                "І ніхто не може це прочитати",
                "Нарешті месенджер, якому я довіряю 🙏",
            ],
        },
        chatCard: {
            eyebrow: "Демо",
            title: "Повідомлення, що залишаються вашими",
            desc: "Так виглядає Arcanum у дії. Кожне повідомлення шифрується на вашому пристрої, перш ніж залишити його – сервер лише передає зашифровані дані.",
            bullets: [
                "Наскрізне шифрування доставки",
                "Індикатори набору тексту в реальному часі",
                "Жодного зберігання відкритого тексту",
            ],
        },
        privacyCard: {
            eyebrow: "Приватність",
            title: "Нульове знання",
            desc: "Паролі та фрази відновлення ніколи не залишають ваш браузер у відкритому вигляді, а дані профілю захищені окремим ключем шифрування для кожного користувача. Навіть повний злам бази даних не розкриє нічого, крім зашифрованих даних.",
            rowLabels: {
                username: "ім'я користувача",
                email: "електронна пошта",
                password: "пароль",
                messages: "повідомлення",
            },
        },
        speedCard: {
            eyebrow: "Швидкість",
            title: "Миттєва доставка",
            desc: "WebSocket-з'єднання з Redis pub/sub під капотом. Повідомлення приходять швидше, ніж ви встигнете кліпнути – без опитувань, без затримок.",
            label: "доставка за мілісекунди",
        },
        securityCard: {
            eyebrow: "Відновлення",
            title: "Ваші ключі, ваш контроль",
            desc: "Без листів для відновлення, без звернень до підтримки. Забули пароль? Ваша секретна фраза – згенерована прямо в браузері й нікуди не надсилається – це все, що потрібно.",
            tag: "12 слів · Лише ви маєте ключі",
            phraseWords: [
                "ліс",
                "місяць",
                "річка",
                "камінь",
                "відлуння",
                "вогонь",
                "хвиля",
                "завіса",
                "амбра",
                "дрейф",
                "туман",
                "північ",
            ],
        },
        cards: {
            welcome: { label: "Arcanum Messenger", sub: "Ваш приватний простір" },
            chat: { label: "Демо", sub: "Дивіться Arcanum у дії" },
            privacy: { label: "Нульове знання", sub: "Ваші дані. Ваші правила." },
            speed: {
                label: "Миттєва доставка",
                sub: "Повідомлення за мілісекунди",
            },
            security: {
                label: "Відновлення за фразою",
                sub: "Ваші ключі. Ваш контроль.",
            },
        },
    },
    de: {
        common: {
            signIn: "Anmelden",
            createAccount: "Konto erstellen",
            previous: "Zurück",
            next: "Weiter",
            send: "Senden",
        },
        welcomeCard: {
            tagline:
                "Sichere Nachrichten für alle, die Privatsphäre schätzen. Kommuniziere ohne Grenzen – schnell, zuverlässig und vollständig verschlüsselt.",
            hint: "Ende-zu-Ende-verschlüsselt · Open Source",
            vaultLink: "Schau dir auch AuthVault an →",
        },
        chat: {
            samName: "Sam",
            online: "online",
            typeMessage: "Nachricht schreiben…",
            msgs: [
                "Hey! Hast du Arcanum schon ausprobiert?",
                "Gerade angemeldet. So schnell",
                "Und niemand kann das lesen",
                "Endlich ein Messenger, dem ich vertraue 🙏",
            ],
        },
        chatCard: {
            eyebrow: "Live-Vorschau",
            title: "Nachrichten, die dir gehören",
            desc: "So sieht Arcanum in Aktion aus. Jede Nachricht wird auf deinem Gerät verschlüsselt, bevor sie es verlässt – der Server leitet nur Chiffretext weiter.",
            bullets: [
                "Ende-zu-Ende-verschlüsselte Zustellung",
                "Echtzeit-Tippanzeigen",
                "Niemals unverschlüsselte Speicherung",
            ],
        },
        privacyCard: {
            eyebrow: "Datenschutz",
            title: "Zero-Knowledge",
            desc: "Passwörter und Wiederherstellungsphrasen verlassen deinen Browser nie im Klartext, und Profildaten werden für jeden Nutzer mit einem eigenen Verschlüsselungsschlüssel gesichert. Selbst ein vollständiges Datenbank-Leck zeigt nur Chiffretext.",
            rowLabels: {
                username: "Benutzername",
                email: "E-Mail",
                password: "Passwort",
                messages: "Nachrichten",
            },
        },
        speedCard: {
            eyebrow: "Leistung",
            title: "Sofortige Zustellung",
            desc: "WebSocket-Verbindungen mit Redis Pub/Sub im Hintergrund. Nachrichten kommen an, bevor du blinzelst – kein Polling, keine Verzögerungen.",
            label: "Zustellung in Millisekunden",
        },
        securityCard: {
            eyebrow: "Wiederherstellung",
            title: "Deine Schlüssel, deine Kontrolle",
            desc: "Keine Wiederherstellungs-E-Mails, keine Support-Tickets. Passwort vergessen? Deine geheime Passphrase – direkt in deinem Browser generiert und niemals irgendwohin gesendet – ist alles, was du brauchst.",
            tag: "12 Wörter · Nur du hast die Schlüssel",
            phraseWords: [
                "Wald",
                "Mond",
                "Fluss",
                "Stein",
                "Echo",
                "Flamme",
                "Flut",
                "Schleier",
                "Amber",
                "Drift",
                "Dunst",
                "Norden",
            ],
        },
        cards: {
            welcome: { label: "Arcanum Messenger", sub: "Dein privater Raum" },
            chat: { label: "Live-Vorschau", sub: "Erlebe Arcanum in Aktion" },
            privacy: { label: "Zero-Knowledge", sub: "Deine Daten. Deine Regeln." },
            speed: {
                label: "Sofortige Zustellung",
                sub: "Nachrichten in Millisekunden",
            },
            security: {
                label: "Passphrasen-Wiederherstellung",
                sub: "Deine Schlüssel. Deine Kontrolle.",
            },
        },
    },
};
