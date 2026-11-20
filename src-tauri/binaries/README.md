# Binaries Tauri

Ce dossier reçoit les sidecars construits localement ou par la CI.

Nom attendu sous Linux x86_64 :

pipeline-api-sidecar-x86_64-unknown-linux-gnu

Le binaire est produit depuis pipeline_identification_ms avec :

./scripts/build_sidecar.sh \
  /chemin/vers/lasso-pipeline-desktop/src-tauri/binaries

Les binaires ne sont pas versionnés dans Git.
