# Deployment

## Runtime pieces

- Next.js app service
- PostgreSQL database
- `zallet` collector reachable from the app
- private `signal-cli-rest-api` reachable only over Tailscale or an internal network
- Resend account for legacy invite fallback and receipt email

## Minimum environment

```bash
DATABASE_URL=
ZCAP_SESSION_SECRET=
ZCAP_INTERNAL_SECRET=
ZCASH_NETWORK=testnet
ZALLET_RPC_URL=
ZALLET_FROM_ADDRESS=
ZALLET_RPC_USER=
ZALLET_RPC_PASSWORD=
POLL_COLLECTOR_ACCOUNT_UUID=
SIGNAL_API_URL=
SIGNAL_SENDER=
SIGNAL_API_TOKEN=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
APP_BASE_URL=
```

## Railway notes

- use `npm run db:push` as the pre-deploy command
- do not auto-run `db:seed` on every deploy
- create the initial admin explicitly with `SEED_ADMIN_PASSWORD`
- keep the collector credentials outside the public repo
- keep the Signal REST API private; do not expose it on the public internet

## Production reminder

This public repository must never include:
- local `.env` files
- Railway credentials
- collector RPC secrets
- Signal REST API URLs or gateway tokens
- email service secrets
- real production user data
