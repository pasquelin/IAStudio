# ADR-20 — Ce que le studio accepte de charger, et de qui

- **Statut** : Proposé
- **Date** : 2026-08-21

**Provenance.** `[M]` mesuré — lu dans le dépôt, avec `fichier:ligne` · `[D]` documenté — source
nommée · `[?]` aucune donnée, et c'est dit.

## Contexte

C'est le seul contrat irréversible du lot : une fois expédié « le studio exécute ce que le
manifeste désigne », il ne se retire plus.

`[M]` L'intégrité est déjà solide et n'est pas le sujet : SHA-256 calculé **en flux**, `.part`
refusé s'il n'est pas un préfixe de ce qui arrive, suppression du `.part` sur échec de digest,
renommage atomique après vérification seulement (`main/dictation/modelDownload.ts:80-160`). Un
digest prouve que les octets correspondent au manifeste — **rien d'autre**.

## Décision

### A. La liste blanche porte sur des couples **(format, chargeur)**, pas sur des formats

> Un couple est admis si **le chargeur, tel qu'il est configuré ici, ne peut pas exécuter de code
> fourni par le fichier**.

| Couple | Exécution de code à la désérialisation | Décision |
|---|---|---|
| `safetensors` | Non — le format a été conçu pour cela `[D]` (projet safetensors, Hugging Face) | **admis** |
| `GGUF` | Non — conteneur binaire de tenseurs `[D]` (spécification GGUF, llama.cpp) | **admis** |
| `.pt` / `.bin` / `.ckpt` (pickle) | **Oui** — `pickle` exécute du code arbitraire à la lecture `[D]` (documentation Python du module `pickle`, avertissement de sécurité explicite) | **refusé** — pas « avec un avertissement » |
| ONNX × **sherpa-onnx-node tel qu'il est configuré ici** | `[M]` Le studio ne désérialise jamais l'ONNX : il passe des chemins à l'addon (`sttWorker.ts:79-89`), dont la seule configuration est `featConfig` + `modelConfig{transducer, tokens, modelType, numThreads}` — **aucun enregistrement de bibliothèque d'opérateurs**, et `shared/types/sherpa-onnx-node.d.ts` (`OfflineModelConfig`) n'expose aucun champ pour en faire un. `[M]` ONNX Runtime est chargé par l'addon, sous forme de dylibs embarquées dans ses paquets de plateforme (`scripts/collect-licences.mjs:154-166`). | **admis** — sur une propriété **mesurée du chargeur** |
| ONNX × chargeur exposant l'enregistrement d'opérateurs | `[?]` | **non admis tant que non vérifié** |

`[?]` **Reste ouvert, et écrit plutôt que comblé** : qu'un graphe ONNX forgé puisse à lui seul
induire ONNX Runtime à charger du code natif, sans appel d'enregistrement. Ce n'est pas répondable
en lisant ce dépôt — c'est une propriété d'ONNX Runtime, pas du studio. **C'est précisément
pourquoi l'axe est le couple et non le format** : ce qui rend l'ONNX de la dictée sûr aujourd'hui
est une propriété du chargeur, qui est mesurable ici, et non une propriété du format, qui ne
l'est pas.

### B. Trois rangs de provenance. Le rang décide, jamais l'URL ni le digest

| Rang | Origine | Admis |
|---|---|---|
| 1 | Manifeste **expédié avec l'application**, versionné avec le binaire | ce que la liste blanche admet |
| 2 | Manifeste servi par un point d'accès que le studio nomme | idem, plus une trace explicite de l'origine |
| 3 | Manifeste **fourni par la personne** | idem, **et l'action est explicite** — jamais la conséquence d'un clic sur « Installer » |

`[M]` `shared/domain/dictation.ts:171` est aujourd'hui un manifeste de rang 1 : les URLs et les
digests sont dans le binaire. C'est la référence à ne pas dégrader.

### C. Le Python d'un graphe est du Python

`[D]` Les nœuds tiers d'un runtime à graphe sont du code Python arbitraire, chargé au démarrage du
processus.

1. **Le studio n'installe jamais un nœud tiers pour le compte de la personne.**
2. **Un runtime que la personne a démarré est le sien** : on ne l'audite pas, on ne le tue pas, on
   constate son état.
3. **Un runtime que le studio démarre engage le studio** : son jeu de nœuds fait partie de la
   surface de confiance et se déclare au même rang que les poids.

