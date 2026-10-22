# Unités d’achat canoniques — migration 006

Chaque ingrédient possède désormais un `purchase_unit` explicite enregistré en base, distinct de l’unité de chaque besoin culinaire. La migration renseigne les unités à partir du référentiel existant : g→kg, ml→L, unités→pièces, autres unités conservées. Tous les 164 actifs ont une unité d’achat autorisée et non nulle. Toute création future d’ingrédient doit renseigner cette colonne explicitement.

| Produits | Unité d’achat |
|---|---|
| Lait, crème liquide | L |
| Œufs entiers liquides, beurres, fromages vendus au poids | kg |
| Huiles, vinaigres, jus de citron | L |
| Secs et poudres, viandes/poissons vendus au poids | kg |
| Produits vendus à la pièce, œufs coquille | pièces |
| Feuilletage et pâte brisée en plaques | plaques |

Les unités restent des données individuelles : aucune déduction sur les noms au moment de calculer une commande.

## Deux conventions V1 explicites

Table `purchase_unit_conversions`, clé `(ingredient_id, source_unit)` :

- `ingredient-53` (Lait) : kg culinaire → L achat, ratio exact 1.
- `ingredient-23` (Crème liquide) : kg culinaire → L achat, ratio exact 1.

Il s’agit de la convention métier V1 autorisée : **1 kg culinaire = 1 L d’achat** pour ces deux références historiques. Ce n’est pas une conversion physique universelle ni une densité mesurée. Aucune densité spécifique n’était stockée. Les autres références, dont lait entier/demi-écrémé et crème épaisse, gardent leurs identités et leurs unités explicites ; aucune conversion kg/L n’est étendue automatiquement.

## Pipeline et traçabilité

Calcul exact inchangé → conversions de produits existantes (bouillons) → `normalizePurchaseUnits` → agrégation → formatage d’affichage.

`orders/purchase-unit-normalization.js` lit le catalogue et les règles par identifiants. Il normalise g/kg et ml/L, ou utilise une règle propre au produit pour une autre dimension. Une unité incompatible sans règle est rejetée, plutôt que convertie arbitrairement. Les valeurs calculées en recette ne sont jamais modifiées : la normalisation travaille sur une copie.

Le besoin d’origine est conservé dans `sources[].culinary_requirement` : identifiant, unité et fraction culinaire exacte. `original_unit` et `original_exact_quantity` indiquent ensuite la contribution d’achat présentée à l’agrégation. `purchase_unit_convention` explique la convention appliquée. Les besoins en litres déjà tracés pour les bouillons ne sont pas écrasés par la normalisation des poudres.

Exemple : contribution lait 24 kg culinaires → 24 L achat, puis contribution 61,2 L culinaires → 61,2 L achat. Une seule ligne, 426/5 L = **85,2 L**.

## Résultats de la semaine de démonstration

- **Lait : une seule ligne, 85,2 L exacts et affichés.**
- **Crème liquide : une seule ligne, 28,76 L exacts, 28,8 L affichés.**

La précédente ligne « 4,8 L » de crème était un affichage arrondi de 4,76 L. Le nouveau calcul utilise 24 + 4,76 = 28,76 L ; il n’additionne pas les affichages arrondis. Le cas synthétique demandé 24 + 4,8 exacts = 28,8 exacts est aussi testé.

Aucun doublon du même identifiant dû à une unité culinaire différente dans la semaine. Crème liquide/épaisse, lait entier/demi-écrémé et œufs coquille/liquides restent distincts. Les règles bouillon à 20 g/L n’ont pas été modifiées ; l’eau reste exclue. Catégories et design PDF inchangés.

## Vérifications

**57 tests passent**, dont les 53 précédents. Quatre tests ajoutés : lait, crème et variantes, absence de kg/L générique, migration et semaine complète. Migration idempotente, colonnes quantité/unité culinaires inchangées et conversions bouillons strictement identiques avant/après.

Trois documents régénérés, une page A4 chacun, vérifiés visuellement et sans débordement responsive : commande 1 service portrait, 2 services portrait et semaine paysage. Les fichiers JSON associés conservent la provenance et les fractions exactes.

Le moteur `engine.js`, les recettes, les quantités culinaires, les catégories et les conversions bouillons n’ont pas été modifiés. Aucun changement de CSS, d’icône ou de template PDF dans cette correction.
