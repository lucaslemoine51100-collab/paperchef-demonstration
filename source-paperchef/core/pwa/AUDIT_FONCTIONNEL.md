# Gestion d’un créneau rempli et audit fonctionnel

Les actions portent uniquement sur `planned_services`. Aucune migration supplémentaire, modification du moteur, des règles, des recettes ou des conversions n’est nécessaire. Aucun fichier PDF existant n’a été régénéré.

## Actions livrées

La carte ouvre un panneau avec jour, Midi/Soir, service actuel et effectif. Il propose « Modifier l’effectif », « Remplacer le service » et « Supprimer le service ».

Le remplacement choisit un autre type dans la bibliothèque, conserve l’effectif par défaut et met à jour la même occurrence. ID, semaine, date et repas ne changent pas. La suppression ouvre un second panneau de confirmation nominatif ; seul le clic sur « Confirmer la suppression » émet la suppression. Annuler, fermer ou utiliser Échap n’écrit rien. Les services servis restent en lecture seule, également protégés par la base.

Les opérations réussies rechargent la semaine depuis le repository, y compris noms, composants, effectifs et compteurs. Fiches, commandes service/jour/semaine et allergènes sont calculés à chaque ouverture avec la nouvelle planification. La commande du jour prend les occurrences actuellement présentes dans ce jour, sans liste d’identifiants figée. Un lien vers cette commande est disponible dans le panneau de détail.

## Corrections de sécurité fonctionnelle

- Les deux opérations manquantes sont désormais des méthodes dédiées de `PlanningRepository`, appelées par l’API. Aucun remplacement par insertion d’une deuxième occurrence.
- Un verrou de soumission dans le formulaire complète la désactivation du bouton : une double soumission simulée n’envoie qu’une seule écriture.
- Les contraintes d’unicité date/repas existantes rejettent deux créations concurrentes. Les doubles remplacements sans précondition restent des mises à jour de la même ligne.
- Le panneau transmet le service type et l’effectif observés à l’ouverture. Les mises à jour et suppressions vérifient ces valeurs dans leur clause SQL : une action sur un panneau périmé est refusée au lieu d’écraser ou supprimer une modification récente. Cette protection concerne ces deux valeurs observées, sans mécanisme de version globale.
- L’API de suppression exige une confirmation explicite ; le navigateur n’envoie celle-ci qu’après confirmation dans le panneau. Cette validation de parcours ne constitue pas une authentification utilisateur : la V0 reste une application locale.
- Les effectifs vides, non numériques, nuls, négatifs, décimaux, chaînes et nombres hors plage sûre sont refusés par le repository. La référence de recette n’est jamais modifiée.
- Une erreur de référence de type est traduite en message compréhensible. Les anciennes notifications de réussite sont effacées avant une nouvelle action ; un enregistrement échoué garde la modal ouverte avec son erreur et conserve la ligne précédente.

## Vérifications

| Contrôle | Résultat et preuve |
|---|---|
| Modification effectif | OK : enregistrement et recalcul à 170 puis 160 couverts |
| Remplacement | OK : ID, date et repas conservés, tests MIDI et SOIR |
| Suppression | OK : confirmation obligatoire, occurrence supprimée, type conservé |
| Unicité | OK : deux créations simultanées donnent 201 / 409 ; aucune seconde ligne |
| Validation effectif | OK : valeurs invalides refusées sans modification |
| Annulation | OK : comparaison de la ligne persistée avant/après annulation et fermeture |
| Persistance | OK : fermeture puis réouverture du dossier PGlite et du serveur ; suppression conservée |
| Recalcul | OK : nouvelles ouvertures de fiche, commande service/jour/semaine et allergènes ; cycles fondés sur les occurrences |
| Responsive / tactile | OK : panneaux dans le viewport à 1024 et 390 px, boutons ≥ 48 px, taps testés |
| Échecs | OK : type absent et refus réseau simulé ne produisent ni écriture erronée ni faux succès |
| Bibliothèque | OK : comparaison exacte de services types, recettes, ingrédients, relations, préparations et conversions avant/après |
| Services servis | OK : les trois opérations sont refusées ; le snapshot reste inchangé |

`pwa/audit.test.js` utilise un dossier de base temporaire et vérifie l’API réelle, les documents et le redémarrage. Le parcours navigateur automatisé utilise une autre base temporaire pour les actions destructives. Les captures des panneaux sont ensuite réalisées sur les vraies données, sans enregistrer ni confirmer de suppression. Les changements que l’utilisateur avait déjà faits dans son planning sont conservés.

Les documents HTML déjà ouverts représentent leur dernier chargement ; les liens et la réouverture recalculent les données, sans cache de totaux. Les PDF archivés restent explicitement des références/exemples et ne sont pas présentés comme les résultats d’un planning modifié.

Captures : `apercu-gestion-service.png`, `apercu-remplacement.png`, `apercu-suppression.png`. Suite complète : `node outputs/moteur-v0/run-tests.js`.
