#!/usr/bin/env bash
# Sets up or updates a production Arcanum Messenger on this machine: ./install.sh
# Safe to re-run - it only adds what's missing from .env and never changes an existing secret.
# Kept to bash 3.2, which is what macOS ships.
set -euo pipefail

cd "$(dirname "$0")"
SELF="$PWD/$(basename "$0")"

COMPOSE_FILE=docker-compose.prod.yml
ENV_FILE=.env
CERT_NAME=arcanum-lan # the file names nginx.conf loads
API_CONTAINER=arcanum-api-prod
CLIENT_CONTAINER=arcanum-client-prod
DB_VOLUME=arcanum-prod_postgres_data_prod # compose project "arcanum-prod" + the volume's name

GUM_VERSION=2.0.2
GUM="$PWD/.installer/gum-$GUM_VERSION"

# Brand colours, from index.css
VIOLET="#7c3aed"
VIOLET_LIGHT="#a78bfa"
GREEN="#4fb85c"
YELLOW="#fbbf24"
RED="#f87171"

export GUM_CHOOSE_CURSOR_FOREGROUND=$VIOLET_LIGHT GUM_CHOOSE_HEADER_FOREGROUND=$VIOLET_LIGHT \
    GUM_CHOOSE_SELECTED_FOREGROUND=$VIOLET_LIGHT GUM_CONFIRM_PROMPT_FOREGROUND=$VIOLET_LIGHT \
    GUM_CONFIRM_SELECTED_BACKGROUND=$VIOLET GUM_INPUT_CURSOR_FOREGROUND=$VIOLET_LIGHT \
    GUM_INPUT_HEADER_FOREGROUND=$VIOLET_LIGHT GUM_INPUT_PROMPT_FOREGROUND=$VIOLET \
    GUM_SPIN_SPINNER_FOREGROUND=$VIOLET_LIGHT

CERT_CHANGED=0

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# ── Before gum is available ─────────────────────────────────────────────

die_plain() {
    printf '\033[31m✗ %s\033[0m\n' "$1" >&2
    exit 1
}

# sha256 of each gum release archive, from the release's checksums.txt
gum_sha256() {
    case "$1" in
        Linux_x86_64) echo d842e06d93dbed90af48cb8dd10698db6f22e331fc40346bb37bbc753109edc2 ;;
        Linux_arm64) echo 8ebf8b54ec1e8c81f2bb58b59ff9b70998186a4d11375f0cf357b80e0ccfa1d5 ;;
        Linux_armv7) echo a7ee9b68052e401c47335982fec7fc1d246868abfe6b542654432ee2df7a8141 ;;
        Linux_armv6) echo 3589848314d33adc47b1852774d10808dd7c0c055f71b09a2cc60b6887429454 ;;
        Darwin_x86_64) echo 5374966c7c7199ea879fcaa525ddc6d447a098d3d35496e430a9a1ef38d30485 ;;
        Darwin_arm64) echo 4777a69b1170b8db23c95d5889fb32186cfda1a3ac950d339aa17e3513633890 ;;
        *) return 1 ;;
    esac
}

platform() {
    local os arch
    case "$(uname -s)" in
        Linux) os=Linux ;;
        Darwin) os=Darwin ;;
        *) die_plain "Unsupported system: $(uname -s). On Windows, run this from WSL." ;;
    esac
    case "$(uname -m)" in
        x86_64 | amd64) arch=x86_64 ;;
        aarch64 | arm64) arch=arm64 ;;
        armv7l) arch=armv7 ;;
        armv6l) arch=armv6 ;;
        *) arch=$(uname -m) ;;
    esac
    echo "${os}_${arch}"
}

download() {
    if command -v curl >/dev/null; then
        curl -fsSL -o "$1" "$2"
    elif command -v wget >/dev/null; then
        wget -qO "$1" "$2"
    else
        die_plain "Neither curl nor wget is installed."
    fi
}

sha256_of() {
    if command -v sha256sum >/dev/null; then
        sha256sum "$1" | cut -d' ' -f1
    else
        shasum -a 256 "$1" | cut -d' ' -f1
    fi
}

