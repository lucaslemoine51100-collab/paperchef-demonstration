const serviceTitle=require('./public/service-title');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');

const {LibraryEditorRepository,configurePortionMode}=require('../persistence/library-editor');

const {calculateService}=require('../persistence/service-calculation');

const {weeklyMenuViewModel,plannedTechnicalSheet,plannedOrderSheet,weeklyOrderSheet,weeklyAllergenSheet}=require('../planning/projections');
const {clientPdfModel,clientPdfPage}=require('./client-pdf-model');

const date=d=>d instanceof Date?d.toISOString().slice(0,10):String(d).slice(0,10);

const assets={'/dish-drag.js':'dish-drag.js','/empty-cartouches.js':'empty-cartouches.js','/profile-icons.js':'profile-icons.js','/nutrition.js':'nutrition.js','/service-variants.js':'service-variants.js','/dish-selection.js':'dish-selection.js','/scroll-position.js':'scroll-position.js','/sheet-editor.js':'sheet-editor.js','/week-calendar.js':'week-calendar.js','/planning-drag.js':'planning-drag.js','/card-previews.js':'card-previews.js','/app-status.js':'app-status.js','/help-center.css':'help-center.css','/help-center.js':'help-center.js','/week-rules.js':'week-rules.js','/random-week.js':'random-week.js','/week-types.js':'week-types.js','/kitchen-background.svg':'kitchen-background.svg','/kitchen-background.png':'kitchen-background.png','/editor-navigation.js':'editor-navigation.js','/journey.js':'journey.js','/clarity.js':'clarity.js','/cuisine-visuals.js':'cuisine-visuals.js','/':'index.html','/app.js':'app.js','/library-editor.js':'library-editor.js','/reference-ui.js':'reference-ui.js','/week-info.js':'week-info.js','/reference-format.js':'reference-format.js','/assembly-editor.js':'assembly-editor.js','/menu-composition.js':'menu-composition.js','/service-title.js':'service-title.js','/app.css':'app.css','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/icon.svg':'icon.svg','/icon-192.png':'icon-192.png','/icon-512.png':'icon-512.png'};

const pdfs={carbonnade100:['fiches/carbonnade-limande-100.pdf','Carbonnade / Limande · 100 couverts'],carbonnade160:['fiches/carbonnade-limande-160.pdf','Carbonnade / Limande · 160 couverts'],commande1:['commandes/commande-un-service.pdf','Commande · exemple un service'],commande2:['commandes/commande-deux-services.pdf','Commande · exemple deux services'],commandeSemaine:['commandes/commande-semaine.pdf','Commande semaine · exemple enregistré'],allergenes:['weekly-allergens/allergenes-semaine.pdf','Allergènes semaine · exemple enregistré']};

for(const name of ["allergenes", "calendrier", "choix-feuilles", "composeur", "discussions", "documents-mois", "documents-semaine", "effectifs", "etiquettes", "etiquettes-pictos", "menu-manuel", "nutrition", "planning", "plats", "recette", "service-editeur", "services"])assets['/help-images/'+name+'.jpg']='help-images/'+name+'.jpg';
assets['/help-captures.js']='help-captures.js';
const mime={'.jpg':'image/jpeg','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.pdf':'application/pdf'};
for(const name of ['client-pdf.js','client-pdf-page.js','allergen-manual.js','labels-layout.js','labels-editor.js','weekly-menu-layout.js','weekly-menu-editor.js','temperature-sheets.js','traceability-sheets.js','hygiene-templates.js','hygiene-sheets.js'])assets['/'+name]=name;
for(const name of ['pdfmake.min.js','reference-fonts.js','pdf-lib.min.js','technical-browser.js','documents-browser.js'])assets['/pdf-runtime/'+name]='pdf-runtime/'+name;

