# Étapes de préparation dans les fiches techniques

Le flux est désormais explicite : `recipe.preparation_steps` → `TechnicalSheetViewModel.preparationSteps` → template → PDF. Chaque étape expose `order` (à partir de 1) et `text`. La liste conserve l’ordre stocké.

Le champ `steps` du ViewModel reste un alias de compatibilité pour l’éditeur existant. Les snapshots historiques sans colonne `preparation_steps` sont lus via leur ancien champ `steps`, qui était la source de cette même liste. Aucun déroulé n’est généré depuis les ingrédients ou les notes.

## Présentation

Les étapes sont numérotées par des pastilles dans chaque bloc. Les informations pratiques ne sont plus numérotées comme un déroulé. Productions, rendements, allocations et sauces restent dans leurs zones distinctes. Les répétitions du pied de page ont été retirées : les règles affichées dans les blocs restent présentes.

Une recette sans étapes affiche discrètement **Préparation à compléter**. La préparation commune a son bloc unique ; ses étapes ne sont pas répétées dans les composants destinataires.

La répartition des cartes se base sur leur contenu pour limiter les espaces inutilisés. Les préparations communes occupent la largeur, les autres cartes peuvent se répartir sur deux colonnes. Il s’agit de présentation, sans calcul de quantité.

Tailles imprimées vérifiées : ingrédients **13,2 pt**, quantités **14,4 pt**, étapes **9,5 pt**. Les marges et les espacements secondaires ont été compactés. Aucun texte d’ingrédient n’a été réduit pour faire entrer les étapes.

## État réel du référentiel

Au moment de la génération, aucune étape n’était encore renseignée dans les recettes des quatre services types. Les cinq PDF issus du référentiel réel portent donc la mention **Préparation à compléter**. Les recettes réelles n’ont pas été modifiées pour créer un exemple.

Le PDF `demonstration-etapes-carbonnade-100.pdf` est distinct : il reprend exactement les neuf étapes fournies dans la demande, enregistrées dans une base temporaire de test. Son en-tête identifie cette démonstration. Il ne représente pas une recette mise à jour dans la bibliothèque réelle.

## Contrôles

**139 tests réussis, aucun échec**, dont les **131 tests existants**. Les huit tests supplémentaires couvrent les quatre services, la source et l’ordre des étapes, leur isolation par composant, les recettes sans étapes, la préparation commune unique, la mise à jour depuis l’éditeur, les snapshots clôturés, l’échappement du texte et l’invariance des calculs et commandes.

Le test de commande vérifie les quantités exactes, unités, catégories et HTML inchangés. Seuls les identifiants internes de traçabilité des lignes recréées par l’éditeur sont exclus de cette comparaison : la logique de commande n’a pas été modifiée.

Les cinq fiches réelles et la démonstration ont été exportées, contrôlées avec un lecteur PDF puis rendues en images et inspectées. Chaque document comporte **une page A4 portrait**. Contrôle de la hauteur, absence de débordement horizontal et tailles de police vérifiées. Les vues HTML ont aussi été contrôlées à 390, 768 et 1280 pixels.

Le contrôle de lecture de la base réelle confirme que les recettes n’ont pas changé pendant la génération. Le moteur, les règles métier, les conversions, les commandes et la fiche allergènes n’ont pas été modifiés.

## Documents

- `../fiches/carbonnade-limande-100.pdf`
- `../fiches/carbonnade-limande-160.pdf`
- `../fiches/couscous-vegetarien-100.pdf`
- `../fiches/lasagnes-100.pdf`
- `../fiches/quiches-100.pdf`
- `../fiches/demonstration-etapes-carbonnade-100.pdf` — base de test exclusivement.
- `../fiches/comparaison-preparation-avant-apres.png` — même référence réelle, 100 couverts, avant et après.

Pour afficher vos propres étapes, les enregistrer dans Bibliothèque puis rouvrir la fiche du service planifié : elle est régénérée à la demande.
