// Playwright est injecté par l’application ; aucune dépendance navigateur du domaine.
async function exportTechnicalSheetPdf(html,outputPath,chromium,launchOptions={}) {
  const {browser:sharedBrowser,...options}=launchOptions;const browser=sharedBrowser||await chromium.launch({...options,headless:true});let page;
  try {
    page=await browser.newPage();
    await page.setContent(html,{waitUntil:'load'});
    await page.emulateMedia({media:'print'});
    await page.evaluate(()=>document.fonts.ready);
    await page.evaluate(()=>window.fitTechnicalSheet?.());
    await page.pdf({path:outputPath,format:'A4',preferCSSPageSize:true,printBackground:true,scale:1,displayHeaderFooter:false});
  }finally{try{if(page)await page.close();}finally{if(!sharedBrowser)await browser.close();}}
}
module.exports={exportTechnicalSheetPdf};
