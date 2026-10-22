# Fiches techniques A4 dynamiques

Un gabarit générique HTML/CSS consomme les composants d’un service. Le fichier `engine.js` reste inchangé. Les deux exemples livrés concernent Carbonnade/Limande, à 100 et 160 couverts.

```text
service PostgreSQL
 → PostgresRepository.loadService
 → adaptateur toDomain + catalogue isolé
 → moteur V0 calculate
 → TechnicalSheetViewModel
 → gabarit HTML/CSS
 → export PDF par navigateur
```

## Responsabilités

| Fichier | Rôle |
|---|---|
| `technical-sheets/pipeline.js` | Charge le service, appelle le moteur et assemble le résultat |
| `technical-sheets/view-model.js` | Prépare les libellés, couleurs et blocs sans redimensionner |
| `technical-sheets/template.js` | Rend les données, échappe les textes et structure le HTML |
| `technical-sheets/sheet.css` | A4 portrait, impression et adaptation aux écrans |
| `technical-sheets/export-pdf.js` | Exporte le HTML avec Playwright/Chromium injecté |
| `technical-sheets/tests.js` | Tests du pipeline, des quantités, couleurs, variantes et snapshot |
| `technical-sheets/snapshots/carbonnade-100.html` | Référence HTML du rendu à 100 couverts |
| `fiches/` | PDF, HTML autonomes et view models JSON des deux effectifs |

Le view model conserve `exact` pour le contrôle et reprend le champ `display` du moteur comme `displayQuantity`. Cette chaîne comprend déjà l’unité ; `displayUnit` reste une information structurée, sans ajout d’unité supplémentaire par le template. Le template ne lit pas `exact` et ne multiplie ni ne convertit aucune quantité.

Les étapes structurées `recipes.steps` sont reprises si elles existent. Dans les seeds actuels elles sont vides : seules les consignes stockées dans `notes` sont affichées sous « Repères de préparation ». Aucune méthode de préparation n’a été inventée.

## Utilisation dans l’application

```js
const { PostgresRepository } = require('./persistence/repository');
const { generateTechnicalSheet } = require('./technical-sheets/pipeline');
const repository = new PostgresRepository(client); // connexion PostgreSQL réservée
const sheet = await generateTechnicalSheet(repository, 'service-reference', 160);
// sheet.result : calcul métier ; sheet.viewModel : présentation ; sheet.html : document
```

L’effectif fourni déclenche un nouveau calcul depuis les références exactes chargées. S’il est omis, le pipeline utilise l’effectif stocké. Les HTML livrés sont les sorties de ce pipeline : leur bouton « Imprimer / PDF » ouvre l’impression du navigateur ; modifier l’effectif nécessite de rappeler le pipeline. Aucun formulaire PWA ou serveur d’interface n’est développé.

Les exemples ont été produits à partir d’une base PostgreSQL embarquée persistante, alimentée par les migrations 001 à 004 et lue via le repository existant. Aucun serveur PostgreSQL distant n’a été fourni ou modifié.

## Rendu générique

Le nombre de composants est variable. Les préparations communes sont rendues une seule fois, avec ingrédients totaux et allocations nommées. Les prélèvements dans les plats sont identifiés comme tels. Les unités produites et sous-unités proviennent du résultat moteur.

Les couleurs viennent exclusivement des catégories fonctionnelles : viande rouge, poisson bleu, végétarien vert foncé, féculent orange, légume vert et sauce violet. Pour un composant multicatégorie, la catégorie Protéine est prioritaire pour la couleur ; toutes ses catégories restent affichées.

Les allergènes sont ceux agrégés par l’adaptateur depuis les ingrédients stockés. Aucun référentiel manuel n’existe dans le gabarit. Les ingrédients directs `review_required` sont signalés dans leur bloc ; une indication globale reste visible si le service contient une composition non vérifiée, notamment dans une préparation ou une règle génératrice.

## A4 et PDF

`@page { size: A4 portrait; margin: 10mm; }` fixe le format. La feuille utilise deux colonnes, sans hauteur fixe ni masquage du contenu. Les blocs utilisent `break-inside: avoid` et les lignes évitent les coupures. `@media print` retire l’interface d’impression et conserve les couleurs.

```js
const { exportTechnicalSheetPdf } = require('./technical-sheets/export-pdf');
await exportTechnicalSheetPdf(sheet.html, outputPath, chromium, { channel: 'msedge' });
```

L’export attend la disponibilité des polices, conserve les arrière-plans et respecte la taille CSS avec une échelle fixe de 1. Playwright et un navigateur compatible doivent être présents dans l’environnement de présentation, pas dans le domaine métier. Les PDF livrés utilisent Microsoft Edge installé et Arial locale ; fixer navigateur et polices en production pour reproduire la pagination.

Les recettes standard tiennent dans un bloc. Un futur composant plus haut qu’une page nécessitera une variante paginée avec continuation de table ; CSS peut alors fragmenter un bloc malgré `avoid`. Le gabarit ne réduit pas arbitrairement la police pour forcer tout service sur une seule page.

## Vérifications

- À 160 : 112 portions carbonnade, 48 limandes, 32 kg frites, 19,2 kg carottes et 4 L beurre blanc.
- Quantités exactes et affichées transmises sans recalcul au view model.
- Couscous, lasagnes et quiches testés avec le même gabarit, dont préparation commune et unités physiques.
- Snapshot HTML à 100 couverts et test de rendu d’une quantité fournie arbitraire, indépendant de sa valeur exacte.
- Deux PDF vérifiés visuellement après conversion en images : une page A4 portrait chacun, sans coupure ni débordement.
- Contrôles d’absence de débordement horizontal à 390, 768 et 1280 pixels pour les deux HTML.

Les 28 tests existants restent verts ; les 5 tests ajoutés portent le total à **33 tests réussis**.

```sh
node --test tests.js persistence/integration.test.js persistence/ingredients.test.js technical-sheets/tests.js
```

Aucune PWA complète et aucune gestion des commandes ne sont ajoutées.

## Variante visuelle cuisine

Le layout choisit la recette la plus dense pour le grand bloc, les autres composants pour la colonne secondaire et les sauces/préparations communes pour les blocs horizontaux. Aucun nom de recette ne pilote la disposition. Les titres reprennent les composants ; le pied de page affiche uniquement la répartition, les rendements, sauces de service ou productions présents. L’échelle d’impression est fixe à 1, sans réduction automatique des polices. Les deux PDF restent sur une page A4 et les 33 tests passent. Le snapshot HTML a été actualisé pour ce changement de présentation uniquement.

## Lisibilité A4

Marges de 6 mm, ingrédients à 8,8 pt (environ +19 % par rapport au PDF précédent), quantités à 9,4 pt et repères agrandis. Le conteneur imprimé distribue la hauteur disponible entre les colonnes et les blocs. Les informations de composition restent dans les données ; seule une mention globale discrète apparaît sur la fiche. Les trois encadrés métier sont conservés. Aucun calcul, recette ou schéma de base n’est modifié.
`nNouvelle priorité ingrédients : noms à 11 pt (+25 %), quantités à 12 pt (+28 %), contraste renforcé et lignes agrandies. Espaces secondaires compactés, sans réduction des étapes. Les PDF 100 et 160 restent sur une page A4.

En-tête : cloche SVG au trait ; dayLabel et mealType sont lus depuis service_date et meal_type du snapshot PostgreSQL, avec repli explicite si absents. Aucune écriture de production ni migration. Ingrédients 13,2 pt et quantités 14,4 pt (+20 %). Test lunch/dinner sur base éphémère, calcul inchangé ; 34 tests réussis.
