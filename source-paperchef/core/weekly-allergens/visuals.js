// Référentiel de présentation, indépendant des libellés provenant de la base.
const definitions=[
 ['gluten','Gluten','#C51D34','M16 5v23M16 12C10 12 9 7 9 7c6 0 7 5 7 5Zm0 0c6 0 7-5 7-5-6 0-7 5-7 5Zm0 6c-6 0-7-5-7-5 6 0 7 5 7 5Zm0 0c6 0 7-5 7-5-6 0-7 5-7 5Zm0 6c-6 0-7-5-7-5 6 0 7 5 7 5Zm0 0c6 0 7-5 7-5-6 0-7 5-7 5Z'],
 ['crustaceans','Crustacés','#C04B00','M23 10c-10-6-19 6-12 14 5 6 15 0 11-6-3-4-9-2-9 1M23 10l4-5m-4 5 5 1M10 12l6 2m-8 4 6 1m-3 7 4-4M23 13h.1'],
 ['eggs','Œufs','#9C6300','M16 5C10 5 6 17 7 22c2 8 16 8 18 0 1-5-3-17-9-17Z'],
 ['fish','Poissons','#006FC4','M7 16c7-11 15-7 20 0-5 7-13 11-20 0Zm0 0-4-5v10l4-5M22 14h.1'],
 ['peanuts','Arachides','#AD4775','M11 5C5 5 5 11 9 16 5 21 6 27 12 27c5 0 5-6 8-9 6-6 6-12 1-13-5-1-6 4-10 0ZM12 10l3 3m-4 8 3 2'],
 ['soy','Soja','#176936','M16 27V14m0 6C3 22 4 8 4 8c10 0 12 8 12 12Zm0-4C16 5 27 5 27 5c1 10-6 12-11 11Z'],
 ['milk','Lait','#6542B5','M12 4h8v5l3 4v15H9V13l3-4V4Zm0 5h8M9 15h14'],
 ['nuts','Fruits à coque','#6F3C1B','M16 5C5 13 6 26 16 28c10-2 11-15 0-23ZM16 9c-3 6-3 11 0 15'],
 ['celery','Céleri','#008477','M12 27 9 14m7 13V11m4 16 3-13M11 27h10M9 14C2 13 4 6 9 8c4-4 7 3 0 6Zm7-3c-7-4-2-10 0-6 4-3 7 3 0 6Zm7 3c-7-3-4-10 0-6 5-2 7 5 0 6Z'],
 ['mustard','Moutarde','#897300','M10 5h12v4H10ZM8 12h16v16H8Zm4 4v8m4-8v8m4-8v8'],
 ['sesame','Sésame','#536E20','M8 6c-4 3-4 9 0 9s4-6 0-9Zm15 1c-4 3-4 9 0 9s4-6 0-9Zm-8 12c-4 3-4 9 0 9s4-6 0-9Z'],
 ['sulphites','Sulfites','#47566B','M12 5h8m-7 0v8L6 25c-1 2 0 3 2 3h16c2 0 3-1 2-3l-7-12V5M11 18h10M18 21c-6-3-6 3-2 3 4 0 4 4-2 2'],
 ['lupin','Lupin','#9B2EA0','M16 28V5M16 8c-7 0-6-6 0-3 6-3 7 3 0 3Zm0 6c-10 0-9-7 0-4 9-3 10 4 0 4Zm0 6c-12 0-11-8 0-4 11-4 12 4 0 4ZM16 27l-7-4m7 4 7-4'],
 ['molluscs','Mollusques','#8E163B','M16 27C3 22 3 9 8 10c0-5 5-6 8-3 3-3 8-2 8 3 5-1 5 12-8 17ZM16 27V9m0 18L9 12m7 15 7-15m-7 15L6 17m10 10 10-10']
];
const allergenVisuals=Object.fromEntries(definitions.map(([allergenId,label,color,path],index)=>[allergenId,{allergenId,label,color,order:index,icon:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="${label}"><circle cx="16" cy="16" r="16" fill="${color}"/><path d="${path}" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`}]));
function orderedVisuals(ids){return [...new Set(ids)].map(id=>{if(!allergenVisuals[id])throw new Error('Allergène non référencé : '+id);return allergenVisuals[id];}).sort((a,b)=>a.order-b.order);}
function fixedAllergenLegend(){return orderedVisuals(Object.keys(allergenVisuals));}
const functionalColors={Protein:'#ed0037',Starch:'#d46500',Vegetable:'#00834b',Sauce:'#9400e6'};
function functionalColor(categories){const keys=categories.map(p=>Array.isArray(p)?p:[p.category,p.subcategory]);for(const sub of ['Viande','Meat','Poisson','Fish','Végétarien','Vegetarian'])if(keys.some(p=>['Protéine','Protein'].includes(p[0])&&p[1]===sub))return {Viande:'#ed0037',Meat:'#ed0037',Poisson:'#0063f5',Fish:'#0063f5','Végétarien':'#59a600',Vegetarian:'#59a600'}[sub];for(const [name,key]of [['Protéine','Protein'],['Féculent','Starch'],['Légume','Vegetable'],['Sauce','Sauce']])if(keys.some(p=>[name,key].includes(p[0])))return functionalColors[key];if(keys.some(p=>p[0]==='Finition'))return functionalColors.Protein;throw new Error('Fonction de composant non référencée');}
const attentionSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#096126" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m32 7 26 46H6L32 7Z"/><path d="M32 24v14m0 7v1"/></svg>';
const categoryLegend=[{label:'Viande',color:'#ed0037'},{label:'Poisson',color:'#0063f5'},{label:'Protéine végétarienne',color:'#59a600'},{label:'Légume',color:'#00834b'},{label:'Féculent',color:'#d46500'},{label:'Sauce',color:'#9400e6'}];
module.exports={allergenVisuals,orderedVisuals,fixedAllergenLegend,functionalColor,attentionSvg,categoryLegend};


