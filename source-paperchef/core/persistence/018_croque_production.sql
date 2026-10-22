BEGIN;
ALTER TABLE catering.production_units ADD COLUMN units_per_batch bigint NOT NULL DEFAULT 1 CHECK(units_per_batch > 0);
INSERT INTO catering.production_units(id,name,unit_type,capacity_portions,rounding_strategy,subunit_quantity,subunit_name,subunit_unit,units_per_batch)
VALUES('production-croque','Croque entier','pièces',2,'ceil',2,'Triangles','pièces',3);
INSERT INTO catering.schema_migrations(version) VALUES('018');
COMMIT;
