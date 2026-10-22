const fs=require('node:fs');

const path=require('node:path');

// À exécuter sur une connexion réservée, un seul processus de migration à la fois.

async function applyMigrations(client,{through='022'}={}) {

  const migrations=[['001','001_schema.sql'],['002','002_reference_seeds.sql'],['003','003_ingredient_catalog_structure.sql'],['004','004_general_ingredients.sql'],['005','005_purchase_conversions.sql'],['006','006_purchase_units.sql'],['007','007_planning.sql'],['008','008_library_editor.sql'],['009','009_production_references.sql'],['010','010_reusable_dishes.sql'],['011','011_dish_rule_bindings.sql'],['012','012_lasagne_finish.sql'],['013','013_component_preparations.sql'],['014','014_salad_portion.sql'],['015','015_planned_split.sql'],['016','016_service_instructions.sql'],['017','017_fresh_lemon_orders.sql'],['018','018_croque_production.sql'],['019','019_pizza_production.sql'],['020','020_whole_chicken_production.sql'],['021','021_service_variants.sql'],['022','022_ingredient_nutrition.sql']];

  if(!migrations.some(([version])=>version===through))throw new RangeError('Version de migration inconnue');

  for(const [version,file] of migrations) {

    if(version>through)break;

    const exists=(await client.query("SELECT to_regclass('catering.schema_migrations')::text AS name")).rows[0].name;

    if(exists&&(await client.query('SELECT version FROM catering.schema_migrations WHERE version=$1',[version])).rows.length)continue;

    const sql=fs.readFileSync(path.join(__dirname,file),'utf8');

    try {if(client.exec)await client.exec(sql);else await client.query(sql);}

    catch(error){await client.query('ROLLBACK');throw error;}

  }

}

if(require.main===module) {

  (async()=>{

    const {Client}=require('pg');

    if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL requis');

    const client=new Client({connectionString:process.env.DATABASE_URL});

    try{await client.connect();await applyMigrations(client);console.log('Migrations 001 à 009 appliquées ou déjà présentes.');}

    finally{await client.end();}

  })().catch(error=>{console.error(error.message);process.exitCode=1;});

}

module.exports={applyMigrations};


