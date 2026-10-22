BEGIN;
ALTER TABLE catering.recipes ADD COLUMN production_references jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(production_references)='array');
-- Les lignes liées ne stockent aucune quantité : lecture de la recette par unité existante.
UPDATE catering.recipes r SET production_references=jsonb_build_array(jsonb_build_object(
 'type','per_production_unit','label','PAR PLAQUE','base_quantity','1','base_unit','plaques','production_unit_id','production-2','sort_order',0,
 'ratios',(SELECT jsonb_agg(jsonb_build_object('source','recipe','ingredient_id',i.ingredient_id,'unit',CASE WHEN i.unit='kg' THEN 'g' WHEN i.is_qs THEN 'QS' ELSE i.unit END,'label',CASE WHEN i.ingredient_id='ingredient-56' THEN 'Œufs entiers liquides' ELSE i.display_name END) ORDER BY i.sort_order) FROM catering.recipe_ingredients i WHERE i.recipe_id=r.id)))
WHERE r.id IN ('quiches:recipe:quiche-lard','quiches:recipe:quiche-thon');
UPDATE catering.recipes SET production_references='[{"type":"per_production_unit","label":"1 GN 1/1","base_quantity":"1","base_unit":"bacs","production_unit_id":"production-1","sort_order":0,"ratios":[{"source":"production_subunit","label":"Feuilles de lasagne","unit":"unités"}]}]'::jsonb
WHERE id IN ('lasagnes:recipe:lasagnes-bolo','lasagnes:recipe:lasagnes-saumon');
UPDATE catering.recipes SET production_references='[{"type":"per_base_quantity","label":"POUR 1 KG DE SEMOULE","base_quantity":"1","base_unit":"kg","base_ingredient_id":"ingredient-29","sort_order":0,"ratios":[{"source":"recipe","ingredient_id":"ingredient-30","unit":"L"},{"source":"recipe","ingredient_id":"ingredient-14","unit":"g"},{"source":"recipe","ingredient_id":"ingredient-31","unit":"ml"}]}]'::jsonb
WHERE id='couscous-vegetarien:recipe:semoule';
INSERT INTO catering.schema_migrations(version) VALUES('009');
COMMIT;
