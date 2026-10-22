const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {spawn}=require('node:child_process');
async function healthy(origin){return new Promise(resolve=>{const req=http.get(origin+'/healthz',res=>{let bytes='';res.on('data',part=>bytes+=part);res.on('end',()=>{try{resolve(res.statusCode===200&&JSON.parse(bytes).ok===true);}catch{resolve(false);}});});req.setTimeout(1200,()=>req.destroy());req.on('error',()=>resolve(false));});}
async function ensureLocal({resources,home,origin}){
 if(await healthy(origin))return {owned:false,stop:async()=>{}};
 const source=path.join(resources,'local-server'),target=path.join(home,'serveur-local');fs.mkdirSync(target,{recursive:true});
 // Les données sont copiées seulement à l'arrêt de l'ancien serveur et ne sont jamais remplacées lors d'une mise à jour.
 const migrationFile=path.join(resources,'legacy-local.json');
 if(!fs.existsSync(path.join(target,'test-data','PG_VERSION'))&&fs.existsSync(migrationFile)){
  const legacy=JSON.parse(fs.readFileSync(migrationFile)).directory;
  if(legacy&&fs.existsSync(path.join(legacy,'test-data','PG_VERSION'))){
   const staging=path.join(target,'import-data');if(fs.existsSync(staging))throw Error('Un import précédent est incomplet. Consultez le dossier serveur-local avant de relancer.');
   fs.cpSync(path.join(legacy,'test-data'),staging,{recursive:true,errorOnExist:true,force:false});fs.renameSync(staging,path.join(target,'test-data'));
   for(const file of ['favorites.json','core/planning/week-template-classifications.json'])if(fs.existsSync(path.join(legacy,file))){const dest=path.join(target,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(legacy,file),dest);}
  }
 }
 const classification=path.join(target,'core/planning/week-template-classifications.json');fs.mkdirSync(path.dirname(classification),{recursive:true});if(!fs.existsSync(classification))fs.copyFileSync(path.join(source,'core/planning/week-template-classifications.json'),classification);
 const log=fs.openSync(path.join(target,'serveur.log'),'a');
 const env={...process.env,HOST:'127.0.0.1',PORT:new URL(origin).port,PUBLIC_ORIGIN:origin,PAPERCHEF_DATA_HOME:target,PAPERCHEF_CLASSIFICATIONS_FILE:classification,PWA_PLAYWRIGHT_MODULE:'playwright'};delete env.DATABASE_URL;
 const child=spawn(path.join(source,'node.exe'),[path.join(source,'server.cjs')],{cwd:source,env,windowsHide:true,stdio:['ignore',log,log,'ipc']});fs.closeSync(log);let failure;child.on('error',e=>failure=e);child.on('exit',code=>{failure=Error('Le serveur local s’est arrêté ('+code+'). Consultez serveur-local/serveur.log.');});
 const stop=async()=>{if(child.exitCode!==null||child.killed)return;await new Promise(resolve=>{child.once('exit',resolve);if(child.connected)child.send({action:'shutdown'});const timer=setTimeout(()=>{child.kill();resolve();},8000);timer.unref();});};
 for(let i=0;i<90;i++){if(failure)throw failure;if(await healthy(origin))return {owned:true,stop};await new Promise(r=>setTimeout(r,500));}
 await stop();throw Error('Le serveur local ne démarre pas. Consultez serveur-local/serveur.log.');
}
module.exports={ensureLocal,healthy};

