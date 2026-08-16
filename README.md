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
npm run db:migrate   # apply committed migrations
npm run db:seed      # load/update the matching demo records
npm run db:studio    # inspect data with Drizzle Studio
```

## Verify

```bash
npm run build
npm test
```
