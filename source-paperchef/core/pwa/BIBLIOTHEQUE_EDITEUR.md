# Éditeur de services types et plats réutilisables

## Utilisation

Dans **Bibliothèque**, deux vues donnent accès aux **Services types** et aux **Plats réutilisables**. Elles lisent la base existante. La recherche et les filtres portent sur les noms et catégories du référentiel.

Créer un service suit quatre étapes :

1. **Informations** : nom, couverts de référence et mode Viande + Poisson ou Végétarien. La répartition validée 70/30 reste fixe.
2. **Composer le service** : ajouter un plat existant, le remplacer, le retirer, ou changer son ordre avec Monter / Descendre. Un retrait concerne seulement l’occurrence du service.
3. **Vérifier les recettes** : consulter la complétude et ouvrir les plats à compléter.
4. **Aperçu** : consulter les composants et avertissements, puis prévisualiser la vraie fiche technique calculée.

Les actions Annuler, Prévisualiser et Enregistrer restent accessibles en bas du dialogue. Les boutons conviennent au tactile. Le téléphone conserve des cartes verticales et la progression sur deux lignes.

Un plat s’édite avec les onglets **Ingrédients**, **Préparation**, **Repères de fabrication**, **Allergènes**, **Options avancées**. La recette de référence précise le nombre de portions ou d’unités produites. La table conserve les quantités exactes et propose recherche, unité, QS et suppression. Les étapes disposent de boutons Ajouter, Supprimer, Monter et Descendre. Les repères utilisent l’éditeur cuisine existant. Les allergènes sont calculés côté serveur et restent en lecture seule.

**Enregistrer le plat** met à jour sa recette partagée pour tous ses futurs services. Ce bouton est distinct de l’enregistrement de l’assemblage : annuler ensuite le service n’annule pas une modification de plat déjà enregistrée. Le bandeau du plat explique ce partage. Un nouveau plat créé depuis un service est enregistré dans la bibliothèque globale, puis ajouté au brouillon du service.

**Dupliquer** un service crée un nouvel assemblage qui référence les mêmes plats et recettes. Aucun ingrédient ni repère n’est recopié. Les préparations communes et liens de sauce restent des associations du service. Les dépendances déclarées sont ajoutées ensemble lorsqu’un plat les nécessite ; elles ne sont pas devinées à partir de son nom. Un remplacement qui supprimerait des liens de préparation commune est signalé explicitement, plutôt que de les perdre silencieusement.

La création d’un ingrédient utilise le catalogue existant et refuse les noms et alias déjà connus. Une nouvelle référence garde le statut d’allergènes à vérifier. Aucune correspondance approximative ne crée une référence automatiquement.

## Audit et correction minimale

Avant cette évolution, `recipes` et leurs ingrédients existaient indépendamment, mais `components` portait le nom, les catégories et les associations de chaque service. La duplication copiait toutes les recettes ; modifier une recette partagée la détachait du service source. Ce fonctionnement ne permettait pas une bibliothèque de plats dont l’édition serait commune.

Les migrations **010** et **011** ajoutent :

- `dishes` : identité du plat, recette unique référencée, nom, statut, version et références de configuration ;
- `dish_categories` : catégories canoniques du plat ;
- `dish_rule_bindings` : références aux profils validés, utilisables même en l’absence d’une occurrence ;
- `dish_revisions` : anciennes versions du plat, incluant recette, étapes et repères ;
- `components.dish_id` : référence de l’occurrence du service vers le plat.

Les recettes, ingrédients, quantités, unités et définitions des règles restent dans les tables existantes. Les colonnes historiques de composant restent disponibles pour compatibilité ; lors de la lecture d’une occurrence liée à un plat, le repository projette son nom, sa recette, ses catégories et sa configuration canoniques. Elles ne constituent pas une seconde source de vérité pour le nouvel éditeur.

`DishRepository` réutilise `LibraryEditorRepository`, `PostgresRepository`, l’adaptateur persistant et le moteur existant. L’assemblage recharge les recettes depuis la base et ne permet pas de modifier une recette par la sauvegarde d’un service. Une édition de recette passe explicitement par l’enregistrement du plat. Les profils spécifiques, les allocations, les préparations communes et les conversions d’achat sont conservés.

