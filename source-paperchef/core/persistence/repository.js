// Dépend uniquement d'un client query(sql, params) : pg.Client ou connexion de transaction.

class PostgresRepository {

  constructor(client) { this.client=client; }

  async rows(sql,params=[]) { return (await this.client.query(sql,params)).rows; }

  async getService(id) {

    const rows=await this.rows(`SELECT s.*, s.headcount::text AS headcount, s.reference_headcount::text AS reference_headcount,

      s.split_primary_ratio::text AS split_primary_ratio, s.split_secondary_ratio::text AS split_secondary_ratio

      FROM catering.services s WHERE s.id=$1`,[id]);

    return rows[0]||null;

  }

  async getRecipe(id) {

    return (await this.rows(`SELECT r.*, r.reference_portions::text AS reference_portions,

      r.reference_headcount::text AS reference_headcount,r.reference_production_units::text AS reference_production_units,

      r.yield_value::text AS yield_value FROM catering.recipes r WHERE r.id=$1`,[id]))[0]||null;

  }

  async findIngredient(name) {

    const rows=await this.rows(`SELECT i.*,

      coalesce((SELECT jsonb_agg(a.code ORDER BY a.code) FROM catering.ingredient_allergens ia

        JOIN catering.allergens a ON a.id=ia.allergen_id WHERE ia.ingredient_id=i.id),'[]'::jsonb) AS allergen_codes

      FROM catering.ingredients i WHERE i.active AND

      (i.normalized_key=catering.ingredient_name_key($1) OR i.id IN

        (SELECT ingredient_id FROM catering.ingredient_aliases WHERE alias_key=catering.ingredient_name_key($1)))`,[name]);

    if(rows.length>1)throw new Error('Nom d’ingrédient ambigu');

    return rows[0]||null;

  }

  async getIngredients(recipeId) {

    return this.rows(`SELECT ri.*,ri.quantity::text AS quantity, i.normalized_name,i.purchase_category,i.default_unit,(to_jsonb(i)->>'purchase_required')::boolean AS purchase_required,i.allergen_status,

      i.rounding_profile_id AS ingredient_rounding_profile_id,

      coalesce((SELECT jsonb_agg(a.code ORDER BY a.sort_order) FROM catering.ingredient_allergens ia

        JOIN catering.allergens a ON a.id=ia.allergen_id WHERE ia.ingredient_id=i.id),'[]'::jsonb) AS allergen_codes

      FROM catering.recipe_ingredients ri JOIN catering.ingredients i ON i.id=ri.ingredient_id

      WHERE ri.recipe_id=$1 ORDER BY ri.sort_order`,[recipeId]);

  }

  async getSharedPreparations(serviceId) {

    return this.rows(`SELECT p.*,p.reference_headcount::text AS reference_headcount

      FROM catering.shared_preparations p WHERE p.service_id=$1 ORDER BY p.sort_order`,[serviceId]);

  }

  // Lecture atomique : le client doit être une connexion réservée, jamais pool.query partagé.

