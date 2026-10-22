BEGIN;
CREATE SCHEMA catering;
SET LOCAL search_path = catering, public;
CREATE TABLE schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE DOMAIN positive_decimal AS numeric CHECK (VALUE > 0 AND VALUE <> 'NaN'::numeric AND VALUE <> 'Infinity'::numeric);
CREATE DOMAIN nonnegative_decimal AS numeric CHECK (VALUE >= 0 AND VALUE <> 'NaN'::numeric AND VALUE <> 'Infinity'::numeric);
CREATE DOMAIN integer_decimal AS numeric CHECK (VALUE >= 0 AND VALUE = trunc(VALUE) AND VALUE <> 'NaN'::numeric AND VALUE <> 'Infinity'::numeric);
CREATE DOMAIN quantity_unit AS text CHECK (VALUE IN ('kg','L','g','ml','unités','pièces','portions','bacs','plaques','QS'));

CREATE TABLE weeks (
 id text PRIMARY KEY, name text NOT NULL CHECK (length(trim(name)) > 0), start_date date NOT NULL, end_date date NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','validated','archived')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK (end_date >= start_date)
);
CREATE TABLE rounding_profiles (
 id text PRIMARY KEY, name text NOT NULL UNIQUE, kg_step positive_decimal NOT NULL, l_step positive_decimal NOT NULL,
 g_step positive_decimal NOT NULL, ml_step positive_decimal NOT NULL, piece_strategy text NOT NULL CHECK (piece_strategy = 'integer'),
 half_strategy text NOT NULL DEFAULT 'half_up' CHECK (half_strategy = 'half_up'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE services (
 id text PRIMARY KEY, week_id text REFERENCES weeks(id) ON DELETE RESTRICT, name text NOT NULL,
 service_date date, meal_type text CHECK (meal_type IN ('lunch','dinner')),
 headcount bigint NOT NULL CHECK (headcount > 0 AND headcount <= 9007199254740991),
 reference_headcount bigint NOT NULL DEFAULT 100 CHECK (reference_headcount > 0 AND reference_headcount <= 9007199254740991),
 portion_mode text NOT NULL CHECK (portion_mode IN ('split','all')),
 split_primary_ratio numeric, split_secondary_ratio numeric, tie_break_target text,
 primary_group text, secondary_group text, all_group text,
 rounding_profile_id text NOT NULL REFERENCES rounding_profiles(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((portion_mode = 'split' AND split_primary_ratio IS NOT NULL AND split_secondary_ratio IS NOT NULL
   AND split_primary_ratio BETWEEN 0 AND 1 AND split_secondary_ratio BETWEEN 0 AND 1
   AND split_primary_ratio + split_secondary_ratio = 1
   AND primary_group IS NOT NULL AND secondary_group IS NOT NULL AND primary_group IN ('meat','fish') AND secondary_group IN ('meat','fish') AND primary_group <> secondary_group
   AND tie_break_target IS NOT NULL AND tie_break_target IN (primary_group, secondary_group) AND all_group IS NULL)
 OR (portion_mode = 'all' AND all_group IS NOT NULL AND all_group = 'vegetarian' AND primary_group IS NULL AND secondary_group IS NULL
   AND split_primary_ratio IS NULL AND split_secondary_ratio IS NULL AND tie_break_target IS NULL))
);
CREATE TABLE ingredients (
 id text PRIMARY KEY, normalized_name text NOT NULL, default_unit quantity_unit NOT NULL,
 purchase_category text NOT NULL CHECK (purchase_category IN ('Meat','Fish','Frozen','FreshProduce','Dairy','Grocery')),
 packaging jsonb, rounding_profile_id text REFERENCES rounding_profiles(id) ON DELETE RESTRICT,
 active boolean NOT NULL DEFAULT true, allergen_status text NOT NULL DEFAULT 'unreviewed' CHECK (allergen_status IN ('unreviewed','reviewed')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (normalized_name), CHECK (packaging IS NULL OR jsonb_typeof(packaging) = 'object')
);
CREATE TABLE allergens (id text PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL UNIQUE, sort_order integer NOT NULL UNIQUE CHECK (sort_order > 0));
CREATE TABLE ingredient_allergens (
 ingredient_id text NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
 allergen_id text NOT NULL REFERENCES allergens(id) ON DELETE RESTRICT, PRIMARY KEY (ingredient_id,allergen_id)
);
CREATE TABLE production_units (
 id text PRIMARY KEY, name text NOT NULL, unit_type quantity_unit NOT NULL CHECK (unit_type IN ('bacs','plaques','pièces')),
 capacity_portions bigint NOT NULL CHECK (capacity_portions > 0 AND capacity_portions <= 9007199254740991),
 rounding_strategy text NOT NULL CHECK (rounding_strategy = 'ceil'),
 subunit_quantity bigint CHECK (subunit_quantity >= 0 AND subunit_quantity <= 9007199254740991), subunit_name text, subunit_unit quantity_unit,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((subunit_quantity IS NULL AND subunit_name IS NULL AND subunit_unit IS NULL) OR
   (subunit_quantity IS NOT NULL AND subunit_name IS NOT NULL AND subunit_unit IS NOT NULL AND subunit_unit <> 'QS'))
);
CREATE TABLE recipes (
 id text PRIMARY KEY, name text NOT NULL, reference_portions bigint, reference_headcount bigint, reference_production_units bigint,
 scale_mode text NOT NULL CHECK (scale_mode IN ('by_portions','by_headcount','by_production_unit','shared_preparation')),
 yield_value nonnegative_decimal, yield_unit quantity_unit, rounding_profile_id text REFERENCES rounding_profiles(id) ON DELETE RESTRICT,
 notes jsonb NOT NULL DEFAULT '[]', steps jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (reference_portions IS NULL OR reference_portions BETWEEN 1 AND 9007199254740991),
 CHECK (reference_headcount IS NULL OR reference_headcount BETWEEN 1 AND 9007199254740991),
 CHECK (reference_production_units IS NULL OR reference_production_units BETWEEN 1 AND 9007199254740991),
 CHECK ((scale_mode='by_portions' AND reference_portions IS NOT NULL AND reference_headcount IS NULL AND reference_production_units IS NULL)
 OR (scale_mode IN ('by_headcount','shared_preparation') AND reference_headcount IS NOT NULL AND reference_portions IS NULL AND reference_production_units IS NULL)
 OR (scale_mode='by_production_unit' AND reference_production_units IS NOT NULL AND reference_portions IS NULL AND reference_headcount IS NULL)),
 CHECK ((yield_value IS NULL AND yield_unit IS NULL) OR (yield_value IS NOT NULL AND yield_unit IS NOT NULL AND yield_unit <> 'QS')),
 CHECK (jsonb_typeof(notes)='array' AND jsonb_typeof(steps)='array')
);
CREATE TABLE rule_profiles (
 id text PRIMARY KEY, name text NOT NULL, rule_type text NOT NULL CHECK (rule_type IN ('portionQuantity','targetYield','production','ingredientBasis','sauceRule')),
 value nonnegative_decimal, unit quantity_unit, basis text CHECK (basis IN ('covers','meat','fish','vegetarian','productionUnits')),
 basis_count bigint CHECK (basis_count BETWEEN 1 AND 9007199254740991), priority smallint NOT NULL CHECK (priority IN (1,2,3)),
 production_unit_id text REFERENCES production_units(id) ON DELETE RESTRICT,
 ingredient_id text REFERENCES ingredients(id) ON DELETE RESTRICT, config_json jsonb NOT NULL DEFAULT '{}',
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (jsonb_typeof(config_json)='object'),
 CHECK ((rule_type IN ('portionQuantity','targetYield','sauceRule') AND value IS NOT NULL AND unit IS NOT NULL AND unit <> 'QS' AND basis IS NOT NULL AND basis_count IS NOT NULL AND production_unit_id IS NULL)
 OR (rule_type='production' AND production_unit_id IS NOT NULL AND value IS NULL AND unit IS NULL AND basis IS NULL AND basis_count IS NULL)
 OR (rule_type='ingredientBasis' AND production_unit_id IS NULL AND value IS NULL AND unit IS NULL AND basis IS NULL AND basis_count IS NULL
   AND config_json ? 'ingredientBasis' AND config_json->>'ingredientBasis' IN ('portions','productionUnits'))),
 CHECK (rule_type <> 'portionQuantity' OR ingredient_id IS NOT NULL)
);
CREATE TABLE components (
 id text PRIMARY KEY, service_id text NOT NULL REFERENCES services(id) ON DELETE RESTRICT, domain_key text NOT NULL, name text NOT NULL,
 recipe_id text REFERENCES recipes(id) ON DELETE RESTRICT, portion_group text NOT NULL CHECK (portion_group IN ('meat','fish','vegetarian','all')),
 production_unit_id text REFERENCES production_units(id) ON DELETE RESTRICT, rule_profile_id text REFERENCES rule_profiles(id) ON DELETE RESTRICT,
 generic_rule_key text, profile_key text, linked_component_id text,
 service_sauce_key text, classification_tags jsonb NOT NULL DEFAULT '[]', sort_order integer NOT NULL CHECK (sort_order >= 0), active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (service_id,domain_key), UNIQUE (id,service_id), UNIQUE (service_id,sort_order),
 FOREIGN KEY (linked_component_id,service_id) REFERENCES components(id,service_id) ON DELETE RESTRICT,
 CHECK (jsonb_typeof(classification_tags)='array')
);
CREATE TABLE component_categories (
 component_id text NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
 category text NOT NULL CHECK (category IN ('Protein','Starch','Vegetable','Sauce')),
 subcategory text, sort_order integer NOT NULL CHECK (sort_order >= 0),
 PRIMARY KEY (component_id,sort_order),
 CHECK ((category='Protein' AND subcategory IS NOT NULL AND subcategory IN ('Meat','Fish','Vegetarian')) OR (category <> 'Protein' AND subcategory IS NULL))
);
CREATE UNIQUE INDEX component_category_unique ON component_categories(component_id,category,coalesce(subcategory,''));
CREATE TABLE recipe_ingredients (
 id text PRIMARY KEY, recipe_id text NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
 ingredient_id text NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT, display_name text NOT NULL,
 quantity nonnegative_decimal, unit quantity_unit NOT NULL, is_qs boolean NOT NULL,
 quantity_basis text CHECK (quantity_basis IN ('reference_recipe','production_unit')), sort_order integer NOT NULL CHECK (sort_order >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (recipe_id,sort_order),
 CHECK ((is_qs AND quantity IS NULL AND unit='QS') OR (NOT is_qs AND quantity IS NOT NULL AND unit <> 'QS'))
);
CREATE TABLE shared_preparations (
 id text PRIMARY KEY, service_id text NOT NULL REFERENCES services(id) ON DELETE RESTRICT, domain_key text NOT NULL,
 recipe_id text NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT, reference_headcount bigint NOT NULL CHECK (reference_headcount BETWEEN 1 AND 9007199254740991),
 sort_order integer NOT NULL CHECK (sort_order >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (id,service_id), UNIQUE (service_id,domain_key), UNIQUE (service_id,sort_order)
);
CREATE TABLE shared_preparation_allocations (
 id text PRIMARY KEY, service_id text NOT NULL, shared_preparation_id text NOT NULL, component_id text NOT NULL,
 ratio_numerator integer_decimal NOT NULL, ratio_denominator positive_decimal NOT NULL CHECK (ratio_denominator=trunc(ratio_denominator)),
 allocation_mode text NOT NULL CHECK (allocation_mode='fixed_ratio'),
 reference_quantity nonnegative_decimal NOT NULL, unit quantity_unit NOT NULL CHECK (unit <> 'QS'),
 sort_order integer NOT NULL CHECK (sort_order >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (shared_preparation_id,service_id) REFERENCES shared_preparations(id,service_id) ON DELETE RESTRICT,
 FOREIGN KEY (component_id,service_id) REFERENCES components(id,service_id) ON DELETE RESTRICT,
 UNIQUE (shared_preparation_id,component_id), UNIQUE (shared_preparation_id,sort_order), CHECK (ratio_numerator <= ratio_denominator)
);
-- Liens de prélèvement séparés des ingrédients achetés : aucun faux ingrédient béchamel.
CREATE TABLE component_preparation_inputs (
 component_id text NOT NULL REFERENCES components(id) ON DELETE RESTRICT,
 allocation_id text NOT NULL REFERENCES shared_preparation_allocations(id) ON DELETE RESTRICT,
 display_name text NOT NULL, sort_order integer NOT NULL CHECK (sort_order >= 0), PRIMARY KEY (component_id,allocation_id), UNIQUE(component_id,sort_order)
);
-- Plusieurs règles peuvent composer un même profil ; aucune déduction via la catégorie.
CREATE TABLE service_rule_bindings (
 service_id text NOT NULL REFERENCES services(id) ON DELETE RESTRICT, rule_key text NOT NULL,
 role text NOT NULL CHECK (role IN ('generic','profile','sauce')),
 rule_type text NOT NULL, profile_id text NOT NULL REFERENCES rule_profiles(id) ON DELETE RESTRICT,
 PRIMARY KEY (service_id,role,rule_key,rule_type)
);
CREATE TABLE recipe_rule_overrides (
 recipe_id text NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT, rule_type text NOT NULL,
 profile_id text NOT NULL REFERENCES rule_profiles(id) ON DELETE RESTRICT, PRIMARY KEY (recipe_id,rule_type)
);
CREATE INDEX components_service_idx ON components(service_id);
CREATE INDEX recipe_ingredients_ingredient_idx ON recipe_ingredients(ingredient_id);
CREATE INDEX ingredient_allergens_allergen_idx ON ingredient_allergens(allergen_id);
CREATE INDEX services_week_idx ON services(week_id);
CREATE INDEX preparations_service_idx ON shared_preparations(service_id);

CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
DO $$ DECLARE table_name text; BEGIN
 FOR table_name IN SELECT c.table_name FROM information_schema.columns c WHERE c.table_schema='catering' AND c.column_name='updated_at'
 LOOP EXECUTE format('CREATE TRIGGER touch_updated_at BEFORE UPDATE ON catering.%I FOR EACH ROW EXECUTE FUNCTION catering.touch_updated_at()',table_name); END LOOP;
END $$;

-- Contrôles inter-tables différés : toutes les lignes d'un import peuvent être insérées en transaction.
CREATE FUNCTION validate_relations() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF EXISTS (SELECT 1 FROM catering.shared_preparation_allocations a JOIN catering.shared_preparations p ON p.id=a.shared_preparation_id
 JOIN catering.recipes r ON r.id=p.recipe_id WHERE r.yield_value IS NULL OR a.unit IS DISTINCT FROM r.yield_unit
 OR a.reference_quantity*a.ratio_denominator <> r.yield_value*a.ratio_numerator) THEN
 RAISE EXCEPTION 'Allocation incompatible avec le rendement de référence'; END IF;
 IF EXISTS (SELECT 1 FROM catering.shared_preparations p JOIN catering.recipes r ON r.id=p.recipe_id
 LEFT JOIN catering.shared_preparation_allocations a ON a.shared_preparation_id=p.id
 GROUP BY p.id,r.yield_value,r.scale_mode,r.reference_headcount,p.reference_headcount
 HAVING r.scale_mode <> 'shared_preparation' OR r.reference_headcount <> p.reference_headcount
 OR coalesce(sum(a.reference_quantity),0) <> r.yield_value OR count(a.id)=0) THEN
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
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['shared_preparations','shared_preparation_allocations','recipes','components','recipe_ingredients','component_preparation_inputs','service_rule_bindings','recipe_rule_overrides','rule_profiles']
 LOOP EXECUTE format('CREATE CONSTRAINT TRIGGER validate_relations AFTER INSERT OR UPDATE OR DELETE ON catering.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION catering.validate_relations()',table_name); END LOOP;
END $$;

CREATE VIEW recipe_allergens AS SELECT DISTINCT ri.recipe_id,ia.allergen_id
 FROM recipe_ingredients ri JOIN ingredient_allergens ia ON ia.ingredient_id=ri.ingredient_id
 UNION SELECT o.recipe_id,ia.allergen_id FROM recipe_rule_overrides o JOIN rule_profiles p ON p.id=o.profile_id
 JOIN ingredient_allergens ia ON ia.ingredient_id=p.ingredient_id WHERE p.rule_type='portionQuantity';
CREATE VIEW component_allergens AS
 SELECT c.id AS component_id, a.allergen_id FROM components c JOIN recipe_allergens a ON a.recipe_id=c.recipe_id
 UNION SELECT i.component_id,a.allergen_id FROM component_preparation_inputs i
 JOIN shared_preparation_allocations sa ON sa.id=i.allocation_id JOIN shared_preparations p ON p.id=sa.shared_preparation_id
 JOIN recipe_allergens a ON a.recipe_id=p.recipe_id
 UNION SELECT c.id,ia.allergen_id FROM components c JOIN LATERAL (
   SELECT p.ingredient_id FROM rule_profiles p WHERE p.rule_type='portionQuantity' AND
   (p.id IN (SELECT o.profile_id FROM recipe_rule_overrides o WHERE o.recipe_id=c.recipe_id AND o.rule_type='portionQuantity')
    OR p.id IN (SELECT b.profile_id FROM service_rule_bindings b WHERE b.service_id=c.service_id AND b.rule_type='portionQuantity'
      AND ((b.role='profile' AND b.rule_key=c.profile_key) OR (b.role='generic' AND b.rule_key=c.generic_rule_key))))
   ORDER BY p.priority LIMIT 1
 ) effective ON true JOIN ingredient_allergens ia ON ia.ingredient_id=effective.ingredient_id;
CREATE VIEW service_allergens AS SELECT DISTINCT c.service_id,a.allergen_id FROM components c
 JOIN component_allergens a ON a.component_id=c.id WHERE c.active;
INSERT INTO schema_migrations(version) VALUES ('001');
COMMIT;
