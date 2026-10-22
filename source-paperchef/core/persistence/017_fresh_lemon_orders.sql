BEGIN;
ALTER TABLE catering.purchase_conversions ADD COLUMN ratio_numerator bigint CHECK(ratio_numerator>0);
ALTER TABLE catering.purchase_conversions ADD COLUMN ratio_denominator bigint CHECK(ratio_denominator>0);
ALTER TABLE catering.purchase_conversions ADD CONSTRAINT exact_ratio_pair CHECK((ratio_numerator IS NULL)=(ratio_denominator IS NULL));
INSERT INTO catering.ingredients(id,normalized_name,default_unit,purchase_unit,purchase_category,allergen_status,purchase_required)
VALUES ('culinary-fresh-lemon-juice','Jus de citron frais','L','L','FreshProduce','none',false),
('purchase-fresh-lemons-press','Citrons frais à presser','pièces','pièces','FreshProduce','none',true);
INSERT INTO catering.purchase_conversions(source_ingredient_id,purchase_ingredient_id,ratio,source_unit,purchase_unit,ratio_numerator,ratio_denominator)
VALUES('culinary-fresh-lemon-juice','purchase-fresh-lemons-press',1,'ml','pièces',7,300);
INSERT INTO catering.schema_migrations(version) VALUES('017');
COMMIT;
