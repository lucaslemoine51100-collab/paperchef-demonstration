const dishBlockDialog=document.createElement('dialog');dishBlockDialog.id='dish-block-preview';dishBlockDialog.setAttribute('aria-labelledby','dish-block-title');document.body.append(dishBlockDialog);
let dishBlockRequest=0;dishBlockDialog.addEventListener('close',()=>{dishBlockRequest++;dishBlockDialog.querySelectorAll('iframe').forEach(frame=>frame.remove());});
async function openDishBlock(args){const token=++dishBlockRequest;dishBlockDialog.innerHTML='<div class="dialog-head"><h2 id="dish-block-title">Fiche du plat</h2><button type="button" class="button secondary" data-close-dish-block>Fermer</button></div><p role="status">Chargement de la recette…</p>';if(!dishBlockDialog.open)dishBlockDialog.showModal();try{const data=await api('/api/dishes/preview?'+query(args));if(token!==dishBlockRequest||!dishBlockDialog.open)return;dishBlockDialog.querySelector('[role=status]').remove();const frame=document.createElement('iframe');frame.title=data.name;frame.srcdoc=data.html;frame.onload=()=>{const resize=()=>{frame.style.height=Math.ceil(frame.contentDocument.documentElement.scrollHeight+4)+'px'};frame.contentDocument.fonts.ready.then(resize);resize();};const split=document.createElement("div");split.className=window.PaperChefShared?.user?.role==='diet'?"nutrition-split":"technical-preview-only";split.append(frame);if(window.PaperChefShared?.user?.role==='diet')split.insertAdjacentHTML("beforeend",nutritionDishHtml(data.nutrition));dishBlockDialog.append(split);}catch(e){const status=dishBlockDialog.querySelector('[role=status]');if(token===dishBlockRequest&&dishBlockDialog.open&&status)status.textContent=e.message;}}
document.addEventListener('click',async event=>{if(event.target.closest('[data-select-week-service]'))return;const close=event.target.closest('[data-close-dish-block]');if(close){dishBlockRequest++;dishBlockDialog.close();return;}const edit=event.target.closest('[data-edit-dish-card]');if(edit){event.preventDefault();try{wizard={step:0,tab:'ingredients',dish:null,chooser:null,filter:'',search:'',returnContext:null};libraryCatalog=await api('/api/library/catalog');await editDish(edit.dataset.editDishCard,{standalone:true});}catch(e){notify(e.message);}return;}
 const component=event.target.closest('[data-service-dish-preview]');if(component){event.preventDefault();event.stopImmediatePropagation();openDishBlock({serviceId:component.dataset.serviceDishPreview,componentId:component.dataset.componentPreview});return;}
 const dish=event.target.closest('[data-dish-preview]');if(dish&&!event.target.closest('button,a,summary,details,input,label')){event.preventDefault();event.stopImmediatePropagation();openDishBlock({id:dish.dataset.dishPreview});return;}
 const card=event.target.closest('[data-service-preview]');if(card&&!event.target.closest('a,details,[data-action],[data-library],button:not([data-service-sheet])')){event.preventDefault();event.stopImmediatePropagation();openNutritionService(card.dataset.servicePreview);}
},true);
document.addEventListener('keydown',event=>{if(event.target.matches('[data-service-dish-preview]')&&['Enter',' '].includes(event.key)){event.preventDefault();event.target.click();}});
document.addEventListener("pointerover",e=>{const card=e.target.closest?.("#library-list[data-library-view=list]>.library-card,#dish-library-cards[data-library-view=list]>.dish-card");if(card){clearTimeout(card._previewLeave);card.classList.add("show-library-details");}});document.addEventListener("pointerout",e=>{const card=e.target.closest?.("#library-list[data-library-view=list]>.library-card,#dish-library-cards[data-library-view=list]>.dish-card");if(card&&!card.contains(e.relatedTarget))card._previewLeave=setTimeout(()=>card.classList.remove("show-library-details"),250);});

// Un nouveau survol remplace l'ancien, même si une carte conserve le focus.
const hoverOwners='#library-list>.library-card,#dish-library-cards>.dish-card,.planned-card,.document-tile,[data-model-card]';
let previousHoverOwner;
document.addEventListener('pointerover',event=>{
 if(event.pointerType==='touch')return;
 const onPlanningButton=event.target.closest?.('.shared-service-actions, .meal-cover-button, [data-select-service-dish], .dish-card-actions label');
 const current=onPlanningButton?null:event.target.closest?.(hoverOwners);
 if(current===previousHoverOwner)return;
 previousHoverOwner=current;
 for(const owner of document.querySelectorAll(hoverOwners)){
  if(owner===current){owner.classList.remove('hover-suppressed');continue;}
  owner.classList.add('hover-suppressed');
  clearTimeout(owner._previewLeave);owner.classList.remove('show-library-details');
  owner.querySelector('.library-info')?.setAttribute('aria-expanded','false');
 }
 if(!current?.matches('[data-model-card]'))for(const popup of document.querySelectorAll('.model-hover-details'))popup.hidden=true;
});
addEventListener('blur',()=>{previousHoverOwner=undefined;for(const owner of document.querySelectorAll(hoverOwners)){owner.classList.add('hover-suppressed');owner.classList.remove('show-library-details');}for(const popup of document.querySelectorAll('.model-hover-details'))popup.hidden=true;});
document.addEventListener('focusin',event=>{const owner=event.target.closest?.(hoverOwners);if(owner&&!event.target.closest('[data-select-service-dish]'))owner.classList.remove('hover-suppressed');});

