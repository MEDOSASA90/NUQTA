# NUQTA deployment

## Local Docker

```bash
docker compose up --build
```

The application is available at `http://localhost:3000`. For a fresh local
database, run migrations and the development seed from a second terminal:

```bash
npm run db:migrate
npm run db:seed
```

## Production requirements

Set `DATABASE_URL`, `APP_SECRET`, `APP_ID`, `OWNER_UNION_ID`, `NODE_ENV` and
`CRON_SECRET` in the hosting provider. WhatsApp delivery additionally requires
`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, and a verified webhook configuration.

Never commit `.env` or provider credentials. Rotate any credential that has
been exposed in a chat, terminal capture, or screenshot.

## Verification

```bash
npm run check
npm run lint
npm test -- --run
npm run build
```
