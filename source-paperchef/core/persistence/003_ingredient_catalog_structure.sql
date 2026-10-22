BEGIN;
ALTER TABLE catering.ingredients DROP CONSTRAINT ingredients_allergen_status_check;
ALTER TABLE catering.ingredients ALTER COLUMN allergen_status SET DEFAULT 'review_required';
UPDATE catering.ingredients i SET allergen_status=CASE WHEN i.allergen_status='unreviewed' THEN 'review_required'
 WHEN EXISTS (SELECT 1 FROM catering.ingredient_allergens ia WHERE ia.ingredient_id=i.id) THEN 'known' ELSE 'none' END;
ALTER TABLE catering.ingredients ADD CONSTRAINT ingredients_allergen_status_check CHECK (allergen_status IN ('known','none','review_required'));
ALTER TABLE catering.ingredients ADD COLUMN superseded_by_id text REFERENCES catering.ingredients(id) ON DELETE RESTRICT;
ALTER TABLE catering.ingredients ADD CONSTRAINT ingredients_retired_alias_check CHECK (superseded_by_id IS NULL OR (NOT active AND superseded_by_id <> id));
CREATE FUNCTION catering.ingredient_name_key(input text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT lower(normalize(btrim(regexp_replace(replace(replace(replace(input,chr(160),' '),'’',''''),'‘',''''),'[[:space:]]+',' ','g')),NFC))
$$;
ALTER TABLE catering.ingredients ADD COLUMN normalized_key text GENERATED ALWAYS AS (catering.ingredient_name_key(normalized_name)) STORED;
ALTER TABLE catering.ingredients ADD CONSTRAINT ingredients_nonempty_name_check CHECK (length(normalized_key)>0);
CREATE TABLE catering.ingredient_aliases (
 alias_key text PRIMARY KEY, alias_name text NOT NULL,
 ingredient_id text NOT NULL REFERENCES catering.ingredients(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (alias_key=catering.ingredient_name_key(alias_name))
);
-- Doublons orthographiques : conservation de chaque identifiant et de ses données historiques.
DO $$ DECLARE key_row record; duplicate_row record; target_id text; BEGIN
 FOR key_row IN SELECT normalized_key FROM catering.ingredients WHERE active GROUP BY normalized_key HAVING count(*)>1 LOOP
  SELECT id INTO target_id FROM catering.ingredients WHERE active AND normalized_key=key_row.normalized_key ORDER BY created_at,id LIMIT 1;
  FOR duplicate_row IN SELECT id FROM catering.ingredients WHERE active AND normalized_key=key_row.normalized_key AND id<>target_id LOOP
   UPDATE catering.recipe_ingredients SET ingredient_id=target_id WHERE ingredient_id=duplicate_row.id;
   UPDATE catering.rule_profiles SET ingredient_id=target_id WHERE ingredient_id=duplicate_row.id;
   INSERT INTO catering.ingredient_allergens(ingredient_id,allergen_id) SELECT target_id,allergen_id FROM catering.ingredient_allergens WHERE ingredient_id=duplicate_row.id ON CONFLICT DO NOTHING;
   UPDATE catering.ingredients SET active=false,superseded_by_id=target_id WHERE id=duplicate_row.id;
  END LOOP;
  UPDATE catering.ingredients SET allergen_status='review_required' WHERE id=target_id;
 END LOOP;
END $$;
CREATE UNIQUE INDEX ingredients_active_normalized_key_unique ON catering.ingredients(normalized_key) WHERE active;
CREATE INDEX ingredients_superseded_idx ON catering.ingredients(superseded_by_id);
CREATE INDEX ingredient_aliases_ingredient_idx ON catering.ingredient_aliases(ingredient_id);

CREATE FUNCTION catering.validate_ingredient_catalog() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS (SELECT 1 FROM catering.ingredients i WHERE
  (i.allergen_status='none' AND EXISTS (SELECT 1 FROM catering.ingredient_allergens ia WHERE ia.ingredient_id=i.id))
  OR (i.allergen_status='known' AND NOT EXISTS (SELECT 1 FROM catering.ingredient_allergens ia WHERE ia.ingredient_id=i.id))) THEN
  RAISE EXCEPTION 'Statut allergène incompatible avec les relations ingrédient/allergène'; END IF;
 IF EXISTS (SELECT 1 FROM catering.ingredient_aliases a JOIN catering.ingredients i ON i.id=a.ingredient_id WHERE NOT i.active OR i.superseded_by_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Alias sans ingrédient canonique actif'; END IF;
 IF EXISTS (SELECT 1 FROM catering.ingredient_aliases a JOIN catering.ingredients i ON i.normalized_key=a.alias_key
   WHERE i.active AND i.id<>a.ingredient_id) THEN RAISE EXCEPTION 'Alias en conflit avec un autre ingrédient actif'; END IF;
 IF EXISTS (SELECT 1 FROM catering.ingredients i JOIN catering.ingredients target ON target.id=i.superseded_by_id
   WHERE NOT target.active OR target.superseded_by_id IS NOT NULL) THEN
  RAISE EXCEPTION 'Chaîne de remplacement ou ingrédient cible inactif'; END IF;
 RETURN NULL; END $$;
CREATE CONSTRAINT TRIGGER validate_ingredient_catalog AFTER INSERT OR UPDATE OR DELETE ON catering.ingredients
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION catering.validate_ingredient_catalog();
CREATE CONSTRAINT TRIGGER validate_ingredient_catalog AFTER INSERT OR UPDATE OR DELETE ON catering.ingredient_allergens
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION catering.validate_ingredient_catalog();
CREATE CONSTRAINT TRIGGER validate_ingredient_catalog AFTER INSERT OR UPDATE OR DELETE ON catering.ingredient_aliases
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION catering.validate_ingredient_catalog();
INSERT INTO catering.schema_migrations(version) VALUES ('003');
COMMIT;
