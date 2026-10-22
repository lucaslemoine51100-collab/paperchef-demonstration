# Nettoyage des références et conversions d’achat — migration 005

## Résultat

**164 ingrédients actifs**, tous avec une catégorie autorisée ; **2 REVIEW_REQUIRED d’achat restants** : `Huile` (variété inconnue) et `Légumes` (produit générique non précisé). Ils restent séparés des références explicites. Aucun classement n’est inventé pour les solder artificiellement.

Le total passe de 166 à 164 : cinq références ambiguës sont dépréciées et trois produits d’achat en poudre sont ajoutés. Aucun identifiant historique n’est supprimé. Les statuts de revue d’achat ne sont pas les statuts de contrôle allergènes : les poudres gardent une vérification de composition nécessaire, les allergènes connus des besoins préparés sont conservés sans prétendre connaître une marque fournisseur.

La migration est appliquée à la base PostgreSQL embarquée persistante locale. Elle est aussi livrée pour tout déploiement PostgreSQL existant : `applyMigrations` applique désormais 001–005. Elle ne crée aucun fournisseur ni conditionnement.

## Références corrigées

| Référence précédente | Référence finale | Catégorie avant | Catégorie finale | Identifiant |
|---|---|---|---|---|
| Frites crues sous vide/surgelées nature | Frites crues sous vide | Surgelé | Fruits et légumes frais | Conservé |
| Thon au naturel | Thon au naturel | Poisson | Épicerie | Conservé |
| Thon égoutté | Thon égoutté | Poisson | Épicerie | Conservé, distinct du thon au naturel |
| Thym | Thym sec | Épicerie | Épicerie | Conservé, ancien nom en alias |
| Laurier | Laurier sec | Épicerie | Épicerie | Conservé, ancien nom en alias |

Les décisions sur limande surgelée, poisson meunière surgelé, poisson pané, terrine de poisson, pommes de terre sous vide et merguez végétales sont confirmées ; leurs catégories étaient déjà celles demandées et restent inchangées. Les frites réfrigérées ne partagent aucune identité avec d’éventuelles frites surgelées futures.

## Références remplacées et dépréciées

| Ancienne référence | Cible explicite | Catégorie cible | Traitement |
|---|---|---|---|
| Brunoise de légumes | Brunoise carotte/oignon/céleri | Surgelé | Références de recettes migrées, ancien ID déprécié et alias |
| Légumes couscous | Légumes couscous surgelés | Surgelé | Garniture et sauce utilisent le même produit, quantités indépendantes conservées puis fusionnées à l’achat |
| Épinards | Épinards surgelés | Surgelé | Lasagnes migrées ; aucune autre utilisation fraîche identifiée dans la base |
| Œufs | Œufs entiers liquides | Crémerie | Quiches exprimées en kg : cible ovoproduit liquide retenue, unité et quantité conservées |
| Bouillon de légumes ou eau | Bouillon de légumes préparé | Épicerie | Besoin culinaire précis, conversion vers poudre |

Les liens `recipe_ingredients` et `rule_profiles` sont déplacés vers les identifiants cibles. Les alias existants sont réaffectés, `active=false` et `superseded_by_id` conservent l’historique. Les œufs coquille restent actifs et distincts en pièces. L’huile générique n’est pas assimilée à une huile précise.

## Catégories finales

| Catégorie | Actifs |
|---|---:|
| Crémerie | 21 |
| Viande | 20 |
| Poisson | 18 |
| Surgelé | 19 |
| Fruits et légumes frais | 27 |
| Épicerie | 59 |
| **Total** | **164** |

## Architecture de conversion

Petite extension PostgreSQL : table `purchase_conversions` et indicateur `ingredients.purchase_required`. Une conversion associe identifiant source, identifiant produit acheté, ratio décimal exact, unité culinaire, unité d’achat et politique d’affichage. Une seule conversion directe par besoin ; les chaînes, cycles et unités incompatibles sont rejetés explicitement par la couche de conversion.