Les routes publiques de duplication utilisent l’assemblage partagé. L’ancien importeur technique de graphes conserve sa politique de copie indépendante pour compatibilité avec les imports et tests historiques ; cette opération n’est pas utilisée par l’éditeur guidé.

Les écritures sont transactionnelles. Le plat et les services affectés reçoivent des versions et révisions. Une modification incompatible avec un service existant annule la transaction. Une version périmée est refusée. Le frontend ne remplace sa version attendue après une édition de plat que si la version précédente correspond réellement à son brouillon.

## Documents et historique

L’aperçu d’assemblage utilise `toDomain` → calcul existant → `TechnicalSheetViewModel` → `renderTechnicalSheet`, comme la génération PDF. Les fiches, commandes et allergènes des services planifiés lisent les mêmes références actuelles. Il n’existe aucun calcul de quantité dans l’interface.

Les services servis continuent à lire leur `frozen_snapshot`. Une modification ultérieure de plat ne réhydrate pas ce snapshot avec les données actuelles. Ses composants, recettes, étapes, ratios et quantités restent conservés.

`engine.js`, les recettes de référence, les règles validées, les conversions et les gabarits PDF n’ont pas été modifiés. Les ViewModels des quatre services réels ont été comparés avant et après migration : égalité stricte.

## Contrôles et captures

La suite inclut les tests existants et les nouveaux tests de modèle et navigateur. Le scénario Carbonnade/Limande dupliqué puis Frites → Purée vérifie les identités des recettes restantes, la fiche, les allergènes et la commande. La Purée est une **fixture dans une base isolée** ; sa recette ne prétend pas être une nouvelle référence métier validée et n’est pas ajoutée à la base réelle.

Les parcours navigateur couvrent création, recherche, ajout, remplacement, retrait, réorganisation, ingrédient, étape, repère, aperçu et sauvegarde. Les vues iPad (768 × 1024) et téléphone (390 × 844) sont contrôlées sans débordement ni erreur JavaScript. Il s’agit de simulations dans Edge, et non d’un essai physique sur iPad.

Captures sur la base réelle, sans enregistrement :

- `service-editeur-avant.png` / `service-editeur-apres.png` : même service et même fenêtre avant/après ;
- `service-assemblage-complet.png` : les cinq cartes dans une fenêtre plus haute ;
- `service-informations.png`, `bibliotheque-plats.png` ;
- `plat-ingredients.png`, `plat-preparation.png`, `service-apercu.png` ;
- `service-ipad.png`, `service-telephone.png`.

## Lancement

Double-cliquer **Lancer-V0.cmd**, puis ouvrir **http://127.0.0.1:8787/?v=assemblage-plats#bibliotheque**. Depuis le dossier de travail, la commande équivalente est `node outputs/moteur-v0/pwa/server.js`. Le démarrage applique les migrations manquantes sans recréer la base.

Tests : `node outputs/moteur-v0/run-tests.js`.

Résultat de la suite complète : **186 tests verts, 0 échec**, dont les 166 tests existants et 20 nouveaux contrôles de modèle et navigateur. Durée de cette exécution : environ 57 secondes.

Les variantes et copies de recettes déjà présentes avant cette évolution restent distinctes : aucune fusion n’est effectuée sur une simple ressemblance de nom. La nouvelle duplication et le nouvel assemblage ne créent plus ces copies. Un même plat sélectionné depuis le référentiel conserve désormais sa recette unique dans tous ses services.

## Simplification de l’éditeur — dernière version

Depuis Bibliothèque, « Modifier le service » ouvre directement un écran unique : informations, plats, ajout/remplacement, aperçu et enregistrement. Les étapes Composer/Vérifier/Aperçu ne constituent plus des écrans successifs. La consultation par le titre du service reste disponible.

La fiche du plat utilise quatre onglets : Ingrédients, Préparation, Repères de fabrication, Allergènes. Les options avancées sont séparées ; le nom de recette synchronisé et la référence déjà éditée dans Ingrédients n’y sont plus affichés. Les catégories sont repliées pour les plats existants et ouvertes à la création. Retrait et déplacement sont regroupés dans « Autres actions ».

