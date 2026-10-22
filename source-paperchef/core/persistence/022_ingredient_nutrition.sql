BEGIN;
ALTER TABLE catering.ingredients ADD COLUMN IF NOT EXISTS nutrition_per_100g jsonb;
INSERT INTO catering.schema_migrations(version) VALUES('022') ON CONFLICT DO NOTHING;
COMMIT;
