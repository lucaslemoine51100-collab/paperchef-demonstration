const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {exportTechnicalSheetPdf}=require('../technical-sheets/export-pdf');
const {exportOrderSheetPdf}=require('../order-sheets/export-pdf');
async function documentPdf(sheet,kind,sharedBrowser){
 if(sheet.pack){const {chromium}=require(process.env.PWA_PLAYWRIGHT_MODULE||'playwright');const browser=sharedBrowser||await chromium.launch({channel:'msedge',headless:true});try{const documents=[];for(const document of sheet.documents)documents.push({...document,bytes:document.blank?null:await documentPdf(document.sheet,document.kind,browser)});return await require('./pdf-pack').mergeDocumentPdfs(documents);}finally{if(!sharedBrowser)await browser.close();}}

 const {chromium}=require(process.env.PWA_PLAYWRIGHT_MODULE||'playwright');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cuisine-document-')),file=path.join(directory,'document.pdf');
 try{if(kind.includes('order'))await exportOrderSheetPdf(sheet.html,file,chromium,sheet.viewModel.orientation,{channel:'msedge',browser:sharedBrowser});else await exportTechnicalSheetPdf(sheet.html,file,chromium,{channel:'msedge',browser:sharedBrowser});return fs.readFileSync(file);}finally{fs.rmSync(directory,{recursive:true,force:true});}
}
module.exports={documentPdf};
