const {PostgresRepository}=require('../persistence/repository');
const dateText=d=>d instanceof Date?d.toISOString().slice(0,10):String(d).slice(0,10);
class PlanningRepository {
 constructor(client){this.client=client;this.templates=new PostgresRepository(client);}
 async ensureVariantColumn(){if(!this.variantColumnReady){await this.client.query('ALTER TABLE catering.planned_services ADD COLUMN IF NOT EXISTS variant_snapshot jsonb');this.variantColumnReady=true;}}
 async rows(sql,args=[]){return (await this.client.query(sql,args)).rows;}
 async library({name}={}){return this.rows('SELECT * FROM catering.service_templates WHERE ($1::text IS NULL OR name ILIKE $1) ORDER BY name',[name?'%'+name+'%':null]);}
 async createWeek({id,name,startDate}){name=require('../pwa/public/week-info').weekInfo(startDate).title;return (await this.rows("INSERT INTO catering.weeks(id,name,start_date,end_date) SELECT $1,$2,$3::date,$3::date+6 WHERE extract(isodow FROM $3::date)=1 RETURNING *",[id,name,startDate]))[0]||Promise.reject(new Error('La semaine commence un lundi'));}
 async copyWeek({sourceWeekId,startDate,coverCount,covers={},replaceExisting=false,expectedDestination=[]}){
 require('../pwa/public/week-info').weekInfo(startDate);
 if(coverCount!=null&&(!Number.isSafeInteger(coverCount)||coverCount<1))throw new Error('Effectif entier positif requis');
 await this.client.query('BEGIN');try{
 const source=await this.getWeek(sourceWeekId);if(source.start_date===startDate)throw new Error('Choisissez une autre semaine.');
 const services=await this.weekServices(sourceWeekId);
 for(const key of Object.keys(covers))if(!services.some(p=>p.id===key))throw new Error('Créneau source inconnu');
 const existing=await this.rows('SELECT * FROM catering.weeks WHERE start_date=$1::date FOR UPDATE',[startDate]);
 if(existing.length>1)throw new Error('Plusieurs semaines existent à cette date.');
 let destination=existing[0];
 if(destination){const rows=await this.weekServices(destination.id);if(rows.length){if(replaceExisting!==true)throw new Error('La semaine de destination contient déjà des services.');if(rows.some(p=>p.state==='served'))throw new Error('Une semaine contenant un service clôturé ne peut pas être remplacée.');if(!Array.isArray(expectedDestination)||rows.length!==expectedDestination.length||rows.some(p=>!expectedDestination.some(e=>e.id===p.id&&new Date(e.updatedAt).getTime()===new Date(p.updated_at).getTime())))throw new Error('La destination a changé. Rouvrez le calendrier avant de copier.');await this.client.query('DELETE FROM catering.planned_services WHERE week_id=$1',[destination.id]);}}
 if(!destination)destination=await this.createWeek({id:require('node:crypto').randomUUID(),startDate});
 const offset=(new Date(startDate+'T12:00:00Z')-new Date(source.start_date+'T12:00:00Z'))/86400000;
 for(const service of services){const date=new Date(service.service_date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset);await this.planService({id:require('node:crypto').randomUUID(),weekId:destination.id,date:date.toISOString().slice(0,10),mealPeriod:service.meal_period,serviceTemplateId:service.service_template_id,meatPercent:service.meat_percent,coverCount:covers[service.id]??coverCount??service.cover_count,variantSnapshot:service.variant_snapshot});}
 await this.client.query('COMMIT');return {id:destination.id,copied:services.length};
 }catch(error){await this.client.query('ROLLBACK');throw error;}
 }
 async applyWeekTemplate({startDate,slots,coverCount}){
 require('../pwa/public/week-info').weekInfo(startDate);
 if(!Number.isSafeInteger(coverCount)||coverCount<1)throw new Error('Effectif entier positif requis');
 await this.client.query('BEGIN');try{
 const existing=await this.rows('SELECT * FROM catering.weeks WHERE start_date=$1::date FOR UPDATE',[startDate]);
 if(existing.length>1)throw new Error('Plusieurs semaines existent à cette date.');
 let week=existing[0];
 if(week&&(await this.weekServices(week.id)).length)throw new Error('Cette semaine contient déjà des services. Choisissez une semaine vide : aucun service existant ne sera remplacé.');
 if(!week)week=await this.createWeek({id:require('node:crypto').randomUUID(),startDate});
 for(const slot of slots){const day=new Date(startDate+'T12:00:00Z');day.setUTCDate(day.getUTCDate()+slot.day);await this.planService({id:require('node:crypto').randomUUID(),weekId:week.id,date:day.toISOString().slice(0,10),mealPeriod:slot.period,serviceTemplateId:slot.serviceId,coverCount:slot.coverCount??coverCount,variantSnapshot:slot.variantSnapshot});}
 await this.client.query('COMMIT');return {id:week.id,planned:slots.length};
 }catch(error){await this.client.query('ROLLBACK');throw error;}
 }
 async resetWeek(weekId,expectedServices){
  if(!Array.isArray(expectedServices))throw new Error('Actualisez la semaine avant de la réinitialiser.');
  await this.client.query('BEGIN');try{
   await this.rows('SELECT id FROM catering.weeks WHERE id=$1 FOR UPDATE',[weekId]);await this.getWeek(weekId);
   const rows=await this.rows('SELECT * FROM catering.planned_services WHERE week_id=$1 ORDER BY id FOR UPDATE',[weekId]);
   if(rows.some(p=>p.state==='served'))throw new Error('Une semaine contenant un service clôturé ne peut pas être réinitialisée.');
   if(rows.length!==expectedServices.length||rows.some(p=>!expectedServices.some(e=>e.id===p.id&&new Date(e.updatedAt).getTime()===new Date(p.updated_at).getTime())))throw new Error('La semaine a changé. Actualisez le planning avant de la réinitialiser.');
   await this.client.query('DELETE FROM catering.planned_services WHERE week_id=$1',[weekId]);
   await this.client.query('COMMIT');return {id:weekId,removed:rows.length};
  }catch(error){await this.client.query('ROLLBACK');throw error;}
 }
 async getWeek(id){const w=(await this.rows('SELECT * FROM catering.weeks WHERE id=$1',[id]))[0];if(!w)throw new Error('Semaine introuvable');return {...w,start_date:dateText(w.start_date),end_date:dateText(w.end_date)};}
 async planService({id,weekId,date,mealPeriod,serviceTemplateId,coverCount,meatPercent=70,variantSnapshot=null}){await this.ensureVariantColumn();if(!Number.isSafeInteger(coverCount)||coverCount<1)throw new Error('Effectif entier positif requis');if(![30,50,70].includes(meatPercent))throw new Error('Répartition invalide');return (await this.rows('INSERT INTO catering.planned_services(id,week_id,service_date,meal_period,service_template_id,cover_count,meat_percent,variant_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *',[id,weekId,date,mealPeriod,serviceTemplateId,coverCount,meatPercent,variantSnapshot?JSON.stringify(variantSnapshot):null]))[0];}
 async changeWeekCovers(weekId,changes){
 if(!Array.isArray(changes)||!changes.length||changes.length>14)throw new Error('Sélectionnez des services planifiés.');
 if(new Set(changes.map(c=>c.id)).size!==changes.length)throw new Error('Service répété.');
 await this.client.query('BEGIN');try{await this.getWeek(weekId);for(const change of [...changes].sort((a,b)=>a.id.localeCompare(b.id))){
 if(!Number.isSafeInteger(change.coverCount)||change.coverCount<1)throw new Error('Effectif entier positif requis.');
 const p=(await this.rows('SELECT * FROM catering.planned_services WHERE id=$1 FOR UPDATE',[change.id]))[0];
 if(!p||p.week_id!==weekId)throw new Error('Service absent de cette semaine.');if(p.state==='served')throw new Error('Un service clôturé ne peut pas être modifié.');
 if(!change.expectedUpdatedAt||new Date(p.updated_at).getTime()!==new Date(change.expectedUpdatedAt).getTime())throw new Error('Un service a changé. Rouvrez les effectifs de la semaine.');
 }for(const change of changes)await this.changeCovers(change.id,change.coverCount);await this.client.query('COMMIT');return {updated:changes.length};}catch(error){await this.client.query('ROLLBACK');throw error;}
 }
 async getPlanned(id){const p=(await this.rows('SELECT * FROM catering.planned_services WHERE id=$1',[id]))[0];if(!p)throw new Error('Service planifié introuvable');return {...p,service_date:dateText(p.service_date),cover_count:Number(p.cover_count)};}
 async weekServices(id){await this.getWeek(id);return (await this.rows("SELECT * FROM catering.planned_services WHERE week_id=$1 ORDER BY service_date,CASE meal_period WHEN 'lunch' THEN 0 ELSE 1 END",[id])).map(p=>({...p,service_date:dateText(p.service_date),cover_count:Number(p.cover_count)}));}
 async mutationResult(id,rows){if(!rows.length){await this.getPlanned(id);throw new Error('Ce service a changé depuis l’ouverture. Fermez le panneau et réessayez.');}}
 async changeCovers(id,count,expected={}){if(!Number.isSafeInteger(count)||count<1)throw new Error('Effectif entier positif requis');const rows=await this.rows('UPDATE catering.planned_services SET cover_count=$2 WHERE id=$1 AND ($3::text IS NULL OR service_template_id=$3) AND ($4::bigint IS NULL OR cover_count=$4) RETURNING id',[id,count,expected.serviceTemplateId??null,expected.coverCount??null]);await this.mutationResult(id,rows);}
 async replaceService(id,serviceTemplateId,count,expected={}){await this.ensureVariantColumn();if(!Number.isSafeInteger(count)||count<1)throw new Error('Effectif entier positif requis');const rows=await this.rows('UPDATE catering.planned_services SET service_template_id=$2,cover_count=$3,variant_snapshot=NULL WHERE id=$1 AND ($4::text IS NULL OR service_template_id=$4) AND ($5::bigint IS NULL OR cover_count=$5) RETURNING id',[id,serviceTemplateId,count,expected.serviceTemplateId??null,expected.coverCount??null]);await this.mutationResult(id,rows);}
 async deleteService(id,expected={}){const rows=await this.rows('DELETE FROM catering.planned_services WHERE id=$1 AND ($2::text IS NULL OR service_template_id=$2) AND ($3::bigint IS NULL OR cover_count=$3) RETURNING id',[id,expected.serviceTemplateId??null,expected.coverCount??null]);await this.mutationResult(id,rows);}

