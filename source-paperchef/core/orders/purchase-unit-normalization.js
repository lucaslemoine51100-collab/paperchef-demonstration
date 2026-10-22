// Normalisation d’achat pilotée par identifiants et données, avant agrégation.
function normalizePurchaseUnits(result,catalog,rules){
 const output=structuredClone(result);if(!catalog.length)return output; // snapshots historiques avant migration 006.
 const units=new Map(catalog.map(i=>[i.id,i.purchase_unit]));const byKey=new Map();
 for(const rule of rules){const key=JSON.stringify([rule.ingredient_id,rule.source_unit]);if(byKey.has(key))throw new Error('Conversion d’unité ambiguë');byKey.set(key,rule);}
 for(const recipe of [...output.preparations,...output.recipes])for(const item of recipe.ingredients){
  if(item.fromPreparation||item.purchase_required===false)continue;
  const target=units.get(item.ingredient_id);if(!target)throw new Error('Unité d’achat canonique manquante');
  const source=item.unit;let n=1n,d=1n,convention=null;
  if(source!==target){
   if((source==='g'&&target==='kg')||(source==='ml'&&target==='L'))d=1000n;
   else if(source==='unités'&&target==='pièces'){}
   else{const rule=byKey.get(JSON.stringify([item.ingredient_id,source]));if(!rule||rule.purchase_unit!==target)throw new Error(`Conversion d’achat non définie pour ${item.ingredient_id} : ${source} → ${target}`);
    if(typeof rule.ratio!=='string'||!/^\d+(\.\d+)?$/.test(rule.ratio))throw new Error('Ratio décimal exact requis');const [whole,tail='']=rule.ratio.split('.');n=BigInt(whole+tail);d=10n**BigInt(tail.length);if(n<=0n)throw new Error('Ratio positif requis');convention=rule.convention;
   }
  }
  // Pour une poudre, conserver le besoin en litres déjà tracé par la conversion précédente.
  item.culinary_requirement??={ingredient_id:item.ingredient_id,normalized_name:item.normalized_name,unit:source,exact:structuredClone(item.exact)};
  if(source!==target){item.purchase_conversion_steps=[...(item.purchase_conversion_steps||[]),{type:'unit_normalization',source_ingredient_id:item.ingredient_id,purchase_ingredient_id:item.ingredient_id,source_unit:source,purchase_unit:target,ratio:{numerator:String(n),denominator:String(d)},convention}];if(item.exact)item.exact={numerator:String(BigInt(item.exact.numerator)*n),denominator:String(BigInt(item.exact.denominator)*d)};delete item.display;}
  item.unit=target;item.purchase_unit=target;
  if(convention)item.purchase_unit_convention=convention;
 }
 return output;
}
module.exports={normalizePurchaseUnits};
