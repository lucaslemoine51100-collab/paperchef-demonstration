const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {problem,event}=require('./accounts.cjs');
const {toDomain,createCalculator}=require('./core/persistence/adapter');
const definitions=require('./service-variants.json');
const enabled=()=>process.env.PAPERCHEF_VARIANTS!=='0'&&JSON.parse(fs.readFileSync(path.join(__dirname,'service-variants-settings.json'),'utf8')).enabled===true;
async function initialize(db){await db.query('ALTER TABLE catering.planned_services ADD COLUMN IF NOT EXISTS variant_snapshot jsonb');}
function prune(graph,ids){
 const out=structuredClone(graph);out.components=out.components.filter(c=>ids.has(c.id));out.categories=out.categories.filter(c=>ids.has(c.component_id));
 out.inputs=out.inputs.filter(i=>ids.has(i.component_id));const allocations=new Set(out.inputs.map(i=>i.allocation_id));
 out.allocations=out.allocations.filter(a=>allocations.has(a.id));const shared=new Set(out.allocations.map(a=>a.shared_preparation_id));
 out.shared=out.shared.filter(p=>shared.has(p.id));
 // A partially retained preparation must follow its actual recipients, not all original covers.
 for(const prep of out.shared){const old=graph.allocations.filter(a=>a.shared_preparation_id===prep.id),next=out.allocations.filter(a=>a.shared_preparation_id===prep.id);if(old.length!==next.length&&next.some(a=>a.allocation_mode!=='component_portions'))throw Error('Préparation commune à réexaminer avant de proposer cette association.');}
 out.menuContributions=out.menuContributions.filter(m=>ids.has(m.source_component_id)&&ids.has(m.target_component_id));
 for(const c of out.components)if(c.linked_component_id&&!ids.has(c.linked_component_id))throw Error('Ce plat nécessite un autre composant lié.');
 const recipes=new Set([...out.components,...out.shared].map(c=>c.recipe_id));out.recipes=out.recipes.filter(r=>recipes.has(r.id));out.ingredients=out.ingredients.filter(i=>recipes.has(i.recipe_id));out.overrides=out.overrides.filter(o=>recipes.has(o.recipe_id));
 return out;
}
function rename(graph,prefix){
 const out=structuredClone(graph),cid=x=>x?prefix+x:x;
 out.components.forEach(c=>{c.id=cid(c.id);c.domain_key=cid(c.domain_key);c.linked_component_id=cid(c.linked_component_id);for(const k of ['profile_key','generic_rule_key','service_sauce_key'])if(c[k])c[k]=cid(c[k]);});
 out.shared.forEach(p=>{p.id=cid(p.id);p.domain_key=cid(p.domain_key);});
 out.categories.forEach(c=>c.component_id=cid(c.component_id));
 out.allocations.forEach(a=>{a.id=cid(a.id);a.component_id=cid(a.component_id);a.shared_preparation_id=cid(a.shared_preparation_id);});
 out.inputs.forEach(i=>{i.component_id=cid(i.component_id);i.allocation_id=cid(i.allocation_id);});
 out.bindings.forEach(b=>b.rule_key=cid(b.rule_key));out.menuContributions.forEach(m=>{m.source_component_id=cid(m.source_component_id);m.target_component_id=cid(m.target_component_id);});
 return out;
}
function merge(base,addition){
 for(const key of ['components','categories','shared','allocations','inputs','bindings','menuContributions'])base[key].push(...addition[key]);
 for(const key of ['recipes','ingredients','overrides','rules','units','rounding','ruleIngredients','purchaseConversions','purchaseUnits','purchaseUnitConversions']){base[key]??=[];const identity=r=>JSON.stringify(key==='ingredients'?[r.recipe_id,r.sort_order]:key==='overrides'?[r.recipe_id,r.profile_id]:key==='ruleIngredients'?[r.profile_id,r.ingredient_id]:r.id||r),seen=new Set(base[key].map(identity));for(const row of addition[key]||[]){const id=identity(row);if(!seen.has(id)){seen.add(id);base[key].push(row);}}}
 return base;
}
function group(snapshot,c){return snapshot.categories.filter(k=>k.component_id===c.id).map(k=>k.category);}
function orderComponents(graph){
 const ranks={Protein:0,Starch:1,Vegetable:2,Sauce:3};
 const rank=c=>Math.min(4,...group(graph,c).map(k=>ranks[k]??4));
 graph.components.sort((a,b)=>rank(a)-rank(b));
 graph.components.forEach((c,i)=>c.sort_order=i);return graph;
}
function specs(id){const coherent=require('./coherent-variants.cjs').specs(id);const d=definitions.find(d=>d.serviceId===id);if(!d)return coherent;const all=[...(d.linkedExtensions||[]),...(d.combinations||[]).map(c=>({starch:c.starch,vegetable:c.vegetable,preserveSauces:c.externalSauce==null,sauces:c.externalSauce?[{name:c.externalSauce,destination:/volaille|poivre/i.test(c.externalSauce)?'Viande':/beurre blanc|oseille/i.test(c.externalSauce)?'Poisson':'Commune'}]:[],note:d.note||''})),...(d.additionalExtensions||[])];const seen=new Set();return all.filter(c=>{const k=JSON.stringify([c.starch,c.vegetable,c.sauces,!!c.preserveSauces]);if(seen.has(k))return false;seen.add(k);return true;}).map((c,i)=>({...c,id:String(i),title:[c.starch,...c.sauces.map(s=>s.name)].filter(Boolean).join(' · ')})).concat(coherent);}
async function build(repo,templateId,spec){return require('./variant-performance.cjs').memo(repo,'variant:'+templateId+':'+JSON.stringify(spec),()=>buildRaw(repo,templateId,spec));}
async function buildRaw(repo,templateId,spec){
 if(spec.items)return require('./coherent-variants.cjs').build(repo,templateId,spec);
 const source=await repo.templates.loadService(templateId),keep=new Set();
 const desired=[...(spec.starch?[{name:spec.starch,category:'Starch',destination:'Commune'}]:[]),...(spec.vegetable?[{name:spec.vegetable,category:'Vegetable',destination:'Commune'}]:[]),...spec.sauces.map(s=>({...s,category:'Sauce'}))];
 for(const c of source.components){const cats=group(source,c);if(cats.includes('Protein')||spec.preserveSauces&&cats.includes('Sauce')||!cats.some(k=>['Starch','Vegetable','Sauce'].includes(k)))keep.add(c.id);}
 const additions=[];
 for(const item of desired){const existing=source.components.find(c=>c.name===item.name&&group(source,c).includes(item.category));if(existing){keep.add(existing.id);continue;}
  let graph=await require('./variant-performance.cjs').memo(repo,'variant-dish:'+item.name,async()=>{
  const candidates=(await repo.rows('SELECT id FROM catering.dishes WHERE active AND name=$1 ORDER BY id',[item.name]));if(candidates.length!==1)throw Error('Plat indisponible ou ambigu : '+item.name);
  const dishes=new(require('./core/persistence/dishes').DishRepository)(repo.client),data=await dishes.dishDetail(candidates[0].id);
  let graph;
  if(data.dish.linkedPreparation){graph=await dishes.standalone(data);}else{const bundle=await dishes.bundle(data.dish.id);graph=bundle.snapshot;const component=graph.components.find(c=>c.dish_id===data.dish.id||c.recipe_id===data.recipe.id);if(!component)throw Error('Recette autonome indisponible.');graph=prune(graph,new Set([component.id]));}
  return graph;
  });
  graph=rename(graph,'variant-'+additions.length+'-');
  const c=graph.components[0];if(!group(graph,c).includes(item.category))throw Error('Catégorie incompatible : '+item.name);
  c.portion_group=/^Viande$/i.test(item.destination)?'meat':/^Poisson$/i.test(item.destination)?'fish':'all';
  if(c.portion_group==='all'&&c.service_sauce_key)throw Error('Destinataire de la sauce à réexaminer.');
  additions.push(graph);
 }
 const out=prune(source,keep);for(const addition of additions)merge(out,addition);
 orderComponents(out);
 out.service.display_name=require('./core/pwa/public/service-title').build(out);
 out.variant={templateId,choiceId:spec.id,label:spec.title,createdAt:new Date().toISOString()};
 validateCalculation(out);return out;
}
function validateCalculation(graph,count=100){const copy=structuredClone(graph);copy.service.headcount=String(count);const mapped=toDomain(copy);return createCalculator({[copy.service.id]:mapped.service})(count,copy.service.id);}
function display(graph){return orderComponents(structuredClone(graph)).components.filter(c=>c.active!==false&&c.menu_visible!==false).map(c=>({id:c.id,name:c.name,categories:graph.categories.filter(k=>k.component_id===c.id).map(k=>[({Protein:'Protéine',Starch:'Féculent',Vegetable:'Légume',Sauce:'Sauce'})[k.category]||k.category,({Meat:'Viande',Fish:'Poisson',Vegetarian:'Végétarien'})[k.subcategory]].filter(Boolean))}));}
const holeCategories={starch:'Starch',vegetable:'Vegetable',sauce:'Sauce'};
function holes(value){const list=typeof value==='string'?value.split(',').filter(Boolean):value||[];if(!Array.isArray(list)||list.some(x=>!holeCategories[x]))throw problem('Emplacement vide invalide.');return [...new Set(list)];}
function withHoles(graph,value){
 const empty=holes(value),removed=new Set(graph.categories.filter(k=>empty.some(x=>holeCategories[x]===k.category)).map(k=>k.component_id));
 if(graph.categories.some(k=>removed.has(k.component_id)&&k.category==='Protein'))throw problem('Ce plat complet ne peut pas être séparé de sa protéine.',409);
 const out=prune(graph,new Set(graph.components.filter(c=>!removed.has(c.id)).map(c=>c.id)));
 out.variant={...graph.variant,choiceId:graph.variant?.choiceId??'original',holes:empty};validateCalculation(out);return out;
}
async function weekContext(repo,weekId){
 const rows=await repo.weekServices(weekId),week=await repo.getWeek(weekId),start=String(week.start_date).slice(0,10),rules=require('./core/pwa/public/week-rules'),features=require('./core/planning/random-week').features;
 const classes=JSON.parse(fs.readFileSync(process.env.PAPERCHEF_CLASSIFICATIONS_FILE||path.join(__dirname,'core/planning/week-template-classifications.json'),'utf8')).services,catalog=[],aliases={},slots=[];
 for(const p of rows){catalog.push({id:p.id,...features(await repo.loadService(p.id))});aliases[p.id]=classes[p.service_template_id];slots.push({day:Math.round((new Date(p.service_date+'T12:00:00Z')-new Date(start+'T12:00:00Z'))/86400000),period:p.meal_period,serviceId:p.id});}
 return {rows,start,classes,catalog,aliases,slots,old:rules.changedIssues([],slots,catalog,aliases,start,{allowIncomplete:rows.length<14})};
}
async function weekIssues(){return [];}
async function options(repo,input){
 const planned=input.plannedId?await repo.getPlanned(input.plannedId):null,templateId=planned?.service_template_id||input.templateId;
 const selected=input.choiceId!==undefined?specs(templateId).find(s=>s.id===input.choiceId):null;const current=input.componentChoices?await require('./component-choices.cjs').build(repo,templateId,input.baseChoice||input.choiceId||'original',input.componentChoices):planned?await repo.loadService(planned.id):selected?await build(repo,templateId,selected):await repo.templates.loadService(templateId),items=[];
 const empty=holes(planned?.variant_snapshot?.variant?.holes||input.holes),remaining=input.fillCategory?empty.filter(x=>x!==input.fillCategory):[];if(!planned&&empty.length)Object.assign(current,withHoles(current,empty));const context=planned?await weekContext(repo,planned.week_id):null;
 const projections=await require('./variant-performance.cjs').memo(repo,'variant-options:'+require('./coherent-variants.cjs').revision()+':'+templateId+':'+JSON.stringify(remaining),async()=>{const result=[];for(const spec of specs(templateId)){try{const built=await build(repo,templateId,spec),graph=remaining.length?withHoles(built,remaining):built;result.push({...spec,holes:remaining,features:require('./core/planning/random-week').features(graph),components:display(graph)});}catch(e){result.push({...spec,components:[],error:e.message});}}return result;});
 for(const item of projections){const warnings=item.error?[item.error]:planned?await weekIssues(repo,planned,null,{context,nextFeatures:item.features}):[];items.push({...item,warnings,available:!warnings.length});}
 if(empty.length||current.variant?.componentChoices||input.componentChoices){const graph=withHoles(await repo.templates.loadService(templateId),remaining),warnings=planned?await weekIssues(repo,planned,graph,{context}):[];items.unshift({id:'original',title:'Composition d’origine',starch:'Composition d’origine',sauces:[],holes:remaining,features:require('./core/planning/random-week').features(graph),components:display(graph),warnings,available:!warnings.length});}
 const order=planned?(await repo.rows('SELECT done FROM paperchef.orders WHERE planned_id=$1',[planned.id]))[0]?.done:false;
 return {enabled:enabled(),planned,templateId,current:display(current),holes:empty,currentFeatures:require('./core/planning/random-week').features(current),currentChoiceId:current.variant?.choiceId,currentComponentChoices:current.variant?.componentChoices||{},hasVariant:!!planned?.variant_snapshot,items,locked:!!order||planned?.state==='served',fingerprint:planned?await require('./workflow.cjs').fingerprint(repo,planned):null};
}
async function apply(repo,user,input){
 if(!enabled())throw problem('Les variantes sont désactivées.',403);
 if(!['cook','store'].includes(user.role))throw problem('Modification réservée au cuisinier et au magasinier.',403);
 if(input.restore!==undefined&&typeof input.restore!=='boolean')throw problem('Action de restauration invalide.');
 const p=await repo.getPlanned(input.plannedId);if(p.state==='served'||(await repo.rows('SELECT done FROM paperchef.orders WHERE planned_id=$1',[p.id]))[0]?.done)throw problem('Commande faite ou service clôturé : modification bloquée.',409);
 if(await require('./workflow.cjs').fingerprint(repo,p)!==input.fingerprint)throw problem('Le service a changé. Rouvrez les variantes.',409);
 const original=await repo.templates.loadService(p.service_template_id),spec=specs(p.service_template_id).find(s=>s.id===input.choiceId);
 if(!input.restore&&input.choiceId!=='original'&&!spec)throw problem('Variante inconnue.');const empty=holes(p.variant_snapshot?.variant?.holes);const graph=input.restore?original:input.componentChoices?withHoles(await require('./component-choices.cjs').build(repo,p.service_template_id,input.choiceId,input.componentChoices),input.holes??empty):withHoles(spec?await build(repo,p.service_template_id,spec):original,input.fillCategory?empty.filter(x=>x!==input.fillCategory):[]);
 const warnings=await weekIssues(repo,p,graph);if(warnings.length&&input.force!==true)throw problem(warnings.join(' · '),409);validateCalculation(graph,p.cover_count);
 await repo.client.query('UPDATE catering.planned_services SET variant_snapshot=$2::jsonb WHERE id=$1',[p.id,input.restore?null:JSON.stringify(graph)]);
 await event(repo.client,user,'menu.changed',{weekId:p.week_id,changes:[{id:p.id,date:p.service_date,period:p.meal_period}],variant:input.restore||!spec?'original':spec.title});
 return {saved:true,id:p.id};
}
async function propose(repo,user,input){
 if(!enabled()||user.role!=='diet')throw problem('Proposition indisponible.',403);
 const p=await repo.getPlanned(input.plannedId),wf=require('./workflow.cjs');
 if(p.state==='served'||(await repo.rows('SELECT done FROM paperchef.orders WHERE planned_id=$1',[p.id]))[0]?.done)throw problem('Commande faite : proposition bloquée.',409);
 const fp=await wf.fingerprint(repo,p);if(fp!==input.fingerprint)throw problem('Le planning a changé. Rouvrez les variantes.',409);
 if((await repo.rows('SELECT planned_id FROM paperchef.approvals WHERE planned_id=$1 AND fingerprint=$2',[p.id,fp])).length)throw problem('Ce service est déjà approuvé.',409);
 const templateId=input.templateId||p.service_template_id,spec=specs(templateId).find(s=>s.id===input.choiceId);if(!spec&&input.choiceId!=='original')throw problem('Variante inconnue.');
 const empty=holes(p.variant_snapshot?.variant?.holes),graph=input.componentChoices?withHoles(await require('./component-choices.cjs').build(repo,templateId,input.choiceId,input.componentChoices),input.holes??empty):withHoles(spec?await build(repo,templateId,spec):await repo.templates.loadService(templateId),input.fillCategory?empty.filter(x=>x!==input.fillCategory):[]);validateCalculation(graph,p.cover_count);
 
 const payload={type:'variant',templateId,choiceId:spec?.id||'original',components:display(graph),label:spec?.title||'Composition d’origine',snapshot:graph};
 await repo.client.query('INSERT INTO paperchef.proposals(id,planned_id,user_id,template_id,base_fingerprint,note,payload) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[crypto.randomUUID(),p.id,user.id,p.service_template_id,fp,payload.label,JSON.stringify(payload)]);
 await event(repo.client,user,'diet.proposed',{weekId:p.week_id,count:1});return {saved:true};
}
async function decide(repo,user,input,proposal){
 const p=await repo.getPlanned(proposal.planned_id);
 const changes=proposal.payload.changes||[{plannedId:p.id,fingerprint:proposal.base_fingerprint,snapshot:proposal.payload.snapshot}];
 if(input.action==='accept'){
  for(const change of changes)await require('./diet-drag-proposals.cjs').check(repo,await repo.getPlanned(change.plannedId),change.fingerprint,{approval:false});
  if(p.state==='served'||(await repo.rows('SELECT done FROM paperchef.orders WHERE planned_id=$1',[p.id]))[0]?.done)throw problem('Rouvrez la commande avant de décider.',409);
  if(await require('./workflow.cjs').fingerprint(repo,p)!==proposal.base_fingerprint)throw problem('Le planning a changé : proposition à revoir.',409);
  const issues=await weekIssues(repo,p,changes[0].snapshot,{templateId:proposal.payload.templateId||p.service_template_id,changes:Object.fromEntries(changes.map(c=>[c.plannedId,c.snapshot]))});if(issues.length&&input.force!==true)throw problem(issues.join(' · '),409);
  validateCalculation(proposal.payload.snapshot,p.cover_count);
 }
 await repo.client.query('BEGIN');try{
  if(input.action==='accept'&&proposal.payload.templateId)await repo.client.query('UPDATE catering.planned_services SET service_template_id=$2 WHERE id=$1',[p.id,proposal.payload.templateId]);
  if(input.action==='accept')for(const change of changes)await repo.client.query('UPDATE catering.planned_services SET variant_snapshot=$2::jsonb WHERE id=$1',[change.plannedId,JSON.stringify(change.snapshot)]);
  if(input.action==='accept')await require('./workflow.cjs').approveAccepted(repo,proposal,changes.map(c=>c.plannedId));
  await repo.client.query('UPDATE paperchef.proposals SET status=$2,decided_by=$3 WHERE id=$1',[proposal.id,input.action==='accept'?'accepted':'rejected',user.id]);
  await event(repo.client,user,'diet.'+input.action,{proposalId:proposal.id,forced:input.force===true});await repo.client.query('COMMIT');
 }catch(e){await repo.client.query('ROLLBACK');throw e;}return {saved:true};
}
module.exports={serviceIds:()=>[...new Set([...definitions.map(d=>d.serviceId),...require('./coherent-variants.cjs').serviceIds()])],orderComponents,weekContext,holes,withHoles,initialize,enabled,build,specs,options,apply,propose,decide,prune,rename,merge,validateCalculation,display,weekIssues};
