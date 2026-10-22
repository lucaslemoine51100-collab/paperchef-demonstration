const {randomUUID}=require('node:crypto');
const linked=require('./linked-recipes');

const {LibraryEditorRepository,configurePortionMode}=require('./library-editor');

const {productionReferences}=require('../technical-sheets/production-references');

const {calculateService}=require('./service-calculation');

const {technicalSheetViewModel}=require('../technical-sheets/view-model');

const categoryLabels={Protein:'Protéine',Starch:'Féculent',Vegetable:'Légume',Sauce:'Sauce',Meat:'Viande',Fish:'Poisson',Vegetarian:'Végétarien'};

const required=(s,label)=>{if(typeof s!=='string'||!s.trim())throw new Error(label+' est obligatoire.');return s.trim();};

const positive=v=>{if(!Number.isSafeInteger(Number(v))||Number(v)<1)throw new Error('Entrez un nombre entier supérieur à 0.');return String(v);};

const decimal=v=>{if(typeof v!=='string'||!/^\d+(\.\d+)?$/.test(v))throw new Error('Entrez une quantité exacte positive ou nulle.');return v;};

class DishRepository extends LibraryEditorRepository {

 async registerMissing(){

  // Compatibilité avec les créations par l'ancien importeur de graphes.

  await this.client.query(`INSERT INTO catering.dishes(id,recipe_id,name,configuration)

   SELECT 'dish:'||c.recipe_id,c.recipe_id,c.name,jsonb_build_object('portion_group',c.portion_group,'production_unit_id',c.production_unit_id,'rule_profile_id',c.rule_profile_id,'generic_rule_key',c.generic_rule_key,'profile_key',c.profile_key,'service_sauce_key',c.service_sauce_key,'classification_tags',c.classification_tags)

   FROM(SELECT DISTINCT ON(base.recipe_id) base.* FROM catering.components base
   WHERE base.recipe_id IS NOT NULL AND (base.dish_id IS NULL OR NOT EXISTS(SELECT 1 FROM catering.dishes canonical WHERE canonical.id=base.dish_id))
   ORDER BY base.recipe_id,base.service_id,base.sort_order)c

   WHERE NOT EXISTS(SELECT 1 FROM catering.dishes d WHERE d.recipe_id=c.recipe_id) ON CONFLICT DO NOTHING`);

  await this.client.query(`INSERT INTO catering.dish_categories SELECT d.id,cc.category,cc.subcategory,cc.sort_order FROM catering.dishes d JOIN LATERAL(SELECT id FROM catering.components WHERE recipe_id=d.recipe_id ORDER BY service_id,sort_order LIMIT 1)c ON true JOIN catering.component_categories cc ON cc.component_id=c.id WHERE NOT EXISTS(SELECT 1 FROM catering.dish_categories dc WHERE dc.dish_id=d.id) ON CONFLICT DO NOTHING`);

  // Imported occurrences reference the same canonical dish as the catalogue.
  await this.client.query(`UPDATE catering.components c SET dish_id=d.id FROM catering.dishes d WHERE c.dish_id IS NULL AND c.recipe_id=d.recipe_id`);
  await linked.registerSources(this);
 }

