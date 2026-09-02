-- Tracks course page presence for "studying now" and "have studied" style metrics.
CREATE TABLE IF NOT EXISTS course_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  actor_key VARCHAR(160) NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT course_visits_course_actor_unique UNIQUE (course_id, actor_key)
);

CREATE INDEX IF NOT EXISTS course_visits_course_last_seen_idx
  ON course_visits (course_id, last_seen_at DESC);
