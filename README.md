# ArcanumMessenger

**Your messages. Your key.**

ArcanumMessenger is an open-source, end-to-end encrypted messenger built around one idea: the person storing your messages should never be able to read them. Every chat key is generated and wrapped on the client with ECDH – text, voice notes, photos, video, all of it is ciphertext the moment it leaves your device. There's no server-side switch that turns encryption off, no metadata trade-off for convenience, and no way to read a conversation without the keys the people in it hold.

That's not a promise you have to take on faith, either – the source is right here for anyone to check, so the encryption is something you can verify instead of just trust.

---

## License

This project is licensed under the **[PolyForm Noncommercial 1.0.0 License](https://polyformproject.org/licenses/noncommercial/1.0.0/)**.
You may use, modify, and distribute the code **for non-commercial purposes only**.

## Contributors

<a href="https://github.com/Blackcat-404">
  <img src="https://avatars.githubusercontent.com/u/186369840?v=4" width="70" style="margin-right:15px;" title="Blackcat-404 – Core Developer" />
</a>
<a href="https://github.com/XBambinoX">
  <img src="https://avatars.githubusercontent.com/u/108579760?v=4" width="70" title="XBambinoX – Backend & SQL Server" />
</a>

---

## Features

- **Encryption that covers everything, not just text:** chat keys are generated and wrapped on the client via ECDH – messages, photos, voice notes, video, all of it is ciphertext before it ever leaves your device. A lot of "secure" messengers stop at the text bubble; here the server never holds a readable copy of anything, media included.
- **Privacy starts at sign-up, not just in the chat:** registration only ever asks for a username, an email to send a one-time verification code to, and a password – no phone number, ever. The email itself isn't kept afterward either: what's actually stored is a one-way hash used to catch duplicate accounts, not the address, so nobody – including whoever's running the server – can recover it from the database later.
- **Open source, so the encryption is verifiable, not just claimed:** every line involved in generating, wrapping, and storing keys is public. And if you'd rather not rely on someone else's instance at all, the code is the same whether you're using ours or running your own.
- **No central account recovery:** lose your device and you don't lose your account or end up in a support queue proving who you are. A BIP39 recovery phrase generated on your own client is the only way back in, and it's never stored anywhere the server could hand over.
- **Deletion that actually deletes:** background jobs hard-delete expired messages, chats, orphaned media, and dead sessions from both the database and object storage on a schedule – gone means gone, not just hidden behind a flag in a backup somewhere.
- **Full visibility into your own account:** see every device signed in and revoke any of them instantly, no ticket required.
- **Your history goes with you:** export any chat to a ZIP straight from the browser – a `messages.html` that looks like the chat itself, a `result.json` for scripts, and the photos, videos, voice notes and files, optionally password-protected. It's all decrypted on your own device, so the server never sees a readable copy on the way out either.
- **Everything you'd expect from a daily-driver messenger:** direct chats, groups, a private Saved Messages space, photos/voice/video/GIFs/stickers, replies, forwarding, reactions, editing, quick-reply (arrow keys on desktop, swipe on mobile), contacts with blocking, TOTP two-factor auth, and light/dark themes with multiple languages.

## Screenshots

<img width="1830" height="958" alt="2026-08-12_22-34-49" src="https://github.com/user-attachments/assets/89a0c7a9-d730-4255-9c5d-6a1979f1675d" />
<img width="1830" height="957" alt="2026-08-12_22-35-32" src="https://github.com/user-attachments/assets/63804dd7-dd30-46eb-b9cb-a926bcbde1e7" />
<img width="1828" height="957" alt="2026-08-12_22-51-43" src="https://github.com/user-attachments/assets/1cfa5fd2-b929-4ee4-84a6-5c8a8bc5933d" />

---

## Tech Stack

**Backend**
- ASP.NET Core 10 Web API (C#)
- Entity Framework Core + PostgreSQL
- SignalR for real-time updates
- Redis for caching and presence
- MinIO (S3-compatible) for encrypted media storage – the `bitnamilegacy/minio` image, since the official `minio/minio` images were discontinued; it's frozen at its last release and gets no security updates
- Argon2 password hashing, JWT bearer auth with refresh-token rotation, TOTP two-factor auth

**Frontend**
- React 19 + TypeScript, built with Vite
- Web Crypto API (`crypto.subtle`) for all client-side encryption and key handling
- `@microsoft/signalr` for the real-time connection

**Infrastructure**
- Docker Compose for local development
- nginx reverse proxy with TLS in front of a static production build
- GitHub Actions builds the production images for amd64 and arm64 into GHCR, and a single-file installer (.NET + Spectre.Console) for Linux, macOS and Windows

---

## Want To Run Your Own?

You don't need a data center or a public domain to self-host ArcanumMessenger. A spare laptop or a Raspberry Pi sitting at home is enough – set the stack up there and invite the people you actually talk to.

The one thing you're missing without a domain is a way to reach that machine from outside your home network. [Tailscale](https://tailscale.com/) solves this well: it's a free VPN that puts your server and your devices on one private network, wherever they physically are. No port forwarding, no domain, no public IP – install it on the server and on your phone or laptop, and the server is reachable from anywhere as if it were on your home Wi-Fi. It's how we run our own instance, in fact.

---

# Installation Instructions

Everything below is for anyone who wants to run their own instance. If you're just here to see what the project is about, this is a good place to stop.

This is the production setup – the client is a static bundle served by nginx, which terminates TLS and proxies the API and SignalR hubs, and every internal service (database, cache, object storage, API) stays off the host network entirely. The images are built ahead of time for both amd64 and arm64, so the server only downloads them: nothing gets compiled on it, and it doesn't need the source code. There's also a separate dev-only compose file for working on the code itself, but that's not what you'd run to actually use the messenger day to day.

### Prerequisites

- Docker with its Compose plugin: [Docker Engine](https://docs.docker.com/engine/install/) on Linux (a Raspberry Pi with a 64-bit OS will do), [Docker Desktop](https://www.docker.com/products/docker-desktop/) on macOS or Windows
- An SMTP account, for account confirmation and password recovery emails

---

### Installation

1. **Download the installer and run it.** It's a single file with nothing else to install – every build is on the [latest release](https://github.com/XBambinoX/ArcanumMessenger/releases/latest).

   **Linux** – on a Raspberry Pi 4/5, take `arcanum-linux-arm64` instead:
   ```
   curl -fLo arcanum https://github.com/XBambinoX/ArcanumMessenger/releases/latest/download/arcanum-linux-x64
   chmod +x arcanum
   ./arcanum install
   ```

   **macOS** – on an Intel Mac, take `arcanum-macos-x64` instead:
   ```
   curl -fLo arcanum https://github.com/XBambinoX/ArcanumMessenger/releases/latest/download/arcanum-macos-arm64
   chmod +x arcanum
   ./arcanum install
   ```
   It isn't signed by Apple, so if you download it with a browser instead, macOS won't open it until you run `xattr -d com.apple.quarantine arcanum`.

   **Windows** – start Docker Desktop, then download [`arcanum-windows-x64.exe`](https://github.com/XBambinoX/ArcanumMessenger/releases/latest/download/arcanum-windows-x64.exe) and double-click it. It isn't signed either, so the first time SmartScreen says "Windows protected your PC" – click "More info", then "Run anyway".

2. **Answer its questions.** It checks Docker, writes `~/.arcanum/.env` with freshly generated secrets – asking you only for the SMTP mailbox to send from – and creates a TLS certificate for the addresses it finds on the machine (LAN IP, Tailscale IP, hostname), or takes certificate files you already have. Then it downloads and starts the stack and waits until everything is healthy; the database is set up automatically on first start. On Linux and macOS it offers at the end to copy itself into `/usr/local/bin`, so from then on it's just `arcanum`.

3. **Open one of the addresses it prints** in your browser.

This, combined with Tailscale, is enough to run a real private server without ever needing a domain.

Everything the installer creates lives in `~/.arcanum` (`%USERPROFILE%\.arcanum` on Windows): the `.env`, the `docker-compose.yml` it runs, the certificate in `certs/`, and in `ca/` the certificate authority that signed it. Plain `docker compose ...` works in that folder too.

Run without a command, the installer shows a menu with everything below – that's what double-clicking it on Windows does. Or give the command directly: `arcanum update` once it's in `/usr/local/bin`, otherwise `./arcanum update`, or `.\arcanum-windows-x64.exe update` in PowerShell.

| Command | What it does |
|---|---|
| `arcanum update` | pulls the images of this installer's version and restarts; the API applies new database migrations as it starts |
| `arcanum start`, `arcanum stop` | starts or stops everything |
| `arcanum status` | shows the containers and the addresses |
| `arcanum logs [service]` | follows the logs – of everything, or of `api`, `client`, `db`, `redis` or `minio` |
| `arcanum uninstall` | removes the containers – or everything, data included |

**Updating** means getting the newer installer and running its update – each installer pulls the images of its own version, so the compose file and the images always match. Download it the same way as the first time, over the old file, or on Linux and macOS into `/usr/local/bin` if it's there (with your system's file name):
```
sudo curl -fLo /usr/local/bin/arcanum https://github.com/XBambinoX/ArcanumMessenger/releases/latest/download/arcanum-linux-x64
arcanum update
```
It's always safe to re-run: it never changes a value that's already in `.env`, and keeps the certificate.

### Trusting the certificate

The installer makes a small certificate authority (CA) of its own and signs the server's certificate with it, then offers to trust that CA on the computer it runs on – the system's list, plus Firefox (and Chrome on Linux), which keep their own; for those it needs `certutil` (`nss` on Arch, `libnss3-tools` on Debian/Ubuntu).

Every other device warns about the certificate until it trusts the CA too. That's a one-time step per device: certificates renewed later are signed by the same CA. Copy `~/.arcanum/ca/arcanum-ca.crt` to the device – the `.crt`, never the `.key` next to it – and:

- **Android:** search Settings for "CA certificate" → Install anyway → pick the file.
- **iPhone, iPad:** open the file (AirDrop or mail it to yourself) → Settings → Profile Downloaded → Install. Then Settings → General → About → Certificate Trust Settings → turn it on.
- **Windows:** double-click it → Install Certificate → Current User → Place all certificates in the following store → Trusted Root Certification Authorities.
- **macOS:** double-click it, then in Keychain Access open it → Trust → When using this certificate: Always Trust.
- **Firefox, anywhere:** Settings → Privacy & Security → Certificates → View Certificates → Authorities → Import.

Or skip it and click through the browser's warning ("Advanced" → "Proceed"). The connection is encrypted either way; trusting the CA is what lets the browser tell it's really your server.

<details>
<summary>Running it without the installer, or from source</summary>

The installer only automates this. Get the repository (`git clone https://github.com/XBambinoX/ArcanumMessenger.git`), then:

1. Copy `.env.example` to `.env` and fill it in. `ENCRYPTION_KEK`, `EMAIL_HASH_PEPPER`, `PUBLIC_ID_HASH_PEPPER` and `JWT_SECRET` each take `openssl rand -base64 32`; the passwords can be any random string. Point `HTTPS_CERT_DIR` at your certificate's folder, or remove it to use `./certs`.
2. Put the certificate and its key into that folder as `arcanum-lan.crt` and `arcanum-lan.key` – nginx has no plain-HTTP fallback.
3. Start it with the published images: `docker compose -f docker-compose.prod.yml up -d` – or build the images yourself: `docker compose -f docker-compose.prod.yml -f docker-compose.build.yml up --build -d`. Migrations run when the API starts.

The installer can run images you built yourself, too – give them a tag and pass it along:
```
ARCANUM_TAG=local docker compose -f docker-compose.prod.yml -f docker-compose.build.yml build
ARCANUM_TAG=local ./arcanum install
```
The installer itself runs from source with the .NET 10 SDK: `dotnet run --project ArcanumMessenger.Installer -- install`.

</details>

---

### Backups

An install is these four things:

- **`~/.arcanum/.env` – the one that matters most.** `ENCRYPTION_KEK` and the two peppers in it can't be recreated: lose them and existing accounts can't sign in again, and whatever the server encrypted with them stays unreadable. Keep a copy off the machine, in a password manager for example.
- **`~/.arcanum/ca/`** – the certificate authority. Without it the installer makes a new one, and every device has to trust that one all over again.
- **The database:**
  ```
  docker exec arcanum-db-prod pg_dump -U arcanum_user -d arcanum --clean --if-exists > arcanum-db-$(date +%F).sql
  ```
- **Media** (stored end-to-end encrypted):
  ```
  docker run --rm -v arcanum-prod_minio_data_prod:/data:ro -v "$PWD":/backup alpine \
    tar czf /backup/arcanum-media-$(date +%F).tar.gz -C /data .
  ```

The certificate in `certs/` can simply be created again.

To restore on a fresh machine, put `.env` and `ca/` into `~/.arcanum` **first** – the installer won't pair a new `.env` with old data – and run `arcanum install`. Then, from the folder with the backups, load the database and the media while the API is stopped:
```
docker stop arcanum-api-prod arcanum-minio-prod
docker exec -i arcanum-db-prod psql -U arcanum_user -d arcanum < arcanum-db-2026-10-06.sql
docker run --rm -v arcanum-prod_minio_data_prod:/data -v "$PWD":/backup alpine \
  tar xzf /backup/arcanum-media-2026-10-06.tar.gz -C /data
arcanum start
```

---

### Upload Size Limits

nginx caps request bodies under `/api/` at 16 MB (`client_max_body_size` in `ArcanumMessenger.Client/nginx/nginx.conf`). That holds as long as no single request is bigger: files from 1 MB up are sent in encrypted 10 MB chunks (the API takes up to 15 MB per chunk), and avatars are capped at 10 MB. If you raise `CHUNK_THRESHOLD` (`ArcanumMessenger.Client/src/api/chunkedUpload.ts`) or `CHUNK_SIZE` (`ArcanumMessenger.Client/src/crypto/chunkedMedia.ts`) past 16 MB, raise the nginx limit with them – otherwise uploads fail with 413 in production while still working in dev, where the Vite proxy has no limit.
