const {problem}=require('./accounts.cjs');
// Protect ordered menus, while leaving headcounts and read-only operations available.
module.exports=async function assertOrderUnlocked(repo,path,method,input){
 const db=repo.client;let rows=[];
 if(path==='/api/planned/replace'||path==='/api/planned'&&method==='DELETE'||path==='/api/planned/manage'&&input.action!=='copy'||path==='/api/planned/rearrange'&&!input.preview){
  if(input.id)rows.push(await repo.getPlanned(input.id));
  const source=rows[0];const weekId=input.weekId||source?.week_id;
  if(weekId&&(input.date||source?.service_date)){const date=input.date||source.service_date,period=input.period||input.mealPeriod||source.meal_period;rows.push(...(await repo.weekServices(weekId)).filter(r=>String(r.service_date).slice(0,10)===String(date).slice(0,10)&&r.meal_period===period));}
 }
 if(path==='/api/weeks/reset')rows=await repo.weekServices(input.weekId);
 if(path==='/api/weeks/copy'&&input.replaceExisting||path==='/api/week-types/apply'){
  const weeks=await db.query('SELECT id FROM catering.weeks WHERE start_date=$1',[input.startDate]);for(const w of weeks.rows)rows.push(...await repo.weekServices(w.id));
 }
 for(const row of rows){if(!row)continue;const order=(await db.query('SELECT done FROM paperchef.orders WHERE planned_id=$1',[row.id])).rows[0];if(order?.done)throw problem('Commande faite : rouvrez la commande avant de modifier ce service.',409);}
};
