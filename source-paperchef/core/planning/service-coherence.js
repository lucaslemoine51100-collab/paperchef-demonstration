// Pilot rules: explicit dish profiles, shared accompaniments, and complete variants.
// Kept independent from the live planner until the pilot compositions are reviewed.
'use strict';
const periods=['lunch','dinner'];
function slots(){return Array.from({length:14},(_,i)=>({day:Math.floor(i/2),period:periods[i%2]}));}
function evaluate(service,profiles){
 const errors=[],warnings=[],items=service.items.map(item=>({item,profile:profiles[item.dishId]}));
 for(const {item,profile} of items)if(!profile)errors.push('Profil de plat manquant : '+item.dishId);
 if(errors.length)return {valid:false,errors,warnings,allowedSlots:[]};
 if(new Set(service.items.map(i=>i.dishId)).size!==service.items.length)errors.push('Un plat apparaît plusieurs fois.');
 const proteins=items.filter(x=>x.profile.role==='protein'),starches=items.filter(x=>x.profile.role==='starch'),vegetables=items.filter(x=>x.profile.role==='vegetable'),sauces=items.filter(x=>x.profile.role==='sauce');
 const groups=proteins.map(x=>x.profile.group).sort();
 if(!(['meat,fish','fish,meat'].includes(groups.join(','))||groups.join(',')==='vegetarian'))errors.push('Prévoir une viande et un poisson, ou une seule proposition végétarienne.');
 const saladRequired=proteins.some(x=>x.profile.saladRequired);
 if(saladRequired){
  if(proteins.some(x=>!x.profile.saladRequired))errors.push('Associer des plats complets compatibles avec le même accompagnement.');
  if(starches.length)errors.push('Pas de féculent supplémentaire avec ces plats complets.');
  if(!vegetables.some(x=>x.profile.salad))errors.push('Salade verte nécessaire.');
  if(!sauces.some(x=>x.profile.dressing&&(!x.item.destination||x.item.destination==='all')))errors.push('Vinaigrette commune nécessaire.');
 }else{
  if(starches.length!==1)errors.push('Prévoir un féculent commun.');
  if(!vegetables.length)errors.push('Prévoir un légume commun.');
 }
 for(const {item,profile} of [...starches,...vegetables])if(item.destination&&item.destination!=='all')errors.push('Les accompagnements doivent convenir à toutes les propositions.');
 for(const {item,profile} of sauces){
  const recipients=proteins.filter(x=>!item.destination||item.destination==='all'||item.destination===x.profile.group);
  if(!recipients.length)errors.push('Sauce sans destinataire : '+profile.name);
  if(profile.dressing&&!vegetables.some(x=>x.profile.salad))errors.push('Vinaigrette sans crudité.');
  if(!profile.dressing)for(const target of recipients){
   if(!target.profile.sauces?.includes(item.dishId))errors.push(profile.name+' non prévue pour '+target.profile.name);
   if(target.profile.sauceIncluded)warnings.push('Sauce supplémentaire pour '+target.profile.name+' déjà en sauce.');
  }
 }
 for(const {profile} of proteins){
  if(profile.sauceRequired&&!profile.sauceIncluded){
   const covered=sauces.some(x=>!x.profile.dressing&&(!x.item.destination||x.item.destination==='all'||x.item.destination===profile.group)&&profile.sauces?.includes(x.item.dishId));
   const rich=starches.some(x=>profile.saucedStarches?.includes(x.item.dishId));
   if(!covered&&!rich)errors.push('Sauce nécessaire pour '+profile.name);
  }
  for(const x of [...starches,...vegetables])if(profile.accompaniments&&!profile.accompaniments.includes(x.item.dishId))errors.push(x.profile.name+' non prévu avec '+profile.name);
 }
 const allowedSlots=slots().filter(slot=>{
  const fridayDinner=slot.day===4&&slot.period==='dinner';
  if(proteins.some(x=>x.profile.fridayDinner===true)&&!fridayDinner)return false;
  if(!proteins.every(x=>!x.profile.weekdayLunchOnly||(slot.day<5&&slot.period==='lunch')))return false;
  if(slot.day>=5&&proteins.some(x=>x.profile.carvingRequired))return false;
  if(slot.day>=5&&items.some(x=>x.profile.weekendForbidden))return false;
  if(fridayDinner)return proteins.length>0&&proteins.every(x=>x.profile.fridayDinner===true);
  return true;
 });
 return {valid:!errors.length,errors:[...new Set(errors)],warnings:[...new Set(warnings)],allowedSlots};
}
function variant(base,changes,profiles){
 const result=structuredClone(base);
 const removed=new Set();
 for(const change of changes){if(!result.items.some(i=>i.dishId===change.remove)||removed.has(change.remove))throw Error('Remplacement introuvable ou répété.');removed.add(change.remove);}
 result.items=result.items.filter(i=>!removed.has(i.dishId));
 for(const change of changes)if(change.add)result.items.push(...change.add.map(i=>({...i})));
 const check=evaluate(result,profiles);return {service:result,...check};
}
module.exports={evaluate,variant,slots};
