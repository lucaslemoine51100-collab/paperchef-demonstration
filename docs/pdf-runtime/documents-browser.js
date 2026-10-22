(function(root){
'use strict';
const A4=[595.28,841.89],margin=22.677,ink='#172b29',stroke='#cbd8cf';
const tint=(color,ratio=.16)=>'#'+[1,3,5].map(i=>Math.round(parseInt(color.slice(i,i+2),16)*ratio+255*(1-ratio)).toString(16).padStart(2,'0')).join('');
const rule={hLineWidth:()=>.45,vLineWidth:()=>.45,hLineColor:()=>stroke,vLineColor:()=>stroke,paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0};
const info=title=>({title,author:'PaperChef',creator:'PaperChef — aperçu sur poste',creationDate:new Date('2026-01-01T00:00:00Z'),modDate:new Date('2026-01-01T00:00:00Z')});
const document=(title,orientation,content)=>({pageSize:'A4',pageOrientation:orientation,pageMargins:margin,defaultStyle:{font:'ReferenceSans',color:ink,fontSize:9},info:info(title),content});
function heading(title,subtitle,week,icon,s,summary=[],range){
 const width=A4[title==='ALLERGÈNES DE LA SEMAINE'||range?1:0]-2*margin;
 return {stack:[{columns:[{width:36.85,svg:icon,fit:[36.85,36.85]},{width:1,canvas:[{type:'line',x1:0,y1:0,x2:0,y2:42*s,lineWidth:.6,lineColor:'#9db4a5'}]},{width:'*',stack:[{columns:[{width:'*',text:title,bold:true,fontSize:24*s},{width:85,text:week?.label||'',fontSize:7.5*s,alignment:'right'}]},{text:subtitle,fontSize:11*s,color:'#52635d',margin:[0,3*s,0,0]},...(range?[{text:range,fontSize:9*s,margin:[0,0,0,3*s]}]:[]),...(summary.length?[{text:summary.map((t,i)=>({text:t+(i<summary.length-1?'     ':''),bold:true})),fontSize:10*s}]:[])]}],columnGap:8.504},{canvas:[{type:'line',x1:0,y1:3*s,x2:width,y2:3*s,lineWidth:.709,lineColor:'#b9c9c1'}]}],margin:[0,0,0,14.173*s]};
}
function rowLines(vm){return vm.categories.filter(c=>!c.isEmpty).flatMap(c=>c.lines.map((line,i)=>({category:c,line,first:i===0})));}
function partition(entries,costs,count,headers){
 count=Math.min(count,entries.length);if(!count)return [];
 const prefix=[0];entries.forEach((e,i)=>prefix.push(prefix[i]+costs[i]+(e.first?headers[e.category.id]:0)));
 const cost=(a,z)=>prefix[z]-prefix[a]+(!entries[a].first?1.5:0),dp=Array.from({length:count+1},()=>Array(entries.length+1).fill(Infinity)),cut=dp.map(()=>[]);dp[0][0]=0;
 for(let c=1;c<=count;c++)for(let z=c;z<=entries.length;z++)for(let a=c-1;a<z;a++){const score=Math.max(dp[c-1][a],cost(a,z));if(score<dp[c][z]){dp[c][z]=score;cut[c][z]=a;}}
 const ranges=[];let z=entries.length;for(let c=count;c;c--){const a=cut[c][z];ranges.unshift([a,z]);z=a;}return ranges;
}
function orderDefinition(sample,s,options={}){
 const vm=sample.viewModel,landscape=vm.orientation==='landscape',entries=rowLines(vm),count=landscape?4:2;
 const costs=entries.map(e=>(Math.ceil(e.line.name.length/(landscape?28:36))+1)*13*s),headers=Object.fromEntries(vm.categories.map(c=>[c.id,35*s]));
 const ranges=options.ranges||partition(entries,costs,count,headers),blocks=[];
 const columns=ranges.map(([a,z],column)=>{
  const stack=[];for(let i=a;i<z;){const category=entries[i].category,first=entries[i].first,group=[];while(i<z&&entries[i].category.id===category.id)group.push(entries[i++]);
   const head={columns:[{width:22.677*s,svg:sample.icons[category.icon].replace(/#246a34/g,category.color),fit:[22.677*s,22.677*s]},{width:'*',text:category.label.toUpperCase(),bold:true,fontSize:12*s},{width:1,canvas:[{type:'line',x1:0,y1:0,x2:0,y2:17*s,lineWidth:.567,lineColor:'#b9c9c1'}]},{width:40*s,text:'QUANTITÉ\nTOTALE',fontSize:7*s,color:'#52635d',alignment:'center'}],columnGap:5.669*s,margin:[5.669*s,5.669*s,5.669*s,5.669*s]};
   const padding=(landscape?.992:1.984)*s,body={table:{widths:['*','auto'],body:group.map(e=>[{text:e.line.name,fontSize:(landscape?12:11.5)*s},{text:e.line.displayQuantity,bold:true,noWrap:true,alignment:'right',fontSize:(landscape?13:12.5)*s}])},layout:{hLineWidth:()=>.35,vLineWidth:i=>i===1?.35:0,hLineColor:()=>stroke,vLineColor:()=>stroke,paddingLeft:()=>5.669*s,paddingRight:()=>5.669*s,paddingTop:()=>padding,paddingBottom:()=>padding+(options.extra?.[column]||0)}};
   const node={table:{widths:['*'],body:[...(first?[[{stack:[head],fillColor:options.decoration?undefined:tint(category.color),border:options.decoration?[false,false,false,false]:undefined}]]:[]),[{stack:[body],border:options.decoration?[false,false,false,false]:undefined}]]},layout:rule,margin:[0,0,0,8.504*s]};
   blocks.push({node,head:first?head:null,body,group,column,category});stack.push(node);
  }return {width:'*',stack};
 });
 const def=document(vm.title,vm.orientation,[heading(vm.title,'LISTE DES INGRÉDIENTS POUR COMMANDE',vm.weekInfo,sample.icons.order,s,vm.summaryLabels,landscape?(vm.landscapeRangeLabel||vm.rangeLabel):null),{columns,columnGap:landscape?8.504:11.339}, {columns:[{width:'*',text:vm.hasUnquantified?'QS : besoin non quantifié ; « + QS » : quantité connue à compléter.':'',fontSize:7.5*s,color:'#52635d'},{width:30,text:'1 / 1',fontSize:7.5*s,color:'#52635d',alignment:'right'}],margin:[0,5*s,0,0]}]);
 if(options.decoration)def.background={svg:options.decoration,width:landscape?841.89:595.28,height:landscape?595.28:841.89};
 return {def,blocks,entries,ranges};
}
async function inspect(def){const stream=root.pdfMake.createPdf(def).getStream({paperchefLayoutOnly:true}),pages=stream._pdfMakePages;stream.destroy();return pages;}
function fits(pages,orientation){
 if(pages.length!==1)return false;const [width,height]=orientation==='landscape'?[A4[1],A4[0]]:A4;
 return pages[0].items.every(entry=>{const item=entry.item;if(entry.type==='line')return item.inlines.every(i=>item.x+i.x>=margin-.75&&item.x+i.x+i.width<=width-margin+.75)&&item.y>=margin-.75&&item.y+item.getHeight()<=height-margin+.75;
  if(entry.type==='svg')return item.x>=margin-.75&&item.y>=margin-.75&&item.x+item._width<=width-margin+.75&&item.y+item._height<=height-margin+.75;
  return true;
 });
}
function lineHeight(cell,pages){return cell.positions.reduce((n,pos)=>{const line=pages[pos.pageNumber-1].items.find(i=>i.type==='line'&&Math.abs(i.item.x-pos.left)<.02&&Math.abs(i.item.y-pos.top)<.02);return n+(line?line.item.getHeight():0);},0);}
async function orderLayout(sample,s,detailed=false){
 let model=orderDefinition(sample,s),pages=await inspect(model.def);const costs=[],headers={};
 for(const block of model.blocks){const padding=(sample.viewModel.orientation==='landscape'?.992:1.984)*s;
  block.body.table.body.forEach(row=>costs.push(Math.max(...row.map(c=>lineHeight(c,pages)))+padding*2+.35));
  if(block.head){const pos=block.node.positions[0],body=block.body.positions[0];headers[block.category.id]=body.top-pos.top+8.504*s;}
 }
 const ranges=partition(model.entries,costs,sample.viewModel.orientation==='landscape'?4:2,headers);model=orderDefinition(sample,s,{ranges});pages=await inspect(model.def);
 if(!fits(pages,sample.viewModel.orientation))return {fit:false};
 const ends=ranges.map((_r,i)=>Math.max(...model.blocks.filter(b=>b.column===i).map(b=>b.node._bottomByPage[0]))),max=Math.max(...ends),extra=ranges.map(([a,z],i)=>(max-ends[i])/(z-a));
 const fresh=orderDefinition(sample,s,{ranges,extra});if(detailed)pages=await inspect(fresh.def);
 return {fit:fits(pages,sample.viewModel.orientation),def:orderDefinition(sample,s,{ranges,extra}).def,model:fresh,scale:s,ranges,extra};
}
function orderDecoration(sample,result){
 const shapes=[],s=result.scale,padding=(sample.viewModel.orientation==='landscape'?.992:1.984)*s;
 for(const b of result.model.blocks){const pos=b.node.positions[0],x=pos.left-5.669*s-.45,y=pos.top-(b.head?5.669*s:padding+.35)-.45,w=b.node.table.widths[0]._calcWidth+.9,h=b.node._bottomByPage[0]-y,r=5.669;
  shapes.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="white"/>');
  if(b.head){const end=b.body.positions[0].top-padding-.35-.225,a=3.402;
   shapes.push('<path d="M '+x+' '+end+' V '+(y+r)+' Q '+x+' '+y+' '+(x+r)+' '+y+' H '+(x+w-r)+' Q '+(x+w)+' '+y+' '+(x+w)+' '+(y+r)+' V '+end+' Z" fill="'+tint(b.category.color)+'"/>');
   shapes.push('<path d="M '+x+' '+end+' V '+(y+r)+' Q '+x+' '+y+' '+(x+r)+' '+y+' H '+(x+a)+' V '+end+' Z" fill="'+b.category.color+'"/><path d="M '+x+' '+end+' H '+(x+w)+'" stroke="'+stroke+'" stroke-width=".45"/>');
  }shapes.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+r+'" fill="none" stroke="'+stroke+'" stroke-width=".45"/>');
 }return '<svg xmlns="http://www.w3.org/2000/svg" width="'+(sample.viewModel.orientation==='landscape'?841.89:595.28)+'" height="'+(sample.viewModel.orientation==='landscape'?595.28:841.89)+'">'+shapes.join('')+'</svg>';
}
const sun='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#da6900" stroke-width="2"><circle cx="16" cy="16" r="7"/><path d="M16 1v5m0 20v5M1 16h5m20 0h5M5 5l4 4m14 14 4 4M5 27l4-4M23 9l4-4"/></svg>';
const moon='<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path fill="#082766" d="M23 3C8 3 2 17 10 26c7 7 19 2 20-6C17 25 12 11 23 3Z"/></svg>';
function allergenHeading(sample){
 const vm=sample.viewModel,legend=vm.categoryLegend||[],dot=c=>({width:6,canvas:[{type:'ellipse',x:3,y:4,r1:3,r2:3,color:c.color}]}),rows=Array.from({length:3},(_,r)=>({columns:legend.slice(r*2,r*2+2).map(c=>({width:'*',columns:[dot(c),{width:'*',text:c.label,fontSize:7.5,color:'#334d43',margin:[0,0,0,0]}],columnGap:4})),columnGap:7,margin:[0,0,0,4]}));
 return {stack:[{columns:[{width:36.85,svg:sample.potSvg,fit:[36.85,36.85]},{width:1,canvas:[{type:'line',x1:0,y1:0,x2:0,y2:45,lineWidth:.6,lineColor:'#9db4a5'}]},{width:'*',stack:[{text:vm.weekLabel,bold:true,fontSize:24},{text:vm.dateRangeLabel,fontSize:11,color:'#52635d',margin:[0,3,0,0]}]},{width:205,stack:[{text:vm.weekInfo?.label||'',fontSize:7.5,color:'#52635d',alignment:'right',margin:[0,0,0,6]},...rows]}],columnGap:8.504},{canvas:[{type:'line',x1:0,y1:3,x2:A4[1]-2*margin,y2:3,lineWidth:.709,lineColor:'#b9c9c1'}]}],margin:[0,0,0,14.173]};
}
function allergenDefinition(sample,s){
 const vm=sample.viewModel,gridHeight=370,mealHeight=gridHeight/2,visuals=[];
 const meal=(key,label,icon)=>[{stack:[{svg:icon,fit:[26,26],alignment:'center'},{text:label,bold:true,fontSize:12*s,alignment:'center',margin:[0,8,0,0]}],margin:[0,mealHeight/2-24,0,0]},...vm.days.map(day=>{
  const service=day[key],count=Math.max(1,...vm.days.map(d=>d[key]?.components.length||0)),rank=c=>c.functionalCategories.some(p=>p.includes('Viande'))?0:c.functionalCategories.some(p=>p.includes('Poisson'))?1:c.functionalCategories.some(p=>p[0]==='Protéine')?2:c.functionalCategories.some(p=>p[0]==='Féculent')?3:c.functionalCategories.some(p=>p[0]==='Légume')?4:5,components=service?.components.slice().sort((a,b)=>rank(a)-rank(b));
  const body=Array.from({length:count},(_,i)=>{const c=components?.[i];return [{stack:c?[{text:c.name,color:c.displayColor,bold:true,fontSize:9.5*s,alignment:'center'},...(c.allergens.length?[{columns:[{width:'*',text:''},{width:c.allergens.length*14.173*s+(c.allergens.length-1)*2.835*s,columns:c.allergens.map(a=>({width:14.173*s,svg:a.icon,fit:[14.173*s,14.173*s]})),columnGap:2.835*s},{width:'*',text:''}],margin:[0,2.835*s,0,0]}]:[])]:[{text:'',fontSize:1}],margin:[3*s,3.118*s,3*s,3.118*s]}];});
  return {table:{widths:['*'],heights:Array(count).fill(mealHeight/count-1),body},layout:{...rule,vLineWidth:()=>0,hLineWidth:i=>i>0?.35:0}};
 })];
 const width=A4[1]-2*margin,plain={...rule,hLineWidth:()=>0,vLineWidth:()=>0};
 const dayHeadings={columns:[{width:45.354,text:''},...vm.days.map(d=>{const node={text:d.dayLabel,bold:true,fontSize:10,alignment:'center',margin:[0,7,0,7]};visuals.push({node,width:(width-45.354)/7,kind:'heading'});return {width:(width-45.354)/7,stack:[node]};})],columnGap:0};
 const rows=['lunchService','dinnerService'].map((key,i)=>{const node={table:{widths:[45.354,...Array(7).fill('*')],body:[meal(key,i?'SOIR':'MIDI',i?moon:sun)]},layout:{...rule,hLineWidth:()=>0,vLineWidth:i=>i>0&&i<8?.45:0},margin:[0,0,0,i?0:5.669]};visuals.push({node,width,kind:'meal'});return node;});
 const legend={table:{widths:['*'],body:[[{columns:[{width:68,text:'LÉGENDE\nDES ALLERGÈNES',bold:true,fontSize:8,color:'#334d43',margin:[0,12,0,0]},{width:'*',stack:Array.from({length:2},(_,r)=>({columns:vm.legend.slice(r*7,r*7+7).map(a=>({width:'*',columns:[{width:17.008,svg:a.icon,fit:[17.008,17.008]},{width:'*',text:a.label,fontSize:8.5,margin:[0,3,0,0]}],columnGap:3.685})),columnGap:7.087,margin:[0,r?5.669:0,0,0]}))}],columnGap:8.504}]]},layout:{...plain,paddingLeft:()=>7.087,paddingRight:()=>7.087,paddingTop:()=>5.669,paddingBottom:()=>5.669},margin:[0,7.087,0,0]};
 visuals.push({node:legend,width,kind:'legend'});
 const def=document(vm.weekLabel,'landscape',[allergenHeading(sample),dayHeadings,...rows,legend,{text:vm.note+(vm.hasReviewRequired?' Certains ingrédients restent à vérifier dans le référentiel.':''),fontSize:6.7,color:'#52635d',margin:[0,3.969,0,0]}]);
 Object.defineProperty(def,'_visuals',{value:visuals});return def;
}
function allergenDecoration(def){
 const shapes=[];
 for(const v of def._visuals||[]){const p=v.node.positions[0];if(!p||p.pageNumber!==1)continue;
  if(v.kind==='heading'){const x=p.left,y=p.top-7,h=25;shapes.push('<path d="M '+x+' '+(y+h)+' V '+(y+5.669)+' Q '+x+' '+y+' '+(x+5.669)+' '+y+' H '+(x+v.width-5.669)+' Q '+(x+v.width)+' '+y+' '+(x+v.width)+' '+(y+5.669)+' V '+(y+h)+' Z" fill="#e3eaf1"/><path d="M '+(x+2.835)+' '+(y+1.701)+' H '+(x+v.width-2.835)+'" stroke="#082766" stroke-width="3.402"/>');}
  else{const x=margin,y=v.kind==='legend'?Math.min(...v.node.positions.map(p=>p.top))-5.669:p.top-(v.kind==='meal'?mealLabelOffset(v.node):0),h=v.node._bottomByPage[0]-y+(v.kind==='legend'?5.669:0);shapes.push('<rect x="'+x+'" y="'+y+'" width="'+v.width+'" height="'+h+'" rx="'+(v.kind==='legend'?4.252:5.669)+'" fill="'+(v.kind==='legend'?'#f3f6f5':'white')+'" stroke="#b9c9c1" stroke-width=".709"/>');}
 }
 return '<svg xmlns="http://www.w3.org/2000/svg" width="841.89" height="595.28">'+shapes.join('')+'</svg>';
}
function mealLabelOffset(node){return node.table.body[0][0].margin[1];}
async function allergenLayout(sample,s){
 const model=allergenDefinition(sample,s),pages=await inspect(model);if(!fits(pages,'landscape'))return {fit:false};
 const fresh=allergenDefinition(sample,s),cells=def=>def._visuals.filter(v=>v.kind==='meal').flatMap(v=>v.node.table.body[0].slice(1).flatMap(t=>t.table.body.map(row=>({cell:row[0],height:t.table.heights[0]}))));
 const measured=cells(model),target=cells(fresh);
 for(let i=0;i<measured.length;i++){const {cell,height}=measured[i],positions=cell.positions;if(!positions.length)continue;const top=Math.min(...positions.map(p=>p.top));let bottom=top;
  for(const p of positions){const item=pages[p.pageNumber-1].items.find(e=>(e.type==='line'||e.type==='svg')&&Math.abs(e.item.x-p.left)<.02&&Math.abs(e.item.y-p.top)<.02);if(item)bottom=Math.max(bottom,p.top+(item.type==='line'?item.item.getHeight():item.item._height));}
  const content=bottom-top,space=height-cell.margin[1]-cell.margin[3];if(content>space+.2)return {fit:false};target[i].cell.margin[1]+=Math.max(0,(space-content)/2);
 }
 const centeredPages=await inspect(fresh);const def=allergenDefinition(sample,s);cells(def).forEach((v,i)=>{v.cell.margin=target[i].cell.margin.slice();});
 return {fit:fits(centeredPages,'landscape'),def,model:fresh,scale:s};
}
const quantity=r=>r.exact?new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(Number(r.exact.numerator)/Number(r.exact.denominator))+' '+r.unit:r.displayQuantity;
function ratioDefinition(sample,s){
 const dates=[...new Set(sample.documents.map(d=>d.date).filter(Boolean))],visuals=[],width=A4[1]-2*margin,slotWidth=(width-65.197)/2-8.504*s;
 const colors={meat:'#b3233e',fish:'#116bb3',vegetarian:'#327337',vegetable:'#176443',starch:'#956617',sauce:'#7444ae'};
 const plain={...rule,hLineWidth:()=>0,vLineWidth:()=>0};
 const article=(c,r)=>{
  const color=colors[c.colorProfile]||'#587a64',pad=2.835*s;
  let widths=r.ratios.map(i=>Math.max(34.016*s,Math.min(65.197*s,Math.max(quantity(i).length*4.8*s,i.name.length*3.05*s)+8.504*s)));
  let cardWidth=widths.reduce((a,b)=>a+b,0)+2*pad;
  const natural=Math.min(slotWidth,Math.max(c.name.length*3.8*s,Math.min(184.252*s,r.label.length*2.8*s)));
  if(cardWidth<natural){const extra=(natural-cardWidth)/widths.length;widths=widths.map(w=>w+extra);cardWidth=natural;}
  if(cardWidth>slotWidth){const factor=(slotWidth-2*pad)/widths.reduce((a,b)=>a+b,0);widths=widths.map(w=>w*factor);cardWidth=slotWidth;}
  const card={table:{widths:[cardWidth-2*pad],body:[[{stack:[{text:r.label,fontSize:6*s,color,alignment:'center',bold:true,margin:[0,0,0,2.268*s]},{columns:r.ratios.map((i,j)=>({width:widths[j],stack:[{text:quantity(i),bold:true,fontSize:9*s,alignment:'center',noWrap:true},{text:i.name,fontSize:6.8*s,alignment:'center',margin:[2.835*s,1.984*s,2.835*s,0]}]})),columnGap:0},...(r.yield?[{text:'Production : '+r.yield.displayQuantity,fontSize:6.5*s,color,alignment:'center',margin:[0,2*s,0,0]}]:[])]}]]},layout:{...plain,paddingLeft:()=>pad,paddingRight:()=>pad,paddingTop:()=>pad,paddingBottom:()=>pad}};
  visuals.push({node:card,width:cardWidth,pad,color,kind:'ratio',widths,yield:!!r.yield,scale:s});
  return {width:cardWidth,stack:[{text:c.name,bold:true,fontSize:7.5*s,color,margin:[0,0,0,1.984*s]},card]};
 };
 const sections=dates.map(date=>{
  const docs=sample.documents.filter(d=>d.date===date),model=docs.find(d=>!d.blank)?.sheet.viewModel;
  const slots=['lunch','dinner'].map(meal=>{
   const doc=docs.find(d=>d.meal===meal),vm=doc&&!doc.blank?doc.sheet.viewModel:null,refs=vm?[...vm.components,...vm.sharedPreparations].flatMap(c=>(c.productionReferences||[]).map(r=>({c,r}))):[];
   const rows=[];let current=[],used=0;
   refs.forEach(({c,r})=>{const item=article(c,r);if(current.length&&used+5.669*s+item.width>slotWidth){rows.push(current);current=[];used=0;}used+=(current.length?5.669*s:0)+item.width;current.push(item);});if(current.length)rows.push(current);
   return {stack:[{text:meal==='lunch'?'Midi':'Soir',bold:true,fontSize:8*s,color:'#587a64',margin:[0,0,0,2.268*s]},...(refs.length?rows.map(items=>({columns:[...items,{width:'*',text:''}],columnGap:5.669*s,margin:[0,0,0,2.835*s]})):[{text:vm?'Aucun ratio enregistré pour ce service.':'Aucun service planifié.',italics:true,fontSize:7*s,color:'#7a877f'}])],margin:[4.252*s,4.252*s,4.252*s,4.252*s]};
  });
  const section={table:{widths:[65.197,(width-65.197)/2,(width-65.197)/2],body:[[{text:model?.dayLabel||date,bold:true,fontSize:9*s,margin:[5.669,5.669*s,5.669,5.669*s]},...slots]]},layout:{...plain,vLineWidth:i=>i===2?.45:0,vLineColor:()=> '#d2ded5'},margin:[0,0,0,4.252]};
  visuals.unshift({node:section,width,pad:5.669,kind:'day'});return section;
 });
 const def=document('Ratios de la semaine','landscape',[{stack:[{columns:[{width:'*',stack:[{text:'Ratios de la semaine',bold:true,fontSize:18*s},{text:'Repères de préparation · classés par jour et par service',fontSize:8*s,margin:[0,3*s,0,0]}]},{width:170,text:sample.weekInfo.label+'\n'+sample.weekInfo.title,fontSize:8*s,alignment:'right'}]},{canvas:[{type:'line',x1:0,y1:5,x2:width,y2:5,lineWidth:1.5,lineColor:'#426d51'}]}],margin:[0,0,0,10]},...sections,{text:'Quantités de référence · valeurs arrondies pour la lecture.',fontSize:7*s,color:'#53695b',margin:[0,2*s,0,0]}]);
 Object.defineProperty(def,'_visuals',{value:visuals});return def;
}
function ratioDecoration(def){
 const shapes=[];
 for(const v of def._visuals||[]){const p=v.node.positions[0];if(!p||p.pageNumber!==1)continue;const x=p.left-v.pad,y=p.top-(v.kind==='day'?5.669: v.pad),h=v.node._bottomByPage[0]-y,r=v.kind==='day'?5.669:4.252;
  if(v.kind==='day'){shapes.push('<rect x="'+x+'" y="'+y+'" width="'+v.width+'" height="'+h+'" rx="'+r+'" fill="white" stroke="#c6d6cb" stroke-width=".6"/><path d="M '+(x+65.197)+' '+y+' H '+(x+r)+' Q '+x+' '+y+' '+x+' '+(y+r)+' V '+(y+h-r)+' Q '+x+' '+(y+h)+' '+(x+r)+' '+(y+h)+' H '+(x+65.197)+' Z" fill="#e6eee8"/>');}
  else {shapes.push('<rect x="'+x+'" y="'+y+'" width="'+v.width+'" height="'+h+'" rx="'+r+'" fill="'+tint(v.color,.04)+'" stroke="'+v.color+'" stroke-width=".6"/>');let offset=v.pad;const values=v.node.table.body[0][0].stack[1],top=values.positions[0]?.top||y+12*v.scale,bottom=y+h-v.pad-(v.yield?10*v.scale:0);for(const w of v.widths.slice(0,-1)){offset+=w;shapes.push('<path d="M '+(x+offset)+' '+top+' V '+bottom+'" stroke="#ccd6ce" stroke-width=".5"/>');}}
 }
 return '<svg xmlns="http://www.w3.org/2000/svg" width="841.89" height="595.28">'+shapes.join('')+'</svg>';
}
async function fit(layout,high=1){let result=await layout(high);if(result.fit)return result;let low=.35;for(let i=0;i<15;i++){const mid=(low+high)/2,trial=await layout(mid);if(trial.fit)low=mid;else high=mid;if(Math.floor(low*1000)===Math.floor(high*1000))break;}result=await layout(Math.floor(low*1000)/1000);if(!result.fit)throw Error('Le document ne tient pas sur une page A4 : aucun PDF tronqué ne sera produit.');return result;}
async function generateOne(sample){let result;
 if(sample.kind==='order'){result=await fit(s=>orderLayout(sample,s));result=await orderLayout(sample,result.scale,true);if(!result.fit)throw Error('La commande dépasse une page A4.');result.def=orderDefinition(sample,result.scale,{ranges:result.ranges,extra:result.extra,decoration:orderDecoration(sample,result)}).def;}
 else {if(sample.kind==='allergens')result=await fit(s=>allergenLayout(sample,s));else result=await fit(async s=>{const def=ratioDefinition(sample,s),pages=await inspect(def);return {fit:fits(pages,'landscape'),def:ratioDefinition(sample,s),model:def,scale:s};},1.1);result.def.background={svg:(sample.kind==='ratios'?ratioDecoration:allergenDecoration)(result.model),width:841.89,height:595.28};}
 const bytes=await new Promise((resolve,reject)=>{try{root.pdfMake.createPdf(result.def).getBuffer(resolve);}catch(e){reject(e);}});const pdf=await root.PDFLib.PDFDocument.load(bytes);if(pdf.getPageCount()!==1)throw Error('Le document dépasse une page A4.');return {bytes,scale:result.scale,pages:1,definition:result.def};
}
async function merge(documents){if(!documents.length||!documents.some(d=>!d.blank))throw Error('Aucun document à assembler.');const {PDFDocument,degrees}=root.PDFLib,output=await PDFDocument.create(),map=[];
 for(const d of documents){
  if(d.rectoStart&&output.getPageCount()%2===1){map.push({page:output.getPageCount()+1,blank:true,reason:'Alignement recto'});output.addPage(A4);}
  if(d.versoStart&&output.getPageCount()%2===0){map.push({page:output.getPageCount()+1,blank:true,reason:'Alignement verso'});output.addPage(A4);}
  if(d.blank){map.push({page:output.getPageCount()+1,blank:true,date:d.date,meal:d.meal});output.addPage(A4);continue;}
  const source=await PDFDocument.load(d.bytes);if(d.singlePage&&source.getPageCount()!==1)throw Error('Une fiche dépasse une page : midi recto et soir verso ne sont pas garantis.');
  for(let i=0;i<source.getPageCount();i++){
   if(d.lastPageRecto&&i===source.getPageCount()-1&&output.getPageCount()%2===1){map.push({page:output.getPageCount()+1,blank:true,reason:'Dernière commande au recto'});output.addPage(A4);}
   if(d.rotateLandscape){const original=source.getPage(i),{width,height}=original.getSize();if(width<=height)throw Error('Le document à tourner doit être en paysage.');const embedded=await output.embedPage(original),page=output.addPage([height,width]);page.drawPage(embedded,{x:height,y:0,width,height,rotate:degrees(90)});}
   else{const [page]=await output.copyPages(source,[i]);output.addPage(page);}
   map.push({page:output.getPageCount(),id:d.id,date:d.date,meal:d.meal,kind:d.kind});
  }
 }
 output.setTitle('Documents cuisine de la semaine');output.setAuthor('PaperChef');output.setCreationDate(new Date('2026-01-01T00:00:00Z'));output.setModificationDate(new Date('2026-01-01T00:00:00Z'));return {bytes:await output.save(),pages:output.getPageCount(),map};
}
async function generate(sample,{onProgress=()=>{}}={}){
 if(!['technical-pack','order-pack'].includes(sample.kind))return generateOne(sample);
 const documents=[];for(const [index,d]of sample.documents.entries()){
  await onProgress(index,sample.documents.length);if(d.blank){documents.push(d);continue;}
  let result;if(d.kind==='technical')result=await root.PaperChefBrowserPdf.generate(d.sheet);
  else if(d.kind==='ratios')result=await generateOne({kind:'ratios',weekInfo:d.sheet.viewModel.weekInfo,documents:sample.documents.filter(x=>x.kind==='technical')});
  else result=await generateOne({kind:'order',...d.sheet});
  documents.push({...d,bytes:result.bytes});
 }await onProgress(sample.documents.length,sample.documents.length);return merge(documents);
}
root.PaperChefBrowserDocuments={generate,merge,orderDefinition,allergenDefinition,ratioDefinition,quantity};
})(typeof window!=='undefined'?window:globalThis);