« Enregistrer le plat » conserve son effet global sur les utilisations futures. Un message persistant au retour précise que le plat est déjà enregistré. « Enregistrer le service » concerne ses informations et sa composition ; annuler le service ne révoque pas une modification de plat déjà enregistrée. Les règles, recettes, conversions, moteur et gabarits PDF restent inchangés.

Vérification : 186 tests verts, 0 échec, avec parcours de remplacement Frites/Purée, quantité, étape, repère, création, retrait, aperçu et sauvegarde. Les assertions de présentation ont été adaptées à l’écran unique et aux quatre onglets, avec contrôle de l’absence des champs redondants dans les options avancées. Responsive vérifié à 768 × 1024 et 390 × 844 dans Edge ; aucun essai physique sur iPad.

Captures : `service-simplifie.jpg` et `plat-simplifie-telephone.jpg`.

## Saisie des ingrédients simplifiée

Les lignes affichent désormais un seul bouton portant le nom de l’ingrédient, la quantité exacte, l’unité, QS et une suppression discrète. Cliquer sur le nom ouvre la recherche dans le catalogue existant ; aucune liste indépendante n’est créée.

« Ajouter un ingrédient » ouvre la même recherche avant toute insertion. Annuler ou rechercher sans résultat ne crée aucune ligne. Après choix explicite, l’unité proposée vient du catalogue et la quantité est vide, à renseigner avant enregistrement. Rechoisir le même ingrédient conserve exactement la quantité et l’unité existantes, même en g ou ml.

La recherche ignore les accents et la casse. Les résultats sont des boutons accessibles au clavier et au tactile. Les valeurs internes, conversions, règles métier et documents restent inchangés. Captures : `ingredients-simples.jpg` et `ingredients-simples-telephone.jpg`.

## Plats partagés, variantes et suppression restaurable

La fiche d’un plat affiche la liste des services types qui l’utilisent. « Enregistrer le plat partout » modifie ses utilisations futures ; les occurrences clôturées gardent leurs snapshots.

Depuis un service, « Créer une variante pour ce service » copie les ingrédients, étapes, repères, catégories et références aux règles. L’original reste inchangé. L’utilisateur modifie et nomme la variante, la crée, puis enregistre le service pour confirmer son association. L’identité du composant est conservée : liens de sauce, allocations, apports et position restent valides. Une variante créée reste un plat de bibliothèque même si l’assemblage du service est ensuite annulé.

Sur les cartes de services types, « Supprimer le service type » le retire de la bibliothèque normale par désactivation, avec confirmation. Cette suppression est restaurable via « Voir les services retirés » puis « Restaurer ». Aucun effacement physique ni suppression des recettes, du planning ou des documents clôturés. Les services retirés ne peuvent plus être choisis pour une nouvelle planification.

Contrôles : 188 tests verts ; le parcours navigateur variante/suppression/restauration est testé dans une base isolée. Une nouvelle vérification ciblée des 10 tests navigateur passe après le ciblage explicite du composant. Les quatre services de référence conservent les règles et les dépendances lors de la création d’une variante.

## Étape 1 — Retrait restaurable des plats

Dans Bibliothèque → Plats réutilisables, « Supprimer de la bibliothèque » retire le plat des nouveaux choix. La confirmation présente les services qui l’utilisent et précise que leur contenu reste conservé. Aucun plat réel n’a été supprimé pendant la vérification visuelle.

« Voir les plats retirés » affiche les entrées désactivées, avec l’action « Restaurer le plat ». Le catalogue normal et les sélecteurs d’ajout/remplacement n’affichent que les plats actifs. Les recettes, liens, services existants et historique restent conservés. L’API contrôle la version et enregistre une révision du plat ; un conflit n’écrase aucune donnée.

Validation : 190 tests verts, dont retrait/restauration navigateur, absence de ligne dans la liste normale, recettes inchangées, plat inutilisé et conflit de version. Prochaine étape proposée : besoins du menu visibles, puis planification dans un formulaire unique.

## Étape 2 — Composition guidée du menu

