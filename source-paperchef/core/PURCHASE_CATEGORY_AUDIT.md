# Contrôle des catégories d’achat V1

Source : catalogue actif de la base PostgreSQL embarquée locale, après migrations 001–005. Contrôle de chaque référence, unité et identité d’achat ; corrections explicites de la migration 005 appliquées, quantités culinaires inchangées.

## Synthèse

| Indicateur | Nombre |
|---|---:|
| Ingrédients actifs | 164 |
| Catégories valides | 164 |
| Cohérents sans réserve identifiée | 162 |
| Sans catégorie | 0 |
| Catégorie hors référentiel | 0 |
| Corrigés | 3 |
| À revoir manuellement | 2 |
| Invalides restants | 0 |

100 % des références ont une catégorie autorisée. Cela ne vaut pas validation du circuit d’achat des 2 cas ambigus : leur catégorie actuelle est conservée, aucune alternative n’est appliquée.

## Ingrédients corrigés

Trois catégories corrigées sur décision utilisateur : frites sous vide, thon au naturel et thon égoutté. Le détail avant/après est conservé dans orders/purchase-category-corrections.json et PURCHASE_CLEANUP.md.

## REVIEW_REQUIRED

Une proposition ferme est laissée « À décider » lorsque les données ne permettent pas de choisir. Les alternatives servent à guider la décision.

| Ingrédient | Catégorie actuelle | Catégorie proposée | Alternative à confirmer | Raison | Décision manuelle |
|---|---|---|---|---|---|
| Huile | Épicerie | À décider | Forme / identité à préciser | Variété non précisée : conserver distinct des huiles d’olive, colza et tournesol. | Oui |
| Légumes | Fruits et légumes frais | À décider | Forme / identité à préciser | Référence générique non précisée : aucun achat réel confirmé. | Oui |

## Répartition finale

| Catégorie | Nombre |
|---|---:|
| Crémerie | 21 |
| Viande | 20 |
| Poisson | 18 |
| Surgelé | 19 |
| Fruits et légumes frais | 27 |
| Épicerie | 59 |

## Contrôle exhaustif des références

L’identifiant est l’identité d’achat par défaut : la catégorie commune n’autorise jamais une fusion de variantes.

