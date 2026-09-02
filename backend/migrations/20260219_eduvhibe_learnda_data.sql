CREATE TABLE IF NOT EXISTS eduvhibe_cgpa_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  semester INTEGER NOT NULL,
  course_name VARCHAR(255) NOT NULL,
  credits INTEGER NOT NULL,
  grade VARCHAR(10) NOT NULL,
  grade_points NUMERIC(4, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS eduvhibe_cgpa_entries_user_semester_idx
  ON eduvhibe_cgpa_entries (user_id, semester, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'eduvhibe_cgpa_entries_semester_check'
  ) THEN
    ALTER TABLE eduvhibe_cgpa_entries
      ADD CONSTRAINT eduvhibe_cgpa_entries_semester_check
      CHECK (semester BETWEEN 1 AND 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'eduvhibe_cgpa_entries_credits_check'
  ) THEN
    ALTER TABLE eduvhibe_cgpa_entries
      ADD CONSTRAINT eduvhibe_cgpa_entries_credits_check
      CHECK (credits BETWEEN 1 AND 12);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'eduvhibe_cgpa_entries_grade_points_check'
  ) THEN
    ALTER TABLE eduvhibe_cgpa_entries
      ADD CONSTRAINT eduvhibe_cgpa_entries_grade_points_check
      CHECK (grade_points >= 0 AND grade_points <= 4);
  END IF;
END $$;
