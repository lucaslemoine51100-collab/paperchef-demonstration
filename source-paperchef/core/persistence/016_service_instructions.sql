BEGIN;
ALTER TABLE catering.services ADD COLUMN service_instructions text NOT NULL DEFAULT '';
INSERT INTO catering.schema_migrations(version) VALUES('016');
COMMIT;
