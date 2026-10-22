function pdfLibrary(){try{return require('pdf-lib');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;return require(process.env.PWA_PDF_LIB_MODULE||'C:/Users/lucas/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdf-lib');}}
// Fusion vectorielle : pages originales et polices conservées, aucun recalcul culinaire.
async function mergeDocumentPdfs(documents){const {PDFDocument,degrees}=pdfLibrary(),output=await PDFDocument.create();
 for(const document of documents){
  if(document.rectoStart&&output.getPageCount()%2===1)output.addPage([595.276,841.89]);
  if(document.versoStart&&output.getPageCount()%2===0)output.addPage([595.276,841.89]);
  if(document.blank){output.addPage([595.276,841.89]);continue;}
  const source=await PDFDocument.load(document.bytes);
  if(document.singlePage&&source.getPageCount()!==1)throw new Error('Une fiche technique dépasse une page : impossible de garantir Midi au recto et Soir au verso.');
  if(document.rotateLandscape){
   for(const original of source.getPages()){
    const {width,height}=original.getSize();if(width<=height)throw new Error('La commande semaine doit rester en paysage avant assemblage.');
    const embedded=await output.embedPage(original),page=output.addPage([height,width]);page.drawPage(embedded,{x:height,y:0,width,height,rotate:degrees(90)});
   }
  }else{const pages=await output.copyPages(source,source.getPageIndices());for(const [index,page] of pages.entries()){if(document.lastPageRecto&&index===pages.length-1&&output.getPageCount()%2===1)output.addPage([595.276,841.89]);output.addPage(page);}}
 }
 output.setTitle('Documents cuisine de la semaine');return Buffer.from(await output.save());
}
module.exports={mergeDocumentPdfs,pdfLibrary};