 async list(){await this.registerMissing();
  // Reuse only within this read; the next request reloads current saved data.
  const reader=Object.create(this),memo=new Map(),rows=this.rows.bind(this);
  const recipes=new Map((await rows('SELECT r.*,r.reference_portions::text AS reference_portions,r.reference_headcount::text AS reference_headcount,r.reference_production_units::text AS reference_production_units,r.yield_value::text AS yield_value FROM catering.recipes r')).map(r=>[r.id,r]));
  const ingredientRows=await rows(`SELECT ri.*,ri.quantity::text AS quantity,i.normalized_name,i.purchase_category,i.default_unit,(to_jsonb(i)->>'purchase_required')::boolean AS purchase_required,i.allergen_status,i.rounding_profile_id AS ingredient_rounding_profile_id,coalesce((SELECT jsonb_agg(a.code ORDER BY a.sort_order) FROM catering.ingredient_allergens ia JOIN catering.allergens a ON a.id=ia.allergen_id WHERE ia.ingredient_id=i.id),'[]'::jsonb) AS allergen_codes FROM catering.recipe_ingredients ri JOIN catering.ingredients i ON i.id=ri.ingredient_id ORDER BY ri.sort_order`);
  const ingredients=new Map();for(const line of ingredientRows){if(!ingredients.has(line.recipe_id))ingredients.set(line.recipe_id,[]);ingredients.get(line.recipe_id).push(line);}
  reader.getRecipe=async id=>structuredClone(recipes.get(id)||null);
  reader.getIngredients=async id=>structuredClone(ingredients.get(id)||[]);
  const dishRows=await rows('SELECT * FROM catering.dishes'),categoryRows=await rows('SELECT dish_id,category,subcategory,sort_order FROM catering.dish_categories ORDER BY sort_order'),bindingRows=await rows('SELECT dish_id,rule_key,role,rule_type,profile_id FROM catering.dish_rule_bindings ORDER BY role,rule_key,rule_type');
  reader.rows=async(sql,params=[])=>{if(sql==='SELECT * FROM catering.dishes WHERE id=$1')return structuredClone(dishRows.filter(d=>d.id===params[0]));if(sql==='SELECT category,subcategory,sort_order FROM catering.dish_categories WHERE dish_id=$1 ORDER BY sort_order')return structuredClone(categoryRows.filter(d=>d.dish_id===params[0]).map(({dish_id,...d})=>d));if(sql==='SELECT rule_key,role,rule_type,profile_id FROM catering.dish_rule_bindings WHERE dish_id=$1 ORDER BY role,rule_key,rule_type')return structuredClone(bindingRows.filter(d=>d.dish_id===params[0]).map(({dish_id,...d})=>d));const key=JSON.stringify([sql,params]);if(!memo.has(key))memo.set(key,rows(sql,params));return structuredClone(await memo.get(key));};
  return reader.listProjection();
 }
 async listProjection(){const result=[],views=new Map();
 const allCategories=await this.rows('SELECT dish_id,category,subcategory,sort_order FROM catering.dish_categories ORDER BY sort_order');
 const allAllergens=await this.rows('SELECT ra.recipe_id,a.name,a.sort_order FROM catering.recipe_allergens ra JOIN catering.allergens a ON a.id=ra.allergen_id ORDER BY a.sort_order');
 const origins=await this.rows('SELECT DISTINCT ON(recipe_id) recipe_id,service_id,domain_key FROM catering.components ORDER BY recipe_id,service_id,sort_order');
 const usages=await this.rows('SELECT dish_id,recipe_id,service_id,false AS shared FROM catering.components UNION SELECT NULL AS dish_id,recipe_id,service_id,true AS shared FROM catering.shared_preparations');
 for(const row of await this.rows('SELECT * FROM catering.dishes ORDER BY name')){

  const storedRecipe=await this.getRecipe(row.recipe_id);if(await linked.isHiddenSource(this,row,storedRecipe))continue;const data=await this.dishDetail(row.id,{sections:false}),recipe=data.recipe,ingredients=data.ingredients,categories=allCategories.filter(c=>c.dish_id===row.id).map(({dish_id,...c})=>c);

  let calculatedIngredients=false;let allergens=[...new Set(allAllergens.filter(a=>a.recipe_id===recipe.id).map(a=>a.name))];

  const origin=origins.find(o=>o.recipe_id===row.recipe_id);

  if(origin){if(!views.has(origin.service_id)){const calculated=await calculateService(this,origin.service_id,Number((await this.getService(origin.service_id)).reference_headcount));views.set(origin.service_id,technicalSheetViewModel(calculated.result,calculated.snapshot,calculated.metadata));}const block=views.get(origin.service_id).components.find(c=>c.id===origin.domain_key);if(block){allergens=block.allergens;calculatedIngredients=block.ingredients.length>0;}}

  result.push({...row,linkedPreparation:data.dish.linkedPreparation||null,quantityFromRule:!ingredients.length&&calculatedIngredients,categories,categoryLabels:categories.map(k=>[categoryLabels[k.category],categoryLabels[k.subcategory]].filter(Boolean).join(' · ')),allergens,completeness:{ingredients:ingredients.length>0||calculatedIngredients,steps:recipe.steps.length>0,references:(recipe.production_references||[]).length>0,allergens:ingredients.every(i=>['reviewed','known','none'].includes(i.allergen_status))},uses:new Set(usages.filter(u=>u.shared?u.recipe_id===row.recipe_id:u.dish_id===row.id||!u.dish_id&&u.recipe_id===row.recipe_id).map(u=>u.service_id)).size});

 }return result;}

