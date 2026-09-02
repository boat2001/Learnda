/**
 * One-time migration runner: creates tables that aren't covered by DB_SYNC.
 * Run from the Render web service shell:
 *   node src/scripts/run_migrations.js
 */
require('../config/loadEnv').loadEnv();
const { Client } = require('pg');

const SQL = `
-- ── registration_sessions ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE enum_registration_sessions_contact_type AS ENUM ('email', 'phone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE enum_registration_sessions_stage AS ENUM (
    'IDENTITY', 'ACADEMIC', 'PLAN', 'PAYMENT', 'DONE', 'ABANDONED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS registration_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type        enum_registration_sessions_contact_type NOT NULL,
  contact_value       VARCHAR(255) NOT NULL,
  normalized_contact  VARCHAR(255) NOT NULL,
  otp_verified        BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash       TEXT,
  full_name           VARCHAR(255),
  institution_id      UUID,
  affiliate_university VARCHAR(255),
  programme_category  VARCHAR(255),
  program_id          UUID,
  level               VARCHAR(50),
  semester            VARCHAR(20),
  index_number        VARCHAR(80),
  selected_plan_id    UUID,
  duration_months     INTEGER,
  stage               enum_registration_sessions_stage NOT NULL DEFAULT 'IDENTITY',
  expires_at          TIMESTAMPTZ NOT NULL,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS registration_sessions_contact_unique
  ON registration_sessions(contact_type, normalized_contact);
CREATE INDEX IF NOT EXISTS registration_sessions_stage_idx
  ON registration_sessions(stage);
CREATE INDEX IF NOT EXISTS registration_sessions_expires_at_idx
  ON registration_sessions(expires_at);

-- ── registration_otps ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE enum_registration_otps_channel AS ENUM ('email', 'phone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS registration_otps (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_session_id UUID REFERENCES registration_sessions(id) ON DELETE SET NULL,
  email                   TEXT NOT NULL UNIQUE,
  channel                 enum_registration_otps_channel NOT NULL DEFAULT 'email',
  contact_value           VARCHAR(255),
  challenge_token         VARCHAR(128) NOT NULL UNIQUE,
  otp_hash                VARCHAR(255) NOT NULL,
  payload                 JSONB NOT NULL DEFAULT '{}',
  expires_at              TIMESTAMPTZ NOT NULL,
  attempts                INTEGER NOT NULL DEFAULT 0,
  verified_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if table already existed with old schema
ALTER TABLE registration_otps
  ADD COLUMN IF NOT EXISTS registration_session_id UUID REFERENCES registration_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel                 enum_registration_otps_channel NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS contact_value           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS verified_at             TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS registration_otps_session_idx
  ON registration_otps(registration_session_id);
CREATE INDEX IF NOT EXISTS registration_otps_expires_at_idx
  ON registration_otps(expires_at);

-- ── registration_security_events ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registration_security_events (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_session_id UUID REFERENCES registration_sessions(id) ON DELETE CASCADE,
  event_type              TEXT NOT NULL,
  ip_address              TEXT,
  user_agent              TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reg_security_events_session_idx
  ON registration_security_events(registration_session_id);

-- support report reply/admin workflow columns.
ALTER TABLE support_reports
  ADD COLUMN IF NOT EXISTS admin_reply TEXT,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replied_by UUID;

-- spotlight awards freeze each Student of the Week / Contributor of the Month cycle.
CREATE TABLE IF NOT EXISTS spotlight_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id VARCHAR(160) NOT NULL UNIQUE,
  award_type VARCHAR(40) NOT NULL,
  cycle_key VARCHAR(80) NOT NULL,
  user_id UUID,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS spotlight_awards_type_cycle_unique
  ON spotlight_awards(award_type, cycle_key);
CREATE INDEX IF NOT EXISTS spotlight_awards_user_type_idx
  ON spotlight_awards(user_id, award_type);
`;

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected. Running migrations...');
  await client.query(SQL);
  console.log('Done. All tables are up to date.');
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
