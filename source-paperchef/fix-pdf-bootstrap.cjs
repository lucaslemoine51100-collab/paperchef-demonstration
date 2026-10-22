const fs=require('node:fs'),path=require('node:path'),pub=path.join(__dirname,'core/pwa/public');
const bootstrap=`let clientPdfBootstrap;
async function ensureClientPdf(){
 if(window.PaperChefClientPdf)return window.PaperChefClientPdf;
 if(!clientPdfBootstrap)clientPdfBootstrap=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='/client-pdf.js?reload='+Date.now();
  const fail=()=>reject(Error('Le moteur PDF ne peut pas être chargé. Fermez puis relancez Lancer-Test, puis actualisez PaperChef. Vos données sont conservées.'));
  script.onload=()=>window.PaperChefClientPdf?resolve(window.PaperChefClientPdf):fail();script.onerror=fail;document.head.append(script);
 }).catch(error=>{clientPdfBootstrap=null;throw error;});
 return clientPdfBootstrap;
}
`;
const file=path.join(pub,'app.js');let source=fs.readFileSync(file,'utf8');if(!source.includes('async function ensureClientPdf()'))source=bootstrap+source;
source=source.replace('await PaperChefClientPdf.generate(u,','await (await ensureClientPdf()).generate(u,');fs.writeFileSync(file,source);
const clarity=path.join(pub,'clarity.js');source=fs.readFileSync(clarity,'utf8').replace('await PaperChefClientPdf.generate(target)','await (await ensureClientPdf()).generate(target)');fs.writeFileSync(clarity,source);
for(const name of ['app.js','clarity.js'])fs.copyFileSync(path.join(pub,name),path.join(__dirname,'../../outputs/PaperChef-Partage/Serveur-Windows-Test/core/pwa/public',name));
console.log('Chargement PDF récupérable intégré aux actions.');
