-- ============================================================
-- LILA BLACK Player Journey Visualizer — Supabase Schema
-- Run this in the Supabase SQL Editor before running etl.py
-- ============================================================

-- Drop if exists (for clean re-runs)
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS matches;

-- Main events table (~89,000 rows)
CREATE TABLE events (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT      NOT NULL,
  match_id      TEXT      NOT NULL,
  map_id        TEXT      NOT NULL,
  date          DATE      NOT NULL,
  x             REAL      NOT NULL,
  z             REAL      NOT NULL,
  px            INTEGER   NOT NULL,   -- minimap pixel x (0–1024), pre-computed
  py            INTEGER   NOT NULL,   -- minimap pixel y (0–1024), pre-computed
  ts            BIGINT    NOT NULL,   -- ms timestamp for timeline ordering
  event_type    TEXT      NOT NULL,   -- decoded event string
  is_bot        BOOLEAN   NOT NULL    -- TRUE if numeric user_id
);

-- Match index table (796 rows)
CREATE TABLE matches (
  match_id      TEXT PRIMARY KEY,
  map_id        TEXT    NOT NULL,
  date          DATE    NOT NULL,
  human_count   INTEGER NOT NULL DEFAULT 0,
  bot_count     INTEGER NOT NULL DEFAULT 0,
  total_events  INTEGER NOT NULL DEFAULT 0
);

-- Indexes for fast frontend queries
CREATE INDEX idx_events_match_id    ON events (match_id);
CREATE INDEX idx_events_map_date    ON events (map_id, date);
CREATE INDEX idx_events_event_type  ON events (event_type);
CREATE INDEX idx_events_is_bot      ON events (is_bot);
CREATE INDEX idx_matches_map_date   ON matches (map_id, date);

-- Disable RLS so frontend can read without auth
ALTER TABLE events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on events"
  ON events FOR SELECT USING (true);

CREATE POLICY "Allow public read on matches"
  ON matches FOR SELECT USING (true);
