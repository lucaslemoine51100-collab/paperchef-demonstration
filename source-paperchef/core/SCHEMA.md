# Schéma relationnel de l’application de restauration collective

## Extension ingrédients V1

Le modèle initial décrit ci-dessous correspond aux migrations 001/002. Les migrations suivantes 003/004 ajoutent la base ingrédients générale : statuts `known`, `none`, `review_required`, clé de nom normalisée, alias et liens de remplacement. La documentation actualisée de ce catalogue est [INGREDIENTS.md](INGREDIENTS.md). Les anciennes mentions `unreviewed`/`reviewed` et seeds incomplets ci-dessous décrivent l’état avant migration V1.

Le runner applique désormais les versions 001 à 004 ; le test d’intégration historique peut cibler 002, tandis que le test V1 migre une base existante jusqu’à 004. Les migrations historiques restent inchangées. Les 16 tests métier, les 5 tests d’intégration initiaux et les 7 tests V1 totalisent 28 tests.

PostgreSQL est retenu. Les migrations vivent dans le schéma SQL isolé `catering`. Le moteur V0, ses quatre services et ses règles de calcul sont conservés ; `engine.js` n’a pas été modifié pour cette persistance.

## Relations

```text
weeks 1 ── N services
services 1 ── N components N ── 1 recipes
components 1 ── N component_categories
recipes 1 ── N recipe_ingredients N ── 1 ingredients
ingredients N ── N allergens (ingredient_allergens)

services 1 ── N shared_preparations N ── 1 recipes
shared_preparations 1 ── N shared_preparation_allocations N ── 1 components
components 1 ── N component_preparation_inputs N ── 1 allocations

services 1 ── N service_rule_bindings N ── 1 rule_profiles
recipes 1 ── N recipe_rule_overrides N ── 1 rule_profiles
components N ── 0..1 production_units
rule_profiles N ── 0..1 production_units / ingredients
services, recipes, ingredients N ── 0..1 rounding_profiles
```

Toutes les relations métier utilisent des clés étrangères avec suppression `RESTRICT`. Aucune cascade ne détruit des recettes ou des ingrédients utilisés. Les identifiants sont des clés texte stables ; la future application peut utiliser des UUID sous forme de texte, sans imposer une extension PostgreSQL.

## Ajustements nécessaires au modèle proposé

1. **Allocation exacte :** `8/12` et `4/12` ne sont pas des décimales finies. Le ratio est stocké en `ratio_numerator` et `ratio_denominator`, avec `reference_quantity` exacte. Un contrôle différé vérifie l’équivalence avec le rendement. Aucun `0.666667` n’entre dans le moteur.
2. **Quiche par plaque :** `recipes.reference_production_units` complète les bases par portions et par effectif.
3. **Prélèvement interne :** la béchamel d’un plat ne constitue pas un ingrédient acheté. Le lien vers l’allocation est stocké dans `component_preparation_inputs`, séparément de `recipe_ingredients`.
4. **Profils composés et surcharges :** une unité de production et une base d’ingrédients peuvent former un même profil. `service_rule_bindings` groupe plusieurs règles sous une clé ; `recipe_rule_overrides` porte les remplacements spécifiques.
5. **Classement indépendant :** `generic_rule_key` est explicite. Les catégories n’induisent aucun grammage. Les marqueurs Plat complet et Finition restent dans `classification_tags`, sans élargir les quatre catégories fonctionnelles proposées.
6. **Allergènes inconnus :** `ingredients.allergen_status` distingue une composition non revue d’une composition effectivement revue. L’absence de lien allergène ne prouve pas l’absence d’allergène.

Ces adaptations concernent le stockage et son adaptateur. Aucun changement des formules validées, aucune refonte du moteur, aucun fournisseur ni champ de traces éventuelles.

## Tables principales

### weeks

Une semaine de menus : nom, dates de début et fin, statut `draft`, `validated` ou `archived`, horodatages. La date de fin doit suivre la date de début. Une semaine peut être préparée sans encore contenir de service ; aucune semaine fictive n’est créée pour les références.

### services

Un repas : lien facultatif vers une semaine, nom, date facultative, `lunch`/`dinner` facultatif, effectif réel positif, effectif de référence, mode de portions et profil d’affichage.

