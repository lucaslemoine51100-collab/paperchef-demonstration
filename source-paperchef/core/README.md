# Moteur de calcul V0

## Fiches techniques dynamiques

[TECHNICAL_SHEETS.md](TECHNICAL_SHEETS.md) documente le pipeline PostgreSQL → moteur → view model → HTML/CSS A4 → PDF. Un seul gabarit sert les quatre services. Les fiches Carbonnade/Limande à 100 et 160 couverts sont dans `fiches/` ; le code de présentation est dans `technical-sheets/`. Aucun calcul métier n’est ajouté au template.

## Catalogue ingrédients V1

[INGREDIENTS.md](INGREDIENTS.md) décrit le catalogue général, les trois statuts allergènes, les alias et la déduplication. Les migrations 003/004 enrichissent la base existante sans réécrire les références 001/002 ni modifier `engine.js`. Les 156 ingrédients fournis et 10 ingrédients génériques conservés donnent 166 entrées actives après déduplication.

```sh
node --test tests.js persistence/integration.test.js persistence/ingredients.test.js
```

Les résultats de calcul des quatre services sont conservés ; les allergènes agrégés sont enrichis à partir du catalogue. Le test historique 001/002 et les tests de migration V1 restent tous exécutés.

## Persistance relationnelle

Le modèle PostgreSQL, ses choix et les instructions sont dans [SCHEMA.md](SCHEMA.md). Les migrations 001/002, seeds des quatre références, repository, adaptateur et tests d’intégration sont dans `persistence/`. `engine.js` est inchangé. Le repository fournit des données au moteur via un catalogue isolé, sans mutation des références globales.

```sh
node --test tests.js persistence/integration.test.js
```

La suite d’intégration nécessite PGlite (dépendance de développement définie dans `persistence/package.json`). Dans cet espace de travail, elle est installée dans `work/persistence-tests/`. Les données de test sont réellement persistées sur disque, puis rechargées. Pour un serveur PostgreSQL, utiliser une connexion `pg` réservée ; voir SCHEMA.md.

## Quatrième service : quiches

```js
const { calculate } = require('./engine');
const result = calculate(103, 'quiches');
```

```sh
node display.js --service quiches 100 160 181 103
node --test tests.js
```

L’unité de production introduite pour les lasagnes est réutilisée. Le nouveau choix générique `ingredientBasis` vaut `portions` par défaut ou `productionUnits` pour les recettes calculées sur les unités réellement produites. En mode `productionUnits`, `baseProductionUnits` indique le nombre d’unités de la recette de référence. Le profil de quiche définit une plaque pour 10 portions ; les ingrédients sont donnés pour une plaque. Toutes ces valeurs sont dans `quiches.js`, sans branche spécifique aux quiches dans le moteur.

Le moteur utilise l’entier exact des plaques après arrondi supérieur métier, jamais la chaîne d’affichage. Les éléments par unité (`itemsPerUnit`) sont désormais facultatifs : un bac de lasagnes contient 4 plaques, alors que la plaque de quiche constitue directement l’unité produite. Les lasagnes conservent leur base par portions.

À 103 couverts : 72 portions lard / 31 thon, 8 plaques / 4 plaques. Les lardons valent exactement 4,8 kg, calculés sur 8 plaques et non sur 72 portions. Salade et vinaigrette restent sur 103 couverts, indépendamment des capacités produites.

Les quantités par plaque de 500 g sont exprimées exactement comme 0,5 kg dans les données pour afficher les masses principales en kg. Les unités sont conservées : emmental lard en kg et emmental thon en g, conformément aux exemples fournis. À 100 couverts, 1,05 kg d’emmental lard s’affiche 1,1 kg ; 21 g de sel lard s’affiche 20 g. Les valeurs exactes restent conservées.

`resultats-quiches.md` contient les récapitulatifs détaillés pour 100, 160, 181 et 103 couverts. Aucun design A4 ajouté.

## Troisième service : lasagnes

```js
const { calculate } = require('./engine');
const result = calculate(103, 'lasagnes');
```

```sh
node display.js --service lasagnes 100 160 181 103
node --test tests.js
```

`lasagnes.js` contient toutes les données spécifiques. Les deux anciens services et leurs appels sont conservés.

Extensions génériques du moteur :

- `preparations` : préparations communes calculées une fois, avec leurs ingrédients et leur rendement, séparées des plats dans le résultat.
- `allocations` : quantités affectées aux identifiants de plats. Un ingrédient `fromPreparation` reprend l’allocation exacte ; il ne crée pas une seconde fabrication. Pour les achats, compter les ingrédients de préparation une fois et exclure les prélèvements internes.
- `production` : capacité en portions par unité et nombre d’éléments par unité. L’arrondi supérieur des unités physiques est une décision métier, distincte d’un arrondi d’affichage. Les plaques viennent du nombre entier de bacs. Les ingrédients restent proportionnels aux portions demandées, conformément aux formules fournies, et non à la capacité totale des bacs.
- `resolveRules` : pour chaque règle complète, priorité `recipe.rules` > profil > règle générique explicitement sélectionnée. Une règle spécifique remplace la règle entière, pas seulement certains champs. Les catégories fonctionnelles supplémentaires sont conservées dans `categories` sans déclencher des grammages additionnels sur un plat complet.

