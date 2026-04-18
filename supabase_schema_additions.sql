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

CREATE INDEX IF NOT EXISTS idx_chat_rooms_org ON chat_rooms(organisation_id);

-- ── Chat Messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID,
  room_id         TEXT NOT NULL,
  sender_id       TEXT NOT NULL,
  sender_name     TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_chat_messages_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE
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
CREATE INDEX IF NOT EXISTS idx_notifications_read    ON notifications(read);

-- ── E-Invoice tracking (add columns to bills) ─────────────────
ALTER TABLE bills ADD COLUMN IF NOT EXISTS irn        TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS ack_no     TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS irn_status TEXT DEFAULT 'pending';  -- 'pending' | 'generated' | 'cancelled'
ALTER TABLE bills ADD COLUMN IF NOT EXISTS ewb_no     TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS ewb_status TEXT DEFAULT 'none';     -- 'none' | 'active' | 'expired' | 'cancelled'

-- ── Enable Realtime for chat ───────────────────────────────────
-- Run these two lines to enable Supabase Realtime on chat_messages:
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ── Row Level Security (optional) ─────────────────────────────
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_access_policy" ON chat_messages
  FOR ALL
  USING (
    sender_id = auth.uid()::text OR 
    organisation_id = (auth.jwt() ->> 'organisation_id')::uuid
  );

CREATE POLICY "notifications_access_policy" ON notifications
  FOR ALL
  USING (
    user_id = auth.uid()::text OR 
    organisation_id = (auth.jwt() ->> 'organisation_id')::uuid
  );

-- ── E-Way Bills ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eway_bills (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID,
  bill_id         UUID,
  ewb_no          TEXT NOT NULL,
  ewb_date        TEXT,
  valid_upto      TEXT,
  party_name      TEXT,
  total_value     NUMERIC,
  document_number TEXT,
  vehicle_number  TEXT,
  transporter     TEXT,
  status          TEXT DEFAULT 'ACTIVE',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eway_bills_org ON eway_bills(organisation_id);
