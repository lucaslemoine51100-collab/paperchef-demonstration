const assert = require('node:assert/strict');
const { test } = require('node:test');
const { calculate, format, decimal, resolveRules, production } = require('./engine');
const find = (r, id, name) => r.recipes.find(x => x.id === id).ingredients.find(x => x.name === name);
const couscous = n => calculate(n, 'couscous-vegetarien');
test('Quiches : 100, 160, 181, 103 ; tous les ingrédients suivent les plaques produites', () => {
  for (const [n, meat, fish, ml, ft] of [[100,70,30,7,3],[160,112,48,12,5],[181,127,54,13,6],[103,72,31,8,4]]) {
    const r = calculate(n,'quiches');
    assert.deepEqual(r.portions,{ meat, fish });
    assert.equal(meat+fish,n);
    for (const [id, plaques, quantities] of [
      ['quiche-lard',ml,['1','0.5','0.5','0.5','50','0.6','0.15','3']],
      ['quiche-thon',ft,['1','0.5','0.5','0.5','50','0.5','150','10']]
    ]) {
      const recipe = r.recipes.find(x => x.id === id);
      assert.equal(recipe.ingredientBasis,'productionUnits');
      assert.equal(recipe.production.units.display,`${plaques} plaques`);
      assert.equal(recipe.production.items,null);
      assert.equal(recipe.production.producedCapacity.display,`${plaques*10} portions`);
      quantities.forEach((value,i) => {
        const f = decimal(value), exact = recipe.ingredients[i].exact;
        assert.equal(BigInt(exact.numerator)*f.d, BigInt(exact.denominator)*f.n*BigInt(plaques));
      });
      assert.deepEqual(recipe.ingredients[8].exact,null);
      assert.equal(recipe.ingredients[8].display,'QS');
    }
    const salad = find(r,'salade','Salade verte').exact;
    assert.equal(BigInt(salad.numerator)*20n,BigInt(salad.denominator)*BigInt(n));
    const sauce = r.recipes.find(x => x.id === 'vinaigrette').targetYield.exact;
    assert.equal(BigInt(sauce.numerator)*200n,BigInt(sauce.denominator)*BigInt(n)*3n);
    const oil = find(r,'vinaigrette','Huile de colza').exact;
    assert.deepEqual(oil,{ numerator:String(n*9),denominator:'1' });
  }
  const r = calculate(100,'quiches');
  assert.equal(find(r,'quiche-lard','Crème liquide').display,'3,5 kg');
  assert.deepEqual(find(r,'quiche-lard','Emmental râpé').exact,{ numerator:'21',denominator:'20' });
  assert.equal(find(r,'quiche-lard','Emmental râpé').display,'1,1 kg');
  assert.deepEqual(find(r,'quiche-lard','Sel').exact,{ numerator:'21',denominator:'1' });
  assert.equal(find(r,'quiche-lard','Sel').display,'20 g');
  assert.equal(find(r,'quiche-thon','Thon égoutté').display,'1,5 kg');
});
test('Quiches : égalités, zéro, conservation et isolation du mode par unités', () => {
  for (let n=0; n<=1000; n++) {
    const r = calculate(n,'quiches');
    assert.equal(r.portions.meat+r.portions.fish,n);
    if (n%10 === 5) assert.equal(r.portions.fish,Math.floor(n*3/10)+1);
  }
  const zero = calculate(0,'quiches');
  assert.equal(zero.recipes[0].production.units.display,'0 plaques');
  assert.equal(find(zero,'quiche-lard','Lardons crus').display,'0,0 kg');
  const r = calculate(103,'quiches');
  assert.deepEqual(find(r,'quiche-lard','Lardons crus').exact,{ numerator:'24',denominator:'5' });
  // 72 portions mais 8 plaques : 4,8 kg, et non 4,32 kg.
  assert.equal(find(r,'quiche-lard','Lardons crus').display,'4,8 kg');
  assert.equal(calculate(103,'lasagnes').recipes[0].ingredientBasis,'portions');
  assert.deepEqual(find(calculate(103,'lasagnes'),'lasagnes-bolo','Bœuf haché').exact,{ numerator:'36',denominator:'5' });
});
test('Lasagnes : répartition, bacs, plaques et recettes pour 100, 160, 181, 103', () => {
  for (const [n, meat, fish, bm, bf, pm, pf] of [[100,70,30,7,3,28,12],[160,112,48,12,5,48,20],
    [181,127,54,13,6,52,24],[103,72,31,8,4,32,16]]) {
    const r = calculate(n, 'lasagnes');
    assert.deepEqual(r.portions, { meat, fish });
    assert.equal(meat + fish, n);
    for (const [id, portions, bacs, plaques] of [['lasagnes-bolo',meat,bm,pm],['lasagnes-saumon',fish,bf,pf]]) {
      const recipe = r.recipes.find(x => x.id === id);
      assert.equal(recipe.portions, portions);
      assert.equal(recipe.production.units.display, `${bacs} bacs`);
      assert.equal(recipe.production.items.display, `${plaques} plaques`);
      assert.deepEqual(recipe.production.units.exact, { numerator: String(bacs), denominator: '1' });
    }
    // Aucun redimensionnement des ingrédients sur la capacité arrondie des bacs.
    const beef = find(r,'lasagnes-bolo','Bœuf haché').exact;
    assert.equal(BigInt(beef.numerator) * 10n, BigInt(beef.denominator) * BigInt(meat));
    const salmon = find(r,'lasagnes-saumon','Saumon').exact;
    assert.equal(BigInt(salmon.numerator) * 25n, BigInt(salmon.denominator) * BigInt(fish) * 3n);
    const salad = find(r,'salade','Salade verte').exact;
    assert.equal(BigInt(salad.numerator) * 20n, BigInt(salad.denominator) * BigInt(n));
    const vinaigrette = r.recipes.find(x => x.id === 'vinaigrette').targetYield.exact;
    assert.equal(BigInt(vinaigrette.numerator) * 200n, BigInt(vinaigrette.denominator) * BigInt(n) * 3n);
    const finishes=['lasagnes-bolo','lasagnes-saumon'].map(id=>find(r,id,'Grana Padano de finition').exact);
    assert.deepEqual(finishes,[{numerator:String(meat*5),denominator:'1'},{numerator:String(fish*5),denominator:'1'}]);
    assert.ok(!r.recipes.some(x=>x.id==='grana-finition'));
  }
});
test('Préparation commune unique et allocations exactes, sans double comptage', () => {
  for (const n of [0,15,100,160,181,103]) {
    const r = calculate(n,'lasagnes');
    assert.equal(r.preparations.length, 1);
    const p = r.preparations[0];
    assert.equal(p.id, 'bechamel');
    assert.equal(r.recipes.filter(x => x.id === 'bechamel').length, 0);
    const total = p.targetYield.exact;
    assert.equal(BigInt(total.numerator)*105n, BigInt(total.denominator)*(BigInt(r.portions.meat)*12n+BigInt(r.portions.fish)*14n));
    const [a,b] = p.allocations.map(x => x.exact);
    assert.equal((BigInt(a.numerator)*BigInt(b.denominator)+BigInt(b.numerator)*BigInt(a.denominator))*BigInt(total.denominator),
      BigInt(total.numerator)*BigInt(a.denominator)*BigInt(b.denominator));
    for (const allocation of p.allocations) {
      assert.deepEqual(find(r,allocation.to,'Béchamel prélevée').exact, allocation.exact);
    }
    assert.equal(p.ingredients.find(x => x.name === 'Grana Padano (béchamel)').unit, 'kg');
  }
  const r = calculate(160,'lasagnes');
  assert.deepEqual(r.preparations[0].allocations.map(x => x.display), ['12,8 L','6,4 L']);
  assert.equal(r.preparations[0].targetYield.display, '19,2 L');
  assert.equal(find(r,'salade','Salade verte').display, '8,0 kg');
  assert.equal(r.recipes.find(x => x.id === 'vinaigrette').targetYield.display, '2,4 L');
});
test('Priorité recette > profil > catégorie, indépendamment du nom du service', () => {
  const s = { genericRules: { Exemple: { portionQuantity: { quantity: '0.12' }, targetYield: { quantity: '7.5' } } },
    profiles: { profil: { targetYield: { quantity: '0.015' } } } };
  const recipe = { category: ['Exemple'], genericRule: 'Exemple', profile: 'profil', rules: { portionQuantity: { quantity: '0.05' } } };
  assert.deepEqual(resolveRules(s,recipe), { portionQuantity: { quantity: '0.05' }, targetYield: { quantity: '0.015' } });
  assert.equal(resolveRules(s,{ ...recipe, rules: { targetYield: { quantity: '2' } } }).targetYield.quantity,'2');
  assert.equal(resolveRules(s,{ category: ['Exemple'], genericRule: 'Exemple' }).portionQuantity.quantity,'0.12');
  assert.deepEqual(resolveRules(s,{ category: ['Exemple'] }), {});
  assert.deepEqual(resolveRules(s,{ ...recipe, category: ['Autre classement'] }),resolveRules(s,recipe));
});
test('Production : cas 73 portions, zéro et paramètres génériques différents', () => {
  const rule = { name: 'Bac', portionsPerUnit: 10, itemsPerUnit: 4, unit: 'bacs', itemUnit: 'plaques' };
  assert.equal(production(73,rule).units.display,'8 bacs');
  assert.equal(production(73,rule).items.display,'32 plaques');
  assert.equal(production(0,rule).units.display,'0 bacs');
  assert.equal(production(73,{ ...rule, rounding: 'ceil' }).rounding,'ceil');
  assert.throws(() => production(73,{ ...rule, rounding: 'floor' }),RangeError);
  assert.equal(production(13,{ ...rule, portionsPerUnit: 6, itemsPerUnit: 2 }).items.display,'6 plaques');
  assert.deepEqual(calculate(15,'lasagnes').portions,{ meat: 10, fish: 5 });
});
test('Couscous : 80, 100 et 160 couverts, quantités exactes et affichées', () => {
  for (const [n, pieces, semoule, eau, sel, huile, legumes, sauce] of [
    [80, '160', ['32','5'], ['48','5'], '96', '320', ['48','5'], '6'],
    [100, '200', ['8','1'], ['12','1'], '120', '400', ['12','1'], '15/2'],
    [160, '320', ['64','5'], ['96','5'], '192', '640', ['96','5'], '12']
  ]) {
    const r = couscous(n);
    assert.deepEqual(r.portions, { vegetarian: n });
    assert.ok(r.recipes.every(recipe => recipe.portions === n));
    const checks = [
      [find(r,'merguez-vegetales','Merguez végétales'), [pieces,'1']],
      [find(r,'semoule','Semoule crue'), semoule], [find(r,'semoule','Eau'), eau],
      [find(r,'semoule','Sel'), [sel,'1']], [find(r,'semoule','Huile d’olive'), [huile,'1']],
      [find(r,'legumes-couscous','Légumes couscous (garniture)'), legumes],
      [r.recipes.find(x => x.id === 'sauce-couscous').targetYield, sauce.includes('/') ? sauce.split('/') : [sauce,'1']]
    ];
    for (const [q, [numerator, denominator]] of checks) {
      assert.deepEqual(q.exact, { numerator, denominator });
      assert.equal(q.display, format({ n: BigInt(numerator), d: BigInt(denominator) }, q.unit));
    }
    assert.equal(checks[0][0].display, `${pieces} pièces`);
    assert.equal(find(r,'semoule','Sel').display, n === 80 ? '100 g' : n === 160 ? '190 g' : '120 g');
  }
});
test('Couscous : tous les ingrédients de sauce suivent le facteur exact, garniture séparée', () => {
  const base = [['1.8','kg'],['2.7','kg'],['3.6','L'],['130','g'],['250','g'],['250','ml'],['50','g'],['20','g'],['70','g'],['10','g']];
  for (const n of [80,100,160]) {
    const r = couscous(n);
    const sauce = r.recipes.find(x => x.id === 'sauce-couscous');
    base.forEach(([value, unit], i) => {
      const f = decimal(value), q = sauce.ingredients[i];
      assert.equal(q.unit, unit);
      assert.equal(BigInt(q.exact.numerator) * f.d * 100n, BigInt(q.exact.denominator) * f.n * BigInt(n));
    });
    assert.deepEqual(sauce.ingredients[10], { name: 'Sel', exact: null, unit: 'QS', display: 'QS' });
    const garnish = find(r,'legumes-couscous','Légumes couscous (garniture)');
    const vegSauce = sauce.ingredients[0];
    assert.equal(BigInt(garnish.exact.numerator) * BigInt(vegSauce.exact.denominator) * 3n,
      BigInt(vegSauce.exact.numerator) * BigInt(garnish.exact.denominator) * 20n);
  }
});
test('Couscous : effectif nul, conservation des portions et absence de fuite entre services', () => {
  for (let n = 0; n <= 1000; n++) {
    const r = couscous(n);
    assert.equal(Object.values(r.portions).reduce((a,b) => a+b,0), n);
    assert.deepEqual(find(r,'merguez-vegetales','Merguez végétales').exact, { numerator: String(n*2), denominator: '1' });
  }
  assert.equal(couscous(0).recipes[3].targetYield.display, '0,0 L');
  assert.deepEqual(calculate(100).portions, { meat: 70, fish: 30 });
  assert.equal(calculate(100).recipes.length, 5);
  assert.equal(couscous(100).recipes.length, 4);
  assert.throws(() => calculate(100, 'inconnu'), RangeError);
  assert.throws(() => calculate(100, 'toString'), RangeError);
});
test('Répartition des cinq effectifs demandés', () => {
  for (const [covers, meat, fish] of [[15,10,5],[100,70,30],[160,112,48],[170,119,51],[181,127,54]]) {
    assert.deepEqual(calculate(covers).portions, { meat, fish });
  }
});
test('Total et portions entières pour 0 à 10 000 couverts et grands effectifs', () => {
  for (const covers of [...Array(10001).keys(), Number.MAX_SAFE_INTEGER]) {
    const { meat, fish } = calculate(covers).portions;
    assert.equal(meat + fish, covers);
    assert.ok(Number.isInteger(meat) && Number.isInteger(fish) && meat >= 0 && fish >= 0);
  }
});
test('Toutes les égalités à 0,5 vont au poisson', () => {
  for (let covers = 5; covers <= 1000; covers += 10) assert.equal(calculate(covers).portions.fish, Math.floor(covers * 3 / 10) + 1);
});
test('Valeurs de référence, dépendances et fractions exactes', () => {
  const r = calculate(181);
  assert.deepEqual(find(r, 'carbonnade', 'Bœuf à mijoter').exact, { numerator: '381', denominator: '20' });
  assert.deepEqual(find(r, 'carbonnade', 'Farine').exact, { numerator: '3175', denominator: '7' });
  assert.equal(find(r, 'limande', 'Limande meunière').display, '54 unités');
  assert.equal(find(r, 'frites', 'Frites crues sous vide').display, '36,2 kg');
  assert.equal(find(r, 'carottes', 'Carottes').display, '21,7 kg');
  assert.deepEqual(r.recipes[0].extraServiceSauce.exact, { numerator: '127', denominator: '28' });
  assert.deepEqual(r.recipes[4].targetYield.exact, { numerator: '9', denominator: '2' });
  assert.equal(r.recipes[4].linkedTo, 'limande');
  const base = calculate(100);
  assert.equal(base.recipes[0].extraServiceSauce.display, '2,5 L');
  assert.equal(base.recipes[4].targetYield.display, '2,5 L');
  assert.deepEqual(Object.values(base.sauceRules).map(q => q.display), ['5,0 L','2,5 L','7,5 L','2,5 L']);
  assert.equal(find(base, 'carbonnade', 'Thym').exact, null);
  assert.deepEqual(base.recipes[1].allergens, ['Poisson', 'Gluten']);
  assert.equal(base.recipes[4].ingredients.length, 8);
});
test('Arrondis uniquement à l’affichage et aucun état arrondi réutilisé', () => {
  assert.equal(format(decimal('4.76'), 'kg'), '4,8 kg');
  assert.equal(format(decimal('238'), 'g'), '240 g');
  assert.equal(format(decimal('51'), 'unités'), '51 unités');
  assert.equal(format(decimal('2.45'), 'L'), '2,5 L');
  assert.equal(format(decimal('145'), 'ml'), '150 ml');
  const first = calculate(15);
  first.recipes[0].ingredients[0].display = '999 kg';
  assert.equal(find(calculate(100), 'carbonnade', 'Bœuf à mijoter').display, '10,5 kg');
});
test('Arrondis validés : seuils explicites pour toutes les unités d’affichage', () => {
  // Attendus fixes et indépendants de la fonction d’arrondi testée.
  for (const [value, unit, expected] of [
    ['4.74','kg','4,7 kg'], ['4.75','kg','4,8 kg'], ['4.76','kg','4,8 kg'],
    ['2.44','L','2,4 L'], ['2.45','L','2,5 L'], ['2.46','L','2,5 L'],
    ['234','g','230 g'], ['235','g','240 g'], ['238','g','240 g'],
    ['144','ml','140 ml'], ['145','ml','150 ml'], ['146','ml','150 ml'],
    ['51','unités','51 unités'], ['320','pièces','320 pièces'], ['160','portions','160 portions'],
    ['0','kg','0,0 kg'], ['0','ml','0 ml']
  ]) assert.equal(format(decimal(value), unit), expected);
  const r = couscous(160);
  const sel = find(r,'semoule','Sel');
  assert.deepEqual(sel.exact, { numerator: '192', denominator: '1' });
  assert.equal(sel.display, '190 g');
  const sauce = r.recipes.find(x => x.id === 'sauce-couscous');
  assert.deepEqual(sauce.ingredients[0].exact, { numerator: '72', denominator: '25' });
  assert.equal(sauce.ingredients[0].display, '2,9 kg');
  assert.deepEqual(sauce.targetYield.exact, { numerator: '12', denominator: '1' });
  assert.equal(sauce.targetYield.display, '12,0 L');
});
test('Zéro et entrées invalides', () => {
  assert.deepEqual(calculate(0).portions, { meat: 0, fish: 0 });
  assert.equal(find(calculate(0), 'frites', 'Frites crues sous vide').display, '0,0 kg');
  for (const value of [-1, 1.5, NaN, Infinity, '100', null, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => calculate(value), RangeError);
});

test('Grana ingrédient : total exact conservé sur les cinq effectifs, sans plat autonome',()=>{for(const n of [15,100,160,170,181]){const r=calculate(n,'lasagnes');const q=['lasagnes-bolo','lasagnes-saumon'].map(id=>find(r,id,'Grana Padano de finition').exact);assert.equal(q.reduce((sum,x)=>sum+BigInt(x.numerator)/BigInt(x.denominator),0n),BigInt(n)*5n);assert.equal(r.recipes.length,4);}});
