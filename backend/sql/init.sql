CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  race TEXT,
  class_name TEXT,
  level INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'retired',
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characters_player_id ON characters(player_id);
CREATE INDEX IF NOT EXISTS idx_characters_is_current ON characters(player_id, is_current);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_category ON notes(category);

CREATE TABLE IF NOT EXISTS loot_log (
  id TEXT PRIMARY KEY,
  date DATE,
  description TEXT,
  category TEXT,
  pp INT NOT NULL DEFAULT 0,
  gp INT NOT NULL DEFAULT 0,
  sp INT NOT NULL DEFAULT 0,
  cp INT NOT NULL DEFAULT 0,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS waypoints (
  id TEXT PRIMARY KEY,
  map_id TEXT NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  x INT NOT NULL,
  y INT NOT NULL,
  title TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_waypoints_map_id ON waypoints(map_id);

CREATE TABLE IF NOT EXISTS treasury_settings (
  id INT PRIMARY KEY,
  patron_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  default_patron_percent INT NOT NULL DEFAULT 10,
  default_split_mode TEXT NOT NULL DEFAULT 'equal_split',
  coin_values JSONB NOT NULL DEFAULT '{"pp":1000,"gp":100,"sp":10,"cp":1}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treasury_transactions (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  total_cp INT NOT NULL,
  input_coins JSONB NOT NULL DEFAULT '{"pp":0,"gp":0,"sp":0,"cp":0}'::jsonb,
  allocation_mode TEXT NOT NULL CHECK (allocation_mode IN ('direct','equal_split','custom_split')),
  patron_enabled_at_time BOOLEAN NOT NULL DEFAULT FALSE,
  patron_percent_at_time INT NOT NULL DEFAULT 0,
  patron_cp INT NOT NULL DEFAULT 0,
  allocations JSONB NOT NULL DEFAULT '[]'::jsonb,
  session_label TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_transactions_date ON treasury_transactions(date);
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_type ON treasury_transactions(type);

INSERT INTO maps (id, name, image_path) VALUES
  ('world', 'World Map', '/allmaps/coppershores.png'),
  ('alsita', 'Alsita', '/allmaps/Alsita.PNG'),
  ('tosatina', 'Tosatina', '/allmaps/Tosatina.PNG'),
  ('tormsicle', 'Tormsicle', '/allmaps/Tormsicle.png')
ON CONFLICT (id) DO NOTHING;

INSERT INTO treasury_settings (id, patron_enabled, default_patron_percent, default_split_mode, coin_values)
VALUES (1, FALSE, 10, 'equal_split', '{"pp":1000,"gp":100,"sp":10,"cp":1}'::jsonb)
ON CONFLICT (id) DO NOTHING;