En mode `split`, les deux groupes, ratios et cible d’égalité sont obligatoires. Les ratios exacts sont entre 0 et 1 et totalisent 1. Les trois services mixtes seedés utilisent viande 0,7 et poisson 0,3 avec égalité au poisson. Ces valeurs viennent du stockage et ne sont pas figées dans l’adaptateur.

En mode `all`, seul le groupe végétarien est renseigné ; ratios et cible d’égalité sont absents. Ce schéma couvre le fonctionnement actuel, sans service viande seule.

Le stockage d’un repas exige `headcount > 0`. Le moteur conserve séparément son cas zéro, utile aux tests et calculs à vide. Les tests d’intégration chargent un service positif puis peuvent appeler le moteur avec zéro. L’effectif et les bases sont plafonnés à l’entier sûr JavaScript pour leur passage à la V0.

### components

Un composant nommé dans un service : identifiant technique global, `domain_key` stable et unique dans le service, nom, recette facultative, groupe de portions, unité de production, profil éventuel, ordre et activation.

`portion_group='all'` est converti en `scope='covers'`. Les groupes `meat` et `fish` suivent les portions réparties ; `vegetarian` représente l’effectif entier dans le scénario actuel. Les catégories multiples sont relationnelles. `linked_component_id` garantit un lien au sein du même service, utilisé pour le beurre blanc.

`profile_key` et `generic_rule_key` sélectionnent les règles explicitement. `rule_profile_id` peut désigner une règle unique ; lorsque `profile_key` désigne un groupe de règles, la clé est autoritaire. `production_unit_id` constitue une surcharge explicite au niveau du composant. `service_sauce_key` choisit une alternative de sauce.

Une recette peut être absente lors de la planification. L’adaptateur refuse alors de calculer ce composant : il ne crée pas une recette vide. Les composants inactifs ne sont pas présentés dans le résultat chargé.

### component_categories

Plusieurs lignes par composant : `Protein` avec `Meat`, `Fish` ou `Vegetarian`, ou `Starch`, `Vegetable`, `Sauce` sans sous-catégorie. L’ordre est explicite, et les doublons sont interdits même lorsque la sous-catégorie est nulle.

L’adaptateur restitue les catégories françaises attendues par la V0. Un classement Lasagne = Protein/Meat + Starch + Vegetable n’ajoute jamais automatiquement un grammage de légumes.

### recipes

Référence de fabrication indépendante du service : nom, mode, base, rendement éventuel, profil d’arrondi éventuel, notes et étapes. Les bases sont exclusives :

| Mode | Base requise | Usage |
|---|---|---|
| `by_portions` | `reference_portions` | Protéines et recettes suivant une portion répartie |
| `by_headcount` | `reference_headcount` | Accompagnements pour tous les couverts |
| `by_production_unit` | `reference_production_units` | Quiches par plaque produite |
| `shared_preparation` | `reference_headcount` | Béchamel commune |

Une base positive est requise, les deux autres restent nulles. `yield_value` et `yield_unit` sont tous deux absents ou présents. Un rendement n’est pas la somme des ingrédients : 12 L de béchamel et 1,5 L de vinaigrette sont des cibles de recette.

`notes` et `steps` sont des tableaux JSON. Les consignes V0 sont importées dans `notes` ; `steps` est vide tant qu’aucune séquence structurée n’est définie. La présentation actuelle ne rend pas encore ces étapes structurées.

### recipe_ingredients

Ligne de recette avec ingrédient normalisé, libellé de recette conservé (`display_name`), quantité de référence, unité, statut QS, base descriptive et ordre.

`quantity` est un `NUMERIC` sans précision imposée : une décimale finie est stockée exactement, sans arrondi à une échelle SQL. L’adaptateur lit `quantity::text`, jamais un flottant JavaScript. Zéro est autorisé, les valeurs négatives et non finies sont refusées. QS exige quantité nulle et unité QS ; une quantité chiffrée exige l’inverse.

`quantity_basis` précise la référence recette ou unité de production. Le mode de recette et sa base sont les sources de calcul ; ce champ ne redéfinit pas une formule indépendante par ingrédient. L’ordre doit être unique dans la recette et ne pas entrer en conflit avec un prélèvement interne du composant.

### ingredients

Catalogue : identifiant, nom normalisé unique, unité par défaut, catégorie d’achat, conditionnement JSON éventuel, profil d’arrondi éventuel, activation, état de revue allergènes et horodatages.

