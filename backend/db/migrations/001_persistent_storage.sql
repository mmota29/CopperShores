CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_entries_type ON content_entries (type);
CREATE INDEX IF NOT EXISTS idx_content_entries_updated_at ON content_entries (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_entries_tags ON content_entries USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_content_entries_search
  ON content_entries USING GIN (
    to_tsvector('english', title || ' ' || summary || ' ' || content)
  );
