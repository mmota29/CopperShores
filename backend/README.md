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
