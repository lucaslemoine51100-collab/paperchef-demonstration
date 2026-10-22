'use strict';
const {randomUUID}=require('node:crypto'),{problem,event}=require('./accounts.cjs'),manual=require('./manual-composition.cjs');
const keys=['meat','fish','vegetarian','starch','vegetable','sauce'];
async function prepare(repo,user,input){
 if(!['cook','store','diet'].includes(user.role))throw problem('Déplacement indisponible.',403);
 if(!keys.includes(input.category)||!['swap','replace'].includes(input.action))throw problem('Déplacement invalide.');
 const model=input.model===true;let from,to;
 if(!model){
  if(!input.sourceId||!input.targetId||input.sourceId===input.targetId)throw problem('Choisissez deux services différents.');
  from=await repo.getPlanned(input.sourceId);to=await repo.getPlanned(input.targetId);
  if(from.week_id!==to.week_id)throw problem('Choisissez deux services de la même semaine.');
  const check=require('./diet-drag-proposals.cjs').check;
  await check(repo,from,input.fingerprint,{approval:user.role==='diet'});await check(repo,to,input.targetFingerprint,{approval:user.role==='diet'});
 }
 const a=model?manual.parse(input.sourceManual):input.sourceManual?manual.parse(input.sourceManual):(await manual.source(repo,{plannedId:from.id})).view.manualComposition;
 const b=model?manual.parse(input.targetManual):input.targetManual?manual.parse(input.targetManual):(await manual.source(repo,{plannedId:to.id})).view.manualComposition;
 const key=input.category,wanted=a.dishes[key],other=b.dishes[key];
 if(!wanted||wanted===other)throw problem('Choisissez deux plats différents de la même famille.');
 if(key==='vegetarian'&&(a.mode!=='vegetarian'||b.mode!=='vegetarian')||['meat','fish'].includes(key)&&(a.mode!=='mixed'||b.mode!=='mixed'))throw problem('Choisissez la même famille de plat à l’arrivée.');
 if(input.action==='swap'&&other)a.dishes[key]=other;else delete a.dishes[key];b.dishes[key]=wanted;
 const left=await manual.build(repo,a),right=await manual.build(repo,b);
 for(const result of [left,right])if(!result.view.valid)throw problem(result.view.compatibilityErrors[0]||'Ce déplacement laisserait un service sans plat.',409);
 // A complete dish must not silently discard an unrelated accompaniment during a drag.
 if(a.dishes.starch&&!left.view.manualComposition.dishes.starch||b.dishes.starch&&!right.view.manualComposition.dishes.starch)throw problem('Retirez d’abord le féculent séparé avant de déplacer un plat complet.',409);
 const variants=require('./service-variants.cjs');variants.validateCalculation(left.graph,from?.cover_count||100);variants.validateCalculation(right.graph,to?.cover_count||100);
 return {from,to,left,right,changes:[{plannedId:from?.id,fingerprint:input.fingerprint,snapshot:left.graph},{plannedId:to?.id,fingerprint:input.targetFingerprint,snapshot:right.graph}]};
}
async function handle(repo,user,input){
 if(input.action==='preview'){
  const actions={};for(const action of ['swap','replace']){try{const result=await prepare(repo,user,{...input,action});actions[action]={items:[result.left.view,result.right.view]};}catch(error){actions[action]={error:error.message};}}return {actions};
 }
 const result=await prepare(repo,user,input);
 if(input.model===true){if(input.confirmed)throw problem('La composition doit être appliquée depuis son éditeur.');return {items:[result.left.view,result.right.view]};}
 if(input.confirmed!==true)throw problem('Confirmez le déplacement.');
 const db=repo.client;
 await db.query('BEGIN');try{
  // Recheck the two services while holding their rows, before either change is written.
  const rows=await repo.rows('SELECT * FROM catering.planned_services WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[[result.from.id,result.to.id]]);
  if(rows.length!==2)throw problem('Le planning a changé. Recommencez.',409);
  for(const change of result.changes){const current=await repo.getPlanned(change.plannedId);await require('./diet-drag-proposals.cjs').check(repo,current,change.fingerprint,{approval:user.role==='diet'});}
  if(user.role==='diet'){
   const payload={type:'variant',manual:true,sourceId:result.from.id,targetId:result.to.id,targetFingerprint:input.targetFingerprint,changes:result.changes,snapshot:result.left.graph,components:result.left.view.components,label:input.action==='swap'?'Échange de deux plats':'Déplacement d’un plat'};
   await db.query('INSERT INTO paperchef.proposals(id,planned_id,user_id,template_id,base_fingerprint,note,payload) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[randomUUID(),result.from.id,user.id,result.from.service_template_id,input.fingerprint,payload.label,JSON.stringify(payload)]);
   await event(db,user,'diet.proposed',{weekId:result.from.week_id,count:1,manual:true});
  }else{
   for(const change of result.changes)await db.query('UPDATE catering.planned_services SET variant_snapshot=$2::jsonb WHERE id=$1',[change.plannedId,JSON.stringify(change.snapshot)]);
   await event(db,user,'menu.changed',{weekId:result.from.week_id,manual:true,changes:[result.from,result.to].map(p=>({id:p.id,date:p.service_date,period:p.meal_period}))});
  }
  await db.query('COMMIT');return {saved:true,proposed:user.role==='diet'};
 }catch(error){await db.query('ROLLBACK');throw error;}
}
module.exports={prepare,handle};
