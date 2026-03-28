# VPS Deployment with Caddy

This guide deploys the production stack from `docker-compose.prod.yml`.

## 1) Provision Host

- Ubuntu 22.04+ (or similar)
- Open ports 80 and 443
- Install Docker Engine and Docker Compose plugin

## 2) Clone and Configure

```bash
git clone <your-repo-url> visualizer
cd visualizer
cp .env.example .env
```

Edit `.env` values for production:

- `APP_DOMAIN` to your domain (example: `viz.example.com`)
- `CADDY_EMAIL` to your email
- backend connection variables if needed

## 3) Launch Stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

## 4) Verify

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f caddy
```

Open `https://<APP_DOMAIN>` in your browser.

## 5) Operational Commands

Restart:

```bash
docker compose -f docker-compose.prod.yml restart
```

Pull/rebuild and rollout:

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Stop:

```bash
docker compose -f docker-compose.prod.yml down
```

## Notes

- Caddy automatically handles TLS certificates for public domains.
- WebSocket traffic is proxied through Caddy at `/ws/*`.
- For local production testing, `APP_DOMAIN=localhost` works without public DNS.
