BEGIN;
-- services contient déjà le catalogue complet : pas de seconde table de recettes.
CREATE VIEW catering.service_templates AS
 SELECT id,name,reference_headcount,portion_mode,all_group FROM catering.services;
ALTER TABLE catering.weeks ADD CONSTRAINT week_seven_days CHECK(extract(isodow FROM start_date)=1 AND end_date=start_date+6);
CREATE TABLE catering.planned_services (
 id text PRIMARY KEY,
 week_id text NOT NULL REFERENCES catering.weeks(id) ON DELETE RESTRICT,
 service_date date NOT NULL,
 meal_period text NOT NULL CHECK(meal_period IN ('lunch','dinner')),
 service_template_id text NOT NULL REFERENCES catering.services(id) ON DELETE RESTRICT,
 cover_count bigint NOT NULL CHECK(cover_count BETWEEN 1 AND 9007199254740991),
 state text NOT NULL DEFAULT 'planned' CHECK(state IN ('planned','served')),
 frozen_snapshot jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(week_id,service_date,meal_period),
 UNIQUE(service_date,meal_period),
 CHECK((state='planned' AND frozen_snapshot IS NULL) OR
       (state='served' AND frozen_snapshot IS NOT NULL AND jsonb_typeof(frozen_snapshot)='object'))
);
CREATE INDEX planned_services_cycle_idx ON catering.planned_services(meal_period,service_date DESC);
CREATE FUNCTION catering.validate_planned_service() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE w catering.weeks%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.state='served' THEN RAISE EXCEPTION 'Occurrence servie immuable'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.state='served' THEN RAISE EXCEPTION 'Occurrence servie immuable'; END IF;
 SELECT * INTO w FROM catering.weeks WHERE id=NEW.week_id;
 IF w.id IS NULL OR extract(isodow FROM w.start_date)<>1 OR w.end_date<>w.start_date+6
  OR NEW.service_date NOT BETWEEN w.start_date AND w.end_date THEN
  RAISE EXCEPTION 'Occurrence hors semaine lundi-dimanche';
 END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER validate_planned_service BEFORE INSERT OR UPDATE OR DELETE ON catering.planned_services
 FOR EACH ROW EXECUTE FUNCTION catering.validate_planned_service();
CREATE FUNCTION catering.validate_planned_week() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM catering.planned_services p WHERE p.week_id=NEW.id)
 AND (NEW.start_date<>OLD.start_date OR NEW.end_date<>OLD.end_date) THEN
  RAISE EXCEPTION 'Dates de semaine occupée immuables';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER validate_planned_week BEFORE UPDATE ON catering.weeks FOR EACH ROW EXECUTE FUNCTION catering.validate_planned_week();
-- Préserver les affectations héritées, sans en inventer pour les services non datés.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM catering.services WHERE (service_date IS NULL)<>(meal_type IS NULL)
  OR (week_id IS NOT NULL AND service_date IS NULL)) THEN
  RAISE EXCEPTION 'Affectation héritée incomplète : corriger explicitement avant migration';
 END IF;
END $$;
INSERT INTO catering.weeks(id,name,start_date,end_date)
 SELECT DISTINCT 'legacy-week-'||(service_date-(extract(isodow FROM service_date)::int-1))::text,
 'Semaine héritée',service_date-(extract(isodow FROM service_date)::int-1),service_date-(extract(isodow FROM service_date)::int-1)+6
 FROM catering.services WHERE service_date IS NOT NULL AND meal_type IS NOT NULL AND week_id IS NULL;
INSERT INTO catering.planned_services(id,week_id,service_date,meal_period,service_template_id,cover_count)
 SELECT 'legacy-planned-'||id,coalesce(week_id,'legacy-week-'||(service_date-(extract(isodow FROM service_date)::int-1))::text),service_date,meal_type,id,headcount
 FROM catering.services WHERE service_date IS NOT NULL AND meal_type IS NOT NULL;
-- Les colonnes historiques restent pour compatibilité V0 ; les nouvelles API ne les utilisent pas.
UPDATE catering.services SET week_id=NULL,service_date=NULL,meal_type=NULL;
ALTER TABLE catering.components ADD COLUMN menu_visible boolean NOT NULL DEFAULT true;
CREATE TABLE catering.component_menu_contributions (
 source_component_id text NOT NULL REFERENCES catering.components(id) ON DELETE RESTRICT,
 target_component_id text NOT NULL REFERENCES catering.components(id) ON DELETE RESTRICT,
 PRIMARY KEY(source_component_id,target_component_id), CHECK(source_component_id<>target_component_id)
);
-- La finition est une contribution interne aux deux lasagnes, sans déplacer ses quantités.
UPDATE catering.components SET menu_visible=false WHERE service_id='lasagnes' AND domain_key='grana-finition';
INSERT INTO catering.component_menu_contributions(source_component_id,target_component_id)
 SELECT s.id,t.id FROM catering.components s JOIN catering.components t ON t.service_id=s.service_id
 WHERE s.service_id='lasagnes' AND s.domain_key='grana-finition' AND t.domain_key IN ('lasagnes-bolo','lasagnes-saumon');
-- Structure préparée, aucune règle ni aucun seuil réglementaire prérempli.
CREATE TABLE catering.regulation_rule_sets(id text PRIMARY KEY,label text NOT NULL);
CREATE TABLE catering.regulation_rules(id text PRIMARY KEY,rule_set_id text NOT NULL REFERENCES catering.regulation_rule_sets(id),code text NOT NULL,label text NOT NULL,UNIQUE(rule_set_id,code));
CREATE TABLE catering.rule_versions(
 id text PRIMARY KEY,rule_id text NOT NULL REFERENCES catering.regulation_rules(id),version integer NOT NULL CHECK(version>0),
 meal_period_scope text NOT NULL CHECK(meal_period_scope IN ('lunch','dinner','both')),
 window_size integer NOT NULL DEFAULT 20 CHECK(window_size>0),
 min_frequency integer CHECK(min_frequency>=0),max_frequency integer CHECK(max_frequency>=0),
 condition jsonb NOT NULL CHECK(jsonb_typeof(condition)='object'),valid_from date NOT NULL,valid_to date,
 UNIQUE(rule_id,version),CHECK(valid_to IS NULL OR valid_to>=valid_from),
 CHECK(min_frequency IS NULL OR max_frequency IS NULL OR min_frequency<=max_frequency),
 CHECK(min_frequency IS NULL OR min_frequency<=window_size),CHECK(max_frequency IS NULL OR max_frequency<=window_size)
);
INSERT INTO catering.schema_migrations(version) VALUES('007');
COMMIT;

