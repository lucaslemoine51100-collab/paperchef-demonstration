BEGIN;
SET search_path TO catering,public;
INSERT INTO production_units(id,name,unit_type,capacity_portions,rounding_strategy,units_per_batch)
VALUES('production-whole-chicken','Poulet entier · 4 quartiers','pièces',4,'ceil',1);
INSERT INTO schema_migrations(version) VALUES('020');
COMMIT;
