BEGIN;
ALTER TABLE catering.shared_preparation_allocations DROP CONSTRAINT shared_preparation_allocations_allocation_mode_check;
ALTER TABLE catering.shared_preparation_allocations ADD COLUMN reference_component_portions bigint CHECK(reference_component_portions>0);
ALTER TABLE catering.shared_preparation_allocations ADD CHECK ((allocation_mode='fixed_ratio' AND reference_component_portions IS NULL) OR (allocation_mode='component_portions' AND reference_component_portions IS NOT NULL));
UPDATE catering.shared_preparation_allocations a SET allocation_mode='component_portions',reference_component_portions=r.reference_portions FROM catering.components c JOIN catering.recipes r ON r.id=c.recipe_id WHERE a.component_id=c.id AND r.reference_portions IS NOT NULL;
CREATE OR REPLACE FUNCTION catering.validate_relations() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS (SELECT 1 FROM catering.shared_preparation_allocations a JOIN catering.shared_preparations p ON p.id=a.shared_preparation_id
 JOIN catering.recipes r ON r.id=p.recipe_id WHERE r.yield_value IS NULL OR a.unit IS DISTINCT FROM r.yield_unit
 OR a.reference_quantity*a.ratio_denominator <> r.yield_value*a.ratio_numerator) THEN
 RAISE EXCEPTION 'Allocation incompatible avec le rendement de référence'; END IF;
 IF EXISTS (SELECT 1 FROM catering.shared_preparations p JOIN catering.recipes r ON r.id=p.recipe_id
 LEFT JOIN catering.shared_preparation_allocations a ON a.shared_preparation_id=p.id
 GROUP BY p.id,r.yield_value,r.scale_mode,r.reference_headcount,p.reference_headcount
 HAVING r.scale_mode <> 'shared_preparation' OR r.reference_headcount <> p.reference_headcount
 OR (count(a.id) FILTER (WHERE a.allocation_mode='component_portions')=0 AND coalesce(sum(a.reference_quantity),0) <> r.yield_value) OR count(a.id)=0 OR (count(a.id) FILTER (WHERE a.allocation_mode='component_portions') NOT IN (0,count(a.id)))) THEN
 RAISE EXCEPTION 'Préparation commune sans allocation complète ou base incohérente'; END IF;
 IF EXISTS (SELECT 1 FROM catering.component_preparation_inputs i JOIN catering.shared_preparation_allocations a ON a.id=i.allocation_id
 WHERE i.component_id <> a.component_id) THEN RAISE EXCEPTION 'Prélèvement lié au mauvais composant'; END IF;
 IF EXISTS (SELECT 1 FROM catering.service_rule_bindings b JOIN catering.rule_profiles p ON p.id=b.profile_id
 WHERE b.rule_type <> p.rule_type OR p.priority <> CASE b.role WHEN 'generic' THEN 3 WHEN 'profile' THEN 2 ELSE 2 END
 OR (b.role='sauce' AND p.rule_type <> 'sauceRule')) THEN RAISE EXCEPTION 'Liaison de profil incohérente'; END IF;
 IF EXISTS (SELECT 1 FROM catering.recipe_rule_overrides o JOIN catering.rule_profiles p ON p.id=o.profile_id
 WHERE o.rule_type <> p.rule_type OR p.priority <> 1) THEN RAISE EXCEPTION 'Surcharge de recette incohérente'; END IF;
 IF EXISTS (SELECT 1 FROM catering.components c JOIN catering.recipes r ON r.id=c.recipe_id
 WHERE (r.scale_mode='by_production_unit' AND c.production_unit_id IS NULL) OR r.scale_mode='shared_preparation') THEN
 RAISE EXCEPTION 'Recette incompatible avec le composant ou unité de production manquante'; END IF;
 IF EXISTS (SELECT 1 FROM catering.component_preparation_inputs i JOIN catering.components c ON c.id=i.component_id
 JOIN catering.recipe_ingredients ri ON ri.recipe_id=c.recipe_id AND ri.sort_order=i.sort_order) THEN
 RAISE EXCEPTION 'Ordre de prélèvement en conflit avec un ingrédient'; END IF;
 IF EXISTS (SELECT 1 FROM catering.components c WHERE
 (c.generic_rule_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM catering.service_rule_bindings b WHERE b.service_id=c.service_id AND b.role='generic' AND b.rule_key=c.generic_rule_key))
 OR (c.profile_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM catering.service_rule_bindings b WHERE b.service_id=c.service_id AND b.role='profile' AND b.rule_key=c.profile_key))
 OR (c.service_sauce_key IS NOT NULL AND NOT EXISTS (SELECT 1 FROM catering.service_rule_bindings b WHERE b.service_id=c.service_id AND b.role='sauce' AND b.rule_key=c.service_sauce_key))) THEN
 RAISE EXCEPTION 'Clé de règle explicite introuvable'; END IF;
 RETURN NULL; END $$;

INSERT INTO catering.schema_migrations(version) VALUES('013');
COMMIT;
