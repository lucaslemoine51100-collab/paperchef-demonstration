(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.WeekInfo=value;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
function formatWeekRange(start,end){
 if(!start||!end)return 'DATES À RENSEIGNER';
 const parts=iso=>{const date=new Date(iso+'T12:00:00Z');if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==iso)throw new Error('Date invalide');return {year:date.getUTCFullYear(),month:date.getUTCMonth(),day:date.getUTCDate(),weekday:new Intl.DateTimeFormat('fr-FR',{weekday:'long',timeZone:'UTC'}).format(date),monthLabel:new Intl.DateTimeFormat('fr-FR',{month:'long',timeZone:'UTC'}).format(date)};};
 const a=parts(start),b=parts(end),sameYear=a.year===b.year,sameMonth=sameYear&&a.month===b.month;
 const left=`${a.weekday} ${a.day}${sameMonth?'':' '+a.monthLabel}${sameYear?'':' '+a.year}`;
 return `DU ${left} AU ${b.weekday} ${b.day} ${b.monthLabel} ${b.year}`.toUpperCase();
}



function isoDate(iso){const d=new Date(iso+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(iso)||Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==iso)throw new Error('Date invalide');return d;}
function weekNumber(iso){const d=isoDate(iso);d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));const year=d.getUTCFullYear(),first=new Date(Date.UTC(year,0,1,12));return {year,number:Math.ceil(((d-first)/86400000+1)/7)};}
function weekInfo(start){const d=isoDate(start);if(d.getUTCDay()!==1)throw new Error('La semaine commence un lundi');const iso=weekNumber(start),total=weekNumber(iso.year+'-12-28').number;d.setUTCDate(d.getUTCDate()+6);const end=d.toISOString().slice(0,10);return {...iso,total,end,title:formatWeekRange(start,end),label:'Semaine '+iso.number+' / '+total+' · '+iso.year};}
function weeksOfYear(year){year=Number(year);if(!Number.isInteger(year)||year<1900||year>2200)throw new Error('Année invalide');const d=new Date(Date.UTC(year,0,4,12));d.setUTCDate(d.getUTCDate()-((d.getUTCDay()||7)-1));const total=weekNumber(year+'-12-28').number;return Array.from({length:total},(_,i)=>{const date=new Date(d);date.setUTCDate(d.getUTCDate()+i*7);const start=date.toISOString().slice(0,10);return {start,...weekInfo(start)};});}
return {formatWeekRange,weekInfo,weekNumber,weeksOfYear};

});