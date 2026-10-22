// Repair template links only; archived dishes and planned snapshots stay intact.
const normalize=s=>String(s).normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr');
const categories=rows=>JSON.stringify(rows.map(c=>[c.category,c.subcategory||'']).sort());
async function repair(client){
 const {DishRepository}=require('./dishes'),repo=new DishRepository(client),changed=[],skipped=[];
 const rows=(await client.query(`SELECT c.id,c.service_id,c.dish_id,d.name FROM catering.components c JOIN catering.dishes d ON d.id=c.dish_id JOIN catering.service_templates s ON s.id=c.service_id WHERE NOT d.active AND c.active ORDER BY c.service_id,c.sort_order`)).rows;if(!rows.length)return {changed,skipped};
 await repo.registerMissing();const choices=await repo.rows('SELECT * FROM catering.dishes WHERE active'),groups=new Map();for(const row of rows){if(!groups.has(row.service_id))groups.set(row.service_id,[]);groups.get(row.service_id).push(row);}
 for(const [serviceId,links]of groups){const snapshot=await repo.loadService(serviceId),changes=[];
  for(const row of links){const old=await repo.dishDetail(row.dish_id,{serviceId}),c=snapshot.components.find(c=>c.id===row.id);const candidates=choices.filter(d=>normalize(d.name)===normalize(old.dish.name));const compatible=[];for(const candidate of candidates){const data=await repo.dishDetail(candidate.id,{serviceId});if(categories(data.categories)===categories(old.categories))compatible.push(data);}
   if(compatible.length!==1){skipped.push({...row,reason:compatible.length?'Plusieurs versions actives compatibles':'Aucune version active compatible'});continue;}
   const next=compatible[0];if(!!old.dish.linkedPreparation!==!!next.dish.linkedPreparation){skipped.push({...row,reason:'Structure de préparation différente'});continue;}
   if(next.dish.linkedPreparation){const previous=old.dish.linkedPreparation,nextSource=next.dish.linkedPreparation,shared=snapshot.shared.filter(p=>(previous.recipeIds||[previous.recipeId]).includes(p.recipe_id));if(!shared.length||!snapshot.inputs.some(i=>i.component_id===c.id)){skipped.push({...row,reason:'Répartition de la préparation à vérifier'});continue;}for(const p of shared)p.recipe_id=nextSource.recipeId;}
   c.dish_id=next.dish.id;changes.push({componentId:c.id,name:row.name,previousDishId:row.dish_id,dishId:next.dish.id});
  }
  if(changes.length){try{await repo.assembly({snapshot,expectedVersion:snapshot.service.version},{preserveContext:true});changed.push({serviceId,changes});}catch(error){skipped.push(...changes.map(c=>({...c,serviceId,reason:error.message})));}}
 }
 return {changed,skipped};
}
module.exports={repair};
