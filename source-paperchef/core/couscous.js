// Même schéma de recettes que le premier service ; tous les périmètres sont covers.
const ingredient = (name, quantity, unit) => ({ name, quantity, unit });
module.exports = {
  id: 'couscous-vegetarien', name: 'Couscous végétarien', baseCovers: 100,
  portionMode: { type: 'all', group: 'vegetarian' },
  sauceRules: {},
  recipes: [
    { id: 'merguez-vegetales', name: 'Merguez végétales', category: ['Protéine', 'Végétarien'],
      scope: 'covers', basePortions: 1, notes: ['2 pièces par personne'],
      ingredients: [ingredient('Merguez végétales', '2', 'pièces')] },
    { id: 'semoule', name: 'Semoule', category: ['Féculent'], scope: 'covers', basePortions: 1,
      notes: ['80 g de semoule crue par personne', 'Pour 1 kg : 1,5 L d’eau, 15 g de sel et 50 ml d’huile d’olive'],
      ingredients: [ingredient('Semoule crue', '0.08', 'kg'), ingredient('Eau', '0.12', 'L'),
        ingredient('Sel', '1.2', 'g'), ingredient('Huile d’olive', '4', 'ml')] },
    { id: 'legumes-couscous', name: 'Légumes couscous', category: ['Légume'], scope: 'covers', basePortions: 1,
      notes: ['120 g de légumes par personne', 'Garniture distincte des légumes de la sauce'],
      ingredients: [ingredient('Légumes couscous (garniture)', '0.12', 'kg')] },
    { id: 'sauce-couscous', name: 'Sauce couscous végétarienne', category: ['Sauce'], scope: 'covers', basePortions: 100,
      notes: ['Les légumes de cette sauce sont distincts de la garniture', 'Rendement cible de sauce finie ; distinct de la somme des ingrédients'],
      targetYield: { quantity: '7.5', unit: 'L' },
      ingredients: [ingredient('Légumes couscous surgelés (sauce)', '1.8', 'kg'),
        ingredient('Tomates concassées', '2.7', 'kg'), ingredient('Bouillon de légumes préparé', '3.6', 'L'),
        ingredient('Concentré de tomate', '130', 'g'), ingredient('Farine', '250', 'g'),
        ingredient('Huile d’olive', '250', 'ml'), ingredient('Ras-el-hanout', '50', 'g'),
        ingredient('Cumin moulu', '20', 'g'), ingredient('Ail', '70', 'g'),
        ingredient('Poivre noir', '10', 'g'), ingredient('Sel', null, 'QS')] }
  ]
};
