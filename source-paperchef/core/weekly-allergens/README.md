# Fiche allergènes hebdomadaire

La fiche est une projection des services persistés, sans saisie propre d’allergènes. La démonstration du 5 au 11 octobre 2026 reprend la sélection des commandes semaine : quatre occurrences persistées à 100 couverts, lundi et mardi midi/soir ; les dix autres créneaux restent vides. Elle ne reproduit pas les recettes de l’image de référence, utilisée uniquement pour la présentation.

## Utilisation

`generateWeeklyAllergenSheet(repository, selections, {weekStart: '2026-10-05'})` retourne `{viewModel, html}`. Les sélections utilisent les mêmes champs que les commandes : `serviceId`, `headcount`, `serviceDate`, `mealType`. Les dates et repas peuvent provenir de la base. La semaine commence un lundi ; un créneau absent reste explicitement non renseigné ; les doublons et services hors semaine sont refusés.

`exportWeeklyAllergenPdf(html, outputPath, chromium, launchOptions)` contrôle les débordements dans chaque créneau avant l’export A4 paysage. Une semaine trop dense est refusée sans réduire silencieusement les polices ni couper des plats. Le format HTML passe à deux colonnes puis une colonne sur petit écran.

## Fichiers

- `view-model.js` : WeeklyAllergenSheetViewModel, jours, services et sources ingrédients.
- `visuals.js` et `icons/` : 14 pastilles SVG et ordre central stable.
- `template.js`, `sheet.css` : rendu uniquement ; aucune résolution d’allergènes dans le template.
- `pipeline.js`, `export-pdf.js` : génération et export contrôlé.
- `tests.js` : cohérence ingrédients, recalcul, préparations communes, positionnement, couleurs, références visuelles et entrées invalides.
- `allergenes-semaine.html`, `.json`, `.pdf` : démonstration calculée.

## Contient et traces

Le schéma actuel `ingredient_allergens` est une relation sans type de présence ; toutes ses associations signifient « contient ». Les composants exposent séparément `allergens` et `traces` (vide actuellement). Le template principal ne rend que `allergens`. Pour enregistrer ultérieurement des traces, il faudra étendre cette relation canonique ou un référentiel d’associations ingrédient/allergène, puis le chargement des sources ; jamais créer une saisie dédiée à la fiche. Aucune trace n’a été inventée ni ajoutée au PDF.

Les ingrédients dont le statut reste à vérifier sont conservés dans `reviewNames`. Le document signale cette limite du référentiel. Une absence de pictogramme signifie uniquement qu’aucun allergène n’est identifié dans les données disponibles.

## Couleurs fonctionnelles

Protéine/plat principal rouge, féculent orange, légume vert, sauce bleu. Un plat complet suit sa fonction principale (priorité protéine). Aucun module de menu semaine préexistant n’a été trouvé : cette priorité est donc explicitée dans le référentiel de présentation, sans modifier la classification métier. Depuis la migration 007, le Grana de finition est une contribution interne non affichable dans le menu ou la fiche allergènes. Ses allergènes sont transmis aux lasagnes destinataires ; ses quantités et achats sont conservés.

Les préparations communes sont suivies récursivement par leurs relations d’entrée pour propager leurs allergènes aux composants destinataires. Les ingrédients créés par des profils sont associés par le même adaptateur d’identité persistante que les commandes, avant toute conversion d’achat. Les allergènes ne sont jamais déduits du nom du plat ni du produit d’achat converti.

## Vérifications

La démonstration comporte sept jours, quatorze créneaux potentiels dont quatre remplis, les quatorze allergènes dans une légende fixe sur deux lignes de sept et uniquement les plats visibles. Le PDF est vérifié par rendu et inspection ; le contrôle navigateur vérifie les cases en impression et l’absence de débordement horizontal sur un écran de 390 px. Les mutations des tests se font exclusivement dans une base temporaire.



## Référentiel visuel définitif

La légende affiche toujours les 14 allergènes dans l’ordre retenu, y compris ceux absents des plats. Le référentiel central attribue une couleur distincte et un symbole SVG spécifique à chacun : Lait violet, Poissons bleu. Les mêmes objets icon/color sont utilisés dans les cases et la légende ; aucune couleur allergène n’est codée dans le template.

La légende comporte deux lignes de sept entrées en impression, avec pictogrammes de 6 mm et texte de 8,5 pt. Les cases gardent leurs pictogrammes de 5 mm et uniquement les allergènes calculés. Les couleurs ont un contraste blanc/fond vérifié d’au moins 4,5:1 ; la forme du symbole et le nom dans la légende restent les moyens d’identification complémentaires.

Les quatorze fichiers icons/*.svg sont exportés depuis visuals.js et testés à l’identique. referentiel-visuel.html présente l’ensemble à deux tailles pour inspection. La modification concerne uniquement la présentation : la base, le moteur et le calcul des allergènes sont inchangés. Vérification : 86 tests verts, légende 7 + 7 sans chevauchement, PDF d’une page A4 paysage et HTML sans débordement horizontal sur mobile.
