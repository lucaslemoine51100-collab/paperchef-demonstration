const rules=require('../pwa/public/week-rules');
function shuffled(list,random){const result=[...list];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
// First draw a service family, then a composition: extra variants must not buy extra chances.
function shuffledServices(list,random){const groups=new Map();for(const service of list){if(!groups.has(service.id))groups.set(service.id,[]);groups.get(service.id).push(service);}return shuffled([...groups.values()],random).flatMap(group=>shuffled(group,random));}
function generateWeek(services,classifications,random=Math.random,options={}){
 const slots=Array.from({length:14},(_,i)=>({day:Math.floor(i/2),period:i%2?'dinner':'lunch'}));
 const candidates=slots.map(s=>shuffledServices(services.filter(x=>!(s.day<5&&s.period==='lunch'&&(x.proteinKeys||[]).some(k=>(options.blockedProteins||[]).includes(k)))&&!rules.reason(x,s,[],classifications,options)),random));
 // Select feasible vegetarian positions across the whole week, without favouring an early day.
 const vegetarianSets={2:[],3:[]};
 function positions(from,chosen){if(chosen.length>=2)vegetarianSets[chosen.length].push([...chosen]);if(chosen.length===3)return;for(let i=from;i<14;i++){const slot=slots[i];if(!candidates[i].some(s=>s.vegetarian)||chosen.some(j=>Math.abs(slots[j].day-slot.day)<2)||slot.day<5&&slot.period==='lunch'&&chosen.some(j=>slots[j].day<5&&slots[j].period==='lunch'))continue;positions(i+1,[...chosen,i]);}}
 positions(0,[]);const sizes=[2,3].filter(n=>vegetarianSets[n].length),size=sizes[Math.floor(random()*sizes.length)],sets=vegetarianSets[size]||[[]],vegetarianTargets=sets[Math.floor(random()*sets.length)];
 const legumeSlots=slots.map((_,i)=>i).filter(i=>candidates[i].some(s=>s.legume)),legumeTarget=legumeSlots[Math.floor(random()*legumeSlots.length)];
 for(let i=0;i<14;i++)if(!candidates[i].length)throw Error('Aucun service autorisé pour '+['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'][slots[i].day]+' '+(slots[i].period==='lunch'?'midi':'soir')+'. Vérifiez le classement.');
 const order=shuffled(slots.map((_,i)=>i),random).sort((a,b)=>candidates[a].length-candidates[b].length),used=new Set(),chosen=[];let attempts=0;
 function search(depth,veg,legume){if(++attempts>1000000)return false;if(depth===14)return veg>=2&&legume>=1;if(veg+14-depth<2)return false;const available=services.filter(s=>!used.has(s.id));if(veg<2&&!available.some(s=>s.vegetarian)||!legume&&!available.some(s=>s.legume))return false;const remaining=order.slice(depth).map(i=>({i,valid:candidates[i].filter(x=>!rules.reason(x,slots[i],chosen.flatMap((service,j)=>service?[{...slots[j],service}]:[]),classifications,options))})).sort((a,b)=>a.valid.length-b.valid.length);const next=remaining[0];if(!next.valid.length)return false;if(veg+remaining.filter(r=>r.valid.some(s=>s.vegetarian)).length<2||!legume&&!remaining.some(r=>r.valid.some(s=>s.legume)))return false;next.valid.sort((a,b)=>(vegetarianTargets.includes(next.i)?Number(b.vegetarian)-Number(a.vegetarian):Number(a.vegetarian)-Number(b.vegetarian))||(!legume&&next.i===legumeTarget?Number(b.legume)-Number(a.legume):0));const old=order[depth],swap=order.indexOf(next.i);order[depth]=next.i;order[swap]=old;for(const x of next.valid){used.add(x.id);chosen[next.i]=x;if(search(depth+1,veg+!!x.vegetarian,legume+!!x.legume))return true;used.delete(x.id);delete chosen[next.i];}order[swap]=next.i;order[depth]=old;return false;}
 if(!search(0,0,0))throw Error('Aucune proposition trouvée respectant tous les blocages et l’espacement des accompagnements. Complétez manuellement ou ajoutez des services plus variés ; aucune règle n’a été assouplie.');
 return {slots:slots.map((s,i)=>({...s,serviceId:chosen[i].id,name:chosen[i].name,vegetarian:!!chosen[i].vegetarian,legume:!!chosen[i].legume,...(chosen[i].variantChoice!==undefined?{variantChoice:chosen[i].variantChoice,variantPreview:chosen[i].variantPreview}:{})})),vegetarianCount:chosen.filter(x=>x.vegetarian).length,legumeCount:chosen.filter(x=>x.legume).length};
}

function generateDay(services,classifications,day,draft,random=Math.random,options={}){
 if(!Number.isInteger(day)||day<0||day>6||!Array.isArray(draft)||draft.length!==14)throw Error('Jour ou composition invalide.');
 const periods=options.period===undefined?['lunch','dinner']:[options.period];
 if(periods.some(p=>!['lunch','dinner'].includes(p)))throw Error('Service invalide.');
 const positions=new Set();
 const resolved=draft.map(slot=>{
  const key=slot.day+':'+slot.period;
  if(!Number.isInteger(slot.day)||slot.day<0||slot.day>6||!['lunch','dinner'].includes(slot.period)||positions.has(key))throw Error('Créneau invalide ou répété.');
  positions.add(key);
  if(slot.day===day&&periods.includes(slot.period)||!slot.serviceId)return {...slot,service:null};
  const service=options.fixedServices?.[key]||services.find(s=>s.id===slot.serviceId&&(slot.variantChoice===undefined||slot.variantChoice==='original'?s.variantChoice===undefined:s.variantChoice===slot.variantChoice));
  if(!service)throw Error('Un service conservé est indisponible. Rechargez la composition.');
  return {...slot,service};
 });
 const fixed=resolved.filter(s=>s.service),old=draft.filter(s=>s.day===day);
 if(periods.length===1){
  const period=periods[0],previous=old.find(s=>s.period===period);
  const choices=services.filter(s=>!(day<5&&period==='lunch'&&(s.proteinKeys||[]).some(k=>(options.blockedProteins||[]).includes(k)))&&!rules.reason(s,{day,period},fixed,classifications,options)&&!(previous?.serviceId===s.id&&(previous.variantChoice||'original')===(s.variantChoice||'original'))).filter(s=>fixed.length!==13||([...fixed.map(x=>x.service),s].filter(x=>x.vegetarian).length>=2&&[...fixed.map(x=>x.service),s].some(x=>x.legume)));
  const ordered=shuffledServices(choices,random);
  if(!ordered.length)throw Error('Aucun autre service compatible avec les autres menus. Modifiez un créneau voisin ou relancez la semaine entière.');
  const s=ordered[0];return {slots:[{day,period,serviceId:s.id,...(s.variantChoice!==undefined?{variantChoice:s.variantChoice,variantPreview:s.variantPreview}:{})}]};
 }
 const identity=s=>s.serviceId+':'+(s.variantChoice||'original');
 const choices=['lunch','dinner'].map(period=>shuffledServices(services.filter(s=>!(day<5&&period==='lunch'&&(s.proteinKeys||[]).some(k=>(options.blockedProteins||[]).includes(k)))&&!rules.reason(s,{day,period},fixed,classifications,options)),random));
 let best=null,bestChanges=0;
 for(const lunch of choices[0])for(const dinner of choices[1]){
  if(rules.reason(dinner,{day,period:'dinner'},[...fixed,{day,period:'lunch',service:lunch}],classifications,options))continue;
  const all=[...fixed,{service:lunch},{service:dinner}];
  if(fixed.length===12&&(all.filter(x=>x.service.vegetarian).length<2||!all.some(x=>x.service.legume)))continue;
  const pair=[lunch,dinner],changes=pair.reduce((n,s,i)=>n+Number(identity({serviceId:s.id,variantChoice:s.variantChoice})!==identity(old.find(x=>x.period===(i?'dinner':'lunch'))||{})),0);
  if(changes>bestChanges){best=pair;bestChanges=changes;}if(bestChanges===2)break;
 }
 if(!best)throw Error('Aucun autre jour compatible avec les autres menus. Modifiez un jour voisin ou relancez la semaine entière.');
 return {slots:best.map((s,i)=>({day,period:i?'dinner':'lunch',serviceId:s.id,...(s.variantChoice!==undefined?{variantChoice:s.variantChoice,variantPreview:s.variantPreview}:{})}))};
}
function features(snapshot){const starch=new Set(snapshot.categories.filter(c=>c.category==='Starch').map(c=>c.component_id)),recipes=new Set(snapshot.components.filter(c=>starch.has(c.id)).map(c=>c.recipe_id));const mappings=[[/pâtes|lasagn|gnocchi/i,'Pâtes'],[/\briz\b/i,'Riz'],[/pomme.*terre|frites|pommes rissol/i,'Pommes de terre'],[/semoule|couscous/i,'Semoule'],[/boulgour/i,'Boulgour'],[/polenta/i,'Polenta'],[/lentill/i,'Lentilles'],[/pois cass/i,'Pois cassés'],[/haricot.*roug/i,'Haricots rouges'],[/haricot.*blanc|mogett/i,'Haricots blancs'],[/haricot.*vert/i,'Haricots verts'],[/haricot.*plat/i,'Haricots plats'],[/carotte/i,'Carottes'],[/brocoli/i,'Brocolis'],[/chou.fleur/i,'Chou-fleur'],[/épinard/i,'Épinards'],[/courgette/i,'Courgettes'],[/poireau/i,'Poireaux'],[/choucroute/i,'Choucroute'],[/salade verte/i,'Salade verte'],[/petits pois/i,'Petits pois'],[/ratatouille/i,'Ratatouille'],[/piperade/i,'Piperade'],[/poêlée orientale/i,'Poêlée orientale'],[/poêlée wok/i,'Poêlée wok'],[/légumes grillés/i,'Légumes grillés'],[/légumes couscous/i,'Légumes couscous']];const accompaniments=new Set();for(const c of snapshot.components){if(!snapshot.categories.some(k=>k.component_id===c.id&&['Starch','Vegetable'].includes(k.category)))continue;const main=snapshot.ingredients.filter(i=>i.recipe_id===c.recipe_id&&i.unit==='kg'&&Number(i.quantity)>=1).map(i=>i.display_name);for(const name of main)for(const [pattern,key]of mappings)if(pattern.test(name))accompaniments.add(key);for(const [pattern,key]of mappings)if(pattern.test(c.name))accompaniments.add(key);if(starch.has(c.id)&&/hachis|brandade|purée/i.test(c.name))accompaniments.add('Pommes de terre');}return {coherence:require('../../coherent-variants.cjs').assess(snapshot),proteinKeys:proteinKeys(snapshot),weekendRestricted:snapshot.components.some(c=>/^purée(?:\s|$)|gratin dauphinois/i.test(c.name)),vegetarian:snapshot.service.portion_mode==='all'&&snapshot.service.all_group==='vegetarian',legume:snapshot.ingredients.some(i=>recipes.has(i.recipe_id)&&/lentill|pois cass|haricot.*roug|haricot.*blanc|pois chiche|fève/i.test(i.display_name||'')),fries:snapshot.components.some(c=>/\bfrites\b/i.test(c.name)),accompaniments:[...accompaniments]};}
function proteinKeys(snapshot){const ids=new Set(snapshot.categories.filter(c=>c.category==='Protein').map(c=>c.component_id));return [...new Set(snapshot.components.filter(c=>ids.has(c.id)&&c.active!==false).map(c=>c.name.normalize('NFC').trim().toLocaleLowerCase('fr').replace(/\s+/g,' ')))];}
async function surroundingProteins(repo,startDate){const rows=await repo.rows("SELECT p.id FROM catering.planned_services p JOIN catering.weeks w ON w.id=p.week_id WHERE w.start_date >= $1::date - 21 AND w.start_date <= $1::date + 21 AND w.start_date <> $1::date AND p.meal_period='lunch' AND EXTRACT(ISODOW FROM p.service_date) BETWEEN 1 AND 5",[startDate]);const result=new Set();for(const row of rows)for(const key of proteinKeys(await repo.loadService(row.id)))result.add(key);return [...result];}
module.exports={shuffledServices,generateDay,generateWeek,features,proteinKeys,surroundingProteins};

