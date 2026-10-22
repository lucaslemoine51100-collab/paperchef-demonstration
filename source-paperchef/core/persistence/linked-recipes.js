// Real recipe access for preparations calculated once and distributed to several dishes.
const embedded=name=>/marinade|béchamel|sauce tomate persillée|sauce paprika intégrée/i.test(name);
const clean=name=>name.replace(/\s*[·—-]?\s*(fabrication commune|commune|commun)\b/gi,'').trim();
async function registerSources(repo){
 const sources=await repo.rows(`SELECT DISTINCT r.id,r.name FROM catering.shared_preparations p JOIN catering.recipes r ON r.id=p.recipe_id`);
 for(const source of sources){const id='dish:'+source.id,name=clean(source.name);await repo.client.query(`INSERT INTO catering.dishes(id,recipe_id,name,configuration) VALUES($1,$2,$3,'{"portion_group":"all","classification_tags":[]}'::jsonb) ON CONFLICT DO NOTHING`,[id,source.id,name]);const dish=(await repo.rows('SELECT id FROM catering.dishes WHERE recipe_id=$1',[source.id]))[0];await repo.client.query(`INSERT INTO catering.dish_categories(dish_id,category,subcategory,sort_order) SELECT $1,$2,NULL,0 WHERE NOT EXISTS(SELECT 1 FROM catering.dish_categories WHERE dish_id=$1)`,[dish.id,/purée/i.test(name)?'Starch':'Sauce']);}
}
async function resolveSource(repo,dish,{serviceId,sourceRecipeId}={}){
 const recipe=await repo.getRecipe(dish.recipe_id);
 if(recipe.scale_mode==='shared_preparation')return {recipeId:recipe.id,originalRecipeId:recipe.id,direct:true};
 // A recipe with its own ingredients cannot be a sauce reservation placeholder.
 if((await repo.getIngredients(dish.recipe_id)).length)return null;
 const links=await repo.rows(`SELECT DISTINCT p.recipe_id FROM catering.components c JOIN catering.component_preparation_inputs i ON i.component_id=c.id JOIN catering.shared_preparation_allocations a ON a.id=i.allocation_id JOIN catering.shared_preparations p ON p.id=a.shared_preparation_id WHERE c.recipe_id=$1 AND EXISTS(SELECT 1 FROM catering.component_categories cc WHERE cc.component_id=c.id AND cc.category='Sauce') AND c.rule_profile_id IS NULL AND c.generic_rule_key IS NULL AND c.profile_key IS NULL AND c.service_sauce_key IS NULL AND NOT EXISTS(SELECT 1 FROM catering.recipe_ingredients ri WHERE ri.recipe_id=c.recipe_id) ORDER BY p.recipe_id`,[dish.recipe_id]);
 if(serviceId){const contextual=await repo.rows('SELECT DISTINCT p.recipe_id FROM catering.components c JOIN catering.component_preparation_inputs i ON i.component_id=c.id JOIN catering.shared_preparation_allocations a ON a.id=i.allocation_id JOIN catering.shared_preparations p ON p.id=a.shared_preparation_id WHERE c.recipe_id=$1 AND c.service_id=$2',[dish.recipe_id,serviceId]);sourceRecipeId=contextual[0]?.recipe_id;}
 if(sourceRecipeId&&links.some(x=>x.recipe_id===sourceRecipeId))links.sort((a,b)=>Number(b.recipe_id===sourceRecipeId)-Number(a.recipe_id===sourceRecipeId));
 if(links.length)return {recipeId:links[0].recipe_id,recipeIds:links.map(x=>x.recipe_id),originalRecipeId:dish.recipe_id,direct:false};
 return null;
}
async function isHiddenSource(repo,row,recipe){
 if(recipe.scale_mode!=='shared_preparation')return false;
 if(embedded(recipe.name))return true;
 return !!(await repo.rows(`SELECT 1 FROM catering.shared_preparations p JOIN catering.shared_preparation_allocations a ON a.shared_preparation_id=p.id JOIN catering.component_preparation_inputs i ON i.allocation_id=a.id JOIN catering.components c ON c.id=i.component_id WHERE p.recipe_id=$1 AND c.dish_id<>$2 AND EXISTS(SELECT 1 FROM catering.component_categories cc WHERE cc.component_id=c.id AND cc.category='Sauce') AND NOT EXISTS(SELECT 1 FROM catering.recipe_ingredients ri WHERE ri.recipe_id=c.recipe_id) AND c.recipe_id<>$1 LIMIT 1`,[recipe.id,row.id])).length;
}
async function sourceBundle(repo,data){
 const graph=await repo.standalone(data),source=await repo.getRecipe(data.dish.linkedPreparation.recipeId),transferId='new-transfer-'+require('node:crypto').randomUUID(),component=graph.components[0];
 component.recipe_id=transferId;
 const transfer={...source,id:transferId,name:data.dish.name,scale_mode:'by_headcount',yield_value:null,yield_unit:null,steps:['Servir '+data.dish.name.toLocaleLowerCase('fr')+'.'],preparation_steps:['Servir '+data.dish.name.toLocaleLowerCase('fr')+'.'],production_references:[]};
 graph.recipes=[transfer,{...source,preparation_steps:source.steps}];
 graph.shared=[{id:'new-preparation',domain_key:'dish-preparation',recipe_id:source.id,reference_headcount:source.reference_headcount,sort_order:0}];
 graph.allocations=[{id:'new-allocation',shared_preparation_id:'new-preparation',component_id:component.id,ratio_numerator:'1',ratio_denominator:'1',allocation_mode:'component_portions',reference_component_portions:source.reference_headcount,reference_quantity:source.yield_value,unit:source.yield_unit,sort_order:0}];
 graph.inputs=[{component_id:component.id,allocation_id:'new-allocation',display_name:data.dish.name,sort_order:0}];
 return {...data,snapshot:graph};
}
module.exports={embedded,clean,registerSources,resolveSource,isHiddenSource,sourceBundle};
async function sectionsFor(repo,dish){
 const origin=(await repo.rows('SELECT id,service_id,domain_key FROM catering.components WHERE recipe_id=$1 ORDER BY service_id,sort_order LIMIT 1',[dish.recipe_id]))[0];if(!origin)return [];
 const sources=await repo.rows(`SELECT DISTINCT d.id,r.name FROM catering.component_preparation_inputs i JOIN catering.shared_preparation_allocations a ON a.id=i.allocation_id JOIN catering.shared_preparations p ON p.id=a.shared_preparation_id JOIN catering.recipes r ON r.id=p.recipe_id JOIN catering.dishes d ON d.recipe_id=r.id WHERE i.component_id=$1`,[origin.id]);
 const relevant=sources.filter(s=>embedded(s.name));if(!relevant.length)return [];
 const calc=await require('./service-calculation').calculateService(repo,origin.service_id,Number((await repo.getService(origin.service_id)).reference_headcount)),vm=require('../technical-sheets/view-model').technicalSheetViewModel(calc.result,calc.snapshot,calc.metadata),block=require('../technical-sheets/presentation-blocks').presentationBlocks(vm).find(c=>c.id===origin.domain_key);
 return (block?.recipeSections||[]).map(section=>({...section,dishId:relevant.find(s=>clean(s.name)===section.name)?.id,portions:block.calculatedPortions}));
}
module.exports.sectionsFor=sectionsFor;
