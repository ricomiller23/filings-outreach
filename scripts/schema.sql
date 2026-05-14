-- scripts/schema.sql
-- Run once: npx tsx scripts/init-db.ts
-- Adds outreach tables to existing Neon DB. Idempotent (IF NOT EXISTS).

-- ─── Seed Watchlist ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreach_seed_watchlist (
  seed_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_company   TEXT NOT NULL,
  target_context   TEXT,
  contact_person   TEXT,
  title            TEXT,
  email            TEXT,
  phone            TEXT,
  filing_link      TEXT,
  contact_source_link TEXT,
  likely_paper     TEXT,
  best_angle       TEXT,
  live_enabled     BOOLEAN DEFAULT true,
  issuer_cik       TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (target_company, email)
);

-- ─── Outreach CRM ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreach_crm (
  outreach_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id          UUID REFERENCES outreach_seed_watchlist(seed_id),
  target_company   TEXT,
  contact_person   TEXT,
  title            TEXT,
  email            TEXT NOT NULL,
  phone            TEXT,
  issuer_name      TEXT,
  ticker           TEXT,
  filing_date      DATE,
  filing_url       TEXT,
  form_type        TEXT,
  score            INT,
  flags            TEXT[],
  likely_paper     TEXT,
  outreach_angle   TEXT,
  email_subject    TEXT,
  email_body       TEXT,
  sent_at          TIMESTAMPTZ,
  gmail_message_id TEXT,
  gmail_thread_id  TEXT,
  delivery_status  TEXT DEFAULT 'sent',
  reply_status     TEXT DEFAULT 'awaiting',
  replied_at       TIMESTAMPTZ,
  followup_due_at  TIMESTAMPTZ,
  last_action      TEXT,
  owner            TEXT DEFAULT 'ricomiller@icloud.com',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (email, issuer_name, filing_date)
);

-- ─── Run Log ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS outreach_run_log (
  run_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at           TIMESTAMPTZ DEFAULT now(),
  filings_scanned  INT DEFAULT 0,
  matched_targets  INT DEFAULT 0,
  emails_sent      INT DEFAULT 0,
  suppressed_dupes INT DEFAULT 0,
  bounces          INT DEFAULT 0,
  auth_errors      TEXT,
  send_errors      TEXT,
  status           TEXT DEFAULT 'running',
  completed_at     TIMESTAMPTZ,
  notes            TEXT
);

-- Index for duplicate suppression lookups
CREATE INDEX IF NOT EXISTS outreach_crm_dedup_idx 
  ON outreach_crm (email, issuer_name, filing_date);

-- Index for reply tracking
CREATE INDEX IF NOT EXISTS outreach_crm_reply_idx 
  ON outreach_crm (gmail_thread_id) WHERE gmail_thread_id IS NOT NULL;

-- Index for suppression window (30-day)
CREATE INDEX IF NOT EXISTS outreach_crm_sent_at_idx
  ON outreach_crm (email, sent_at);
