# Validation de l’éditeur par assemblage

- Suite complète : **186 tests verts / 0 échec**.
- 166 tests historiques conservés, 20 nouveaux contrôles.
- Quatre services de référence : calculs identiques après migration.
- Quatre ViewModels de la base réelle : comparaison stricte avant/après, sans différence.
- Duplication des services : identités des recettes et préparations communes conservées, aucun nouvel enregistrement de recette.
- Remplacement Frites → Purée : autres recettes inchangées ; fiche, commande et allergènes recalculés.
- Retrait : plat et recette conservés dans la bibliothèque.
- Modification partagée : futurs services actualisés ; snapshot servi inchangé.
- Règles spécifiques : conservées et validation des associations incorrectes.
- Interface : création, recherche, ajout, remplacement, retrait, réordre, ingrédient, étape, repère, aperçu et sauvegarde contrôlés dans Edge.
- Responsive : Windows, iPad 768 × 1024 et téléphone 390 × 844, sans débordement ni erreur JavaScript.
- Aucune modification d’engine.js, des recettes réelles, des règles validées, des conversions ou des gabarits PDF.

Les scénarios avec recette Purée et autres créations de démonstration utilisent des bases isolées. Ils n’ajoutent rien à la base réelle. Les captures réelles sont effectuées sans sauvegarde.

Lancement : `node outputs/moteur-v0/pwa/server.js`, ou **Lancer-V0.cmd**.
Application : http://127.0.0.1:8787/?v=assemblage-plats#bibliotheque
