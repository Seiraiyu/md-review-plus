# Relay deployment runbook

A single-node deployment of the md-review-plus relay. Stateful only in
memory (24h TTL), so cold restarts drop in-flight sessions.

## Prerequisites

- A host with a public IP and a DNS record (e.g. `md-review-plus.ai`).
- [Caddy](https://caddyserver.com/) for TLS + HTTP/2.
- Bun 1.x.

## Steps

1.  **Clone + install.**

    git clone https://github.com/Seiraiyu/md-review-plus.git
    cd md-review-plus/relay
    bun install

2.  **Systemd unit** at `/etc/systemd/system/mdrp-relay.service`:

        [Unit]
        Description=md-review-plus relay
        After=network.target

        [Service]
        Type=simple
        WorkingDirectory=/opt/md-review-plus/relay
        ExecStart=/usr/local/bin/bun src/index.ts
        Environment=MDRP_PORT=8080
        Environment=MDRP_TTL_MS=86400000
        Environment=MDRP_MAX_SESSIONS=1000
        Environment=MDRP_RATE_LIMIT_PER_HOUR=30
        Restart=on-failure
        RestartSec=5
        User=mdrp

        [Install]
        WantedBy=multi-user.target

    Then `systemctl enable --now mdrp-relay`.

3.  **Caddy config.** Copy `Caddyfile.sample` to `/etc/caddy/Caddyfile`,
    edit the hostname, then `systemctl reload caddy`. The `flush_interval -1`
    is required for SSE to work — without it Caddy buffers the response.

4.  **Smoke test:**

    curl https://md-review-plus.ai/api/health

    # → {"status":"ok","sessions":0}

    curl -X POST https://md-review-plus.ai/api/sessions \
     -H 'content-type: application/json' \
     -d '{"v":1,"iv":"AAA","ct":"AQID","filename":"t.md"}'

    # → {"id":"...","expiresAt":...}

    curl https://md-review-plus.ai/api/sessions/<id>

    # → echoes the iv/ct/filename

## Logs

Server writes startup banner + expired-session sweep counts to stdout.
Capture via journald (`journalctl -u mdrp-relay -f`). Bodies are not
logged.

## Scaling

In-memory state means horizontal scaling needs a shared store (Redis,
etc.) — not implemented in v1. Vertical scaling is fine: 1000 sessions
caps at well under 100MB RAM for the documented limits.

## Behind a non-Caddy proxy

The critical config is "do not buffer SSE." For nginx, that means
`proxy_buffering off` + `proxy_cache off` on the `/api/sessions/:id/feedback`
location. For Cloudflare, you may need a Pages/Workers route since the
default proxy buffers SSE on free tier.
