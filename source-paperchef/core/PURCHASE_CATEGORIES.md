# Catégories d’achat officielles

Ordre et libellés : **Crémerie → Viande → Poisson → Surgelé → Fruits et légumes frais → Épicerie**. Identifiants : Dairy, Meat, Fish, Frozen, FreshProduce, Grocery.

Le référentiel unique `orders/purchase-categories.js` pilote libellés et ordre des lignes de commande. La catégorie est stockée sur `catering.ingredients.purchase_category` ; aucune règle du moteur Commandes ne la déduit du nom. Les contraintes PostgreSQL NOT NULL et CHECK existantes imposent déjà une et une seule valeur parmi les six : aucun changement de schéma nécessaire.

La catégorie représente le circuit d’achat et le rangement métier, pas uniquement l’état physique. Les poissons surgelés restent dans Poisson selon la décision utilisateur confirmée. Les œufs coquille et ovoproduits sont tous en Crémerie selon la convention existante, conservée. Les légumes explicitement surgelés et les pâtes surgelées restent Surgelé. Une pâte feuilletée surgelée est explicitement classée et distincte de la pâte brisée surgelée : pas de reclassement arbitraire.

Les formes génériques, les frites dont le nom mélange sous vide et surgelé, les produits végétariens transformés et certains produits préparés nécessitent une décision métier. La liste REVIEW_REQUIRED indique catégorie actuelle, proposition non tranchée, alternative et raison. Les décisions de nettoyage utilisateur sont appliquées par la migration 005 ; seuls Huile et Légumes restent ambigus.

`orders/purchase-category-review.json` est le relevé explicite de revue, identifié par ingredient_id. `orders/category-audit.js` contrôle toutes les lignes actives fournies : nouvelle référence ou modification du nom, de l’unité ou de la catégorie ⇒ nouvelle revue. Ce contrôle ne recatégorise pas et ne change pas l’identité d’achat. Les statuts de revue d’achat sont distincts des statuts allergènes et ne remplacent pas ceux-ci.

Le relevé ne modifie pas les tables : il est conservé comme données de contrôle livrées. Une validation manuelle future doit mettre à jour les données enregistrées de l’ingrédient et son relevé de revue ; aucun besoin de déduire le classement au moment d’une commande. Toute nouvelle référence doit être contrôlée avant de prétendre que son circuit d’achat est validé.

Deux produits dans une même catégorie ne fusionnent que si leur identité d’achat et leur unité canonique sont compatibles. Crèmes liquide/épaisse, beurres doux/demi-sel, œufs coquille/liquides, pommes de terre fraîches/sous vide, moutardes, légumes frais/surgelés et pâtes brisée/feuilletée conservent des identifiants distincts. Les références poissons restent séparées entre elles.

Rapport exhaustif : `PURCHASE_CATEGORY_AUDIT.md` et `orders/purchase-category-audit.json`. 164 références actives, 164 catégories autorisées, 162 sans réserve identifiée, 2 à revoir ; trois corrections de catégorie validées, aucune catégorie invalide restante. Ne pas confondre validité du code et validation métier d’un cas ambigu.

Tests : `node --test orders/purchase-categories.test.js` ; suite complète avec `tests.js`, les tests de persistence, technical-sheets et orders. Les exemples Commandes sont régénérés avec l’ordre officiel ; quantités exactes et arrondis restent identiques.

Voir PURCHASE_CLEANUP.md pour les substitutions explicites et la conversion des bouillons.
