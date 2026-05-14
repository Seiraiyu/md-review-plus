# md-review-plus relay

E2E-encrypted ephemeral relay for `md-review-plus --remote`. See
[../docs/plans/2026-05-14-remote-review-design.md](../docs/plans/2026-05-14-remote-review-design.md).

## Run locally

    bun install
    bun run dev

## Docker

    docker build -t mdrp-relay .
    docker run -p 8080:8080 mdrp-relay

## Env

| Var                        | Default  | Meaning                  |
| -------------------------- | -------- | ------------------------ |
| `MDRP_PORT`                | 8080     | Listen port              |
| `MDRP_TTL_MS`              | 86400000 | Session TTL (24h)        |
| `MDRP_MAX_SESSIONS`        | 1000     | Global cap               |
| `MDRP_RATE_LIMIT_PER_HOUR` | 30       | Per-IP create rate       |
| `MDRP_MAX_BODY_BYTES`      | 1048576  | Max upload size          |
| `MDRP_MAX_FEEDBACK_BYTES`  | 262144   | Max feedback size        |
| `MDRP_STATIC_ROOT`         | (none)   | Path to built SPA assets |
