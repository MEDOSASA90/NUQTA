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

## Automated backups

The `database-backup.yml` workflow creates a daily compressed TiDB/MySQL dump
and stores it as a private GitHub Actions artifact for 90 days. Add these
repository secrets before enabling it: `NUQTA_DB_HOST`, `NUQTA_DB_PORT`,
`NUQTA_DB_USER`, `NUQTA_DB_PASSWORD`, and `NUQTA_DB_NAME`.

To restore a backup, download the artifact, decompress it, inspect the target
database, and run `mysql --ssl-mode=REQUIRED` against the selected database.
Restoration must be reviewed before execution because it changes live data.

## Verification

```bash
npm run check
npm run lint
npm test -- --run
npm run build
```