function send(res,status,value,type='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type.startsWith('application/json')?JSON.stringify(value):value);}

async function body(req,fields){let content='';for await(const part of req){content+=part;if(content.length>262144)throw new Error('Requête trop volumineuse');}const data=JSON.parse(content||'{}');if(!data||Array.isArray(data)||Object.keys(data).some(k=>!fields.includes(k)))throw new Error('Champs de saisie invalides');return data;}

function documentToolbar(html){if(html.includes('class="screen-toolbar"')||html.includes('class="toolbar"'))return html;return html.replace('</head>','<style>.app-document-toolbar{display:flex;justify-content:center;gap:12px;padding:12px;font:16px Arial;background:#eaf1ed}.app-document-toolbar button{padding:12px 20px;cursor:pointer;border:0;border-radius:8px;background:#176936;color:white;font:inherit}@media print{.app-document-toolbar{display:none}}</style></head>').replace('<body>','<body><div class="app-document-toolbar"><button onclick="window.print()">Imprimer / enregistrer en PDF</button></div>');}

function createApplication(repository,{pdfExporter=require('./document-pdf').documentPdf,trial=false,readCache=false,modelsPath,publicOrigin}={}){

 const editor=new LibraryEditorRepository(repository.client),dishes=new (require('../persistence/dishes').DishRepository)(repository.client);

 const responseCache=new (require('./read-cache').ReadCache)();let pending=Promise.resolve();const undoReceipts=new Map();

 async function sendDocument(res,url,sheet){if(url.searchParams.get('format')==='model')return send(res,200,clientPdfModel(sheet,url.pathname));if(url.searchParams.get('format')==='pdf'){if(url.searchParams.get('engine')!=='edge')return send(res,200,clientPdfPage(url.pathname+url.search),'text/html; charset=utf-8');const pdf=await pdfExporter(sheet,url.pathname);res.setHeader('Content-Disposition',(url.searchParams.get('download')==='1'?'attachment':'inline')+'; filename="'+url.pathname.split('/').at(-1)+'.pdf"');return send(res,200,pdf,'application/pdf');}return send(res,200,documentToolbar(sheet.html),'text/html; charset=utf-8');}

 async function api(req,res,url){const p=url.pathname;
 if(req.method==='GET'&&p==='/api/app-status'){const hash=require('node:crypto').createHash('sha256');for(const name of Object.values(assets).filter(n=>/\.(js|css|html)$/.test(n)).sort())hash.update(fs.readFileSync(path.join(__dirname,'public',name)));return send(res,200,{version:hash.digest('hex').slice(0,16)});}

 if(['/api/week-types/random-day','/api/week-types/random','/api/week-types/models','/api/week-types/catalog','/api/week-types/apply'].includes(p)){
 const file=(process.env.PAPERCHEF_CLASSIFICATIONS_FILE||path.join(__dirname,'../planning/week-template-classifications.json')),classification=JSON.parse(fs.readFileSync(file,'utf8'));
 const {generateWeek,features}=require('../planning/random-week');
 const services=await require('../../variant-performance.cjs').memo(repository,'week-catalog:'+require('../../coherent-variants.cjs').revision(),async()=>{const result=[];for(const row of await repository.library()){if(!row.active)continue;const snapshot=await repository.templates.loadService(row.id);result.push({id:row.id,name:serviceTitle.display(snapshot),components:snapshot.components.filter(c=>c.active!==false&&c.menu_visible!==false).map(c=>({name:c.name,categories:snapshot.categories.filter(k=>k.component_id===c.id)})),...features(snapshot)});}return result;});
 if(p.endsWith('/catalog')&&req.method==='GET')return send(res,200,{services,classifications:classification.services});
 if(p.endsWith('/random-day')&&req.method==='POST'){const input=await body(req,['startDate','day','period','slots']);const calendar=require('./public/week-rules').friesDay(input.startDate),fixedServices={};for(const slot of input.slots||[]){if(slot.manualComposition&&!(slot.day===input.day&&slot.period===input.period)){const built=await require('../../manual-composition.cjs').build(repository,slot.manualComposition);fixedServices[slot.day+':'+slot.period]={id:slot.serviceId,components:built.view.components,...built.view.features};}else if(slot.componentChoices&&!(slot.day===input.day&&slot.period===input.period)){const graph=await require('../../component-choices.cjs').build(repository,slot.serviceId,slot.variantChoice,slot.componentChoices);fixedServices[slot.day+':'+slot.period]={id:slot.serviceId,components:require('../../service-variants.cjs').display(graph),...features(graph)};}}return send(res,200,require('../planning/random-week').generateDay(await require('../planning/variant-random-week').candidates(repository,services),classification.services,input.day,input.slots,Math.random,{fixedServices,period:input.period,friesDay:calendar.day,blockedProteins:await require('../planning/random-week').surroundingProteins(repository,input.startDate)}));}
 if(p.endsWith('/random')&&req.method==='POST'){const input=await body(req,['startDate']);const calendar=require('./public/week-rules').friesDay(input.startDate);return send(res,200,{...generateWeek(await require('../planning/variant-random-week').candidates(repository,services),classification.services,Math.random,{friesDay:calendar.day,blockedProteins:await require('../planning/random-week').surroundingProteins(repository,input.startDate)}),startDate:input.startDate,weekNumber:calendar.week,friesDay:calendar.day});}
 const modelsFile=modelsPath||path.join(__dirname,'../planning/week-template-models.json'),models=fs.existsSync(modelsFile)?JSON.parse(fs.readFileSync(modelsFile,'utf8')):[];
 if(req.method==='GET'){const result=structuredClone(models);for(const model of result)for(const slot of model.slots)if(slot.manualComposition){slot.variantPreview=(await require('../../manual-composition.cjs').build(repository,slot.manualComposition)).view;}for(const model of result)for(const slot of model.slots)if(slot.variantChoice!==undefined){const v=require('../../service-variants.cjs'),spec=v.specs(slot.serviceId).find(x=>x.id===slot.variantChoice);if(spec||slot.variantChoice==='original'){const graph=slot.componentChoices?await require('../../component-choices.cjs').build(repository,slot.serviceId,slot.variantChoice,slot.componentChoices):spec?await v.build(repository,slot.serviceId,spec):await repository.templates.loadService(slot.serviceId);slot.variantPreview={id:spec?.id||'original',components:v.display(graph),features:features(graph),componentChoices:graph.variant?.componentChoices};}}return send(res,200,result);}
 if(p.endsWith('/models')&&['PATCH','DELETE'].includes(req.method)){if(trial)throw new Error('Modification indisponible dans la version d’essai.');const input=await body(req,['id','name']);const index=models.findIndex(m=>m.id===input.id);if(index<0)throw new Error('Favori introuvable.');if(req.method==='DELETE')models.splice(index,1);else{if(typeof input.name!=='string'||!input.name.trim()||input.name.length>150)throw new Error('Nom invalide.');models[index].name=input.name.trim();}fs.writeFileSync(modelsFile+'.tmp',JSON.stringify(models,null,2));fs.renameSync(modelsFile+'.tmp',modelsFile);return send(res,200,{saved:true});}
 if(req.method==='POST'&&(p.endsWith('/models')||p.endsWith('/apply'))){
  if(trial)throw new Error('Enregistrement indisponible dans la version d’essai.');
  const input=await body(req,['name','slots','startDate','forceExceptions','coverCount']);if((input.name!==undefined&&(typeof input.name!=='string'||!input.name.trim()))||!Array.isArray(input.slots)||input.slots.length!==14)throw new Error('Modèle invalide');
  const rules=require('./public/week-rules'),calendar=rules.friesDay(input.startDate);
  if(input.forceExceptions!==undefined&&typeof input.forceExceptions!=='boolean')throw new Error('Forçage invalide');
  const positions=new Set();for(const slot of input.slots){if(!slot||!Number.isInteger(slot.day)||slot.day<0||slot.day>6||!['lunch','dinner'].includes(slot.period)||(!slot.manualComposition&&!services.some(s=>s.id===slot.serviceId))||positions.has(slot.day+':'+slot.period))throw new Error('Les 14 créneaux doivent contenir des services existants.');positions.add(slot.day+':'+slot.period);}
  const prepared=[];for(const slot of input.slots){const clean={day:slot.day,period:slot.period,serviceId:slot.serviceId,coverCount:slot.coverCount};if(slot.manualComposition){const built=await require('../../manual-composition.cjs').build(repository,slot.manualComposition);if(!built.view.valid)throw Error('Choisissez au moins un plat.');if(slot.serviceId!==built.view.id)throw Error('Identifiant de composition invalide.');Object.assign(clean,{manualComposition:built.view.manualComposition,anchorId:built.anchorId,variantSnapshot:built.graph});services.push({id:slot.serviceId,...built.view.features,components:built.view.components});prepared.push(clean);continue;}if(slot.variantChoice!==undefined){const variants=require('../../service-variants.cjs');if(!variants.enabled())throw Error('Les variantes sont désactivées.');const spec=variants.specs(slot.serviceId).find(s=>s.id===slot.variantChoice);if(!spec&&slot.variantChoice!=='original')throw Error('Variante inconnue.');const graph=slot.componentChoices?await require('../../component-choices.cjs').build(repository,slot.serviceId,slot.variantChoice,slot.componentChoices):spec?await variants.build(repository,slot.serviceId,spec):await repository.templates.loadService(slot.serviceId);if(slot.componentChoices)clean.componentChoices=require('../../component-choices.cjs').parse(slot.componentChoices);clean.variantChoice=spec?.id||'original';clean.variantSnapshot=graph;const service=services.find(s=>s.id===slot.serviceId);Object.assign(service,features(graph));}prepared.push(clean);}input.slots=prepared;
  
  if(p.endsWith('/apply'))return send(res,201,await repository.applyWeekTemplate({startDate:input.startDate,slots:input.slots.map(s=>s.manualComposition?{...s,serviceId:s.anchorId}:s),coverCount:input.coverCount}));
  let favoriteNumber=Math.max(0,...models.map(m=>Number(/^Semaine favorite (\d+)$/.exec(m.name)?.[1])||0))+1;while(models.some(m=>m.name==='Semaine favorite '+favoriteNumber))favoriteNumber++;const model={id:randomUUID(),name:input.name?.trim()||'Semaine favorite '+favoriteNumber,startDate:input.startDate,weekNumber:calendar.week,forceExceptions:!!input.forceExceptions,exceptions:[],slots:input.slots.map(s=>({day:s.day,period:s.period,serviceId:s.serviceId,...(s.manualComposition?{manualComposition:s.manualComposition}:{}),...(s.variantChoice!==undefined?{variantChoice:s.variantChoice,...(s.componentChoices?{componentChoices:s.componentChoices}:{})}:{})})),createdAt:new Date().toISOString()};models.push(model);fs.writeFileSync(modelsFile+'.tmp',JSON.stringify(models,null,2));fs.renameSync(modelsFile+'.tmp',modelsFile);return send(res,201,model);
 }
 return send(res,405,{error:'Méthode non prise en charge'});
}
if(p==='/api/week-types/classifications'){
  const file=(process.env.PAPERCHEF_CLASSIFICATIONS_FILE||path.join(__dirname,'../planning/week-template-classifications.json'));
  const current=JSON.parse(fs.readFileSync(file,'utf8'));
  if(req.method==='GET')return send(res,200,current);
  if(req.method!=='POST')return send(res,405,{error:'Méthode non prise en charge'});
  if(trial)throw new Error('Le classement est en lecture seule dans la version d’essai.');
  const input=await body(req,['expectedVersion','services']);
  if(input.expectedVersion!==current.version)throw new Error('Le classement a changé. Fermez et rouvrez cette fenêtre.');
  if(!input.services||Array.isArray(input.services)||typeof input.services!=='object')throw new Error('Classement invalide');
  const valid=new Set((await repository.library()).map(s=>s.id));
  for(const [id,c]of Object.entries(input.services)){
   if(!valid.has(id)&&!current.services[id])throw new Error('Service introuvable');
   if(!c||typeof c.label!=='string'||typeof c.fridayEveningCompatible!=='boolean'||![null,'all','lunch','weekday_lunch','weekday','friday_dinner'].includes(c.allowedSlots)||Object.keys(c).some(k=>!['label','allowedSlots','fridayEveningCompatible'].includes(k)))throw new Error('Catégorie invalide');
  }
  const saved={...current,version:current.version+1,services:input.services};
  fs.writeFileSync(file+'.tmp',JSON.stringify(saved,null,2)+'\n');fs.renameSync(file+'.tmp',file);
  return send(res,200,saved);
 }

  if(req.method==='GET'&&p==='/api/library/deletion'){const cleanup=new (require('../persistence/library-cleanup').LibraryCleanup)(repository.client);return send(res,200,await cleanup.info(url.searchParams.get('kind'),url.searchParams.get('id')));}
  if(req.method==='DELETE'&&p==='/api/library/permanent'){const data=await body(req,['kind','id','expectedVersion','confirmed']);const result=await new (require('../persistence/library-cleanup').LibraryCleanup)(repository.client).remove(data);const performance=require('../../variant-performance.cjs');if(data.kind==='dish')performance.forgetDish(repository,data.id);else performance.clear(repository);return send(res,200,result);}
  if(req.method==='GET'&&p==='/api/dishes')return send(res,200,readCache?await require('../../variant-performance.cjs').memo(repository,'dish-library:list',()=>dishes.list()):await dishes.list());

  if(req.method==='PATCH'&&p==='/api/dishes/active'){const data=await body(req,['id','active','expectedVersion']);return send(res,200,await dishes.setDishActive(data.id,data.active,data.expectedVersion));}
  if(req.method==='GET'&&p==='/api/dishes/usages')return send(res,200,await dishes.usages(url.searchParams.get('id')));
  if(req.method==='GET'&&p==='/api/dishes/detail')return send(res,200,await dishes.dishDetail(url.searchParams.get('id')));

  if(req.method==='GET'&&p==='/api/dishes/bundle')return send(res,200,await dishes.bundle(url.searchParams.get('id'),{editing:url.searchParams.get('editing')==='1',serviceId:url.searchParams.get('serviceId')}));

  if(req.method==='POST'&&p==='/api/dishes/save'){const data=await body(req,['dish','recipe','ingredients','categories','overrides','expectedVersion','variantOf','sourceVersion']);return send(res,200,await dishes.saveDish(data));}

  if(req.method==='POST'&&p==='/api/assembly/save'){const data=await body(req,['snapshot','expectedVersion','confirmedRemoved','dishVersions']);return send(res,200,await dishes.assembly(data));}

  if(req.method==='POST'&&p==='/api/assembly/duplicate'){const data=await body(req,['snapshot','dishVersions']);return send(res,201,await dishes.assembly(data,{duplicate:true}));}

  if(req.method==='GET'&&p==='/api/weeks'){const weeks=await repository.rows('SELECT w.*,count(p.id)::int AS service_count FROM catering.weeks w LEFT JOIN catering.planned_services p ON p.week_id=w.id GROUP BY w.id ORDER BY w.start_date');return send(res,200,weeks.map(w=>({...w,start_date:date(w.start_date),end_date:date(w.end_date)})));}

  if(req.method==='GET'&&p==='/api/dishes/preview')return send(res,200,await require('./dish-preview').dishPreview(dishes,url.searchParams.get('id'),{serviceId:url.searchParams.get('serviceId'),componentId:url.searchParams.get('componentId')}));
  if(req.method==='GET'&&p==='/api/library/new')return send(res,200,{snapshot:{service:{id:null,name:'',reference_headcount:'100',headcount:'100',portion_mode:'split',rounding_profile_id:'v0-display',active:true},components:[],recipes:[],ingredients:[],categories:[],shared:[],allocations:[],inputs:[],bindings:[],overrides:[],rules:[],units:[],ruleIngredients:[],rounding:await editor.rows('SELECT *,kg_step::text,l_step::text,g_step::text,ml_step::text FROM catering.rounding_profiles'),menuContributions:[]}});

  if(req.method==='GET'&&p==='/api/library/editor')return send(res,200,await editor.detail(url.searchParams.get('id')));

  if(req.method==='GET'&&p==='/api/library/recipe')return send(res,200,await editor.recipe(url.searchParams.get('id')));

  if(req.method==='GET'&&p==='/api/library/catalog')return send(res,200,await editor.catalog());

  if(req.method==='POST'&&p==='/api/library/save'){const data=await body(req,['snapshot','expectedVersion','confirmedRemoved']);return send(res,200,await editor.save(data));}

  if(req.method==='POST'&&p==='/api/library/duplicate'){const data=await body(req,['snapshot']);return send(res,201,await dishes.assembly(data,{duplicate:true}));}

  if(req.method==='PATCH'&&p==='/api/library/active'){const data=await body(req,['id','active','expectedVersion']);if(typeof data.active!=='boolean')throw new Error('Statut invalide');return send(res,200,await editor.setActive(data.id,data.active,data.expectedVersion));}

  if(req.method==='PATCH'&&p==='/api/library/ingredients/allergens'){const data=await body(req,['id','allergenStatus','allergenIds']);return send(res,200,await editor.updateIngredientAllergens(data));}
  if(req.method==='POST'&&p==='/api/library/ingredients'){const data=await body(req,['name','unit','category','allergenStatus','allergenIds']);return send(res,201,await editor.createIngredient(data));}

  if(req.method==='POST'&&['/api/library/preview','/api/assembly/preview'].includes(p)){const data=await body(req,['snapshot']);const {toDomain,createCalculator}=require('../persistence/adapter'),{technicalSheetViewModel}=require('../technical-sheets/view-model');const graph=structuredClone(data.snapshot),catalog=await editor.catalog();configurePortionMode(graph.service);graph.ruleIngredients=await editor.rows("SELECT p.id AS profile_id,i.id AS ingredient_id,i.normalized_name,i.allergen_status,coalesce((SELECT jsonb_agg(a.code ORDER BY a.sort_order) FROM catering.ingredient_allergens ia JOIN catering.allergens a ON a.id=ia.allergen_id WHERE ia.ingredient_id=i.id),'[]'::jsonb) AS allergen_codes FROM catering.rule_profiles p JOIN catering.ingredients i ON i.id=p.ingredient_id");graph.ingredients=graph.ingredients.map(i=>({...i,...Object.fromEntries(Object.entries(catalog.ingredients.find(c=>c.id===i.ingredient_id)||{}).filter(([key])=>['normalized_name','allergen_status'].includes(key))),allergen_codes:[]}));const allergenRows=await editor.rows('SELECT ia.ingredient_id,a.code FROM catering.ingredient_allergens ia JOIN catering.allergens a ON a.id=ia.allergen_id WHERE ia.ingredient_id=ANY($1::text[]) ORDER BY a.sort_order',[[...new Set(graph.ingredients.map(i=>i.ingredient_id))]]);const allergenMap=new Map();for(const row of allergenRows){if(!allergenMap.has(row.ingredient_id))allergenMap.set(row.ingredient_id,[]);allergenMap.get(row.ingredient_id).push(row.code);}for(const i of graph.ingredients)i.allergen_codes=allergenMap.get(i.ingredient_id)||[];const mapped=toDomain(graph),result=createCalculator({[graph.service.id]:mapped.service})(Number(graph.service.reference_headcount),graph.service.id);const viewModel=technicalSheetViewModel(result,graph,mapped.metadata);return send(res,200,p==='/api/assembly/preview'?{viewModel,displayComponents:require('../technical-sheets/presentation-blocks').presentationBlocks(viewModel),html:require('../technical-sheets/template').renderTechnicalSheet(viewModel)}:viewModel);}

  if(req.method==='GET'&&p==='/api/library'){const templates=[];for(const row of await repository.library()){if(!row.active&&url.searchParams.get('includeInactive')!=='1')continue;const {snapshot,result}=await calculateService(repository.templates,row.id,Number(row.reference_headcount));if(url.searchParams.get('q')&&!serviceTitle.display(snapshot).toLocaleLowerCase('fr').includes(url.searchParams.get('q').toLocaleLowerCase('fr')))continue;templates.push({id:row.id,name:serviceTitle.display(snapshot),active:row.active,version:row.version,referenceCovers:Number(row.reference_headcount),portionMode:snapshot.service.portion_mode,issues:[...require('./public/menu-composition').assess(snapshot).needs.filter(n=>!n.present&&!n.optional).map(n=>({kind:'composition',label:n.label})),...result.recipes.flatMap(r=>{const c=snapshot.components.find(c=>c.domain_key===r.id),recipe=snapshot.recipes.find(x=>x.id===c?.recipe_id);return [...(!r.ingredients.length?[{kind:'ingredients',componentId:c?.id,label:r.name+' : ingrédients'}]:[]),...(!(recipe?.preparation_steps||recipe?.steps||[]).length?[{kind:'steps',componentId:c?.id,label:r.name+' : étapes'}]:[])];})],mainType:[...new Set(result.recipes.flatMap(r=>r.categories.filter(c=>c[0]==='Protéine').map(c=>c[1])))].join(' / '),components:require('../technical-sheets/presentation-blocks').presentationBlocks(require('../technical-sheets/view-model').technicalSheetViewModel(result,snapshot,require('../persistence/adapter').toDomain(snapshot).metadata)).filter(r=>snapshot.components.find(c=>c.domain_key===r.id)?.menu_visible!==false).map(r=>({id:r.id,name:r.name,categories:r.categories}))});}return send(res,200,templates);}

  if(req.method==='GET'&&p==='/api/week'){const id=url.searchParams.get('id'),week=await repository.getWeek(id),snapshots=new Map(),reader=Object.create(repository);reader.loadService=async serviceId=>{const snapshot=await repository.loadService(serviceId);snapshots.set(serviceId,snapshot);return snapshot;};const menu=await weeklyMenuViewModel(reader,id);for(const day of menu.days)for(const key of ['lunchService','dinnerService'])if(day[key]){const snapshot=snapshots.get(day[key].plannedServiceId),planned=await repository.getPlanned(day[key].plannedServiceId);Object.assign(day[key],{serviceName:serviceTitle.display(snapshot),state:planned.state,manualComposition:snapshot.variant?.manualComposition});}return send(res,200,{week,menu,serviceCount:menu.days.flatMap(d=>[d.lunchService,d.dinnerService]).filter(Boolean).length});}

  if(req.method==='GET'&&p==='/api/planned'){const id=url.searchParams.get('id'),planned=await repository.getPlanned(id),sheet=await plannedTechnicalSheet(repository,id);return send(res,200,{planned,viewModel:sheet.viewModel});}

  if(req.method==='GET'&&p==='/api/documents')return send(res,200,{pdfs:Object.entries(pdfs).filter(([, [file]])=>fs.existsSync(path.join(__dirname,'..',file))).map(([id,[,label]])=>({id,label,url:'/pdf/'+id}))});

  if(req.method==='POST'&&p==='/api/weeks/reset'){const data=await body(req,['weekId','confirmed','expectedServices']);if(data.confirmed!==true)throw new Error('La confirmation de réinitialisation est obligatoire.');return send(res,200,await repository.resetWeek(data.weekId,data.expectedServices));}
  if(req.method==='POST'&&p==='/api/weeks/copy'){const data=await body(req,['sourceWeekId','startDate','coverCount','covers','replaceExisting','expectedDestination']);return send(res,201,await repository.copyWeek(data));}
  if(req.method==='POST'&&p==='/api/weeks'){const data=await body(req,['name','startDate']);const week=await repository.createWeek({id:randomUUID(),name:data.name?.trim()||'Nouvelle semaine',startDate:data.startDate});return send(res,201,{id:week.id});}

  if(req.method==='POST'&&p==='/api/planned'){const data=await body(req,['weekId','date','mealPeriod','serviceTemplateId','coverCount','meatPercent']);const planned=await repository.planService({id:randomUUID(),...data});return send(res,201,{id:planned.id});}

  if(req.method==='POST'&&p==='/api/planned/rearrange'){const data=await body(req,['id','date','period','action','force','preview','expectedUpdatedAt','expectedTargetId','expectedTargetUpdatedAt']);return send(res,200,await require('../planning/rearrange').rearrange(repository,data));}
  if(req.method==='POST'&&p==='/api/planned/manage'){const data=await body(req,['action','id','weekId','date','mealPeriod','serviceTemplateId','coverCount','expectedUpdatedAt','meatPercent']);return send(res,data.action==='copy'?201:200,await repository.managePlanned({...data,newId:randomUUID()}));}

  if(req.method==='PATCH'&&p==='/api/planned'){const data=await body(req,['id','coverCount','expectedServiceTemplateId','expectedCoverCount']);await repository.changeCovers(data.id,data.coverCount,{serviceTemplateId:data.expectedServiceTemplateId,coverCount:data.expectedCoverCount});return send(res,200,{id:data.id});}

  if(req.method==='PATCH'&&p==='/api/planned/replace'){const data=await body(req,['id','serviceTemplateId','coverCount','expectedServiceTemplateId','expectedCoverCount']);await repository.replaceService(data.id,data.serviceTemplateId,data.coverCount,{serviceTemplateId:data.expectedServiceTemplateId,coverCount:data.expectedCoverCount});return send(res,200,{id:data.id});}

  if(req.method==='GET'&&p==='/api/week/covers'){const id=url.searchParams.get('weekId');return send(res,200,{services:await repository.weekServices(id)});}
  if(req.method==='POST'&&p==='/api/week/covers'){const data=await body(req,['weekId','changes']);if(!Array.isArray(data.changes)||data.changes.some(c=>!c||Object.keys(c).some(k=>!['id','coverCount','expectedUpdatedAt'].includes(k))))throw new Error('Saisie des effectifs invalide.');return send(res,200,await repository.changeWeekCovers(data.weekId,data.changes));}
  if(req.method==='DELETE'&&p==='/api/planned'){const data=await body(req,['id','confirmed','expectedServiceTemplateId','expectedCoverCount']);if(data.confirmed!==true)throw new Error('La confirmation de suppression est obligatoire.');const original=await repository.getPlanned(data.id);await repository.deleteService(data.id,{serviceTemplateId:data.expectedServiceTemplateId,coverCount:data.expectedCoverCount});for(const [key,value]of undoReceipts)if(value.expires<Date.now())undoReceipts.delete(key);const undoToken=randomUUID();undoReceipts.set(undoToken,{original,expires:Date.now()+600000});return send(res,200,{id:data.id,undoToken});}

  if(req.method==='POST'&&p==='/api/planned/undo'){const data=await body(req,['undoToken']);const receipt=undoReceipts.get(data.undoToken);if(!receipt||receipt.expires<Date.now())throw new Error('Cette annulation a expiré. Ajoutez de nouveau le service.');const p=receipt.original;await repository.planService({id:p.id,weekId:p.week_id,date:p.service_date,mealPeriod:p.meal_period,serviceTemplateId:p.service_template_id,coverCount:p.cover_count,meatPercent:p.meat_percent,variantSnapshot:p.variant_snapshot});undoReceipts.delete(data.undoToken);return send(res,200,{id:p.id});}
  if(req.method==='GET'&&p==='/api/documents/label-catalog')return send(res,200,require('../labels/catalog'));
  if(req.method==='GET'&&p==='/api/documents/summary'){const kind=url.searchParams.get('kind');if(!['technical','order','day-order','week-technical','week-orders','week-order','allergens'].includes(kind))throw new Error('Document inconnu');let services,week;if(['technical','order'].includes(kind)){services=await Promise.all(url.searchParams.getAll('plannedId').map(id=>repository.getPlanned(id)));if(!services.length)throw new Error('Service requis');week=await repository.getWeek(services[0].week_id);}else{week=await repository.getWeek(url.searchParams.get('weekId'));services=await repository.weekServices(week.id);if(kind==='day-order')services=services.filter(p=>p.service_date===url.searchParams.get('date'));}if(!services.length&&kind!=='allergens')throw new Error('Aucun service planifié pour ce document');return send(res,200,{kind,weekInfo:require('./public/week-info').weekInfo(week.start_date),serviceCount:services.length,covers:services.reduce((n,p)=>n+p.cover_count,0),days:[...new Set(services.map(p=>p.service_date))],orientation:['week-order','allergens'].includes(kind)?'paysage':'portrait',duplex:kind==='week-technical'?'Midi au recto · Soir au verso':kind==='week-orders'?'Commande semaine au verso du dernier jour planifié':null});}
  if(req.method==='GET'&&p==='/documents/day-order'){const weekId=url.searchParams.get('weekId'),date=url.searchParams.get('date');const ids=(await repository.weekServices(weekId)).filter(p=>p.service_date===date).map(p=>p.id);if(!ids.length)return send(res,404,{error:'Aucun service planifié ce jour.'});const sheet=await plannedOrderSheet(repository,ids,{scope:ids.length===1?'single_service':'multi_service_portrait'});return sendDocument(res,url,sheet);}

  if(req.method==='GET'&&['/documents/week-technical','/documents/week-orders'].includes(p)){const pack=await require('../planning/document-packs').weeklyDocumentPack(repository,url.searchParams.get('weekId'),p.endsWith('technical')?'technical':'orders');if(url.searchParams.get('format')==='html')return send(res,200,p==='/documents/week-technical'?require('../planning/document-packs').renderTechnicalPack(pack):require('../planning/document-packs').renderOrderPack(pack),'text/html; charset=utf-8');if(url.searchParams.get('format')==='model')return send(res,200,clientPdfModel(pack,p));if(url.searchParams.get('engine')!=='edge')return send(res,200,clientPdfPage(url.pathname+url.search),'text/html; charset=utf-8');const pdf=await pdfExporter(pack,p);res.setHeader('Content-Disposition',(url.searchParams.get('download')==='1'?'attachment':'inline')+'; filename="'+p.split('/').at(-1)+'.pdf"');return send(res,200,pdf,'application/pdf');}
  if(req.method==='GET'&&p==='/documents/weekly-menu'){const model=await require('../planning/weekly-menu-document').weeklyMenuDocument(repository,url.searchParams.get('weekId'));if(url.searchParams.get('format')==='model')return send(res,200,model);if(url.searchParams.get('format')==='pdf')return send(res,200,clientPdfPage(url.pathname+url.search),'text/html; charset=utf-8');return send(res,200,require('./public/weekly-menu-layout').html(model),'text/html; charset=utf-8');}
  if(req.method==='GET'&&p.startsWith('/documents/')){let sheet;const weekId=url.searchParams.get('weekId');if(p==='/documents/service-technical')sheet=await require('../technical-sheets/pipeline').generateTechnicalSheet(repository.templates,url.searchParams.get('serviceId'));else if(p==='/documents/technical')sheet=await plannedTechnicalSheet(repository,url.searchParams.get('plannedId'));else if(p==='/documents/order')sheet=await plannedOrderSheet(repository,url.searchParams.getAll('plannedId'));else if(p==='/documents/week-order')sheet=await weeklyOrderSheet(repository,weekId);else if(p==='/documents/allergens')sheet=await weeklyAllergenSheet(repository,weekId);else return send(res,404,{error:'Document introuvable'});if(!sheet.html)return send(res,404,{error:'Aucun service planifié : aucun besoin à commander.'});return sendDocument(res,url,sheet);}

  return send(res,404,{error:'Action introuvable'});

 }

 const server=http.createServer((req,res)=>{

  let url;try{url=new URL(req.url,'http://'+req.headers.host);}catch{return send(res,400,{error:'Adresse invalide'});}

  if(req.method==='GET'&&assets[url.pathname]){const file=path.join(__dirname,'public',assets[url.pathname]);let bytes=fs.readFileSync(file);if(trial&&url.pathname==='/')bytes=Buffer.from(bytes.toString().replace('<body>','<body><aside style="background:#fff3d6;color:#62450b;padding:12px;text-align:center;font:600 16px Arial" role="status">VERSION D’ESSAI — Vous pouvez tout modifier. Cette base est indépendante de l’application principale.</aside>'));return send(res,200,bytes,mime[path.extname(file)]);}

  if(req.method==='GET'&&url.pathname.startsWith('/pdf/')){const entry=pdfs[url.pathname.slice(5)];if(!entry)return send(res,404,{error:'PDF introuvable'});const file=path.join(__dirname,'..',entry[0]);if(!fs.existsSync(file))return send(res,404,{error:'Cet exemple PDF n’est pas disponible. Générez le document depuis votre semaine.'});return send(res,200,fs.readFileSync(file),'application/pdf');}

  if(!['GET','POST','PATCH','DELETE'].includes(req.method))return send(res,405,{error:'Méthode non prise en charge'});

  if(req.method!=='GET'&&(req.headers.origin&&req.headers.origin!==(publicOrigin||'http://'+req.headers.host)||!String(req.headers['content-type']).startsWith('application/json')))return send(res,403,{error:'Origine ou format de requête invalide'});

  // Le statut ne consulte pas la base et reste disponible pendant un export long.
  if(req.method==='GET'&&url.pathname==='/api/app-status')return api(req,res,url).catch(error=>send(res,500,{error:error.message}));

  // Connexion réservée : les lectures transactionnelles des repositories ne se chevauchent pas.

  const run=()=>{
   const changesData=req.method!=='GET'&&!require('./request-kind').isReadOnlyPreview(req.method,url.pathname);
   const key=readCache&&req.method==='GET'&&['/api/library','/api/dishes','/api/week-types/catalog','/api/weeks','/api/week','/api/library/catalog','/api/library/editor','/api/dishes/detail','/api/dishes/bundle','/documents/weekly-menu'].includes(url.pathname)?url.pathname+url.search:null;
   if(changesData){responseCache.clear();if(url.pathname!=='/api/library/permanent'&&['/api/library','/api/dishes','/api/assembly'].some(prefix=>url.pathname.startsWith(prefix)))require('../../variant-performance.cjs').clear(repository);}
   const cached=key?responseCache.get(key):null;if(cached){res.writeHead(200,{'Content-Type':cached.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(cached.body);return;}
   if(key){const end=res.end.bind(res);res.end=function(chunk,...args){if(res.statusCode===200&&chunk!==undefined)responseCache.set(key,{body:Buffer.isBuffer(chunk)?Buffer.from(chunk):String(chunk),type:res.getHeader('Content-Type')||'application/json; charset=utf-8'});return end(chunk,...args);};}
   return api(req,res,url).finally(()=>{if(changesData){responseCache.clear();if(url.pathname!=='/api/library/permanent'&&['/api/library','/api/dishes','/api/assembly'].some(prefix=>url.pathname.startsWith(prefix)))require('../../variant-performance.cjs').clear(repository);}}).catch(error=>{const conflict=error.code==='23505';const missing=/introuvable/.test(error.message);const message=conflict?(url.pathname.startsWith('/api/library')?'Une référence existe déjà ou une association est répétée.':'Ce créneau contient déjà un service.'):error.code==='23503'?'Le service type ou la semaine n’existe plus. Actualisez le planning.':error.message.includes('immuable')?'Ce service a déjà été servi et reste en lecture seule.':error.message;send(res,missing?404:conflict?409:400,{error:message});});};

  pending=pending.then(run,run);

 });
 server.invalidateReadCache=()=>responseCache.clear();
 return server;
}

module.exports={createApplication};







