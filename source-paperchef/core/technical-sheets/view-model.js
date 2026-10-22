const {productionReferences}=require('./production-references');
// Présentation uniquement : les display proviennent du moteur, aucun redimensionnement.
function colorProfile(categories) {
  const protein=categories.find(path=>path[0]==='Protéine');
  if(protein)return {Viande:'meat',Poisson:'fish',Végétarien:'vegetarian'}[protein[1]]||'neutral';
  for(const [category,color]of [['Féculent','starch'],['Légume','vegetable'],['Sauce','sauce']])if(categories.some(path=>path[0]===category))return color;
  return 'neutral';
}
function technicalSheetViewModel(result,snapshot,metadata) {
  const nameById=new Map([...result.recipes,...result.preparations].map(r=>[r.id,r.name]));
  const allNames=new Map(snapshot.components.map(c=>[c.domain_key,c.name]));
  const labels={meat:'viande',fish:'poisson',vegetarian:'végétariennes'};
  const ingredientWarnings=new Map(snapshot.ingredients.map(i=>[i.ingredient_id,i.normalized_name]));
  for(const i of snapshot.ruleIngredients)ingredientWarnings.set(i.ingredient_id,snapshot.rules.find(r=>r.id===i.profile_id)?.config_json.name||'Ingrédient');
  function block(recipe,shared=false) {
    const stored=(shared?snapshot.shared:snapshot.components).find(r=>r.domain_key===recipe.id);
    const reference=snapshot.recipes.find(r=>r.id===stored?.recipe_id);
    const sauceBinding=snapshot.bindings.find(b=>b.role==='sauce'&&b.rule_key===stored?.service_sauce_key);
    const serviceRuleLabel=snapshot.rules.find(r=>r.id===sauceBinding?.profile_id)?.config_json?.display_label;
    const categories=recipe.categories;
    const reviewNames=snapshot.ingredients.filter(i=>i.recipe_id===reference?.id&&['review_required','unreviewed'].includes(i.allergen_status)).map(i=>i.normalized_name);
    return {source:{serviceId:snapshot.service.id,componentId:shared?null:stored?.id,sharedPreparationId:shared?stored?.id:null,recipeId:stored?.recipe_id},name:recipe.name,id:recipe.id,categories,colorProfile:colorProfile(categories),calculatedPortions:recipe.portions,
      shared,productionReferences:reference?productionReferences(reference,snapshot).map((ref,index)=>({...ref,trayPlan:require('./tray-plan').trayPlan(reference.production_references.find((r,index)=>r.label===ref.label&&(r.sort_order??index)===ref.order)||reference.production_references[index],{...recipe,sourceRecipeId:reference.id},snapshot)})):[],productionUnits:recipe.production?{name:recipe.production.name,units:recipe.production.units.display,
        items:recipe.production.items?.display||null,capacity:recipe.production.producedCapacity.display,
        ingredientBasis:recipe.ingredientBasis==='productionUnits'?'Ingrédients par unité produite':'Ingrédients sur les portions demandées'}:null,
      ingredients:recipe.ingredients.map(i=>({name:i.name,displayQuantity:i.display,displayUnit:i.unit,
        exact:i.exact?{...i.exact}:null,internalTransfer:Boolean(i.fromPreparation),fromPreparation:i.fromPreparation||null})),
      preparationSteps:(reference?.preparation_steps??reference?.steps??[]).map((step,index)=>({order:index+1,text:typeof step==='string'?step:step.text||step.description||''})),
      steps:reference?.preparation_steps??reference?.steps??[],notes:recipe.notes||[],allergens:recipe.allergens,
      reviewNames:[...new Set(reviewNames)],yield:recipe.targetYield?.display||null,
      serviceRule:recipe.extraServiceSauce?.display||null,
      ...(serviceRuleLabel?{serviceRuleLabel}:{}),
      allocations:recipe.allocations.map(a=>({to:nameById.get(a.to)||allNames.get(a.to)||a.to,displayQuantity:a.display,exact:a.exact?{...a.exact}:null,unit:a.unit,targetId:a.to}))};
  }
  const date=snapshot.service.service_date;
  const parsed=date?(date instanceof Date?date:new Date(String(date).slice(0,10)+'T12:00:00Z')):null;
  const dayLabel=parsed&&!Number.isNaN(parsed.getTime())?new Intl.DateTimeFormat('fr-FR',{weekday:'long',timeZone:'UTC'}).format(parsed).toUpperCase():null;
  const mealType={lunch:'MIDI',dinner:'SOIR'}[snapshot.service.meal_type]||null;
  return {...(result.plannedServiceId?{plannedServiceId:result.plannedServiceId,serviceTemplateId:result.serviceTemplateId}:{}),orderSelection:{serviceId:result.serviceId,headcount:result.covers},dayLabel,mealType,serviceName:require('../pwa/public/service-title').display(snapshot),...(snapshot.service.planned_service_id&&!snapshot.service.display_name?{headingTitle:result.recipes.map(r=>r.name).join(' • ')}:{}),serviceId:result.serviceId,headcount:result.covers,
    portionSummary:Object.entries(result.portions).map(([group,count])=>`${count} portions ${labels[group]||group}`).join(' · '),
    components:result.recipes.map(r=>block(r)),sharedPreparations:result.preparations.map(r=>block(r,true)),
    allergens:[...new Set([...result.recipes,...result.preparations].flatMap(r=>r.allergens))],
    reviewNames:metadata.unreviewedIngredientIds.map(id=>ingredientWarnings.get(id)||id),allergensComplete:metadata.allergensComplete,
    notes:['Quantités arrondies uniquement à l’affichage.','QS : quantité suffisante, à ajuster à la préparation.'],
    serviceInstructions:(snapshot.service.service_instructions||'').split('\n').filter(Boolean),roundingNote:'kg / L : au dixième · g / ml : à la dizaine · pièces : entières'};
}
module.exports={technicalSheetViewModel,colorProfile};

