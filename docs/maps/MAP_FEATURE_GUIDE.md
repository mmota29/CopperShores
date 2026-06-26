# Interactive Map Feature - Implementation Guide

## Overview

The Interactive Map feature allows players to:
- View and pan/zoom within the world map
- Click on city markers to switch between different region maps
- Add custom waypoints to mark locations on any map
- Save and persist waypoints across sessions
- Edit and delete waypoints
- Drag waypoints to reposition them

## Architecture

### Backend (Node.js/Express)

**New Database Functions** (`backend/db.js`):
- `getMapsDefinition()` - Returns list of all available maps
- `listWaypoints(mapId)` - Get all waypoints for a map
- `createWaypoint(mapId, {x, y, title, note})` - Create a new waypoint
- `updateWaypoint(mapId, id, patch)` - Update waypoint position/info
- `deleteWaypoint(mapId, id)` - Delete a waypoint

**Static File Serving** (`backend/server.js`):
- `/` - Serves files from `/frontend`
- `/allmaps` - Serves map image files from `/allmaps`

**API Endpoints** (`backend/server.js`):
- `GET /api/maps` - List all maps with metadata
- `GET /api/maps/:mapId/waypoints` - Get waypoints for a map
- `POST /api/maps/:mapId/waypoints` - Create a waypoint
- `PUT /api/maps/:mapId/waypoints/:id` - Update a waypoint
- `DELETE /api/maps/:mapId/waypoints/:id` - Delete a waypoint

**Data Persistence** (`backend/data/db.json`):
```json
{
  "mapWaypoints": {
    "world": [...],
    "alsita": [...],
    "tosatina": [...],
    "tormsicle": [...]
  }
}
```

### Frontend (HTML/CSS/JavaScript)

**Files**:
- `frontend/map.html` - Interactive map page with Leaflet.js
- `frontend/map.css` - Styling for the map interface
- `frontend/map.js` - Map logic, waypoint management
- Uses Leaflet.js (loaded from CDN) for map rendering and interaction

**Key Classes & IDs**:
- `#map` - Leaflet map container
- `#btn-add-waypoint` - Toggle waypoint creation mode
- `#btn-back-to-world` - Return to world map from city map
- `#modal-waypoint` - Waypoint creation/editing modal
- `#modal-waypoint-view` - Waypoint details popup

## Map Definition

### Available Maps

The following maps are defined (in `backend/db.js`):

1. **World Map** (default)
   - ID: `world`
   - Image: `/allmaps/coppershores.png`
   - Contains clickable city markers

2. **Alsita**
   - ID: `alsita`
   - Image: `/allmaps/Alsita.PNG`

3. **Tosatina**
   - ID: `tosatina`
   - Image: `/allmaps/Tosatina.PNG`

4. **Tormsicle**
   - ID: `tormsicle`
   - Image: `/allmaps/Tormsicle.png`

### City Marker Coordinates

City markers on the world map are defined in `frontend/map.js` in the `CITY_MARKERS` object:

```javascript
const CITY_MARKERS = {
  world: [
    { name: 'Alsita', mapId: 'alsita', coords: [250, 300], icon: '🏰' },
    { name: 'Tosatina', mapId: 'tosatina', coords: [400, 450], icon: '🏰' },
    { name: 'Tormsicle', mapId: 'tormsicle', coords: [150, 550], icon: '🏰' }
  ]
};
```

**TODO: Update Coordinates**

The coordinates above are placeholders and should be updated with the actual positions on the world map. To find the correct coordinates:

1. Set `DEV_MODE = true` in `frontend/map.js`
2. Open the map in a browser
3. Click on the world map where each city should be
4. Check the browser console for logged coordinates
5. Update the `CITY_MARKERS.world` array with the correct coordinates
6. Set `DEV_MODE = false` when done