# gum draws the installer's UI - fetched once into .installer/, pinned and checksum-verified.
ensure_gum() {
    [ -x "$GUM" ] && return
    command -v tar >/dev/null || die_plain "tar isn't installed."

    local target expected archive tmp
    target=$(platform)
    expected=$(gum_sha256 "$target") || die_plain "There's no installer UI build for $target."
    archive="gum_${GUM_VERSION}_${target}.tar.gz"
    tmp=$(mktemp -d)

    echo "Fetching the installer UI (gum $GUM_VERSION, ~5 MB)..."
    download "$tmp/$archive" "https://github.com/charmbracelet/gum/releases/download/v$GUM_VERSION/$archive" \
        || die_plain "Couldn't download $archive."
    if [ "$(sha256_of "$tmp/$archive")" != "$expected" ]; then
        rm -rf "$tmp"
        die_plain "Checksum mismatch for $archive - not running it."
    fi
    tar -xzf "$tmp/$archive" -C "$tmp"
    mkdir -p "$(dirname "$GUM")"
    mv "$tmp/gum_${GUM_VERSION}_${target}/gum" "$GUM"
    rm -rf "$tmp"
}

# ── UI ──────────────────────────────────────────────────────────────────
# Everything goes to stderr, so a message printed inside $(...) never ends up in a captured value.

section() {
    echo >&2
    "$GUM" style --bold --foreground "$VIOLET_LIGHT" "$1" >&2
}
note() { "$GUM" style --faint "$1" >&2; }
ok() { echo "$("$GUM" style --foreground "$GREEN" "✓") $1" >&2; }
warn() { echo "$("$GUM" style --foreground "$YELLOW" "!") $1" >&2; }
die() {
    echo "$("$GUM" style --foreground "$RED" "✗") $1" >&2
    exit 1
}

# Asks until it gets a non-empty answer. A 4th argument masks the input.
ask() {
    local answer
    while :; do
        answer=$("$GUM" input --header "$1" --placeholder "$2" --value "${3:-}" ${4:+--password})
        [ -n "$answer" ] && break
    done
    echo "$answer"
}

ask_existing_file() {
    local path
    while :; do
        path=$(ask "$1" "/path/to/file")
        path=${path/#\~/$HOME}
        [ -f "$path" ] && break
        warn "No such file: $path"
    done
    echo "$path"
}

banner() {
    "$GUM" style --border rounded --border-foreground "$VIOLET" --padding "1 6" --margin "1 0 0 0" --align center \
        "$("$GUM" style --bold --foreground "$VIOLET_LIGHT" "A R C A N U M")" \
        "$("$GUM" style --faint "$1")" >&2
}

# ── Steps ───────────────────────────────────────────────────────────────

check_requirements() {
    section "Requirements"
    command -v docker >/dev/null || die "Docker isn't installed - see https://docs.docker.com/engine/install/"
    docker compose version >/dev/null 2>&1 || die "The Docker Compose plugin ('docker compose') isn't installed."
    docker info >/dev/null 2>&1 ||
        die "Can't reach the Docker daemon. Is it running, and can $(id -un) use it? (sudo usermod -aG docker $(id -un), then log in again)"
    ok "Docker $(docker version --format '{{.Server.Version}}') with Compose $(docker compose version --short)"
    command -v openssl >/dev/null || die "openssl isn't installed."
    ok "$(openssl version | cut -d' ' -f1-2)"
}

# A new .env can't run on an old database: Postgres keeps the password it was created with,
# and data encrypted with the old keys stays unreadable with new ones.
check_old_data() {
    if [ -f "$ENV_FILE" ] || ! docker volume inspect "$DB_VOLUME" >/dev/null 2>&1; then
        return 0
    fi

    section "Data from an earlier install"
    warn "This machine still has the database of an earlier Arcanum install, but no .env for it."
    note "A new .env means new passwords and keys - that database won't accept them."
    local choice
    choice=$("$GUM" choose --header "What should happen to the old data?" \
        "Stop here - I'll put its .env back first" \
        "Delete it and start fresh")
    case "$choice" in
        Stop*)
            note "Put the old .env next to install.sh and run ./install.sh again."
            exit 0
            ;;
    esac

    "$GUM" confirm --default=false "This permanently deletes every account, message and file of that install. Delete?" || exit 0
    # Any cert dir will do for `down` - without .env the path would be empty, which compose rejects.
    HTTPS_CERT_DIR=. "$GUM" spin --title "Removing the old containers and data..." -- \
        docker compose -f "$COMPOSE_FILE" down -v
    ok "Old data removed"
}

