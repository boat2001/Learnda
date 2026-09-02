-- Enforce unique student index numbers when provided

CREATE UNIQUE INDEX IF NOT EXISTS users_index_number_unique_idx
  ON users (index_number)
  WHERE index_number IS NOT NULL AND btrim(index_number) <> '';
