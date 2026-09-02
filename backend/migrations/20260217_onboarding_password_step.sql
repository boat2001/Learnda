-- Add password onboarding step support to existing deployments

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_onboarding_step_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_onboarding_step_check;
  END IF;
END $$;

ALTER TABLE users
  ADD CONSTRAINT users_onboarding_step_check
  CHECK (onboarding_step IN ('PROFILE', 'PASSWORD', 'PLAN', 'PAYMENT', 'DONE'));

UPDATE users
SET onboarding_step = CASE
  WHEN profile_complete = false THEN 'PROFILE'
  WHEN password_set = false THEN 'PASSWORD'
  WHEN selected_plan_id IS NULL THEN 'PLAN'
  WHEN plan_status = 'pending_payment' THEN 'PAYMENT'
  ELSE 'DONE'
END;
