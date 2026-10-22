const {productionReferences}=require('../technical-sheets/production-references');

const {randomUUID}=require('node:crypto');

const {PostgresRepository}=require('./repository');

const {calculateService}=require('./service-calculation');

const {technicalSheetViewModel}=require('../technical-sheets/view-model');

const id=()=>randomUUID(),text=(v,label)=>{if(typeof v!=='string'||!v.trim())throw new Error(label+' est obligatoire.');return v.trim();};

const integer=(v,label)=>{if(!Number.isSafeInteger(Number(v))||Number(v)<1)throw new Error(label+' doit être un entier positif.');return Number(v);};

const decimal=(v,label)=>{if(typeof v!=='string'||!/^\d+(\.\d+)?$/.test(v))throw new Error(label+' doit être une quantité positive ou nulle.');return v;};

const units=['kg','g','L','ml','unités','pièces','portions','bacs','plaques'];

function configurePortionMode(service){const split=service.portion_mode==='split';const ratio=service.split_secondary_ratio||'0.3';if(split&&!['0.3','0.5','0.7'].includes(ratio))throw new Error('Choisissez une des répartitions proposées.');const meat={'0.3':'0.7','0.5':'0.5','0.7':'0.3'}[ratio];Object.assign(service,{split_primary_ratio:split?meat:null,split_secondary_ratio:split?ratio:null,primary_group:split?'meat':null,secondary_group:split?'fish':null,tie_break_target:split?'fish':null,all_group:split?null:'vegetarian'});return service;}

class LibraryEditorRepository extends PostgresRepository {

 async catalog(){return {allergenChoices:(await this.rows('SELECT * FROM catering.allergens ORDER BY sort_order')).map(a=>({...a,icon:require('../weekly-allergens/visuals').allergenVisuals[a.id]?.icon||''})),ingredients:await this.rows("SELECT i.*,coalesce((SELECT jsonb_agg(DISTINCT unit) FROM catering.recipe_ingredients WHERE ingredient_id=i.id AND unit<>'QS'),'[]'::jsonb) AS culinary_units,coalesce((SELECT jsonb_agg(allergen_id) FROM catering.ingredient_allergens WHERE ingredient_id=i.id),'[]'::jsonb) AS allergen_ids,coalesce((SELECT jsonb_agg(a.name ORDER BY a.sort_order) FROM catering.ingredient_allergens ia JOIN catering.allergens a ON a.id=ia.allergen_id WHERE ia.ingredient_id=i.id),'[]'::jsonb) AS allergens FROM catering.ingredients i WHERE active ORDER BY normalized_name").then(rows=>rows.map(({nutrition_per_100g,...row})=>row)),rules:await this.rows('SELECT *,value::text AS value FROM catering.rule_profiles ORDER BY name'),units:await this.rows('SELECT * FROM catering.production_units ORDER BY name'),recipes:await this.rows('SELECT id,name,scale_mode FROM catering.recipes ORDER BY name')};}

 async detail(serviceId){const snapshot=await this.loadService(serviceId);for(const r of snapshot.recipes)r.preparation_steps=r.steps;const calculated=await calculateService({loadService:async()=>snapshot},serviceId,Number(snapshot.service.reference_headcount));const viewModel=technicalSheetViewModel(calculated.result,calculated.snapshot,calculated.metadata);return {snapshot,viewModel,displayComponents:require('../technical-sheets/presentation-blocks').presentationBlocks(viewModel)};}

 async recipe(recipeId){const recipe=await this.getRecipe(recipeId);if(!recipe)throw new Error('Recette introuvable.');return {recipe:{...recipe,preparation_steps:recipe.steps},ingredients:await this.getIngredients(recipeId),overrides:await this.rows('SELECT * FROM catering.recipe_rule_overrides WHERE recipe_id=$1',[recipeId])};}

 async insert(table,row,columns){await this.client.query(`INSERT INTO catering.${table} (${columns.join(',')}) VALUES (${columns.map((_,i)=>'$'+(i+1)).join(',')})`,columns.map(c=>['notes','steps','classification_tags','config_json','production_references'].includes(c)?JSON.stringify(row[c]??(c==='config_json'?{}:[])):row[c]??null));}

