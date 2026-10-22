(function(){
 'use strict';
 let loading;const completed=new Map(),inFlight=new Map();let completedBytes=0;
 function script(path){return new Promise((resolve,reject)=>{const tag=document.createElement('script');tag.src=path;tag.onload=resolve;tag.onerror=()=>{tag.remove();reject(Error('Le moteur PDF n’a pas pu être chargé. Réessayez.'));};document.head.append(tag);});}
 let menuLayoutLoading;window.ensureWeeklyMenuLayout=()=>{if(!menuLayoutLoading)menuLayoutLoading=script('./weekly-menu-layout.js').catch(error=>{menuLayoutLoading=null;throw error;});return menuLayoutLoading;};
 function load(){if(!loading)loading=(async()=>{await Promise.all([script('./pdf-runtime/pdfmake.min.js').then(()=>script('./pdf-runtime/reference-fonts.js')),script('./pdf-runtime/pdf-lib.min.js'),script('./pdf-runtime/technical-browser.js'),script('./pdf-runtime/documents-browser.js'),ensureWeeklyMenuLayout()]);})().catch(e=>{loading=null;throw e;});return loading;}
 async function generate(address,onProgress=()=>{}){
  const url=new URL(address,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith('/documents/'))throw Error('Adresse de document invalide.');
  url.searchParams.set('format','model');url.searchParams.delete('download');url.searchParams.delete('engine');
  const [response]=await Promise.all([fetch(url,{cache:'no-store'}),load()]);
  if(!response.ok){let message;try{message=(await response.json()).error;}catch{}throw Error(message||'Le document n’a pas pu être préparé.');}
  if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Connectez-vous à PaperChef pour ouvrir ce document.');
  const model=await response.json(),key=JSON.stringify(model);
  if(completed.has(key)){const blob=completed.get(key);completed.delete(key);completed.set(key,blob);return blob;}
  if(inFlight.has(key))return inFlight.get(key);
  const pending=render(model,onProgress).then(blob=>{if(blob.size<=40*1024*1024){completed.set(key,blob);completedBytes+=blob.size;while(completed.size>12||completedBytes>40*1024*1024){const first=completed.keys().next().value;completedBytes-=completed.get(first).size;completed.delete(first);}}inFlight.delete(key);return blob;},error=>{inFlight.delete(key);throw error;});inFlight.set(key,pending);return pending;
 }
 async function render(model,onProgress){await new Promise(resolve=>setTimeout(resolve,0));
  const result=model.kind==='weekly-menu'?await PaperChefWeeklyMenu.generate(model):model.kind==='labels'?await PaperChefLabels.generate(model):model.kind==='technical'?await PaperChefBrowserPdf.generate(model):await PaperChefBrowserDocuments.generate(model,{onProgress:async(n,total)=>{onProgress('Préparation du PDF : '+n+' / '+total+' documents…');await new Promise(resolve=>setTimeout(resolve,0));}});
  return new Blob([result.bytes],{type:'application/pdf'});
 }
 function save(blob,name){const address=URL.createObjectURL(blob),link=document.createElement('a');link.href=address;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(address),60000);}
 document.addEventListener('click',async event=>{
  const link=event.target.closest('a[href]');if(!link||link.hasAttribute('data-document')||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  const url=new URL(link.href,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith('/documents/')||url.searchParams.get('format')!=='pdf'||url.searchParams.get('download')!=='1'||url.searchParams.get('engine')==='edge')return;
  event.preventDefault();if(link.dataset.pdfBusy)return;link.dataset.pdfBusy='true';link.setAttribute('aria-busy','true');
  try{save(await generate(url),url.pathname.split('/').at(-1)+'.pdf');document.dispatchEvent(new CustomEvent('document-action-complete',{detail:{mode:'download',url:url.href}}));}
  catch(error){if(typeof notify==='function')notify(error.message);else alert(error.message);}
  finally{delete link.dataset.pdfBusy;link.removeAttribute('aria-busy');}
 });
 window.PaperChefClientPdf={generate,save,generateModel:async model=>{await load();return render(structuredClone(model),()=>{});}};
})();

