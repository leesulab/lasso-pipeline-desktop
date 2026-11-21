# Journal des modifications

Toutes les modifications notables de LASSO Pipeline Desktop sont documentées dans ce fichier.

Le format s'inspire de Keep a Changelog et le projet utilise une numérotation de version sémantique.

## [Non publié]

### Prévu

- builds Windows et macOS ;
- signature des paquets ;
- mise à jour automatique ;
- amélioration de l'affichage des résultats scientifiques.

## [0.1.0] - 2026-11-21

### Ajouté

- application de bureau Tauri v2 avec interface React et TypeScript ;
- moteur scientifique FastAPI exécuté sous forme de sidecar autonome ;
- génération d'un port dynamique et d'un jeton local par session ;
- authentification Bearer des routes API ;
- création et persistance des jobs ;
- sélection des neuf étapes de la pipeline ;
- boîtes de dialogue natives pour les fichiers d'entrée ;
- prise en charge des fichiers CSV, Parquet, H5 et HDF5 ;
- transfert multipart en flux par le backend Rust ;
- suivi durable des traitements longs ;
- récupération des jobs interrompus après redémarrage ;
- relance des jobs interrompus ou en erreur ;
- inventaire des fichiers d'entrée, intermédiaires, de sortie et des journaux ;
- ouverture des fichiers avec les applications du système ;
- export sécurisé vers un emplacement choisi ;
- paquets Linux DEB, RPM et AppImage ;
- bundle scientifique PyInstaller autonome.

### Sécurité

- écoute limitée à l'interface locale 127.0.0.1 ;
- jeton aléatoire non exposé dans les journaux ;
- comparaison sécurisée du jeton ;
- restriction CORS aux origines Tauri autorisées ;
- contrôle des destinations et extensions d'upload ;
- limite configurable de taille par fichier ;
- protection contre la traversée de répertoires ;
- écriture atomique des uploads et des exports ;
- arrêt du groupe de processus sidecar à la fermeture.

### Validation

- 36 tests automatisés de l'API FastAPI ;
- validation du sidecar PyInstaller autonome ;
- validation de l'AppImage sur Linux x86_64 ;
- contrôle de l'absence de bibliothèques dynamiques manquantes.
