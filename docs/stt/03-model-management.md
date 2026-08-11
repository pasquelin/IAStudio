# La dictée — le modèle

640 Mo, rapatriés une fois, jamais embarqués. Ce document dit d'où ils viennent, comment ils sont
vérifiés, et ce qui se passe quand ça tourne mal.

---

## Quatre fichiers, pas une archive

| Fichier | Poids |
|---|---|
| `encoder.int8.onnx` | 652 184 281 |
| `decoder.int8.onnx` | 11 845 275 |
| `joiner.int8.onnx` | 6 355 277 |
| `tokens.txt` | 93 939 |

Le dépôt de sherpa-onnx publie aussi une archive `.tar.bz2` de 487 Mo. Les fichiers séparés lui
ont été préférés pour trois raisons, chacune vérifiée avant d'être retenue :

- **chacun accepte `Range`** (`accept-ranges: bytes`), donc un téléchargement coupé reprend où il
  s'est arrêté au lieu de recommencer ;
- **une empreinte par fichier** : un fichier abîmé coûte sa taille, pas les 640 Mo ;
- **aucune décompression** : pas de `tar`, pas de `bzip2` — que Windows a depuis peu et qu'un
  Linux minimal peut ne pas avoir.

Les empreintes SHA-256 des trois `.onnx` sont les identifiants d'objets LFS que HuggingFace
publie ; celle de `tokens.txt`, qui n'est pas en LFS, a été calculée à la main. Elles vivent dans
`shared/domain/dictation.ts`, avec les tailles, et un test vérifie que le total correspond à ce
que la barre de progression compte.

---

## Où il atterrit

`app.getPath('userData')/models/stt/` — à côté de `settings.json`, dans le dossier de l'utilisateur.

Le réglage **« Dossier du modèle »** pointe ailleurs : un modèle déjà présent sur la machine, un
disque externe, un dossier partagé entre plusieurs comptes. Il est relu à chaque appel plutôt que
retenu, parce qu'un réglage peut changer pendant que le studio est ouvert.

---

## La règle : rien de non vérifié n'est jamais lisible au chemin que le moteur ouvre

C'est celle que `fetch-ffmpeg.mjs` applique au build ; elle est ici appliquée à l'exécution.

```
téléchargement ──▶ <nom>.part ──▶ empreinte calculée au fil de l'écriture
                                        │
                       ✗ ne correspond pas ──▶ le .part est SUPPRIMÉ
                       ✓ correspond ──────────▶ rename atomique ──▶ <nom>
```

L'empreinte est calculée **pendant** l'écriture, pas en relisant le fichier : l'encodeur fait
652 Mo, et le garder en mémoire pour le hacher coûterait plus cher que de le télécharger.

Un fichier qui a échoué son empreinte est supprimé, pas gardé pour un essai suivant : il n'a rien
qui vaille d'être repris, et le laisser ferait reprendre la prochaine tentative depuis la
corruption.

---

## Les trois refus de la reprise

Un `.part` n'est pas une reprise valable dans tous les cas, et chacun de ces trois cas a été
écrit parce qu'il produirait sinon un modèle qui charge et ne reconnaît rien.

**Le serveur a ignoré le `Range`.** Il répond 200 avec le fichier entier au lieu de 206 avec la
suite. Ce qui est sur le disque n'est alors pas un préfixe de ce qui arrive : le `.part` est jeté
et l'écriture repart du début. Ajouter à la suite construirait un fichier faux qui ne se
dénoncerait qu'à l'empreinte, très loin de là.

**Le `.part` est au moins aussi long que le fichier qu'il prétend être.** L'URL a tourné, ou deux
exécutions ont écrit ensemble. Recommencer coûte un téléchargement ; lui faire confiance
coûterait un modèle silencieusement faux.

**Un `.part` orphelin traîne, et rien ne le balaie.** C'est délibéré : le balayer serait perdre
ce qui est déjà arrivé, alors qu'une reprise repart précisément de là. Un reste qui ne serait pas
un préfixe de ce qu'on télécharge ne survit pas non plus — il échoue à son empreinte et se supprime
à ce moment-là.

> **Ce document a dit le contraire.** Un balayage existait, retiré par `112706ef` — « Le
> téléchargement ne reprenait jamais » — après la rédaction de cette note. Le commentaire de
> `src/main/services.ts:611` porte désormais la règle : « Nothing sweeps the `.part` files first,
> and that is the point ».

Sur une reprise, l'empreinte couvre **ce qui était déjà là autant que ce qui arrive** — sans quoi
un préfixe corrompu passerait sans bruit.

---

## La progression, et l'annulation

`{ received, total }` compte les octets **sur l'ensemble du modèle**, jamais dans le fichier en
cours : c'est la même règle que l'import de médias, où une barre veut dire la même chose à toutes
les étapes.

Les fichiers sont pris l'un après l'autre. Quatre flux parallèles d'un fichier de 652 Mo sur une
seule connexion ne finissent pas plus tôt et rendent la progression illisible.

L'annulation passe par un `AbortSignal`, vérifié entre deux chunks. Ce qui est arrivé **reste** :
la tentative suivante reprend depuis là. Un téléchargement annulé n'est pas une panne — l'état
revient à « le modèle manque », pas à « erreur ».

---

## Ce que l'interface montre

| État | Ce qui s'affiche |
|---|---|
| `modelMissing` | ce qui manque, sa taille, et un bouton pour le rapatrier |
| `downloadingModel` | une barre, et un bouton pour interrompre |
| `modelChecksumMismatch` | « Le modèle téléchargé est abîmé ; il a été supprimé. » |
| `modelDownloadFailed` | « Le téléchargement du modèle a échoué. » |

Les deux derniers sont distingués parce qu'ils mènent ailleurs : un réseau qui a lâché vaut la
peine d'être réessayé, un fichier qui a échoué son empreinte a déjà été supprimé.

**Rien n'est téléchargé au démarrage**, jamais. La demande vient de l'utilisateur, et d'un clic.

---

## Rendre la mémoire

Le modèle chargé occupe environ 700 Mo dans le `utilityProcess`. Le réglage **« Libérer la
mémoire après »** relâche le moteur après un temps sans dicter — dix minutes par défaut, `0` pour
le garder en permanence. Il se recharge tout seul à la dictée suivante, en quelques secondes.

Le déchargement n'a jamais lieu au milieu d'une phrase : le moteur tient de l'audio qui n'a pas
encore été transcrit.

Les fichiers, eux, restent sur le disque. Les enlever se fait à la main, dans le dossier ci-dessus.
