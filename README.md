# Copper Shores

Copper Shores is a full-stack D&D campaign hub with notes, interactive maps,
player and character records, a party treasury, and a reusable content library.

## Run locally

```powershell
cd backend
npm install
npm start
```

Open <http://localhost:3000/>.

The application uses MySQL when the `DB_*` settings in `backend/.env` are
configured. Without them, it safely falls back to `backend/data/db.json`.
See [backend/README.md](backend/README.md) for database setup and migration
commands.

## Organization

- `frontend/` contains one folder per visible feature plus `shared/`.
- `backend/src/features/` contains matching API route and repository modules.
- `backend/src/shared/` contains database and HTTP infrastructure.
- `backend/database/migrations/` contains separate MySQL and PostgreSQL schemas.

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for the complete layout.

## Backups

Configure `ADMIN_WRITE_TOKEN`, restart the server, and open `/admin/` to export
or restore all user-created data. See [backend/README.md](backend/README.md) for
the restore safety rules.
