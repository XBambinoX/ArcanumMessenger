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

---

## Want To Run Your Own?

You don't need a data center or a public domain to self-host ArcanumMessenger. A spare laptop or a Raspberry Pi sitting at home is enough – set the stack up there and invite the people you actually talk to.

The one thing you're missing without a domain is a way to reach that machine from outside your home network. [Tailscale](https://tailscale.com/) solves this well: it's a free VPN that puts your server and your devices on one private network, wherever they physically are. No port forwarding, no domain, no public IP – install it on the server and on your phone or laptop, and the server is reachable from anywhere as if it were on your home Wi-Fi. It's how we run our own instance, in fact.

---

# Installation Instructions

Everything below is for anyone who wants to run their own instance. If you're just here to see what the project is about, this is a good place to stop.

This is the production setup – a standalone `docker-compose.prod.yml` that builds the client into a static bundle served behind nginx, with TLS termination and a reverse proxy to the API and SignalR hubs, and keeps every internal service (database, cache, object storage, API) off the host network entirely. There's also a separate dev-only compose file for working on the code itself, but that's not what you'd run to actually use the messenger day to day.

### Prerequisites

- A Linux machine (a Raspberry Pi will do) or a Mac with [Docker](https://docs.docker.com/engine/install/) and its Compose plugin – or Windows with [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/). The installer is a bash script, so on Windows run it inside [WSL](https://learn.microsoft.com/windows/wsl/install), or skip it and set things up by hand (see below).
- An SMTP account, for account confirmation and password recovery emails

---

### Installation

1. **Clone the repository:**
   ```
   git clone https://github.com/Blackcat-404/ArcanumMessenger.git
   cd ArcanumMessenger
   ```

2. **Run the installer:**
   ```
   ./install.sh
   ```
   It checks Docker, writes `.env` with freshly generated secrets – asking you only for the SMTP mailbox to send from – and creates a TLS certificate for the addresses it finds on the machine (LAN IP, Tailscale IP, hostname), or takes certificate files you already have. Then it builds and starts the stack and waits until everything is healthy; the database is set up automatically on first start.

3. **Open one of the addresses it prints** in your browser. With a self-signed certificate the browser warns you the first time – that's expected, proceed anyway (usually something like "Advanced" -> "Proceed").

This, combined with Tailscale, is enough to run a real private server without ever needing a domain.

**Updating** is `git pull`, then `./install.sh` again. Re-running it is always safe: it never changes a value that's already in `.env`, keeps the certificate, rebuilds, and the API applies any new database migrations as it starts.

<details>
<summary>Setting it up by hand instead</summary>

1. Copy `.env.example` to `.env` and fill it in. `ENCRYPTION_KEK`, `EMAIL_HASH_PEPPER`, `PUBLIC_ID_HASH_PEPPER` and `JWT_SECRET` each take `openssl rand -base64 32`; the passwords can be any random string.
2. Put a certificate and its key into the folder `HTTPS_CERT_DIR` points at, as `arcanum-lan.crt` and `arcanum-lan.key` – nginx has no plain-HTTP fallback.
3. Start it: `docker compose -f docker-compose.prod.yml up --build -d`. Migrations run when the API starts.

On Windows, `openssl` comes with Git for Windows (run it from Git Bash), and `HTTPS_CERT_DIR` takes forward slashes: `C:/Users/<you>/arcanum-certs`.

</details>

---

### Backups

An install is three things:

- **`.env` – the one that matters most.** `ENCRYPTION_KEK` and the two peppers in it can't be recreated: lose them and existing accounts can't sign in again, and whatever the server encrypted with them stays unreadable. Keep a copy off the machine, in a password manager for example.
- **The database:**
  ```
  docker exec arcanum-db-prod pg_dump -U arcanum_user -d arcanum > arcanum-db-$(date +%F).sql
  ```
- **Media** (stored end-to-end encrypted):
  ```
  docker run --rm -v arcanum-prod_minio_data_prod:/data:ro -v "$PWD":/backup alpine \
    tar czf /backup/arcanum-media-$(date +%F).tar.gz -C /data .
  ```

The certificate in `certs/` can simply be created again.

To restore on a fresh machine, put `.env` back **first** – `install.sh` won't pair a new `.env` with old data – then load the database and the media before the API ever starts:
```
docker compose -f docker-compose.prod.yml up -d db minio
docker exec -i arcanum-db-prod psql -U arcanum_user -d arcanum < arcanum-db-2026-10-06.sql
docker compose -f docker-compose.prod.yml stop minio
docker run --rm -v arcanum-prod_minio_data_prod:/data -v "$PWD":/backup alpine \
  tar xzf /backup/arcanum-media-2026-10-06.tar.gz -C /data
./install.sh
```

---

### Upload Size Limits

nginx caps request bodies under `/api/` at 16 MB (`client_max_body_size` in `ArcanumMessenger.Client/nginx/nginx.conf`). That holds as long as no single request is bigger: files from 1 MB up are sent in encrypted 10 MB chunks (the API takes up to 15 MB per chunk), and avatars are capped at 10 MB. If you raise `CHUNK_THRESHOLD` (`ArcanumMessenger.Client/src/api/chunkedUpload.ts`) or `CHUNK_SIZE` (`ArcanumMessenger.Client/src/crypto/chunkedMedia.ts`) past 16 MB, raise the nginx limit with them – otherwise uploads fail with 413 in production while still working in dev, where the Vite proxy has no limit.
