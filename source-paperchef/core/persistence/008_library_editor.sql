BEGIN;
ALTER TABLE catering.services ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE catering.services ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
-- Alias structuré du stockage existant : une seule source, compatibilité des documents.
ALTER TABLE catering.recipes ADD COLUMN preparation_steps jsonb GENERATED ALWAYS AS (steps) STORED;
CREATE TABLE catering.service_template_revisions (
 service_id text NOT NULL REFERENCES catering.services(id),version integer NOT NULL,
 snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(service_id,version)
);
CREATE OR REPLACE VIEW catering.service_templates AS SELECT id,name,reference_headcount,portion_mode,all_group,active,version FROM catering.services;
CREATE FUNCTION catering.check_active_template() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (TG_OP='INSERT' OR NEW.service_template_id IS DISTINCT FROM OLD.service_template_id) AND EXISTS(SELECT 1 FROM catering.services WHERE id=NEW.service_template_id AND NOT active) THEN
 RAISE EXCEPTION 'Service type inactif'; END IF; RETURN NEW; END $$;
CREATE TRIGGER check_active_template BEFORE INSERT OR UPDATE ON catering.planned_services FOR EACH ROW EXECUTE FUNCTION catering.check_active_template();
INSERT INTO catering.schema_migrations(version) VALUES('008');
COMMIT;
