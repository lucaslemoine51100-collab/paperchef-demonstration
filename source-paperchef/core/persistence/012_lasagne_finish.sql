BEGIN;
UPDATE catering.component_preparation_inputs SET sort_order=sort_order+1
WHERE component_id IN (SELECT id FROM catering.components WHERE recipe_id IN ('lasagnes:recipe:lasagnes-bolo','lasagnes:recipe:lasagnes-saumon'))
AND EXISTS(SELECT 1 FROM catering.components WHERE recipe_id='lasagnes:recipe:grana-finition');
-- La finition appartient aux recettes, à 5 g par portion réelle (hors béchamel).
INSERT INTO catering.recipe_ingredients(id,recipe_id,ingredient_id,display_name,quantity,unit,is_qs,quantity_basis,sort_order)
SELECT r.id||':grana-finition',r.id,i.ingredient_id,i.display_name,
 i.quantity*r.reference_portions/100,i.unit,false,'reference_recipe',
 (SELECT coalesce(max(sort_order),-1)+1 FROM catering.recipe_ingredients WHERE recipe_id=r.id)
FROM catering.recipes r CROSS JOIN catering.recipe_ingredients i
WHERE r.id IN ('lasagnes:recipe:lasagnes-bolo','lasagnes:recipe:lasagnes-saumon')
 AND i.recipe_id='lasagnes:recipe:grana-finition' AND NOT i.is_qs;
DELETE FROM catering.component_menu_contributions WHERE source_component_id IN
 (SELECT id FROM catering.components WHERE recipe_id='lasagnes:recipe:grana-finition');
DELETE FROM catering.component_categories WHERE component_id IN
 (SELECT id FROM catering.components WHERE recipe_id='lasagnes:recipe:grana-finition');
DELETE FROM catering.components WHERE recipe_id='lasagnes:recipe:grana-finition';
-- Archivage réversible : conserver les anciennes révisions et les snapshots servis.
UPDATE catering.dishes SET active=false,version=version+1 WHERE recipe_id='lasagnes:recipe:grana-finition';
INSERT INTO catering.schema_migrations(version) VALUES('012');
COMMIT;