Coordinate system: `[Y, X]` (Leaflet's lat/lng format for image overlay)

## Waypoint Data Model

Each waypoint stored in the database has the following structure:

```javascript
{
  id: "wp_mlbk5sq5-2p63vi",              // Unique ID (auto-generated)
  mapId: "world",                         // Map ID (world|alsita|tosatina|tormsicle)
  x: 150,                                 // X coordinate in map pixels
  y: 200,                                 // Y coordinate in map pixels
  title: "Hidden Treasure",               // Optional title
  note: "Located near the old ruins",    // Optional description
  createdAt: "2026-02-07T12:34:56.123Z", // Timestamp
  updatedAt: "2026-02-07T12:34:56.123Z"  // Last modified timestamp
}
```

## How to Use

### Starting the Application

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   # Or: node server.js
   ```

   The server will start on `http://localhost:3000`

4. **Open in browser**:
   - Navigate to `http://localhost:3000/map.html`
   - The world map should load with city markers

### Using the Map

#### Viewing the Map
1. Pan (drag) - Click and drag to move around the map
2. Zoom - Use mouse wheel or trackpad pinch to zoom in/out
3. Click city markers on the world map to switch to that region

#### Adding Waypoints
1. Click the **"Add Waypoint"** button at the top
2. The button will change to show **"✓ Click Map to Add"**
3. Click on the map where you want to place the waypoint
4. A modal will appear asking for:
   - **Title** (optional): Name of the location
   - **Note** (optional): Description of the location
5. Click **"Save Waypoint"** to create the marker
6. The waypoint will appear on the map as a 📍 marker

#### Editing/Viewing Waypoints
1. Click on a waypoint marker (📍) to view its details
2. You can:
   - **Delete** the waypoint (with confirmation)
   - **Close** to return to map

#### Repositioning Waypoints
1. Click on a waypoint marker and hold
2. Drag it to a new location
3. Release to save the new position
4. The backend will automatically save the update

#### Switching Maps
- **From World Map**: Click a city marker and select the region, OR use the "View [City Name]" button
- **From City Map**: Click the **"Back to World"** button in the top right

### Testing Persistence

To verify that waypoints persist across sessions:

1. Add a waypoint on the world map (e.g., "Test Marker")
2. Refresh the page (F5 or Ctrl+R)
3. The waypoint should still be visible on the map
4. The data is stored in `/backend/data/db.json`

## API Reference

### GET /api/maps
Returns a list of all available maps.

**Response**:
```json
{
  "status": "success",
  "data": {
    "maps": [
      { "id": "world", "name": "World Map", "imagePath": "/allmaps/coppershores.png" },
      { "id": "alsita", "name": "Alsita", "imagePath": "/allmaps/Alsita.PNG" },
      ...
    ]
  }
}
```

### GET /api/maps/:mapId/waypoints
Get all waypoints for a specific map.

**Parameters**:
- `mapId` - One of: `world`, `alsita`, `tosatina`, `tormsicle`

**Response**:
```json
{
  "status": "success",
  "data": {
    "waypoints": [
      { "id": "wp_...", "mapId": "world", "x": 100, "y": 150, "title": "...", "note": "...", ... }
    ]
  }
}
```

### POST /api/maps/:mapId/waypoints
Create a new waypoint on a map.

**Request Body**:
```json
{
  "x": 100,
  "y": 150,
  "title": "Optional Title",
  "note": "Optional description"
}
```

**Response**: Returns the created waypoint object with ID and timestamps.

### PUT /api/maps/:mapId/waypoints/:id
Update a waypoint (position, title, or note).

**Request Body**:
```json
{
  "x": 120,
  "y": 170,
  "title": "Updated Title",
  "note": "Updated Note"
}
```

**Response**: Returns the updated waypoint object.

### DELETE /api/maps/:mapId/waypoints/:id
Delete a waypoint.

**Response**:
```json
{
  "status": "success",
  "message": "Waypoint deleted"
}
```

## Development Mode

Enable developer mode in `frontend/map.js` to print clicked coordinates:

```javascript
const DEV_MODE = true;
```

When enabled:
- Each click on the map logs coordinates to the browser console
- Useful for finding exact city marker positions
- Coordinates are in `[Y, X]` format (Leaflet lat/lng)

## Browser Compatibility

- **Modern browsers** (Chrome, Firefox, Edge, Safari)
- Requires JavaScript enabled
- Leaflet.js handles map rendering and interactions

## Troubleshooting

### Map image not loading
- Verify that map files exist in `/backend/../allmaps/`
- Check browser console (F12) for 404 errors
- Ensure the server is serving static files correctly

### Waypoints not persisting
- Check that `/backend/data/db.json` exists and has `mapWaypoints` structure
- Check browser console for API errors
- Verify the backend is running and accessible at `http://localhost:3000/api/maps/world/waypoints`

### City markers not appearing
- Open browser console and check for JavaScript errors
- Verify `DEV_MODE` is working (click map and check console)
- Confirm `CITY_MARKERS` coordinates are within map bounds

### Port 3000 already in use
- Find and kill the process using port 3000:
  ```bash
  netstat -ano | findstr :3000  # Windows
  lsof -i :3000                 # macOS/Linux
  ```
- Or change the PORT in `backend/server.js`

## Future Enhancements

- [ ] Edit waypoint details (title/note) from the popup
- [ ] Waypoint categories/colors
- [ ] Draw route between waypoints
- [ ] Import/export waypoints
- [ ] Measured distance tool
- [ ] Fog of war / map discovery system
- [ ] Multi-user shared markers

## Code Locations

- **Backend**: `/backend/server.js`, `/backend/db.js`
- **Frontend**: `/frontend/map.html`, `/frontend/map.css`, `/frontend/map.js`
- **Data**: `/backend/data/db.json`
- **Maps**: `/allmaps/`

## Version

Interactive Map Feature v1.0.0
Copper Shores Project - 2026