 async setDishActive(id,active,expectedVersion){if(typeof active!=='boolean')throw new Error('Statut invalide.');await this.client.query('BEGIN');try{const locked=(await this.rows('SELECT version FROM catering.dishes WHERE id=$1 FOR UPDATE',[id]))[0];if(!locked)throw new Error('Plat introuvable.');if(locked.version!==Number(expectedVersion))throw new Error('Ce plat a changé. Actualisez la bibliothèque.');const previous=await this.dishDetail(id,{sections:false});await this.client.query('INSERT INTO catering.dish_revisions(dish_id,version,snapshot) VALUES($1,$2,$3::jsonb)',[id,locked.version,JSON.stringify(previous)]);await this.client.query('UPDATE catering.dishes SET active=$2,version=version+1 WHERE id=$1',[id,active]);await this.client.query('COMMIT');return {id,active,version:locked.version+1};}catch(error){await this.client.query('ROLLBACK');throw error;}}

 async usages(id){const dish=(await this.rows('SELECT recipe_id FROM catering.dishes WHERE id=$1',[id]))[0];if(!dish)throw new Error('Plat introuvable.');const usages=await this.rows('SELECT DISTINCT s.id,s.name,s.active FROM catering.services s JOIN catering.components c ON c.service_id=s.id WHERE c.dish_id=$1 OR (c.dish_id IS NULL AND c.recipe_id=$2) UNION SELECT DISTINCT s.id,s.name,s.active FROM catering.services s JOIN catering.shared_preparations p ON p.service_id=s.id WHERE p.recipe_id=$2 ORDER BY name',[id,dish.recipe_id]);for(const service of usages)service.name=require('../pwa/public/service-title').display(await this.loadService(service.id));return usages.sort((a,b)=>a.name.localeCompare(b.name,'fr'));}

 async dishDetail(id,{sections=true,serviceId,sourceRecipeId}={}){const dish=(await this.rows('SELECT * FROM catering.dishes WHERE id=$1',[id]))[0];if(!dish)throw new Error('Plat introuvable.');const source=await linked.resolveSource(this,dish,{serviceId,sourceRecipeId}),data=await this.recipe(source?.recipeId||dish.recipe_id);if(source){dish.linkedPreparation=source;dish.recipe_id=data.recipe.id;data.recipe.scale_mode='by_headcount';}else if(sections)dish.linkedSections=await linked.sectionsFor(this,dish);return {dish,...data,categories:await this.rows('SELECT category,subcategory,sort_order FROM catering.dish_categories WHERE dish_id=$1 ORDER BY sort_order',[id]),bindings:await this.rows('SELECT rule_key,role,rule_type,profile_id FROM catering.dish_rule_bindings WHERE dish_id=$1 ORDER BY role,rule_key,rule_type',[id])};}

