const { compileFunction }=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const { resolveRules }=require('../engine');
const asInteger=v=>{const n=Number(v);if(!Number.isSafeInteger(n)||n<0)throw new RangeError('Entier SQL incompatible avec la V0');return n;};
const decimalText=v=>{if(typeof v!=='string'||!/^\d+(\.\d+)?$/.test(v))throw new TypeError('Décimal SQL attendu en chaîne exacte');return v;};
const sameDecimal=(a,b)=>{const f=v=>{const [x,y='']=decimalText(v).split('.');return [BigInt(x+y),10n**BigInt(y.length)];};const [an,ad]=f(a),[bn,bd]=f(b);return an*bd===bn*ad;};
const allergenLabels={fish:'Poisson',gluten:'Gluten',crustaceans:'Crustacés',eggs:'Œufs',peanuts:'Arachides',soy:'Soja',milk:'Lait',nuts:'Fruits à coque',celery:'Céleri',mustard:'Moutarde',sesame:'Sésame',sulphites:'Sulfites',lupin:'Lupin',molluscs:'Mollusques'};
const reviewed=status=>['reviewed','known','none'].includes(status);
function toDomain(snapshot) {
  const s=snapshot.service;
  // Profil d'affichage stocké, mais seule la politique V0 est actuellement exécutable.
  for(const id of new Set([s.rounding_profile_id,...snapshot.recipes.map(r=>r.rounding_profile_id),...snapshot.ingredients.map(i=>i.ingredient_rounding_profile_id)].filter(Boolean))) {
    const p=snapshot.rounding.find(r=>r.id===id);
    if(!p||!sameDecimal(p.kg_step,'0.1')||!sameDecimal(p.l_step,'0.1')||!sameDecimal(p.g_step,'10')||!sameDecimal(p.ml_step,'10')||p.piece_strategy!=='integer'||p.half_strategy!=='half_up')
      throw new RangeError('Profil d’arrondi non pris en charge par le moteur V0');
  }
  const unitRule=id=>{
    const u=snapshot.units.find(x=>x.id===id); if(!u)throw new Error('Unité de production manquante');
    const rule={name:u.name,unit:u.unit_type,portionsPerUnit:asInteger(u.capacity_portions),rounding:u.rounding_strategy,...(u.units_per_batch&&Number(u.units_per_batch)!==1?{unitsPerBatch:asInteger(u.units_per_batch)}:{})};
    if(u.subunit_quantity!==null)Object.assign(rule,{itemsPerUnit:asInteger(u.subunit_quantity),itemName:u.subunit_name,itemUnit:u.subunit_unit});return rule;
  };
  const profileById=id=>{const p=snapshot.rules.find(p=>p.id===id);if(!p)throw new Error('Règle manquante');return p;};
  const ruleValue=p=>{
    if(p.rule_type==='production')return unitRule(p.production_unit_id);
    if(p.rule_type==='ingredientBasis')return p.config_json.ingredientBasis;
    const result={quantity:decimalText(p.value),unit:p.unit,basePortions:asInteger(p.basis_count)};
    if(p.rule_type==='portionQuantity')result.name=p.config_json.name;
    if(p.rule_type==='sauceRule')result.scope=p.basis==='vegetarian'?'covers':p.basis;
    return result;
  };
  const out={id:s.id,name:s.name,baseCovers:asInteger(s.reference_headcount),portionMode:null,sauceRules:{},genericRules:{},profiles:{},recipes:[],preparations:[]};
  if(s.portion_mode==='all')out.portionMode={type:'all',group:s.all_group};
  else {const secondary=s.tie_break_target===s.secondary_group;out.portionMode={type:'split',roundedGroup:s.tie_break_target,
    complementGroup:secondary?s.primary_group:s.secondary_group,ratio:decimalText(secondary?s.split_secondary_ratio:s.split_primary_ratio)};}
  for(const b of snapshot.bindings) {
    const p=profileById(b.profile_id), value=ruleValue(p);
    if(b.role==='sauce')out.sauceRules[b.rule_key]=value;
    else {const dict=b.role==='generic'?out.genericRules:out.profiles;dict[b.rule_key]??={};dict[b.rule_key][p.rule_type]=value;}
  }
  const codeSets=new Map();
  const coverage={unreviewedIngredientIds:new Set()};
  function makeRecipe(record,component,shared=false) {
    const recipe=snapshot.recipes.find(r=>r.id===record.recipe_id);
    if(!recipe)throw new Error('Composant sans recette : calcul indisponible');
    const id=record.domain_key;
    const codes=new Set();
    const ordered=snapshot.ingredients.filter(i=>i.recipe_id===recipe.id).map(i=>{
      for(const code of i.allergen_codes)codes.add(code);
      if(!reviewed(i.allergen_status))coverage.unreviewedIngredientIds.add(i.ingredient_id);
      return {order:i.sort_order,item:{name:i.display_name,quantity:i.is_qs?null:decimalText(i.quantity),unit:i.unit}};
    });
    const categoryMap={Protein:'Protéine',Starch:'Féculent',Vegetable:'Légume',Sauce:'Sauce'},subMap={Meat:'Viande',Fish:'Poisson',Vegetarian:'Végétarien'};
    let categories=shared?[['Préparation commune']]:[
      ...snapshot.categories.filter(c=>c.component_id===component.id).map(c=>({order:c.sort_order,path:c.subcategory?[categoryMap[c.category],subMap[c.subcategory]]:[categoryMap[c.category]]})),
      ...component.classification_tags.map(t=>({order:t.sort_order,path:[t.name]}))
    ].sort((a,b)=>a.order-b.order).map(c=>c.path);
    const result={id,name:component?.name||recipe.name,category:categories[0]||['Composant'],categories,
      scope:shared?'covers':component.portion_group==='all'||component.portion_group==='vegetarian'?'covers':component.portion_group,
      notes:recipe.notes,ingredients:[],rules:{}};
    if(recipe.scale_mode==='by_production_unit') {result.baseProductionUnits=asInteger(recipe.reference_production_units);result.rules.ingredientBasis='productionUnits';}
    else result.basePortions=asInteger(recipe.reference_portions||recipe.reference_headcount);
    if(recipe.yield_value!==null)result.targetYield={quantity:decimalText(recipe.yield_value),unit:recipe.yield_unit};
    if(component) {
      if(component.profile_key)result.profile=component.profile_key;
      if(component.generic_rule_key)result.genericRule=component.generic_rule_key;
      if(component.production_unit_id)result.rules.production=unitRule(component.production_unit_id);
      if(component.service_sauce_key)result.serviceSauceRule=component.service_sauce_key;
      if(component.linked_component_id)result.linkedTo=snapshot.components.find(c=>c.id===component.linked_component_id)?.domain_key;
      if(component.rule_profile_id&&!component.profile_key){const p=profileById(component.rule_profile_id);out.profiles[component.rule_profile_id]={[p.rule_type]:ruleValue(p)};result.profile=component.rule_profile_id;}
      for(const input of snapshot.inputs.filter(i=>i.component_id===component.id)) {
        const allocation=snapshot.allocations.find(a=>a.id===input.allocation_id);
        const prep=snapshot.shared.find(p=>p.id===allocation.shared_preparation_id);
        ordered.push({order:input.sort_order,item:{name:input.display_name,fromPreparation:prep.domain_key}});
        for(const code of codeSets.get(prep.domain_key)||[])codes.add(code);
      }
    }
    for(const o of snapshot.overrides.filter(o=>o.recipe_id===recipe.id)){const p=profileById(o.profile_id);result.rules[p.rule_type]=ruleValue(p);}
    // Les ingrédients générés par une règle participent aussi à l’agrégation allergènes.
    const selected=snapshot.rules.filter(p=>p.rule_type==='portionQuantity'&&(
      snapshot.overrides.some(o=>o.recipe_id===recipe.id&&o.profile_id===p.id)||snapshot.bindings.some(b=>b.profile_id===p.id&&
        ((b.role==='profile'&&b.rule_key===result.profile)||(b.role==='generic'&&b.rule_key===result.genericRule))))).sort((a,b)=>a.priority-b.priority)[0];
    if(selected){const i=snapshot.ruleIngredients.find(i=>i.profile_id===selected.id);for(const code of i?.allergen_codes||[])codes.add(code);if(i&&!reviewed(i.allergen_status))coverage.unreviewedIngredientIds.add(i.ingredient_id);}
    result.ingredients=ordered.sort((a,b)=>a.order-b.order).map(x=>x.item);
    result.allergens=Object.keys(allergenLabels).filter(code=>codes.has(code)).map(code=>allergenLabels[code]);
    codeSets.set(id,codes);
    if(shared&&snapshot.allocations.some(a=>a.shared_preparation_id===record.id&&a.allocation_mode==='component_portions'))result.allocationBasis='componentPortions';
    if(shared)result.allocations=snapshot.allocations.filter(a=>a.shared_preparation_id===record.id).map(a=>({
      to:snapshot.components.find(c=>c.id===a.component_id)?.domain_key,...(a.allocation_mode==='component_portions'?{referenceComponentPortions:asInteger(a.reference_component_portions)}:{}),quantity:decimalText(a.reference_quantity),unit:a.unit}));
    // La base SQL est autoritaire ; aucun changement silencieux de mode via une surcharge.
    if((resolveRules(out,result).ingredientBasis||'portions')!== (recipe.scale_mode==='by_production_unit'?'productionUnits':'portions'))throw new Error('Mode recette/profil incohérent');
    return result;
  }
  out.preparations=snapshot.shared.map(p=>makeRecipe(p,null,true));
  out.recipes=snapshot.components.filter(c=>c.active).map(c=>makeRecipe(c,c));
  return {service:out,metadata:{headcount:asInteger(s.headcount),unreviewedIngredientIds:[...coverage.unreviewedIngredientIds],
    allergensComplete:coverage.unreviewedIngredientIds.size===0}};
}
// Pont V0 isolé : le code du moteur existant est exécuté avec un catalogue injecté.
// Pas de mutation du registre global, pas de SQL dans engine.js, pas de copie des calculs.
function createCalculator(catalog) {
  const engineFile=path.join(__dirname,'..','engine.js');
  const module={exports:{}};
  const run=compileFunction(fs.readFileSync(engineFile,'utf8'),['require','module','exports'],{filename:engineFile});
  run(name=>{if(name==='./services')return structuredClone(catalog);throw new Error('Import moteur inattendu');},module,module.exports);
  return module.exports.calculate;
}
async function loadCalculator(repository, serviceId) {
  const mapped=toDomain(await repository.loadService(serviceId));
  return {calculate:createCalculator({[serviceId]:mapped.service}),...mapped};
}
module.exports={toDomain,createCalculator,loadCalculator};
