// Une page A4, adaptation uniforme mesurée puis contrôle avant export PDF.
async function exportOrderSheetPdf(html,outputPath,chromium,orientation,launchOptions={}){
 const widthMm=orientation==='portrait'?194:281,heightMm=orientation==='portrait'?281:194;
 const {browser:sharedBrowser,...options}=launchOptions;const browser=sharedBrowser||await chromium.launch({...options,headless:true});let page;
 try{page=await browser.newPage({viewport:{width:Math.floor(widthMm*96/25.4),height:Math.floor(heightMm*96/25.4)}});await page.emulateMedia({media:'print'});await page.setContent(html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.fitOrderSheet());
 const failures=await page.evaluate(maxHeight=>[...document.querySelectorAll('.sheet')].flatMap((sheet,index)=>{const errors=[];if(sheet.getBoundingClientRect().height>maxHeight+1)errors.push(`Page ${index+1} trop haute`);if(sheet.scrollWidth>sheet.clientWidth+1)errors.push(`Page ${index+1} trop large`);return errors;}),heightMm*96/25.4);
 if(failures.length)throw new Error(failures.join('; ')+' : le contenu dépasse encore la surface A4 après adaptation.');
 await page.pdf({path:outputPath,preferCSSPageSize:true,printBackground:true,scale:1});
 }finally{try{if(page)await page.close();}finally{if(!sharedBrowser)await browser.close();}}
}
module.exports={exportOrderSheetPdf};
