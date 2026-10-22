
function fitWeeklyAllergens(){const sheet=document.querySelector('.sheet');if(!sheet)return;if(!matchMedia('print').matches&&innerWidth<=900){sheet.style.removeProperty('--allergen-scale');return;}
 for(const row of sheet.querySelectorAll('.meal-row')){const services=[...row.querySelectorAll('.service')],count=Math.max(1,...services.map(s=>s.children.length));row.style.setProperty('--component-count',count);}
 const fits=()=>[...sheet.querySelectorAll('.component')].every(c=>c.scrollHeight<=c.clientHeight+1&&c.scrollWidth<=c.clientWidth+1)&&sheet.scrollHeight<=sheet.clientHeight+1;
 sheet.style.setProperty('--allergen-scale','1');if(!fits()){let low=.35,high=1;for(let i=0;i<16;i++){const scale=(low+high)/2;sheet.style.setProperty('--allergen-scale',scale);if(fits())low=scale;else high=scale;}sheet.style.setProperty('--allergen-scale',Math.floor(low*1000)/1000);}
 sheet.dataset.fitScale=sheet.style.getPropertyValue('--allergen-scale');
}
window.fitTechnicalSheet=fitWeeklyAllergens;document.fonts.ready.then(fitWeeklyAllergens);addEventListener('beforeprint',fitWeeklyAllergens);matchMedia('print').addEventListener('change',fitWeeklyAllergens);addEventListener('resize',fitWeeklyAllergens);
