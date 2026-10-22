BEGIN;
-- Valeurs par défaut du plat : uniquement des références aux profils déjà validés.
CREATE TABLE catering.dish_rule_bindings (
 dish_id text NOT NULL REFERENCES catering.dishes(id), rule_key text NOT NULL,
 role text NOT NULL CHECK(role IN('generic','profile','sauce')), rule_type text NOT NULL,
 profile_id text NOT NULL REFERENCES catering.rule_profiles(id), PRIMARY KEY(dish_id,role,rule_key,rule_type)
);
INSERT INTO catering.dish_rule_bindings
 SELECT d.id,b.rule_key,b.role,b.rule_type,b.profile_id FROM catering.dishes d
 JOIN LATERAL(SELECT * FROM catering.components WHERE recipe_id=d.recipe_id ORDER BY service_id,sort_order LIMIT 1)c ON true
 JOIN catering.service_rule_bindings b ON b.service_id=c.service_id
 WHERE (b.role='generic' AND b.rule_key=d.configuration->>'generic_rule_key')
 OR(b.role='profile' AND b.rule_key=d.configuration->>'profile_key')
 OR(b.role='sauce' AND b.rule_key=d.configuration->>'service_sauce_key');
INSERT INTO catering.schema_migrations(version) VALUES('011');
COMMIT;
