// Transcription de la fiche Semaine 5, avec correction de sauce autorisée.
const ingredients=[
 ['Choucroute cuisinée (seau)','kg','FreshProduce','review_required',[]],
 ['Knacks','pièces','Meat','review_required',[]],
 ['Poitrine fumée en petites tranches','pièces','Meat','review_required',[]],
 ['Filets d’églefin','pièces','Fish','known',['fish']],
 ['Persil surgelé','kg','Frozen','none',[]],
 ['Ciboulette surgelée','kg','Frozen','none',[]],
 ['Moutarde douce','kg','Grocery','review_required',['mustard']]
];
const line=(name,quantity,unit)=>({name,quantity,unit,is_qs:quantity===null});
const salt=line('Sel fin',null,'QS'),pepper=line('Poivre noir',null,'QS');
const dishes=[
 {key:'choucroute',name:'Choucroute',category:'Vegetable',group:'all',base:100,lines:[line('Choucroute cuisinée (seau)','15','kg')],steps:['Réchauffer la choucroute progressivement dans des bacs GN.','Mélanger délicatement.','Maintenir au chaud jusqu’au service.'],notes:['150 g par couvert. Produit cuisiné : vérifier la composition du produit utilisé.']},
 {key:'garniture-viande',name:'Garniture viande de choucroute',category:'Protein',subcategory:'Meat',group:'meat',base:70,lines:[line('Knacks','70','pièces'),line('Poitrine fumée en petites tranches','70','pièces')],steps:['Cuire les knacks dans de l’eau frémissante sans forte ébullition, ou au four avec un peu d’eau.','Disposer les petites tranches de poitrine fumée sur plaques et les faire dorer au four.','Maintenir au chaud jusqu’au service.'],notes:['Une knack et une petite tranche de poitrine par portion viande. Poids des pièces non fourni. Vérifier les compositions des charcuteries.']},
 {key:'eglefin',name:'Filet d’églefin',category:'Protein',subcategory:'Fish',group:'fish',base:30,lines:[line('Filets d’églefin','30','pièces'),line('Huile d’olive','150','ml'),line('Jus de citron','100','ml'),line('Persil surgelé','50','g'),salt,pepper],steps:['Disposer les filets sur plaques GN.','Arroser d’huile d’olive et de jus de citron.','Assaisonner avec sel et poivre.','Cuire au four au plus près du service.','Parsemer de persil en sortie.'],notes:['Un filet par portion poisson. Poids du filet non fourni.']},
 {key:'pommes-vapeur',name:'Pommes de terre vapeur',category:'Starch',group:'all',base:100,lines:[line('Pommes de terre sous vide','25','kg'),line('Beurre doux','300','g'),line('Persil surgelé','150','g'),salt],steps:['Réchauffer les pommes de terre au four vapeur ou en four mixte.','Ajouter le beurre et le persil.','Assaisonner avec du sel.','Maintenir au chaud jusqu’au service.'],notes:['250 g par couvert. Utiliser des pommes de terre entières déjà cuites sous vide.']},
 {key:'sauce',name:'Sauce fromage blanc citron-ciboulette',category:'Sauce',group:'all',base:100,yield:'7.5',lines:[line('Fromage blanc','6.75','kg'),line('Jus de citron','375','ml'),line('Moutarde douce','225','g'),line('Ciboulette surgelée','150','g'),line('Persil surgelé','112.5','g'),salt,pepper],steps:['Mélanger le fromage blanc épais et la moutarde douce.','Ajouter progressivement le jus de citron.','Incorporer la ciboulette et le persil.','Assaisonner avec sel et poivre.','Réserver au froid jusqu’au service.'],notes:['Convention validée : cible de 7,5 L pour 100 couverts, soit 75 ml par personne.','Recette d’origine à objectif 5 kg : ingrédients multipliés par 1,5 sur instruction utilisateur. Le rendement volumique est conventionnel, non mesuré.','Proposer la sauce à part pour les deux garnitures.']}
];
const instructions=['Disposer la choucroute dans le bac de service.','Ajouter la garniture viande (knack et poitrine fumée) ou le filet d’églefin.','Servir avec les pommes de terre vapeur.','Proposer la sauce fromage blanc citron-ciboulette à part.','Consigne indiquée sur la fiche source : maintenir les préparations chaudes à ≥ 63 °C.'];
async function integrate(request){
 let catalog=await request('/api/library/catalog');
 for(const [name,unit,category,allergenStatus,allergenIds]of ingredients){if(!catalog.ingredients.some(i=>i.normalized_name===name)){await request('/api/library/ingredients','POST',{name,unit,category,allergenStatus,allergenIds});catalog=await request('/api/library/catalog');}}
 const existing=await request('/api/dishes'),created=[];
 for(const d of dishes){let found=existing.find(x=>x.name===d.name);if(found)throw Error('Un plat porte déjà le nom '+d.name+' : comparer avant de réimporter.');
  const recipe={scale_mode:d.group==='all'?'by_headcount':'by_portions',[d.group==='all'?'reference_headcount':'reference_portions']:String(d.base),steps:d.steps,notes:d.notes,yield_value:d.yield||null,yield_unit:d.yield?'L':null,production_references:[]};
  const saved=await request('/api/dishes/save','POST',{dish:{name:d.name,active:true,configuration:{portion_group:d.group,classification_tags:[]}},recipe,categories:[{category:d.category,subcategory:d.subcategory||null}],ingredients:d.lines.map(l=>{const i=catalog.ingredients.find(i=>i.normalized_name===l.name);if(!i)throw Error('Ingrédient introuvable : '+l.name);return {ingredient_id:i.id,quantity:l.quantity,unit:l.unit,is_qs:l.is_qs};})});created.push({definition:d,data:await request('/api/dishes/detail?id='+saved.id)});
 }
 const graph=(await request('/api/library/new')).snapshot;
 graph.components=created.map(({definition:d,data},index)=>({id:'import-choucroute-'+d.key,domain_key:d.key,name:d.name,dish_id:data.dish.id,recipe_id:data.recipe.id,portion_group:d.group,sort_order:index,active:true,menu_visible:true,classification_tags:[]}));
 const saved=await request('/api/assembly/save','POST',{snapshot:graph});return {serviceId:saved.id,dishIds:created.map(x=>x.data.dish.id)};
}
module.exports={integrate,dishes,ingredients,instructions};
