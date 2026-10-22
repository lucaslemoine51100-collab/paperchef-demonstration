# Synchronisation web / PDF

Le bouton Fiche technique ouvre le HTML actuel du template commun. Aperçu web / PDF permettent de changer de format. Les deux formats utilisent plannedTechnicalSheet et le même TechnicalSheetViewModel, sans seconde implémentation des étapes.

Chaque ouverture et lecture API utilise no-store. Le service worker exclut documents et données de son cache ; sa version est renouvelée. Aucun redémarrage après sauvegarde en bibliothèque.

143 tests verts, aucun échec. Contrôle navigateur sur base isolée : neuf étapes enregistrées et visibles dans le web et le PDF, dans le même ordre ; modification depuis l’éditeur puis réouverture actualisée dans les deux formats sans redémarrage. Deux PDF de contrôle : une page chacun. Capture : apercu-web-carbonnade-etapes.png.

La base locale réelle contient actuellement zéro étape Carbonnade. Le précédent PDF de démonstration utilisait une base isolée. Aucune recette réelle modifiée. Les services servis conservent leur snapshot historique.

Moteur, règles, recettes et PDF existants inchangés. Correction limitée à l’interface et au chargement sans cache.