env_get() {
    { grep -E "^$1=" "$ENV_FILE" 2>/dev/null || true; } | tail -n 1 | cut -d= -f2- |
        sed -e "s/^'\(.*\)'\$/\1/" -e 's/^"\(.*\)"$/\1/'
}

# Quotes anything beyond plain characters, so a space, $ or # in a password or path reaches the app as is.
env_add() {
    local value=$2
    case "$value" in
        *[!A-Za-z0-9_./+=:@-]*)
            case "$value" in
                *\'*) value="\"$(printf '%s' "$value" | sed -e 's/[\\"$]/\\&/g')\"" ;;
                *) value="'$value'" ;;
            esac
            ;;
    esac
    printf '%s=%s\n' "$1" "$value" >>"$ENV_FILE"
}

# Never overwrites: changing ENCRYPTION_KEK or a pepper on a live install locks everyone out for good.
env_default() { [ -n "$(env_get "$1")" ] || env_add "$1" "$2"; }

configure() {
    section "Configuration"
    if [ -f "$ENV_FILE" ]; then
        ok "Found $ENV_FILE - existing values stay as they are"
    else
        printf '# Generated by install.sh on %s. Back it up - see "Backups" in the README.\n' "$(date +%F)" >"$ENV_FILE"
    fi
    chmod 600 "$ENV_FILE" 2>/dev/null || true

    env_default POSTGRES_HOST db
    env_default POSTGRES_DB arcanum
    env_default POSTGRES_USER arcanum_user
    env_default POSTGRES_PASSWORD "$(openssl rand -hex 24)"
    env_default MINIO_ROOT_USER arcanum
    env_default MINIO_ROOT_PASSWORD "$(openssl rand -hex 24)"
    env_default ENCRYPTION_KEK "$(openssl rand -base64 32)"
    env_default EMAIL_HASH_PEPPER "$(openssl rand -base64 32)"
    env_default PUBLIC_ID_HASH_PEPPER "$(openssl rand -base64 32)"
    env_default JWT_SECRET "$(openssl rand -base64 32)"
    env_default HTTPS_CERT_DIR "$PWD/certs"
    ok "Secrets and service passwords are in place"

    [ -n "$(env_get SMTP_HOST)" ] || ask_smtp

    local placeholders
    placeholders=$({ grep -E '^[A-Z_]+=.*(your_|example\.com|<username>)' "$ENV_FILE" || true; } | cut -d= -f1 | tr '\n' ' ')
    if [ -n "$placeholders" ]; then
        warn "$ENV_FILE still has example values in: $placeholders"
        "$GUM" confirm --default=false "Continue anyway?" || exit 1
    fi
}

ask_smtp() {
    note "Arcanum emails a one-time code at sign-up and account recovery, so it needs a mailbox to send from."
    local provider host port user pass
    provider=$("$GUM" choose --header "Mail provider" Gmail Outlook.com Yahoo "Something else")
    case "$provider" in
        Gmail) host=smtp.gmail.com port=587 ;;
        Outlook.com) host=smtp-mail.outlook.com port=587 ;;
        Yahoo) host=smtp.mail.yahoo.com port=587 ;;
        *)
            host=$(ask "SMTP server" "smtp.example.com")
            port=$(ask "SMTP port" "587" 587)
            ;;
    esac
    user=$(ask "Mailbox address" "you@example.com")
    note "Most providers want an app password here, not your normal one (Gmail: Google Account → Security → App passwords)."
    pass=$(ask "Password for $user" "app password" "" secret)

    env_add SMTP_HOST "$host"
    env_add SMTP_PORT "$port"
    env_add SMTP_USERNAME "$user"
    env_add SMTP_PASSWORD "$pass"
    ok "Mail goes out through $host as $user"
}

cert_end_date() { openssl x509 -enddate -noout -in "$1" | cut -d= -f2; }

