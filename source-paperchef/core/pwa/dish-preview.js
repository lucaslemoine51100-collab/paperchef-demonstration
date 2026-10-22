const {calculateService}=require('../persistence/service-calculation');
const {technicalSheetViewModel}=require('../technical-sheets/view-model');
const {presentationBlocks}=require('../technical-sheets/presentation-blocks');
const {renderTechnicalSheet}=require('../technical-sheets/template');
async function dishPreview(repo,id,{serviceId,componentId}={}){
 let vm,block;
 if(serviceId){const calc=await calculateService(repo,serviceId);vm=technicalSheetViewModel(calc.result,calc.snapshot,calc.metadata);block=presentationBlocks(vm).find(c=>c.id===componentId);}
 else{
  const detail=await repo.dishDetail(id,{sections:false});
  const origin=(await repo.rows('SELECT service_id,domain_key FROM catering.components WHERE dish_id=$1 ORDER BY service_id,sort_order LIMIT 1',[id]))[0];
  const shared=!origin?(await repo.rows('SELECT service_id,domain_key FROM catering.shared_preparations WHERE recipe_id=$1 ORDER BY service_id,sort_order LIMIT 1',[detail.recipe.id]))[0]:null;
  if(origin||shared){const calc=await calculateService(repo,(origin||shared).service_id);vm=technicalSheetViewModel(calc.result,calc.snapshot,calc.metadata);block=presentationBlocks(vm).find(c=>c.id===(origin||shared).domain_key);}
  if(!block){const {snapshot}=await repo.bundle(id,{editing:true}),{toDomain,createCalculator}=require('../persistence/adapter');const mapped=toDomain(snapshot),result=createCalculator({[snapshot.service.id]:mapped.service})(Number(snapshot.service.reference_headcount),snapshot.service.id);vm=technicalSheetViewModel(result,snapshot,mapped.metadata);block=presentationBlocks(vm).find(c=>c.id===snapshot.components[0].domain_key);}
 }
 if(!block)throw Error('Plat introuvable dans ce service.');
 let html=renderTechnicalSheet({...vm,components:[block],sharedPreparations:[]});
 html=html.replace(/<script>[\s\S]*?<\/script>/g,'').replace('</head>','<style>body{background:white}.sheet{--s:1;width:auto;margin:0;padding:0}.heading,.footer{display:none}.layout,.row{display:block!important}.row.single .card-content{display:block}.card{margin:0;min-height:0}.card-head h2{font-size:17px}.card-content{padding:12px}table{font-size:15px}ol{font-size:14px}.notes,.allergens,.use{font-size:13px}</style></head>');
 const n=require('../../nutrition-calculation.cjs');const nutrition=n.calculate(vm,await n.profiles(repo.client)).components.find(c=>c.id===block.id);return {name:block.name,html,nutrition};
}
module.exports={dishPreview};
