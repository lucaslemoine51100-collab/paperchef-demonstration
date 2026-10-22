const ingredient = (name, quantity, unit) => ({ name, quantity, unit });
const qs = name => ingredient(name, null, 'QS');
module.exports = {
  id: 'lasagnes', name: 'Lasagnes bolognaises / saumon-épinards', baseCovers: 100,
  portionMode: { type: 'split', roundedGroup: 'fish', complementGroup: 'meat', ratio: '0.3' },
  sauceRules: {},
  genericRules: { Légume: { portionQuantity: { name: 'Légumes', quantity: '0.12', unit: 'kg' } },
    Sauce: { targetYield: { quantity: '7.5', unit: 'L', basePortions: 100 } } },
  profiles: {
    'plat-en-bac': { production: { name: 'Bac GN 1/1', portionsPerUnit: 10, rounding: 'ceil', itemsPerUnit: 4,
      unit: 'bacs', itemName: 'Plaques de lasagnes', itemUnit: 'plaques' } },
    'vinaigrette-legere': { targetYield: { quantity: '0.015', unit: 'L', basePortions: 1 } }
  },
  preparations: [{ id: 'bechamel', name: 'Béchamel commune', category: ['Préparation commune'], scope: 'covers', basePortions: 100,
    notes: ['Préparation fabriquée une seule fois ; rendement approximatif de référence'],
    targetYield: { quantity: '12', unit: 'L' },
    allocationBasis:'componentPortions',
    allocations: [{ to: 'lasagnes-bolo', referenceComponentPortions:70, quantity: '8', unit: 'L' }, { to: 'lasagnes-saumon', referenceComponentPortions:30, quantity: '4', unit: 'L' }],
    ingredients: [ingredient('Lait','12','L'), ingredient('Beurre','600','g'), ingredient('Farine','600','g'),
      ingredient('Grana Padano (béchamel)','1','kg'), qs('Muscade'), qs('Sel'), qs('Poivre noir')] }],
  recipes: [
    { id: 'lasagnes-bolo', name: 'Lasagnes bolognaises', category: ['Protéine','Viande'],
      categories: [['Protéine','Viande'],['Féculent'],['Légume'],['Plat complet']], profile: 'plat-en-bac', scope: 'meat', basePortions: 70,
      notes: ['Ingrédients calculés sur les portions ; bacs et plaques calculés au supérieur'],
      ingredients: [ingredient('Bœuf haché','7','kg'), ingredient('Brunoise de légumes','1.05','kg'),
        ingredient('Tomates concassées','7','kg'), ingredient('Concentré de tomate','350','g'),
        ingredient('Bouillon de bœuf','2.1','L'), ingredient('Huile d’olive','210','ml'),
        ingredient('Thym','20','g'), ingredient('Ail','70','g'), ingredient('Grana Padano de finition','350','g'), { name: 'Béchamel prélevée', fromPreparation: 'bechamel' }] },
    { id: 'lasagnes-saumon', name: 'Lasagnes saumon-épinards', category: ['Protéine','Poisson'],
      categories: [['Protéine','Poisson'],['Féculent'],['Légume'],['Plat complet']], profile: 'plat-en-bac', scope: 'fish', basePortions: 30,
      notes: ['Béchamel prélevée selon l’allocation de la préparation commune'],
      ingredients: [ingredient('Saumon','3.6','kg'), ingredient('Épinards','4.5','kg'), ingredient('Jus de citron','150','ml'), ingredient('Grana Padano de finition','150','g'),
        { name: 'Béchamel prélevée', fromPreparation: 'bechamel' }] },
    { id: 'salade', name: 'Salade verte', category: ['Légume'], genericRule: 'Légume', scope: 'covers', basePortions: 1,
      rules: { portionQuantity: { name: 'Salade verte', quantity: '0.05', unit: 'kg' } },
      notes: ['Règle spécifique : 50 g par personne'], ingredients: [] },
    { id: 'vinaigrette', name: 'Vinaigrette', category: ['Sauce'], genericRule: 'Sauce', profile: 'vinaigrette-legere', scope: 'covers', basePortions: 100,
      notes: ['Profil vinaigrette légère : 15 ml par personne ; eau QS uniquement si besoin pour détendre'],
      ingredients: [ingredient('Huile de colza','900','ml'), ingredient('Vinaigre de cidre','300','ml'),
        ingredient('Moutarde à l’ancienne','150','g'), ingredient('Miel','75','g'), ingredient('Échalotes surgelées','110','g'),
        qs('Sel'), qs('Poivre noir'), qs('Eau (si besoin pour détendre)')] }
  ]
};
