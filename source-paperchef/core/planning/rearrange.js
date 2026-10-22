const fs=require('fs'),path=require('path'),rules=require('../pwa/public/week-rules');
const dayOf=(date,start)=>Math.round((new Date(date+'T12:00:00Z')-new Date(start+'T12:00:00Z'))/86400000);
const dateText=d=>d instanceof Date?d.toISOString().slice(0,10):String(d).slice(0,10);
const changedIssues=rules.changedIssues;
async function rearrange(repo,input,{withinTransaction=false}={}){
 const {id,date,period,action,force,preview}=input;if(!['move','swap','replace'].includes(action)||!['lunch','dinner'].includes(period)||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Déplacement invalide.');
 if(!withinTransaction)await repo.client.query('BEGIN');try{
 const source=await repo.getPlanned(id),week=await repo.getWeek(source.week_id),start=dateText(week.start_date),day=dayOf(date,start);if(day<0||day>6||!Number.isInteger(day))throw Error('Choisissez un jour de cette semaine.');
 const rows=await repo.rows('SELECT * FROM catering.planned_services WHERE week_id=$1 ORDER BY id FOR UPDATE',[source.week_id]),from=rows.find(x=>x.id===id),target=rows.find(x=>dateText(x.service_date)===date&&x.meal_period===period);
 if(!from||target?.id===id)throw Error('Choisissez un autre créneau.');if(from.state==='served'||target?.state==='served')throw Error('Un service déjà servi ne peut pas être déplacé ou remplacé.');
 if(!preview&&(new Date(from.updated_at).getTime()!==new Date(input.expectedUpdatedAt).getTime()||(target?.id||null)!==(input.expectedTargetId||null)||target&&new Date(target.updated_at).getTime()!==new Date(input.expectedTargetUpdatedAt).getTime()))throw Error('Le planning a changé. Recommencez le déplacement.');
 if(action==='move'&&target||action!=='move'&&!target)throw Error('Le créneau a changé. Recommencez le déplacement.');
 const catalog=[],classes={};const originClasses=JSON.parse(fs.readFileSync(process.env.PAPERCHEF_CLASSIFICATIONS_FILE||path.join(__dirname,'week-template-classifications.json'),'utf8')).services;
 for(const row of rows){const snapshot=await repo.loadService(row.id,{withinTransaction:true});catalog.push({id:row.id,...require('./random-week').features(snapshot)});classes[row.id]=originClasses[row.service_template_id];}
 const before=rows.map(x=>({day:dayOf(dateText(x.service_date),start),period:x.meal_period,serviceId:x.id})),after=structuredClone(before),a=after.find(x=>x.day===dayOf(dateText(from.service_date),start)&&x.period===from.meal_period),b=after.find(x=>x.day===day&&x.period===period);
 if(action==='swap'){[a.serviceId,b.serviceId]=[b.serviceId,a.serviceId];}else{after.splice(after.indexOf(a),1);if(b)b.serviceId=a.serviceId;else after.push({day,period,serviceId:a.serviceId});}
 const warnings=[];
 if(preview){if(!withinTransaction)await repo.client.query('COMMIT');return {warnings,source:from,target:target||null};}
 if(warnings.length&&force!==true)throw Error('Déplacement bloqué : '+warnings.join(' · '));
 if(action==='move')await repo.client.query('UPDATE catering.planned_services SET service_date=$2,meal_period=$3 WHERE id=$1',[id,date,period]);
 else if(action==='swap'){await repo.client.query('UPDATE catering.planned_services SET service_template_id=$2,meat_percent=$3,variant_snapshot=$4::jsonb WHERE id=$1',[from.id,target.service_template_id,target.meat_percent,target.variant_snapshot?JSON.stringify(target.variant_snapshot):null]);await repo.client.query('UPDATE catering.planned_services SET service_template_id=$2,meat_percent=$3,variant_snapshot=$4::jsonb WHERE id=$1',[target.id,from.service_template_id,from.meat_percent,from.variant_snapshot?JSON.stringify(from.variant_snapshot):null]);}
 else{await repo.client.query('DELETE FROM catering.planned_services WHERE id=$1',[from.id]);await repo.client.query('UPDATE catering.planned_services SET service_template_id=$2,meat_percent=$3,variant_snapshot=$4::jsonb WHERE id=$1',[target.id,from.service_template_id,from.meat_percent,from.variant_snapshot?JSON.stringify(from.variant_snapshot):null]);}
 if(!withinTransaction)await repo.client.query('COMMIT');return {warnings,applied:true};
 }catch(e){if(!withinTransaction)await repo.client.query('ROLLBACK');throw e;}
}
module.exports={rearrange,changedIssues};
