# Copper Shores Backend

The backend is organized by feature. Each feature owns its HTTP routes and
repository boundary under `src/features/`. Shared HTTP and database
infrastructure lives under `src/shared/`.

## Storage modes

Storage is selected from environment variables:

1. MySQL when `DB_HOST`, `DB_USER`, and `DB_NAME` are set.
2. PostgreSQL when `DATABASE_URL` is set and MySQL is not configured.
3. `data/db.json` as the zero-configuration fallback.

Copy `.env.example` to `.env`, fill in the MySQL password locally, and never
commit `.env`.

```powershell
Copy-Item .env.example .env
npm run migrate
npm run seed
npm start
```

`npm run migrate` creates the feature tables. On an empty MySQL database,
startup automatically imports `data/db.json`. `npm run seed:force` explicitly
overwrites MySQL from the JSON file.

## Admin backups

Set `ADMIN_WRITE_TOKEN` to a long random secret and restart the server. Then
open `/admin/` and sign in with that token.

The admin portal can:

- Download all user-created data as one versioned, checksummed JSON file.
- Validate a backup without changing the database.
- Restore into an empty database.
- Replace existing data after requiring a current safety download and an
  explicit confirmation phrase.

Backups include players, characters, notes, map waypoints, treasury settings
and transactions, and Library entries. They exclude credentials, runtime
metadata, caches, and static assets. Backup files contain private campaign
content, so store them securely outside Render.

For a recovery test, create a disposable database, deploy the same application
version, open `/admin/`, validate the backup, and restore it there. Do not test
replacement against the production database first.

## Feature layout

```text
src/
├── features/
│   ├── library/
│   ├── maps/
│   ├── notes/
│   ├── players/
│   ├── system/
│   └── treasury/
└── shared/
    ├── database/
    └── http/
```