Pipeline : snapshot SQL → moteur V0 inchangé → rattachement des identités → `convertPurchaseRequirements` → `aggregateOrders` → affichage. La conversion se trouve dans `orders/purchase-conversion.js`, sans recherche de mot dans le nom. La source culinaire, sa quantité exacte et son unité restent dans `sources[].culinary_requirement` de chaque ligne d’achat. Les prélèvements de préparations communes restent exclus pour éviter tout double comptage.

Les besoins préparés et l’eau ont `purchase_required=false`. Un besoin préparé converti devient son produit d’achat ; l’eau est exclue des commandes, y compris l’eau déjà présente dans une recette. Aucune ligne d’eau de reconstitution n’est créée. Les quantités d’eau restent dans les calculs et fiches culinaires.

## Trois conversions enregistrées

| Besoin culinaire | Produit d’achat | Ratio exact | Unité d’achat |
|---|---|---|---|
| Bouillon de légumes préparé | Bouillon de légumes en poudre | 0,020 kg/L | kg |
| Bouillon de bœuf préparé | Bouillon de bœuf en poudre | 0,020 kg/L | kg |
| Bouillon de volaille préparé | Bouillon de volaille en poudre | 0,020 kg/L | kg |

Les trois produits gardent des identités différentes. Les litres de bouillon restent dans les recettes. Les achats utilisent des fractions exactes en kg, puis s’affichent en g sous 1 kg et en kg à partir de 1 kg, seuil stocké dans la conversion.

| Exemple | Besoin exact en poudre | Affichage validé |
|---|---:|---:|
| Légumes, 2 L | 40 g | 40 g |
| Bœuf, 4 L | 80 g | 80 g |
| Volaille, 7 L | 140 g | 140 g |
| 3,6 L | 72 g | 70 g |
| 7,5 L | 150 g | 150 g |
| 10 L | 200 g | 200 g |
| Deux recettes légumes, 2 L + 3 L | 100 g | 100 g |

**72 g reste conservé exactement** ; l’affichage 70 g applique uniquement l’arrondi à la dizaine demandé. Aucun arrondi fournisseur.

## Exemple des quatre services, 100 couverts chacun

Carbonnade/Limande + Couscous végétarien + Lasagnes + Quiches :

- Bouillon de bœuf en poudre : **122 g exacts**, affiché **120 g**.
- Bouillon de légumes en poudre : **112 g exacts**, affiché **110 g**.
- Le bouillon de volaille n’est pas utilisé par ces quatre services ; sa conversion est enregistrée et testée à 7 L → 140 g.
- Frites sous vide : Fruits et légumes frais.
- Thon égoutté : Épicerie.
- Aucune ligne fournisseur Eau, aucun bouillon préparé acheté en litres.

Détail complet et contributions : `orders/C-quatre-services.json` ; lecture compacte : `orders/EXEMPLES.md`.

## Vérification

**45 tests réussis**, dont les 42 précédents, avec adaptation des assertions portant sur les données explicitement changées. Les tests historiques du catalogue V1 restent exécutés à la migration 004 ; des tests supplémentaires contrôlent 004→005. Aucun test historique supprimé.

Les valeurs des colonnes quantité/unité/is_qs des ingrédients de recette sont strictement identiques avant et après migration. Les quantités calculées, portions, productions, rendements et allocations restent identiques pour les quatre services à 15, 100, 160 et 181 couverts. L’enrichissement allergènes peut refléter les produits explicitement substitués, sans changement de calcul culinaire.

Tests supplémentaires : dosages légumes/bœuf/volaille, 3,6/7,5/10 L, conversion avant fusion, traçabilité de la source en litres, affichage g/kg, absence d’eau, non-fusion des poudres, idempotence de migration et absence de double conversion. Le moteur `engine.js` n’a pas été modifié. Aucun PDF commande créé.
