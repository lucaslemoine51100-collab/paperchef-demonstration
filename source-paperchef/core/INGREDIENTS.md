# Base ingrédients V1 générale

Le catalogue prolonge la base existante : les migrations 001/002 ne sont pas réécrites. La migration 003 ajoute le modèle V1 et la 004 importe le catalogue. Le moteur de calcul `engine.js` reste inchangé.

La liste fournie comporte **156 ingrédients**, tous conservés. Dix ingrédients génériques déjà utilisés sont maintenus en complément : Eau, Huile, Bouillon de légumes ou eau, Légumes couscous, Légumes, Brunoise de légumes, Saumon, Épinards, Lait et Œufs. Sur les seeds existants, le résultat est **166 ingrédients actifs** après déduplication. Les anciennes lignes remplacées restent présentes, inactives, avec un lien vers leur ingrédient canonique.

## Catégories d’achat

| Catégorie | Usage |
|---|---|
| `Meat` | Viandes et charcuteries |
| `Fish` | Poissons, coquillages et crustacés |
| `Frozen` | Produits surgelés du catalogue |
| `FreshProduce` | Fruits et légumes frais |
| `Dairy` | Crèmerie, fromages et œufs |
| `Grocery` | Épicerie, boissons, bouillons, huiles et condiments |

Le classement fourni est conservé : la limande meunière surgelée est dans Fish, tandis que les frites et merguez végétales sont dans Frozen. La catégorie d’achat ne constitue ni une catégorie fonctionnelle de plat ni une règle de quantité.

## Statuts allergènes

| Statut | Signification | Relations autorisées |
|---|---|---|
| `known` | Allergènes renseignés dans le catalogue | Au moins un lien `ingredient_allergens` |
| `none` | Aucun allergène du référentiel identifié pour cet ingrédient | Aucun lien |
| `review_required` | Composition du produit transformé ou générique à vérifier | Zéro ou plusieurs liens, sans conclure à une liste complète |

Les mentions « minimum » de la demande restent des liens connus avec le statut `review_required`. Ainsi, le poisson pané a Fish et Gluten, mais conserve une composition à revoir. Les merguez végétales restent à revoir même sans lien actuellement connu.

Les contraintes différées empêchent de valider `known` sans allergène ou `none` avec un allergène. Un changement de statut et de relations se fait dans la même transaction. L’absence de lien ne détermine jamais seule le statut.

La migration convertit les anciens `unreviewed` en `review_required`. Les anciens `reviewed` deviennent `known` s’ils ont des liens, sinon `none`. Les statuts de la liste fournie sont ensuite appliqués aux ingrédients importés.

Les listes du catalogue proviennent des indications fournies. Pour un produit réel dont la composition diffère, mettre à jour ses relations et son statut après vérification. Aucune donnée fournisseur ni trace éventuelle n’est ajoutée.

