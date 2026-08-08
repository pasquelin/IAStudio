# ADR-12 — Approvisionnement de ffmpeg

- **Statut** : Accepté — décision imposée par l'audit
- **Date** : 2026-08-08

## Contexte

`resources/ffmpeg/` (96 Mo) est gitignoré et téléchargé au packaging par le hook `beforePack`,
qui appelle `scripts/fetch-ffmpeg.mjs` pour l'architecture en cours. L'audit relève trois
problèmes que le passage en CI transforme de gêne en défaut :

1. **Aucune version n'est épinglée.** `evermeet.cx/ffmpeg/getrelease/zip` sert « la dernière
   version », BtbN sert `master-latest`. Deux builds du même tag peuvent embarquer deux ffmpeg
   différents.
2. **Le dossier est vidé avant chaque fetch** (`rmSync`). Deux packagings concurrents sur la même
   machine — les deux architectures macOS, par exemple — se corrompraient mutuellement.
3. **Le build macOS est en GPL-3.0-or-later**, Windows et Linux en LGPL. Tant que le packaging
   restait local la question dormait ; **publier est l'acte de distribution** qui déclenche
   l'obligation de fournir les sources correspondantes.

## Décision

- **Épingler une version par cible**, par URL versionnée et **somme de contrôle vérifiée** après
  téléchargement. Un binaire dont l'empreinte ne correspond pas fait échouer le build.
  `node scripts/fetch-ffmpeg.mjs --digests` recalcule la table lors d'une rotation.
- **Aligner les cinq cibles sur la série 7.1.** ffmpeg supprime et renomme des options d'une
  majeure à l'autre, et `src/main/media/runner.ts` construit une seule ligne de commande pour
  toutes les plateformes. Avant cet ADR, `getrelease` servait ffmpeg 9.0 sur `darwin-x64` face
  au 7.1.1 de `darwin-arm64` : deux Mac, deux encodeurs, deux comportements possibles.
- **Déclarer `concurrency: { jobs: 1 }`** dans `electron-builder.yml`, pour que deux cibles ne
  se disputent jamais le dossier. C'est le défaut actuel de l'outil ; l'écrire le rend
  intentionnel et le protège d'un changement de défaut.
- **Pas de cache CI pour `resources/ffmpeg`.** Le cadrage initial le prévoyait ; il ne tient pas.
  `beforePack` télécharge inconditionnellement à chaque cible, un cache restauré serait donc
  écrasé sans être lu. Pire, le dossier ne contient qu'une cible à la fois : sur macOS, où deux
  architectures sont packagées à la suite, l'état sauvegardé en fin de job serait celui du x64
  sous une clé qui prétend valoir pour la plateforme. Un cache inutile ou trompeur, au choix.
- **Conserver le ffmpeg GPL sur macOS.** Il est distribué comme **exécutable séparé**, lancé par
  `spawn` depuis un `utilityProcess` — jamais lié dans le processus de l'application, qui reste
  propriétaire. `NOTICE.txt` accompagne les binaires et indique où obtenir les sources.

## Alternatives écartées

- **Chercher un build macOS LGPL** pour aligner la licence sur les trois OS : aucune source
  fiable et maintenue pour `darwin-arm64` et `darwin-x64`, et produire le nôtre reviendrait à
  maintenir une chaîne de compilation ffmpeg.
- **Committer les binaires** : 96 Mo par cible dans l'historique, pour cinq cibles.
- **Ne rien changer** : chaque build dépendrait de la disponibilité de trois serveurs tiers, et
  deux releases du même tag ne contiendraient pas le même encodeur.
- **Télécharger ffmpeg à la première exécution** plutôt que l'embarquer : allégerait
  l'installeur de 96 à 160 Mo, mais transforme le premier lancement en dépendance réseau et
  déplace la question de la licence sans la résoudre.

## Conséquences

- Mettre à jour ffmpeg devient un geste délibéré : changer l'URL **et** la somme de contrôle.
- Une source tierce qui retire une version épinglée casse le build — franchement, et non en
  livrant silencieusement autre chose. `osxexperts.net` répond 503 sous sondage : c'est la source
  la plus fragile des trois, et la seule à servir `darwin-arm64`.
- Chaque job de packaging retélécharge ses 96 Mo, une fois par architecture. C'est le prix
  assumé de l'absence de cache ; il se compte en une à deux minutes par job.
- **L'obligation GPL est assumée en connaissance de cause.** Elle a été tranchée depuis, par
  l'[ADR-16](ADR-16-licence-du-projet.md) : les sources correspondantes — le tarball exact pour
  macOS, le commit compilé par BtbN pour les autres — sont jointes à chaque release par
  `fetch-ffmpeg.mjs --sources`. Le lien générique vers `ffmpeg.org/download.html` que cet ADR
  laissait dans `NOTICE.txt` ne satisfaisait pas la GPLv3 §6.