Un panneau « Les besoins du menu » présente Protéines, Féculent, Légume et Sauce avec états textuels. Service viande/poisson : viande ET poisson. Service végétarien : protéine végétarienne. Féculent et légume : au moins un. Sauce facultative. Un composant multicatégorie couvre plusieurs besoins selon ses catégories persistées ; les noms ne servent pas à déduire une catégorie.

Les boutons d’ajout ouvrent le sélecteur déjà existant avec le filtre approprié. Le panneau se recalcule après les modifications d’assemblage et lors du changement de type de service. Les protéines supplémentaires ou incohérentes sont signalées sans blocage. Ce guide est une aide de présentation ; aucun contrôle réglementaire ni modification du moteur n’est ajouté. L’enregistrement d’un service incomplet reste possible.

Validation : 194 tests verts. Tests supplémentaires sur viande/poisson, végétarien, plats composés, sauce facultative, doublons, absence de mutation, filtres d’ajout et sauvegarde d’un service incomplet. Vérification visuelle desktop et largeur téléphone sans débordement.

Le titre automatique du service est explicitement différé : voir PROCHAINES_ETAPES.md. Aucun nom de service réel n’a été modifié dans cette étape.

## Étape 3 — Titre automatique des services types

Le titre rassemble les composants actifs et visibles, selon leurs catégories persistées : protéine viande, protéine poisson, protéine végétarienne, féculent, légume, sauce. Un plat composé reste à sa place de protéine et n’est pas répété sous ses autres catégories. L’ordre au sein d’une famille reste stable. Les références répétées au même plat sont citées une seule fois ; les variantes distinctes ne sont pas fusionnées par leur nom.

Le champ de saisie du nom du service est remplacé par un titre calculé en lecture seule. Le titre suit les ajouts, remplacements, retraits et renommages de plats. Une seule fonction est partagée par l’interface et le serveur. Le serveur reconstruit le titre à partir des plats canoniques avant l’enregistrement de l’assemblage. Les services existants affichent immédiatement leur titre dérivé sans migration ni réécriture massive de leur historique.

Bibliothèque, recherche, semaine, fiches techniques et étiquettes des commandes utilisent ce titre. Les nouvelles occurrences clôturées figent leur titre avec leur snapshot. Les anciens snapshots gardent leur nom historique et leur ancien en-tête. Les calculs, quantités, allocations et conversions restent inchangés. Le snapshot de test HTML a été actualisé pour le nouveau titre.

Validation : 198 tests verts, puis 10 contrôles ciblés verts sur les titres et les fiches. La vérification navigateur couvre le titre après remplacement d’une garniture et le format téléphone sans débordement. Aucun service réel n’a été enregistré pendant la vérification visuelle. Prochaine étape : planification en un seul formulaire.

Correction Grana Padano : la finition fait partie des deux recettes de lasagnes (5 g par portion réelle), soit 350 g pour 70 portions bolognaises et 150 g pour 30 portions saumon. La béchamel conserve son Grana supplémentaire. Aucun changement du moteur. Migration 012 pour les bases existantes : déplacement des ingrédients, retrait du composant autonome et archivage de son ancien plat ; historiques servis préservés. Les commandes agrègent les ingrédients des deux recettes, sans contribution de menu artificielle.

Planification unifiée : ajout depuis Bibliothèque ou Semaine, modification du type/effectif/créneau, copie et déplacement entre semaines existantes. Un formulaire commun utilise les API persistantes. Les mutations sont atomiques, refusent les destinations occupées et les sources périmées/servies. Aucune duplication des recettes ; documents recalculés par les projections existantes. Guide : GESTION_SEMAINE.md.

Pictogrammes et documents : référentiel SVG centralisé cuisine-visuals.js pour les six catégories fonctionnelles, documents, Midi/Soir et actions de planification. Les plats composés montrent plusieurs catégories sans règle métier nouvelle. Documents rangés par semaine, jour puis service ; actions Voir / Imprimer / Télécharger utilisent les routes actuelles. Imprimer ouvre le PDF dans le lecteur du navigateur ; Télécharger demande le PDF en pièce jointe. Les anciens PDF restent des exemples séparés. Les templates PDF et le calcul des allergènes sont inchangés.
