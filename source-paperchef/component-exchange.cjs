const {randomUUID}=require('node:crypto'),{problem,event}=require('./accounts.cjs'),variants=require('./service-variants.cjs'),{check}=require('./diet-drag-proposals.cjs');
const categoryNames={starch:'Starch',vegetable:'Vegetable',sauce:'Sauce'};
function names(graph,key){return graph.components.filter(c=>graph.categories.some(k=>k.component_id===c.id&&k.category===categoryNames[key])).map(c=>c.name).sort();}
async function replacement(repo,p,current,key,wanted){
 if(!wanted.length)return variants.withHoles(current,[...(current.variant?.holes||[]),key]);
 const candidates=[await repo.templates.loadService(p.service_template_id)];for(const spec of variants.specs(p.service_template_id)){try{candidates.push(await variants.build(repo,p.service_template_id,spec));}catch{}}
 const matching=candidates.filter(g=>JSON.stringify(names(g,key))===JSON.stringify(wanted));matching.sort((a,b)=>a.components.filter(c=>!current.components.some(x=>x.name===c.name)).length-b.components.filter(c=>!current.components.some(x=>x.name===c.name)).length);
 for(const candidate of matching){try{const graph=await require('./component-choices.cjs').build(repo,p.service_template_id,current.variant?.choiceId||'original',{...(current.variant?.componentChoices||{}),[key]:candidate.variant?.choiceId||'original'});return variants.withHoles(graph,(current.variant?.holes||[]).filter(x=>x!==key));}catch{}}
 throw problem('Aucune association étudiée compatible. Choisissez une variante avec le bouton ⇄.',409);
}
async function prepare(repo,user,input){
 if(!variants.enabled()||!['cook','store','diet'].includes(user.role))throw problem('Déplacement indisponible.',403);
 const action=input.action||'swap';if(!['swap','replace'].includes(action)||!categoryNames[input.category])throw problem('Action invalide.');
 let from,to,a,b;
 if(input.model){
  if(input.confirmed)throw problem('La composition doit être appliquée depuis son éditeur.');
  const load=async value=>{const spec=variants.specs(value.templateId).find(s=>s.id===value.choiceId);if(value.choiceId!==undefined&&value.choiceId!=='original'&&!spec)throw problem('Variante inconnue.');return variants.withHoles(value.componentChoices?await require('./component-choices.cjs').build(repo,value.templateId,value.choiceId,value.componentChoices):spec?await variants.build(repo,value.templateId,spec):await repo.templates.loadService(value.templateId),value.holes);};
  from={service_template_id:input.source.templateId,cover_count:100};to={service_template_id:input.target.templateId,cover_count:100};a=await load(input.source);b=await load(input.target);
 }else{
  if(input.sourceId===input.targetId)throw problem('Choisissez deux services différents.');
  from=await repo.getPlanned(input.sourceId);to=await repo.getPlanned(input.targetId);if(from.week_id!==to.week_id)throw problem('Déplacement réservé à la même semaine.');
  await check(repo,from,input.fingerprint,{approval:user.role==='diet'});await check(repo,to,input.targetFingerprint,{approval:user.role==='diet'});a=await repo.loadService(from.id);b=await repo.loadService(to.id);
 }
 const left=names(a,input.category),right=names(b,input.category);if(!left.length||JSON.stringify(left)===JSON.stringify(right))throw problem('Choisissez deux accompagnements différents de même catégorie.');
 const ga=action==='replace'?variants.withHoles(a,[...(a.variant?.holes||[]),input.category]):await replacement(repo,from,a,input.category,right),gb=await replacement(repo,to,b,input.category,left);
 variants.validateCalculation(ga,from.cover_count);variants.validateCalculation(gb,to.cover_count);
 const changes=[{plannedId:from.id,fingerprint:input.fingerprint,snapshot:ga},{plannedId:to.id,fingerprint:input.targetFingerprint,snapshot:gb}],warnings=input.model?[]:await variants.weekIssues(repo,from,ga,{changes:{[from.id]:ga,[to.id]:gb}});
 const item=g=>({id:g.variant?.choiceId||'original',holes:g.variant?.holes||[],...require('./component-choices.cjs').view(g,input.category),components:variants.display(g),features:require('./core/planning/random-week').features(g)});
 return {from,to,changes,warnings,items:[item(ga),item(gb)],rows:[{date:from.service_date||'Service de départ',period:from.meal_period,before:variants.display(a),after:variants.display(ga),holes:ga.variant?.holes||[]},{date:to.service_date||'Service d’arrivée',period:to.meal_period,before:variants.display(b),after:variants.display(gb),holes:gb.variant?.holes||[]}]};
}
async function handle(repo,user,input){
 if(input.action==='preview'){
  if(input.confirmed)throw problem('Action invalide.');const actions={};for(const action of ['swap','replace']){try{const r=await prepare(repo,user,{...input,action});actions[action]={rows:r.rows,warnings:r.warnings,items:r.items};}catch(e){actions[action]={error:e.message};}}return {actions};
 }
 const result=await prepare(repo,user,input);if(input.confirmed!==true)return {rows:result.rows,warnings:result.warnings,items:result.items};
 if(user.role!=='diet'&&result.warnings.length&&input.force!==true)throw problem(result.warnings.join(' · '),409);
 await repo.client.query('BEGIN');try{
  if(user.role==='diet'){const payload={type:'variant',sourceId:result.from.id,targetId:result.to.id,targetFingerprint:input.targetFingerprint,changes:result.changes,rows:result.rows,snapshot:result.changes[0].snapshot,components:result.rows[0].after,label:input.action==='replace'?'Déplacement d’un accompagnement · emplacement à compléter':'Échange des accompagnements'};
   await repo.client.query('INSERT INTO paperchef.proposals(id,planned_id,user_id,template_id,base_fingerprint,note,payload) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[randomUUID(),result.from.id,user.id,result.from.service_template_id,input.fingerprint,payload.label,JSON.stringify(payload)]);await event(repo.client,user,'diet.proposed',{weekId:result.from.week_id,count:1});
  }else{for(const change of result.changes)await repo.client.query('UPDATE catering.planned_services SET variant_snapshot=$2::jsonb WHERE id=$1',[change.plannedId,JSON.stringify(change.snapshot)]);await event(repo.client,user,'menu.changed',{weekId:result.from.week_id,forced:input.force===true,changes:[result.from,result.to].map(p=>({id:p.id,date:p.service_date,period:p.meal_period}))});}
  await repo.client.query('COMMIT');return {saved:true};
 }catch(e){await repo.client.query('ROLLBACK');throw e;}
}
async function dragData(repo,weekId,templateId,choiceId,holes){
 const features=require('./core/planning/random-week').features;
 const summary=g=>({components:variants.display(g),features:features(g),holes:g.variant?.holes||[]});
 const catalogue=async(id,empty=[])=>require('./variant-performance.cjs').memo(repo,'drag:'+require('./coherent-variants.cjs').revision()+':'+id+':'+JSON.stringify(empty),async()=>{
  const graphs=[await repo.templates.loadService(id)];for(const spec of variants.specs(id)){try{graphs.push(await variants.build(repo,id,spec));}catch{}}
  // Several destinations share the same graph when no category is empty.
  // Compute and validate that view once, while returning independent copies.
  const choices={},prepared=new Map();for(const key of Object.keys(categoryNames)){choices[key]=[];for(const graph of graphs){let views=prepared.get(graph);if(!views){views=new Map();prepared.set(graph,views);}const holes=empty.filter(x=>x!==key),signature=JSON.stringify(holes);if(!views.has(signature)){try{views.set(signature,summary(variants.withHoles(graph,holes)));}catch{views.set(signature,null);}}const view=views.get(signature);if(view)choices[key].push(structuredClone(view));}}return choices;
 });
 if(templateId){const spec=variants.specs(templateId).find(s=>s.id===choiceId),current=variants.withHoles(spec?await variants.build(repo,templateId,spec):await repo.templates.loadService(templateId),holes),empty={};for(const key of Object.keys(categoryNames)){try{empty[key]=summary(variants.withHoles(current,[...(current.variant?.holes||[]),key]));}catch(e){empty[key]={error:e.message};}}return {templateId,current:summary(current),empty,choices:await catalogue(templateId,current.variant?.holes||[])};}
 const context=await variants.weekContext(repo,weekId),rows=[];
 for(const p of context.rows){const current=await repo.loadService(p.id),empty={};for(const key of Object.keys(categoryNames)){try{empty[key]=summary(variants.withHoles(current,[...(current.variant?.holes||[]),key]));}catch(e){empty[key]={error:e.message};}}
  rows.push({id:p.id,templateId:p.service_template_id,state:p.state,current:summary(current),empty,choices:await catalogue(p.service_template_id,current.variant?.holes||[])});
 }
 return {weekId,start:context.start,catalog:context.catalog,classifications:context.aliases,slots:context.slots,old:context.old,rows};
}
module.exports={handle,prepare,dragData};
