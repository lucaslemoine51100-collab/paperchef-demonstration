# Documents de commande — V0

## Architecture commune

Un seul pipeline, quel que soit le périmètre :

`selections → calculateOrderServices → conversions d’achat existantes → aggregateOrders → orderSheetViewModel → renderOrderSheet → exportOrderSheetPdf`.

Aucun moteur de commande spécifique midi/soir/semaine. Aucun changement dans engine.js, les recettes, les conversions, les catégories ou les quantités. Le repository concret est injecté dans le pipeline ; la présentation ne dépend pas du SQL. Le ViewModel prend l’ordre agrégé et les métadonnées des services. Le template reçoit uniquement des libellés, quantités affichées et blocs de présentation ; aucune formule culinaire ou conversion dans HTML/CSS.

Modules : `order-sheets/pipeline.js`, `view-model.js`, `template.js`, `sheet.css`, `icons.js`, `export-pdf.js`, `tests.js`.

## Sélection et périmètre

```js
const {generateOrderSheet} = require('./order-sheets/pipeline');
const sheet = await generateOrderSheet(repository, [
  {serviceId: 'service-reference', headcount: 170},
  {serviceId: 'lasagnes', headcount: 150}
], {scope: 'multi_service_portrait'});
```

La sélection n’est pas modifiée. Effectif absent : effectif persistant du service. Planning absent : date et type de repas lus en base ; si non renseignés, un libellé explicite le signale. Pour une occurrence planifiée d’un service de référence, la sélection peut fournir `serviceDate` (YYYY-MM-DD) et `mealType` (`lunch`/`dinner`) : ces métadonnées de planning n’écrivent pas dans la base et ne changent aucun calcul. `planningSource` indique leur origine. Les doublons d’un service de référence sont des occurrences distinctes, tracées par `selectionIndex`.

Modes déterministes :

| Scope | Orientation | Défaut |
|---|---|---|
| single_service | A4 portrait | 1 sélection |
| multi_service_portrait | A4 portrait | 2 sélections |
| weekly_landscape | A4 paysage | 3 sélections ou plus |

Un scope explicite peut demander le paysage pour un autre ensemble, sans aucune condition « 14 services ». `single_service` exige une seule sélection. Un multi_service_portrait peut couvrir des services de jours différents : titre « Services sélectionnés ». Une semaine de démonstration compte 14 occurrences, mais le moteur accepte d’autres nombres. Le total de couverts est additionné en BigInt et conservé en chaîne décimale ; aucune somme de quantité affichée.

## OrderSheetViewModel

Expose scope, titre, orientation, dateRange, rangeLabel, serviceCount, services, covers.total/byService, catégories avec couleurs/icônes/isEmpty, pages et hasUnquantified.

Chaque ligne conserve l’identifiant du produit, nom normalisé, quantité affichée fournie par l’agrégation, fraction exacte en unité canonique et sources complètes. Les contributions sont enrichies avec le jour et repas de l’occurrence sélectionnée. Le besoin culinaire des conversions reste dans `sources[].culinary_requirement` ; il ne paraît pas sur le PDF principal. Les fichiers JSON de démonstration contiennent le ViewModel complet, provenance comprise.

QS seul : `QS`. Une quantité partielle connue avec contributions QS : `quantité + QS`. Le pied de page explique qu’un besoin reste non quantifié ; aucun poids n’est inventé. Le formateur de présentation choisit g sous 1 kg et ml sous 1 L, en comparant la fraction exacte au seuil avant arrondi. À partir de 1, les unités kg/L sont affichées au dixième. Les g/ml sont arrondis à la dizaine ; les comptes à l’entier. `exactQuantity` et `canonicalUnit` restent inchangés, `displayUnit` indique l’unité visible. Un seuil exact de 0,999 kg donne 1000 g affichés : l’unité est choisie avant arrondi.

## Présentation et pagination

Le même HTML/CSS fournit les variantes portrait/paysage : deux colonnes en portrait, trois en paysage. Catégories dans l’ordre officiel en lecture de colonne en colonne, de haut en bas : Crémerie, Viande, Poisson, Surgelé, Fruits et légumes frais, Épicerie. Catégories vides conservées dans le ViewModel avec isEmpty, omises des pages rendues.

Couleurs : violet, rouge, bleu, turquoise, vert, orange. Icônes SVG au trait cohérentes, imprimables et locales, sans téléchargement ni police d’icônes. Surgelé distinct du Poisson. Produits à 11,5 pt ; quantités en gras à 12,5 pt. Marges 8 mm, échelle d’export fixe à 1. Aucune réduction automatique des polices.

