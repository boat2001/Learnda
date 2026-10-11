-- Learnda K-12 education structure: learning units.
-- See learnda-dev-guide.md §2 (class levels), §3 (learning types), §4 (curriculum).
--
-- A learning unit is one teachable thing at a level group: a KG Learning Area
-- or a Primary/JHS/SHS Subject. Content (topics, lessons, practice sets) hangs
-- off a unit and pins its own class_level_code -- that is what §5 filters on.
--
-- Enum type names follow Sequelize's `enum_<table>_<column>` convention so that
-- this migration and `sequelize.sync()` converge on the same schema.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_learning_units_level_group') THEN
    CREATE TYPE enum_learning_units_level_group AS ENUM
      ('KINDERGARTEN', 'PRIMARY', 'JHS', 'SHS');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_learning_units_learning_type') THEN
    CREATE TYPE enum_learning_units_learning_type AS ENUM
      ('LEARNING_AREA', 'SUBJECT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_learning_units_category') THEN
    CREATE TYPE enum_learning_units_category AS ENUM
      ('CORE', 'ELECTIVE', 'INTERVENTION', 'PATHWAY_CORE', 'ADDITIONAL');
  END IF;

  -- Class level codes are Basic 1-6 (B1-B6); P1-P6 are banned (§1.1).
  -- Members are listed in the §2.3 UI / progression order.
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_learning_units_from_class') THEN
    CREATE TYPE enum_learning_units_from_class AS ENUM
      ('KG1', 'KG2', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
       'JHS1', 'JHS2', 'JHS3', 'SHS1', 'SHS2', 'SHS3');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_learning_units_to_class') THEN
    CREATE TYPE enum_learning_units_to_class AS ENUM
      ('KG1', 'KG2', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6',
       'JHS1', 'JHS2', 'JHS3', 'SHS1', 'SHS2', 'SHS3');
  END IF;
END $$;

-- Progression ordinal for a class level. Takes TEXT so it works against every
-- class-level enum column (from_class, to_class, and content.class_level_code).
-- Ordering must match the §2.3 UI order exactly: access checks compare these
-- values and nothing else. Returns NULL for unknown codes, which makes the
-- band constraints below fail closed.
CREATE OR REPLACE FUNCTION class_level_ordinal(code TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE code
    WHEN 'KG1'  THEN 0  WHEN 'KG2'  THEN 1
    WHEN 'B1'   THEN 2  WHEN 'B2'   THEN 3  WHEN 'B3'   THEN 4
    WHEN 'B4'   THEN 5  WHEN 'B5'   THEN 6  WHEN 'B6'   THEN 7
    WHEN 'JHS1' THEN 8  WHEN 'JHS2' THEN 9  WHEN 'JHS3' THEN 10
    WHEN 'SHS1' THEN 11 WHEN 'SHS2' THEN 12 WHEN 'SHS3' THEN 13
  END;
$$;

-- Level group a class level belongs to, so the band constraint is enforced in
-- the database rather than trusting the application layer.
CREATE OR REPLACE FUNCTION class_level_group(code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN code IN ('KG1', 'KG2') THEN 'KINDERGARTEN'
    WHEN code IN ('B1', 'B2', 'B3', 'B4', 'B5', 'B6') THEN 'PRIMARY'
    WHEN code IN ('JHS1', 'JHS2', 'JHS3') THEN 'JHS'
    WHEN code IN ('SHS1', 'SHS2', 'SHS3') THEN 'SHS'
  END;
$$;

CREATE TABLE IF NOT EXISTS learning_units (
  id            UUID PRIMARY KEY,
  slug          VARCHAR(120) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  learning_type enum_learning_units_learning_type NOT NULL,
  level_group   enum_learning_units_level_group   NOT NULL,
  from_class    enum_learning_units_from_class    NOT NULL,
  to_class      enum_learning_units_to_class      NOT NULL,
  category      enum_learning_units_category NOT NULL DEFAULT 'CORE',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  description   TEXT NULL,
  icon          VARCHAR(120) NULL,
  color         VARCHAR(20) NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Slugs are unique per level group, not globally: "english" is a distinct unit
-- in PRIMARY, JHS and SHS, and "rme" exists in all four groups.
CREATE UNIQUE INDEX IF NOT EXISTS learning_units_slug_level_group_uidx
  ON learning_units (slug, level_group);

CREATE INDEX IF NOT EXISTS learning_units_level_group_idx
  ON learning_units (level_group, is_active);

CREATE INDEX IF NOT EXISTS learning_units_class_band_idx
  ON learning_units (from_class, to_class);

CREATE INDEX IF NOT EXISTS learning_units_category_idx
  ON learning_units (category);

DO $$
BEGIN
  -- The band must run forwards.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learning_units_band_ordered_check') THEN
    ALTER TABLE learning_units
      ADD CONSTRAINT learning_units_band_ordered_check
      CHECK (class_level_ordinal(from_class::TEXT) <= class_level_ordinal(to_class::TEXT));
  END IF;

  -- §1.5: a unit must not span outside its own level group, or content would
  -- become reachable below the level it belongs to.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learning_units_band_in_group_check') THEN
    ALTER TABLE learning_units
      ADD CONSTRAINT learning_units_band_in_group_check
      CHECK (class_level_group(from_class::TEXT) = level_group::TEXT
         AND class_level_group(to_class::TEXT)   = level_group::TEXT);
  END IF;

  -- §3.1: Kindergarten teaches Learning Areas; every other group teaches Subjects.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'learning_units_type_matches_group_check') THEN
    ALTER TABLE learning_units
      ADD CONSTRAINT learning_units_type_matches_group_check
      CHECK (
        (level_group  = 'KINDERGARTEN' AND learning_type = 'LEARNING_AREA') OR
        (level_group <> 'KINDERGARTEN' AND learning_type = 'SUBJECT')
      );
  END IF;
END $$;