setup_certificate() {
    section "HTTPS certificate"
    local dir crt key choice
    dir=$(env_get HTTPS_CERT_DIR)
    crt="$dir/$CERT_NAME.crt"
    key="$dir/$CERT_NAME.key"

    if [ -f "$crt" ] && [ -f "$key" ]; then
        if openssl x509 -checkend 2592000 -noout -in "$crt" >/dev/null; then
            ok "Using $crt (valid until $(cert_end_date "$crt"))"
            return
        fi
        warn "$crt expires within 30 days"
        "$GUM" confirm "Replace it now?" || return 0
    fi

    mkdir -p "$dir"
    choice=$("$GUM" choose --header "How should nginx get its certificate?" \
        "Create a self-signed one (fine for a home or Tailscale setup)" \
        "Use certificate files I already have")
    case "$choice" in
        Create*) create_self_signed "$crt" "$key" ;;
        *) copy_own_certificate "$crt" "$key" ;;
    esac
    CERT_CHANGED=1
}

# This machine's LAN and Tailscale addresses plus its hostname - what people will type to reach it.
detect_addresses() {
    {
        if command -v ip >/dev/null; then
            ip -4 -o addr show scope global | awk '$2 !~ /^(docker|br-|veth|virbr|cni|flannel)/ { split($4, a, "/"); print a[1] }'
        else
            ifconfig 2>/dev/null | awk '/^[a-z]/ { iface = $1 } /inet / && $2 != "127.0.0.1" && iface !~ /^(utun|bridge)/ { print $2 }'
        fi
        if command -v tailscale >/dev/null; then
            tailscale ip -4 2>/dev/null || true
        fi
        local host
        host=$(uname -n)
        host=${host%%.*}
        if [ -n "$host" ] && [ "$host" != localhost ]; then
            echo "$host"
            echo "$host.local"
        fi
    } | awk 'NF && !seen[$0]++'
}

create_self_signed() {
    local crt=$1 key=$2 found picked="" extra san addr
    found=$(detect_addresses)
    if [ -n "$found" ]; then
        picked=$(echo "$found" | "$GUM" choose --no-limit --selected='*' \
            --header "Addresses you'll open Arcanum by (space toggles, enter confirms)")
    fi
    extra=$("$GUM" input --header "Any other addresses? Comma-separated, optional - e.g. a domain or a Tailscale MagicDNS name" \
        --placeholder "myserver.example.com")

    san="DNS:localhost,IP:127.0.0.1"
    for addr in $picked $(echo "$extra" | tr ',' ' '); do
        if echo "$addr" | grep -Eq '^[0-9]+(\.[0-9]+){3}$'; then
            san="$san,IP:$addr"
        else
            san="$san,DNS:$addr"
        fi
    done

    # 825 days and serverAuth: the most Apple devices accept, even for a certificate you trust by hand.
    openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
        -keyout "$key" -out "$crt" -subj "/CN=Arcanum Messenger" \
        -addext "subjectAltName=$san" -addext "extendedKeyUsage=serverAuth" 2>/dev/null ||
        die "openssl couldn't create the certificate."
    chmod 600 "$key"
    ok "Self-signed certificate for $(echo "$san" | sed -e 's/DNS://g' -e 's/IP://g' -e 's/,/, /g')"
}

copy_own_certificate() {
    local crt=$1 key=$2 src_crt src_key
    src_crt=$(ask_existing_file "Certificate file (PEM - the full chain if you have one)")
    src_key=$(ask_existing_file "Its private key (PEM)")

    openssl x509 -noout -in "$src_crt" 2>/dev/null || die "$src_crt isn't a PEM certificate."
    [ "$(openssl x509 -noout -pubkey -in "$src_crt")" = "$(openssl pkey -pubout -in "$src_key" 2>/dev/null)" ] ||
        die "That key doesn't belong to that certificate."

    [ "$src_crt" -ef "$crt" ] || cp "$src_crt" "$crt"
    [ "$src_key" -ef "$key" ] || cp "$src_key" "$key"
    chmod 600 "$key"
    ok "Using your certificate (valid until $(cert_end_date "$crt"))"
}