Le référentiel existant conserve ses **14 groupes** et ses codes stables : gluten, crustaceans, eggs, fish, peanuts, soy, milk, nuts, celery, mustard, sesame, sulphites, lupin, molluscs. La liste a été vérifiée sur la [page officielle de la Commission européenne](https://food.ec.europa.eu/food-safety/campaign-2026/allergies_en). Le code `gluten` représente les céréales contenant du gluten ; les exceptions et conditions du référentiel réglementaire ne sont pas des automatismes de classification des produits.

L’agrégation vers recettes, composants et services utilise toujours les relations `ingredient_allergens`, pas des listes libres par recette. L’adaptateur conserve `metadata.allergensComplete=false` et la liste `unreviewedIngredientIds` si un ingrédient utilisé est `review_required`. Le nom de cette propriété est conservé pour compatibilité ; il désigne désormais les identifiants nécessitant une revue.

## Normalisation et déduplication

La clé de comparaison est indépendante du libellé affiché : normalisation Unicode NFC, apostrophes typographiques ramenées à l’apostrophe simple, espaces regroupés, suppression des espaces périphériques et casse ignorée. Les accents et qualificatifs sont conservés.

La fonction JavaScript `ingredientKey` et la fonction SQL `ingredient_name_key` sont testées sur les mêmes cas. Un index unique empêche deux noms actifs ayant la même clé. Les noms canoniques conservent leurs accents et leur graphie lisible.

Les équivalences sémantiques sont **explicites**, dans le générateur de seed, jamais déduites par approximation de texte :

| Ancien nom | Nom canonique |
|---|---|
| Beurre | Beurre doux |
| Farine | Farine de blé |
| Semoule crue | Semoule de blé |
| Sel | Sel fin |
| Poivre | Poivre noir |
| Oignons, Carottes, Échalotes | Variantes fraîches du catalogue |
| Limande meunière | Limande meunière surgelée |
| Frites crues sous vide | Frites crues sous vide/surgelées nature |
| Bouillon de bœuf | Bouillon de bœuf préparé |
| Eau chaude en cours de cuisson, Eau si besoin pour détendre | Eau |

Le nom de recette est conservé dans `recipe_ingredients.display_name`. Les qualificatifs de cuisson et de service restent aussi dans les consignes de recette. Aucun changement d’unité, de quantité ou de QS des recettes n’est induit par le nom canonique.

Le seed préfère l’identifiant déjà associé au nom canonique, puis un identifiant d’alias existant. Les références de `recipe_ingredients` et `rule_profiles` sont redirigées vers cet identifiant. Les liens allergènes existants sont conservés et réunis ; un conflit avec un statut `none` fait échouer la transaction plutôt que d’effacer silencieusement des informations.

Chaque doublon retiré du catalogue actif conserve sa ligne et son identifiant avec `active=false` et `superseded_by_id`. Les alias textuels sont stockés dans `ingredient_aliases`. Les chaînes de remplacement et les alias visant une ligne inactive sont refusés.

Les produits suivants restent distincts : œufs liquides/coquille, crème liquide/épaisse, pommes de terre fraîches/sous vide, thon/saumon, moutarde forte/ancienne. Le saumon générique n’est pas assimilé au saumon sans peau, ni la brunoise générique à une composition carotte/oignon/céleri. Les ingrédients génériques ambigus restent `review_required` quand leur composition n’est pas définie.

## Unités et arrondis

Les unités d’import `piece` et `sheet` sont converties en `pièces` et `plaques`, compatibles avec le moteur existant. Les unités par défaut du catalogue n’imposent pas les unités des lignes de recette : une crème par défaut en L peut rester pesée en kg dans une quiche, sans conversion masse/volume automatique.

Le profil d’affichage existant `v0-display` est rattaché aux ingrédients par défaut. Un profil déjà explicitement rattaché n’est pas écrasé. Aucune nouvelle surcharge n’est créée : kg/L au dixième, g/ml à la dizaine, pièces et plaques entières. Les calculs exacts restent indépendants de l’affichage.

## Fichiers et application

| Fichier | Rôle |
|---|---|
| `persistence/ingredients-v1.json` | Les 156 ingrédients demandés, statuts et codes allergènes |
| `persistence/normalize-ingredient.js` | Fonction de normalisation pour les imports |
| `persistence/generate-ingredient-seeds.js` | Alias, compléments conservés et génération SQL reproductible |
| `persistence/003_ingredient_catalog_structure.sql` | Évolution des statuts, clés normalisées, alias et intégrité |
| `persistence/004_general_ingredients.sql` | Import du catalogue général et des compléments |
| `persistence/ingredients.test.js` | Tests du catalogue, des allergènes, de la déduplication et des calculs |

`migrate.js` applique désormais les versions 001 à 004 et saute celles déjà enregistrées. Sur une base ayant déjà 001/002, seules 003/004 sont exécutées. Une seule migration à la fois sur une connexion réservée. Les migrations sont transactionnelles ; aucune table de service n’est recréée.

Le seed 004 est également rejouable sans créer de doublon ni supprimer de liens allergènes. Il réapplique toutefois ses métadonnées de référence (nom, unité par défaut, catégorie et statut) : ne pas le rejouer sans examen sur un catalogue modifié en exploitation. Ajouter une nouvelle migration pour les corrections après déploiement.

```sh
node persistence/migrate.js
```

Cette commande nécessite `pg` et une `DATABASE_URL` configurée. Pendant cette tâche, l’application des migrations est vérifiée dans une copie PostgreSQL embarquée sur disque ; aucune connexion à un serveur de production n’a été fournie ni utilisée.

La recherche d’un nom ou alias passe par `repository.findIngredient(name)`. Elle renvoie les codes allergènes et le statut séparément ; un tableau vide avec `review_required` ne signifie pas absence d’allergènes.

## Ajouter un ingrédient

1. Choisir un nom précis et rechercher ses variantes avec `findIngredient` avant de créer un identifiant.
2. Réutiliser l’ingrédient si le produit est réellement équivalent ; sinon conserver deux articles distincts et leurs qualificatifs.
3. Renseigner unité, catégorie autorisée, statut explicite et profil d’arrondi par défaut.
4. Lier les allergènes au référentiel dans `ingredient_allergens`. Pour une composition non vérifiée, conserver `review_required`, même si certains allergènes sont déjà connus.
5. Ajouter les synonymes confirmés dans `ingredient_aliases`, sans les utiliser pour fusionner des variantes différentes.
6. Appliquer l’ajout dans une transaction avec tests de cohérence. Après déploiement, créer une nouvelle migration au lieu de réécrire les migrations historiques.

Pour faire évoluer le catalogue de travail avant déploiement, modifier le JSON et les alias/compléments explicites, puis régénérer le SQL avec `node persistence/generate-ingredient-seeds.js`. Le générateur vérifie les doublons et statuts incohérents ; les contraintes SQL recontrôlent les relations au commit.

## Validation

La suite conserve les tests métier V0 et le test d’intégration figé aux migrations 001/002. Les nouveaux tests migrent réellement une base déjà remplie, conservent tous ses identifiants, testent un doublon orthographique préexistant, puis ferment et rouvrent les données sur disque.

Les dix associations demandées sont vérifiées, ainsi que les 14 codes, les 166 entrées actives, les alias, les variantes distinctes, les statuts incomplets et les rejets de données incohérentes. Un second import ne duplique pas le catalogue.

Les quatre services sont comparés avant/après enrichissement sur tous leurs effectifs de référence. Seules les listes d’allergènes sont intentionnellement enrichies ; portions, quantités exactes, affichages, rendements, production et allocations doivent rester strictement identiques. Les listes d’allergènes sont vérifiées séparément, notamment Gluten pour la semoule et Gluten/Lait/Œufs pour les quiches.

```sh
node --test tests.js persistence/integration.test.js persistence/ingredients.test.js
```

Aucune interface PWA, aucun fournisseur ni trace éventuelle n’est ajouté.
