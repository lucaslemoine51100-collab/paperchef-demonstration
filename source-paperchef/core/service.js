// Quantités de référence exprimées en chaînes décimales, jamais en flottants.
const ingredient = (name, quantity, unit) => ({ name, quantity, unit });
const qs = name => ingredient(name, null, 'QS');
module.exports = {
  id: 'service-reference', name: 'Carbonnade / Limande', baseCovers: 100,
  portionMode: { type: 'split', roundedGroup: 'fish', complementGroup: 'meat', ratio: '0.3' },
  sauceRules: {
    separateMeat: { quantity: '5', unit: 'L', basePortions: 70, scope: 'meat' },
    separateFish: { quantity: '2.5', unit: 'L', basePortions: 30, scope: 'fish' },
    common: { quantity: '7.5', unit: 'L', basePortions: 100, scope: 'covers' },
    stewExtra: { quantity: '2.5', unit: 'L', basePortions: 70, scope: 'meat' }
  },
  recipes: [
    { id: 'carbonnade', name: 'Carbonnade flamande', category: ['Protéine', 'Viande'], scope: 'meat', basePortions: 70,
      notes: ['150 g de bœuf cru par portion viande', 'Plat mijoté en sauce ; sauce intégrée au plat'],
      serviceSauceRule: 'stewExtra', ingredients: [
        ingredient('Bœuf à mijoter', '10.5', 'kg'), ingredient('Oignons', '2.8', 'kg'),
        ingredient('Carottes', '1.4', 'kg'), ingredient('Huile', '300', 'ml'),
        ingredient('Farine', '250', 'g'), ingredient('Cassonade', '140', 'g'),
        ingredient('Vinaigre de vin', '140', 'ml'), ingredient('Bière brune/ambrée', '3', 'L'),
        ingredient('Bouillon de bœuf', '4', 'L'), ingredient('Pain d’épices', '1', 'kg'),
        ingredient('Moutarde forte', '500', 'g'), ...['Thym', 'Laurier', 'Sel', 'Poivre noir', 'Eau chaude en cours de cuisson'].map(qs)
      ] },
    { id: 'limande', name: 'Limande meunière', category: ['Protéine', 'Poisson'], scope: 'fish', basePortions: 30,
      allergens: ['Poisson', 'Gluten'], notes: ['Produit surgelé', 'Cuisson au four, sur plaque avec papier cuisson'],
      ingredients: [ingredient('Limande meunière', '30', 'unités')] },
    { id: 'frites', name: 'Frites', category: ['Féculent'], scope: 'covers', basePortions: 100,
      notes: ['200 g de frites crues sous vide par couvert', 'Précuisson à 140 °C dans la matinée', 'Finition à 180 °C au service'],
      ingredients: [ingredient('Frites crues sous vide', '20', 'kg')] },
    { id: 'carottes', name: 'Carottes braisées', category: ['Légume'], scope: 'covers', basePortions: 100,
      notes: ['Règle générale : 120 g de légumes par couvert ; futures exceptions à définir pour courgettes et champignons'],
      ingredients: [ingredient('Carottes', '12', 'kg'), ingredient('Beurre', '250', 'g'),
        ingredient('Huile', '100', 'ml'), ingredient('Bouillon de légumes ou eau', '2', 'L'), qs('Sel'), qs('Poivre')] },
    { id: 'beurre-blanc', name: 'Sauce beurre blanc', category: ['Sauce'], scope: 'fish', linkedTo: 'limande', basePortions: 30,
      targetYield: { quantity: '2.5', unit: 'L' }, notes: ['Sans eau, sans fumet, sans vin blanc'],
      ingredients: [ingredient('Beurre doux', '1.6', 'kg'), ingredient('Crème liquide', '700', 'ml'),
        ingredient('Échalotes', '300', 'g'), ingredient('Vinaigre de vin blanc', '150', 'ml'),
        ingredient('Jus de citron', '100', 'ml'), ingredient('Maïzena', '30', 'g'), qs('Sel'), qs('Poivre noir')] }
  ]
};
