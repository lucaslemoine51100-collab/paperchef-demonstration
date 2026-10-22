BEGIN;
ALTER TABLE catering.ingredients ADD COLUMN purchase_required boolean NOT NULL DEFAULT true;
CREATE TABLE catering.purchase_conversions (
 source_ingredient_id text PRIMARY KEY REFERENCES catering.ingredients(id) ON DELETE RESTRICT,
 purchase_ingredient_id text NOT NULL REFERENCES catering.ingredients(id) ON DELETE RESTRICT,
 ratio catering.positive_decimal NOT NULL,
 source_unit catering.quantity_unit NOT NULL,
 purchase_unit catering.quantity_unit NOT NULL,
 display_small_unit catering.quantity_unit,
 display_threshold catering.positive_decimal,
 CHECK(source_ingredient_id<>purchase_ingredient_id),
 CHECK(source_unit<>'QS' AND purchase_unit<>'QS'),
 CHECK((display_small_unit IS NULL)=(display_threshold IS NULL))
);
-- Références corrigées sans changer leurs identifiants.
DO $$ DECLARE old_name text; new_name text; row_id text; BEGIN
 FOR old_name,new_name IN VALUES ('Frites crues sous vide/surgelées nature','Frites crues sous vide'),('Thym','Thym sec'),('Laurier','Laurier sec') LOOP
  SELECT id INTO STRICT row_id FROM catering.ingredients WHERE normalized_name=old_name AND active;
  UPDATE catering.ingredients SET normalized_name=new_name,updated_at=now() WHERE id=row_id;
  INSERT INTO catering.ingredient_aliases(alias_key,alias_name,ingredient_id) VALUES(catering.ingredient_name_key(old_name),old_name,row_id) ON CONFLICT(alias_key) DO UPDATE SET ingredient_id=excluded.ingredient_id;
  UPDATE catering.recipe_ingredients SET display_name=new_name WHERE ingredient_id=row_id;
 END LOOP;
END $$;
UPDATE catering.ingredients SET purchase_category='FreshProduce' WHERE normalized_name='Frites crues sous vide';
UPDATE catering.ingredients SET purchase_category='Grocery' WHERE normalized_name IN ('Thon au naturel','Thon égoutté');
-- Substitutions explicites équivalentes : les quantités et unités culinaires sont inchangées.
DO $$ DECLARE old_name text; new_name text; old_id text; target_id text; BEGIN
 FOR old_name,new_name IN VALUES ('Brunoise de légumes','Brunoise carotte/oignon/céleri'),('Légumes couscous','Légumes couscous surgelés'),('Épinards','Épinards surgelés'),('Œufs','Œufs entiers liquides'),('Bouillon de légumes ou eau','Bouillon de légumes préparé') LOOP
  SELECT id INTO STRICT old_id FROM catering.ingredients WHERE normalized_name=old_name AND active;
  SELECT id INTO STRICT target_id FROM catering.ingredients WHERE normalized_name=new_name AND active;
  UPDATE catering.recipe_ingredients SET ingredient_id=target_id,display_name=new_name WHERE ingredient_id=old_id;
  UPDATE catering.rule_profiles SET ingredient_id=target_id,config_json=CASE WHEN config_json ? 'name' THEN jsonb_set(config_json,'{name}',to_jsonb(new_name)) ELSE config_json END WHERE ingredient_id=old_id;
  UPDATE catering.ingredient_aliases SET ingredient_id=target_id WHERE ingredient_id=old_id;
  INSERT INTO catering.ingredient_aliases(alias_key,alias_name,ingredient_id) VALUES(catering.ingredient_name_key(old_name),old_name,target_id) ON CONFLICT(alias_key) DO UPDATE SET ingredient_id=excluded.ingredient_id;
  UPDATE catering.ingredients SET active=false,superseded_by_id=target_id,updated_at=now() WHERE id=old_id;
 END LOOP;
END $$;
-- Besoins culinaires conservés ; produits réellement achetés et dosages explicites.
DO $$ DECLARE kind text; source_id text; target_id text; BEGIN
 FOREACH kind IN ARRAY ARRAY['légumes','bœuf','volaille'] LOOP
  SELECT id INTO STRICT source_id FROM catering.ingredients WHERE normalized_name='Bouillon de '||kind||' préparé' AND active;
  target_id := 'purchase-bouillon-'||CASE kind WHEN 'légumes' THEN 'vegetables' WHEN 'bœuf' THEN 'beef' ELSE 'poultry' END||'-powder';
  INSERT INTO catering.ingredients(id,normalized_name,default_unit,purchase_category,allergen_status,active)
   VALUES(target_id,'Bouillon de '||kind||' en poudre','kg','Grocery','review_required',true);
  INSERT INTO catering.ingredient_allergens(ingredient_id,allergen_id) SELECT target_id,allergen_id FROM catering.ingredient_allergens WHERE ingredient_id=source_id;
  INSERT INTO catering.purchase_conversions VALUES(source_id,target_id,0.020,'L','kg','g',1);
 END LOOP;
END $$;
UPDATE catering.ingredients SET purchase_required=false WHERE normalized_name IN ('Eau','Bouillon de légumes préparé','Bouillon de bœuf préparé','Bouillon de volaille préparé');
INSERT INTO catering.schema_migrations(version) VALUES('005');
COMMIT;
