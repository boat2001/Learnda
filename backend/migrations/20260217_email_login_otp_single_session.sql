-- Add OTP challenge fields for email login verification

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS login_otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS login_otp_challenge_token TEXT,
  ADD COLUMN IF NOT EXISTS login_otp_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_otp_attempts INTEGER NOT NULL DEFAULT 0;
