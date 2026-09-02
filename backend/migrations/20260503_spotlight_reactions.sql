CREATE TABLE IF NOT EXISTS spotlight_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  award_id VARCHAR(160) NOT NULL,
  award_type VARCHAR(40) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(40) NOT NULL DEFAULT 'celebrate',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS spotlight_reactions_award_action_idx
  ON spotlight_reactions (award_id, action);

CREATE INDEX IF NOT EXISTS spotlight_reactions_target_type_idx
  ON spotlight_reactions (target_user_id, award_type);

CREATE UNIQUE INDEX IF NOT EXISTS spotlight_reactions_award_user_action_unique
  ON spotlight_reactions (award_id, user_id, action);
