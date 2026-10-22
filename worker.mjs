import {PGlite} from '@electric-sql/pglite';

import {restore} from './shim-fs.mjs';

import serverModule from './source-paperchef/server.cjs';

import accounts from './source-paperchef/accounts.cjs';

import seed from './source-paperchef/seed.cjs';

let server,db,releaseLock;const keepLock=new Promise(r=>releaseLock=r);

const roles={cook:'Cuisinier',store:'Magasinier',diet:'DiÃ©tÃ©tique'};

async function boot(input){restore(input.files);postMessage({progress:'Chargement du moteur de démonstration…'});

const wasm=await fetch('/pglite.wasm').then(r=>r.arrayBuffer());postMessage({progress:'Moteur téléchargé'});const data=await fetch('/pglite.data').then(r=>r.blob());postMessage({progress:'Chargement des recettes…'});

const base=input.initialized?undefined:await fetch('/catalogue.tar.gz').then(r=>r.blob());

postMessage({progress:'Ouverture de la base de démonstration…'});db=new PGlite({relaxedDurability:true,dataDir:'idb://'+input.database,loadDataDir:base,wasmModule:await WebAssembly.compile(wasm),fsBundle:data});await db.waitReady;

const fresh=!(await db.query("SELECT to_regclass('paperchef.demo_metadata')::text AS name")).rows[0].name;

if(fresh)throw Error('Le catalogue de référence est absent. Rechargez la démonstration.');

await accounts.initialize(db);for(const [role,name]of Object.entries(roles))await db.query("INSERT INTO paperchef.users(id,username,name,role,password_hash,active) VALUES($1,$1,$2,$3,'demo-no-password',true) ON CONFLICT(id) DO NOTHING",[role,name,role]);

globalThis.demoUser={id:input.role,username:input.role,name:roles[input.role],role:input.role,active:true};

postMessage({progress:'Préparation des variantes…'});const app=await serverModule.createSharedServer(db,{origin:'https://demo.local',pdfExporter:async()=>{throw Error('Le PDF est produit dans votre navigateur.')}});server=app.server;

if(!(await db.query('SELECT count(*)::int n FROM catering.planned_services')).rows[0].n){const rows=(await app.repo.library()).filter(t=>t.active);const week=await app.repo.createWeek({id:'demo-week',startDate:'2026-10-12'});for(let i=0;i<14;i++){const date=new Date('2026-10-12T12:00:00Z');date.setUTCDate(date.getUTCDate()+Math.floor(i/2));await app.repo.planService({id:'demo-service-'+i,weekId:week.id,date:date.toISOString().slice(0,10),mealPeriod:i%2?'dinner':'lunch',serviceTemplateId:rows[(i*3)%rows.length].id,coverCount:i%2?100:180,meatPercent:70});}}

await db.fs.syncToFs(false);postMessage({ready:true});}

async function request(m){const bytes=Buffer.from(m.body||'');const req={url:m.url,method:m.method,headers:{host:'demo.local',origin:'https://demo.local','content-type':'application/json'},socket:{remoteAddress:'127.0.0.1'},async *[Symbol.asyncIterator](){yield bytes}};const events={},headers={};let status=200;const res={headersSent:false,statusCode:200,setHeader(k,v){headers[k]=v},getHeader(k){return Object.entries(headers).find(([name])=>name.toLowerCase()===k.toLowerCase())?.[1]},writeHead(s,h){status=s;this.statusCode=s;this.headersSent=true;Object.assign(headers,h)},once(k,f){events[k]=f},async end(v){events.finish?.();if(m.method!=='GET'){await db.exec('CHECKPOINT');await db.fs.syncToFs(false);}postMessage({id:m.id,status,headers,body:typeof v==='string'?v:Buffer.from(v||'').toString()})},destroy(){postMessage({id:m.id,status:500,body:JSON.stringify({error:'Une erreur est survenue dans la dÃ©monstration.'})})}};server.handler(req,res);}

self.onmessage=e=>{const m=e.data;if(m.boot)navigator.locks.request(m.database,{ifAvailable:true},async lock=>{if(!lock)throw Error('La démonstration est déjà ouverte dans un autre onglet. Fermez cet onglet avant de continuer.');await boot(m);await keepLock;}).catch(err=>postMessage({error:err.message,stack:err.stack}));else if(m.close){db.close().then(()=>{releaseLock();postMessage({closed:true});});}else request(m).catch(err=>postMessage({id:m.id,status:400,body:JSON.stringify({error:err.message})}));};

