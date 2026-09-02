-- Learnda auth/onboarding extension (non-destructive)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_user_id TEXT,
  ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT NOT NULL DEFAULT 'PROFILE',
  ADD COLUMN IF NOT EXISTS selected_plan_id UUID,
  ADD COLUMN IF NOT EXISTS plan_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS password_set BOOLEAN NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'users'
      AND constraint_name = 'users_selected_plan_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_selected_plan_id_fkey
      FOREIGN KEY (selected_plan_id) REFERENCES plans(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_onboarding_step_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_onboarding_step_check
      CHECK (onboarding_step IN ('PROFILE', 'PASSWORD', 'PLAN', 'PAYMENT', 'DONE'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_plan_status_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_plan_status_check
      CHECK (plan_status IN ('none', 'pending_payment', 'active', 'institution_pending'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS users_auth_provider_provider_user_id_uniq
  ON users(auth_provider, provider_user_id)
  WHERE auth_provider IS NOT NULL AND provider_user_id IS NOT NULL;

UPDATE users
SET profile_complete = true
WHERE role = 'student'
  AND profile_complete = false
  AND (institution_id IS NOT NULL OR COALESCE(TRIM(institution), '') <> '')
  AND COALESCE(TRIM(program), '') <> ''
  AND COALESCE(TRIM(level), '') <> '';

WITH latest_active_sub AS (
  SELECT DISTINCT ON (user_id) user_id, plan_id
  FROM user_subscriptions
  WHERE status = 'active'
  ORDER BY user_id, created_at DESC
)
UPDATE users u
SET selected_plan_id = las.plan_id,
    plan_status = 'active'
FROM latest_active_sub las
WHERE u.id = las.user_id
  AND (u.selected_plan_id IS NULL OR u.plan_status = 'none');

UPDATE users
SET onboarding_step = CASE
  WHEN profile_complete = false THEN 'PROFILE'
  WHEN password_set = false THEN 'PASSWORD'
  WHEN selected_plan_id IS NULL THEN 'PLAN'
  WHEN plan_status = 'pending_payment' THEN 'PAYMENT'
  ELSE 'DONE'
END;