 // Une opération atomique : jamais de remplacement implicite de la destination.
 async managePlanned({action,id,newId,weekId,date,mealPeriod,serviceTemplateId,coverCount,expectedUpdatedAt,meatPercent}){
  await this.ensureVariantColumn();if(!['update','copy','move'].includes(action))throw new Error('Action de planification invalide');
  if(!Number.isSafeInteger(coverCount)||coverCount<1)throw new Error('Effectif entier positif requis');
  if(!expectedUpdatedAt)throw new Error('Actualisez le service avant de continuer.');
  await this.client.query('BEGIN');try{
   const source=(await this.rows('SELECT * FROM catering.planned_services WHERE id=$1 FOR UPDATE',[id]))[0];
   if(!source)throw new Error('Service planifié introuvable');
   if(source.state==='served')throw new Error('Occurrence servie immuable');
   if(new Date(source.updated_at).getTime()!==new Date(expectedUpdatedAt).getTime())throw new Error('Ce service a changé depuis l’ouverture. Actualisez le planning.');
   const ratio=meatPercent??source.meat_percent;if(![30,50,70].includes(ratio))throw new Error('Répartition invalide');
   if(action==='copy'){
    if(source.week_id===weekId&&dateText(source.service_date)===date&&source.meal_period===mealPeriod)throw new Error('Choisissez un autre créneau pour la copie.');
    await this.planService({id:newId,weekId,date,mealPeriod,serviceTemplateId:source.service_template_id,coverCount,meatPercent:ratio,variantSnapshot:source.variant_snapshot});
   }else{
    await this.rows('UPDATE catering.planned_services SET week_id=$2,service_date=$3,meal_period=$4,service_template_id=$5,cover_count=$6,meat_percent=$7,variant_snapshot=CASE WHEN service_template_id=$5 THEN variant_snapshot ELSE NULL END WHERE id=$1 RETURNING id',[id,weekId,date,mealPeriod,action==='move'?source.service_template_id:serviceTemplateId,coverCount,ratio]);
   }
   await this.client.query('COMMIT');return {id:action==='copy'?newId:id};
  }catch(error){await this.client.query('ROLLBACK');throw error;}
 }
 // Façade des consommateurs existants : un ID est désormais une occurrence, sans duplication de recettes.
 async loadService(id,{withinTransaction=false}={}){const p=await this.getPlanned(id);if(p.state==='served')return structuredClone(p.frozen_snapshot);
  const snapshot=p.variant_snapshot?structuredClone(p.variant_snapshot):await this.templates.loadService(p.service_template_id,{withinTransaction});
  snapshot.service={...snapshot.service,id:p.id,service_template_id:p.service_template_id,planned_service_id:p.id,week_id:p.week_id,service_date:p.service_date,meal_type:p.meal_period,headcount:String(p.cover_count)};
  if(snapshot.service.portion_mode==='split'){snapshot.service.split_primary_ratio=String((snapshot.service.primary_group==='meat'?p.meat_percent:100-p.meat_percent)/100);snapshot.service.split_secondary_ratio=String((snapshot.service.secondary_group==='meat'?p.meat_percent:100-p.meat_percent)/100);}
  require('../../service-variants.cjs').orderComponents(snapshot);snapshot.service.meat_percent=p.meat_percent;if(p.variant_snapshot)snapshot.service.name=require('../pwa/public/service-title').build(snapshot);
  snapshot.service.display_name=require('../pwa/public/service-title').build(snapshot);return snapshot;
 }
 async getService(id){return (await this.loadService(id)).service;}
 async markServed(id){const p=await this.getPlanned(id);if(p.state==='served')return;const snapshot=await this.loadService(id);
  const rows=await this.rows("UPDATE catering.planned_services SET state='served',frozen_snapshot=$2::jsonb WHERE id=$1 AND state='planned' AND cover_count=$3 AND service_template_id=$4 AND service_date=$5 AND meal_period=$6 AND meat_percent=$7 RETURNING id",[id,JSON.stringify(snapshot),snapshot.service.headcount,p.service_template_id,p.service_date,p.meal_period,p.meat_percent]);if(!rows.length)throw new Error('Occurrence modifiée pendant la clôture, recommencer');
 }
 async lastMeals(mealPeriod,{before='9999-12-31',limit=20,servedOnly=false}={}){if(!['lunch','dinner'].includes(mealPeriod)||!Number.isSafeInteger(limit)||limit<1)throw new Error('Cycle invalide');return (await this.rows("SELECT * FROM catering.planned_services WHERE meal_period=$1 AND service_date<=$2::date AND ($4::boolean=false OR state='served') ORDER BY service_date DESC LIMIT $3",[mealPeriod,before,limit,servedOnly])).reverse().map(p=>({...p,service_date:dateText(p.service_date),cover_count:Number(p.cover_count)}));}
}
async function ensureDemoWeek(repo){const existing=await repo.rows('SELECT id FROM catering.weeks WHERE EXISTS(SELECT 1 FROM catering.planned_services p WHERE p.week_id=weeks.id) ORDER BY start_date LIMIT 1');if(existing.length)return existing[0].id;
 const id='demo-week-2026-10-05';if(!(await repo.rows('SELECT id FROM catering.weeks WHERE id=$1',[id])).length)await repo.createWeek({id,name:'Semaine de démonstration',startDate:'2026-10-05'});
 for(const [key,date,mealPeriod,serviceTemplateId]of [['monday-lunch','2026-10-05','lunch','service-reference'],['monday-dinner','2026-10-05','dinner','couscous-vegetarien'],['tuesday-lunch','2026-10-06','lunch','lasagnes'],['tuesday-dinner','2026-10-06','dinner','quiches']])await repo.planService({id:'demo-'+key,weekId:id,date,mealPeriod,serviceTemplateId,coverCount:100});return id;
}
module.exports={PlanningRepository,ensureDemoWeek,dateText};
