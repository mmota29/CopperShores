const crypto = require('crypto');

const BACKUP_FORMAT = 'copper-shores-backup';
const BACKUP_FORMAT_VERSION = 1;
const APPLICATION_VERSION = '0.2.0';
const MAX_ID_LENGTH = 191;
const MAX_BACKUP_RECORDS = 100000;

const NOTE_CATEGORIES = new Set([
  'pc',
  'npc',
  'event',
  'enemy',
  'location',
  'item',
  'session',
  'gillcorner'
]);

const MAP_IDS = new Set([
  'world',
  'alsita',
  'tosatina',
  'tormsicle',
  'pinchester',
  'neucroft'
]);

const CONTENT_TYPES = new Set([
  'monster',
  'npc',
  'item',
  'note',
  'spell',
  'location',
  'quest',
  'lore',
  'other'
]);

const ALLOCATION_MODES = new Set([
  'direct',
  'equal_split',
  'custom_split',
  'percentage_split'
]);

class BackupValidationError extends Error {
  constructor(errors) {
    super('Backup validation failed.');
    this.name = 'BackupValidationError';
    this.errors = Array.isArray(errors) ? errors : [String(errors)];
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map(key => (
      `${JSON.stringify(key)}:${stableStringify(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value);
}

function checksumData(data) {
  return crypto.createHash('sha256').update(stableStringify(data)).digest('hex');
}

function countState(state) {
  const players = Array.isArray(state.players) ? state.players : [];
  const notesRoot = isPlainObject(state.notes) ? state.notes : {};
  const mapsRoot = isPlainObject(state.mapWaypoints) ? state.mapWaypoints : {};
  const gold = isPlainObject(state.gold) ? state.gold : {};

  return {
    players: players.length,
    characters: players.reduce((sum, player) => {
      const ids = new Set((Array.isArray(player.characters) ? player.characters : [])
        .map(character => character && character.id)
        .filter(Boolean));
      if (player.currentCharacter && player.currentCharacter.id) {
        ids.add(player.currentCharacter.id);
      }
      return sum + ids.size;
    }, 0),
    notes: Object.values(notesRoot).reduce(
      (sum, notes) => sum + (Array.isArray(notes) ? notes.length : 0),
      0
    ),
    mapWaypoints: Object.values(mapsRoot).reduce(
      (sum, waypoints) => sum + (Array.isArray(waypoints) ? waypoints.length : 0),
      0
    ),
    treasuryTransactions: Array.isArray(gold.transactions) ? gold.transactions.length : 0,
    contentEntries: Array.isArray(state.contentEntries) ? state.contentEntries.length : 0
  };
}

function isStateEmpty(state) {
  return Object.values(countState(state)).every(count => count === 0);
}

function stateToBackupData(state) {
  const players = [];
  const characters = [];

  (state.players || []).forEach(player => {
    const currentCharacterId = player.currentCharacter && player.currentCharacter.id
      ? player.currentCharacter.id
      : null;
    players.push({
      id: player.id,
      name: player.name || '',
      bio: player.bio || '',
      currentCharacterId
    });

    const byId = new Map();
    (player.characters || []).forEach(character => {
      if (character && character.id) byId.set(character.id, character);
    });
    if (player.currentCharacter && player.currentCharacter.id) {
      byId.set(player.currentCharacter.id, player.currentCharacter);
    }
    byId.forEach(character => {
      characters.push({
        playerId: player.id,
        id: character.id,
        name: character.name || '',
        race: character.race || '',
        className: character.className || character.class || '',
        level: Number(character.level) || 1,
        status: character.status || 'retired',
        ...(Number.isFinite(Number(character.displayOrder))
          ? { displayOrder: Number(character.displayOrder) }
          : {})
      });
    });
  });

  const notes = [];
  Object.entries(state.notes || {}).forEach(([category, categoryNotes]) => {
    (categoryNotes || []).forEach(note => {
      notes.push({
        category,
        id: note.id,
        title: note.title || '',
        content: note.content || '',
        tags: Array.isArray(note.tags) ? note.tags : [],
        createdAt: note.createdAt || null,
        updatedAt: note.updatedAt || null
      });
    });
  });

  const mapWaypoints = [];
  Object.entries(state.mapWaypoints || {}).forEach(([mapId, waypoints]) => {
    (waypoints || []).forEach(waypoint => {
      mapWaypoints.push({
        mapId,
        id: waypoint.id,
        x: Number(waypoint.x),
        y: Number(waypoint.y),
        title: waypoint.title || '',
        note: waypoint.note || '',
        createdAt: waypoint.createdAt || null,
        updatedAt: waypoint.updatedAt || null
      });
    });
  });

  return {
    players,
    characters,
    notes,
    mapWaypoints,
    treasury: state.gold
      ? {
          version: state.gold.version || 2,
          settings: clone(state.gold.settings || {}),
          migration: clone(state.gold.migration || {}),
          transactions: clone(state.gold.transactions || [])
        }
      : null,
    contentEntries: clone(state.contentEntries || [])
  };
}

function createBackup(state, sourceStorage) {
  const data = stateToBackupData(state);
  const backupState = backupDataToState(data);
  const counts = countState(backupState);

  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    applicationVersion: APPLICATION_VERSION,
    sourceStorage,
    counts,
    data,
    integrity: {
      algorithm: 'sha256',
      dataSha256: checksumData(data)
    }
  };
}

function parseInput(input) {
  if (Buffer.isBuffer(input)) input = input.toString('utf8');
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      throw new BackupValidationError('The selected file is not valid JSON.');
    }
  }
  if (!isPlainObject(input)) {
    throw new BackupValidationError('The backup must be a JSON object.');
  }
  return input;
}

function validString(value, label, errors, {
  required = false,
  max = 20000
} = {}) {
  if (value === null || value === undefined) {
    if (required) errors.push(`${label} is required.`);
    return '';
  }
  if (typeof value !== 'string') {
    errors.push(`${label} must be a string.`);
    return '';
  }
  if (required && !value.trim()) errors.push(`${label} cannot be empty.`);
  if (value.length > max) errors.push(`${label} exceeds ${max} characters.`);
  return value;
}

function validId(value, label, errors) {
  return validString(value, label, errors, {
    required: true,
    max: MAX_ID_LENGTH
  });
}

function validOptionalTimestamp(value, label, errors) {
  if (value === null || value === undefined || value === '') return null;
  const timestamp = validString(value, label, errors, { max: 40 });
  if (timestamp && Number.isNaN(Date.parse(timestamp))) {
    errors.push(`${label} must be an ISO-compatible timestamp.`);
  }
  return timestamp || null;
}

function validTags(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return [];
  }
  if (value.length > 20) errors.push(`${label} cannot contain more than 20 tags.`);
  return value.slice(0, 20).map((tag, index) => (
    validString(tag, `${label}[${index}]`, errors, { max: 40 })
  ));
}

function rememberId(set, id, label, errors) {
  if (!id) return;
  if (set.has(id)) errors.push(`${label} contains duplicate ID "${id}".`);
  set.add(id);
}

function backupDataToState(rawData) {
  const errors = [];
  const data = isPlainObject(rawData) ? rawData : {};
  if (!isPlainObject(rawData)) errors.push('data must be an object.');

  for (const key of ['players', 'characters', 'notes', 'mapWaypoints', 'contentEntries']) {
    if (!Array.isArray(data[key])) errors.push(`data.${key} must be an array.`);
  }

  const rawPlayers = Array.isArray(data.players) ? data.players : [];
  const rawCharacters = Array.isArray(data.characters) ? data.characters : [];
  const rawNotes = Array.isArray(data.notes) ? data.notes : [];
  const rawWaypoints = Array.isArray(data.mapWaypoints) ? data.mapWaypoints : [];
  const rawEntries = Array.isArray(data.contentEntries) ? data.contentEntries : [];
  const totalRecords = rawPlayers.length + rawCharacters.length + rawNotes.length
    + rawWaypoints.length + rawEntries.length
    + (data.treasury && Array.isArray(data.treasury.transactions)
      ? data.treasury.transactions.length
      : 0);
  if (totalRecords > MAX_BACKUP_RECORDS) {
    errors.push(`Backup contains more than ${MAX_BACKUP_RECORDS} records.`);
  }

  const playerIds = new Set();
  const currentByPlayer = new Map();
  const players = rawPlayers.map((raw, index) => {
    const source = isPlainObject(raw) ? raw : {};
    if (!isPlainObject(raw)) errors.push(`data.players[${index}] must be an object.`);
    const id = validId(source.id, `data.players[${index}].id`, errors);
    rememberId(playerIds, id, 'data.players', errors);
    const currentCharacterId = source.currentCharacterId === null
      || source.currentCharacterId === undefined
      ? null
      : validId(
          source.currentCharacterId,
          `data.players[${index}].currentCharacterId`,
          errors
        );
    currentByPlayer.set(id, currentCharacterId);
    return {
      id,
      name: validString(source.name, `data.players[${index}].name`, errors, {
        required: true,
        max: 255
      }),
      bio: validString(source.bio || '', `data.players[${index}].bio`, errors, {
        max: 65535
      }),
      currentCharacter: null,
      characters: []
    };
  });

  const playersById = new Map(players.map(player => [player.id, player]));
  const characterIds = new Set();
  rawCharacters.forEach((raw, index) => {
    const source = isPlainObject(raw) ? raw : {};
    if (!isPlainObject(raw)) errors.push(`data.characters[${index}] must be an object.`);
    const id = validId(source.id, `data.characters[${index}].id`, errors);
    const playerId = validId(
      source.playerId,
      `data.characters[${index}].playerId`,
      errors
    );
    rememberId(characterIds, id, 'data.characters', errors);
    const player = playersById.get(playerId);
    if (!player) {
      errors.push(`Character "${id}" references missing player "${playerId}".`);
      return;
    }
    const level = Number(source.level);
    if (!Number.isSafeInteger(level) || level < 1) {
      errors.push(`Character "${id}" has an invalid level.`);
    }
    const character = {
      id,
      name: validString(source.name, `data.characters[${index}].name`, errors, {
        required: true,
        max: 255
      }),
      race: validString(source.race || '', `data.characters[${index}].race`, errors, {
        max: 255
      }),
      className: validString(
        source.className || '',
        `data.characters[${index}].className`,
        errors,
        { max: 255 }
      ),
      level: Number.isSafeInteger(level) && level >= 1 ? level : 1,
      status: validString(
        source.status || 'retired',
        `data.characters[${index}].status`,
        errors,
        { max: 40 }
      )
    };
    if (source.displayOrder !== undefined) {
      const displayOrder = Number(source.displayOrder);
      if (!Number.isSafeInteger(displayOrder) || displayOrder < 1) {
        errors.push(`Character "${id}" has an invalid displayOrder.`);
      } else {
        character.displayOrder = displayOrder;
      }
    }
    player.characters.push(character);
  });

  players.forEach(player => {
    const currentId = currentByPlayer.get(player.id);
    if (!currentId) return;
    const current = player.characters.find(character => character.id === currentId);
    if (!current) {
      errors.push(
        `Player "${player.id}" references missing current character "${currentId}".`
      );
      return;
    }
    player.currentCharacter = current;
  });

  const notes = {};
  const noteKeys = new Set();
  rawNotes.forEach((raw, index) => {
    const source = isPlainObject(raw) ? raw : {};
    if (!isPlainObject(raw)) errors.push(`data.notes[${index}] must be an object.`);
    const category = validString(
      source.category,
      `data.notes[${index}].category`,
      errors,
      { required: true, max: 80 }
    );
    if (!NOTE_CATEGORIES.has(category)) {
      errors.push(`Note category "${category}" is not supported.`);
    }
    const id = validId(source.id, `data.notes[${index}].id`, errors);
    rememberId(noteKeys, `${category}:${id}`, 'data.notes', errors);
    if (!notes[category]) notes[category] = [];
    notes[category].push({
      id,
      title: validString(source.title, `data.notes[${index}].title`, errors, {
        required: true,
        max: 255
      }),
      content: validString(
        source.content || '',
        `data.notes[${index}].content`,
        errors,
        { max: 16000000 }
      ),
      tags: validTags(source.tags || [], `data.notes[${index}].tags`, errors),
      createdAt: validOptionalTimestamp(
        source.createdAt,
        `data.notes[${index}].createdAt`,
        errors
      ),
      updatedAt: validOptionalTimestamp(
        source.updatedAt,
        `data.notes[${index}].updatedAt`,
        errors
      )
    });
  });

  const mapWaypoints = {};
  const waypointKeys = new Set();
  rawWaypoints.forEach((raw, index) => {
    const source = isPlainObject(raw) ? raw : {};
    if (!isPlainObject(raw)) {
      errors.push(`data.mapWaypoints[${index}] must be an object.`);
    }
    const mapId = validString(
      source.mapId,
      `data.mapWaypoints[${index}].mapId`,
      errors,
      { required: true, max: 80 }
    );
    if (!MAP_IDS.has(mapId)) errors.push(`Map "${mapId}" is not supported.`);
    const id = validId(source.id, `data.mapWaypoints[${index}].id`, errors);
    rememberId(waypointKeys, `${mapId}:${id}`, 'data.mapWaypoints', errors);
    const x = Number(source.x);
    const y = Number(source.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      errors.push(`Waypoint "${id}" must have finite x and y coordinates.`);
    }
    if (!mapWaypoints[mapId]) mapWaypoints[mapId] = [];
    mapWaypoints[mapId].push({
      id,
      mapId,
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      title: validString(
        source.title || '',
        `data.mapWaypoints[${index}].title`,
        errors,
        { max: 255 }
      ),
      note: validString(
        source.note || '',
        `data.mapWaypoints[${index}].note`,
        errors,
        { max: 65535 }
      ),
      createdAt: validOptionalTimestamp(
        source.createdAt,
        `data.mapWaypoints[${index}].createdAt`,
        errors
      ),
      updatedAt: validOptionalTimestamp(
        source.updatedAt,
        `data.mapWaypoints[${index}].updatedAt`,
        errors
      )
    });
  });

  let gold = null;
  if (data.treasury !== null && data.treasury !== undefined) {
    if (!isPlainObject(data.treasury)) {
      errors.push('data.treasury must be an object or null.');
    } else {
      const rawTransactions = Array.isArray(data.treasury.transactions)
        ? data.treasury.transactions
        : [];
      if (!Array.isArray(data.treasury.transactions)) {
        errors.push('data.treasury.transactions must be an array.');
      }
      const transactionIds = new Set();
      const transactions = rawTransactions.map((raw, index) => {
        const source = isPlainObject(raw) ? raw : {};
        if (!isPlainObject(raw)) {
          errors.push(`data.treasury.transactions[${index}] must be an object.`);
        }
        const id = validId(
          source.id,
          `data.treasury.transactions[${index}].id`,
          errors
        );
        rememberId(transactionIds, id, 'data.treasury.transactions', errors);
        const type = source.type;
        if (type !== 'income' && type !== 'expense') {
          errors.push(`Treasury transaction "${id}" has an invalid type.`);
        }
        const totalCp = Number(source.totalCp);
        if (!Number.isSafeInteger(totalCp) || totalCp <= 0) {
          errors.push(`Treasury transaction "${id}" has an invalid totalCp.`);
        }
        const allocations = Array.isArray(source.allocations)
          ? source.allocations.map((rawAllocation, allocationIndex) => {
              const allocation = isPlainObject(rawAllocation) ? rawAllocation : {};
              if (!isPlainObject(rawAllocation)) {
                errors.push(
                  `Transaction "${id}" allocation ${allocationIndex} must be an object.`
                );
              }
              const targetType = allocation.targetType;
              if (targetType !== 'character' && targetType !== 'patron') {
                errors.push(
                  `Transaction "${id}" allocation ${allocationIndex} has an invalid target.`
                );
              }
              const cpDelta = Number(allocation.cpDelta);
              if (!Number.isSafeInteger(cpDelta) || cpDelta === 0) {
                errors.push(
                  `Transaction "${id}" allocation ${allocationIndex} has an invalid cpDelta.`
                );
              }
              const normalized = { targetType, cpDelta };
              if (targetType === 'character') {
                normalized.characterId = validId(
                  allocation.characterId,
                  `Transaction "${id}" allocation ${allocationIndex}.characterId`,
                  errors
                );
                if (!characterIds.has(normalized.characterId)) {
                  errors.push(
                    `Transaction "${id}" references missing character "${normalized.characterId}".`
                  );
                }
              }
              if (allocation.shareCount !== undefined) {
                const shareCount = Number(allocation.shareCount);
                if (!Number.isSafeInteger(shareCount) || shareCount < 0) {
                  errors.push(
                    `Transaction "${id}" allocation ${allocationIndex} has an invalid shareCount.`
                  );
                } else {
                  normalized.shareCount = shareCount;
                }
              }
              if (allocation.allocationPercent !== undefined) {
                const percentage = Number(allocation.allocationPercent);
                if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
                  errors.push(
                    `Transaction "${id}" allocation ${allocationIndex} has an invalid percentage.`
                  );
                } else {
                  normalized.allocationPercent = percentage;
                }
              }
              return normalized;
            })
          : [];
        if (!Array.isArray(source.allocations) || allocations.length === 0) {
          errors.push(`Treasury transaction "${id}" requires allocations.`);
        }
        const allocationTotal = allocations.reduce(
          (sum, allocation) => sum + (Number.isSafeInteger(allocation.cpDelta)
            ? allocation.cpDelta
            : 0),
          0
        );
        const expected = type === 'expense' ? -totalCp : totalCp;
        if (Number.isSafeInteger(totalCp) && allocationTotal !== expected) {
          errors.push(
            `Treasury transaction "${id}" allocations total ${allocationTotal}, expected ${expected}.`
          );
        }
        const allocationMode = source.allocationMode || 'direct';
        if (!ALLOCATION_MODES.has(allocationMode)) {
          errors.push(`Treasury transaction "${id}" has an invalid allocationMode.`);
        }
        return {
          id,
          date: validString(
            source.date || '',
            `data.treasury.transactions[${index}].date`,
            errors,
            { required: true, max: 20 }
          ),
          description: validString(
            source.description || '',
            `data.treasury.transactions[${index}].description`,
            errors,
            { max: 2000 }
          ),
          type,
          totalCp: Number.isSafeInteger(totalCp) ? totalCp : 0,
          inputCoins: isPlainObject(source.inputCoins) ? clone(source.inputCoins) : {},
          allocationMode,
          patronEnabledAtTime: Boolean(source.patronEnabledAtTime),
          patronPercentAtTime: Number(source.patronPercentAtTime) || 0,
          patronCp: Number(source.patronCp) || 0,
          allocations,
          ...(source.sessionLabel
            ? {
                sessionLabel: validString(
                  source.sessionLabel,
                  `data.treasury.transactions[${index}].sessionLabel`,
                  errors,
                  { max: 255 }
                )
              }
            : {}),
          ...(source.note
            ? {
                note: validString(
                  source.note,
                  `data.treasury.transactions[${index}].note`,
                  errors,
                  { max: 2000 }
                )
              }
            : {}),
          createdAt: validOptionalTimestamp(
            source.createdAt,
            `data.treasury.transactions[${index}].createdAt`,
            errors
          ) || new Date(0).toISOString(),
          updatedAt: validOptionalTimestamp(
            source.updatedAt,
            `data.treasury.transactions[${index}].updatedAt`,
            errors
          ) || new Date(0).toISOString()
        };
      });
      gold = {
        version: Number.isSafeInteger(Number(data.treasury.version))
          ? Number(data.treasury.version)
          : 2,
        settings: isPlainObject(data.treasury.settings)
          ? clone(data.treasury.settings)
          : {},
        migration: isPlainObject(data.treasury.migration)
          ? clone(data.treasury.migration)
          : {},
        transactions
      };
    }
  }

  const entryIds = new Set();
  const contentEntries = rawEntries.map((raw, index) => {
    const source = isPlainObject(raw) ? raw : {};
    if (!isPlainObject(raw)) {
      errors.push(`data.contentEntries[${index}] must be an object.`);
    }
    const id = validId(source.id, `data.contentEntries[${index}].id`, errors);
    rememberId(entryIds, id, 'data.contentEntries', errors);
    const type = validString(
      source.type,
      `data.contentEntries[${index}].type`,
      errors,
      { required: true, max: 30 }
    );
    if (!CONTENT_TYPES.has(type)) {
      errors.push(`Content entry "${id}" has unsupported type "${type}".`);
    }
    return {
      id,
      type,
      title: validString(
        source.title,
        `data.contentEntries[${index}].title`,
        errors,
        { required: true, max: 255 }
      ),
      summary: validString(
        source.summary || '',
        `data.contentEntries[${index}].summary`,
        errors,
        { max: 65535 }
      ),
      content: validString(
        source.content || '',
        `data.contentEntries[${index}].content`,
        errors,
        { max: 16000000 }
      ),
      tags: validTags(
        source.tags || [],
        `data.contentEntries[${index}].tags`,
        errors
      ),
      details: isPlainObject(source.details) ? clone(source.details) : {},
      createdByName: validString(
        source.createdByName || '',
        `data.contentEntries[${index}].createdByName`,
        errors,
        { max: 100 }
      ),
      createdAt: validOptionalTimestamp(
        source.createdAt,
        `data.contentEntries[${index}].createdAt`,
        errors
      ),
      updatedAt: validOptionalTimestamp(
        source.updatedAt,
        `data.contentEntries[${index}].updatedAt`,
        errors
      )
    };
  });

  if (errors.length) throw new BackupValidationError(errors);
  return { players, notes, mapWaypoints, gold, contentEntries };
}

function validateBackup(input) {
  const backup = parseInput(input);
  const errors = [];
  if (backup.format !== BACKUP_FORMAT) {
    errors.push(`Unsupported backup format "${backup.format || ''}".`);
  }
  if (backup.formatVersion !== BACKUP_FORMAT_VERSION) {
    errors.push(
      `Unsupported backup version "${backup.formatVersion}". Expected ${BACKUP_FORMAT_VERSION}.`
    );
  }
  if (!isPlainObject(backup.data)) errors.push('Backup data is missing.');
  if (!isPlainObject(backup.integrity)) {
    errors.push('Backup integrity information is missing.');
  } else {
    if (backup.integrity.algorithm !== 'sha256') {
      errors.push('Backup integrity algorithm must be sha256.');
    }
    const expectedChecksum = isPlainObject(backup.data)
      ? checksumData(backup.data)
      : '';
    if (backup.integrity.dataSha256 !== expectedChecksum) {
      errors.push('Backup checksum does not match its data.');
    }
  }
  if (errors.length) throw new BackupValidationError(errors);

  const state = backupDataToState(backup.data);
  const counts = countState(state);
  return {
    backup,
    state,
    counts,
    canonicalChecksum: checksumData(stateToBackupData(state))
  };
}

module.exports = {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BackupValidationError,
  checksumData,
  countState,
  isStateEmpty,
  createBackup,
  validateBackup,
  stateToBackupData
};
