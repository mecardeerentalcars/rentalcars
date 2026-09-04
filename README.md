# Mecardee Rental Manager

A mobile-first rental manager for a small rental car business in Kerala. It focuses on the daily workflow: vehicles, customers, rentals, returns, payments, expenses, reminders, and simple reporting.

## Current scope

- Responsive dashboard with active, returning, overdue, and payment summaries
- Vehicle, customer, rental history, payment, and accounts screens
- Interactive rental creation, extension, return, payment, and expense flows
- Automatic handover odometer and expected-return kilometer calculation
- Automatic extra-kilometer and fuel-shortage settlement
- Transactional return confirmation and vehicle availability updates
- Customer WhatsApp messages that are pre-filled but never sent automatically
- Global search, reminders, notifications, and mobile bottom navigation
- Realistic demo data for design review

The dashboard currently starts with realistic sample data for presentation. New rentals and final return settlements are persisted in Railway PostgreSQL through two small internal routes. Calculations run in the form; there is no payment gateway, direct money handling, WhatsApp API, or webhook integration.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Railway PostgreSQL

1. In Railway, add a PostgreSQL service to your project.
2. Copy `.dev.vars.example` to `.dev.vars` and replace `DATABASE_URL` with the database service's public connection URL for local development. Do not commit `.dev.vars`.
3. Create the tables and optionally load the sample records used by the dashboard:

```bash
npm run db:migrate
npm run db:seed
```

4. Start the app. The first saved rental or settlement will use the configured Railway connection.

For a web service deployed in the same Railway project, add a reference variable named `DATABASE_URL` that points to the PostgreSQL service's `DATABASE_URL`. For a Cloudflare/Vinext deployment, use Railway's public TCP-proxy URL as the `DATABASE_URL` secret. The code never exposes this value to the browser.

`railway.toml` tells Railway to build the app, apply migrations as a pre-deploy step, start Vinext on Railway's assigned `PORT`, and use the home page for deployment health checks.

Database commands:

```bash
npm run db:generate  # generate a migration after schema edits
npm run db:migrate   # apply committed migrations with the production-safe runner
npm run db:seed      # load/update the matching demo records
npm run db:studio    # inspect data with Drizzle Studio
```

## Google Drive backup

Super Admin users can connect Google Drive from **Settings → Google Drive Backup**, run **Backup Now**, view recent backup results, or disconnect. Backups are portable ZIP files stored in an app-created `Mecardee Backups` folder; the newest 30 app-managed files are retained.

Enable the Google Drive API in Google Cloud, configure the OAuth consent screen, and create a **Web application** OAuth client. Add this exact production redirect URI:

```text
https://YOUR-APP-DOMAIN/api/settings/backup/google/callback
```

For **Connect Google Drive**, set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `GOOGLE_TOKEN_ENCRYPTION_KEY` in the Railway web service. `GOOGLE_REDIRECT_URI` must exactly match the Google Cloud redirect URI. Use a securely generated 32-byte base64/hex token encryption key. Never expose these values to browser code or commit them. The remaining variables in `.dev.vars.example` are for scheduled backups.

`GOOGLE_DRIVE_BACKUP_ENABLED` is optional and defaults to enabled. Once the Google client ID, client secret, redirect URI, and token encryption key are configured, **Connect Google Drive** opens Google authorization, saves the connection, and returns to Settings. Missing setup is reported in Settings; the Connect button is not disabled by a missing flag.

For automatic backups on Railway, create a second service from this same repository with these service settings:

- Dockerfile path: `Dockerfile.backup` (Railway builds this image directly).
- Start command: `node run-daily-backup.mjs`.
- Cron schedule: `30 13 * * *` (7:00 PM Asia/Kolkata).
- Restart policy: **Never**; leave the healthcheck and pre-deploy command empty.
- Watch paths: `/scripts/run-daily-backup.mjs` and `/Dockerfile.backup`.

New Railway services use service settings or Infrastructure as Code. Do not attach the web service's legacy `/railway.toml`: it starts a persistent web server instead of a one-off backup job. The backup image only contains the small HTTP runner and needs no application dependencies.

Give the backup service `MECARDEE_APP_URL` (the deployed web app's HTTPS URL) and `BACKUP_CRON_SECRET`. Set the same strong secret on the web service, preferably using a Railway variable reference from the backup service to the web service's secret. Deploy the web service after adding the secret, then deploy/run the backup service once and check Settings → Google Drive Backup for a successful **Scheduled** upload. The cron service exits after each run as Railway requires; it needs no healthcheck or public domain. The Settings schedule label alone does not configure a Railway cron service.

## Verify

```bash
npm run build
npm test
```
