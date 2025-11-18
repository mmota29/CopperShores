// === Copper Shores – core data & helpers (backend for the homepage) ===

// Key in localStorage so we can extend later without clobbering old stuff
const STORAGE_KEY = "coppershores.home.v1";

// ---- Initial state (what the app knows on first load) ----
const initialState = {
  campaignName: "Copper Shores",

  partyMembers: [
    { character: "Gill",    player: "Michael" },
    { character: "Corelia", player: "Gabi"    },
    { character: "Rhaekar", player: "Tyler"   },
    { character: "Blue",    player: "Mia"     },
    { character: "Riven",   player: "Shawn"   }
  ],

  dungeonMaster: {
    name: "George"
  },

  // Simple snapshot for the homepage only.
  // We can expand this into a full money system later.
  money: {
    partyGP: 0,
    shipGP: 0
  },

  // Navigation buttons to show on the homepage.
  // "route" will matter later when we add multiple pages.
  navigation: [
    { label: "Roster",     route: "roster"     },
    { label: "Money",      route: "money"      },
    { label: "Ship",       route: "ship"       },
    { label: "Quests",     route: "quests"     },
    { label: "Loot",       route: "loot"       },
    { label: "Notes",      route: "notes"      },
    { label: "Initiative", route: "initiative" }
  ]
};

// ---- Load / save helpers ----

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(initialState);

    const parsed = JSON.parse(raw);

    // Merge with initial, so if we add fields later they get defaults
    return {
      ...structuredClone(initialState),
      ...parsed,
      money: { ...initialState.money, ...(parsed.money || {}) },
      dungeonMaster: { ...initialState.dungeonMaster, ...(parsed.dungeonMaster || {}) },
      partyMembers: parsed.partyMembers || structuredClone(initialState.partyMembers),
      navigation: parsed.navigation || structuredClone(initialState.navigation)
    };
  } catch (err) {
    console.error("Failed to load Copper Shores state:", err);
    return structuredClone(initialState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// This is the single live state object your app will use.
let state = loadState();

// ---- Read-only getters (for the homepage UI to use later) ----

function getCampaignName() {
  return state.campaignName;
}

function getPartyMembers() {
  // Return a copy so outside code can't accidentally mutate state directly
  return state.partyMembers.map(m => ({ ...m }));
}

function getDungeonMaster() {
  return { ...state.dungeonMaster };
}

function getMoneySnapshot() {
  return { ...state.money };
}

function getNavigationButtons() {
  return state.navigation.map(n => ({ ...n }));
}

// ---- Simple update helpers (for when we add forms later) ----

function setPartyGold(gp) {
  const value = Number(gp);
  if (Number.isNaN(value) || value < 0) return;
  state.money.partyGP = value;
  saveState();
}

function setShipGold(gp) {
  const value = Number(gp);
  if (Number.isNaN(value) || value < 0) return;
  state.money.shipGP = value;
  saveState();
}

function setDungeonMasterName(name) {
  if (!name || !name.trim()) return;
  state.dungeonMaster.name = name.trim();
  saveState();
}

function addPartyMember(character, player) {
  if (!character || !character.trim()) return;
  if (!player || !player.trim()) return;

  state.partyMembers.push({
    character: character.trim(),
    player: player.trim()
  });

  saveState();
}

function removePartyMember(character) {
  state.partyMembers = state.partyMembers.filter(
    m => m.character.toLowerCase() !== String(character).toLowerCase()
  );
  saveState();
}

// Optional reset function for debugging or a "factory reset" button later
function resetCopperShoresState() {
  state = structuredClone(initialState);
  saveState();
}

// If you want to debug in the console later:
window.copperShoresBackend = {
  getCampaignName,
  getPartyMembers,
  getDungeonMaster,
  getMoneySnapshot,
  getNavigationButtons,
  setPartyGold,
  setShipGold,
  setDungeonMasterName,
  addPartyMember,
  removePartyMember,
  resetCopperShoresState
};

