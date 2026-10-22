// Ciqual 2025, food 4032: cooked deep-fried fries; used only for served estimates.
const cookedFries={"energy_kcal": 258.0, "protein_g": 3.28, "carbohydrate_g": 32.7, "sugars_g": 0.61, "fat_g": 11.9, "saturated_fat_g": 2.86, "fibre_g": 3.9, "salt_g": 0.073};
const keys=['energy_kcal','protein_g','carbohydrate_g','sugars_g','fat_g','saturated_fat_g','fibre_g','salt_g'];
const number=x=>typeof x==='object'&&x?Number(x.numerator)/Number(x.denominator):Number(x);
const empty=()=>Object.fromEntries(keys.map(k=>[k,0]));
function proteinIngredient(block,line,profile){
 if(!(block.categories||[]).some(c=>c[0]==='Protéine'))return false;
 const name=line.name.toLocaleLowerCase('fr');
 if(/bouillon|fond de|jus de|graisse|huile|lait|crème|beurre|fromage|emmental|farine|chapelure|sauce|concentré/.test(name))return false;
 if(/poulet|dinde|canard|bœuf|boeuf|veau|porc|jambon|lardon|sauciss|chipolata|merguez|boudin|chorizo|steak|rosbif|cabillaud|colin|hoki|merlu|lieu|saumon|truite|thon|dorade|églefin|raie|limande|morue|poisson|œuf|oeuf|tofu|protéine.*soja|accro/i.test(name))return true;
 return false;
}
function portionKind(b){const cats=(b.categories||[]).map(c=>c[0]),complete=cats.includes('Protéine')&&(cats.includes('Féculent')||cats.includes('Légume'));
 if(complete){const grams=/croque/i.test(b.name)?200:/quiche/i.test(b.name)?200:/pizza/i.test(b.name)?250:350;return {mode:'complete',grams,label:'Plat complet'};}
 if(b.colorProfile==='starch')return {mode:'side',grams:150,label:'Féculent après cuisson'};
 if(b.colorProfile==='vegetable')return {mode:'side',grams:150,label:'Légume servi'};
 if(b.colorProfile==='sauce')return {mode:'sauce',grams:/vinaigrette/i.test(b.name)?15:70,label:/vinaigrette/i.test(b.name)?'Vinaigrette':'Sauce d’accompagnement'};
 if(cats.includes('Protéine')&&/rougail|carbonnade|bourguignon|marengo|basquaise|tajine|blanquette|sauté|sauce|provençale|curry|caramel|ragoût|ragout|colombo|goulash/i.test(b.name))return {mode:'stew',label:'Protéine et garniture en sauce'};
 return {mode:'recipe',label:'Recette'};
}
function calculate(vm,ingredients,snapshot){
 const names=new Map(ingredients.map(i=>[i.normalized_name.toLocaleLowerCase('fr'),i.nutrition_per_100g]));
 const shared=new Map((vm.sharedPreparations||[]).map(b=>[b.id,b]));
 function block(b,seen=new Set()){
 const values=empty(),notes=new Set();let mass=0,hydration=0,water=0;const parts=[];if(seen.has(b.id))return {values,mass,notes:['Préparation cyclique non calculée']};seen=new Set(seen).add(b.id);
 const portions=number(b.calculatedPortions)||0;const pieceTotal=(b.ingredients||[]).filter(i=>i.exact&&!i.internalTransfer&&proteinIngredient(b,i,names.get(i.name.toLocaleLowerCase('fr')))&&['pièces','unités'].includes(i.displayUnit)).reduce((s,i)=>s+number(i.exact),0);
 for(const i of b.ingredients||[]){
 if(i.internalTransfer){const source=shared.get(i.fromPreparation);if(source){const sub=block(source,seen),allocation=source.allocations?.find(a=>a.targetId===b.id),total=(source.allocations||[]).reduce((s,a)=>s+number(a.exact),0);const ratio=total>0?number(allocation?.exact)/total:0;if(ratio>0){let servedRatio=ratio;const sauce=(source.categories||[]).some(c=>c[0]==='Sauce')&&!/béchamel|marinade|sauce tomate persillée/i.test(source.name);const limit=/vinaigrette/i.test(source.name)?15:70;if(sauce&&portions>0&&sub.mass*ratio>limit*portions){servedRatio=limit*portions/sub.mass;notes.add((limit===15?'Vinaigrette liée':'Sauce liée')+' : '+limit+' g maximum par assiette (portion estimée)');}keys.forEach(k=>values[k]+=sub.values[k]*servedRatio);mass+=sub.mass*servedRatio;parts.push({protein:false,mass:sub.mass*servedRatio,values:Object.fromEntries(keys.map(k=>[k,sub.values[k]*servedRatio]))});sub.notes.forEach(n=>notes.add(n));}else notes.add('Prélèvement de préparation non quantifié');}else notes.add('Préparation liée non identifiée');continue;}
 let grams=number(i.exact),unit=i.displayUnit;
 if(!i.exact){const p=names.get(i.name.toLocaleLowerCase('fr'));if(i===b.ingredients[0]&&(b.categories||[]).some(c=>c[0]==='Protéine')&&p?.protein_g>4){grams=120*portions;unit='g';notes.add('Protéine : 120 g par portion (grammage estimé)');}else{notes.add('Quantités suffisantes non comptabilisées');continue;}}
 if(unit==='kg'||unit==='L')grams*=1000;else if(!['g','ml'].includes(unit)){
 const protein=proteinIngredient(b,i,names.get(i.name.toLocaleLowerCase('fr')));grams=protein?120*portions*grams/(pieceTotal||grams):grams*50;notes.add(protein?'Protéine : 120 g par portion (grammage estimé)':'Ingrédients en pièces : poids moyen estimé à 50 g');
 }else if(unit==='ml')notes.add('Volumes convertis avec une densité estimée');
 const profile=names.get(i.name.toLocaleLowerCase('fr'));mass+=grams;
 const food=profile?.source?.food_name||'',ingredient=i.name.toLocaleLowerCase('fr');if(/^eau(?:\s|$)/.test(ingredient))water+=grams;
 let factor=1;if(!/frais|cuite?|préparé|appertisé|conserve/i.test(food)&&/cru|sec|à cuire/i.test(food)){if(/riz|semoule|couscous|polenta|boulgour/i.test(ingredient))factor=3;else if(/pâte|spaghetti|macaroni|penne|lentille|pois chiche|haricot (blanc|rouge|sec)/i.test(ingredient))factor=2.5;}
 if(factor>1){hydration+=grams*(factor-1);notes.add('Poids après cuisson estimé : '+i.name+' × '+factor+' (eau absorbée)');}
 if(!profile||profile.quality==='unknown'){notes.add('Valeurs manquantes : '+i.name);parts.push({protein:proteinIngredient(b,i,profile),sausage:/sauciss|chipolata|merguez|boudin/i.test(i.name),mass:grams,values:empty()});continue;}
 const contribution=empty();keys.forEach(k=>{if(Number.isFinite(profile[k])){contribution[k]=profile[k]*grams/100;values[k]+=contribution[k];}else notes.add('Valeur manquante : '+i.name);});parts.push({protein:proteinIngredient(b,i,profile),sausage:/sauciss|chipolata|merguez|boudin/i.test(i.name),mass:grams,values:contribution});
 }
 const absorbed=Math.max(0,hydration-water);mass+=absorbed;if(absorbed)parts.push({protein:false,mass:absorbed,values:empty()});return {values,mass,parts,notes:[...notes]};
 }
 const components=vm.components.map(b=>{const total=block(b),portions=number(b.calculatedPortions),model=portionKind(b),rawServing=portions>0?total.mass/portions:null;
 let target=rawServing,kind=model.label,perPortion=null,sauceValues=null,sauceGrams=0,notes=[...total.notes];
 if(portions>0&&total.parts.some(p=>p.protein)&&(model.mode==='stew'||(model.mode==='recipe'&&total.parts.some(p=>p.protein&&p.sausage)))){
 const primary=total.parts.filter(p=>p.protein),support=total.parts.filter(p=>!p.protein),proteinMass=primary.reduce((sum,p)=>sum+p.mass,0),supportMass=support.reduce((sum,p)=>sum+p.mass,0),servedSupport=model.mode==='stew'?Math.min(supportMass/portions,70):supportMass/portions,ratio=supportMass>0?servedSupport*portions/supportMass:0;
 sauceGrams=model.mode==='stew'?servedSupport:0;sauceValues=Object.fromEntries(keys.map(k=>[k,support.reduce((sum,p)=>sum+p.values[k],0)*ratio/portions]));
 const proteinServing=primary.some(p=>p.sausage)?Math.min(120,proteinMass/portions):proteinMass/portions,proteinRatio=proteinMass>0?proteinServing*portions/proteinMass:0;
 perPortion=Object.fromEntries(keys.map(k=>[k,(primary.reduce((sum,p)=>sum+p.values[k],0)*proteinRatio+support.reduce((sum,p)=>sum+p.values[k],0)*ratio)/portions]));target=proteinServing+servedSupport;
 if(model.mode!=='stew')sauceValues=null;
 notes.unshift((model.mode==='stew'?'Plat mijoté : ':'Saucisses et assimilés : ')+Math.round(proteinServing)+' g de protéine + '+Math.round(servedSupport)+' g de sauce et garniture (portions estimées)');
 }else{
 if(model.mode==='complete'||model.mode==='side')target=model.grams;else if(model.mode==='sauce')target=Math.min(model.grams,rawServing||model.grams);
 perPortion=total.mass>0&&target>0?Object.fromEntries(keys.map(k=>[k,total.values[k]*target/total.mass])):null;
 if(model.mode==='sauce'){sauceGrams=target;sauceValues=perPortion;}
 if(target&&model.mode!=='recipe')notes.unshift(kind+' : '+Math.round(target)+' g par assiette (portion estimée)');
 if(model.mode==='stew'&&!total.parts.some(p=>p.protein))notes.unshift('Protéine non isolable : estimation globale conservée');
 }
 let cookedProfile=null;
 if(/^frites(?:\s|$)/i.test(b.name)&&!/four|air.?fryer/i.test(b.name)&&(b.ingredients||[]).some(i=>/frites.*cru/i.test(i.name))&&target>0&&!(b.ingredients||[]).some(i=>/frite/i.test(i.name)&&/cuites? en.*friteuse/i.test(names.get(i.name.toLocaleLowerCase('fr'))?.source?.food_name||''))){
 cookedProfile=cookedFries;perPortion=Object.fromEntries(keys.map(k=>[k,cookedProfile[k]*target/100]));notes.push('Frites cuites en friteuse : référence Ciqual 2025, huile absorbée et perte d’eau incluses (valeurs estimées)');
 }
 return {id:b.id,name:b.name,categories:b.categories,group:b.colorProfile,audience:snapshot?.components.find(x=>x.id===b.source?.componentId)?.portion_group||'all',perPortion,per100g:cookedProfile?{...cookedProfile}:total.mass>0?Object.fromEntries(keys.map(k=>[k,total.values[k]*100/total.mass])):null,grams:perPortion?target:null,model:model.mode,sauceGrams,sauceValues,notes};});
 const groups=[...new Set(components.filter(c=>['meat','fish','vegetarian'].includes(c.group)).map(c=>c.group))];
 const plates=(groups.length?groups:['all']).map(group=>{const selected=components.filter(c=>(!['meat','fish','vegetarian'].includes(c.group)||c.group===group)&&(!['meat','fish','vegetarian'].includes(c.audience)||c.audience===group)),sauceMass=selected.reduce((sum,c)=>sum+(c.sauceGrams||0),0),sauceRatio=sauceMass>70?70/sauceMass:1;
 const notes=[...new Set(selected.flatMap(c=>c.notes))];if(sauceRatio<1)notes.push('Sauces intégrées et accompagnement : 70 g maximum au total, répartis proportionnellement (estimation)');
 return {group,label:{meat:'Assiette viande',fish:'Assiette poisson',vegetarian:'Assiette végétarienne',all:'Assiette type'}[group],values:keys.some(k=>selected.some(c=>!c.perPortion))?null:Object.fromEntries(keys.map(k=>[k,selected.reduce((sum,c)=>sum+c.perPortion[k]-(c.sauceValues?.[k]||0)*(1-sauceRatio),0)])),components:selected.map(c=>c.name),notes};});
 return {components,plates,estimated:true,portionModel:'served-estimate-v2'};
}
async function profiles(db){return (await db.query('SELECT normalized_name,nutrition_per_100g FROM catering.ingredients')).rows;}
module.exports={calculate,profiles,keys,portionKind};
