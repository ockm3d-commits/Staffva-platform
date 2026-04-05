-- Add outcome category and tiered pricing to service_packages
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS outcome_category TEXT;
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS tier_1_label TEXT;
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS tier_1_price NUMERIC(10,2);
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS tier_1_deliverables TEXT[];
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS tier_2_label TEXT;
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS tier_2_price NUMERIC(10,2);
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS tier_2_deliverables TEXT[];
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS tier_3_label TEXT;
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS tier_3_price NUMERIC(10,2);
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS tier_3_deliverables TEXT[];

CREATE INDEX IF NOT EXISTS idx_service_packages_outcome ON service_packages(outcome_category);
