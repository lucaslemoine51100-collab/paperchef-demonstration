BEGIN;
-- Le plat possède une recette unique. Le composant existant devient son occurrence dans un service.
CREATE TABLE catering.dishes (
 id text PRIMARY KEY, recipe_id text NOT NULL UNIQUE REFERENCES catering.recipes(id),
 name text NOT NULL CHECK(length(trim(name))>0), active boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 configuration jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE catering.dish_categories (
 dish_id text NOT NULL REFERENCES catering.dishes(id), category text NOT NULL,
 subcategory text, sort_order integer NOT NULL CHECK(sort_order>=0), PRIMARY KEY(dish_id,sort_order),
 CHECK((category='Protein' AND subcategory IN ('Meat','Fish','Vegetarian')) OR
       (category IN ('Starch','Vegetable','Sauce') AND subcategory IS NULL))
);
CREATE TABLE catering.dish_revisions (
 dish_id text NOT NULL REFERENCES catering.dishes(id), version integer NOT NULL,
 snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(dish_id,version)
);
ALTER TABLE catering.components ADD COLUMN dish_id text REFERENCES catering.dishes(id);
CREATE INDEX components_dish_idx ON catering.components(dish_id);
INSERT INTO catering.dishes(id,recipe_id,name,configuration)
 SELECT 'dish:'||c.recipe_id,c.recipe_id,c.name,
 jsonb_build_object('portion_group',c.portion_group,'production_unit_id',c.production_unit_id,
 'rule_profile_id',c.rule_profile_id,'generic_rule_key',c.generic_rule_key,'profile_key',c.profile_key,
 'service_sauce_key',c.service_sauce_key,'classification_tags',c.classification_tags)
 FROM (SELECT DISTINCT ON(recipe_id) * FROM catering.components WHERE recipe_id IS NOT NULL ORDER BY recipe_id,service_id,sort_order) c;
INSERT INTO catering.dish_categories
 SELECT d.id,cc.category,cc.subcategory,cc.sort_order FROM catering.dishes d
 JOIN LATERAL(SELECT id FROM catering.components WHERE recipe_id=d.recipe_id ORDER BY service_id,sort_order LIMIT 1)c ON true
 JOIN catering.component_categories cc ON cc.component_id=c.id;
UPDATE catering.components c SET dish_id=d.id FROM catering.dishes d WHERE d.recipe_id=c.recipe_id;
INSERT INTO catering.schema_migrations(version) VALUES('010');
COMMIT;
