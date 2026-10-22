const {PURCHASE_CATEGORIES,categoryLabels}=require('./purchase-categories');
const defaultDecisions=require('./purchase-category-review.json');
const appliedCorrections=require('./purchase-category-corrections.json');
function auditPurchaseCategories(ingredients,decisions=defaultDecisions){
 const byId=new Map(decisions.map(d=>[d.ingredient_id,d]));
 const seen=new Set();
 const rows=ingredients.filter(i=>i.active!==false).map(i=>{
  if(seen.has(i.id))throw new Error('Ingrédient actif dupliqué dans le contrôle');seen.add(i.id);
  const decision=byId.get(i.id),missing=i.purchase_category==null||i.purchase_category==='';
  const valid=!missing&&Object.hasOwn(categoryLabels,i.purchase_category);
  const drift=decision&&(decision.purchase_category!==i.purchase_category||decision.default_unit!==i.default_unit||decision.normalized_name!==i.normalized_name);
  const manual=!decision||drift||decision.manual_decision_required;
  return {ingredient_id:i.id,normalized_name:i.normalized_name,purchase_key:i.id,purchase_category:i.purchase_category,category_label:categoryLabels[i.purchase_category]||null,default_unit:i.default_unit,valid_category:valid,status:!valid?'INVALID':manual?'REVIEW_REQUIRED':'REVIEWED',proposed_category:manual?null:decision.proposed_category,alternative_label:decision?.alternative_label||null,manual_decision_required:Boolean(manual),reason:!decision?'Nouvel ingrédient : revue individuelle requise.':drift?'Données modifiées depuis le contrôle : nouvelle revue requise.':decision.reason};
 });
 const corrections=appliedCorrections.filter(c=>rows.some(r=>r.ingredient_id===c.ingredient_id&&r.purchase_category===c.new_category&&r.normalized_name===c.normalized_name));
 const valid=rows.filter(r=>r.valid_category).length,review=rows.filter(r=>r.status==='REVIEW_REQUIRED').length;
 return {summary:{total_active:rows.length,valid_categories:valid,reviewed:rows.filter(r=>r.status==='REVIEWED').length,corrected:corrections.length,missing_category:rows.filter(r=>r.purchase_category==null||r.purchase_category==='').length,invalid_category:rows.filter(r=>r.purchase_category!=null&&r.purchase_category!==''&&!r.valid_category).length,review_required:review,invalid_remaining:rows.length-valid},corrections,review_required:rows.filter(r=>r.status==='REVIEW_REQUIRED'),categories:PURCHASE_CATEGORIES.map(c=>({...c,count:rows.filter(r=>r.purchase_category===c.category).length})),ingredients:rows};
}
module.exports={auditPurchaseCategories};
