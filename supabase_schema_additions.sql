-- ═══════════════════════════════════════════════════════════════
--  PrintMaster – NEW TABLES (add to supabase_schema.sql)
--  Run in Supabase SQL Editor AFTER the existing schema
-- ═══════════════════════════════════════════════════════════════

-- ── Chat Rooms ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_rooms (
  id              TEXT PRIMARY KEY,          -- e.g. 'general', 'billing'
  organisation_id UUID,
  name            TEXT NOT NULL,
  avatar          TEXT DEFAULT '💬',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Chat Messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID,
  room_id         TEXT NOT NULL,
  sender_id       TEXT NOT NULL,
  sender_name     TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room    ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_org     ON chat_messages(organisation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);

-- ── Notifications ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID,
  user_id         TEXT,
  type            TEXT DEFAULT 'system',   -- 'payment' | 'reminder' | 'gst' | 'system' | 'bill'
  title           TEXT NOT NULL,
  body            TEXT,
  read            BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org     ON notifications(organisation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ── E-Invoice tracking (add columns to bills) ─────────────────
ALTER TABLE bills ADD COLUMN IF NOT EXISTS irn        TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS irn_status TEXT DEFAULT 'pending';  -- 'pending' | 'generated' | 'cancelled'
ALTER TABLE bills ADD COLUMN IF NOT EXISTS ewb_no     TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS ewb_status TEXT DEFAULT 'none';     -- 'none' | 'active' | 'expired' | 'cancelled'

-- ── Enable Realtime for chat ───────────────────────────────────
-- Run these two lines to enable Supabase Realtime on chat_messages:
-- ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ── Row Level Security (optional) ─────────────────────────────
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
