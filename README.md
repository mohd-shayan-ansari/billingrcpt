# Billing Lottery

Thermal receipt generator with role-based access for one Master Admin and multiple Counter Admins.

## Features

- JWT login with secure httpOnly cookie sessions
- Master Admin management for counter admins
- Central rate editing for Andar, Bahar, and Result
- Receipt creation with selected codes, editable heading, and live thermal preview
- Print-optimized 2-inch layout and PDF download
- Receipt history filtered by role

## Local Setup

1. Install dependencies.
2. Ensure `.env` exists. It already includes a local SQLite database path and JWT secret.
3. Run `npm run prisma:generate`.
4. Run `npm run db:push` to create the SQLite database.
5. Run `npm run db:seed` to create the master admin and default rates.
6. Start the app with `npm run dev`.

## Default Master Admin

- Username: `admin@billing.local`
- Password: `Admin@1234`

## Notes

- The app currently uses SQLite for a self-contained deployment path. Switching to PostgreSQL only requires changing `DATABASE_URL` and the Prisma datasource provider.
- The print output is optimized for a 58mm thermal receipt width.
