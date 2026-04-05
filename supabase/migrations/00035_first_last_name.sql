-- Add first_name and last_name columns
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Populate from existing full_name (split on first space)
UPDATE candidates
SET first_name = split_part(full_name, ' ', 1),
    last_name = CASE
      WHEN position(' ' in full_name) > 0
      THEN substring(full_name from position(' ' in full_name) + 1)
      ELSE ''
    END
WHERE first_name IS NULL AND full_name IS NOT NULL;

-- Update display_name to use first_name + last initial
UPDATE candidates
SET display_name = first_name || ' ' || left(last_name, 1) || '.'
WHERE first_name IS NOT NULL AND last_name IS NOT NULL AND last_name != '';
