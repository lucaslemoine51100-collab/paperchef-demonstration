BEGIN;
SET search_path TO catering,public;
INSERT INTO production_units(id,name,unit_type,capacity_portions,rounding_strategy,units_per_batch)
VALUES('production-pizza','Plaque pizza · 8 parts','plaques',8,'ceil',1);
INSERT INTO schema_migrations(version) VALUES('019');
COMMIT;
