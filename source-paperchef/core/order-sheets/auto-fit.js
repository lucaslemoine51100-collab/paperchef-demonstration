
function balanceOrderColumns(sheet){
 const grid=sheet.querySelector('.columns'),count=sheet.classList.contains('portrait')?2:4;
 if(!sheet.orderRows){const rows=[],templates=new Map();for(const block of grid.querySelectorAll('.category')){const key=block.querySelector('table').getAttribute('aria-label');if(!templates.has(key))templates.set(key,block.cloneNode(true));for(const row of block.querySelectorAll('tbody tr'))rows.push({key,row:row.cloneNode(true),first:!rows.some(r=>r.key===key)});}sheet.orderRows=rows;sheet.orderTemplates=templates;}
 const rows=sheet.orderRows,n=rows.length;if(!n)return;
 const gap=parseFloat(getComputedStyle(grid).columnGap),width=(grid.clientWidth-gap*(count-1))/count;
 const measure=document.createElement('div');measure.style.cssText='position:absolute;visibility:hidden;pointer-events:none;width:'+width+'px';sheet.append(measure);
 const heights=[],headers=new Map();for(const [key,t]of sheet.orderTemplates){const block=t.cloneNode(true);block.classList.remove('continuation');block.querySelector('tbody').replaceChildren(...rows.filter(r=>r.key===key).map(r=>r.row.cloneNode(true)));measure.append(block);const header=block.querySelector('header');headers.set(key,(header?.getBoundingClientRect().height||0)+parseFloat(getComputedStyle(block).marginBottom)+2);for(const tr of block.querySelectorAll('tbody tr'))heights.push({key,height:tr.getBoundingClientRect().height});block.remove();}measure.remove();
 const rowHeights=rows.map((r,i)=>heights[i].height),prefix=[0];for(let i=0;i<n;i++)prefix.push(prefix[i]+rowHeights[i]+(rows[i].first?headers.get(rows[i].key):0));
 const cost=(a,z)=>prefix[z]-prefix[a]+(!rows[a]?.first?2:0),dp=Array.from({length:count+1},()=>Array(n+1).fill(Infinity)),cuts=Array.from({length:count+1},()=>Array(n+1));dp[0][0]=0;
 for(let c=1;c<=count;c++)for(let z=c;z<=n;z++)for(let a=c-1;a<z;a++){const score=Math.max(dp[c-1][a],cost(a,z));if(score<dp[c][z]){dp[c][z]=score;cuts[c][z]=a;}}
 const ranges=[];let z=n;for(let c=Math.min(count,n);c>0;c--){const a=cuts[c][z];ranges.unshift([a,z]);z=a;}
 grid.replaceChildren(...ranges.map(([a,z])=>{const col=document.createElement('div');col.className='column';for(let i=a;i<z;){const key=rows[i].key,block=sheet.orderTemplates.get(key).cloneNode(true),body=block.querySelector('tbody');body.replaceChildren();if(!rows[i].first){block.querySelector('header')?.remove();block.classList.add('continuation');}else block.classList.remove('continuation');while(i<z&&rows[i].key===key)body.append(rows[i++].row.cloneNode(true));col.append(block);}return col;}));
}

function alignOrderColumnBottoms(sheet){
 const columns=[...sheet.querySelectorAll('.column')].filter(c=>c.lastElementChild),bottom=c=>c.lastElementChild.getBoundingClientRect().bottom,target=Math.max(...columns.map(bottom));
 for(const col of columns){const tables=[...col.querySelectorAll('table')],rows=tables.reduce((n,t)=>n+t.rows.length,0),extra=target-bottom(col);if(!rows||extra<.1)continue;
 for(const table of tables)table.style.height=(table.getBoundingClientRect().height+extra*table.rows.length/rows)+'px';
 const last=tables.at(-1);for(let i=0;i<3;i++){const correction=target-bottom(col);if(Math.abs(correction)<.1)break;last.style.height=(last.getBoundingClientRect().height+correction)+'px';}
 }
}
function fitOrderSheet(){for(const sheet of document.querySelectorAll('.sheet')){const portrait=sheet.classList.contains('portrait'),width=(portrait?194:281)*96/25.4,height=(portrait?281:194)*96/25.4-2;sheet.style.width=width+'px';sheet.style.padding='0';sheet.style.setProperty('--order-scale','1');balanceOrderColumns(sheet);const fits=()=>sheet.getBoundingClientRect().height<=height&&sheet.scrollWidth<=sheet.clientWidth+1;if(!fits()){let low=.35,high=1;for(let i=0;i<15;i++){const mid=(low+high)/2;sheet.style.setProperty('--order-scale',String(mid));balanceOrderColumns(sheet);if(fits())low=mid;else high=mid;}sheet.style.setProperty('--order-scale',String(Math.floor(low*1000)/1000));balanceOrderColumns(sheet);}alignOrderColumnBottoms(sheet);sheet.dataset.fitScale=sheet.style.getPropertyValue('--order-scale');}}
if(matchMedia('print').matches)fitOrderSheet();addEventListener('beforeprint',fitOrderSheet);addEventListener('afterprint',()=>{for(const s of document.querySelectorAll('.sheet')){s.style.width='';s.style.padding='';s.style.removeProperty('--order-scale');}});