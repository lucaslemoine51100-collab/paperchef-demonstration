(function(root){
'use strict';
const mm=72/25.4,W=100*mm,H=40*mm,PAGE=[210*mm,297*mm],LEFT=5*mm,TOP=(PAGE[1]-6*H)/2;
const context=document.createElement('canvas').getContext('2d');
function width(text,size,bold=false,italic=false){context.font=(italic?'italic ':'')+(bold?'bold ':'')+(size*96/72)+'px Arial';return context.measureText(text).width*72/96;}
function wrap(text,size,max,bold=false){const lines=[];for(const paragraph of String(text||'').split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){if(width((line?line+' ':'')+word,size,bold)<=max){line+=(line?' ':'')+word;continue;}if(line){lines.push(line);line='';}if(width(word,size,bold)<=max)line=word;else for(const char of Array.from(word)){if(width(line+char,size,bold)>max&&line){lines.push(line);line='';}line+=char;}}if(line)lines.push(line);}return lines;}
function layout(label,catalog){
 if(label.preset){const original=catalog.marks.find(m=>m.id===(label.marks||[])[0]);if(!original)throw Error('Modèle de pictogramme introuvable.');const color=/^#[0-9a-f]{6}$/i.test(label.color)?label.color:'#00834b',m={...original,icon:original.icon.replace(/#32694a/gi,color)},size=64,labelSize=24,labelWidth=width(m.label,labelSize,true),gap=14,total=size+gap+labelWidth,left=(W-total)/2;return {title:[],titleX:[],subtitle:[],subtitleX:[],badges:[],pad:8,textWidth:W-16,total:size,marks:[{m,size,x:left,y:(H-size)/2,labelX:left+size+gap,labelY:(H-labelSize*1.1)/2,labelWidth,labelSize}],divider:null};}

 const marks=(label.marks||[]).map(id=>catalog.marks.find(m=>m.id===id)).filter(Boolean),allergens=(label.allergens||[]).map(id=>catalog.allergens.find(a=>a.allergenId===id)).filter(Boolean),pad=8,headerHeight=marks.length?40:0,textWidth=W-pad*2,available=H-pad*2-headerHeight;
 const max={large:22,medium:19,small:16}[label.size]||22;let fitted;
 for(let extra=1;extra>=.6&&!fitted;extra-=.1)for(let size=max;size>=6;size-=.5){const title=wrap(label.title,size,textWidth,true),subtitle=wrap(label.subtitle,9*extra,textWidth),badgeFont=9*extra,icon=13*extra,badgeGap=4*extra,badges=[];let x=0,y=0;
  for(const a of allergens){const name=a.allergenId==='fish'?'Poisson':a.label,item=icon+3*extra+width(name,badgeFont,false,true);if(x&&x+item>textWidth){x=0;y+=icon+badgeGap;}badges.push({a,name,x,y,size:badgeFont,icon,width:item});x+=item+7*extra;}
  const titleH=title.length*size*1.1,subH=subtitle.length*10.3*extra,badgeH=badges.length?y+icon:0,total=titleH+(title.length&&subtitle.length?5:0)+subH+(badgeH&&(title.length||subtitle.length)?7*extra:0)+badgeH;
  if(total<=available&&badges.every(b=>b.width<=textWidth)){let top=pad+headerHeight+(available-total)/2;const titleTop=top;top+=titleH+(title.length&&subtitle.length?5:0);const subtitleTop=top;top+=subH+(badgeH&&(title.length||subtitle.length)?7*extra:0);fitted={title,titleTop,size,subtitle,subtitleTop,subtitleSize:9*extra,badges:badges.map(b=>({...b,x:pad+b.x,y:top+b.y})),pad,textWidth,total};break;}
 }
 if(!fitted)throw Error('Ce texte est trop long pour un écriteau. Raccourcissez le titre ou le texte complémentaire.');
 let markSize=marks.length>2?24:30,labelSize=marks.length>2?10:12,gap=5,between=14,items,totalWidth;
 for(let attempt=0;attempt<12;attempt++){items=marks.map(m=>({m,width:markSize+gap+width(m.label,labelSize,true)}));totalWidth=items.reduce((sum,m)=>sum+m.width,0)+Math.max(0,items.length-1)*between;if(totalWidth<=W-pad*2)break;markSize*=.92;labelSize*=.92;gap*=.92;between*=.92;}
 let cursor=(W-totalWidth)/2;
 fitted.marks=items.map(item=>{const m={m:item.m,size:markSize,x:cursor,y:pad,labelX:cursor+markSize+gap,labelY:pad+(markSize-labelSize*1.1)/2,labelWidth:item.width-markSize-gap,labelSize};cursor+=item.width+between;return {...m,m:{...m.m,icon:m.m.icon.replace(/#32694a/gi,/^#[0-9a-f]{6}$/i.test(label.color)?label.color:'#263b30')}};});
 fitted.divider=marks.length?{x:pad,y:pad+34,width:W-pad*2}:null;
 fitted.titleX=fitted.title.map(t=>(W-width(t,fitted.size,true))/2);fitted.subtitleX=fitted.subtitle.map(t=>(W-width(t,fitted.subtitleSize))/2);
 const rows=new Map();for(const b of fitted.badges){const row=rows.get(b.y)||[];row.push(b);rows.set(b.y,row);}for(const row of rows.values()){const left=Math.min(...row.map(b=>b.x)),right=Math.max(...row.map(b=>b.x+b.width)),offset=(W-(right-left))/2-left;row.forEach(b=>b.x+=offset);}return fitted;
}
function cutSvg(){let lines='';for(let col=0;col<=2;col++){const x=LEFT+col*W;lines+='<path d="M '+x+' '+TOP+' V '+(TOP+6*H)+'"/>';}for(let row=0;row<=6;row++){const y=TOP+row*H;lines+='<path d="M '+LEFT+' '+y+' H '+(LEFT+2*W)+'"/>';}return '<svg xmlns="http://www.w3.org/2000/svg" width="'+PAGE[0]+'" height="'+PAGE[1]+'"><g fill="none" stroke="#8d9991" stroke-width=".35" stroke-dasharray="2 2">'+lines+'</g></svg>';}
async function generate(model){
 const content=[];model.labels.forEach((label,index)=>{const l=layout(label,model.catalog),x=LEFT+(index%2)*W,y=TOP+Math.floor(index/2)*H,color=/^#[0-9a-f]{6}$/i.test(label.color)?label.color:'#263b30';
  l.title.forEach((line,i)=>content.push({text:line,bold:true,color,fontSize:l.size,noWrap:true,absolutePosition:{x:x+l.titleX[i],y:y+l.titleTop+i*l.size*1.1}}));
  l.subtitle.forEach((line,i)=>content.push({text:line,fontSize:l.subtitleSize,color:'#576a5e',noWrap:true,absolutePosition:{x:x+l.subtitleX[i],y:y+l.subtitleTop+i*l.subtitleSize*1.144}}));
  l.badges.forEach(b=>{content.push({svg:b.a.icon,fit:[b.icon,b.icon],absolutePosition:{x:x+b.x,y:y+b.y}});content.push({text:b.name,italics:true,color:'#576a5e',fontSize:b.size,noWrap:true,absolutePosition:{x:x+b.x+b.icon+3*(b.icon/13),y:y+b.y+(b.icon-b.size*1.1)/2}});});
  if(l.divider)content.push({canvas:[{type:'line',x1:0,y1:0,x2:l.divider.width,y2:0,lineWidth:.6,lineColor:'#9ab6a4'}],absolutePosition:{x:x+l.divider.x,y:y+l.divider.y}});
  l.marks.forEach(m=>{content.push({...(m.m.image?{image:m.m.image}:{svg:m.m.icon}),fit:[m.size,m.size],absolutePosition:{x:x+m.x,y:y+m.y}});content.push({columns:[{width:m.labelWidth,text:m.m.label,fontSize:m.labelSize,bold:true,color,alignment:'left'}],absolutePosition:{x:x+m.labelX,y:y+m.labelY}});});
 });
 const def={pageSize:{width:PAGE[0],height:PAGE[1]},pageMargins:0,defaultStyle:{font:'ReferenceSans'},info:{title:'Étiquettes PaperChef · 10 × 4 cm',author:'PaperChef'},content:content.length?content:[{text:''}],...(model.cuts?{background:{svg:cutSvg(),width:PAGE[0],height:PAGE[1]}}:{})};
 const bytes=await new Promise((resolve,reject)=>{try{root.pdfMake.createPdf(def).getBuffer(resolve);}catch(e){reject(e);}});const pdf=await root.PDFLib.PDFDocument.load(bytes);if(pdf.getPageCount()!==1)throw Error('La planche doit tenir sur une seule feuille A4.');return {bytes,pages:1,definition:def};
}
root.PaperChefLabels={layout,generate,geometry:{W,H,PAGE,LEFT,TOP},wrap};
})(window);
