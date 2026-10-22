const {format}=require('../engine');
// Repère pratique de présentation : ne remplace jamais la quantité de la recette.
function trayPlan(ref,recipe,snapshot){
 if(ref.container!=='gn_deep'||!ref.base_ingredient_id)return null;
 const base=snapshot.ingredients.find(i=>i.recipe_id===recipe.sourceRecipeId&&i.ingredient_id===ref.base_ingredient_id);
 if(!base)return null;
 const matches=recipe.ingredients.filter(i=>i.name===(base.display_name||base.normalized_name));if(matches.length!==1||!matches[0].exact)return null;
 const line=matches[0],factors={kg:1000n,g:1n,L:1000n,ml:1n};if(!factors[line.unit]||!factors[ref.base_unit]||(['kg','g'].includes(line.unit)!==['kg','g'].includes(ref.base_unit)))return null;
 const {decimal}=require('../engine'),b=decimal(ref.base_quantity),n=BigInt(line.exact.numerator)*factors[line.unit],d=BigInt(line.exact.denominator)*factors[ref.base_unit];
 const ratioN=n*b.d,ratioD=d*b.n,count=(ratioN+ratioD-1n)/ratioD,full=ratioN/ratioD,remainder=ratioN%ratioD;

 // Reste exact : total - nombre de bacs pleins × base (pas de division entière intermédiaire).
 const lastExact=remainder?{n:n*b.d-full*d*b.n,d:d*b.d}:b;
 return {count:String(count),lastExact:{numerator:String(lastExact.n),denominator:String(lastExact.d)},unit:ref.base_unit,text:count===0n?'Aucun bac à préparer':String(count)+' bac'+(count>1n?'s':'')+(remainder?' · dernier : '+format(lastExact,ref.base_unit):' · tous pleins')};
}
module.exports={trayPlan};
