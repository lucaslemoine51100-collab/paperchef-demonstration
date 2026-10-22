// Conversion générique en une étape : application à la frontière achat, avant fusion.
function convertPurchaseRequirements(result,conversions){
 const output=structuredClone(result),bySource=new Map();
 for(const rule of conversions){if(bySource.has(rule.source_ingredient_id))throw new Error('Conversion ambiguë');if(rule.source_ingredient_id===rule.purchase_ingredient_id)throw new Error('Conversion circulaire');bySource.set(rule.source_ingredient_id,rule);}
 for(const rule of conversions)if(bySource.has(rule.purchase_ingredient_id))throw new Error('Chaîne de conversion non prise en charge');
 for(const recipe of [...output.preparations,...output.recipes])for(const item of recipe.ingredients){
  if(item.fromPreparation)continue;
  const rule=bySource.get(item.ingredient_id);if(!rule)continue;
  if(item.unit!==rule.source_unit)throw new Error('Unité source incompatible avec la conversion');
  if(typeof rule.ratio!=='string'||!/^\d+(\.\d+)?$/.test(rule.ratio)||/^0(\.0+)?$/.test(rule.ratio))throw new Error('Ratio exact positif requis');
  const [whole,tail='']=rule.ratio.split('.'),n=rule.ratio_numerator!=null?BigInt(rule.ratio_numerator):BigInt(whole+tail),d=rule.ratio_denominator!=null?BigInt(rule.ratio_denominator):10n**BigInt(tail.length);
  delete item.display; // Une quantité culinaire arrondie ne constitue pas un affichage d’achat.
  item.culinary_requirement??={ingredient_id:item.ingredient_id,normalized_name:item.normalized_name,unit:item.unit,exact:item.exact};
  item.purchase_conversion_steps=[...(item.purchase_conversion_steps||[]),{type:'product_conversion',source_ingredient_id:rule.source_ingredient_id,purchase_ingredient_id:rule.purchase_ingredient_id,source_unit:rule.source_unit,purchase_unit:rule.purchase_unit,ratio:rule.ratio}];
  if(item.exact)item.exact={numerator:String(BigInt(item.exact.numerator)*n),denominator:String(BigInt(item.exact.denominator)*d)};
  Object.assign(item,{purchase_required:true,ingredient_id:rule.purchase_ingredient_id,purchase_key:rule.purchase_ingredient_id,normalized_name:rule.normalized_name,purchase_category:rule.purchase_category,unit:rule.purchase_unit,purchase_display:rule.display_small_unit?{small_unit:rule.display_small_unit,threshold:rule.display_threshold}:null});
 }
 return output;
}
module.exports={convertPurchaseRequirements};

