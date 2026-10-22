BEGIN;
ALTER TABLE catering.ingredients ADD COLUMN purchase_unit catering.quantity_unit;
UPDATE catering.ingredients SET purchase_unit=CASE default_unit WHEN 'g' THEN 'kg' WHEN 'ml' THEN 'L' WHEN 'unités' THEN 'pièces' ELSE default_unit END;
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE catering.ingredients ALTER COLUMN purchase_unit SET NOT NULL;
ALTER TABLE catering.ingredients ADD CONSTRAINT purchase_unit_canonical_check CHECK(purchase_unit IN ('kg','L','pièces','portions','bacs','plaques'));
CREATE TABLE catering.purchase_unit_conversions (
 ingredient_id text NOT NULL REFERENCES catering.ingredients(id) ON DELETE RESTRICT,
 source_unit catering.quantity_unit NOT NULL,
 purchase_unit catering.quantity_unit NOT NULL,
 ratio catering.positive_decimal NOT NULL,
 convention text NOT NULL,
 PRIMARY KEY(ingredient_id,source_unit),CHECK(source_unit<>purchase_unit)
);
INSERT INTO catering.purchase_unit_conversions(ingredient_id,source_unit,purchase_unit,ratio,convention)
 SELECT id,'kg','L',1,'Convention métier V1 : 1 kg culinaire = 1 L achat ; approximation propre à cette référence, non densité physique universelle.'
 FROM catering.ingredients WHERE active AND id IN ('ingredient-53','ingredient-23');
UPDATE catering.ingredients SET purchase_unit='L' WHERE id IN ('ingredient-53','ingredient-23');
INSERT INTO catering.schema_migrations(version) VALUES('006');
COMMIT;

