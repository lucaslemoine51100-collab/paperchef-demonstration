# Cuisine : première PWA manipulable

La bibliothèque propose les services types et les plats réutilisables. L’éditeur guidé assemble des plats partagés, permet leur remplacement et duplique les services sans copier les recettes. Voir [le guide et les contrôles](BIBLIOTHEQUE_EDITEUR.md).

## Ouvrir l’application

L’adresse locale est **http://127.0.0.1:8787**. Le serveur est lancé pour cette livraison.

Pour la relancer plus tard :

1. Double-cliquez sur **Lancer-V0.cmd** dans ce dossier.
2. Gardez cette fenêtre ouverte et ouvrez l’adresse ci-dessus dans votre navigateur.
3. Pour arrêter le serveur, utilisez **Ctrl+C** dans sa fenêtre.

Autre possibilité depuis le dossier de travail : `node outputs/moteur-v0/pwa/server.js`. Node.js est déjà disponible sur ce poste. Aucun téléchargement de dépendance n’a été nécessaire : le serveur utilise le runtime PostgreSQL embarqué PGlite déjà installé dans ce projet.

## Utilisation

- **Semaine** : choisir une semaine existante, consulter les sept jours et les quatorze créneaux, cliquer sur une case vide pour choisir un service type et saisir un effectif. Un service enregistré ouvre sa consultation, permet de modifier son effectif s’il n’est pas servi et donne accès à ses documents.
- **Nouvelle semaine** : choisir un lundi et un nom. La semaine est créée avec quatorze cases vides, sans affectation automatique.
- **Bibliothèque** : consulter les quatre services types, leurs fonctions, composants visibles et références de couverts ; rechercher par nom ou composant ; planifier un type dans un créneau libre de la semaine sélectionnée.
- **Documents** : ouvrir la fiche technique d’une occurrence, sa commande, la commande semaine ou la fiche allergènes. Le bouton « Imprimer / enregistrer en PDF » utilise la fonction d’impression du navigateur. Les documents sont recalculés depuis les repositories et ViewModels existants au moment de l’ouverture.
- Les **PDF existants** sont proposés séparément comme références et exemples conservés. Ils ne sont pas écrasés par l’application et ne remplacent pas les documents du planning actuel.

La semaine enregistrée du 5 au 11 octobre 2026 comporte quatre services de 100 couverts et dix cases vides. La PWA ne crée aucune donnée de démonstration au démarrage. Toutes les modifications effectuées dans l’interface sont de vrais enregistrements dans la base du projet.

## Windows, tablette, téléphone

Les jours sont affichés en sept colonnes sur grand écran, quatre sur tablette large, deux sur écran intermédiaire et en cartes verticales sur téléphone. Les actions principales ont une cible tactile d’au moins 48 px. Les formulaires utilisent des champs natifs avec clavier numérique pour l’effectif.

Le manifeste, les icônes 192/512 et le service worker permettent l’installation lorsque le navigateur la propose. Sur ce PC, utilisez l’action **Installer** si elle apparaît, ou l’action d’installation du navigateur.

Pour consulter depuis un iPad ou téléphone sur le même réseau, arrêter d’abord le serveur local puis le lancer dans PowerShell avec :

```powershell
$env:HOST = '0.0.0.0'
node outputs/moteur-v0/pwa/server.js
```

Sur l’autre appareil, ouvrir `http://ADRESSE-IP-DU-PC:8787` avec l’adresse IPv4 du PC. Cette V0 est destinée à un réseau local de confiance ; elle ne possède pas de comptes utilisateurs. L’installation PWA sur un appareil distant nécessite un accès HTTPS ; la consultation responsive fonctionne via cette adresse HTTP.

Le serveur doit rester démarré pour lire et enregistrer le planning. Seuls les fichiers de l’interface sont mis en cache hors ligne : aucune copie indépendante des données métier n’est stockée dans le navigateur. Une interruption de connexion est signalée clairement et aucun faux service n’est affiché.

## Source des données et architecture

Le chemin par défaut est la base persistante **work/persistence-tests/sheets-reference-db** du projet. Les repositories de planification existants effectuent toutes les opérations. Le serveur expose une API HTTP légère ; il sérialise les accès sur la connexion réservée pour éviter le chevauchement des transactions du repository.

```text
Interface → API locale → PlanningRepository / PostgresRepository
          → base PostgreSQL existante
          → calcul commun et ViewModels existants
          → écrans / documents
```

Aucun ingrédient, recette, calcul de quantité, conversion ou allergène n’est saisi dans l’interface. Le navigateur ne contient pas un second catalogue : les listes affichées sont des projections chargées depuis l’API. La bibliothèque utilise les références de service, et la semaine utilise les occurrences réellement planifiées.