 async bundle(id,{editing=false,serviceId}={}){const data=await this.dishDetail(id,{serviceId});if(editing&&data.dish.linkedPreparation)return {...data,snapshot:await this.standalone(data)};const origin=(await this.rows('SELECT id,service_id FROM catering.components WHERE recipe_id=$1 ORDER BY service_id,sort_order LIMIT 1',[data.dish.linkedPreparation?.originalRecipeId||data.recipe.id]))[0];

  if(!origin)return data.dish.linkedPreparation?linked.sourceBundle(this,data):{ ...data, snapshot:await this.standalone(data)};

  const graph=await this.loadService(origin.service_id),ids=new Set([origin.id]);let changed=true;

  // Fermeture des dépendances déclarées, sans règle propre à une recette.

  while(changed){const n=ids.size;for(const c of graph.components)if(c.linked_component_id&&(ids.has(c.id)||ids.has(c.linked_component_id))){ids.add(c.id);ids.add(c.linked_component_id);}for(const m of graph.menuContributions)if(ids.has(m.source_component_id)||ids.has(m.target_component_id)){ids.add(m.source_component_id);ids.add(m.target_component_id);}for(const a of graph.allocations)if(ids.has(a.component_id))for(const other of graph.allocations.filter(b=>b.shared_preparation_id===a.shared_preparation_id))ids.add(other.component_id);changed=n!==ids.size;}

  graph.components=graph.components.filter(c=>ids.has(c.id));const sharedIds=new Set(graph.allocations.filter(a=>ids.has(a.component_id)).map(a=>a.shared_preparation_id));graph.shared=graph.shared.filter(p=>sharedIds.has(p.id));graph.allocations=graph.allocations.filter(a=>sharedIds.has(a.shared_preparation_id));graph.inputs=graph.inputs.filter(i=>ids.has(i.component_id));graph.menuContributions=graph.menuContributions.filter(m=>ids.has(m.source_component_id)&&ids.has(m.target_component_id));graph.categories=graph.categories.filter(k=>ids.has(k.component_id));const recipes=new Set([...graph.components,...graph.shared].map(c=>c.recipe_id));graph.recipes=graph.recipes.filter(r=>recipes.has(r.id));graph.ingredients=graph.ingredients.filter(i=>recipes.has(i.recipe_id));graph.overrides=graph.overrides.filter(o=>recipes.has(o.recipe_id));

  for(const c of graph.components)if(!c.dish_id)c.dish_id=(await this.rows('SELECT id FROM catering.dishes WHERE recipe_id=$1',[c.recipe_id]))[0]?.id;

  return {...data,snapshot:graph};

 }

 async standalone(data){const catalog=await this.catalog(),c={id:'new-component',domain_key:'dish-preview',dish_id:data.dish.id,name:data.dish.name,recipe_id:data.recipe.id,...data.dish.configuration,sort_order:0,active:true,menu_visible:true,classification_tags:data.dish.configuration.classification_tags||[]};if(data.dish.linkedPreparation)c.portion_group='all';

  return {service:configurePortionMode({id:'new-service',name:data.dish.name,reference_headcount:'100',headcount:'100',portion_mode:c.portion_group==='vegetarian'?'all':'split',rounding_profile_id:'v0-display',active:true}),components:[c],categories:data.categories.map(k=>({...k,component_id:c.id})),recipes:[data.recipe],ingredients:data.ingredients,overrides:data.overrides||[],shared:[],allocations:[],inputs:[],bindings:data.bindings||[],menuContributions:[],rules:catalog.rules,units:catalog.units,ruleIngredients:[],rounding:await this.rows('SELECT *,kg_step::text,l_step::text,g_step::text,ml_step::text FROM catering.rounding_profiles')};

 }

