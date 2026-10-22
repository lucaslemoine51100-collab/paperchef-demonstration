(function(root,factory){const visuals=factory();if(typeof module==='object'&&module.exports)module.exports=visuals;else root.CuisineVisuals=visuals;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const paths={
 label:'<path d="M3 3h8l10 10-8 8L3 11V3Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
 view:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
 print:'<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6zM17 12h1"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',

 star:'<path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.2-.9Z"/>',
 people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6m3 11v-2a5 5 0 0 0-3-4.6"/>',
 calendarEdit:'<rect x="3" y="5" width="16" height="16" rx="2"/><path d="M7 3v4m8-4v4M3 10h16m-9 7 8-8 3 3-8 8h-3v-3Z"/>',
 reset:'<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',

 meat:'<path d="M6 9c3-5 12-5 14 1 2 5-4 10-10 9-5-1-7-6-4-10Z"/><path d="m7 12 4 3 6-4"/><circle cx="16" cy="9" r="1.5"/>',
 fish:'<path d="M5 12c5-8 12-6 16 0-4 6-11 8-16 0Zm0 0-3-4v8l3-4Z"/><circle cx="16" cy="11" r="1"/>',
 vegetarian:'<path d="M5 16C3 7 10 3 19 4c0 9-5 15-12 13M5 20 15 9"/><path d="M14 17c1-4 6-4 7-1s-2 5-5 5-4-2-2-4Z"/>',
 starch:'<path d="M3 12h18c-1 6-4 8-9 8s-8-2-9-8ZM7 8l1-3m4 3 1-3m4 3 1-3M7 22h10"/>',
 vegetable:'<path d="m14 8 3 3-10 10-3-3L14 8Zm0 0 2-5m-1 6 6-3m-4 4 5 1M9 13l3 3M6 16l2 2"/>',
 sauce:'<path d="M3 10h15c0 6-3 9-8 9-4 0-6-3-7-9Zm15 1h3c2 0 2 4-1 4h-3M4 21h13M5 10 2 7m6-1 1-3m4 3 1-3"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2m-8 4h2m4 0h2"/>',
 menu:'<rect x="7" y="2" width="11" height="20" rx="1"/><path d="M10 6h5m-5 4h5m-5 4h3M2 3v6m3-6v6M2 6h3M3.5 9v13M22 11v11"/><ellipse cx="22" cy="6" rx="1.5" ry="4"/>',
 technical:'<path d="M6 2h9l4 4v16H6V2Zm9 0v5h4M9 11h7m-7 4h7m-7 4h4"/>',
 order:'<path d="M8 4H5v18h15V4h-3M9 2h7v4H9V2ZM8 10l1 1 2-2m2 1h4m-9 5 1 1 2-2m2 1h4M8 19h9"/>',
 allergens:'<path d="M12 2 22 20H2L12 2Z"/><path d="M12 8v5m0 3v1"/>',
 lunch:'<circle cx="12" cy="12" r="5"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
 dinner:'<path d="M20 15A9 9 0 0 1 9 3 9 9 0 1 0 20 15Z"/>',
 edit:'<path d="m4 16 12-12 4 4L8 20H4v-4Zm9-9 4 4"/>',copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',move:'<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4"/>',delete:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>'
};
const categories={meat:{label:'Viande',color:'#b92535'},fish:{label:'Poisson',color:'#126bb0'},vegetarian:{label:'Végétarien',color:'#37772b'},starch:{label:'Féculent',color:'#8b641d'},vegetable:{label:'Légume',color:'#185c3e'},sauce:{label:'Sauce',color:'#70449a'}};
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function icon(key,badge=false){if(!paths[key])return '';return '<span class="'+(badge?'visual-badge':'visual-icon')+'"'+(badge?' style="--visual-color:'+categories[key].color+'"':'')+' aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">'+paths[key]+'</svg></span>';}
function key(path){const a=Array.isArray(path)?path:[path.category,path.subcategory];if(['Protein','Protéine'].includes(a[0]))return ({Meat:'meat',Viande:'meat',Fish:'fish',Poisson:'fish',Vegetarian:'vegetarian','Végétarien':'vegetarian'})[a[1]];return ({Starch:'starch','Féculent':'starch',Vegetable:'vegetable','Légume':'vegetable',Sauce:'sauce'})[a[0]];}
function chips(paths){return '<span class="category-chips">'+[...new Set((paths||[]).map(key).filter(Boolean))].map(k=>'<span class="category-chip">'+icon(k,true)+'<span>'+safe(categories[k].label)+'</span></span>').join('')+'</span>';}
return {categories,paths,icon,key,chips};
});

