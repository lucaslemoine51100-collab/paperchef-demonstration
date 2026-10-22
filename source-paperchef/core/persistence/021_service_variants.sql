BEGIN;
ALTER TABLE catering.planned_services ADD COLUMN IF NOT EXISTS variant_snapshot jsonb;
INSERT INTO catering.schema_migrations(version) VALUES('021') ON CONFLICT DO NOTHING;
COMMIT;
