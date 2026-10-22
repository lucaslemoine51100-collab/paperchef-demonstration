const ingredient = (name, quantity, unit) => ({ name, quantity, unit });
const qs = name => ingredient(name, null, 'QS');
// 500 g = 0,5 kg : normalisation exacte dans les données pour l’affichage en kg.
const appareil = () => [ingredient('Feuilletage surgelé','1','plaques'),
  ingredient('Crème liquide','0.5','kg'), ingredient('Lait','0.5','kg'), ingredient('Œufs','0.5','kg'),
  ingredient('Maïzena','50','g')];
module.exports = {
  id: 'quiches', name: 'Quiche au lard / Quiche au thon', baseCovers: 100,
  portionMode: { type: 'split', roundedGroup: 'fish', complementGroup: 'meat', ratio: '0.3' }, sauceRules: {},
  genericRules: { Légume: { portionQuantity: { name: 'Légumes', quantity: '0.12', unit: 'kg' } },
    Sauce: { targetYield: { quantity: '7.5', unit: 'L', basePortions: 100 } } },
  profiles: {
    'par-plaque': { ingredientBasis: 'productionUnits', production: { name: 'Plaque', portionsPerUnit: 10, rounding: 'ceil', unit: 'plaques' } },
    'vinaigrette-legere': { targetYield: { quantity: '0.015', unit: 'L', basePortions: 1 } }
  },
  recipes: [
    { id: 'quiche-lard', name: 'Quiche au lard', category: ['Protéine','Viande'],
      categories: [['Protéine','Viande'],['Féculent'],['Plat complet']], scope: 'meat', profile: 'par-plaque', baseProductionUnits: 1,
      notes: ['Recette par plaque produite de 10 portions'],
      ingredients: [...appareil(), ingredient('Lardons crus','0.6','kg'), ingredient('Emmental râpé','0.15','kg'), ingredient('Sel','3','g'), qs('Poivre noir')] },
    { id: 'quiche-thon', name: 'Quiche au thon', category: ['Protéine','Poisson'],
      categories: [['Protéine','Poisson'],['Féculent'],['Plat complet']], scope: 'fish', profile: 'par-plaque', baseProductionUnits: 1,
      notes: ['Recette par plaque produite de 10 portions'],
      ingredients: [...appareil(), ingredient('Thon égoutté','0.5','kg'), ingredient('Emmental râpé','150','g'), ingredient('Sel','10','g'), qs('Poivre noir')] },
    { id: 'salade', name: 'Salade verte', category: ['Légume'], genericRule: 'Légume', scope: 'covers', basePortions: 1,
      rules: { portionQuantity: { name: 'Salade verte', quantity: '0.05', unit: 'kg' } }, notes: ['50 g par personne'], ingredients: [] },
    { id: 'vinaigrette', name: 'Vinaigrette', category: ['Sauce'], genericRule: 'Sauce', profile: 'vinaigrette-legere', scope: 'covers', basePortions: 100,
      notes: ['15 ml par personne ; eau QS uniquement si besoin pour détendre'],
      ingredients: [ingredient('Huile de colza','900','ml'), ingredient('Vinaigre de cidre','300','ml'),
        ingredient('Moutarde à l’ancienne','150','g'), ingredient('Miel','75','g'), ingredient('Échalotes','110','g'),
        qs('Sel'), qs('Poivre noir'), qs('Eau (si besoin pour détendre)')] }
  ]
};