(()=>{
if(typeof window==='undefined')return;
function mount(host,{services,selected='',reason=()=>'',onSelect=()=>{},title='',proposal=false}){reason=()=>'';let term='',type='',compatible=false,current=selected;host.classList.add('service-mini-library');host.innerHTML='<div class="mini-search"><label>Quel plat recherchez-vous ?<input type="search" data-mini-search autocomplete="off" placeholder="Rechercher un plat ou un service…"></label><span data-mini-count></span></div><div class="mini-filters"><div class="colour-filters"><button type="button" data-mini-type="" aria-pressed="true">Tous</button><button type="button" data-mini-type="split" aria-pressed="false">'+CuisineVisuals.icon('meat',true)+CuisineVisuals.icon('fish',true)+'Viande / poisson</button><button type="button" data-mini-type="vegetarian" aria-pressed="false">'+CuisineVisuals.icon('vegetarian',true)+'Végétarien</button></div><label class="mini-compatible" hidden><input type="checkbox" data-mini-compatible checked>Compatibles avec ce créneau</label></div><p class="muted" data-mini-note></p><div class="mini-service-grid" data-mini-results></div>';
 const input=host.querySelector('[data-mini-search]'),results=host.querySelector('[data-mini-results]');const normalize=v=>String(v||'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 function draw(){const needle=normalize(term).trim(),rows=services.map(s=>({s,blocked:reason(s)})).filter(({s,blocked})=>(!compatible||!blocked||s.id===current)&&(!type||(type==='vegetarian')===!!s.vegetarian)&&normalize([s.name,...(s.components||[]).map(c=>c.name),...(s.accompaniments||[])].join(' ')).includes(needle)).sort((a,b)=>Number(b.s.id===current)-Number(a.s.id===current)||Number(!!a.blocked)-Number(!!b.blocked));host.querySelector('[data-mini-count]').textContent=rows.length+' services affichés';host.querySelector('[data-mini-note]').hidden=true;host.querySelector('[data-mini-note]').textContent=compatible?'Services compatibles avec les règles du créneau. Le service sélectionné reste visible.':(proposal?'Tous les services : vous pouvez proposer un service même incompatible.':'Tous les services : les incompatibilités sont indiquées avant de forcer.');results.innerHTML=rows.map(({s,blocked})=>'<button type="button" class="mini-service-card '+(s.id===current?'selected ':'')+(blocked?'incompatible':'')+'" data-mini-service="'+esc(s.id)+'" aria-pressed="'+(s.id===current)+'"><span class="mini-card-heading"><span>'+(s.vegetarian?'Végétarien':'Viande / poisson')+'</span><span>'+(s.id===current?'✓ Sélectionné':blocked?(proposal?'Proposer quand même':'Forcer'):(proposal?'Proposer':'Choisir'))+'</span></span><span class="service-cartouches">'+((s.components||[]).length?s.components.map(dishVisual).join(''):'<strong>'+esc(s.name)+'</strong>')+'</span>'+(blocked?'<span class="mini-warning">'+esc(blocked)+'</span>':'')+'</button>').join('')||'<p class="mini-empty">Aucun service trouvé. Changez la recherche ou désactivez le filtre de compatibilité.</p>';}
 input.addEventListener('input',()=>{term=input.value;draw();});host.querySelector('[data-mini-compatible]').addEventListener('change',e=>{compatible=e.target.checked;draw();});host.querySelectorAll('[data-mini-type]').forEach(b=>b.addEventListener('click',()=>{type=b.dataset.miniType;host.querySelectorAll('[data-mini-type]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw();}));results.addEventListener('click',e=>{const b=e.target.closest('[data-mini-service]');if(!b)return;const service=services.find(s=>s.id===b.dataset.miniService),blocked=reason(service);if(blocked&&!proposal&&!confirm('Forcer ce service malgré cette règle ?\n\n'+blocked))return;current=service.id;draw();onSelect(service,blocked);});draw();return {refresh:draw,reason:()=>reason(services.find(s=>s.id===current)),focus:()=>input.focus({preventScroll:true})};}
const preview=document.createElement('div');preview.className='mini-service-hover';preview.setAttribute('popover','manual');preview.setAttribute('aria-hidden','true');document.body.append(preview);let hoverCard=null;
function closePreview(){hoverCard=null;if(preview.matches(':popover-open'))preview.hidePopover();}
function showMiniPreview(e){if(e.pointerType==='touch')return;const card=e.target.closest?.('.mini-service-card');if(document.querySelector('.variant-quick:popover-open,.planning-drop-menu:popover-open')){closePreview();return;}if(card===hoverCard&&preview.matches(':popover-open'))return;closePreview();if(!card)return;hoverCard=card;const owner=card.closest('dialog')||document.body;if(preview.parentNode!==owner)owner.append(preview);preview.innerHTML=card.querySelector('.service-cartouches').outerHTML+(card.querySelector('.mini-warning')?.outerHTML||'');preview.showPopover();positionMiniPreview(card);}
function positionMiniPreview(card){const bounds=card.getBoundingClientRect(),size=preview.getBoundingClientRect();const right=bounds.right+10,left=right+size.width<innerWidth-12?right:Math.max(12,bounds.left-size.width-10);preview.style.left=left+'px';preview.style.top=Math.max(12,Math.min(bounds.top,innerHeight-size.height-12))+'px';}

document.addEventListener('pointerover',showMiniPreview);document.addEventListener('pointermove',showMiniPreview);
document.addEventListener('pointerout',e=>{if(hoverCard&&e.target.closest?.('.mini-service-card')===hoverCard&&!hoverCard.contains(e.relatedTarget))closePreview();});document.addEventListener('click',closePreview,true);document.addEventListener('scroll',e=>{if(hoverCard?.isConnected&&e.target.contains?.(hoverCard)){positionMiniPreview(hoverCard);}else closePreview();},true);document.addEventListener('keydown',e=>{if(e.key==='Escape')closePreview();});document.addEventListener('close',closePreview,true);addEventListener('blur',closePreview);addEventListener('resize',closePreview);
window.ServicePicker={mount};
})();
