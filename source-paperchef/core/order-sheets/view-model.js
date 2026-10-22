const {formatWeekRange}=require('./week-range-format');
const {formatOrderQuantity}=require('./quantity-format');
const profiles={Dairy:{color:'#7e3298',icon:'milk'},Meat:{color:'#d51f3c',icon:'meat'},Fish:{color:'#007cc1',icon:'fish'},Frozen:{color:'#009cb7',icon:'snow'},FreshProduce:{color:'#398421',icon:'leaf'},Grocery:{color:'#e88300',icon:'jar'}};
const modes={single_service:'portrait',multi_service_portrait:'portrait',weekly_landscape:'landscape'};
function day(date){if(!date)return null;const d=new Date(date+'T12:00:00Z');if(Number.isNaN(d.getTime()))throw new Error('Date invalide');return new Intl.DateTimeFormat('fr-FR',{weekday:'long',timeZone:'UTC'}).format(d).toUpperCase();}
function paginate(categories,orientation){
 const columnCount=orientation==='portrait'?2:4;const lineCost=line=>Math.max(1,Math.ceil(line.name.length/(orientation==='portrait'?32:29)));const totalCost=categories.filter(c=>!c.isEmpty).reduce((n,c)=>n+3+c.lines.reduce((a,l)=>a+lineCost(l),0),0);const capacity=Math.max(8,Math.ceil(totalCost/columnCount)+6);
 const pages=[];let columns=Array.from({length:columnCount},()=>[]),column=0,used=0;
 const next=()=>{column++;used=0;if(column===columnCount){column=columnCount-1;used=-100000;}};
 const cost=line=>Math.max(1,Math.ceil(line.name.length/(orientation==='portrait'?32:29)));
 for(const category of categories.filter(c=>!c.isEmpty)){
  let index=0,continuation=false;
  while(index<category.lines.length){
   const whole=3+category.lines.slice(index).reduce((n,l)=>n+cost(l),0);
   if(used&&whole<=capacity&&used+whole>capacity)next();
   if(capacity-used<3+cost(category.lines[index]))next();
   const lines=[];let blockCost=3;
   while(index<category.lines.length&&used+blockCost+cost(category.lines[index])<=capacity){const line=category.lines[index++];lines.push(line);blockCost+=cost(line);}
   if(!lines.length)throw new Error('Libellé trop long pour une colonne ; variante de mise en page nécessaire');
   columns[column].push({...category,lines,continuation});used+=blockCost;continuation=true;
   if(index<category.lines.length)next();
  }
 }
 if(columns.some(c=>c.length)||!pages.length)pages.push({columns});
 return pages;
}
function orderSheetViewModel(order,services,{scope}={}){
 if(!services.length)throw new Error('Sélection vide');
 scope??=services.length===1?'single_service':services.length===2?'multi_service_portrait':'weekly_landscape';
 if(!modes[scope])throw new Error('Périmètre inconnu');
 if(scope==='single_service'&&services.length!==1)throw new Error('Un service requis');
 let total=0n;
 const byService=services.map((s,index)=>{if(!Number.isSafeInteger(s.headcount)||s.headcount<0)throw new Error('Effectif invalide');total+=BigInt(s.headcount);const date=s.serviceDate||null;const mealLabel={lunch:'MIDI',dinner:'SOIR'}[s.mealType]||'SERVICE À RENSEIGNER';return {...s,selectionIndex:index,dayLabel:day(date),mealLabel,label:`${day(date)||'JOUR À RENSEIGNER'} — ${mealLabel}`,coversLabel:`${mealLabel} : ${s.headcount} COUVERTS`};});
 const dates=byService.map(s=>s.serviceDate).filter(Boolean).sort();const dateRange={start:dates[0]||null,end:dates.at(-1)||null,complete:dates.length===services.length};
 const sameDay=dateRange.complete&&dateRange.start===dateRange.end;
 const title=scope==='single_service'?byService[0].label:scope==='multi_service_portrait'?(sameDay?day(dateRange.start):'COMMANDE — SERVICES SÉLECTIONNÉS'):'COMMANDE SEMAINE';
 const rangeLabel=dates.length?`${day(dateRange.start)} ${dateRange.start} → ${day(dateRange.end)} ${dateRange.end}${dateRange.complete?'':' · planning incomplet'}`:'DATES À RENSEIGNER';
 const categories=order.categories.map(c=>({id:c.category,label:c.label,...profiles[c.category],isEmpty:!c.lines.length,lines:c.lines.map(l=>({ingredientId:l.ingredient_id,name:l.normalized_name,displayQuantity:formatOrderQuantity(l.exact_quantity,l.canonical_unit,{hasQS:l.has_qs,roundUp:l.canonical_unit==='pièces'&&l.sources.some(s=>(s.purchase_conversion_steps||[]).some(c=>c.type==='product_conversion'))}).label,displayUnit:formatOrderQuantity(l.exact_quantity,l.canonical_unit,{hasQS:l.has_qs,roundUp:l.canonical_unit==='pièces'&&l.sources.some(s=>(s.purchase_conversion_steps||[]).some(c=>c.type==='product_conversion'))}).unit,exactQuantity:l.exact_quantity,canonicalUnit:l.canonical_unit,quantityComplete:l.quantity_complete,sources:l.sources.map(source=>({...structuredClone(source),serviceLabel:byService[source.selection_index]?.label||source.service_name})),sourceServices:l.source_services,sourceCount:l.source_count}))}));
 return {scope,title,orientation:modes[scope],dateRange,rangeLabel,landscapeRangeLabel:scope==='weekly_landscape'?formatWeekRange(dateRange.start,dateRange.end)+(dateRange.complete?'':' · PLANNING INCOMPLET'):null,serviceCount:services.length,services:byService,covers:{total:String(total),byService},summaryLabels:scope==='weekly_landscape'?[`${services.length} SERVICES`,`TOTAL : ${total} COUVERTS`]:[...byService.map(s=>s.coversLabel),...(services.length>1?[`TOTAL : ${total} COUVERTS`]:[])],categories,pages:paginate(categories,modes[scope]),hasUnquantified:categories.some(c=>c.lines.some(l=>!l.quantityComplete))};
}
module.exports={orderSheetViewModel};
