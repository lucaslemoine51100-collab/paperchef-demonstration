const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {ingredientKey}=require('./normalize-ingredient');
const general=require('./ingredients-v1.json');
const aliases={
 'Beurre doux':['Beurre'], 'Farine de blé':['Farine'], 'Semoule de blé':['Semoule crue'],
 'Sel fin':['Sel'], 'Poivre noir':['Poivre'], 'Oignons frais':['Oignons'], 'Carottes fraîches':['Carottes'],
 'Échalotes fraîches':['Échalotes'], 'Limande meunière surgelée':['Limande meunière'],
 'Frites crues sous vide/surgelées nature':['Frites crues sous vide'], 'Bouillon de bœuf préparé':['Bouillon de bœuf']
};
const extra=(name,unit,category,status,allergens=[],otherNames=[])=>({normalized_name:name,default_unit:unit,purchase_category:category,allergen_status:status,allergens,active:true,aliases:otherNames});
// Produits génériques déjà utilisés : ne pas inventer leur variante ou composition.
const retained=[extra('Eau','L','Grocery','none',[],['Eau chaude en cours de cuisson','Eau (si besoin pour détendre)']),
 extra('Huile','L','Grocery','review_required'),extra('Bouillon de légumes ou eau','L','Grocery','review_required'),
 extra('Légumes couscous','kg','FreshProduce','review_required'),extra('Légumes','kg','FreshProduce','review_required'),
 extra('Brunoise de légumes','kg','FreshProduce','review_required'),extra('Saumon','kg','Fish','known',['fish']),
 extra('Épinards','kg','FreshProduce','none'),extra('Lait','L','Dairy','known',['milk']),extra('Œufs','kg','Dairy','known',['eggs'])];
const catalog=[...general.map(i=>({...i,aliases:aliases[i.normalized_name]||[]})),...retained];
const keys=new Set(),aliasKeys=new Set();
for(const item of catalog) {
 const key=ingredientKey(item.normalized_name);
 if(keys.has(key))throw new Error('Doublon de catalogue : '+item.normalized_name);keys.add(key);
 if(!['known','none','review_required'].includes(item.allergen_status))throw new Error('Statut invalide');
 if((item.allergen_status==='known'&&!item.allergens.length)||(item.allergen_status==='none'&&item.allergens.length))throw new Error('Allergènes incohérents');
 for(const name of [item.normalized_name,...item.aliases]){const k=ingredientKey(name);if(aliasKeys.has(k))throw new Error('Alias ambigu : '+name);aliasKeys.add(k);}
}
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const sqlRows=catalog.map(i=>{
 const id='ingredient-v1-'+createHash('sha256').update(ingredientKey(i.normalized_name)).digest('hex').slice(0,16);
 return `(${[id,i.normalized_name,i.default_unit,i.purchase_category,i.allergen_status,JSON.stringify(i.allergens),JSON.stringify([i.normalized_name,...i.aliases])].map(q).join(',')})`;
});
const sql=`-- Catalogue V1 : ${general.length} entrées demandées + ${retained.length} ingrédients génériques conservés.
-- Import idempotent des noms ; IDs existants privilégiés. Les anciennes lignes ne sont jamais supprimées.
BEGIN;
CREATE TEMP TABLE incoming_ingredients (id text,name text,unit text,category text,status text,allergens jsonb,aliases jsonb) ON COMMIT DROP;
INSERT INTO incoming_ingredients VALUES
${sqlRows.join(',\n')};
DO $$ DECLARE item record; duplicate_row record; target_id text; incoming_alias_name text; existing_alias text; allergen_code text; BEGIN
 FOR item IN SELECT * FROM incoming_ingredients LOOP
  -- Préférer l’ID portant déjà le nom canonique, puis un alias actif existant.
  SELECT i.id INTO target_id FROM catering.ingredients i WHERE i.active AND
    i.normalized_key IN (SELECT catering.ingredient_name_key(value) FROM jsonb_array_elements_text(item.aliases))
    ORDER BY (i.normalized_key=catering.ingredient_name_key(item.name)) DESC,i.created_at,i.id LIMIT 1;
  IF target_id IS NULL THEN
   target_id=item.id;
   INSERT INTO catering.ingredients(id,normalized_name,default_unit,purchase_category,allergen_status,rounding_profile_id)
    VALUES(target_id,item.name,item.unit,item.category,'review_required','v0-display');
  END IF;
  FOR duplicate_row IN SELECT i.id FROM catering.ingredients i WHERE i.active AND i.id<>target_id AND
    i.normalized_key IN (SELECT catering.ingredient_name_key(value) FROM jsonb_array_elements_text(item.aliases)) LOOP
   UPDATE catering.recipe_ingredients SET ingredient_id=target_id WHERE ingredient_id=duplicate_row.id;
   UPDATE catering.rule_profiles SET ingredient_id=target_id WHERE ingredient_id=duplicate_row.id;
   INSERT INTO catering.ingredient_allergens(ingredient_id,allergen_id) SELECT target_id,allergen_id FROM catering.ingredient_allergens WHERE ingredient_id=duplicate_row.id ON CONFLICT DO NOTHING;
   UPDATE catering.ingredient_aliases SET ingredient_id=target_id WHERE ingredient_id=duplicate_row.id;
   UPDATE catering.ingredients SET superseded_by_id=target_id WHERE superseded_by_id=duplicate_row.id;
   UPDATE catering.ingredients SET active=false,superseded_by_id=target_id WHERE id=duplicate_row.id;
  END LOOP;
  UPDATE catering.ingredients SET normalized_name=item.name,default_unit=item.unit,purchase_category=item.category,
    allergen_status=item.status,rounding_profile_id=coalesce(rounding_profile_id,'v0-display'),active=true WHERE id=target_id;
  FOR allergen_code IN SELECT value FROM jsonb_array_elements_text(item.allergens) LOOP
   IF NOT EXISTS(SELECT 1 FROM catering.allergens a WHERE a.code=allergen_code) THEN RAISE EXCEPTION 'Allergène inconnu : %',allergen_code; END IF;
   INSERT INTO catering.ingredient_allergens(ingredient_id,allergen_id) SELECT target_id,a.id FROM catering.allergens a WHERE a.code=allergen_code ON CONFLICT DO NOTHING;
  END LOOP;
  FOR incoming_alias_name IN SELECT value FROM jsonb_array_elements_text(item.aliases) LOOP
   SELECT ingredient_id INTO existing_alias FROM catering.ingredient_aliases WHERE alias_key=catering.ingredient_name_key(incoming_alias_name);
   IF existing_alias IS NOT NULL AND existing_alias<>target_id THEN RAISE EXCEPTION 'Alias ambigu : %',incoming_alias_name; END IF;
   INSERT INTO catering.ingredient_aliases(alias_key,alias_name,ingredient_id) VALUES(catering.ingredient_name_key(incoming_alias_name),incoming_alias_name,target_id) ON CONFLICT DO NOTHING;
  END LOOP;
 END LOOP;
END $$;
INSERT INTO catering.schema_migrations(version) VALUES ('004') ON CONFLICT DO NOTHING;
COMMIT;
`;
if(require.main===module){fs.writeFileSync(path.join(__dirname,'004_general_ingredients.sql'),sql);console.log(JSON.stringify({general:general.length,retained:retained.length,total:catalog.length}));}
module.exports={sql,catalog};

