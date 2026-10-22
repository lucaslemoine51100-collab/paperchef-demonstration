BEGIN;
UPDATE catering.rule_profiles SET value=0.15 WHERE rule_type='portionQuantity' AND config_json->>'name'='Salade verte' AND unit='kg' AND basis='covers' AND basis_count=1;
UPDATE catering.recipes SET notes=replace(notes::text,'50 g','150 g')::jsonb WHERE name='Salade verte';
INSERT INTO catering.schema_migrations(version) VALUES('014');
COMMIT;
