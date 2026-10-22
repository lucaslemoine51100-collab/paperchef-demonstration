const {normalizePurchaseUnits}=require('./purchase-unit-normalization');
// Association par relations SQL explicites, jamais par recherche approximative du produit.
const {convertPurchaseRequirements}=require('./purchase-conversion');
const {calculateService}=require('../persistence/service-calculation');
function enrichServiceResult(result,snapshot){
 const enriched=structuredClone(result);
 for(const recipe of [...enriched.preparations,...enriched.recipes]){
  const record=[...snapshot.shared,...snapshot.components].find(r=>r.domain_key===recipe.id);
  if(!record)throw new Error('Recette calculée sans relation persistante');
  for(const item of recipe.ingredients){
   if(item.fromPreparation)continue;
   let candidates=snapshot.ingredients.filter(i=>i.recipe_id===record.recipe_id&&i.display_name===item.name);
   if(!candidates.length){
    const boundIds=new Set([...snapshot.overrides.filter(o=>o.recipe_id===record.recipe_id).map(o=>o.profile_id),...snapshot.bindings.filter(b=>(b.role==='profile'&&b.rule_key===record.profile_key)||(b.role==='generic'&&b.rule_key===record.generic_rule_key)||b.profile_id===record.rule_profile_id).map(b=>b.profile_id)]);
    const rules=snapshot.rules.filter(r=>boundIds.has(r.id)&&r.rule_type==='portionQuantity'&&r.config_json.name===item.name);
    candidates=snapshot.ruleIngredients.filter(i=>rules.some(r=>r.id===i.profile_id));
   }
   const identities=new Map(candidates.map(i=>[i.ingredient_id,i]));
   if(identities.size!==1)throw new Error(`Identité d’achat introuvable ou ambiguë : ${recipe.id} / ${item.name}`);
   const source=[...identities.values()][0];
   item.source_ref={service_id:snapshot.service.id,component_id:snapshot.components.includes(record)?record.id:null,shared_preparation_id:snapshot.shared.includes(record)?record.id:null,component_ids:snapshot.shared.includes(record)?snapshot.allocations.filter(a=>a.shared_preparation_id===record.id).map(a=>a.component_id):[record.id],recipe_id:record.recipe_id,recipe_domain_id:recipe.id,recipe_ingredient_id:source.id||null,rule_profile_id:source.profile_id||null,ingredient_id:source.ingredient_id};
   item.culinary_requirement={ingredient_id:source.ingredient_id,normalized_name:source.normalized_name,name:item.name,unit:item.unit,exact:structuredClone(item.exact)};
   if(item.unit==='QS'&&source.default_unit)item.unit=source.default_unit;
   Object.assign(item,{ingredient_id:source.ingredient_id,purchase_key:source.ingredient_id,normalized_name:source.normalized_name,purchase_category:source.purchase_category,purchase_required:source.purchase_required??true});
  }
 }
 return enriched;
}
async function calculateOrderServices(repository,selections){
 const results=[];
 if(!Array.isArray(selections)||!selections.length)throw new Error('Sélection de services requise');
 for(const selection of selections){
  if(!selection||Object.keys(selection).some(key=>!['serviceId','headcount','serviceDate','mealType'].includes(key)))throw new Error('Une commande accepte uniquement des sélections de services, pas une liste d’ingrédients');
  const {snapshot,result}=await calculateService(repository,selection.serviceId,selection.headcount);
  results.push(normalizePurchaseUnits(convertPurchaseRequirements(enrichServiceResult(result,snapshot),snapshot.purchaseConversions||[]),snapshot.purchaseUnits||[],snapshot.purchaseUnitConversions||[]));
 }
 return results;
}
module.exports={enrichServiceResult,calculateOrderServices};
