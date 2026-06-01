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

-- ─── CRM Contacts ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  email TEXT,  -- Nullable, and unique constraint removed to allow multi-nulls
  phone TEXT,
  source TEXT DEFAULT 'manual_entry',
  is_individual BOOLEAN DEFAULT true,
  is_decision_maker BOOLEAN DEFAULT false,
  influence_level TEXT DEFAULT 'influencer',
  security_type TEXT,
  position_size NUMERIC DEFAULT 0,
  estimated_value NUMERIC DEFAULT 0,
  security_description TEXT,
  status TEXT DEFAULT 'Warm',
  priority TEXT DEFAULT 'Medium',
  last_contact_date TIMESTAMPTZ,
  last_contact_method TEXT,
  next_follow_up_date TIMESTAMPTZ,
  next_follow_up_action TEXT,
  touchpoints JSONB DEFAULT '[]'::jsonb,
  deal_value NUMERIC DEFAULT 0,
  close_probability NUMERIC DEFAULT 0,
  expected_close_date TIMESTAMPTZ,
  actual_close_date TIMESTAMPTZ,
  notes TEXT,
  tags TEXT[] DEFAULT '{}'::text[],
  follow_up_sequence TEXT DEFAULT 'none',
  automation_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3(a)(10) Filings ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS filings_3a10 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filing_id TEXT,
  cik TEXT,
  company_name TEXT,
  ticker TEXT,
  filing_date TIMESTAMPTZ,
  filing_type TEXT DEFAULT '3a10_exemption',
  transaction_type TEXT,
  securities_being_exchanged TEXT,
  value_of_securities NUMERIC DEFAULT 0,
  number_of_shares NUMERIC DEFAULT 0,
  court_approval BOOLEAN DEFAULT false,
  court_approval_date TIMESTAMPTZ,
  exchange_ratio TEXT,
  beneficial_holders INT DEFAULT 0,
  security_type TEXT,
  restriction_details TEXT,
  holding_period INT DEFAULT 0,
  source_url TEXT,
  extracted_text TEXT,
  extracted_by TEXT DEFAULT 'automated',
  confidence_score NUMERIC DEFAULT 0,
  is_new BOOLEAN DEFAULT true,
  is_reviewed BOOLEAN DEFAULT false,
  is_relevant BOOLEAN DEFAULT false,
  relevance_score NUMERIC DEFAULT 0,
  identified_contacts JSONB DEFAULT '[]'::jsonb,
  outreach_status TEXT DEFAULT 'not_contacted',
  outreach_contact_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Research Queue ────────────────────────────────────────────────────────────
-- Holds companies discovered via filing scans that need a real contact
-- email researched before outreach can begin. The workflow NEVER sends to
-- guessed/placeholder addresses — it logs here instead.
CREATE TABLE IF NOT EXISTS outreach_research_queue (
  queue_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_cik           TEXT NOT NULL UNIQUE,   -- one row per company
  issuer_name          TEXT NOT NULL,
  ticker               TEXT,
  form_type            TEXT,
  filing_date          DATE,
  likely_contact_person TEXT,                  -- insider name if available
  likely_paper         TEXT,
  filing_url           TEXT,
  notes                TEXT,
  status               TEXT DEFAULT 'needs_research',  -- needs_research | researched | skip
  resolved_seed_id     UUID REFERENCES outreach_seed_watchlist(seed_id),
  created_at           TIMESTAMPTZ DEFAULT now(),
  last_seen_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_research_queue_status_idx
  ON outreach_research_queue (status)
  WHERE status = 'needs_research';

-- ─── WhaleWisdom Integration ───────────────────────
-- Alter existing tables to support WhaleWisdom Stock IDs
ALTER TABLE outreach_seed_watchlist
  ADD COLUMN IF NOT EXISTS whalewisdom_stock_id INT;

ALTER TABLE outreach_research_queue
  ADD COLUMN IF NOT EXISTS whalewisdom_stock_id INT;

-- Table to cache institutional holders for companies
CREATE TABLE IF NOT EXISTS outreach_company_holders (
  holder_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_cik            TEXT NOT NULL,
  holder_name           TEXT NOT NULL,
  shares                BIGINT,
  percent_ownership     NUMERIC(5,2),
  change_shares         BIGINT,
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (issuer_cik, holder_name)
);

CREATE INDEX IF NOT EXISTS outreach_company_holders_cik_idx
  ON outreach_company_holders (issuer_cik);