La salade utilise une surcharge par recette (50 g/pers contre 120 g/pers dans la règle générique sélectionnée). La vinaigrette utilise un profil (15 ml/pers contre 7,5 L/100 dans la règle générique sélectionnée). Le profil des lasagnes définit les bacs GN 1/1 de 10 portions et 4 plaques. Ces valeurs ne figurent pas dans le moteur.

### Choix de cohérence pour la béchamel

La demande fournit à la fois un prélèvement saumon de 4 L/30 portions et une allocation commune de 4 L/100 couverts. Ces formules divergent lorsque la répartition des portions est arrondie. La préparation commune et son allocation 8 L/4 L sur l’effectif total sont retenues comme source de vérité. Les deux plats affichent leur prélèvement issu de cette allocation. À 103 couverts : 12,36 L au total, dont 8,24 L bolo et 4,12 L saumon, conservés exactement. Le rendement est une cible approximative de fabrication, pas la somme des volumes et masses des ingrédients.

Le Grana de finition est une recette séparée, en plus du Grana de la béchamel. La vinaigrette possède un rendement cible distinct de la somme de ses ingrédients. L’eau reste QS uniquement si besoin pour détendre.

Le rapport `resultats-lasagnes.md` montre les quatre effectifs, les fractions exactes, les quantités d’affichage, les allocations et la production. Aucun design A4 n’est ajouté.

JavaScript pour Node.js, sans dépendance. Aucun développement de PWA ni de fiche A4.

- `service.js` : données, bases des recettes, catégories, liens, consignes et quatre règles de sauce.
- `engine.js` : fonction pure `calculate(effectif)`, répartition et calculs exacts par fractions d’entiers BigInt. Résultat sérialisable en JSON, avec numérateur et dénominateur sous forme de chaînes et unité explicite.
- `display.js` : présentation Markdown indépendante du métier.
- `tests.js` : exemples demandés, conservation du total, égalités, précision et validation des entrées.

## Extension couscous végétarien

Le moteur existant est conservé. `services.js` fournit le registre des services ; `couscous.js` utilise le même schéma de recettes. `portionMode` décrit un mode générique `split` (deux groupes complémentaires, moitié supérieure attribuée au groupe arrondi) ou `all` (un groupe recevant tous les couverts). Les anciens appels `calculate(effectif)` conservent le service Carbonnade/Limande par défaut.

```js
const result = calculate(160, 'couscous-vegetarien');
// portions : { vegetarian: 160 }
// Toutes les recettes utilisent le périmètre covers.
```

```sh
node display.js --service couscous-vegetarien 80 100 160
```

La semoule utilise une référence par personne : 0,08 kg de semoule, 0,12 L d’eau, 1,2 g de sel et 4 ml d’huile, dérivés exactement des ratios de préparation fournis. La sauce utilise sa référence de 100 couverts. Les légumes de garniture et de sauce restent deux ingrédients distincts dans deux recettes distinctes.

À 160 couverts, le sel de semoule conserve exactement 192 g et affiche 190 g selon la règle d’arrondi à la dizaine. À 80 couverts, il conserve 96 g et affiche 100 g. Les pièces utilisent également les fractions exactes : même pour les grands effectifs, leur quantité ne dépend pas d’un flottant.

Depuis ce dossier :

```sh
node --test tests.js
node display.js
node display.js 181
```

Utilisation du moteur :

```js
const { calculate } = require('./engine');
const result = calculate(181);
// result.portions = { meat: 127, fish: 54 }
// result.recipes contient ingrédients exacts, affichage, sauce et rendement.
```

L’effectif doit être un entier positif ou nul, dans la plage des entiers sûrs JavaScript. Le poisson est arrondi à l’entier le plus proche, avec la moitié supérieure en cas d’égalité ; la viande est le complément. Aucune quantité d’affichage ne sert d’entrée au calcul.

Les kg et L sont arrondis au dixième, les g et ml à la dizaine, avec moitié supérieure. Les unités de référence sont conservées ; aucune conversion automatique d’unité. Les QS ne sont pas chiffrés, même à effectif nul. Les fractions représentent une précision de calcul, pas une précision physique garantie.

Pour ce service, seule la règle de sauce supplémentaire du mijoté est appliquée à la carbonnade. Le rendement du beurre blanc suit le poisson. Les quatre règles figurent également dans `sauceRules` comme alternatives disponibles : elles ne doivent pas être additionnées. Le volume de sauce intégrée au mijoté n’est pas estimé à partir des liquides crus. Le rendement cible du beurre blanc est une donnée distincte de la somme des ingrédients.

Les futures exceptions de grammage des légumes sont signalées, sans coefficient inventé. Toute nouvelle recette définit son périmètre et sa base dans les données. La future fiche A4 pourra consommer le résultat du moteur sans changer ses calculs.


## Planification persistante

Voir [planning/README.md](planning/README.md) : bibliothèque de types, occurrences réelles et semaines partiellement remplies. Les documents hebdomadaires utilisent désormais ces occurrences, sans remplissage automatique.

## Première interface manipulable

Voir [pwa/README.md](pwa/README.md). Lancement : `node outputs/moteur-v0/pwa/server.js` depuis le dossier de travail, puis ouvrir http://127.0.0.1:8787. L’écran Semaine, la Bibliothèque et les Documents utilisent les repositories existants.
