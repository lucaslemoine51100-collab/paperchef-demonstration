# Agrégation des commandes V0

## Architecture

`orders/input-adapter.js` raccorde le snapshot persistant aux résultats existants. Le repository expose deux métadonnées supplémentaires en lecture : nom normalisé et catégorie d’achat. Aucun schéma, recette, règle ni calcul moteur ne change.

`orders/aggregation.js` est une couche pure indépendante du repository, de la PWA et des PDF. Elle expose `aggregateServiceOrder(serviceResult)` et `aggregateOrders(serviceResults[])`. L’entrée est un résultat moteur enrichi avec `ingredient_id`, `normalized_name`, `purchase_category` et éventuellement `purchase_key`. Un résultat moteur brut sans identité échoue explicitement : aucune déduction à partir de noms ressemblants.

Le pont `calculateOrderServices(repository, selections)` accepte des sélections `{serviceId, headcount}` et utilise les mêmes calculs métier. L’association provient de la relation recette/ingrédient SQL, ou de l’ingrédient associé au profil pour les quantités génériques. Une relation manquante ou ambiguë bloque le calcul de commande.

## Identité et fusion

La clé est `(purchase_key, purchase_category, canonical_unit)`. Par défaut `purchase_key` est l’identifiant du catalogue : ses références distinguent déjà variantes et formes. Aucun champ SQL supplémentaire n’est nécessaire. Une clé commune entre plusieurs identifiants ne doit être fournie que si leur interchangeabilité est explicitement validée dans les données ; elle ne repose jamais sur un nom approchant.

Beurre doux avec beurre doux, farine avec farine et carottes fraîches avec carottes fraîches fusionnent. Œufs coquille/liquides, crèmes liquide/épaisse, beurre doux/demi-sel, légumes frais/surgelés, feuilletage/pâte brisée et moutardes forte/ancienne restent des identités distinctes. Une masse et un nombre de pièces restent séparés, même pour la même référence.

## Unités et exactitude

- g → kg, division exacte par 1 000 ; kg conservé.
- ml → L, division exacte par 1 000 ; L conservé.
- pièce, pièces, unités → pièces ; plaque/plaques → plaques.
- Autres unités : conservées, fusion seulement avec la même unité.
- Aucune conversion pièce/kg ou portion/kg implicite.

Fractions réduites avec BigInt en interne ; numérateur et dénominateur sérialisés en chaînes pour ne perdre aucune précision. Aucun champ `display` du moteur n’est additionné. 500 g + 1,2 kg = 17/10 kg ; 750 ml + 1,5 L = 9/4 L. 0,347 + 0,586 kg = 933/1000 kg, affiché 0,9 kg. Affichage au dixième kg/L, à la dizaine g/ml si utilisés, entier pour les comptes ; moitié supérieure. L’affichage zéro d’une petite quantité ne supprime pas sa quantité exacte.

## Cas importants

Les préparations communes sont parcourues une fois par sélection. Les lignes `fromPreparation` des recettes utilisatrices sont des transferts internes, exclus de l’achat : la béchamel n’est pas comptée une deuxième fois. Le Grana de finition reste un ingrédient acheté supplémentaire.

Les lignes QS sont conservées : `exact_quantity: null`, `display_quantity: "QS"`, `quantity_complete: false`. Une fusion quantifiée + QS garde le total connu et `has_qs: true` ; ce total ne prétend pas représenter le besoin complet. Aucun zéro inventé pour QS. Le rendement sauce est une sortie de recette, pas un ingrédient acheté.

## Catégories et traçabilité

Les six catégories sont toujours présentes dans l’ordre Dairy, Meat, Fish, Frozen, FreshProduce, Grocery, avec leurs libellés français. Les produits sont triés par nom normalisé puis clé/unité. La catégorie vient du catalogue, pas de la catégorie fonctionnelle du plat. Une limande peut donc relever du Surgelé selon sa référence catalogue, sans forcer son unité en kg.

Chaque ligne conserve identifiant, clé, nom normalisé, catégorie, fraction exacte, unité canonique, quantité/unité d’affichage, `source_count` (nombre de services distincts), `source_services`, `selection_count`, et `sources`. Chaque source indique sélection, service, effectif, recette, quantité originale et quantité canonique exacte. Sélectionner deux fois un même service ajoute deux besoins : les deux contributions restent identifiables par `selection_index`.

## Vérification et exemples

`node --test tests.js persistence/integration.test.js persistence/ingredients.test.js technical-sheets/tests.js orders/tests.js`

Exemples à 100 couverts par service : `orders/A-un-service.json`, `B-deux-services.json`, `C-quatre-services.json` et récapitulatif `orders/EXEMPLES.md`. Tests conversions, exactitude, variantes, catégories, pièces/plaques, QS, traçabilité, quatre services et préparations communes.

## Conditionnement ultérieur

Ajouter une étape séparée après agrégation avec des données de conditionnement explicitement associées au produit. Conserver le besoin exact et créer des champs distincts pour quantité à commander et nombre de colis, par plafond du besoin/conditionnement. Ne jamais remplacer le besoin exact par une quantité arrondie. Cette étape, les fournisseurs, les commandes semaine et le design A4 sont hors de cette version.

Pour une ligne QS, le pont fournit l’unité par défaut du catalogue afin de regrouper les contributions QS et quantifiées du même produit dans une seule ligne compatible. La quantité reste inconnue, sans conversion ni valeur inventée. Le repository expose également cette unité en lecture.

## Conversion culinaire vers achat (migration 005)

Le pont de calcul applique désormais les conversions enregistrées avant agrégation. Les trois bouillons préparés en litres deviennent leurs poudres distinctes à 0,020 kg/L ; l’eau et les besoins non achetés sont exclus via purchase_required. La source culinaire demeure dans chaque contribution. Les conversions portent leur affichage : g sous 1 kg, kg au-delà. Aucun calcul de recette ni conditionnement fournisseur modifié. Voir PURCHASE_CLEANUP.md.
