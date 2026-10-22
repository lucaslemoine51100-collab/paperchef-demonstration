// Couche pure : aucune dépendance au SQL, au PDF ou au moteur de recettes.
const {categoryLabels}=require('./purchase-categories');
const gcd=(a,b)=>b?gcd(b,a%b):a;
function fraction(n,d=1n){if(n<0n||d<=0n)throw new RangeError('Quantité exacte positive attendue');const g=gcd(n,d);return {n:n/g,d:d/g};}
const serialize=f=>({numerator:String(f.n),denominator:String(f.d)});
const read=q=>fraction(BigInt(q.numerator),BigInt(q.denominator));
const add=(a,b)=>fraction(a.n*b.d+b.n*a.d,a.d*b.d);
function canonical(unit){return {g:['kg',1000n],kg:['kg',1n],ml:['L',1000n],L:['L',1n],pièce:['pièces',1n],pièces:['pièces',1n],unités:['pièces',1n],plaque:['plaques',1n],plaques:['plaques',1n]}[unit]||[unit,1n];}
function display(f,unit){const tenth=['kg','L'].includes(unit),tens=['g','ml'].includes(unit);const n=tenth?f.n*10n:f.n,d=tens?f.d*10n:f.d;const r=(2n*n+d)/(2n*d);return tenth?`${r/10n},${r%10n}`:String(tens?r*10n:r);}
function aggregateOrders(serviceResults){
 const groups=new Map();
 serviceResults.forEach((service,selectionIndex)=>{
  for(const recipe of [...service.preparations,...service.recipes])for(const ingredient of recipe.ingredients){
   if(ingredient.fromPreparation||ingredient.purchase_required===false)continue;
   if(!ingredient.ingredient_id||!ingredient.normalized_name||!Object.hasOwn(categoryLabels,ingredient.purchase_category))throw new Error('Identité d’achat absente ou catégorie invalide');
   const [unit,divisor]=canonical(ingredient.unit);
   if(!unit)throw new Error('Unité d’achat absente');
   const key=JSON.stringify([ingredient.purchase_key||ingredient.ingredient_id,ingredient.purchase_category,unit]);
   let line=groups.get(key);
   if(!line){line={ingredient_id:ingredient.ingredient_id,ingredient_ids:[],purchase_key:ingredient.purchase_key||ingredient.ingredient_id,normalized_name:ingredient.normalized_name,purchase_category:ingredient.purchase_category,canonical_unit:unit,sum:fraction(0n),purchase_display:ingredient.purchase_display||null,has_qs:false,source_services:[],sources:[],selections:new Set()};groups.set(key,line);}
   if(ingredient.purchase_display){if(line.purchase_display&&JSON.stringify(line.purchase_display)!==JSON.stringify(ingredient.purchase_display))throw new Error('Politiques d’affichage incompatibles');line.purchase_display=ingredient.purchase_display;}
   const original=ingredient.exact===null?null:read(ingredient.exact);
   const amount=original?fraction(original.n,original.d*divisor):null;
   if(amount)line.sum=add(line.sum,amount);else line.has_qs=true;
   if(!line.ingredient_ids.includes(ingredient.ingredient_id))line.ingredient_ids.push(ingredient.ingredient_id);
   if(!line.source_services.includes(service.serviceId))line.source_services.push(service.serviceId);
   line.selections.add(selectionIndex);
   line.sources.push({selection_index:selectionIndex,...(service.plannedServiceId?{planned_service_id:service.plannedServiceId,service_template_id:service.serviceTemplateId}:{}),service_id:service.serviceId,service_name:service.serviceName,headcount:service.covers,recipe_id:ingredient.source_ref?.recipe_id||recipe.id,recipe_domain_id:recipe.id,component_id:ingredient.source_ref?.component_id||null,component_ids:ingredient.source_ref?.component_ids||[],shared_preparation_id:ingredient.source_ref?.shared_preparation_id||null,recipe_ingredient_id:ingredient.source_ref?.recipe_ingredient_id||null,rule_profile_id:ingredient.source_ref?.rule_profile_id||null,source_ingredient_id:ingredient.source_ref?.ingredient_id||ingredient.culinary_requirement?.ingredient_id||ingredient.ingredient_id,purchase_ingredient_id:ingredient.ingredient_id,purchase_conversion_steps:structuredClone(ingredient.purchase_conversion_steps||[]),recipe_name:recipe.name,culinary_requirement:ingredient.culinary_requirement||null,purchase_unit_convention:ingredient.purchase_unit_convention||null,original_unit:ingredient.unit,original_exact_quantity:ingredient.exact,exact_quantity:amount?serialize(amount):null,canonical_unit:unit});
  }
 });
 const categories=Object.entries(categoryLabels).map(([category,label])=>({category,label,lines:[...groups.values()].filter(l=>l.purchase_category===category).sort((a,b)=>a.normalized_name.localeCompare(b.normalized_name,'fr')||a.purchase_key.localeCompare(b.purchase_key)||a.canonical_unit.localeCompare(b.canonical_unit)).map(l=>{
 const {sum,selections,...data}=l;const onlyQS=l.sources.every(s=>s.exact_quantity===null);
 let displayUnit=l.canonical_unit,shown=sum;
 if(l.purchase_display){
  const [whole,tail='']=l.purchase_display.threshold.split('.');const thresholdN=BigInt(whole+tail),thresholdD=10n**BigInt(tail.length);
  if(sum.n*thresholdD<thresholdN*sum.d){const [target,divisor]=canonical(l.purchase_display.small_unit);if(target!==l.canonical_unit)throw new Error('Unité d’affichage achat incompatible');displayUnit=l.purchase_display.small_unit;shown=fraction(sum.n*divisor,sum.d);}
 }
 return {...data,exact_quantity:onlyQS?null:serialize(sum),display_quantity:onlyQS?'QS':(displayUnit==='pièces'&&l.sources.some(s=>s.purchase_conversion_steps.some(c=>c.type==='product_conversion'))?String((shown.n+shown.d-1n)/shown.d):display(shown,displayUnit)),display_unit:displayUnit,source_count:l.source_services.length,selection_count:selections.size,quantity_complete:!l.has_qs};
 })}));
 return {categories};
}
const aggregateServiceOrder=result=>aggregateOrders([result]);
module.exports={aggregateOrders,aggregateServiceOrder};