| Identifiant / identité | Ingrédient | Catégorie stockée | Unité | Statut |
|---|---|---|---|---|
| ingredient-39 | Ail | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-10c1e7a3776a3ef3 | Amandes | Épicerie | kg | REVIEWED |
| ingredient-v1-7ca5f584833d63e7 | Aubergines | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-0df55addf230c004 | Banane | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-1d70b2e3b852757f | Beurre demi-sel | Crémerie | kg | REVIEWED |
| ingredient-22 | Beurre doux | Crémerie | kg | REVIEWED |
| ingredient-8 | Bière brune/ambrée | Épicerie | L | REVIEWED |
| purchase-bouillon-beef-powder | Bouillon de bœuf en poudre | Épicerie | kg | REVIEWED |
| ingredient-9 | Bouillon de bœuf préparé | Épicerie | L | REVIEWED |
| purchase-bouillon-vegetables-powder | Bouillon de légumes en poudre | Épicerie | kg | REVIEWED |
| ingredient-35 | Bouillon de légumes préparé | Épicerie | L | REVIEWED |
| purchase-bouillon-poultry-powder | Bouillon de volaille en poudre | Épicerie | kg | REVIEWED |
| ingredient-v1-d5099e9e0940ca52 | Bouillon de volaille préparé | Épicerie | L | REVIEWED |
| ingredient-v1-93a75b742c2d12b0 | Brocolis surgelés | Surgelé | kg | REVIEWED |
| ingredient-v1-f520fc8c78c3148c | Brunoise carotte/oignon/céleri | Surgelé | kg | REVIEWED |
| ingredient-41 | Bœuf haché | Viande | kg | REVIEWED |
| ingredient-1 | Bœuf à mijoter | Viande | kg | REVIEWED |
| ingredient-v1-2ba4f4491e8a829a | Cabillaud | Poisson | kg | REVIEWED |
| ingredient-v1-0b0cabd610cc2007 | Cacahuètes | Épicerie | kg | REVIEWED |
| ingredient-v1-d4cd8e9ee1e05bc3 | Cacao en poudre | Épicerie | kg | REVIEWED |
| ingredient-v1-9ca22c7454bfdbb2 | Cantal | Crémerie | kg | REVIEWED |
| ingredient-3 | Carottes fraîches | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-962f74b25026bab8 | Carottes surgelées | Surgelé | kg | REVIEWED |
| ingredient-6 | Cassonade | Épicerie | kg | REVIEWED |
| ingredient-v1-68e347cca2fb6f84 | Cerises surgelées | Surgelé | kg | REVIEWED |
| ingredient-v1-458235d77df53b5c | Champignons de Paris | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-d978bdfba44f506f | Champignons surgelés | Surgelé | kg | REVIEWED |
| ingredient-v1-1a0fb58b0024228b | Chapelure | Épicerie | kg | REVIEWED |
| ingredient-v1-1e66d95e086a3774 | Chocolat noir | Épicerie | kg | REVIEWED |
| ingredient-v1-e455de7686d0e562 | Chou-fleur surgelé | Surgelé | kg | REVIEWED |
| ingredient-v1-ceb0fdb60b80e6c0 | Citron frais | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-4c1001c251c1c923 | Colin | Poisson | kg | REVIEWED |
| ingredient-v1-c1d9448767ef278a | Comté | Crémerie | kg | REVIEWED |
| ingredient-36 | Concentré de tomate | Épicerie | kg | REVIEWED |
| ingredient-v1-ef9d60b04ac0cf08 | Concombre | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-94a1e6c4b6e7e876 | Courgettes fraîches | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-54e7de78b83d414e | Courgettes surgelées | Surgelé | kg | REVIEWED |
| ingredient-v1-8833fcc5c11f0770 | Crevettes | Poisson | kg | REVIEWED |
| ingredient-v1-80e6989ac5b262df | Crème dessert industrielle | Crémerie | pièces | REVIEWED |
| ingredient-23 | Crème liquide | Crémerie | L | REVIEWED |
| ingredient-v1-c4f58134336e6a5d | Crème épaisse | Crémerie | kg | REVIEWED |
| ingredient-v1-0b665f10f0b0166f | Cuisse de poulet | Viande | pièces | REVIEWED |
| ingredient-38 | Cumin moulu | Épicerie | kg | REVIEWED |
| ingredient-v1-0b8e0d9bc8319e36 | Curry | Épicerie | kg | REVIEWED |
| ingredient-v1-b3f634a39db21a53 | Céleri branche | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-373912c31f3c5291 | Céleri-rave | Fruits et légumes frais | kg | REVIEWED |
| ingredient-30 | Eau | Épicerie | L | REVIEWED |
| ingredient-58 | Emmental râpé | Crémerie | kg | REVIEWED |
| ingredient-v1-a350352ebc0f2f8e | Endives | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-915e2575b2176970 | Escalope de dinde | Viande | kg | REVIEWED |
| ingredient-v1-407f3b38bea4d83e | Escalope de veau | Viande | kg | REVIEWED |
| ingredient-5 | Farine de blé | Épicerie | kg | REVIEWED |
| ingredient-55 | Feuilletage surgelé | Surgelé | plaques | REVIEWED |
| ingredient-v1-5968231e4bb9df69 | Filet de poisson pané | Poisson | pièces | REVIEWED |
| ingredient-v1-a4ad371bec3f88cb | Filet de porc | Viande | kg | REVIEWED |
| ingredient-v1-5c042128805903e5 | Filet de poulet | Viande | kg | REVIEWED |
| ingredient-18 | Frites crues sous vide | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-65991f9688e35601 | Fromage blanc | Crémerie | kg | REVIEWED |
| ingredient-v1-263def818aea341b | Fromage à la coupe | Crémerie | kg | REVIEWED |
| ingredient-v1-7a098147ca07d36d | Fumet de poisson préparé | Épicerie | L | REVIEWED |
| ingredient-45 | Grana Padano | Crémerie | kg | REVIEWED |
| ingredient-v1-402a0aa682ddf2f7 | Haricots blancs | Épicerie | kg | REVIEWED |
| ingredient-v1-89cc8a4c8b650919 | Haricots rouges | Épicerie | kg | REVIEWED |
| ingredient-v1-bae89e183758418f | Haricots verts surgelés | Surgelé | kg | REVIEWED |
| ingredient-4 | Huile | Épicerie | L | REVIEW_REQUIRED |
| ingredient-47 | Huile de colza | Épicerie | L | REVIEWED |
| ingredient-v1-90ef32ff90f52a22 | Huile de tournesol | Épicerie | L | REVIEWED |
| ingredient-31 | Huile d’olive | Épicerie | L | REVIEWED |
| ingredient-v1-d1aa26fc9012cb9c | Jambon blanc | Viande | kg | REVIEWED |
| ingredient-v1-f317612eaade5915 | Jambon cru | Viande | kg | REVIEWED |
| ingredient-v1-77ba559bdf5ba1f8 | Joue de bœuf | Viande | kg | REVIEWED |
| ingredient-26 | Jus de citron | Épicerie | L | REVIEWED |
| ingredient-53 | Lait | Crémerie | L | REVIEWED |
| ingredient-v1-858dc217884d4f91 | Lait demi-écrémé | Crémerie | L | REVIEWED |
| ingredient-v1-6d1a594948c56f9c | Lait entier | Crémerie | L | REVIEWED |
| ingredient-57 | Lardons crus | Viande | kg | REVIEWED |
| ingredient-13 | Laurier sec | Épicerie | pièces | REVIEWED |
| ingredient-v1-13cb15fcfd63bfb8 | Lentilles vertes | Épicerie | kg | REVIEWED |
| ingredient-v1-42434c3bba6044f8 | Lieu jaune | Poisson | kg | REVIEWED |
| ingredient-v1-3aa90120e6ba14e8 | Lieu noir | Poisson | kg | REVIEWED |
| ingredient-17 | Limande meunière surgelée | Poisson | pièces | REVIEWED |
| ingredient-40 | Légumes | Fruits et légumes frais | kg | REVIEW_REQUIRED |
| ingredient-33 | Légumes couscous surgelés | Surgelé | kg | REVIEWED |
| ingredient-v1-5aef58ff95750cde | Maquereau | Poisson | kg | REVIEWED |
| ingredient-v1-3dffcac32358e653 | Maroilles | Crémerie | kg | REVIEWED |
| ingredient-v1-4c13386250337c66 | Mascarpone | Crémerie | kg | REVIEWED |
| ingredient-27 | Maïzena | Épicerie | kg | REVIEWED |
| ingredient-v1-0bd559b8e4ca09b9 | Merguez viande | Viande | pièces | REVIEWED |
| ingredient-28 | Merguez végétales | Surgelé | pièces | REVIEWED |
| ingredient-v1-d6d3f0bf3cde5234 | Merlu | Poisson | kg | REVIEWED |
| ingredient-50 | Miel | Épicerie | kg | REVIEWED |
| ingredient-v1-342b9196409e823d | Moules | Poisson | kg | REVIEWED |
| ingredient-11 | Moutarde forte | Épicerie | kg | REVIEWED |
| ingredient-49 | Moutarde à l’ancienne | Épicerie | kg | REVIEWED |
| ingredient-v1-b5508392157fa1c4 | Mozzarella | Crémerie | kg | REVIEWED |
| ingredient-54 | Muscade | Épicerie | kg | REVIEWED |
| ingredient-v1-c8d300764858dfc3 | Myrtilles surgelées | Surgelé | kg | REVIEWED |
| ingredient-v1-6ce3edf031d6e168 | Noisettes | Épicerie | kg | REVIEWED |
| ingredient-v1-e4acf3f0f9e37f5a | Noix | Épicerie | kg | REVIEWED |
| ingredient-2 | Oignons frais | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-ab44e914cb294827 | Oignons surgelés | Surgelé | kg | REVIEWED |
| ingredient-v1-1b4c9133da73a711 | Orange | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-94b4d386a34d99aa | Pain de mie | Épicerie | kg | REVIEWED |
| ingredient-10 | Pain d’épices | Épicerie | kg | REVIEWED |
| ingredient-v1-cef767edabd53bd6 | Paleron de bœuf | Viande | kg | REVIEWED |
| ingredient-v1-67aa6b6c143c6683 | Paprika | Épicerie | kg | REVIEWED |
| ingredient-v1-f28dacba7409a84d | Parmesan | Crémerie | kg | REVIEWED |
| ingredient-v1-dd7214401670e380 | Persil frais | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-769d1629ee71976c | Petits pois surgelés | Surgelé | kg | REVIEWED |
| ingredient-v1-e7854e19683638ef | Poire | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-cdd23d6ea347ff76 | Poireaux frais | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-fbd403d8db15822e | Poireaux surgelés | Surgelé | kg | REVIEWED |
| ingredient-v1-b5c50948a6e9cb60 | Pois cassés | Épicerie | kg | REVIEWED |
| ingredient-v1-8a0fd03c94f1fef1 | Pois chiches | Épicerie | kg | REVIEWED |
| ingredient-v1-6ae99f60dd3a9238 | Poisson meunière surgelé | Poisson | pièces | REVIEWED |
| ingredient-15 | Poivre noir | Épicerie | kg | REVIEWED |
| ingredient-v1-9ce348550566a14c | Poivrons rouges | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-0aea879006dafc40 | Poivrons verts | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-1132a3a78a80e199 | Polenta | Épicerie | kg | REVIEWED |
| ingredient-v1-9169bf3e501fea19 | Pomme | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-54ba20c23da5e47f | Pommes de terre | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-56885c72049a5604 | Pommes de terre sous vide | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-1354a0ff4ebf651d | Pâte brisée surgelée | Surgelé | plaques | REVIEWED |
| ingredient-v1-d11acae863529357 | Pâtes sèches | Épicerie | kg | REVIEWED |
| ingredient-v1-2bbcf3af610c60fd | Queue de lotte | Poisson | kg | REVIEWED |
| ingredient-v1-9aa26756cc9def1c | Raisin | Fruits et légumes frais | kg | REVIEWED |
| ingredient-37 | Ras-el-hanout | Épicerie | kg | REVIEWED |
| ingredient-v1-a9ef21942055d990 | Ratatouille surgelée nature | Surgelé | kg | REVIEWED |
| ingredient-v1-0f3e78a6d912e273 | Riz | Épicerie | kg | REVIEWED |
| ingredient-v1-8d43ffa86766ad25 | Riz rond | Épicerie | kg | REVIEWED |
| ingredient-v1-56b39996a26dce2c | Rôti de bœuf | Viande | kg | REVIEWED |
| ingredient-v1-27c149b0c6b4d75a | Rôti de porc | Viande | kg | REVIEWED |
| ingredient-46 | Salade verte | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-f846268d307e51db | Sandre | Poisson | kg | REVIEWED |
| ingredient-v1-fcbae2dba427afdf | Sardine | Poisson | kg | REVIEWED |
| ingredient-v1-30c0f51fe3e5b872 | Sauce soja | Épicerie | L | REVIEWED |
| ingredient-v1-c4bf5e6d6ca9fdfd | Saucisse de Toulouse | Viande | pièces | REVIEWED |
| ingredient-v1-050f2416d8bf5140 | Saucisse fumée | Viande | pièces | REVIEWED |
| ingredient-43 | Saumon | Poisson | kg | REVIEWED |
| ingredient-v1-a30eb44d707ba49c | Saumon sans peau | Poisson | kg | REVIEWED |
| ingredient-v1-2171f9ffa8d07581 | Sauté de porc | Viande | kg | REVIEWED |
| ingredient-v1-d156e58393f50390 | Sauté de veau | Viande | kg | REVIEWED |
| ingredient-14 | Sel fin | Épicerie | kg | REVIEWED |
| ingredient-29 | Semoule de blé | Épicerie | kg | REVIEWED |
| ingredient-v1-83d783dc774441f9 | Sucre blanc | Épicerie | kg | REVIEWED |
| ingredient-v1-686f14b7389c463b | Sésame | Épicerie | kg | REVIEWED |
| ingredient-v1-78fd6a0f3e8de61d | Terrine de poisson | Poisson | kg | REVIEWED |
| ingredient-v1-bdcb15f432a96e61 | Thon au naturel | Épicerie | kg | REVIEWED |
| ingredient-59 | Thon égoutté | Épicerie | kg | REVIEWED |
| ingredient-12 | Thym sec | Épicerie | kg | REVIEWED |
| ingredient-34 | Tomates concassées | Épicerie | kg | REVIEWED |
| ingredient-v1-4ca9f2b551cdc62c | Tomates fraîches | Fruits et légumes frais | kg | REVIEWED |
| ingredient-v1-154da0b53b803fdd | Tomates pelées | Épicerie | kg | REVIEWED |
| ingredient-v1-0358db8b8d8508bf | Truite | Poisson | kg | REVIEWED |
| ingredient-48 | Vinaigre de cidre | Épicerie | L | REVIEWED |
| ingredient-7 | Vinaigre de vin | Épicerie | L | REVIEWED |
| ingredient-25 | Vinaigre de vin blanc | Épicerie | L | REVIEWED |
| ingredient-v1-b80d4b6b368426b8 | Yaourt nature | Crémerie | pièces | REVIEWED |
| ingredient-24 | Échalotes fraîches | Fruits et légumes frais | kg | REVIEWED |
| ingredient-51 | Échalotes surgelées | Surgelé | kg | REVIEWED |
| ingredient-v1-46119d7d838bb9c5 | Échine de porc | Viande | kg | REVIEWED |
| ingredient-v1-193f3be8b788e191 | Épinards surgelés | Surgelé | kg | REVIEWED |
| ingredient-v1-3f9672ee9fa0ba75 | Œufs coquille | Crémerie | pièces | REVIEWED |
| ingredient-v1-a683b205fc742a0c | Œufs entiers liquides | Crémerie | kg | REVIEWED |
