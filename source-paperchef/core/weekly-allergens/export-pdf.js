const {exportOrderSheetPdf}=require('../order-sheets/export-pdf');
async function exportWeeklyAllergenPdf(html,outputPath,chromium,launchOptions={}){
 const browser=await chromium.launch({...launchOptions,headless:true});
 try{const page=await browser.newPage();await page.emulateMedia({media:'print'});await page.setContent(html);await page.evaluate(()=>document.fonts.ready);
 const errors=await page.evaluate(()=>[...document.querySelectorAll('.day-cell')].flatMap((cell,i)=>{const box=cell.getBoundingClientRect();return [...cell.querySelectorAll('.component,.badge,.component-name')].filter(el=>{const r=el.getBoundingClientRect();return r.bottom>box.bottom+1||r.right>box.right+1||r.left<box.left-1||el.scrollWidth>el.clientWidth+1;}).map(()=>`Créneau ${i+1} : contenu trop dense pour une page lisible`);}));
 if(errors.length)throw new Error([...new Set(errors)].join('; '));
 }finally{await browser.close();}
 await exportOrderSheetPdf(html,outputPath,chromium,'landscape',launchOptions);
}
module.exports={exportWeeklyAllergenPdf};
