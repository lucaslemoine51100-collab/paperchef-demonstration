(function(root){
'use strict';
const colors={meat:'#b3233e',fish:'#116bb3',vegetarian:'#327337',starch:'#956617',vegetable:'#176443',sauce:'#7444ae',neutral:'#586d60'};
const tint=(color,ratio=.13)=>'#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*ratio+255*(1-ratio)).toString(16).padStart(2,'0')).join('');
const proteinBlock=c=>c.categories.some(p=>p[0]==='Protéine');
const rank=c=>proteinBlock(c)?(c.colorProfile==='fish'?1:0):c.categories.some(p=>p[0]==='Féculent')?2:c.categories.some(p=>p[0]==='Légume')?3:4;
const border={hLineWidth:()=>.45,vLineWidth:()=>.45,hLineColor:()=> '#cbd8cf',vLineColor:()=> '#cbd8cf',paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0};
function numbered(steps,color,s){return (steps||[]).map((step,i)=>({columns:[{width:13*s,fit:[13*s,13*s],svg:`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="10" fill="${color}"/><text x="11" y="15.2" font-family="Roboto" font-size="13" text-anchor="middle" fill="white">${step.order||i+1}</text></svg>`},{width:'*',text:step.text,fontSize:8*s,lineHeight:1.08}],columnGap:2*s,margin:[0,0,0,2*s]}));}
function definition(sheet,s=1,options={}){
const vm=sheet.viewModel,blocks=sheet.blocks.slice().sort((a,b)=>rank(a)-rank(b));
const table=items=>({table:{widths:['*','auto'],body:(items||[]).map(i=>[{text:i.name+(i.internalTransfer&&!/prélev|voir la case/i.test(i.name)?' · prélevé':''),fontSize:8.5*s},{text:i.displayQuantity,bold:true,fontSize:8.5*s,alignment:'right'}])},layout:{hLineWidth:()=>.35,vLineWidth:()=>0,hLineColor:()=> '#dae3dd',paddingLeft:()=>0,paddingRight:()=>1*s,paddingTop:()=>1*s,paddingBottom:()=>1*s}});
const small=(text,fill)=>({text,fontSize:7.3*s,lineHeight:1.1,margin:[0,3*s,0,0],...(fill?{background:fill}: {})});
function card(c,wide){const color=colors[c.colorProfile]||colors.neutral,sections=c.recipeSections||[];
 const ingredients=[{columns:[{text:'INGRÉDIENTS',bold:true},{text:'QUANTITÉ',bold:true,alignment:'right'}],fontSize:7*s,margin:[0,0,0,2*s]}];if(c.ingredients.length)ingredients.push(table(c.ingredients));
 for(const section of sections){ingredients.push({text:section.name,bold:true,fontSize:7*s,margin:[0,3*s,0,2*s]});if(section.ingredients.length)ingredients.push(table(section.ingredients));}
 const method=[{text:'PRÉPARATION',bold:true,fontSize:7*s,margin:[0,4*s,0,2*s]}];
 for(const section of sections){method.push({text:section.name,bold:true,fontSize:7*s},...numbered(section.preparationSteps,color,s));if(section.notes.length)method.push(small(section.notes.join(' · ')));}
 if(sections.length)method.push({text:'Montage / cuisson',bold:true,fontSize:7*s});method.push(...numbered(c.preparationSteps,color,s));if(!c.preparationSteps.length)method.push(small('Préparation à compléter'));
 if(c.allocations.length)method.push(small('Répartition · '+c.allocations.map(a=>a.to+' : '+a.displayQuantity).join(' · '),'#f1f5f2'));
 const notes=[...new Set(c.notes.map(n=>n.trim()).filter(n=>!c.preparationSteps.some(t=>t.text.trim()===n)))];if(notes.length)method.push(small(notes.join(' · ')));
 if(c.yield)method.push(small('Production : '+c.yield,'#f1f5f2'));if(c.serviceRule)method.push(small((c.serviceRuleLabel||'Réserve service')+' : '+c.serviceRule,'#f1f5f2'));
 if(c.productionUnits)method.push(small(c.productionUnits.units+' · '+c.productionUnits.name+(c.productionUnits.items?' · '+c.productionUnits.items:''),'#f1f5f2'));
 for(const reference of c.productionReferences||[])if(reference.trayPlan)method.push(small(reference.trayPlan.text,'#f1f5f2'));
 if(c.allergens.length){const columns=[{width:50*s,text:'Allergènes :',fontSize:7.3*s,bold:true}];for(const name of c.allergens){const icon=sheet.allergenIcons[name];if(icon)columns.push({width:10*s,svg:icon,fit:[10*s,10*s]});columns.push({width:'auto',text:name,fontSize:7.3*s});}method.push({columns,columnGap:2*s,margin:[0,4*s,0,0]});}
 const icon=c.iconSvg||sheet.categoryIcons.sauce;
 const head={columns:[{width:17.008*s,svg:icon,fit:[17.008*s,17.008*s]},{width:'*',text:c.name,bold:true,fontSize:10.5*s},...(proteinBlock(c)?[{width:'auto',text:c.calculatedPortions+' portions',bold:true,fontSize:7.5*s}]:[])],columnGap:5.669*s,margin:[4.252*s,4.252*s,4.252*s,4.252*s]};
 return {table:{widths:['*'],body:[[{stack:[head],fillColor:options.decoration?undefined:tint(color),border:options.decoration?[false,false,false,false]:undefined}],[{border:options.decoration?[false,false,false,false]:undefined,stack:wide?[{columns:[{width:'*',stack:ingredients},{width:'*',stack:method}],columnGap:10*s}]:[...ingredients,...method],margin:[6*s,5*s,6*s,5*s]}]]},layout:border};
}
const protein=blocks.filter(proteinBlock),accomp=blocks.filter(c=>!proteinBlock(c));
const titleRows=(protein.length?protein:[{name:vm.serviceName,colorProfile:'neutral'}]).map(c=>[{text:c.name.toLocaleUpperCase('fr'),bold:true,noWrap:true,lineHeight:.94,fontSize:17*s*(options.titleScale||1),fillColor:options.decoration?undefined:tint(colors[c.colorProfile]||colors.neutral,.102),margin:[2.835,0,2.835,0]}]);
const heading={columns:[{width:36,svg:sheet.potSvg,fit:[36,36],margin:[0,6,0,0]},{width:1,canvas:[{type:'line',x1:0,y1:0,x2:0,y2:58*s,lineWidth:.5,lineColor:'#9db4a5'}]},{width:'*',stack:[{table:{widths:['*'],body:titleRows},layout:'noBorders'},{text:accomp.map((c,i)=>({text:c.name+(i<accomp.length-1?'  ':''),background:tint(colors[c.colorProfile]||colors.neutral)})),fontSize:9*s,margin:[0,4,0,3]},{text:[{text:vm.headcount+' couverts',bold:true},' · '+vm.portionSummary],fontSize:10*s}]},{width:60,text:(vm.dayLabel||'SERVICE TYPE')+'\n'+(vm.mealType||'')+(vm.weekInfo?'\n'+vm.weekInfo.label:''),fontSize:8*s,alignment:'right'}],columnGap:11,margin:[0,0,0,9*s]};
const rows=[];for(let i=0;i<blocks.length;i+=2){const pair=blocks.slice(i,i+2),row=i/2;
 if(pair.length===1||(options.split||[]).includes(row)){for(const c of pair)rows.push({stack:[card(c,true)],margin:[0,0,0,8.504*s]});}
 else {const columns=pair.map((c,side)=>{const node=card(c,false);node.table.body[1][0].margin[3]+=(options.stretch?.[row]?.[side]||0);return {width:'*',stack:[node]};});rows.push({columns,columnGap:8.504,margin:[0,0,0,8.504*s]});}}
return {pageSize:'A4',pageOrientation:'portrait',pageMargins:[22.677,22.677,22.677,22.677],defaultStyle:{font:root.pdfMake.fonts.ReferenceSans?'ReferenceSans':'Roboto',color:'#172b29',fontSize:8*s},info:{title:vm.serviceName+' · '+vm.headcount+' couverts',author:'PaperChef',creator:'PaperChef — aperçu sur poste',creationDate:new Date('2026-01-01T00:00:00Z'),modDate:new Date('2026-01-01T00:00:00Z')},...(options.decoration?{background:{svg:options.decoration,width:595.28,height:841.89}}:{}),content:[heading,...rows,{text:'QS : quantité suffisante.'+(!vm.allergensComplete?' Composition à vérifier : consulter le contrôle allergènes.':''),fontSize:6.5,color:'#53695b',margin:[0,5.669,0,0]}]};
}
function bottom(item){const x=item.item;if(item.type==='line')return x.y+x.getHeight();if(item.type==='vector')return Math.max(x.y1||0,x.y2||0,(x.y||0)+(x.h||0));if(item.type==='svg')return (x.y||0)+(x.height||0);return (x.y||0)+(x.height||0);}
async function inspect(def){const doc=root.pdfMake.createPdf(def).getStream({paperchefLayoutOnly:true});const pages=doc._pdfMakePages;
 // La mise en page est calculée. Ne pas sérialiser les polices pour chacun des essais de taille.
 if(typeof doc.destroy==='function')doc.destroy();else await new Promise((resolve,reject)=>{doc.on('data',()=>{});doc.on('end',resolve);doc.on('error',reject);doc.end();});return {pages,def};}
async function metric(sheet,scale,titleScale,split,detailed=false){
 let def=definition(sheet,scale,{titleScale,split}),layout=await inspect(def);if(layout.pages.length!==1)return {fit:false,scale,height:Infinity,white:Infinity,def};
 const stretch={},eligible=[];let white=0,at=1;
 for(let i=0;i<Math.ceil(sheet.blocks.length/2);i++){
  const count=Math.min(2,sheet.blocks.length-i*2);
  if(split.includes(i)){at+=count;continue;}
  const row=def.content[at++];if(!row.columns)continue;
  const ends=row.columns.map(c=>c.stack[0]._bottomByPage[0]),max=Math.max(...ends),blanks=ends.map(n=>Math.max(0,max-n));
  stretch[i]=blanks;const total=blanks.reduce((a,b)=>a+b,0);white+=total;if(total>33.75)eligible.push(i);
 }
 if(detailed){def=definition(sheet,scale,{titleScale,split,stretch});layout=await inspect(def);}const height=Math.max(...layout.pages[0].items.map(bottom))-22.677;
 // Un texte sans retour peut agrandir sa colonne : comparer à la largeur réellement disponible sur A4.
 const title=def.content[0].columns[2].stack[0],available=595.28-2*22.677-36-1-60-3*11;const titleWidth=Math.max(...title.table.body.map(r=>r[0]._minWidth),available);
 return {fit:layout.pages.length===1&&height<=793.701,scale,titleScale,split,stretch,white,eligible,height,def,page:layout.pages[0],overflow:titleWidth/available};
}
async function fit(sheet,split){let titleScale=1,result;for(let pass=0;pass<6;pass++){let low=.4,high=1.15;const maximum=await metric(sheet,1.15,titleScale,split);if(maximum.fit)low=1.149999;else for(let i=0;i<16;i++){const middle=(low+high)/2,m=await metric(sheet,middle,titleScale,split);if(m.fit)low=middle;else high=middle;if(Math.floor(low*1000)===Math.floor(high*1000))break;}result=await metric(sheet,Math.floor(low*1000)/1000,titleScale,split,true);if(!result.fit)throw Error('Cette fiche dépasse une page A4 : aucun fichier tronqué ne sera produit.');if(result.overflow<=1.002)break;titleScale=titleScale/result.overflow*.995;}if(result.overflow>1.01)throw Error('Le titre dépasse sa cartouche.');return result;}

function decoration(sheet,m){
 const blocks=sheet.blocks.slice().sort((a,b)=>rank(a)-rank(b));let index=0;const shapes=[];
 for(const row of m.def.content.slice(1,-1))for(const column of row.columns||[row]){
  const card=column.stack[0],block=blocks[index++],color=colors[block.colorProfile]||colors.neutral,position=card.positions[0];
  const x=position.left-4.252*m.scale-.45,y=position.top-4.252*m.scale-.45,w=card.table.widths[0]._calcWidth+.9,h=card._bottomByPage[0]-y;
  const headEnd=card.table.body[1][0].positions[0].top-5*m.scale-.225,r=5.669,a=2.835;
  shapes.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="white"/>');
  shapes.push('<path d="M '+x+' '+headEnd+' V '+(y+r)+' Q '+x+' '+y+' '+(x+r)+' '+y+' H '+(x+w-r)+' Q '+(x+w)+' '+y+' '+(x+w)+' '+(y+r)+' V '+headEnd+' Z" fill="'+tint(color)+'"/>');
  shapes.push('<path d="M '+x+' '+headEnd+' V '+(y+r)+' Q '+x+' '+y+' '+(x+r)+' '+y+' H '+(x+a)+' V '+headEnd+' Z" fill="'+color+'"/>');
  shapes.push('<path d="M '+x+' '+headEnd+' H '+(x+w)+'" stroke="#cbd8cf" stroke-width=".45"/><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="none" stroke="#cbd8cf" stroke-width=".45"/>');
 }
 const title=m.def.content[0].columns[2].stack[0];const proteins=blocks.filter(proteinBlock);
 title.table.body.forEach((row,i)=>{const cell=row[0],pos=cell.positions[0],line=m.page.items.find(p=>p.type==='line'&&Math.abs(p.item.y-pos.top)<.01&&Math.abs(p.item.x-pos.left)<.01);const height=(line?line.item.getHeight():cell.fontSize*1.05)+4;shapes.push('<rect x="'+(pos.left-2.835)+'" y="'+(pos.top-2)+'" width="'+title.table.widths[0]._calcWidth+'" height="'+height+'" rx="2.835" fill="'+tint(colors[proteins[i]?.colorProfile]||colors.neutral,.102)+'"/>');});
 return '<svg xmlns="http://www.w3.org/2000/svg" width="595.28" height="841.89" viewBox="0 0 595.28 841.89">'+shapes.join('')+'</svg>';
}
async function generate(sheet){
 const baseline=await fit(sheet,[]);let best=baseline;const choices=[...baseline.eligible.map(i=>[i]),...(baseline.eligible.length>1?[baseline.eligible]:[])];
 for(const split of choices){const m=await fit(sheet,split);if(m.scale+.001<baseline.scale||m.height>793.701+.75)continue;const reduces=m.white<baseline.white-Math.max(15,baseline.white*.15),larger=m.scale>baseline.scale*1.03&&m.white<=baseline.white;if(!(reduces||larger))continue;if(m.scale>best.scale+.02||m.scale>=best.scale-.001&&m.white<best.white)best=m;}
 const def=definition(sheet,best.scale,{titleScale:best.titleScale,split:best.split});
 // Sérialiser une définition fraîche avec les marges mesurées.
 const fresh=definition(sheet,best.scale,{titleScale:best.titleScale,split:best.split,stretch:best.stretch,decoration:decoration(sheet,best)});const bytes=await new Promise((resolve,reject)=>{try{root.pdfMake.createPdf(fresh).getBuffer(resolve);}catch(e){reject(e);}});const pdf=await root.PDFLib.PDFDocument.load(bytes);if(pdf.getPageCount()!==1)throw Error('La fiche dépasse une page A4.');return {bytes,scale:best.scale,titleScale:best.titleScale,pages:1,split:best.split,white:best.white,definition:def};
}
root.PaperChefBrowserPdf={definition,generate};
})(typeof window!=='undefined'?window:globalThis);




