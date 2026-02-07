/**
 * Copper Shores - Interactive Map
 * Frontend: Leaflet.js-based map viewer with persistent waypoints
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// Enable dev mode to print clicked coordinates for easy city marker placement
const DEV_MODE = true;

// Placeholder city marker coordinates (TODO: Update after finding exact positions on world map)
// These use Leaflet's coordinate system: [lat, lng] / [y, x]
const CITY_MARKERS = {
  world: [
    {
      name: 'Alsita',
      mapId: 'alsita',
      coords: [434, 728], // TODO: Update coordinates - click on world map with DEV_MODE=true to find exact position
      icon: '🏰'
    },
    {
      name: 'Tosatina',
      mapId: 'tosatina',
      coords: [487, 803], // TODO: Update coordinates
      icon: '🏰'
    },
    {
      name: 'Tormsicle',
      mapId: 'tormsicle',
      coords: [102, 783], // TODO: Update coordinates
      icon: '🏰'
    }
  ]
};

// ============================================================================
// STATE
// ============================================================================

let mapState = {
  currentMapId: 'world',
  currentMap: null,
  maps: [],
  mapInstance: null,
  waypoints: [],
  waypointMarkers: {},
  cityMarkers: {},
  addingWaypoint: false,
  pendingWaypointCoords: null,
  currentWaypointId: null,
  imageLayer: null
};

// Per-map overrides: allow specifying a preferred center and an offset to the fit zoom
// center: [y, x] (optional) -- use image pixel coords
// fitZoomDelta: number (optional) -- added to computed fit zoom (usually 0 to show full map)
const PER_MAP_OVERRIDES = {
  // Example: Alsita shows full map by default (fitZoomDelta: 0)
  alsita: { center: null, fitZoomDelta: 0 },
  tosatina: { center: null, fitZoomDelta: 0 },
  tormsicle: { center: null, fitZoomDelta: 0 }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', initializeMap);

async function initializeMap() {
  try {
    console.log('Starting map initialization...');
    // Load maps list from backend
    console.log('Fetching /api/maps...');
    const response = await fetch('/api/maps');
    console.log('Response received:', response.status, response.statusText);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    const mapList = await response.json();
    console.log('Maps loaded:', mapList);
    mapState.maps = mapList.data.maps;

    // Initialize Leaflet map with CRS.Simple (for image-based maps)
    mapState.mapInstance = L.map('map', {
      crs: L.CRS.Simple,
      attributionControl: false
    });

    // Load initial map (world)
    await loadMap('world');

    // Setup event listeners
    setupEventListeners();
  } catch (err) {
    console.error('Failed to initialize map:', err);
    alert('Failed to load map. Check console for errors.');
  }
}

// ============================================================================
// MAP LOADING AND SWITCHING
// ============================================================================

async function loadMap(mapId) {
  try {
    mapState.currentMapId = mapId;
    mapState.currentMap = mapState.maps.find(m => m.id === mapId);

    if (!mapState.currentMap) {
      throw new Error(`Map ${mapId} not found`);
    }

    // Update UI
    document.getElementById('current-map-name').textContent = mapState.currentMap.name;
    
    // Show/hide "Back to World" button
    const backContainer = document.getElementById('back-to-world-container');
    if (mapId === 'world') {
      backContainer.style.display = 'none';
    } else {
      backContainer.style.display = 'flex';
    }

    // Clear existing image layer
    if (mapState.imageLayer) {
      mapState.mapInstance.removeLayer(mapState.imageLayer);
    }

    // Clear existing markers
    Object.values(mapState.waypointMarkers).forEach(marker => {
      mapState.mapInstance.removeLayer(marker);
    });
    mapState.waypointMarkers = {};

    Object.values(mapState.cityMarkers).forEach(marker => {
      mapState.mapInstance.removeLayer(marker);
    });
    mapState.cityMarkers = {};

    // Load the map image
    await loadMapImage(mapId);

    // Load waypoints for this map
    await loadWaypoints(mapId);

    // If world map, add city markers
    if (mapId === 'world') {
      addCityMarkers();
    }

    console.log(`Loaded map: ${mapState.currentMap.name}`);
  } catch (err) {
    console.error('Error loading map:', err);
    alert(`Failed to load map: ${err.message}`);
  }
}

function loadMapImage(mapId) {
  return new Promise((resolve, reject) => {
    const mapDef = mapState.maps.find(m => m.id === mapId);
    if (!mapDef) return reject(new Error('Map definition not found'));

    const img = new Image();
    img.onload = function() {
      // Create bounds based on image dimensions
      const width = img.width;
      const height = img.height;
      const bounds = [[0, 0], [height, width]];

      // Create image layer and add to map
      mapState.imageLayer = L.imageOverlay(mapDef.imagePath, bounds).addTo(mapState.mapInstance);

      // Ensure Leaflet knows the container size
      mapState.mapInstance.invalidateSize(true); // force immediate resize
      
      // Wait for layout to settle, then fit the image to the view
      setTimeout(() => {
        console.log(`MAP DEBUG: Image loaded - width=${width} height=${height}`);
        mapState.mapInstance.invalidateSize(true); // call again to ensure size is known
        
        // Get map container dimensions  
        const mapDiv = mapState.mapInstance.getContainer();
        const mapWidth = mapDiv.clientWidth;
        const mapHeight = mapDiv.clientHeight;
        console.log(`MAP DEBUG: Map container - width=${mapWidth} height=${mapHeight}`);

        // Create bounds and fit
        const boundsLL = L.latLngBounds(bounds);
        
        // Clear previous constraints before fitting
        mapState.mapInstance.setMinZoom(0);
        mapState.mapInstance.setMaxZoom(28);
        mapState.mapInstance.setMaxBounds(null);

        // Fit the image to the viewport - this shows the ENTIRE image
        mapState.mapInstance.fitBounds(boundsLL, { padding: [10, 10], animate: false });

        // Get the zoom level that was just set
        const fitZoom = mapState.mapInstance.getZoom();
        console.log(`MAP DEBUG: After fitBounds, zoom=${fitZoom}`);

        // Set constraints: min zoom is the fit zoom minus padding so user can slightly zoom out
        // but can't crop the image. Max zoom allows 6 levels of zoom-in for detail.
        const MIN_ZOOM = Math.max(-5, fitZoom - 2);  // Allow some zoom-out buffer
        const MAX_ZOOM = fitZoom + 6;

        mapState.mapInstance.setMinZoom(MIN_ZOOM);
        mapState.mapInstance.setMaxZoom(MAX_ZOOM);
        
        // Set max pan bounds to allow slight panning but not seeing blank areas
        mapState.mapInstance.setMaxBounds(boundsLL.pad(0.1));

        console.log(`MAP DEBUG: Set minZoom=${MIN_ZOOM}, maxZoom=${MAX_ZOOM}, current zoom=${mapState.mapInstance.getZoom()}`);
      }, 300);

      resolve();
    };
    img.onerror = () => reject(new Error('Failed to load map image'));
    img.src = mapDef.imagePath;
  });
}

async function loadWaypoints(mapId) {
  try {
    const response = await fetch(`/api/maps/${mapId}/waypoints`);
    const data = await response.json();
    
    if (data.status !== 'success') {
      throw new Error(data.message);
    }

    mapState.waypoints = data.data.waypoints || [];

    // Render waypoint markers
    mapState.waypoints.forEach(wp => {
      addWaypointMarker(wp);
    });
  } catch (err) {
    console.error('Error loading waypoints:', err);
  }
}

// ============================================================================
// WAYPOINT MANAGEMENT
// ============================================================================

function addWaypointMarker(waypoint) {
  const { id, x, y, title, note } = waypoint;

  // Create custom marker icon
  const markerIcon = L.divIcon({
    className: 'waypoint-marker',
    html: `<div class="marker-icon">📍</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });

  const marker = L.marker([y, x], { icon: markerIcon, draggable: true })
    .addTo(mapState.mapInstance)
    .on('click', () => showWaypointPopup(waypoint))
    .on('dragend', () => handleWaypointDrag(waypoint, marker));

  mapState.waypointMarkers[id] = marker;
}

function handleMapClick(e) {
  if (!mapState.addingWaypoint) return;

  mapState.pendingWaypointCoords = { x: Math.round(e.latlng.lng), y: Math.round(e.latlng.lat) };
  showWaypointEditor(mapState.pendingWaypointCoords);
}

function showWaypointEditor(coords) {
  const modal = document.getElementById('modal-waypoint');
  document.getElementById('waypoint-title').value = '';
  document.getElementById('waypoint-note').value = '';
  document.getElementById('waypoint-coords').textContent = `X: ${coords.x}, Y: ${coords.y}`;
  
  modal.style.display = 'flex';
  document.getElementById('waypoint-title').focus();
}

function showWaypointPopup(waypoint) {
  const modal = document.getElementById('modal-waypoint-view');
  document.getElementById('waypoint-view-title').textContent = waypoint.title || 'Waypoint';
  document.getElementById('waypoint-view-note').textContent = waypoint.note || '(No description)';
  document.getElementById('waypoint-view-coords').textContent = `X: ${waypoint.x}, Y: ${waypoint.y}`;
  
  mapState.currentWaypointId = waypoint.id;
  modal.style.display = 'flex';
}

async function saveWaypoint() {
  if (!mapState.pendingWaypointCoords) return;

  const title = document.getElementById('waypoint-title').value.trim();
  const note = document.getElementById('waypoint-note').value.trim();
  const { x, y } = mapState.pendingWaypointCoords;

  try {
    const response = await fetch(`/api/maps/${mapState.currentMapId}/waypoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y, title, note })
    });

    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.message);
    }

    // Add to local state
    const waypoint = data.data;
    mapState.waypoints.push(waypoint);
    addWaypointMarker(waypoint);

    // Close modal
    closeWaypointEditor();
    mapState.addingWaypoint = false;
    document.getElementById('btn-add-waypoint').textContent = 'Add Waypoint';

    console.log('Waypoint saved:', waypoint);
  } catch (err) {
    console.error('Error saving waypoint:', err);
    alert(`Failed to save waypoint: ${err.message}`);
  }
}

async function deleteWaypoint() {
  const waypointId = mapState.currentWaypointId;
  if (!waypointId) return;

  if (!confirm('Delete this waypoint?')) return;

  try {
    const response = await fetch(`/api/maps/${mapState.currentMapId}/waypoints/${waypointId}`, {
      method: 'DELETE'
    });

    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.message);
    }

    // Remove from local state
    mapState.waypoints = mapState.waypoints.filter(wp => wp.id !== waypointId);
    
    // Remove marker from map
    const marker = mapState.waypointMarkers[waypointId];
    if (marker) {
      mapState.mapInstance.removeLayer(marker);
      delete mapState.waypointMarkers[waypointId];
    }

    closeWaypointPopup();
    console.log('Waypoint deleted:', waypointId);
  } catch (err) {
    console.error('Error deleting waypoint:', err);
    alert(`Failed to delete waypoint: ${err.message}`);
  }
}

async function handleWaypointDrag(waypoint, marker) {
  const newPos = marker.getLatLng();
  waypoint.x = Math.round(newPos.lng);
  waypoint.y = Math.round(newPos.lat);

  try {
    const response = await fetch(`/api/maps/${mapState.currentMapId}/waypoints/${waypoint.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: waypoint.x, y: waypoint.y })
    });

    const data = await response.json();
    if (data.status !== 'success') {
      throw new Error(data.message);
    }

    console.log('Waypoint moved:', waypoint.id);
  } catch (err) {
    console.error('Error updating waypoint position:', err);
    alert(`Failed to update waypoint: ${err.message}`);
  }
}

// ============================================================================
// CITY MARKERS (World Map Only)
// ============================================================================

function addCityMarkers() {
  CITY_MARKERS.world.forEach(city => {
    const markerIcon = L.divIcon({
      className: 'city-marker',
      html: `<div class="marker-icon" style="font-size: 24px;">${city.icon}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });

    const marker = L.marker(city.coords, { icon: markerIcon })
      .addTo(mapState.mapInstance)
      .bindPopup(`<b>${city.name}</b><br><button class="btn btn-primary" onclick="switchToMap('${city.mapId}')" style="width: 100%; margin-top: 8px;">View ${city.name}</button>`, {
        closeButton: true,
        maxWidth: 200
      });

    mapState.cityMarkers[city.mapId] = marker;
  });
}

function switchToMap(mapId) {
  loadMap(mapId);
}

// ============================================================================
// DEV MODE: Print Click Coordinates
// ============================================================================

function handleDevModeClick(e) {
  if (DEV_MODE) {
    const coords = e.latlng;
    console.log(`DEV: Click coordinates - [${Math.round(coords.lat)}, ${Math.round(coords.lng)}] (Y, X)`);
    console.log(`Use these in CITY_MARKERS for city placement.`);
  }
}

// ============================================================================
// MODAL CONTROLS
// ============================================================================

function closeWaypointEditor() {
  document.getElementById('modal-waypoint').style.display = 'none';
  mapState.pendingWaypointCoords = null;
}

function closeWaypointPopup() {
  document.getElementById('modal-waypoint-view').style.display = 'none';
  mapState.currentWaypointId = null;
}

// ============================================================================
// EVENT LISTENERS SETUP
// ============================================================================

function setupEventListeners() {
  // Add Waypoint button
  document.getElementById('btn-add-waypoint').addEventListener('click', () => {
    mapState.addingWaypoint = !mapState.addingWaypoint;
    const btn = document.getElementById('btn-add-waypoint');
    btn.textContent = mapState.addingWaypoint ? '✓ Click Map to Add' : 'Add Waypoint';
    btn.style.backgroundColor = mapState.addingWaypoint ? '#f39c12' : '';
  });

  // Back to World button
  document.getElementById('btn-back-to-world').addEventListener('click', () => {
    loadMap('world');
  });

  // Map click events
  mapState.mapInstance.on('click', (e) => {
    handleMapClick(e);
    handleDevModeClick(e);
  });

  // Waypoint Editor Modal
  document.getElementById('modal-close-btn').addEventListener('click', closeWaypointEditor);
  document.getElementById('waypoint-cancel').addEventListener('click', closeWaypointEditor);
  document.getElementById('waypoint-save').addEventListener('click', saveWaypoint);

  // Allow Enter key to save waypoint
  document.getElementById('waypoint-form').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveWaypoint();
    }
  });

  // Waypoint View Modal
  document.getElementById('modal-view-close-btn').addEventListener('click', closeWaypointPopup);
  document.getElementById('waypoint-close-view').addEventListener('click', closeWaypointPopup);
  document.getElementById('waypoint-delete').addEventListener('click', deleteWaypoint);

  // Close modals when clicking outside
  document.getElementById('modal-waypoint').addEventListener('click', (e) => {
    if (e.target.id === 'modal-waypoint') closeWaypointEditor();
  });
  document.getElementById('modal-waypoint-view').addEventListener('click', (e) => {
    if (e.target.id === 'modal-waypoint-view') closeWaypointPopup();
  });

  console.log('Event listeners setup complete');
}

// ============================================================================
// UTILITY: Add custom styles for markers
// ============================================================================

(function() {
  const style = document.createElement('style');
  style.textContent = `
    .waypoint-marker .marker-icon {
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      cursor: grab;
    }
    .waypoint-marker .marker-icon:active {
      cursor: grabbing;
    }
    .city-marker .marker-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
      cursor: pointer;
      transition: transform 0.2s;
    }
    .city-marker:hover .marker-icon {
      transform: scale(1.2);
    }
  `;
  document.head.appendChild(style);
})();

console.log('Map script loaded. DEV_MODE:', DEV_MODE);
