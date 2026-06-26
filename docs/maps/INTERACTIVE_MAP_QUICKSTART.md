# Quick Start - Interactive Map Feature

## Prerequisites
- Node.js (v14+) installed
- npm available in PATH

## Installation & Running

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Start the Backend Server
```bash
npm start
```
or
```bash
node server.js
```

You should see:
```
🐉 Copper Shores server is running on http://localhost:3000
📡 API endpoints available at http://localhost:3000/api
```

### 3. Access the Application
Open your browser and navigate to:
```
http://localhost:3000/map.html
```

## What You Should See

1. **Navigation bar** at the top with "Interactive Map" link
2. **Control panel** with:
   - "Add Waypoint" button
   - Current map name (initially "World Map")
3. **Interactive Map** showing the world map
4. **City markers** (castles 🏰) on the world map for Alsita, Tosatina, and Tormsicle

## Quick Test: Add a Waypoint

1. Click **"Add Waypoint"** button
2. The button text changes to **"✓ Click Map to Add"**
3. Click anywhere on the map
4. Fill in the optional title and note
5. Click **"Save Waypoint"**
6. A marker (📍) appears on the map
7. **Refresh the page** - the waypoint should still be there (persistence test!)

## Quick Test: Switch Maps

1. Click on a city marker (🏰) on the world map
2. The map changes to show that city region
3. A **"Back to World"** button appears in the top right
4. You can add waypoints to this map too
5. Click **"Back to World"** to return

## Verify Everything Works

- [ ] Server starts without errors
- [ ] Map page loads (you see the world map image)
- [ ] City markers are clickable
- [ ] Can add waypoints
- [ ] Waypoints persist after page refresh
- [ ] Can switch between maps
- [ ] Can see "Back to World" button on city maps

## Troubleshooting

**Port 3000 already in use?**
- Windows: `netstat -ano | findstr :3000` to find process
- Kill the process and restart

**Map image not showing?**
- Check browser console (F12 > Console tab)
- Look for 404 errors on `/allmaps/` files
- Verify files exist in `allmaps/` directory

**Waypoints not saving?**
- Check `/backend/data/db.json` exists
- Look for API errors in browser console
- Verify backend is running with `http://localhost:3000/api/maps`

## Next Steps

1. **Update city marker coordinates** (see MAP_FEATURE_GUIDE.md for instructions)
2. **Customize map appearance** in `frontend/map.css`
3. **Add more features** (listed in MAP_FEATURE_GUIDE.md)

## Full Documentation

See `MAP_FEATURE_GUIDE.md` for:
- Complete API reference
- Architecture details
- Data model
- Advanced usage
- Development mode instructions
