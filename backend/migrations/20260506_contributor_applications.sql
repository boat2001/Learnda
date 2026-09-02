ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_contributor BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contributor_application_status VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS contributor_application_note TEXT NULL,
  ADD COLUMN IF NOT EXISTS contributor_applied_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS contributor_approved_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS contributor_approved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_contributor_application_status_idx
  ON users (contributor_application_status);

CREATE INDEX IF NOT EXISTS users_is_contributor_idx
  ON users (is_contributor);
