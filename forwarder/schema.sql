-- D1 schema for the UK call forwarder + dialer backend.
-- Apply with: wrangler d1 execute call-tracking-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,       -- E.164 UK number, e.g. +447700900123
  label TEXT,                        -- human-readable name for this destination
  enabled INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT,                 -- ISO timestamp, drives round-robin ordering
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sticky mapping: once a caller has been routed to a destination, they
-- always return to the same one on future calls.
CREATE TABLE IF NOT EXISTS caller_mappings (
  caller_number TEXT PRIMARY KEY,    -- E.164 caller number
  destination_id INTEGER NOT NULL REFERENCES destinations(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS call_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL,           -- 'inbound' | 'outbound'
  from_number TEXT,
  to_number TEXT,
  call_sid TEXT,
  status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outbound dialer queue, loaded from CSV by the desktop app.
CREATE TABLE IF NOT EXISTS dial_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name TEXT,
  number TEXT NOT NULL,              -- E.164 number to dial
  status TEXT NOT NULL DEFAULT 'pending', -- pending|calling|completed|no-answer|failed|skipped
  call_sid TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_destinations_roundrobin
  ON destinations (enabled, last_used_at);

CREATE INDEX IF NOT EXISTS idx_dial_queue_status
  ON dial_queue (status, created_at);
