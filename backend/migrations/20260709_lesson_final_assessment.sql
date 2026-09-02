-- Reserve deeper typed/theory questions exclusively for the end-of-lesson
-- final test, separate from per-chunk exercises (which are being converted to
-- 100% objective select-based questions). See:
--   backend/src/scripts/convert_exercises_to_objective.js
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS final_assessment JSONB NOT NULL DEFAULT '[]';
