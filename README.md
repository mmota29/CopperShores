# CopperShores

CopperShores is a D&D campaign hub with:
- `frontend/`: static HTML/CSS/JS site
- `backend/`: Express API

## Backend Postgres Setup

The backend now uses Postgres via `DATABASE_URL`.

1. Copy `backend/.env.example` to `backend/.env`
2. Set `DATABASE_URL` to your local Postgres or Render Postgres URL
3. Initialize schema:

```bash
cd backend
npm run db:init
```

4. (Optional) Migrate existing `backend/data/db.json` data one time:

```bash
npm run db:migrate
```

5. Start backend:

```bash
npm run dev
```
