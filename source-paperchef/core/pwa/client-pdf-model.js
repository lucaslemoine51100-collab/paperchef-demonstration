const {presentationBlocks}=require('../technical-sheets/presentation-blocks');
const {icon}=require('../order-sheets/icons');
const {categoryIcons,allergenIcons,potSvg}=require('./client-pdf-icons.json');
const orderIcons=Object.fromEntries(['order','milk','meat','fish','snow','leaf','jar'].map(k=>[k,icon(k).replace(/currentColor/g,'#246a34')]));
function technical(sheet){return {viewModel:sheet.viewModel,blocks:presentationBlocks(sheet.viewModel).map(b=>({...b,iconSvg:categoryIcons[b.colorProfile]||categoryIcons.sauce})),categoryIcons,allergenIcons,potSvg};}
function clientPdfModel(sheet,kind){
 let result;
 if(sheet.pack){const isTechnical=kind.endsWith('week-technical');result={kind:isTechnical?'technical-pack':'order-pack',documents:sheet.documents.map(d=>{if(d.blank)return {...d,sheet:undefined};return {...d,sheet:d.kind==='technical'?technical(d.sheet):d.kind==='ratios'?{viewModel:d.sheet.viewModel}:{viewModel:d.sheet.viewModel,icons:orderIcons}};})};}
 else if(kind.endsWith('/allergens'))result={kind:'allergens',viewModel:sheet.viewModel,potSvg:require('../weekly-allergens/visuals').attentionSvg};
 else if(kind.includes('order'))result={kind:'order',viewModel:sheet.viewModel,icons:orderIcons};
 else result={kind:'technical',...technical(sheet)};
 return JSON.parse(JSON.stringify(result,(_k,v)=>typeof v==='bigint'?v.toString():v));
}
function clientPdfPage(url){const safe=String(url).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Document PaperChef</title><link rel="stylesheet" href="/app.css"><script src="/client-pdf.js" defer></script><script src="/client-pdf-page.js" defer></script></head><body data-pdf-url="'+safe+'"><main style="padding:16px"><p id="pdf-status" role="status">Préparation du PDF sur cet ordinateur…</p><button class="button" id="pdf-download" hidden>Télécharger</button><button class="button secondary" id="pdf-retry" hidden>Réessayer</button><iframe id="pdf-frame" title="Document PDF" style="width:100%;height:85vh;border:0" hidden></iframe></main></body></html>';}
module.exports={clientPdfModel,clientPdfPage};
