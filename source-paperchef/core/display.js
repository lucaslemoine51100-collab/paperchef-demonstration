const { calculate } = require('./engine');
function report(covers, serviceId = 'service-reference') {
  const result = calculate(covers, serviceId);
  const labels = { meat: 'viande', fish: 'poisson', vegetarian: 'végétariennes' };
  const summary = Object.entries(result.portions).map(([group, count]) => `${count} portions ${labels[group] || group}`).join(' / ');
  const lines = [`## ${result.serviceName} — ${covers} couverts`, '', `**${summary}**`, ''];
  const exact = q => q.exact ? `${q.exact.numerator}${q.exact.denominator === '1' ? '' : '/' + q.exact.denominator} ${q.unit}` : 'QS';
  for (const recipe of [...result.preparations, ...result.recipes]) {
    lines.push(`### ${recipe.name} — ${recipe.portions} portions`, '',
      `Catégories : ${recipe.categories.map(path => path.join(' > ')).join(' ; ')}.`, '',
      '| Ingrédient | Quantité exacte | Affichage |', '|---|---:|---:|');
    for (const item of recipe.ingredients) lines.push(`| ${item.name} | ${exact(item)} | ${item.display} |`);
    lines.push('');
    if (recipe.production) lines.push(`Production : ${recipe.production.units.display} (${recipe.production.name})${recipe.production.items ? ' ; ' + recipe.production.items.display : ''} ; capacité : ${recipe.production.producedCapacity.display}.`,
      `Base des ingrédients : ${recipe.ingredientBasis === 'productionUnits' ? 'unités produites' : 'portions demandées'}.`, '');
    for (const allocation of recipe.allocations) lines.push(`Allocation vers ${allocation.to} : ${allocation.display} (exact : ${exact(allocation)}).`, '');
    if (recipe.extraServiceSauce) lines.push(`Sauce supplémentaire de service : ${recipe.extraServiceSauce.display} (exact : ${exact(recipe.extraServiceSauce)}).`, '');
    if (recipe.targetYield) lines.push(`Rendement cible de sauce finie : ${recipe.targetYield.display} (exact : ${exact(recipe.targetYield)}).`, '');
    lines.push(...recipe.notes.map(note => `- ${note}`));
    if (recipe.allergens.length) lines.push(`- Allergènes : ${recipe.allergens.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}
if (require.main === module) {
  const inputs = process.argv.slice(2);
  const serviceId = inputs[0] === '--service' ? (inputs.splice(0, 2)[1]) : 'service-reference';
  console.log('# Résultats du moteur V0\n\nLes fractions sont les valeurs internes exactes. Les arrondis concernent uniquement l’affichage.\n');
  for (const covers of inputs.length ? inputs.map(Number) : [15,100,160,170,181]) console.log(report(covers, serviceId));
}
module.exports = { report };
