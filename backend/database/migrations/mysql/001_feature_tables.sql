CREATE TABLE IF NOT EXISTS storage_metadata (
  metadata_key VARCHAR(80) PRIMARY KEY,
  value_json JSON NOT NULL,
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS players (
  id VARCHAR(191) PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0,
  name VARCHAR(255) NOT NULL,
  bio TEXT NOT NULL,
  INDEX idx_players_name (name)
);

CREATE TABLE IF NOT EXISTS characters (
  player_id VARCHAR(191) NOT NULL,
  id VARCHAR(191) NOT NULL,
  character_scope VARCHAR(20) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  data JSON NOT NULL,
  PRIMARY KEY (player_id, id, character_scope),
  CONSTRAINT fk_characters_player
    FOREIGN KEY (player_id) REFERENCES players(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  category VARCHAR(80) NOT NULL,
  id VARCHAR(191) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  title VARCHAR(255) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  tags JSON NOT NULL,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  PRIMARY KEY (category, id),
  INDEX idx_notes_title (title),
  INDEX idx_notes_updated_at (updated_at),
  FULLTEXT INDEX idx_notes_search (title, content)
);

CREATE TABLE IF NOT EXISTS map_waypoints (
  map_id VARCHAR(80) NOT NULL,
  id VARCHAR(191) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  x DOUBLE NOT NULL,
  y DOUBLE NOT NULL,
  title VARCHAR(255) NOT NULL,
  note TEXT NOT NULL,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  PRIMARY KEY (map_id, id),
  INDEX idx_waypoints_title (title)
);

CREATE TABLE IF NOT EXISTS treasury_config (
  id TINYINT PRIMARY KEY,
  version INT NULL,
  settings JSON NULL,
  migration_data JSON NULL
);

CREATE TABLE IF NOT EXISTS treasury_transactions (
  id VARCHAR(191) PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0,
  transaction_date VARCHAR(20) NULL,
  transaction_type VARCHAR(30) NULL,
  total_cp BIGINT NULL,
  data JSON NOT NULL,
  INDEX idx_treasury_date (transaction_date),
  INDEX idx_treasury_type (transaction_type)
);

CREATE TABLE IF NOT EXISTS content_entries (
  id VARCHAR(191) PRIMARY KEY,
  sort_order INT NOT NULL DEFAULT 0,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  content MEDIUMTEXT NOT NULL,
  tags JSON NOT NULL,
  details JSON NOT NULL,
  created_by_name VARCHAR(100) NOT NULL,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  INDEX idx_content_type (type),
  INDEX idx_content_updated_at (updated_at),
  FULLTEXT INDEX idx_content_search (title, summary, content)
);
