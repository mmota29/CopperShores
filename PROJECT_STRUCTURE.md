# Copper Shores project structure

Copper Shores uses feature-first organization. Frontend and backend features
have matching names so related code is easy to find.

```text
CopperShores/
├── frontend/
│   ├── home/
│   │   └── index.html
│   ├── library/
│   │   ├── index.html
│   │   └── library.js
│   ├── maps/
│   │   ├── assets/
│   │   ├── index.html
│   │   ├── maps.css
│   │   └── maps.js
│   ├── notes/
│   │   ├── index.html
│   │   ├── category.html
│   │   └── detail.html
│   ├── players/
│   │   ├── index.html
│   │   └── detail.html
│   ├── treasury/
│   │   ├── index.html
│   │   ├── treasury.css
│   │   └── treasury.js
│   ├── shared/
│   │   ├── assets/
│   │   ├── scripts/
│   │   └── styles/
│   └── sw.js
│
├── backend/
│   ├── src/
│   │   ├── features/
│   │   │   ├── library/
│   │   │   ├── maps/
│   │   │   ├── notes/
│   │   │   ├── players/
│   │   │   ├── system/
│   │   │   └── treasury/
│   │   ├── shared/
│   │   │   ├── database/
│   │   │   └── http/
│   │   ├── app.js
│   │   └── server.js
│   ├── database/
│   │   └── migrations/
│   │       ├── mysql/
│   │       └── postgres/
│   ├── data/
│   ├── scripts/
│   ├── tests/
│   └── package.json
│
├── README.md
├── START.ps1
└── START.bat
```

## Ownership rules

1. Feature-specific UI, routes, and repositories stay in that feature folder.
2. Code belongs in `shared/` only when at least two features use it.
3. Frontend code calls the API; it never connects directly to MySQL.
4. Route modules handle HTTP. Repository modules own persistence access.
5. Database credentials stay in `backend/.env`, which is ignored by Git.

## URLs

Canonical pages use folder URLs:

- `/`
- `/treasury/`
- `/maps/`
- `/players/`
- `/notes/`
- `/library/`

The server redirects the former `.html` URLs to their canonical replacements.
