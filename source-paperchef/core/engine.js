const services = require('./services');
const gcd = (a, b) => b === 0n ? a : gcd(b, a % b);
function fraction(n, d = 1n) {
  if (d <= 0n || n < 0n) throw new RangeError('Fraction positive attendue');
  const divisor = gcd(n, d);
  return { n: n / divisor, d: d / divisor };
}
function decimal(value) {
  const [whole, tail = ''] = value.split('.');
  return fraction(BigInt(whole + tail), 10n ** BigInt(tail.length));
}
function scale(value, count, base) {
  const f = decimal(value);
  return fraction(f.n * BigInt(count), f.d * BigInt(base));
}
// Arrondi à la moitié supérieure, exclusivement à la frontière d'affichage.
function format(f, unit) {
  const tenths = unit === 'kg' || unit === 'L';
  const tens = unit === 'g' || unit === 'ml';
  const numerator = tenths ? f.n * 10n : f.n;
  const denominator = tens ? f.d * 10n : f.d;
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  const value = tenths ? `${rounded / 10n},${rounded % 10n}` : String(tens ? rounded * 10n : rounded);
  return `${value} ${unit}`;
}
function quantity(value, unit, count, base) {
  if (value === null) return { exact: null, unit, display: 'QS' };
  const f = scale(value, count, base);
  return { exact: { numerator: String(f.n), denominator: String(f.d) }, unit, display: format(f, unit) };
}
// Priorité par règle complète : recette > profil > règle générique explicitement choisie.
function resolveRules(service, recipe) {
  const legacy = {};
  if (recipe.targetYield) legacy.targetYield = recipe.targetYield;
  return { ...(service.genericRules?.[recipe.genericRule] || {}),
    ...(service.profiles?.[recipe.profile] || {}), ...legacy, ...(recipe.rules || {}) };
}
function production(count, rule) {
  if (!rule) return null;
  const rounding = rule.rounding || 'ceil';
  if (rounding !== 'ceil') throw new RangeError('Stratégie de production non prise en charge');
  if (!Number.isSafeInteger(rule.portionsPerUnit) || rule.portionsPerUnit <= 0 ||
      (rule.itemsPerUnit !== undefined && (!Number.isSafeInteger(rule.itemsPerUnit) || rule.itemsPerUnit < 0))) throw new RangeError('Unité de production invalide');
  const capacity = BigInt(rule.portionsPerUnit);
  const batch=rule.unitsPerBatch??1;if(!Number.isSafeInteger(batch)||batch<1)throw new RangeError('Lot de production invalide');
  const batchUnits=BigInt(batch);
  const units = (BigInt(count)*batchUnits + capacity - 1n) / capacity;
  return { name: rule.name, portionsPerUnit: rule.portionsPerUnit, rounding,
    units: quantity(String(units), rule.unit, 1, 1),
    items: rule.itemsPerUnit === undefined ? null : { name: rule.itemName, ...quantity(String(units * BigInt(rule.itemsPerUnit)), rule.itemUnit, 1, 1) },
    producedCapacity: (()=>{const f=fraction(units*capacity,batchUnits);return {exact:{numerator:String(f.n),denominator:String(f.d)},unit:'portions',display:format(f,'portions')};})() };
}
function calculate(covers, serviceId = 'service-reference') {
  if (!Number.isSafeInteger(covers) || covers < 0) throw new RangeError('Effectif attendu : entier positif ou nul, dans la plage des entiers sûrs');
  if (!Object.hasOwn(services, serviceId)) throw new RangeError('Service inconnu');
  const service = services[serviceId];
  const mode = service.portionMode;
  let portions;
  if (mode.type === 'all') portions = { [mode.group]: covers };
  else if (mode.type === 'split') {
    const ratio = decimal(mode.ratio);
    const raw = BigInt(covers) * ratio.n;
    const rounded = Number((2n * raw + ratio.d) / (2n * ratio.d));
    portions = { [mode.complementGroup]: covers - rounded, [mode.roundedGroup]: rounded };
  } else throw new RangeError('Mode de portions inconnu');
  const counts = { covers, ...portions };
  const sauceQuantities = Object.fromEntries(Object.entries(service.sauceRules).map(([key, rule]) =>
    [key, quantity(rule.quantity, rule.unit, counts[rule.scope], rule.basePortions)]));
  function calculateRecipe(recipe, preparations = []) {
    const count = counts[recipe.scope];
    const rules = resolveRules(service, recipe);
    const produced = production(count, rules.production);
    const ingredientBasis = rules.ingredientBasis || 'portions';
    if (!['portions', 'productionUnits'].includes(ingredientBasis)) throw new RangeError('Base de calcul des ingrédients inconnue');
    if (ingredientBasis === 'productionUnits' && !produced) throw new RangeError('Production requise pour le calcul par unité');
    // Le nombre d’unités est un entier métier exact, jamais une valeur d’affichage.
    const ingredientCount = ingredientBasis === 'productionUnits' ? BigInt(produced.units.exact.numerator) : count;
    const ingredientBase = ingredientBasis === 'productionUnits' ? recipe.baseProductionUnits : recipe.basePortions;
    if (!Number.isSafeInteger(ingredientBase) || ingredientBase <= 0) throw new RangeError('Base de recette invalide');
    const ingredients = recipe.ingredients.map(item => {
      if (!item.fromPreparation) return { name: item.name, ...quantity(item.quantity, item.unit, ingredientCount, ingredientBase) };
      const allocation = preparations.find(p => p.id === item.fromPreparation)?.allocations.find(a => a.to === recipe.id);
      if (!allocation) throw new RangeError('Allocation de préparation introuvable');
      return { name: item.name, fromPreparation: item.fromPreparation,
        exact: allocation.exact ? { ...allocation.exact } : null, unit: allocation.unit, display: allocation.display };
    });
    if (rules.portionQuantity) {
      const rule = rules.portionQuantity;
      ingredients.push({ name: rule.name, ...quantity(rule.quantity, rule.unit, count, rule.basePortions || 1) });
    }
    const yieldRule = rules.targetYield;
    return { id: recipe.id, name: recipe.name, category: recipe.category,
      categories: recipe.categories || [recipe.category], portions: count,
      linkedTo: recipe.linkedTo || null, notes: recipe.notes || [], allergens: recipe.allergens || [], ingredients,
      targetYield: yieldRule ? quantity(yieldRule.quantity, yieldRule.unit, count, yieldRule.basePortions || recipe.basePortions) : null,
      extraServiceSauce: recipe.serviceSauceRule ? sauceQuantities[recipe.serviceSauceRule] : null,
      ingredientBasis, production: produced,
      allocations: (recipe.allocations || []).map(rule => ({ to: rule.to,
        ...quantity(rule.quantity, rule.unit, count, rule.basePortions || recipe.basePortions) })) };
  }
  const preparations = (service.preparations || []).map(recipe => {
    const result=calculateRecipe(recipe);
    if(recipe.allocationBasis!=='componentPortions')return result;
    let total=fraction(0n);
    result.allocations=recipe.allocations.map(rule=>{
      const receiver=service.recipes.find(r=>r.id===rule.to);
      if(!receiver||!Number.isSafeInteger(rule.referenceComponentPortions)||rule.referenceComponentPortions<1)throw new RangeError('Référence de prélèvement invalide');
      const receiverRules=resolveRules(service,receiver);
      const receiverProduction=receiverRules.ingredientBasis==='productionUnits'?production(counts[receiver.scope],receiverRules.production):null;
      const allocationCount=receiverProduction?BigInt(receiverProduction.units.exact.numerator):counts[receiver.scope];
      const allocationBase=receiverProduction?receiver.baseProductionUnits:rule.referenceComponentPortions;
      const q=quantity(rule.quantity,rule.unit,allocationCount,allocationBase);
      if(rule.unit!==recipe.targetYield.unit)throw new RangeError('Unité de prélèvement incompatible');
      const f=fraction(BigInt(q.exact.numerator),BigInt(q.exact.denominator));total=fraction(total.n*f.d+f.n*total.d,total.d*f.d);
      return {to:rule.to,...q};
    });
    const yieldBase=decimal(recipe.targetYield.quantity);
    if(yieldBase.n===0n)throw new RangeError('Rendement de référence nul');
    const project=(f,unit)=>({exact:{numerator:String(f.n),denominator:String(f.d)},unit,display:format(f,unit)});
    result.targetYield=project(total,recipe.targetYield.unit);
    result.ingredients=recipe.ingredients.map(item=>item.quantity===null?{name:item.name,exact:null,unit:item.unit,display:'QS'}:{name:item.name,...project((()=>{const f=decimal(item.quantity);return fraction(f.n*total.n*yieldBase.d,f.d*total.d*yieldBase.n);})(),item.unit)});
    return result;
  });
  return {
    serviceId: service.id, serviceName: service.name, covers, portions,
    // Alternatives de règles conservées ; elles ne sont pas additionnées au service.
    sauceRules: sauceQuantities,
    preparations, recipes: service.recipes.map(recipe => calculateRecipe(recipe, preparations))
  };
}
module.exports = { calculate, format, decimal, resolveRules, production };