`[M]` La posture correspondante existe déjà pour un serveur local, et se réutilise plutôt que de
s'inventer une seconde fois : `main/mcp/access.ts` (origine loopback vérifiée **avant** le jeton,
comparaison en temps constant, rebinding DNS refusé), `main/window/permissions.ts` (tout refusé
sauf `media`, et depuis la seule origine de l'application), `main/window/navigation.ts`. `[M]`
`electron-builder.yml` verrouille les fusibles — `runAsNode: false`,
`enableNodeCliInspectArguments: false`, `onlyLoadAppFromAsar: true` : un processus tiers démarré
par le studio ne doit pas rouvrir ce qu'ils ferment.

### D. La colonne de droite s'écrit, elle ne se comble pas

| Vérifiable avant exécution | Non vérifiable |
|---|---|
| digest et taille de chaque fichier `[M]` | ce que le modèle produit |
| nombres magiques du format | qu'un ONNX ne charge pas d'opérateur natif `[?]` |
| rang de provenance du manifeste | ce que fait un processus Python après son démarrage |
| licence **déclarée** | licence **réelle** d'un poids |
| que le graphe ne nomme aucun nœud inconnu à l'installation | qu'il n'en résolve pas un à l'exécution `[?]` |

Ce qui n'est pas vérifiable n'est jamais présenté comme vérifié.

### E. La licence voyage avec le poids

`[M]` Le collecteur lit les textes depuis `node_modules` pour la liste `SHIPPED`
(`scripts/collect-licences.mjs:22,39,255`) et **écrit à la main** les trois entrées que npm ne
décrit pas — dont le modèle Parakeet, « NOT shipped with the application : téléchargé au premier
usage », listé quand même parce que CC-BY-4.0 demande l'attribution
(`collect-licences.mjs:178-194`). Une entrée écrite à la main par modèle ne passe pas l'échelle :
le manifeste porte la licence, et le collecteur lit les manifestes.

## Alternatives écartées

- **Une liste blanche par format.** Contredite par le seul cas réel du dépôt : ce qui rend l'ONNX
  de la dictée sûr est une propriété **du chargeur tel qu'il est configuré**, pas du format.
- **Charger un format pickle avec un mode restreint.** `[?]` L'efficacité d'un tel mode dépend de
  la version de la bibliothèque et se règle en un paramètre. Un refus se relit ; une atténuation
  paramétrable se désarme en silence.
- **Faire du digest la racine de confiance.** Un digest authentifie des octets contre un
  manifeste, jamais un manifeste contre quelqu'un.

## Ce que cette décision ne tranche pas

Où les poids sont écrits sur disque · la déduplication entre modèles · si un rang 2 existera un
jour et qui le sert · si les manifestes sont signés, et par qui · comment un jeu de nœuds se
déclare · la politique d'usage commercial affichée à la personne, qui est un contrat produit et
non technique.

## Ce qui l'invaliderait

| Vérification | Résultat qui casse la décision |
|---|---|
| Recenser, parmi les modèles réellement visés, ceux qui n'existent **que** sous un format pickle | Si des modèles indispensables sont exclus, c'est un arbitrage explicite — jamais un assouplissement silencieux |
| Répondre au `[?]` d'ONNX Runtime : un graphe seul peut-il faire charger du code natif | Si oui, le couple ONNX × sherpa sort de la liste blanche telle qu'elle est écrite |
| Un graphe peut-il résoudre un nœud non déclaré à l'exécution | Si oui, la vérification à l'installation ne prouve rien, et il faut l'écrire |

## Conséquences

- `[M]` `SttModelFile` (`shared/domain/dictation.ts:155`) porte `role/name/url/bytes/sha256` —
  **ni format, ni licence, ni chargeur**. Il est l'ancêtre du manifeste et doit gagner les trois.
- `[M]` `main/dictation/modelDownload.ts` vérifie un digest et **ignore le format**. La liste
  blanche s'applique au point d'installation, pas au point de chargement.
- `[M]` `src/shared/licences.json`, `THIRD-PARTY-NOTICES.md` et `src/main/licences.test.ts` sont
  régénérés par `pnpm licences:collect` et gardés par une garde qui recalcule : la build échoue si
  l'un diverge. Faire lire les manifestes au collecteur touche les six fichiers ensemble.

**Fichiers** : `shared/domain/localModel.ts` *(neuf)* · `shared/domain/dictation.ts` ·
`main/dictation/modelDownload.ts` · `scripts/collect-licences.mjs` · `src/shared/licences.json`
*(généré)* · `THIRD-PARTY-NOTICES.md` *(généré)* · `src/main/licences.test.ts` ·
`main/mcp/access.ts` · `main/window/{permissions.ts,navigation.ts}` · `electron-builder.yml`.
