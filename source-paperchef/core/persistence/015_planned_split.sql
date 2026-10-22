BEGIN;
ALTER TABLE catering.planned_services ADD COLUMN meat_percent integer NOT NULL DEFAULT 70 CHECK(meat_percent IN (30,50,70));
INSERT INTO catering.schema_migrations(version) VALUES('015');
COMMIT;