start_stack() {
    section "Build and start"
    note "The first build compiles the server and the web app - a few minutes, longer on a Raspberry Pi."
    "$GUM" confirm "Build and start Arcanum now?" || exit 0
    compose up --build -d
    if [ "$CERT_CHANGED" = 1 ]; then
        compose restart client >/dev/null 2>&1
    fi
}

health_of() { docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$1" 2>/dev/null || true; }

# Runs under `gum spin` (see wait_until_healthy). Exit codes: 0 healthy, 1 timed out, 2 the API keeps failing.
wait_loop() {
    local api client
    for _ in $(seq 1 150); do
        api=$(health_of "$API_CONTAINER")
        client=$(health_of "$CLIENT_CONTAINER")
        if [ "$api" = healthy ] && [ "$client" = healthy ]; then
            return 0
        fi
        if [ "$api" = unhealthy ] || [ "$(docker inspect -f '{{.RestartCount}}' "$API_CONTAINER" 2>/dev/null || echo 0)" -gt 0 ]; then
            return 2
        fi
        sleep 2
    done
    return 1
}

wait_until_healthy() {
    local status=0
    "$GUM" spin --title "Waiting for Arcanum to come up - the first start also sets up the database..." -- \
        bash "$SELF" --wait-healthy || status=$?
    if [ "$status" = 0 ]; then
        ok "Everything is up and healthy"
        return
    fi

    if [ "$status" = 2 ]; then
        warn "The API keeps failing to start. Its last log lines:"
    else
        warn "Arcanum didn't come up within 5 minutes. The API's last log lines:"
    fi
    compose logs --tail 30 api >&2 || true
    if compose logs api 2>/dev/null | grep -q 28P01; then
        warn "The database was created with a different POSTGRES_PASSWORD than the one in $ENV_FILE."
        note "Put back the .env it was created with - or, to start over, delete that data with: docker compose -f $COMPOSE_FILE down -v (all accounts and messages go with it)."
    fi
    die "Fix what's above and run ./install.sh again. Full logs: docker compose -f $COMPOSE_FILE logs"
}

cert_addresses() {
    openssl x509 -noout -text -in "$1" | grep -A1 "Subject Alternative Name" | tail -n 1 |
        tr ',' '\n' | sed -e 's/^ *//' -e 's/^DNS://' -e 's/^IP Address://' |
        { grep -vxE 'localhost|127\.0\.0\.1|.*\*.*' || true; }
}

summary() {
    local crt urls="" addr self_signed=""
    crt="$(env_get HTTPS_CERT_DIR)/$CERT_NAME.crt"
    for addr in $(cert_addresses "$crt"); do
        urls="$urls  https://$addr/"$'\n'
    done
    [ -n "$urls" ] || urls="  https://localhost/"$'\n'
    if [ "$(openssl x509 -noout -subject -in "$crt" | cut -d= -f2-)" = "$(openssl x509 -noout -issuer -in "$crt" | cut -d= -f2-)" ]; then
        self_signed="The browser will warn about the self-signed certificate the first time - that's expected."
    fi

    "$GUM" style --border rounded --border-foreground "$VIOLET" --padding "1 3" --margin "1 0" \
        "$("$GUM" style --bold --foreground "$GREEN" "Arcanum is running")" \
        "" \
        "Open it at:" \
        "$urls" \
        "$self_signed" \
        "" \
        "$("$GUM" style --bold --foreground "$YELLOW" "Back up $PWD/$ENV_FILE somewhere safe.")" \
        "Lose its keys and existing accounts can't sign in again." \
        "" \
        "$("$GUM" style --faint "Update:  git pull && ./install.sh")" \
        "$("$GUM" style --faint "Logs:    docker compose -f $COMPOSE_FILE logs -f")" \
        "$("$GUM" style --faint "Stop:    docker compose -f $COMPOSE_FILE down")" >&2
}

main() {
    if [ "${1:-}" = --wait-healthy ]; then
        wait_loop
        exit
    fi

    ensure_gum
    if [ -f "$ENV_FILE" ]; then
        banner "Updating this installation"
    else
        banner "Production installer"
    fi
    check_requirements
    check_old_data
    configure
    setup_certificate
    start_stack
    wait_until_healthy
    summary
}

main "$@"
