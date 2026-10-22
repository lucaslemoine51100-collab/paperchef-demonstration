# PaperChef — démonstration publique

Démo autonome de PaperChef, prévue pour GitHub Pages. Aucun hébergement payant ni serveur distant : les calculs et les PDF sont produits dans le navigateur.

## Utiliser la démonstration

Choisissez Cuisine, Magasin ou Diététique. Le catalogue et la semaine fournis sont des exemples. Vos essais restent dans votre navigateur ; ils ne sont pas partagés avec les autres visiteurs. « Réinitialiser la démonstration » retrouve les exemples de départ. Un seul onglet ouvre la même base de démonstration à la fois.

Le premier démarrage télécharge le moteur et le catalogue. Un navigateur récent avec JavaScript, WebAssembly et stockage local est nécessaire.

## Publier gratuitement sur GitHub

1. Créer un dépôt **public**, puis y déposer le contenu de ce dossier, sans `node_modules` ni données locales.
2. Dans **Settings → Pages**, choisir **GitHub Actions**. Le workflow inclus publie le dossier `docs` à chaque mise à jour de `main`.
3. Attendre que GitHub affiche l’adresse du site. Le dossier `docs` contient déjà le site prêt à servir, y compris le moteur PDF.

## Reconstruire

Installer Node.js, exécuter `npm install`, puis `npm run build`. Les sources applicatives sont dans `source-paperchef/` ; les adaptations de démonstration sont dans `worker.mjs` et `demo.js`. La construction régénère `docs/`.

Ne jamais remplacer `catalogue-demo.tar.gz` par une sauvegarde de travail contenant des comptes ou données privées. Aucun `test-data`, mot de passe ou accès à l’application locale n’est nécessaire pour publier la démo.

## Périmètre

Cette démonstration n’est pas un serveur de production partagé. Les comptes de rôle sont des profils de démonstration, sans authentification. Pour une installation professionnelle partagée, l’application serveur et sa base nécessitent une configuration distincte.
