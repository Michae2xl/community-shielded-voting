# Deployment

## Runtime pieces

- Next.js app service
- PostgreSQL database
- `zallet` collector reachable from the app
- Resend account for invite and receipt email

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
RESEND_API_KEY=
RESEND_FROM_EMAIL=
APP_BASE_URL=
```

## Railway notes

- use `npm run db:push` as the pre-deploy command
- do not auto-run `db:seed` on every deploy
- create the initial admin explicitly with `SEED_ADMIN_PASSWORD`
- keep the collector credentials outside the public repo

## Production reminder

This public repository must never include:
- local `.env` files
- Railway credentials
- collector RPC secrets
- email service secrets
- real production user data