 async assembly(input,{duplicate=false,preserveContext=false}={}){

  const graph=structuredClone(input.snapshot);if(!graph?.service)throw new Error('Service requis.');await this.registerMissing();

  graph.categories=[];const canonical=new Map();for(const c of graph.components){let dishId=c.dish_id;if(!dishId)dishId=(await this.rows('SELECT id FROM catering.dishes WHERE recipe_id=$1',[c.recipe_id]))[0]?.id;const data=await this.dishDetail(dishId);if(!data.dish.active&&(!graph.service.id||duplicate||!(await this.rows('SELECT id FROM catering.components WHERE service_id=$1 AND recipe_id=$2',[graph.service.id,data.recipe.id])).length))throw new Error('Choisissez un plat actif.');if(input.dishVersions?.[dishId]!=null&&Number(input.dishVersions[dishId])!==data.dish.version)throw new Error('Un plat a changé. Rouvrez le service pour utiliser sa version actuelle.');const calculationRecipeId=data.dish.linkedPreparation?c.recipe_id:data.recipe.id;if(data.dish.linkedPreparation){if(!graph.shared.some(p=>(data.dish.linkedPreparation.recipeIds||[data.recipe.id]).includes(p.recipe_id))||!graph.inputs.some(i=>i.component_id===c.id))throw new Error('La recette liée doit être ajoutée avec sa répartition.');const transfer=String(calculationRecipeId).startsWith('new-')?{recipe:graph.recipes.find(r=>r.id===calculationRecipeId),ingredients:[],overrides:[]}:await this.recipe(calculationRecipeId);canonical.set(calculationRecipeId,transfer);}else canonical.set(data.recipe.id,data);graph.bindings??=[];for(const b of data.bindings||[])if(!graph.bindings.some(k=>k.role===b.role&&k.rule_key===b.rule_key&&k.rule_type===b.rule_type))graph.bindings.push(b);const audience=c.portion_group;Object.assign(c,data.dish.configuration,{dish_id:dishId,name:data.dish.name,recipe_id:calculationRecipeId});if(preserveContext||data.categories.some(k=>k.category==='Sauce')&&!data.categories.some(k=>k.category==='Protein')&&['all','meat','fish','vegetarian'].includes(audience))c.portion_group=audience;graph.categories=graph.categories.filter(k=>k.component_id!==c.id);graph.categories.push(...data.categories.map(k=>({...k,component_id:c.id})));}

  const recipeIds=new Set([...graph.components,...graph.shared].map(c=>c.recipe_id));graph.recipes=[];graph.ingredients=[];graph.overrides=[];for(const rid of recipeIds){const data=canonical.get(rid)||await this.recipe(rid);graph.recipes.push(data.recipe);graph.ingredients.push(...data.ingredients);graph.overrides.push(...data.overrides);}
  for(const c of graph.components){const occupied=new Set(graph.ingredients.filter(i=>i.recipe_id===c.recipe_id).map(i=>Number(i.sort_order)));for(const input of graph.inputs.filter(i=>i.component_id===c.id).sort((a,b)=>a.sort_order-b.sort_order)){let order=Number(input.sort_order);while(occupied.has(order))order++;input.sort_order=order;occupied.add(order);}}


  graph.service.name=require('../pwa/public/service-title').build(graph);configurePortionMode(graph.service);return this.save({...input,snapshot:graph,confirmedRemoved:input.confirmedRemoved||[]},{duplicate,reuseRecipes:true});

 }

