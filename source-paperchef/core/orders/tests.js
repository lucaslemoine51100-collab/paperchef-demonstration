const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const {aggregateOrders,aggregateServiceOrder}=require('./aggregation');
const q=(id,n,d,unit='kg',category='Grocery')=>({ingredient_id:id,normalized_name:id,purchase_category:category,unit,exact:n===null?null:{numerator:String(n),denominator:String(d)}});
const service=(ingredients,id='s')=>({serviceId:id,serviceName:id,covers:100,preparations:[],recipes:[{id:'r',name:'Recette',ingredients}]});
const lines=o=>o.categories.flatMap(c=>c.lines);
test('Commandes : g/kg et ml/L, somme exacte avant affichage',()=>{
 const out=lines(aggregateServiceOrder(service([q('farine',500,1,'g'),q('farine',12,10),q('huile',750,1,'ml'),q('huile',15,10,'L'),q('exact',347,1000),q('exact',586,1000)])));
 assert.deepEqual(out.find(l=>l.ingredient_id==='farine').exact_quantity,{numerator:'17',denominator:'10'});
 assert.deepEqual(out.find(l=>l.ingredient_id==='huile').exact_quantity,{numerator:'9',denominator:'4'});
 assert.deepEqual(out.find(l=>l.ingredient_id==='exact').exact_quantity,{numerator:'933',denominator:'1000'});assert.equal(out.find(l=>l.ingredient_id==='exact').display_quantity,'0,9');
});
test('Commandes : variantes, catégories et dimensions incompatibles restent séparées',()=>{
 const variants=['œufs coquille','œufs liquides','crème liquide','crème épaisse','beurre doux','beurre demi-sel','pdt fraîches','pdt sous vide','thon','saumon','légumes frais','légumes surgelés','feuilletage','brisée','moutarde forte','moutarde ancienne'];
 const inputs=variants.map(id=>q(id,1,1));inputs.push(q('thon',1,1,'unités'),q('thon',1,1,'kg','Fish'),q('thon',1,1,'bacs'));
 assert.equal(lines(aggregateServiceOrder(service(inputs))).length,19);
 assert.throws(()=>aggregateServiceOrder(service([{unit:'kg',exact:{numerator:'1',denominator:'1'}}])),/Identité/);
});
test('Commandes : pièces, plaques, QS, traçabilité, tri stable et absence de mutation',()=>{
 const a=service([q('pièce',3,1,'unités','Fish'),q('plaque',2,1,'plaques'),q('sel',null,1)]),b=service([q('pièce',2,1,'pièces','Fish')],'b');const saved=JSON.stringify([a,b]);const out=aggregateOrders([a,b]);const piece=lines(out).find(l=>l.ingredient_id==='pièce');
 assert.equal(piece.display_quantity,'5');assert.equal(piece.source_count,2);assert.equal(piece.sources.length,2);assert.deepEqual(piece.source_services,['s','b']);assert.equal(piece.canonical_unit,'pièces');assert.equal(lines(out).find(l=>l.ingredient_id==='sel').exact_quantity,null);assert.equal(JSON.stringify([a,b]),saved);
 assert.deepEqual(out.categories.map(c=>c.category),['Dairy','Meat','Fish','Frozen','FreshProduce','Grocery']);
 assert.equal(lines(aggregateOrders([a,a])).find(l=>l.ingredient_id==='pièce').selection_count,2);
});
test('Commandes : 4 services persistants, préparations communes comptées une seule fois',async()=>{
 const {PGlite}=require(path.resolve(__dirname,'../../../work/persistence-tests/node_modules/@electric-sql/pglite'));const {applyMigrations}=require('../persistence/migrate');const {PostgresRepository}=require('../persistence/repository');const {calculateOrderServices}=require('./input-adapter');const db=new PGlite();
 try{await applyMigrations(db);const results=await calculateOrderServices(new PostgresRepository(db),['service-reference','couscous-vegetarien','lasagnes','quiches'].map(serviceId=>({serviceId,headcount:100})));
 const one=lines(aggregateServiceOrder(results[0]));assert.equal(one.filter(l=>l.normalized_name==='Carottes fraîches').length,1);
 const two=lines(aggregateOrders([results[0],results[2]]));
 for(const name of ['Beurre doux','Farine de blé']){const line=two.find(l=>l.normalized_name===name);assert.ok(line,name);assert.equal(line.source_count,2);}
 assert.deepEqual(two.find(l=>l.normalized_name==='Beurre doux').exact_quantity,{numerator:'49',denominator:'20'});
 assert.deepEqual(two.find(l=>l.normalized_name==='Farine de blé').exact_quantity,{numerator:'17',denominator:'20'});
 const all=lines(aggregateOrders(results));
 assert.deepEqual(all.find(l=>l.normalized_name==='Grana Padano').exact_quantity,{numerator:'3',denominator:'2'});
assert.equal(new Set(all.map(l=>JSON.stringify([l.purchase_key,l.purchase_category,l.canonical_unit]))).size,all.length);
 const purchasable=results.flatMap(s=>[...s.recipes,...s.preparations].flatMap(r=>r.ingredients.filter(i=>!i.fromPreparation&&i.purchase_required!==false)));
 assert.equal(all.reduce((n,l)=>n+l.sources.length,0),purchasable.length);
 assert.ok(results[2].recipes.some(r=>r.ingredients.some(i=>i.fromPreparation)));
 assert.ok(all.some(l=>l.normalized_name==='Lait'));assert.ok(all.some(l=>l.normalized_name==='Crème liquide'));
 for(const unit of ['g','ml'])assert.ok(all.every(l=>l.canonical_unit!==unit));
 }finally{await db.close();}
});
