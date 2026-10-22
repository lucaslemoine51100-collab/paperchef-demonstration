const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
let PGlite;try{({PGlite}=require('@electric-sql/pglite'));}catch{({PGlite}=require(path.resolve(__dirname,'../../../work/persistence-tests/node_modules/@electric-sql/pglite')));}
const {PostgresRepository}=require('../persistence/repository');
const {applyMigrations}=require('../persistence/migrate');
const {generateTechnicalSheet}=require('./pipeline');
const {colorProfile}=require('./view-model');
const {renderTechnicalSheet}=require('./template');
test('Fiches génériques : données PostgreSQL → calcul → view model → HTML',async t=>{
 const db=new PGlite();
 try{
  await applyMigrations(db);const repo=new PostgresRepository(db);
  await t.test('100 et 160 couverts, affichages et exacts inchangés depuis le moteur',async()=>{
   for(const n of [100,160]){
    const sheet=await generateTechnicalSheet(repo,'service-reference',n);
    assert.equal(sheet.viewModel.headcount,n);assert.equal(sheet.viewModel.components.length,5);
    sheet.result.recipes.forEach((r,i)=>r.ingredients.forEach((q,j)=>{
     const v=sheet.viewModel.components[i].ingredients[j];assert.equal(v.displayQuantity,q.display);assert.deepEqual(v.exact,q.exact);
    }));
    const components=sheet.viewModel.components;
    assert.deepEqual(components.map(c=>c.colorProfile),['meat','fish','starch','vegetable','sauce']);
    assert.equal(components[0].calculatedPortions,n===160?112:70);
    assert.equal(components[1].ingredients[0].displayQuantity,n===160?'48 unités':'30 unités');
    assert.equal(components[2].ingredients[0].displayQuantity,n===160?'32,0 kg':'20,0 kg');
    assert.equal(components[3].ingredients[0].displayQuantity,n===160?'19,2 kg':'12,0 kg');
    assert.equal(components[4].yield,n===160?'4,0 L':'2,5 L');
    assert.deepEqual(components[0].ingredients[0].exact,n===160?{numerator:'84',denominator:'5'}:{numerator:'21',denominator:'2'});
    assert.equal(components[4].ingredients[0].displayQuantity,n===160?'2,6 kg':'1,6 kg');
    assert.ok(components[0].allergens.includes('Gluten'));assert.ok(components[4].allergens.includes('Lait'));
    assert.equal(sheet.viewModel.allergensComplete,false);assert.match(sheet.html,/Composition à vérifier/);
   }
  });
  await t.test('Composants variables, végétarien, unités physiques et préparation commune',async()=>{
   const couscous=await generateTechnicalSheet(repo,'couscous-vegetarien',160);assert.equal(couscous.viewModel.components.length,4);assert.equal(couscous.viewModel.components[0].colorProfile,'vegetarian');
   const lasagnes=await generateTechnicalSheet(repo,'lasagnes',103);assert.equal(lasagnes.viewModel.sharedPreparations.length,1);
   assert.equal(lasagnes.viewModel.sharedPreparations[0].allocations.length,2);
   assert.equal(lasagnes.viewModel.components[0].productionUnits.units,'8 bacs');assert.equal(lasagnes.viewModel.components[0].productionUnits.items,'32 plaques');
   const quiche=await generateTechnicalSheet(repo,'quiches',103);assert.equal(quiche.viewModel.components[0].productionUnits.units,'8 plaques');
   assert.equal(quiche.viewModel.components[0].productionUnits.items,null);
   assert.equal((lasagnes.html.match(/PRÉPARATION COMMUNE/g)||[]).length,0);assert.equal(require('./presentation-blocks').presentationBlocks(lasagnes.viewModel).filter(c=>c.recipeSections?.length).length,2);
  });
  await t.test('Le template rend des quantités fournies et échappe le contenu',async()=>{
   const sheet=await generateTechnicalSheet(repo,'service-reference',100);
   sheet.viewModel.components[0].ingredients[0].displayQuantity='QUANTITÉ FOURNIE';
   sheet.viewModel.components[0].ingredients[0].exact={numerator:'99999',denominator:'1'};
   sheet.viewModel.components[0].name='<script>alert(1)</script>';
   const html=renderTechnicalSheet(sheet.viewModel);
   assert.ok(html.includes('QUANTITÉ FOURNIE'));assert.ok(!html.includes('99999'));
   assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>alert(1)</script>'));
   assert.match(html,/@page\s*\{\s*size:\s*A4 portrait/);assert.match(html,/@media print/);assert.match(html,/break-inside:\s*avoid/);
  });
  await t.test('Jour et repas issus de PostgreSQL, sans valeur inventée',async()=>{
   const before=await generateTechnicalSheet(repo,'service-reference',100);
   assert.equal(before.viewModel.dayLabel,null);assert.equal(before.viewModel.mealType,null);
   const original=JSON.stringify(before.result);
   try {
    await db.query("UPDATE catering.services SET service_date='2026-10-05',meal_type='lunch' WHERE id='service-reference'");
    const lunch=await generateTechnicalSheet(repo,'service-reference',100);
    assert.equal(lunch.viewModel.dayLabel,'LUNDI');assert.equal(lunch.viewModel.mealType,'MIDI');assert.match(lunch.html,/LUNDI/);assert.match(lunch.html,/MIDI/);
    assert.equal(JSON.stringify(lunch.result),original);
    await db.query("UPDATE catering.services SET service_date='2026-10-06',meal_type='dinner' WHERE id='service-reference'");
    const dinner=await generateTechnicalSheet(repo,'service-reference',100);
    assert.equal(dinner.viewModel.dayLabel,'MARDI');assert.equal(dinner.viewModel.mealType,'SOIR');
   } finally { await db.query("UPDATE catering.services SET service_date=NULL,meal_type=NULL WHERE id='service-reference'"); }
  });
  await t.test('Couleurs uniquement par catégories et snapshot HTML stable',async()=>{
   assert.equal(colorProfile([['Protéine','Poisson'],['Féculent']]),'fish');
   assert.equal(colorProfile([['Légume']]),'vegetable');
   const sheet=await generateTechnicalSheet(repo,'service-reference',100);
   const snapshot=fs.readFileSync(path.join(__dirname,'snapshots/carbonnade-100.html'),'utf8');
   assert.equal(sheet.html,snapshot);
  });
 }finally{await db.close();}
});