 async save(input,{duplicate=false,reuseRecipes=false}={}){

 const graph=structuredClone(input.snapshot),s=graph?.service;if(!s)throw new Error('Service requis.');configurePortionMode(s);s.name=text(s.name,'Le nom du service');if(s.service_instructions!=null&&typeof s.service_instructions!=='string')throw new Error('Consignes de service invalides.');s.service_instructions=(s.service_instructions||'').trim();s.reference_headcount=integer(s.reference_headcount,'La référence');if(!['split','all'].includes(s.portion_mode))throw new Error('Mode protéique invalide.');if(!graph.components?.length)throw new Error('Ajoutez au moins un composant.');

 const existing=s.id?await this.loadService(s.id):null,originalId=s.id;

 if(existing&&!duplicate&&Number(input.expectedVersion)!==existing.service.version)throw new Error('Ce service type a changé. Fermez puis rouvrez l’éditeur.');

 if(existing&&!duplicate){const removed=existing.components.filter(c=>!graph.components.some(n=>n.id===c.id));if(removed.some(c=>!input.confirmedRemoved?.includes(c.id)))throw new Error('Confirmez la suppression de chaque composant retiré.');}

 for(const c of graph.components){c.name=text(c.name,'Le nom du composant');if(!['meat','fish','vegetarian','all'].includes(c.portion_group))throw new Error('Base du composant invalide.');if(s.portion_mode==='all'&&['meat','fish'].includes(c.portion_group))throw new Error('Un service végétarien ne peut pas avoir une base viande ou poisson.');if(!graph.categories.some(k=>k.component_id===c.id)&&!c.classification_tags?.length)throw new Error('Choisissez une catégorie pour '+c.name+'.');}

 for(const r of graph.recipes){r.name=text(r.name,'Le nom de recette');r.steps=r.preparation_steps??r.steps??[];if(!Array.isArray(r.steps)||r.steps.some(v=>typeof v!=='string'||!v.trim()))throw new Error('Supprimez ou renseignez les étapes vides.');r.steps=r.steps.map(v=>v.trim());r.notes??=[];const key={by_portions:'reference_portions',by_headcount:'reference_headcount',by_production_unit:'reference_production_units',shared_preparation:'reference_headcount'}[r.scale_mode];if(!key)throw new Error('Mode de recette invalide.');r[key]=integer(r[key],'La référence de recette');for(const other of ['reference_portions','reference_headcount','reference_production_units'])if(other!==key)r[other]=null;if(r.yield_value!==null&&r.yield_value!==undefined)decimal(r.yield_value,'Le rendement');}

 const catalog=await this.catalog(),ingredientMap=new Map(catalog.ingredients.map(i=>[i.id,i]));

 for(const i of graph.ingredients){const ingredient=ingredientMap.get(i.ingredient_id);if(!ingredient)throw new Error('Sélectionnez un ingrédient actif existant.');const oldLine=existing?.ingredients.find(line=>line.id===i.id);i.display_name=oldLine?.ingredient_id===i.ingredient_id?oldLine.display_name:!oldLine?(i.display_name||ingredient.normalized_name):ingredient.normalized_name;if(i.is_qs){i.quantity=null;i.unit='QS';}else{decimal(i.quantity,'La quantité');if(!units.includes(i.unit))throw new Error('Unité invalide.');const mass=['kg','g'],volume=['L','ml'],pieces=['unités','pièces'];const compatible=(mass.includes(i.unit)&&mass.includes(ingredient.default_unit))||(volume.includes(i.unit)&&volume.includes(ingredient.default_unit))||(pieces.includes(i.unit)&&pieces.includes(ingredient.default_unit))||i.unit===ingredient.default_unit||existing?.ingredients.some(line=>line.ingredient_id===i.ingredient_id&&line.unit===i.unit)||await this.rows('SELECT 1 FROM catering.recipe_ingredients WHERE ingredient_id=$1 AND unit=$2 LIMIT 1',[i.ingredient_id,i.unit]).then(rows=>rows.length>0);if(!compatible)throw new Error('Unité incompatible avec '+ingredient.normalized_name+'.');}}

 if(existing){for(const table of ['components','shared']){const owned=new Set(existing[table].map(r=>r.id));for(const row of graph[table]??[])if(!owned.has(row.id)&&!String(row.id).startsWith('new-'))throw new Error('Référence de '+table+' étrangère au service.');}}

 for(const r of graph.recipes){if(r.production_references===undefined){const stored=existing?.recipes.find(old=>old.id===r.id)||(String(r.id).startsWith('new-')?null:await this.getRecipe(r.id));r.production_references=stored?.production_references||[];}productionReferences(r,{...graph,units:catalog.units});}

 const retainedRecipes=new Set();

 if(reuseRecipes)for(const r of graph.recipes){const transfer=String(r.id).startsWith('new-transfer-')&&r.scale_mode==='by_headcount'&&!graph.ingredients.some(i=>i.recipe_id===r.id)&&graph.components.some(c=>c.recipe_id===r.id)&&graph.components.filter(c=>c.recipe_id===r.id).every(c=>graph.inputs.some(i=>i.component_id===c.id));if(transfer)continue;if(String(r.id).startsWith('new-')||!await this.getRecipe(r.id))throw new Error('Créez d’abord le plat dans la bibliothèque.');retainedRecipes.add(r.id);}

 for(const r of graph.recipes){if(String(r.id).startsWith('new-'))continue;const stored=await this.getRecipe(r.id);if(!stored)throw new Error('Recette introuvable.');const external=!existing||!existing.recipes.some(o=>o.id===r.id)||(await this.rows('SELECT id FROM catering.components WHERE recipe_id=$1 AND service_id<>$2 UNION SELECT id FROM catering.shared_preparations WHERE recipe_id=$1 AND service_id<>$2',[r.id,originalId||''])).length>0;

 if(external&&!duplicate){const fields=['name','scale_mode','reference_portions','reference_headcount','reference_production_units','yield_value','yield_unit','steps','notes','production_references'],pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]==null?null:k.startsWith('reference_')?String(o[k]):o[k]]));const lineFields=['ingredient_id','display_name','quantity','unit','is_qs','quantity_basis','sort_order'];const oldIngredients=await this.getIngredients(r.id),newIngredients=graph.ingredients.filter(i=>i.recipe_id===r.id);const same=JSON.stringify(pick(stored,fields))===JSON.stringify(pick(r,fields))&&JSON.stringify(oldIngredients.map(i=>pick(i,lineFields)))===JSON.stringify(newIngredients.map(i=>pick(i,lineFields)))&&JSON.stringify(await this.rows('SELECT recipe_id,rule_type,profile_id FROM catering.recipe_rule_overrides WHERE recipe_id=$1 ORDER BY rule_type',[r.id]))===JSON.stringify((graph.overrides||[]).filter(o=>o.recipe_id===r.id).sort((a,b)=>a.rule_type.localeCompare(b.rule_type)));if(same)retainedRecipes.add(r.id);}

 }

 const maps=new Map();const remap=value=>maps.get(value)||value;

 s.id=existing&&!duplicate?existing.service.id:id();s.headcount=s.reference_headcount;s.week_id=null;s.service_date=null;s.meal_type=null;s.active=s.active!==false;s.version=existing&&!duplicate?existing.service.version+1:1;

 for(const table of ['components','shared','recipes'])for(const row of graph[table]??[]){if(table==='recipes'&&retainedRecipes.has(row.id))continue;if(duplicate||!existing||String(row.id).startsWith('new-')||(table==='recipes'&&!existing.recipes.some(r=>r.id===row.id)))maps.set(row.id,id());}

 // Une recette réellement partagée est détachée lors de l'édition, jamais modifiée chez un autre service.

 if(existing&&!duplicate&&!reuseRecipes)for(const r of graph.recipes){if(retainedRecipes.has(r.id))continue;const others=await this.rows('SELECT id FROM catering.components WHERE recipe_id=$1 AND service_id<>$2 UNION SELECT id FROM catering.shared_preparations WHERE recipe_id=$1 AND service_id<>$2',[r.id,originalId]);if(others.length)maps.set(r.id,id());}

 for(const table of ['components','shared','recipes'])for(const row of graph[table]??[])row.id=remap(row.id);

 for(const table of ['ingredients','categories','overrides','allocations','inputs','menuContributions'])for(const row of graph[table]??[])for(const key of ['recipe_id','component_id','linked_component_id','shared_preparation_id','source_component_id','target_component_id'])if(row[key])row[key]=remap(row[key]);

 for(const c of graph.components){c.recipe_id=remap(c.recipe_id);c.linked_component_id=remap(c.linked_component_id);c.service_id=s.id;}

 for(const p of graph.shared??[]){p.recipe_id=remap(p.recipe_id);p.service_id=s.id;}

 for(const a of graph.allocations??[]){const old=a.id;a.id=duplicate||String(a.id).startsWith('new-')?id():a.id;maps.set(old,a.id);a.service_id=s.id;}

 for(const i of graph.inputs??[])i.allocation_id=remap(i.allocation_id);

 await this.client.query('BEGIN');try{

 if(existing&&!duplicate){const current=(await this.rows('SELECT version FROM catering.services WHERE id=$1 FOR UPDATE',[s.id]))[0];if(current.version!==Number(input.expectedVersion))throw new Error('Ce service type a changé. Rouvrez l’éditeur.');await this.insert('service_template_revisions',{service_id:s.id,version:existing.service.version,snapshot:JSON.stringify(existing)},['service_id','version','snapshot']);await this.client.query('UPDATE catering.services SET name=$2,headcount=$3,reference_headcount=$3,portion_mode=$4,split_primary_ratio=$5,split_secondary_ratio=$6,tie_break_target=$7,primary_group=$8,secondary_group=$9,all_group=$10,active=$11,version=$12 WHERE id=$1',[s.id,s.name,s.reference_headcount,s.portion_mode,s.split_primary_ratio,s.split_secondary_ratio,s.portion_mode==='split'?'fish':null,s.portion_mode==='split'?'meat':null,s.portion_mode==='split'?'fish':null,s.portion_mode==='all'?'vegetarian':null,s.active,s.version]);

 await this.client.query('DELETE FROM catering.component_menu_contributions WHERE source_component_id IN(SELECT id FROM catering.components WHERE service_id=$1) OR target_component_id IN(SELECT id FROM catering.components WHERE service_id=$1)',[s.id]);await this.client.query('DELETE FROM catering.component_preparation_inputs WHERE component_id IN(SELECT id FROM catering.components WHERE service_id=$1)',[s.id]);await this.client.query('DELETE FROM catering.shared_preparation_allocations WHERE service_id=$1',[s.id]);await this.client.query('DELETE FROM catering.shared_preparations WHERE service_id=$1',[s.id]);await this.client.query('DELETE FROM catering.component_categories WHERE component_id IN(SELECT id FROM catering.components WHERE service_id=$1)',[s.id]);await this.client.query('UPDATE catering.components SET linked_component_id=NULL WHERE service_id=$1',[s.id]);await this.client.query('DELETE FROM catering.components WHERE service_id=$1',[s.id]);await this.client.query('DELETE FROM catering.service_rule_bindings WHERE service_id=$1',[s.id]);

 }else{const split=s.portion_mode==='split';await this.insert('services',{...s,rounding_profile_id:s.rounding_profile_id||catalogDefault(existing),split_primary_ratio:s.split_primary_ratio,split_secondary_ratio:s.split_secondary_ratio,tie_break_target:split?'fish':null,primary_group:split?'meat':null,secondary_group:split?'fish':null,all_group:split?null:'vegetarian'},['id','name','headcount','reference_headcount','portion_mode','rounding_profile_id','split_primary_ratio','split_secondary_ratio','tie_break_target','primary_group','secondary_group','all_group','active','version']);}

 await this.client.query('UPDATE catering.services SET service_instructions=$2 WHERE id=$1',[s.id,s.service_instructions]);
 for(const r of graph.recipes){if(retainedRecipes.has(r.id))continue;const exists=(await this.rows('SELECT id FROM catering.recipes WHERE id=$1',[r.id])).length;if(exists){await this.client.query('DELETE FROM catering.recipe_rule_overrides WHERE recipe_id=$1',[r.id]);await this.client.query('DELETE FROM catering.recipe_ingredients WHERE recipe_id=$1',[r.id]);await this.client.query('UPDATE catering.recipes SET name=$2,scale_mode=$3,reference_portions=$4,reference_headcount=$5,reference_production_units=$6,yield_value=$7,yield_unit=$8,notes=$9::jsonb,steps=$10::jsonb,production_references=$11::jsonb WHERE id=$1',[r.id,r.name,r.scale_mode,r.reference_portions,r.reference_headcount,r.reference_production_units,r.yield_value??null,r.yield_unit??null,JSON.stringify(r.notes),JSON.stringify(r.steps),JSON.stringify(r.production_references)]);}else await this.insert('recipes',r,['id','name','scale_mode','reference_portions','reference_headcount','reference_production_units','yield_value','yield_unit','rounding_profile_id','notes','steps','production_references']);}

 for(const [index,c]of graph.components.entries())await this.insert('components',{...c,linked_component_id:null,sort_order:index,active:c.active!==false,classification_tags:c.classification_tags||[],menu_visible:c.menu_visible!==false},['id','service_id','domain_key','name','recipe_id','portion_group','production_unit_id','rule_profile_id','generic_rule_key','profile_key','service_sauce_key','classification_tags','sort_order','active','menu_visible',...(reuseRecipes?['dish_id']:[])]);

 for(const c of graph.components)if(c.linked_component_id)await this.client.query('UPDATE catering.components SET linked_component_id=$2 WHERE id=$1',[c.id,c.linked_component_id]);

 for(const r of graph.categories)await this.insert('component_categories',r,['component_id','category','subcategory','sort_order']);

 for(const r of graph.ingredients.filter(r=>!retainedRecipes.has(r.recipe_id)))await this.insert('recipe_ingredients',{...r,id:id()},['id','recipe_id','ingredient_id','display_name','quantity','unit','is_qs','quantity_basis','sort_order']);

 for(const r of graph.bindings??[])await this.insert('service_rule_bindings',{...r,service_id:s.id},['service_id','rule_key','role','rule_type','profile_id']);

 for(const r of (graph.overrides??[]).filter(r=>!retainedRecipes.has(r.recipe_id)))await this.insert('recipe_rule_overrides',r,['recipe_id','rule_type','profile_id']);

 for(const r of graph.shared??[])await this.insert('shared_preparations',r,['id','service_id','domain_key','recipe_id','reference_headcount','sort_order']);

 for(const r of graph.allocations??[])await this.insert('shared_preparation_allocations',r,['id','service_id','shared_preparation_id','component_id','ratio_numerator','ratio_denominator','allocation_mode','reference_component_portions','reference_quantity','unit','sort_order']);

 for(const r of graph.inputs??[])await this.insert('component_preparation_inputs',r,['component_id','allocation_id','display_name','sort_order']);

 for(const r of graph.menuContributions??[])await this.insert('component_menu_contributions',r,['source_component_id','target_component_id']);

 await this.client.query('SET CONSTRAINTS ALL IMMEDIATE');

 await calculateService({loadService:key=>this.loadService(key,{withinTransaction:true})},s.id,s.reference_headcount);

 await this.client.query('COMMIT');return {id:s.id,version:s.version};

 }catch(error){await this.client.query('ROLLBACK');throw error;}

 }

 async setActive(serviceId,active,version){const detail=await this.detail(serviceId);detail.snapshot.service.active=active;return this.save({snapshot:detail.snapshot,expectedVersion:version});}

 async updateIngredientAllergens(data){const ids=[...new Set(data.allergenIds||[])],status=data.allergenStatus;if(!Array.isArray(data.allergenIds)||!['known','none','review_required'].includes(status))throw new Error('Allergènes invalides.');const choices=await this.rows('SELECT id FROM catering.allergens');if(ids.some(x=>!choices.some(a=>a.id===x))||(status==='known'&&!ids.length)||(status==='none'&&ids.length))throw new Error('Choisissez les allergènes présents ou confirmez leur absence.');await this.client.query('BEGIN');try{const found=await this.rows('UPDATE catering.ingredients SET allergen_status=$2 WHERE id=$1 RETURNING id',[data.id,status]);if(!found.length)throw new Error('Ingrédient introuvable.');await this.client.query('DELETE FROM catering.ingredient_allergens WHERE ingredient_id=$1',[data.id]);for(const aid of ids)await this.client.query('INSERT INTO catering.ingredient_allergens(ingredient_id,allergen_id) VALUES($1,$2)',[data.id,aid]);await this.client.query('COMMIT');return {id:data.id};}catch(e){await this.client.query('ROLLBACK');throw e;}}
 async createIngredient(data){const name=text(data.name,'Le nom'),unit=data.unit;if(!units.includes(unit))throw new Error('Unité invalide.');if(await this.findIngredient(name))throw new Error('Cet ingrédient existe déjà : sélectionnez-le.');if(!['Meat','Fish','Frozen','FreshProduce','Dairy','Grocery'].includes(data.category))throw new Error('Catégorie d’achat invalide.');const status=data.allergenStatus||'review_required',ids=data.allergenIds||[];if(!['known','none','review_required'].includes(status)||!Array.isArray(ids)||ids.some(x=>typeof x!=='string'))throw new Error('Allergènes invalides.');const choices=await this.rows('SELECT id FROM catering.allergens');if(ids.some(x=>!choices.some(a=>a.id===x))||(status==='known'&&!ids.length)||(status==='none'&&ids.length))throw new Error('Choisissez les allergènes présents ou un statut sans sélection.');const ingredientId=id(),purchaseUnit={g:'kg',ml:'L','unités':'pièces'}[unit]||unit;await this.client.query('BEGIN');try{await this.insert('ingredients',{id:ingredientId,normalized_name:name,default_unit:unit,purchase_unit:purchaseUnit,purchase_category:data.category,allergen_status:status},['id','normalized_name','default_unit','purchase_unit','purchase_category','allergen_status']);for(const allergenId of new Set(ids))await this.client.query('INSERT INTO catering.ingredient_allergens(ingredient_id,allergen_id) VALUES($1,$2)',[ingredientId,allergenId]);await this.client.query('COMMIT');return {id:ingredientId};}catch(error){await this.client.query('ROLLBACK');throw error;}}
}

function catalogDefault(existing){return existing?.service.rounding_profile_id||'v0-display';}

module.exports={LibraryEditorRepository,configurePortionMode};

