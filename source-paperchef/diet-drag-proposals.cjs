const {randomUUID}=require('node:crypto'),{problem,event}=require('./accounts.cjs');
const dateText=x=>x instanceof Date?x.toISOString().slice(0,10):String(x).slice(0,10);
async function check(repo,p,expected,{approval=true}={}){
 const wf=require('./workflow.cjs');
 if(!p||p.state==='served')throw problem('Ce service ne peut plus être proposé.',409);
 if((await repo.client.query('SELECT done FROM paperchef.orders WHERE planned_id=$1',[p.id])).rows[0]?.done)throw problem('Commande faite : proposition bloquée.',409);
 const fp=await wf.fingerprint(repo,p);if(fp!==expected)throw problem('Le planning a changé. Recommencez la proposition.',409);
 if(approval&&(await repo.client.query('SELECT planned_id FROM paperchef.approvals WHERE planned_id=$1 AND fingerprint=$2',[p.id,fp])).rows.length)throw problem('Ce service est déjà approuvé.',409);
 return fp;
}
async function propose(repo,user,input){
 if(user.role!=='diet')throw problem('Propositions réservées à la diététique.',403);
 if(!input||!['move','swap'].includes(input.action)||!['lunch','dinner'].includes(input.period)||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||typeof(input.note||'')!=='string'||(input.note||'').length>2000)throw problem('Proposition invalide.');
 const from=await repo.getPlanned(input.id),week=await repo.getWeek(from.week_id),offset=(new Date(input.date+'T12:00:00Z')-new Date(dateText(week.start_date)+'T12:00:00Z'))/86400000;
 if(!Number.isInteger(offset)||offset<0||offset>6)throw problem('Choisissez un créneau de cette semaine.');
 const rows=await repo.weekServices(from.week_id),to=rows.find(p=>dateText(p.service_date)===input.date&&p.meal_period===input.period);
 if(to?.id===from.id||(input.action==='swap')!==!!to||(to?.id||null)!==(input.targetId||null))throw problem('Le créneau a changé. Recommencez la proposition.',409);
 await check(repo,from,input.fingerprint);if(to)await check(repo,to,input.targetFingerprint);
 const payload={sourceId:from.id,action:input.action,date:input.date,period:input.period,targetId:to?.id||null,targetFingerprint:input.targetFingerprint||null,sourceDate:dateText(from.service_date),sourcePeriod:from.meal_period,sourceTemplateId:from.service_template_id,targetTemplateId:to?.service_template_id||null};
 const id=randomUUID();await repo.client.query('INSERT INTO paperchef.proposals(id,planned_id,user_id,template_id,base_fingerprint,note,payload) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,from.id,user.id,from.service_template_id,input.fingerprint,input.note||'',JSON.stringify(payload)]);
 await event(repo.client,user,'diet.proposed',{weekId:from.week_id,count:1});return {saved:true,id};
}
async function decide(repo,user,input,proposal){
 const d=proposal.payload,from=await repo.getPlanned(proposal.planned_id),rows=await repo.weekServices(from.week_id),to=rows.find(p=>dateText(p.service_date)===d.date&&p.meal_period===d.period);
 if(input.action==='accept'){await check(repo,from,proposal.base_fingerprint);if((to?.id||null)!==d.targetId)throw problem('Le créneau de destination a changé.',409);if(to)await check(repo,to,d.targetFingerprint);}
 await repo.client.query('BEGIN');try{
 if(input.action==='accept')await require('./core/planning/rearrange').rearrange(repo,{id:from.id,date:d.date,period:d.period,action:d.action,force:input.force===true,expectedUpdatedAt:from.updated_at,expectedTargetId:to?.id||null,expectedTargetUpdatedAt:to?.updated_at||null},{withinTransaction:true});
 if(input.action==='accept')await require('./workflow.cjs').approveAccepted(repo,proposal,[from.id,...(to?[to.id]:[])]);await repo.client.query('UPDATE paperchef.proposals SET status=$2,decided_by=$3 WHERE id=$1',[proposal.id,input.action==='accept'?'accepted':'rejected',user.id]);await event(repo.client,user,'diet.'+input.action,{proposalId:proposal.id,forced:input.force===true});await repo.client.query('COMMIT');
 }catch(e){await repo.client.query('ROLLBACK');throw e;}return {saved:true};
}
module.exports={propose,decide,check};