  async loadService(id,{withinTransaction=false}={}) {

    if(!withinTransaction)await this.client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    try {

      const service=await this.getService(id);

      if(!service) throw new RangeError('Service persistant introuvable');

      const components=await this.rows('SELECT * FROM catering.components WHERE service_id=$1 ORDER BY sort_order',[id]);

      const shared=await this.getSharedPreparations(id);

      const categories=await this.rows(`SELECT cc.* FROM catering.component_categories cc JOIN catering.components c ON c.id=cc.component_id

        WHERE c.service_id=$1 ORDER BY cc.sort_order`,[id]);

      // Projection canonique du plat ; les anciens snapshots et schémas restent lisibles.

      if((await this.rows("SELECT to_regclass('catering.dishes')::text AS name"))[0].name){

        const dishIds=[...new Set(components.map(c=>c.dish_id).filter(Boolean))];
        const dishes=await this.rows('SELECT d.*,r.scale_mode FROM catering.dishes d JOIN catering.recipes r ON r.id=d.recipe_id WHERE d.id=ANY($1::text[])',[dishIds]);
        const dishCategories=await this.rows('SELECT dish_id,category,subcategory,sort_order FROM catering.dish_categories WHERE dish_id=ANY($1::text[]) ORDER BY sort_order',[dishIds]);
        const dishMap=new Map(dishes.map(d=>[d.id,d]));
        for(const c of components)if(c.dish_id){
          const dish=dishMap.get(c.dish_id);if(!dish)throw new RangeError('Plat persistant introuvable');
          const audience=c.portion_group;
          Object.assign(c,dish.configuration,{name:dish.name,recipe_id:dish.scale_mode==='shared_preparation'?c.recipe_id:dish.recipe_id});
          const kinds=dishCategories.filter(k=>k.dish_id===dish.id);
          if(kinds.some(k=>k.category==='Sauce')&&!kinds.some(k=>k.category==='Protein')&&['all','meat','fish','vegetarian'].includes(audience))c.portion_group=audience;
          for(let i=categories.length-1;i>=0;i--)if(categories[i].component_id===c.id)categories.splice(i,1);
          categories.push(...dishCategories.filter(k=>k.dish_id===dish.id).map(({dish_id,...k})=>({...k,component_id:c.id})));
        }
      }
      const recipeIds=[...new Set([...components,...shared].map(c=>c.recipe_id).filter(Boolean))];
      const recipeRows=await this.rows(`SELECT r.*,r.reference_portions::text AS reference_portions,r.reference_headcount::text AS reference_headcount,r.reference_production_units::text AS reference_production_units,r.yield_value::text AS yield_value FROM catering.recipes r WHERE r.id=ANY($1::text[])`,[recipeIds]);
      const recipeMap=new Map(recipeRows.map(r=>[r.id,r]));
      const recipes=recipeIds.map(id=>recipeMap.get(id));
      const ingredientRows=await this.rows(`SELECT ri.*,ri.quantity::text AS quantity,i.normalized_name,i.purchase_category,i.default_unit,(to_jsonb(i)->>'purchase_required')::boolean AS purchase_required,i.allergen_status,i.rounding_profile_id AS ingredient_rounding_profile_id,coalesce((SELECT jsonb_agg(a.code ORDER BY a.sort_order) FROM catering.ingredient_allergens ia JOIN catering.allergens a ON a.id=ia.allergen_id WHERE ia.ingredient_id=i.id),'[]'::jsonb) AS allergen_codes FROM catering.recipe_ingredients ri JOIN catering.ingredients i ON i.id=ri.ingredient_id WHERE ri.recipe_id=ANY($1::text[]) ORDER BY ri.sort_order`,[recipeIds]);
      const ingredients=recipeIds.flatMap(id=>ingredientRows.filter(i=>i.recipe_id===id));

      const rules=await this.rows(`SELECT p.*,p.value::text AS value,p.basis_count::text AS basis_count FROM catering.rule_profiles p

        WHERE p.id IN (SELECT profile_id FROM catering.service_rule_bindings WHERE service_id=$1)

        OR p.id IN (SELECT o.profile_id FROM catering.recipe_rule_overrides o JOIN catering.components c ON c.recipe_id=o.recipe_id WHERE c.service_id=$1)

        OR p.id IN (SELECT o.profile_id FROM catering.recipe_rule_overrides o JOIN catering.shared_preparations sp ON sp.recipe_id=o.recipe_id WHERE sp.service_id=$1)

        OR p.id IN (SELECT rule_profile_id FROM catering.components WHERE service_id=$1) OR p.id=ANY($2::text[])`,[id,components.map(c=>c.rule_profile_id).filter(Boolean)]);

      const units=await this.rows(`SELECT u.*,u.capacity_portions::text AS capacity_portions,u.subunit_quantity::text AS subunit_quantity

        FROM catering.production_units u WHERE u.id IN (SELECT production_unit_id FROM catering.components WHERE service_id=$1)

        OR u.id IN (SELECT p.production_unit_id FROM catering.rule_profiles p JOIN catering.service_rule_bindings b ON b.profile_id=p.id WHERE b.service_id=$1)

        OR u.id IN (SELECT p.production_unit_id FROM catering.rule_profiles p JOIN catering.recipe_rule_overrides o ON o.profile_id=p.id

          JOIN catering.components c ON c.recipe_id=o.recipe_id WHERE c.service_id=$1)

        OR u.id=ANY($2::text[]) OR u.id=ANY($3::text[])`,[id,recipes.flatMap(r=>(r.production_references||[]).map(ref=>ref.production_unit_id).filter(Boolean)),components.map(c=>c.production_unit_id).filter(Boolean)]);

      const bindings=await this.rows('SELECT * FROM catering.service_rule_bindings WHERE service_id=$1 ORDER BY role,rule_key,rule_type',[id]);

      const overrides=await this.rows(`SELECT o.* FROM catering.recipe_rule_overrides o WHERE o.recipe_id=ANY($1::text[])`,[recipes.map(r=>r.id)]);

      const allocations=await this.rows(`SELECT a.*,a.ratio_numerator::text AS ratio_numerator,a.ratio_denominator::text AS ratio_denominator,

        a.reference_quantity::text AS reference_quantity FROM catering.shared_preparation_allocations a WHERE service_id=$1 ORDER BY sort_order`,[id]);

      const inputs=await this.rows(`SELECT i.* FROM catering.component_preparation_inputs i JOIN catering.components c ON c.id=i.component_id WHERE c.service_id=$1 ORDER BY i.sort_order`,[id]);

      const rounding=await this.rows(`SELECT r.*,kg_step::text AS kg_step,l_step::text AS l_step,g_step::text AS g_step,ml_step::text AS ml_step FROM catering.rounding_profiles r`);

      const ruleIngredients=await this.rows(`SELECT p.id AS profile_id,i.id AS ingredient_id,i.normalized_name,i.purchase_category,i.default_unit,i.allergen_status,

        coalesce((SELECT jsonb_agg(a.code ORDER BY a.sort_order) FROM catering.ingredient_allergens ia JOIN catering.allergens a ON a.id=ia.allergen_id WHERE ia.ingredient_id=i.id),'[]'::jsonb) AS allergen_codes

        FROM catering.rule_profiles p JOIN catering.ingredients i ON i.id=p.ingredient_id WHERE p.id=ANY($1::text[])`,[rules.map(r=>r.id)]);

      const conversionTable=(await this.rows("SELECT to_regclass('catering.purchase_conversions')::text AS name"))[0].name;

      const purchaseConversions=conversionTable?await this.rows("SELECT c.*,c.ratio::text AS ratio,c.display_threshold::text AS display_threshold,i.normalized_name,i.purchase_category,i.default_unit FROM catering.purchase_conversions c JOIN catering.ingredients i ON i.id=c.purchase_ingredient_id WHERE i.active"):[];

      const unitTable=(await this.rows("SELECT to_regclass('catering.purchase_unit_conversions')::text AS name"))[0].name;

      const purchaseUnits=unitTable?await this.rows('SELECT id,purchase_unit FROM catering.ingredients WHERE active'):[];

      const purchaseUnitConversions=unitTable?await this.rows('SELECT *,ratio::text AS ratio FROM catering.purchase_unit_conversions'):[];

      const menuTable=(await this.rows("SELECT to_regclass('catering.component_menu_contributions')::text AS name"))[0].name;

      const menuContributions=menuTable?await this.rows('SELECT m.* FROM catering.component_menu_contributions m JOIN catering.components c ON c.id=m.source_component_id WHERE c.service_id=$1',[id]):[];

      const result={menuContributions,purchaseUnits,purchaseUnitConversions,purchaseConversions,service,components,shared,categories,recipes,ingredients,rules,units,bindings,overrides,allocations,inputs,rounding,ruleIngredients};

      if(!withinTransaction)await this.client.query('COMMIT'); return result;

    } catch(error) { if(!withinTransaction)await this.client.query('ROLLBACK'); throw error; }

  }

}

module.exports={PostgresRepository};

