# 🚀 Quick Start Guide

## Installation & Running (30 seconds)

### Terminal 1: Backend
```bash
cd backend
npm install
npm start
```
You'll see: `🐉 Copper Shores server is running on http://localhost:3000`

### Terminal 2: Frontend
```bash
cd frontend
python -m http.server 8000
```
Or on Windows: `python -m http.server 8000`

### Browser
Open: **http://localhost:8000**

## That's it! 🎉

You should see:
- ✅ "The Copper Shores" home page
- ✅ Navigation bar with tabs
- ✅ "Backend Connected" message (proving frontend talks to backend)
- ✅ Placeholder pages for each section

## Next Steps

1. **Read DEVELOPMENT_NOTES.md** for where to add real features
2. **Choose a feature** (Gold Spending, Map, Players, or Notes)
3. **Modify the backend** in `backend/server.js` to add real data
4. **Update the frontend** in `frontend/` to display that data
5. **Add a database** when you're ready (SQLite starter guide in DEVELOPMENT_NOTES.md)

## Common Issues

| Problem | Solution |
|---------|----------|
| "Cannot connect to backend" | Make sure `npm start` is running in the backend folder |
| Styles look broken | Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (macOS) |
| Port already in use | Use a different port: `python -m http.server 9000` |
| npm install fails | Make sure Node.js is installed: https://nodejs.org |

## Files You'll Edit

**For adding features:**
- `backend/server.js` - Add API endpoints and logic
- `frontend/index.html` - Home page layout
- `frontend/styles.css` - Styling
- `frontend/script.js` - JavaScript to fetch and display data
- `frontend/gold.html`, `map.html`, `players.html`, `notes.html` - Individual pages

**Don't edit yet:**
- `frontend/index.html` top navigation - it's already connected
- `backend/package.json` - only if adding new packages

Happy building! 🐉
