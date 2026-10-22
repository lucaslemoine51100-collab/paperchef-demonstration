'use strict';
const fs=require('node:fs'),path=require('node:path');
const file=path.join(__dirname,'coherent-services.json');let cached=null,stamp='';
function current(){const stat=fs.statSync(file),next=stat.mtimeMs+':'+stat.size;if(next!==stamp){cached=JSON.parse(fs.readFileSync(file,'utf8'));stamp=next;}return cached;}
function revision(){current();return stamp;}
const engine=require('./core/planning/service-coherence');
function specs(id,settings=current()){return (settings.services.find(s=>s.serviceId===id)?.variants||[]).map((v,i)=>({...v,id:'coherent-'+i,title:v.label,starch:v.items.filter(x=>settings.profiles[x.dishId]?.role==='starch').map(x=>settings.profiles[x.dishId].name).join(' · '),vegetable:v.items.filter(x=>settings.profiles[x.dishId]?.role==='vegetable').map(x=>settings.profiles[x.dishId].name).join(' · '),sauces:v.items.filter(x=>settings.profiles[x.dishId]?.role==='sauce').map(x=>({name:settings.profiles[x.dishId].name,destination:({all:'Commune',meat:'Viande',fish:'Poisson'})[x.destination]||'Commune'})),note:'Les protéines, accompagnements et sauces associés changent ensemble. Les créneaux sont recalculés.'}));}
function assess(snapshot,settings=current()){
 const id=snapshot.service.service_template_id||snapshot.variant?.templateId||snapshot.service.id;
 if(!settings.services.some(s=>s.serviceId===id))return null;
 const profiles=structuredClone(settings.profiles);
 for(const c of snapshot.components){if(profiles[c.dish_id]){profiles[c.dish_id].name=c.name;const tags=(c.classification_tags||[]).map(t=>t.name);profiles[c.dish_id].carvingRequired=tags.includes('Rôti / braisé');profiles[c.dish_id].weekdayLunchOnly=tags.includes('Sauté mijoté')||tags.includes('Mijoté court');}}
 return engine.evaluate({items:snapshot.components.filter(c=>c.active!==false).map(c=>({dishId:c.dish_id,destination:c.portion_group}))},profiles);
}
async function build(repo,templateId,spec){
 const variants=require('./service-variants.cjs'),{DishRepository}=require('./core/persistence/dishes');
 const source=await repo.templates.loadService(templateId),bundles=new Map();
 const dishes=new DishRepository(repo.client);
 for(const [index,item]of spec.items.entries()){
  const original=source.components.find(c=>c.dish_id===item.dishId);let graph;
  if(original)graph=variants.prune(source,new Set([original.id]));
  else graph=await require('./variant-performance.cjs').memo(repo,'coherent-dish:'+item.dishId,async()=>{const data=await dishes.dishDetail(item.dishId);if(!data.dish.active)throw Error('Plat désactivé : '+data.dish.name);if(data.dish.linkedPreparation)throw Error('Préparation liée à réexaminer : '+data.dish.name);return (await dishes.bundle(item.dishId)).snapshot;});
  bundles.set(item.dishId,graph);
 }
 return compose(source,templateId,spec,bundles);
}
function compose(source,templateId,spec,bundles,settings=current()){
 const variants=require('./service-variants.cjs'),out=variants.prune(source,new Set());
 for(const [index,item] of spec.items.entries()){
  let graph=bundles.get(item.dishId);if(!graph)throw Error('Recette manquante.');
  graph=variants.rename(graph,'coherent-'+index+'-');
  if(graph.components.length!==1)throw Error('Une recette autonome est nécessaire.');
  const component=graph.components[0];if(settings.profiles[item.dishId]?.role==='sauce')component.portion_group=item.destination;
  variants.merge(out,graph);
 }
 variants.orderComponents(out);out.variant={templateId,choiceId:spec.id,label:spec.title,createdAt:new Date().toISOString()};
 out.service.display_name=require('./core/pwa/public/service-title').build(out);
 const check=assess(out,settings);if(!check?.valid)throw Error(check?.errors.join(' · ')||'Profil de service manquant.');
 variants.validateCalculation(out);return out;
}
module.exports={specs,assess,build,compose,revision,serviceIds:()=>current().services.map(s=>s.serviceId)};