La configuration facultative `PWA_DATA_DIR` change le dossier de base PGlite ; `PORT` change le port. Une connexion PostgreSQL externe peut être configurée avec `DATABASE_URL` si le pilote `pg` est installé. Le package fournit la dépendance PGlite pour un environnement autonome ; dans le projet livré, la dépendance déjà installée est réutilisée. Une base externe nécessite les migrations existantes ; la PWA ne la remplit jamais automatiquement avec un planning fictif.

## Vérifications

`node outputs/moteur-v0/run-tests.js` lance toute la suite : métier, persistance, documents, allergènes, planification et API PWA. Les tests API vérifient les quatre occurrences, dix cases vides, bibliothèque, enregistrement, recalcul, création de semaine vide, documents et refus d’entrées indépendantes.

Des vérifications navigateur automatiques ont également parcouru la navigation, la recherche, l’ajout d’un service à 170 couverts puis son passage à 160, les documents et la création d’une semaine vide. Elles utilisent une base temporaire séparée : les captures des écrans principaux sont ensuite faites sur la vraie base en lecture seule. Aucun débordement aux largeurs 1440, 1024 et 390 px et aucune erreur JavaScript n’ont été détectés.

Les fichiers `apercu-semaine.png`, `apercu-bibliotheque.png`, `apercu-documents.png`, `apercu-mobile.png` et `apercu-tablette.png` présentent les écrans livrés. Le moteur, les recettes, les règles, les conversions et les PDF existants restent inchangés. L’édition des recettes et les règles réglementaires détaillées sont hors périmètre de cette V0.

Résultat de livraison : **94 tests réussis, aucun échec**, plus les parcours navigateur automatiques. Le contrôle du manifeste et des critères d’installation dans un profil Edge normal ne signale aucune erreur ; le service worker est actif.

## Gestion des créneaux remplis

Le panneau de service propose Modifier l’effectif, Remplacer le service et Supprimer le service. Le remplacement conserve l’occurrence et son créneau ; l’effectif est conservé par défaut et reste modifiable. La suppression exige une confirmation dédiée et ne retire que l’occurrence. Annuler ou fermer n’écrit rien. Les services servis restent en lecture seule.

Les trois actions rafraîchissent le planning après enregistrement. Une commande du jour, calculée à partir des occurrences actuelles, est accessible dans le panneau. Le rapport et les preuves de vérification sont décrits dans [AUDIT_FONCTIONNEL.md](AUDIT_FONCTIONNEL.md).

## Améliorations de clarté

La bibliothèque propose des filtres par catégorie avec les pictogrammes et couleurs du référentiel cuisine. Les catégories restent nommées : la couleur n’est pas le seul repère. L’éditeur de plat rappelle sa catégorie et l’éditeur de service propose trois accès : composition, recettes, aperçu.

Sur téléphone, la semaine affiche un jour à la fois. Les flèches, le choix du jour et « Voir les 7 jours » naviguent dans les quatorze créneaux existants, sans créer de services.

Avant un PDF, un récapitulatif lit les occurrences actuelles et indique les services, les couverts, les jours et les consignes de recto verso. Le nombre de pages est consultable dans le PDF généré. Les gabarits PDF et le moteur restent inchangés.

Le message après retrait propose « Annuler ». Le retrait d’un plat ou service utilise les opérations de restauration et le contrôle de version existants. La suppression d’une occurrence peut être annulée pendant dix minutes, dans le serveur courant ; un redémarrage expire cette possibilité. Si son créneau est occupé, la restauration est refusée sans remplacer le nouveau service. La suppression définitive et les services déjà servis restent protégés.

## Parcours, favoris et effectifs groupés

« Modifier les effectifs » présente les sept jours avec Midi et Soir. La saisie ne concerne que les services déjà planifiés. Un effectif commun peut être appliqué aux services modifiables avant enregistrement. Le repository enregistre les changements dans une transaction unique et contrôle les dates de modification : aucun enregistrement partiel si un service est clôturé, déplacé ou modifié entre-temps.

La recherche de planification retrouve un menu ou un plat et se combine avec les filtres Végétarien / Viande + poisson. Les favoris ne conservent que des identifiants de service dans les préférences de ce navigateur ; ils ne dupliquent aucune recette et ne sont pas synchronisés entre appareils.

Les repères « À compléter » proviennent des besoins de composition existants, des ingrédients calculés et des étapes des recettes. Ils ouvrent la zone concernée. L’éditeur de plat rappelle les services qui utilisent la recette ; les services déjà clôturés restent protégés.

Le bouton Aide propose trois parcours facultatifs : planifier, composer un service type, imprimer. Le tutoriel indique une progression, souligne les boutons concernés, permet Retour / Suivant / Passer / Quitter et reste utilisable au-dessus d’un formulaire. Il ne crée aucune donnée automatiquement. Une vraie planification exige toujours l’enregistrement explicite du formulaire. Les réglages de recettes, conversions, calculs et gabarits PDF restent inchangés.