Une couche de présentation répartit les catégories selon leur nombre de lignes et la longueur des libellés ; aucune hauteur fixe identique des six catégories. Une longue catégorie peut être scindée en tableaux complets marqués « suite », à une frontière de ligne. Aucune perte ni duplication de produit ; aucune ligne de tableau coupée. Pour des périmètres plus grands, plusieurs pages sont possibles avec titre et numéro répétés. Les trois démonstrations actuelles tiennent sur une page chacune.

La pagination estime le nombre de lignes à partir des libellés et d’un budget conservateur. L’export vérifie ensuite la hauteur et la largeur réelles de chaque page dans le navigateur. Si une page dépasse, il échoue explicitement afin d’adapter la pagination ; il ne réduit pas le texte en silence. Des libellés exceptionnellement longs ou de nouvelles polices peuvent nécessiter un ajustement de présentation. Les tests volumétriques vérifient la conservation de 200 lignes sur plusieurs pages.

HTML responsive : colonnes empilées à moins de 700 px, titres et tableaux lisibles. Vérifié à 390, 768 et 1280 px pour les trois démonstrations.

## Export PDF

```js
const {exportOrderSheetPdf} = require('./order-sheets/export-pdf');
await exportOrderSheetPdf(
  sheet.html, outputPath, chromium,
  sheet.viewModel.orientation,
  {channel: 'msedge'}
);
```

Playwright/chromium est injecté ; le navigateur appartient à la couche de présentation. Export attend les polices, conserve les couleurs, applique le @page déterminé par le scope et contrôle les dimensions. Les exemplaires utilisent Edge installé et Arial locale.

## Exemplaires livrés

Dans `commandes/`, chaque document possède PDF, HTML responsive et JSON :

- `commande-un-service` : Carbonnade/Limande, lundi midi, 100 couverts, une page A4 portrait.
- `commande-deux-services` : Carbonnade/Limande 170 à midi + Lasagnes 150 le soir, lundi, total 320, une page A4 portrait.
- `commande-semaine` : planning de démonstration du 5 au 11 octobre 2026, rotation des quatre services persistés, midi 170 et soir 150 chaque jour, 14 occurrences et 2 240 couverts, une page A4 paysage.

Ces dates sont des données de démonstration explicites, pas des dates inventées dans le template ou enregistrées sur les services de référence. Tous les ingrédients viennent des services persistés et de leurs règles existantes.

## Vérifications

53 tests réussis, dont les 50 précédents. Tests supplémentaires : scopes 1/2/semaine, nombre de services variable, orientation, total couverts, catégories dans l’ordre, vides masquées, pagination sans perte, QS, échappement HTML, affichage sans recalcul, pipeline depuis PostgreSQL, bouillons poudre, absence d’eau, fusion et traçabilité des occurrences.

```sh
node --test tests.js persistence/integration.test.js persistence/ingredients.test.js technical-sheets/tests.js orders/tests.js orders/purchase-categories.test.js orders/purchase-conversion.test.js order-sheets/tests.js
```

Les trois PDF ont été vérifiés visuellement après rendu en images : dimensions A4, une page chacun, aucun bloc coupé ou débordement. Aucun fournisseur, conditionnement, prix ou interface PWA complète n’est ajouté.

## Correction des unités

`order-sheets/quantity-format.js` applique uniquement le format d’affichage depuis les fractions exactes, à la frontière du ViewModel. Il ne touche pas à l’agrégation, aux conversions ou aux besoins culinaires. Le template continue d’afficher un libellé fourni. Tests des dix exemples demandés, des seuils, des moitiés, des QS et des neuf références de la commande Carbonnade/Limande. L’icône d’en-tête est une liste sur clipboard, indépendante des catégories ; les icônes de catégorie sont conservées.

Migration 006 : normalisation préalable selon purchase_unit enregistré sur chaque ingrédient. Deux conventions kg→L pour Lait et Crème liquide ; semaine sans doublons d’unité. Voir PURCHASE_UNITS.md. La suite complète compte désormais 57 tests réussis.

Finition paysage : date française dynamique (mois et années chevauchants inclus), continuation SUITE avec bandeau plus léger, ingrédients 12 pt et quantités 13 pt, lignes légèrement plus hautes. Feuille landscape.css chargée uniquement pour le paysage ; les HTML/PDF portrait sont inchangés. Les données du ViewModel semaine restent strictement identiques hors nouveau libellé de période. 60 tests réussis.
