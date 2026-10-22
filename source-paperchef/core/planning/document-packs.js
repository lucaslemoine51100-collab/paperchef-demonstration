const {plannedTechnicalSheet,plannedOrderSheet,weeklyOrderSheet}=require('./projections');
// Assemblage des documents existants, occurrences réelles seulement.
async function weeklyDocumentPack(repository,weekId,type){
 const week=await repository.getWeek(weekId),services=await repository.weekServices(weekId);
 if(!services.length)throw new Error('Aucun service planifié : aucun document à imprimer.');
 const documents=[];
 if(type==='technical'){
  for(const date of [...new Set(services.map(s=>s.service_date))])for(const meal of ['lunch','dinner']){
   const service=services.find(s=>s.service_date===date&&s.meal_period===meal);
   documents.push(service?{id:service.id,date,meal,kind:'technical',rectoStart:meal==='lunch',singlePage:true,sheet:await plannedTechnicalSheet(repository,service.id)}:{id:date+'-'+meal,date,meal,blank:true,rectoStart:meal==='lunch'});
  }
 }else if(type==='orders'){
  for(const date of [...new Set(services.map(s=>s.service_date))]){
   const ids=services.filter(s=>s.service_date===date).map(s=>s.id);
   documents.push({id:date,kind:'day-order',lastPageRecto:date===services.at(-1).service_date,sheet:await plannedOrderSheet(repository,ids,{scope:ids.length===1?'single_service':'multi_service_portrait'})});
  }
  documents.push({id:week.id,kind:'week-order',versoStart:true,rotateLandscape:true,sheet:await weeklyOrderSheet(repository,weekId)});
 }else throw new Error('Type de dossier inconnu.');
 return {pack:true,type,weekId,documents};
}
function renderTechnicalPack(pack){
 const sheets=pack.documents.filter(d=>!d.blank&&d.kind!=='ratios').map(d=>d.sheet.html);
 if(!sheets.length)throw new Error('Aucune fiche technique à consulter.');
 // Reuse the individual sheet's layout; the PDF pack keeps its recto/verso blanks.
 const head=sheets[0].match(/<head>[\s\S]*?<\/head>/)[0].replace(/<title>[\s\S]*?<\/title>/,'<title>Fiches techniques de la semaine</title>');
 const toolbar=sheets[0].match(/<nav class="screen-toolbar">[\s\S]*?<\/nav>/)?.[0]||'';
 const pages=sheets.map(html=>html.match(/<main class="sheet">[\s\S]*?<\/main>/)[0]).join('\n');
 return '<!doctype html><html lang="fr">'+head+'<body>'+toolbar+pages+(sheets[0].match(/<script>[\s\S]*?<\/script>/g)||[]).join('')+'</body></html>';
}
module.exports={weeklyDocumentPack,renderTechnicalPack};

function renderOrderPack(pack){
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const pages=pack.documents.filter(d=>!d.blank).map(d=>{const landscape=d.sheet.viewModel.orientation==='landscape';const html=d.sheet.html.replace(/<nav class="toolbar">[\s\S]*?<\/nav>/,'');return '<section class="pack-document"><h2>'+esc(d.sheet.viewModel.title)+'</h2><iframe title="'+esc(d.sheet.viewModel.title)+'" srcdoc="'+esc(html)+'" style="height:'+(landscape?850:1200)+'px" onload="this.style.height=Math.ceil(this.contentDocument.documentElement.scrollHeight+24)+\'px\'"></iframe></section>';}).join('');
 return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Commandes de la semaine</title><style>body{margin:0;background:#e8edf0;font:16px Arial;color:#203a30}.pack-document{max-width:1123px;margin:20px auto}.pack-document h2{font-size:18px;margin:16px}.pack-document iframe{display:block;width:100%;border:0;background:#e8edf0}</style></head><body>'+pages+'</body></html>';
}
module.exports.renderOrderPack=renderOrderPack;
