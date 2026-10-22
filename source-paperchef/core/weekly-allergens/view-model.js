const {calculateService}=require('../persistence/service-calculation');
const {enrichServiceResult}=require('../orders/input-adapter');
const {orderedVisuals,fixedAllergenLegend,functionalColor,categoryLegend}=require('./visuals');
const {formatWeekRange}=require('../order-sheets/week-range-format');
function isoDate(value){const d=new Date(value+'T12:00:00Z');if(!value||Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==value)throw new Error('Date de semaine invalide');return d;}
async function weeklyAllergenSheetViewModel(repository,selections,{weekStart}={}){
 const start=isoDate(weekStart);if(start.getUTCDay()!==1)throw new Error('La semaine commence un lundi');
 const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);return {date:d.toISOString().slice(0,10),dayLabel:new Intl.DateTimeFormat('fr-FR',{weekday:'long',timeZone:'UTC'}).format(d).toUpperCase(),lunchService:null,dinnerService:null};});
 if(!Array.isArray(selections))throw new Error('Sélections de services requises');
 for(const selection of selections){
  if(!selection||Object.keys(selection).some(k=>!['serviceId','headcount','serviceDate','mealType'].includes(k)))throw new Error('Uniquement des sélections de services, aucun allergène saisi');
  const {snapshot,result,metadata}=await calculateService(repository,selection.serviceId,selection.headcount);
  const raw=selection.serviceDate??snapshot.service.service_date;
  const date=raw instanceof Date?raw.toISOString().slice(0,10):String(raw).slice(0,10);
  const day=days.find(d=>d.date===date),slot={lunch:'lunchService',dinner:'dinnerService'}[selection.mealType??snapshot.service.meal_type];
  if(!day||!slot)throw new Error('Service hors semaine ou repas invalide');if(day[slot])throw new Error('Deux services dans le même créneau');
  const enriched=enrichServiceResult(result,snapshot),allRecipes=[...enriched.preparations,...enriched.recipes];
  function sources(recipe,seen=new Set()){
   if(seen.has(recipe.id))throw new Error('Cycle de préparation');const next=new Set(seen).add(recipe.id);
   return recipe.ingredients.flatMap(item=>item.fromPreparation?sources(allRecipes.find(r=>r.id===item.fromPreparation),next):[{ingredientId:item.source_ref.ingredient_id,recipeId:item.source_ref.recipe_id,recipeIngredientId:item.source_ref.recipe_ingredient_id,ruleProfileId:item.source_ref.rule_profile_id}]);
  }
  const components=enriched.recipes.filter(recipe=>snapshot.components.find(c=>c.domain_key===recipe.id).menu_visible!==false).map(recipe=>{
   const stored=snapshot.components.find(c=>c.domain_key===recipe.id);
   const internal=(snapshot.menuContributions||[]).filter(m=>m.target_component_id===stored.id).map(m=>snapshot.components.find(c=>c.id===m.source_component_id)).map(c=>enriched.recipes.find(r=>r.id===c.domain_key));
   const refs=[...sources(recipe),...internal.flatMap(r=>sources(r))],ids=new Set(refs.map(r=>r.ingredientId));
   const rows=[...snapshot.ingredients,...snapshot.ruleIngredients].filter(i=>ids.has(i.ingredient_id));
   // Les relations actuelles de la base signifient CONTIENT. Le canal traces reste distinct.
   const allergens=orderedVisuals(rows.flatMap(i=>i.allergen_codes));
   return {componentId:snapshot.components.find(c=>c.domain_key===recipe.id).id,recipeId:snapshot.components.find(c=>c.domain_key===recipe.id).recipe_id,name:recipe.name,functionalCategories:recipe.categories,displayColor:functionalColor(recipe.categories),allergens,traces:[],ingredientSources:refs,reviewNames:[...new Set(rows.filter(i=>!['known','none','reviewed'].includes(i.allergen_status)).map(i=>i.normalized_name))]};
  });
  day[slot]={serviceId:result.serviceId,plannedServiceId:snapshot.service.planned_service_id||null,serviceTemplateId:snapshot.service.service_template_id||snapshot.service.id,coverCount:result.covers,components,allergensComplete:metadata.allergensComplete};
 }
 return {categoryLegend,weekLabel:'ALLERGÈNES DE LA SEMAINE',dateRangeLabel:formatWeekRange(days[0].date,days[6].date),days,legend:fixedAllergenLegend(),containsOnly:true,hasReviewRequired:days.some(d=>[d.lunchService,d.dinnerService].some(s=>s&&!s.allergensComplete)),note:'Allergènes « contient » issus des ingrédients référencés. Les traces ne sont pas affichées. Une zone vide ne garantit pas l’absence d’allergènes.'};
}
module.exports={weeklyAllergenSheetViewModel};
