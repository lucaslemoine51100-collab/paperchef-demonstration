# Répartitions et préparations communes

La bibliothèque propose quatre modes : 100 % végétarien, 70/30 viande/poisson, 50/50 et 30/70. La répartition est persistée sur le service type et héritée par ses occurrences. Les portions restent entières, leur somme égale l'effectif, et l'égalité à une demi-portion favorise le poisson.

Les associations entre plats sont déduites de leurs allocations de préparation commune. Ajouter un plat propose ses partenaires : l'utilisateur peut les ajouter ou garder seulement le plat choisi. Les autres dépendances explicites, comme une sauce liée à un poisson, sont conservées.

La migration 013 ajoute une base générique `component_portions` aux allocations. Chaque allocation conserve sa quantité de référence et son nombre de portions destinataires. Le besoin exact est : quantité de référence × portions réelles du composant / portions de référence. Le rendement total est la somme exacte des besoins présents ; les ingrédients de la préparation sont redimensionnés une seule fois sur ce total. Les fractions ne sont arrondies que pour l'affichage.

Pour les lasagnes : bolo = 8 L / 70 portions ; saumon-épinards = 4 L / 30 portions. À 100 couverts en 70/30, le total reste 12 L. Si seule la bolo est présente, la préparation produit 8 L pour ses 70 portions ; le menu signale la protéine poisson manquante. Un autre poisson ne consomme pas cette béchamel sans allocation explicite.

Les recettes de référence, les conversions d'achat, les bacs GN et le Grana de finition sont conservés. Les fiches et commandes consomment le même résultat recalculé. Les allocations historiques `fixed_ratio`, notamment les snapshots des occurrences déjà servies, restent interprétées avec leur mode d'origine.

Contrôles : `component-preparations.test.js` couvre les fractions, les trois ratios sur six effectifs, la sauvegarde, le retrait d'un destinataire, le ViewModel de fiche et l'achat de lait compté une fois. `pwa/shared-choice.test.js` vérifie les quatre choix, les deux réponses à la suggestion et l'aperçu actualisé. La suite complète est lancée par `run-tests.js`.
