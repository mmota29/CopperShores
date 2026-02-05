# 📁 Project Structure Overview

```
CopperShores/
│
├── 📄 README.md                          # Main documentation with full setup instructions
├── 📄 QUICKSTART.md                      # Quick 30-second setup guide
├── 📄 DEVELOPMENT_NOTES.md               # Detailed guides for adding features
│
├── 🔧 backend/                           # Node.js + Express API server
│   ├── 📄 server.js                      # Main Express app with API endpoints
│   ├── 📄 package.json                   # Dependencies: express, cors
│   └── 📄 .gitignore                     # Ignore node_modules
│
└── 🌐 frontend/                          # HTML/CSS/JavaScript static site
    ├── 📄 index.html                     # Home page
    ├── 📄 gold.html                      # Gold Spending (placeholder)
    ├── 📄 map.html                       # Interactive Map (placeholder)
    ├── 📄 players.html                   # Players (placeholder)
    ├── 📄 notes.html                     # Campaign Notes (placeholder)
    ├── 📄 styles.css                     # Global styling (D&D themed)
    └── 📄 script.js                      # Frontend logic & API calls
```

## 📊 What Each File Does

### Backend
- **server.js** - Express server with 4 API endpoints that return JSON
- **package.json** - Lists dependencies (express.js, cors)
- **.gitignore** - Prevents node_modules from being committed

### Frontend - Core Files
- **index.html** - Main home page with navigation, hero section, API status, and quick links
- **styles.css** - Mobile-responsive D&D-themed styling (browns, golds, fantasy fonts)
- **script.js** - Fetches from `/api/gold`, updates navigation, handles page logic

### Frontend - Page Files
- **gold.html** - Placeholder "Coming Soon" page
- **map.html** - Placeholder "Coming Soon" page
- **players.html** - Placeholder "Coming Soon" page
- **notes.html** - Placeholder "Coming Soon" page

Each has the same navigation bar and footer for consistent branding.

## 🎯 Key Features Implemented

✅ Full-stack web app (backend + frontend)
✅ Express.js REST API with 4 endpoints
✅ CORS enabled for local development
✅ Frontend-backend connection demonstrated (fetch API)
✅ Responsive design (mobile + desktop)
✅ D&D-themed styling
✅ Navigation between pages
✅ Error handling
✅ npm scripts for easy startup
✅ Full documentation

## 🚦 How It Works

```
User Opens Browser
    ↓
Loads index.html from http://localhost:8000
    ↓
Page Loads (styles.css + script.js)
    ↓
script.js makes fetch() request
    ↓
Fetches http://localhost:3000/api/gold
    ↓
Backend responds with JSON
    ↓
Frontend displays: "✓ Backend Connected"
    ↓
User can click navigation tabs to visit other pages
```

## 🎓 Learning Outcomes

After building this, you'll understand:
- How to create an Express.js server
- How to write REST API endpoints
- How to enable CORS
- How to fetch data from backend using JavaScript
- How to structure a full-stack project
- Responsive CSS Grid layouts
- npm and package management
- Client-server communication

ready to add features:
- Databases (SQLite, MongoDB, PostgreSQL)
- Authentication (JWT)
- User management
- Rich forms and validation
- Image/file uploads
- Real-time updates (WebSockets)
- Deployment to production

Enjoy building! 🐉⚔️