Les six catégories d’achat autorisées sont `Meat`, `Fish`, `Frozen`, `FreshProduce`, `Dairy`, `Grocery`. Les classifications initiales des seeds sont des propositions déduites des noms, à valider contre les produits effectivement utilisés ; aucun conditionnement n’est inventé.

Le nom normalisé du Grana est commun aux usages béchamel et finition ; le libellé de chaque ligne maintient cette distinction. Les ingrédients de garniture et de sauce restent des quantités distinctes, même s’ils partagent un article du catalogue. L’adaptateur conserve l’unité de la ligne recette, pas l’unité par défaut du catalogue.

### allergens et ingredient_allergens

`allergens` contient les 14 groupes du référentiel européen ; `ingredient_allergens` est l’unique relation stockant la présence confirmée dans un ingrédient. Aucun allergène n’est saisi manuellement sur une recette, un composant ou un service.

La référence est l’annexe II du [règlement (UE) 1169/2011](https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32011R1169). Les groupes sont identifiés par des codes stables. Ce référentiel ne remplace pas l’examen de la composition du produit : les exceptions et conditions prévues dans l’annexe restent à considérer lors de la revue des ingrédients.

La liste des 14 groupes a également été vérifiée sur la [page officielle de la Commission européenne sur les allergies](https://food.ec.europa.eu/food-safety/campaign-2026/allergies_en).

Les seeds n’inventent pas de compositions : seuls Poisson et Gluten, explicitement renseignés pour la limande meunière en V0, sont importés. Tous les ingrédients commencent `unreviewed`, y compris la limande dont la liste peut être incomplète. L’agrégation est fonctionnelle ; elle ne constitue pas encore une liste complète validée pour chaque service.

Les vues calculées sont :

- `recipe_allergens` : ingrédients directs et ingrédient généré par une surcharge de recette.
- `component_allergens` : recette, prélèvements de préparations communes et règle de quantité effective selon la priorité.
- `service_allergens` : union des composants actifs.

La recette générique seule ne peut déterminer le profil d’un composant : les règles contextuelles appartiennent à la vue du composant. L’adaptateur agrège également les allergènes dans les objets métier, et fournit `metadata.allergensComplete` et les identifiants non revus.

### production_units

Unité physique, capacité positive en portions, stratégie `ceil`, sous-unités facultatives. Lasagnes : Bac GN 1/1, 10 portions, 4 plaques. Quiches : Plaque, 10 portions, sans sous-unité.

Le nombre produit est calculé, pas stocké. Les ingrédients des lasagnes restent sur les portions ; ceux des quiches suivent les plaques. Le mode `by_production_unit` exige une unité sur le composant. Aucune branche dédiée aux quiches n’est ajoutée au moteur.

### shared_preparations

Association entre un service et une recette commune : clé de domaine, effectif de référence et ordre. La recette doit être `shared_preparation` et sa base identique à celle de l’association.

La béchamel est fabriquée une seule fois. Le résultat du moteur garde une liste `preparations` distincte des composants consommateurs. Les quantités d’achat ne doivent pas additionner les prélèvements à ses ingrédients.

### shared_preparation_allocations

Lien vers une préparation et un composant du même service. Ratio rationnel exact, mode `fixed_ratio`, quantité et unité de référence, ordre.

Pour la béchamel : ratio 8/12 et quantité 8 L pour bolo ; 4/12 et 4 L pour saumon. Les fractions ne doivent pas être simplifiées pour être valides ; elles sont vérifiées par produit croisé. Les quantités allouées doivent totaliser le rendement.

Le mode fixe sur l’effectif de référence est actuellement le seul exécutable. Les futurs modes proportionnels aux portions ou personnalisés nécessiteront une migration et un adaptateur ; ils ne sont pas acceptés puis ignorés. À 103 couverts, les allocations restent exactement 8,24 L et 4,12 L, conformément à la décision V0.

### rule_profiles

Une règle typée, pas un profil opaque contenant tout le service. Champs : nom, type, quantité/unité/base éventuelles, priorité, unité de production ou ingrédient généré éventuel, configuration complémentaire.

Les types correspondent aux abstractions V0 : `portionQuantity`, `targetYield`, `production`, `ingredientBasis`, `sauceRule`. `value`, `unit`, `basis` et `basis_count` stockent les quantités de référence. Le JSON ne contient que les métadonnées comme le nom de l’ingrédient généré ou le choix de base ; les quantités principales sont en colonnes exactes.

`priority=1` signifie spécifique recette, 2 profil, 3 générique. Les liaisons et les contrôles garantissent ce classement ; l’adaptateur restitue la résolution par règle entière du moteur. Les valeurs numériques ne pilotent pas un tri arbitraire qui changerait la priorité validée.

Exemples seedés : règle légumes 120 g/couvert, surcharge salade 50 g/couvert, profil vinaigrette 15 ml/couvert, profils de production et quatre alternatives de sauce du service initial. Frites et semoule restent encodées par leur recette de référence exacte ; aucun profil redondant ne leur est ajouté.

### rounding_profiles

Pas d’affichage kg/L/g/ml, stratégie entier des pièces et moitié supérieure. Les pas sont strictement positifs. Le profil seedé conserve 0,1 kg/L et 10 g/ml.

La base permet de décrire d’autres pas, mais le moteur V0 n’exécute que la politique validée. L’adaptateur rejette un profil différent, au lieu de l’ignorer ou de modifier les calculs. Une surcharge d’affichage future nécessitera une évolution explicite du domaine. Le contrôle des pas est lui-même exact, sans conversion flottante.

## Tables de liaison complémentaires

| Table | Rôle |
|---|---|
| `component_preparation_inputs` | Libellé et ordre d’un prélèvement lié à une allocation du composant |
| `service_rule_bindings` | Groupement explicite des règles par clé et rôle `generic`, `profile`, `sauce` |
| `recipe_rule_overrides` | Une surcharge par type de règle et par recette |
| `schema_migrations` | Versions SQL appliquées : 001 et 002 |

## Stocké et calculé

| Stocké | Calculé à chaque exécution |
|---|---|
| Effectif réel et bases de référence | Portions entières viande/poisson/végétariennes |
| Ratios exacts et cible d’égalité | Nombre de bacs/plaques et capacité produite |
| Quantités de référence et QS | Ingrédients exacts redimensionnés |
| Unités, profils, surcharges | Rendements et allocations pour l’effectif |
| Ingrédients et liens allergènes confirmés | Union des allergènes des recettes/composants/services |
| Politique d’affichage | Chaînes arrondies d’affichage |

Aucune quantité arrondie ni quantité de production calculée n’est persistée comme référence. Les rapports Markdown existants restent des sorties, sans rôle d’entrée au calcul.

## Intégrité et limites

Les contraintes locales vérifient bases exclusives et positives, effectifs, ratios, unités autorisées, QS, capacités, sous-unités cohérentes, pas d’affichage et unicité des ordres.

Des triggers différés vérifient à la fin de la transaction : cohérence ratio/volume/rendement, somme des allocations, bases de préparation, destinataires des prélèvements, priorités de liaisons, clés explicites de règles et compatibilité des recettes de composant. Ils permettent d’importer un service complet dans une même transaction. Toute erreur annule la migration ou l’import.

Les horodatages `updated_at` sont entretenus automatiquement. Les dates de semaine sont cohérentes ; la contrainte de date de service dans sa semaine reste une validation applicative à prévoir. Les notes/étapes et conditionnements sont contrôlés par type JSON, pas encore par un schéma JSON détaillé.

Les références SQL ne représentent pas encore un historique versionné des recettes. Modifier une recette partagée peut affecter plusieurs services : la future politique de publication devra choisir copie, révision ou version immuable. L’import des seeds utilise des recettes distinctes par service pour figer les quatre références.

Les règles sont typées, mais les combinaisons complexes restent à valider dans l’application : l’adaptateur rejette une base de recette incompatible avec le profil. Une composition allergène incomplète est explicitement signalée. Ces limites ne changent aucun scénario V0.

## Repository et adaptateur

```text
PostgreSQL
  → PostgresRepository (SQL paramétré, lecture cohérente en transaction)
  → toDomain (noms, bases, unités, profils, allocations, agrégation allergènes)
  → createCalculator (catalogue isolé fourni au code existant du moteur)
  → calculate(effectif, serviceId)
  → présentation
```

Interface fournie : `getService(id)`, `getRecipe(id)`, `getIngredients(recipeId)`, `getSharedPreparations(serviceId)` et `loadService(id)` pour une lecture atomique complète. Le repository reçoit un client offrant `query(sql, params)`, sans imposer une connexion globale. Les paramètres sont liés, jamais concaténés à partir de l’entrée utilisateur.

`loadService` utilise `REPEATABLE READ READ ONLY`. Avec le pilote `pg`, fournir une connexion réservée (`Client` ou `pool.connect()`), pas `pool.query()` partagé. Il ne faut pas appeler cette méthode depuis une transaction déjà ouverte.

Le moteur actuel importe son registre local et n’expose pas encore d’injection. Pour respecter la demande de ne pas modifier `engine.js`, `createCalculator` charge **le même fichier** dans un module isolé, dont l’unique import est remplacé par le catalogue chargé. Il ne réécrit pas les formules, ne modifie pas le registre global et ne lit aucun SQL. Le fichier est du code local de confiance, pas du code fourni par la base. Une future API d’injection publique pourra remplacer ce pont sans changer les calculs.

```js
const { PostgresRepository } = require('./persistence/repository');
const { loadCalculator } = require('./persistence/adapter');
const repository = new PostgresRepository(client); // connexion pg réservée
const loaded = await loadCalculator(repository, 'quiches');
const result = loaded.calculate(loaded.metadata.headcount, loaded.service.id);
```

## Migrations, seeds et exécution

| Fichier | Usage |
|---|---|
| `persistence/001_schema.sql` | Tables, contraintes, triggers, vues et migration 001 |
| `persistence/002_reference_seeds.sql` | Référentiel et quatre services, migration 002 |
| `persistence/generate-seeds.js` | Import reproductible des données V0 vers le SQL des seeds |
| `persistence/migrate.js` | Applique les migrations absentes dans l’ordre |
| `persistence/repository.js` | Lecture des données relationnelles |
| `persistence/adapter.js` | Conversion vers le catalogue V0 et pont isolé vers le moteur |
| `persistence/integration.test.js` | Exécution réelle du SQL et comparaison de résultats |
| `persistence/package.json` | Dépendance de test PGlite et pilote pg optionnel |

Les migrations sont transactionnelles. Le runner lit `schema_migrations` et ne réinsère pas les seeds déjà appliqués. Les fichiers SQL bruts sont destinés à une application unique sur une base neuve ; les réexécuter directement provoque une erreur au lieu d’écraser des données. Exécuter un seul processus de migration à la fois, conserver les migrations appliquées et ajouter une nouvelle version pour les changements futurs.

Sur une base PostgreSQL dédiée existante, avec `psql` :

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f persistence/001_schema.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f persistence/002_reference_seeds.sql
```

Ou installer `pg` dans l’environnement de l’application puis exécuter `node persistence/migrate.js` avec `DATABASE_URL` configurée. Aucune base distante n’a été créée ou modifiée pendant cette tâche.

Pour les tests, depuis `persistence/`, installer les dépendances de développement puis lancer `npm test` (ou l’équivalent pnpm). La suite utilise PGlite, moteur PostgreSQL embarqué, avec stockage sur disque dans `work/persistence-tests/`. Aucun serveur ni accès à une base de production n’est nécessaire. Dans cet espace de travail, cette dépendance a déjà été installée dans le dossier de test `work/`.

## Validation réalisée

Le test applique les deux migrations, relance le runner pour vérifier qu’il ne duplique pas les seeds, ferme la base puis la rouvre depuis le disque. Les objets métier passent ensuite par le repository et l’adaptateur avant de calculer.

Les résultats complets (portions, ingrédients exacts, affichages, rendements, production, allocations et allergènes connus) sont comparés strictement à la V0 :

- Carbonnade/Limande : 0, 15, 100, 160, 170, 181.
- Couscous : 0, 80, 100, 160.
- Lasagnes et quiches : 0, 15, 100, 160, 181, 103.

Les tests rejettent notamment effectif nul persisté, ratio incohérent, groupes manquants, capacité nulle, stratégie inconnue, QS chiffré, quantité négative, allocation incomplète et lien inter-service. Ils vérifient l’agrégation d’un allergène ajouté au lait vers les deux lasagnes, puis le retirent du jeu de test. Une modification stockée du ratio quiche vers 60/40 est prise en compte sans affecter le catalogue V0 global.

**Résultat : les 16 tests métier existants et les 5 tests d’intégration passent (21 au total).** Le SQL a été exécuté sur PostgreSQL embarqué, pas sur un serveur PostgreSQL administré ; un test sur le serveur de déploiement devra précéder la mise en production.

Il n’y a aucune interface PWA, aucun design A4, aucun nouveau service métier, aucun fournisseur ni traces allergènes dans cette livraison.
