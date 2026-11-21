# LASSO Pipeline Desktop

Application de bureau locale pour préparer, lancer, suivre et exporter des analyses HRMS avec la pipeline d’identification LASSO.

## Fonctionnalités

- moteur scientifique local et sécurisé ;
- création et persistance des analyses ;
- sélection native des fichiers d’entrée ;
- transfert en flux des fichiers volumineux ;
- suivi des traitements longs ;
- récupération et relance des jobs interrompus ou en erreur ;
- inventaire, ouverture et export des résultats ;
- exécution autonome sans installation séparée de Python.

## Formats d’entrée

| Catégorie | Formats acceptés |
|---|---|
| Calibration CCS | .csv |
| Base d’identification | .h5, .hdf5 |
| Blanks | .parquet |
| Échantillons | .parquet |

Le traitement des échantillons exige deux types de fichiers : le fichier de calibration CCS au format CSV et au moins un fichier échantillon au format Parquet.

## Étapes disponibles

1. calibration CCS ;
2. base d’identification ;
3. détection des fichiers ;
4. traitement des blanks ;
5. traitement des échantillons ;
6. alignement et identification des features ;
7. visualisations ;
8. similarités ;
9. catégories.

## Installation Linux

### Debian ou Ubuntu

    sudo apt install ./lasso-pipeline-desktop_0.1.0_amd64.deb

### AppImage

    chmod +x lasso-pipeline-desktop_0.1.0_amd64.AppImage
    ./lasso-pipeline-desktop_0.1.0_amd64.AppImage

### Fedora ou distribution compatible RPM

    sudo dnf install ./lasso-pipeline-desktop-0.1.0-1.x86_64.rpm

## Utilisation

1. démarrez le moteur local ;
2. ouvrez Nouvelle analyse ;
3. sélectionnez les étapes et les fichiers requis ;
4. cliquez sur Créer et lancer ;
5. suivez la progression dans Analyses récentes ;
6. consultez, ouvrez ou exportez les fichiers depuis Résultats.

## Stockage local

Les jobs sont conservés sous :

    ~/.local/share/fr.u-pec.leesu.lasso-pipeline/jobs/

Chaque job possède un dossier isolé contenant son fichier job.json, ses entrées, ses résultats intermédiaires, ses sorties et ses journaux. La désinstallation ne supprime pas automatiquement ces données.

## Jobs interrompus

Si l’application est fermée pendant une analyse, le job est marqué Interrompu au prochain démarrage. Son identifiant, ses fichiers et sa progression restent conservés. Les jobs en erreur ou interrompus peuvent être relancés depuis Analyses récentes.

## Sécurité locale

- écoute limitée à 127.0.0.1 ;
- port dynamique et jeton aléatoire par session ;
- authentification Bearer des routes API ;
- restrictions CORS pour Tauri ;
- contrôle des chemins, destinations et extensions ;
- écritures atomiques pour les uploads et exports ;
- arrêt du sidecar avec l’application.

## Configuration recommandée

- Linux x86_64 ;
- 4 Go de mémoire vive au minimum ;
- 8 Go ou plus recommandés pour les traitements scientifiques ;
- au moins 2 Go d’espace disque libre, hors données HRMS.

## Développement

Prérequis : Node.js 22, npm 10 ou supérieur, Rust stable, dépendances Linux de Tauri v2 et sidecar scientifique compilé pour la cible.

    npm ci
    npm run build
    cargo check --manifest-path src-tauri/Cargo.toml
    npm run tauri dev

La construction finale doit être réalisée sur un système de fichiers Linux natif, par exemple ext4 :

    npm run tauri build

Les paquets sont produits sous src-tauri/target/release/bundle/.

## Sidecar scientifique

Pour Linux x86_64, le binaire attendu est :

    src-tauri/binaries/pipeline-api-sidecar-x86_64-unknown-linux-gnu

Le sidecar est construit depuis le dépôt pipeline_identification_ms avec PyInstaller. Il n’est pas versionné dans Git.

## Limites de la version 0.1.0

- publication limitée à Linux x86_64 ;
- paquets non signés ;
- absence de mise à jour automatique ;
- premier démarrage plus lent en raison de l’extraction du sidecar ;
- résultats scientifiques à valider selon les protocoles du laboratoire.

## Licence

Logiciel propriétaire. Tous droits réservés. Toute utilisation, reproduction, modification ou diffusion nécessite une autorisation écrite préalable du titulaire des droits. Consultez le fichier LICENSE.
