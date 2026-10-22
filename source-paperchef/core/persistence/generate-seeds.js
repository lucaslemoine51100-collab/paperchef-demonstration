// Import contrôlé des références V0 : aucun calcul métier et aucune valeur d’affichage.
const fs = require('node:fs');
const path = require('node:path');
const catalog = require('../services');
const { resolveRules } = require('../engine');
const quote = value => value === null || value === undefined ? 'NULL' : typeof value === 'boolean' ? String(value) :
  "'" + (typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'", "''") + "'";
const rows = [];
function insert(table, row) {
  rows.push(`INSERT INTO catering.${table} (${Object.keys(row).join(',')}) VALUES (${Object.values(row).map(quote).join(',')});`);
}
const allergenList = [
 ['gluten','Céréales contenant du gluten'],['crustaceans','Crustacés'],['eggs','Œufs'],['fish','Poissons'],
 ['peanuts','Arachides'],['soy','Soja'],['milk','Lait'],['nuts','Fruits à coque'],['celery','Céleri'],
 ['mustard','Moutarde'],['sesame','Graines de sésame'],['sulphites','Anhydride sulfureux et sulfites'],['lupin','Lupin'],['molluscs','Mollusques']
];
insert('rounding_profiles',{ id:'v0-display', name:'Affichage V0', kg_step:'0.1',l_step:'0.1',g_step:'10',ml_step:'10',piece_strategy:'integer' });
allergenList.forEach(([code,name],i) => insert('allergens',{ id:code,code,name,sort_order:i+1 }));
const ingredientIds = new Map();
function ingredientId(name, unit) {
  const normalized = name.replace(/ \((béchamel|garniture|sauce)\)$/u,'').replace(/ de finition$/u,'');
  if (ingredientIds.has(normalized)) return ingredientIds.get(normalized);
  // Identités historiques conservées malgré le déplacement de la finition dans les recettes.
  const historical = {'Grana Padano':45,Saumon:43,'Épinards':44};
  const id = `ingredient-${historical[normalized] || ingredientIds.size+1}`;
  ingredientIds.set(normalized,id);
  // Classement initial de seed, à valider avec le catalogue réel des produits.
  let category = 'Grocery';
  if (/Bœuf|Lardons/.test(normalized)) category='Meat';
  else if (/Saumon|Thon/.test(normalized)) category='Fish';
  else if (/surgel|Limande|Frites|Merguez/.test(normalized)) category='Frozen';
  else if (/Beurre|Crème|Lait|Emmental|Grana|Œufs/.test(normalized)) category='Dairy';
  else if (/Carottes|Oignons|Salade|Échalotes|Ail|Brunoise|Épinards|Légumes couscous/.test(normalized)) category='FreshProduce';
  const defaultUnit=unit==='QS' ? (/Eau/.test(name) ? 'ml' : 'g') : unit;
  insert('ingredients',{id,normalized_name:normalized,default_unit:defaultUnit,purchase_category:category});
  // Seuls allergènes explicitement déclarés dans la V0 ; les autres produits restent non revus.
  if (normalized==='Limande meunière') for(const code of ['fish','gluten']) insert('ingredient_allergens',{ingredient_id:id,allergen_id:code});
  return id;
}
const productionIds = new Map();
function productionId(rule) {
  const key=JSON.stringify(rule);
  if(productionIds.has(key)) return productionIds.get(key);
  const id=`production-${productionIds.size+1}`;
  productionIds.set(key,id);
  insert('production_units',{id,name:rule.name,unit_type:rule.unit,capacity_portions:rule.portionsPerUnit,rounding_strategy:rule.rounding||'ceil',
    subunit_quantity:rule.itemsPerUnit,subunit_name:rule.itemName,subunit_unit:rule.itemUnit});
  return id;
}
function addRule(id,type,rule,priority,scope,base) {
  const row={id,name:id,rule_type:type,priority,config_json:{}};
  if(type==='production') row.production_unit_id=productionId(rule);
  else if(type==='ingredientBasis') row.config_json={ingredientBasis:rule};
  else {
    row.value=rule.quantity; row.unit=rule.unit; row.basis=scope; row.basis_count=rule.basePortions||base||1;
    if(type==='portionQuantity') {row.ingredient_id=ingredientId(rule.name,rule.unit);row.config_json={name:rule.name};}
  }
  insert('rule_profiles',row);
}
for(const service of Object.values(catalog)) {
  const mode=service.portionMode;
  const complement=v=>{const [x,y='']=v.split('.');const scale=10n**BigInt(y.length);const n=scale-BigInt(x+y);return y.length?`${n/scale}.${String(n%scale).padStart(y.length,'0')}`:String(n);};
  insert('services',{id:service.id,name:service.name,headcount:100,reference_headcount:service.baseCovers,portion_mode:mode.type,
    split_primary_ratio:mode.type==='split'?complement(mode.ratio):null,split_secondary_ratio:mode.type==='split'?mode.ratio:null,
    primary_group:mode.complementGroup,secondary_group:mode.roundedGroup,tie_break_target:mode.roundedGroup,all_group:mode.group,rounding_profile_id:'v0-display'});
  const bindingIds = new Map();
  for(const [role,dictionary] of [['generic',service.genericRules||{}],['profile',service.profiles||{}],['sauce',service.sauceRules||{}]]) {
    for(const [key,bundle] of Object.entries(dictionary)) {
      for(const [type,rule] of role==='sauce' ? [['sauceRule',bundle]] : Object.entries(bundle)) {
        const id=`${service.id}:rule:${role}:${key}:${type}`;
        addRule(id,type,rule,role==='generic'?3:2,rule.scope||'covers',rule.basePortions);
        insert('service_rule_bindings',{service_id:service.id,rule_key:key,role,rule_type:type,profile_id:id});
        if(!bindingIds.has(`${role}:${key}`)) bindingIds.set(`${role}:${key}`,id);
      }
    }
  }
  const recipeId = key => `${service.id}:recipe:${key}`;
  const componentId = key => `${service.id}:component:${key}`;
  const preparationId = key => `${service.id}:preparation:${key}`;
  function addRecipe(recipe,shared=false) {
    const effective=resolveRules(service,recipe), mode=shared?'shared_preparation':effective.ingredientBasis==='productionUnits'?'by_production_unit':recipe.scope==='covers'?'by_headcount':'by_portions';
    insert('recipes',{id:recipeId(recipe.id),name:recipe.name,scale_mode:mode,
      reference_portions:mode==='by_portions'?recipe.basePortions:null,
      reference_headcount:['by_headcount','shared_preparation'].includes(mode)?recipe.basePortions:null,
      reference_production_units:mode==='by_production_unit'?recipe.baseProductionUnits:null,
      yield_value:recipe.targetYield?.quantity,yield_unit:recipe.targetYield?.unit,notes:recipe.notes||[]});
    recipe.ingredients.forEach((item,i) => {
      if(item.fromPreparation) return;
      insert('recipe_ingredients',{id:`${recipeId(recipe.id)}:ingredient:${i}`,recipe_id:recipeId(recipe.id),ingredient_id:ingredientId(item.name,item.unit),
        display_name:item.name,quantity:item.quantity,unit:item.unit,is_qs:item.quantity===null,
        quantity_basis:mode==='by_production_unit'?'production_unit':'reference_recipe',sort_order:i});
    });
    for(const [type,rule] of Object.entries(recipe.rules||{})) {
      const id=`${recipeId(recipe.id)}:override:${type}`;
      addRule(id,type,rule,1,recipe.scope,recipe.basePortions);
      insert('recipe_rule_overrides',{recipe_id:recipeId(recipe.id),rule_type:type,profile_id:id});
    }
  }
  const pendingLinks=[];
  service.recipes.forEach((recipe,i) => {
    addRecipe(recipe);
    const paths=recipe.categories||[recipe.category];
    const categoryMap={Protéine:'Protein',Féculent:'Starch',Légume:'Vegetable',Sauce:'Sauce'};
    const subMap={Viande:'Meat',Poisson:'Fish',Végétarien:'Vegetarian'};
    const tags=paths.flatMap((p,j)=>categoryMap[p[0]]?[]:[{name:p[0],sort_order:j}]);
    const effective=resolveRules(service,recipe);
    insert('components',{id:componentId(recipe.id),service_id:service.id,domain_key:recipe.id,name:recipe.name,recipe_id:recipeId(recipe.id),
      portion_group:recipe.scope==='covers'?'all':recipe.scope,sort_order:i,
      production_unit_id:effective.production?productionId(effective.production):null,
      rule_profile_id:recipe.profile?bindingIds.get(`profile:${recipe.profile}`):null,generic_rule_key:recipe.genericRule,profile_key:recipe.profile,
      service_sauce_key:recipe.serviceSauceRule,classification_tags:tags});
    if(recipe.linkedTo) pendingLinks.push([componentId(recipe.id),componentId(recipe.linkedTo)]);
    paths.forEach((p,j) => {if(categoryMap[p[0]])insert('component_categories',{component_id:componentId(recipe.id),category:categoryMap[p[0]],subcategory:subMap[p[1]],sort_order:j});});
  });
  for(const [from,to] of pendingLinks) rows.push(`UPDATE catering.components SET linked_component_id=${quote(to)} WHERE id=${quote(from)};`);
  (service.preparations||[]).forEach((recipe,i)=> {
    addRecipe(recipe,true);
    insert('shared_preparations',{id:preparationId(recipe.id),service_id:service.id,domain_key:recipe.id,recipe_id:recipeId(recipe.id),reference_headcount:recipe.basePortions,sort_order:i});
    (recipe.allocations||[]).forEach((allocation,j) => {
      // Fractions exactes des volumes de référence : aucune approximation 0,6666…
      const rational = v => {const [a,b='']=v.split('.'); return [BigInt(a+b),10n**BigInt(b.length)];};
      const [an,ad]=rational(allocation.quantity),[yn,yd]=rational(recipe.targetYield.quantity);
      const id=`${preparationId(recipe.id)}:allocation:${j}`;
      insert('shared_preparation_allocations',{id,service_id:service.id,shared_preparation_id:preparationId(recipe.id),component_id:componentId(allocation.to),
        ratio_numerator:String(an*yd),ratio_denominator:String(ad*yn),allocation_mode:'fixed_ratio',reference_quantity:allocation.quantity,unit:allocation.unit,sort_order:j});
      const target=service.recipes.find(r=>r.id===allocation.to);
      target.ingredients.forEach((item,k)=> {if(item.fromPreparation===recipe.id)insert('component_preparation_inputs',{component_id:componentId(target.id),allocation_id:id,display_name:item.name,sort_order:k});});
    });
  });
}
const sql='-- Seeds de référence générés depuis les données validées. À appliquer une fois après 001.\nBEGIN;\n'+rows.join('\n')+'\nINSERT INTO catering.schema_migrations(version) VALUES (\'002\');\nCOMMIT;\n';
if(require.main===module) fs.writeFileSync(path.join(__dirname,'002_reference_seeds.sql'),sql);
module.exports={sql};