 async saveDish(input){const dish=structuredClone(input.dish),r=structuredClone(input.recipe),lines=structuredClone(input.ingredients||[]),categories=structuredClone(input.categories||[]),old=dish.id?await this.dishDetail(dish.id,{sourceRecipeId:r.id}):null;

  dish.name=required(dish.name,'Le nom du plat');r.name=dish.name;r.steps=r.preparation_steps??r.steps??[];if(!Array.isArray(r.steps)||r.steps.some(s=>typeof s!=='string'||!s.trim()))throw new Error('Renseignez ou retirez les étapes vides.');r.steps=r.steps.map(s=>s.trim());r.notes??=[];r.production_references??=[];

  const ref={by_portions:'reference_portions',by_headcount:'reference_headcount',by_production_unit:'reference_production_units'}[r.scale_mode];if(!ref)throw new Error('Choisissez une base de recette valide.');r[ref]=positive(r[ref]);for(const k of ['reference_portions','reference_headcount','reference_production_units'])if(k!==ref)r[k]=null;if(r.yield_value!=null)decimal(r.yield_value);else r.yield_unit=null;

  if(!categories.length)throw new Error('Choisissez une catégorie pour le plat.');const seen=new Set();for(const k of categories){if(!['Protein','Starch','Vegetable','Sauce'].includes(k.category)||(k.category==='Protein'?!['Meat','Fish','Vegetarian'].includes(k.subcategory):k.subcategory!=null))throw new Error('Catégorie du plat invalide.');const key=k.category+':'+(k.subcategory||'');if(seen.has(key))throw new Error('Catégorie répétée.');seen.add(key);}

  const catalog=await this.catalog(),overrides=structuredClone(input.overrides??old?.overrides??[]),overrideTypes=new Set();for(const o of overrides){const profile=catalog.rules.find(p=>p.id===o.profile_id);if(!profile||profile.priority!==1||profile.rule_type!==o.rule_type||overrideTypes.has(o.rule_type))throw new Error('Choisissez une règle spécifique valide et non répétée.');overrideTypes.add(o.rule_type);}const configuration=dish.configuration||{},allowed=['portion_group','production_unit_id','rule_profile_id','generic_rule_key','profile_key','service_sauce_key','classification_tags'];if(Object.keys(configuration).some(k=>!allowed.includes(k))||!['all','meat','fish','vegetarian'].includes(configuration.portion_group))throw new Error('Base du plat invalide.');if(configuration.production_unit_id&&!catalog.units.some(u=>u.id===configuration.production_unit_id))throw new Error('Format de production introuvable.');if(configuration.rule_profile_id&&!catalog.rules.some(u=>u.id===configuration.rule_profile_id))throw new Error('Règle introuvable.');configuration.classification_tags??=[];

  for(const [i,line]of lines.entries()){const ingredient=catalog.ingredients.find(c=>c.id===line.ingredient_id);if(!ingredient)throw new Error('Sélectionnez un ingrédient existant.');line.display_name=old?.ingredients.find(v=>v.id===line.id&&v.ingredient_id===line.ingredient_id)?.display_name||ingredient.normalized_name;line.sort_order=i;line.quantity_basis??='reference_recipe';if(line.is_qs){line.quantity=null;line.unit='QS';}else{decimal(line.quantity);const dimension=u=>['kg','g'].includes(u)?'mass':['L','ml'].includes(u)?'volume':['unités','pièces'].includes(u)?'pieces':u;if(dimension(line.unit)!==dimension(ingredient.default_unit)&&!ingredient.culinary_units.includes(line.unit))throw new Error('Unité incompatible avec '+ingredient.normalized_name+'.');}}

  if(old?.dish.linkedPreparation){if(r.reference_headcount!==old.recipe.reference_headcount||r.yield_value!==old.recipe.yield_value||r.yield_unit!==old.recipe.yield_unit)throw new Error('La référence et le volume réparti sont conservés pour cette recette liée.');r.scale_mode='shared_preparation';for(const key of Object.keys(configuration))delete configuration[key];Object.assign(configuration,old.dish.configuration);}
  dish.id=old?.dish.id||randomUUID();r.id=old?.recipe.id||randomUUID();for(const line of lines)line.recipe_id=r.id;for(const o of overrides)o.recipe_id=r.id;productionReferences(r,{ingredients:lines,units:catalog.units});

  await this.client.query('BEGIN');try{

   const serviceVersions=[];let sourceBindings=[];if(input.variantOf){if(old)throw new Error('Une variante doit être un nouveau plat.');const source=await this.dishDetail(input.variantOf,{sections:false});const locked=(await this.rows('SELECT version FROM catering.dishes WHERE id=$1 FOR UPDATE',[input.variantOf]))[0];if(locked.version!==Number(input.sourceVersion))throw new Error('Le plat source a changé. Rouvrez sa fiche.');sourceBindings=source.bindings;} 

   if(old){const locked=(await this.rows('SELECT version FROM catering.dishes WHERE id=$1 FOR UPDATE',[dish.id]))[0];if(locked.version!==Number(input.expectedVersion))throw new Error('Ce plat a changé. Rouvrez sa fiche.');await this.client.query('INSERT INTO catering.dish_revisions(dish_id,version,snapshot) VALUES($1,$2,$3::jsonb)',[dish.id,old.dish.version,JSON.stringify(old)]);}

   const impacted=old?await this.rows('SELECT DISTINCT service_id FROM catering.components WHERE recipe_id=$1 UNION SELECT DISTINCT service_id FROM catering.shared_preparations WHERE recipe_id=$1 ORDER BY service_id',[r.id]):[];

   for(const {service_id}of impacted){await this.rows('SELECT id FROM catering.services WHERE id=$1 FOR UPDATE',[service_id]);const snapshot=await this.loadService(service_id,{withinTransaction:true});await this.client.query('INSERT INTO catering.service_template_revisions(service_id,version,snapshot) VALUES($1,$2,$3::jsonb)',[service_id,snapshot.service.version,JSON.stringify(snapshot)]);await this.client.query('UPDATE catering.services SET version=version+1 WHERE id=$1',[service_id]);serviceVersions.push({id:service_id,previousVersion:snapshot.service.version,version:snapshot.service.version+1});}

   if(old){await this.client.query('UPDATE catering.recipes SET name=$2,scale_mode=$3,reference_portions=$4,reference_headcount=$5,reference_production_units=$6,yield_value=$7,yield_unit=$8,notes=$9::jsonb,steps=$10::jsonb,production_references=$11::jsonb WHERE id=$1',[r.id,r.name,r.scale_mode,r.reference_portions,r.reference_headcount,r.reference_production_units,r.yield_value??null,r.yield_unit??null,JSON.stringify(r.notes),JSON.stringify(r.steps),JSON.stringify(r.production_references)]);await this.client.query('DELETE FROM catering.recipe_ingredients WHERE recipe_id=$1',[r.id]);await this.client.query('DELETE FROM catering.dish_categories WHERE dish_id=$1',[dish.id]);await this.client.query('UPDATE catering.dishes SET name=$2,active=$3,version=version+1,configuration=$4::jsonb WHERE id=$1',[dish.id,dish.name,dish.active!==false,JSON.stringify(configuration)]);

   }else{await this.insert('recipes',{...r,rounding_profile_id:'v0-display'},['id','name','scale_mode','reference_portions','reference_headcount','reference_production_units','yield_value','yield_unit','notes','steps','production_references','rounding_profile_id']);await this.client.query('INSERT INTO catering.dishes(id,recipe_id,name,active,configuration) VALUES($1,$2,$3,$4,$5::jsonb)',[dish.id,r.id,dish.name,dish.active!==false,JSON.stringify(configuration)]);}

   for(const b of sourceBindings)await this.client.query('INSERT INTO catering.dish_rule_bindings(dish_id,rule_key,role,rule_type,profile_id) VALUES($1,$2,$3,$4,$5)',[dish.id,b.rule_key,b.role,b.rule_type,b.profile_id]);
   await this.client.query('DELETE FROM catering.recipe_rule_overrides WHERE recipe_id=$1',[r.id]);for(const o of overrides)await this.insert('recipe_rule_overrides',o,['recipe_id','rule_type','profile_id']);
   for(const line of lines)await this.insert('recipe_ingredients',{...line,id:randomUUID()},['id','recipe_id','ingredient_id','display_name','quantity','unit','is_qs','quantity_basis','sort_order']);for(const [i,k]of categories.entries())await this.client.query('INSERT INTO catering.dish_categories VALUES($1,$2,$3,$4)',[dish.id,k.category,k.subcategory??null,i]);

   await this.client.query('SET CONSTRAINTS ALL IMMEDIATE');for(const {service_id}of impacted)await calculateService({loadService:key=>this.loadService(key,{withinTransaction:true})},service_id,Number((await this.getService(service_id)).reference_headcount));

   await this.client.query('COMMIT');return {id:dish.id,version:(old?.dish.version||0)+1,serviceVersions};

  }catch(e){await this.client.query('ROLLBACK');throw e;}

 }

}

module.exports={DishRepository};

