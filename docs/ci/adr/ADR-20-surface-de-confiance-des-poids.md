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

~~`[?]` **Reste ouvert, et écrit plutôt que comblé** : qu'un graphe ONNX forgé puisse à lui seul
induire ONNX Runtime à charger du code natif, sans appel d'enregistrement.~~ **RENDU le 21/08 :
il ne le peut pas, sur ORT 1.27.1 — voir l'amendement**, qui montre en outre que la raison est
plus forte qu'écrit ici (aucune structure du format ne nomme une bibliothèque). `[?]` **Ce qui
reste ouvert** est autre chose : une exécution obtenue par corruption mémoire dans le parseur ou
un noyau, et les paquets `win32-x64` / `linux-x64`, non inspectés.

**L'axe reste le couple et non le format**, et le 21/08 lui a donné son meilleur argument : le
`dlopen` que cette section cherchait existe bel et bien dans le binaire livré — **mais pour
(`.fst`, OpenFst)**, pas pour l'ONNX. Un format sûr chez un chargeur, dangereux chez un autre,
dans la même bibliothèque.

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
| nombres magiques du format | ~~qu'un ONNX ne charge pas d'opérateur natif `[?]`~~ **vérifié le 21/08 sur ORT 1.27.1 / `darwin-arm64` — passe à gauche, SOUS les réserves de l'amendement** (rien sur la corruption mémoire, `win32`/`linux` non inspectés) |
| rang de provenance du manifeste | ce que fait un processus Python après son démarrage |
| licence **déclarée** | licence **réelle** d'un poids |
| que le graphe NOMME un nœud inconnu à l'installation — vérifiable, **et sans valeur de garantie** | ~~qu'il n'en résolve pas un à l'exécution `[?]`~~ **mesuré le 21/08 : il en résout, par quatre chemins — voir l'amendement** |

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
| ~~Répondre au `[?]` d'ONNX Runtime : un graphe seul peut-il faire charger du code natif~~ **RENDUE le 21/08** | **NON** sur ORT 1.27.1 : le couple reste admis. Mais la campagne a trouvé le `dlopen` ailleurs — **(`.fst`, OpenFst) ne passe pas le critère**, voir l'amendement |
| ~~Un graphe peut-il résoudre un nœud non déclaré à l'exécution~~ **RENDUE le 21/08** | **OUI**, par quatre chemins mesurés. La vérification à l'installation ne prouve donc rien, et le § D est réécrit dans l'amendement |

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

---

## Amendement du 21 août 2026 — les deux `[?]` du § D sont rendus, et ils ne vont pas dans le même sens

### ONNX : le couple RESTE admis, pour une raison plus forte que celle qui était écrite

`[M]` Lu sur ONNX Runtime **1.27.1**, la version exacte qu'embarque `sherpa-onnx-darwin-arm64@1.13.5`.
**Un graphe seul ne peut pas faire charger de code natif.** Devant un domaine d'opérateur inconnu,
ORT **échoue, il ne cherche pas** (`graph.cc:3592-3608`, « is not a registered function/op ») — il
n'existe aucune branche « sinon, charger une bibliothèque nommée d'après le domaine ». `PyOp` /
`ENABLE_LANGUAGE_INTEROP_OPS`, le mécanisme historique qui aurait répondu « oui », est
**incompilable** : le dossier `language_interop_ops/` est absent de l'arbre, aucune option cmake ne
l'active, et le binaire livré n'en porte aucune chaîne. `external_data` est confiné — chemin absolu
refusé, canonisation, descendance vérifiée (`tensorprotoutils.cc:418-468`) — et **les trois messages
de cette garde sont présents dans le `.dylib` d'ici**, ce qui compte car la garde est récente.

**La nuance renforce l'ADR** : la sûreté ne tient pas seulement à ce que le studio s'abstienne
d'appeler `RegisterCustomOpsLibrary`. Elle tient à ce qu'**aucune structure du format ONNX ne
désigne une bibliothèque** — `FunctionProto` (`onnx.proto:947-990`) n'a ni champ chemin ni champ
bibliothèque, et ORT ne lit aucune option de session depuis le modèle.

`[?]` **Ce que ce verdict ne couvre pas, et qu'il ne faut pas laisser croire** : rien sur une
exécution obtenue par corruption mémoire dans le parseur protobuf ou dans un noyau CPU. Un `.onnx`
d'origine inconnue reste une entrée non fiable donnée à ~27 Mo de C++. Les paquets `win32-x64` et
`linux-x64` n'ont pas été inspectés.

### 🛑 Le vrai `dlopen` du dossier est ailleurs : (`.fst`, OpenFst) ne passe PAS le critère

`[M]` `libsherpa-onnx-c-api.dylib` **importe `_dlopen`**, alors que QNN — le seul `dlopen` des
sources de sherpa — n'est pas compilé dans ce binaire. Le site d'appel, retrouvé au désassemblage,
est `fst::GenericRegister::LoadEntryFromSharedObject`, et la chaîne `-fst.so` est dans le binaire.
`[D]` OpenFst : `Fst::Read`, devant un type d'arc inconnu, construit `<type>-fst.so` **depuis
l'en-tête du fichier lu** et le `dlopen`.

**C'est exactement la propriété que le critère du § A cherche, trouvée sur un format voisin.** Un
`.onnx` ne l'atteint pas ; un `.fst` — graphe HLG, lexique, deux objets courants en reconnaissance
vocale — l'atteint. **Ce couple est à évaluer séparément, et il ne passe pas tel quel.** Ne pas
laisser un `.fst` entrer dans la liste blanche par ressemblance avec l'ONNX.

### Runtime à graphe : la ligne du § D disait le contraire de ce qui est mesuré

`[M]` **Un graphe résout des types de nœuds non déclarés à l'exécution, par quatre chemins**, sur
ComfyUI (`76135e5`) comme sur InvokeAI (`8e71a8a`). **(1)** L'**expansion** : un nœud rend un
sous-graphe dont les `class_type` sont résolus **sans repasser par `validate_prompt`**
(`execution.py:589-596`), mécanisme officiel et documenté. **(2)** Le serveur **réécrit** un
`class_type` inconnu vers un autre **avant** de valider (`server.py:1110` avant `:1112`). **(3)** Un
type **connu** exécute du code fourni par le graphe — `GLSLShader` est un nœud **du cœur** dont
l'entrée est du GLSL libre (`nodes_glsl.py:695-711`) ; côté tiers c'est du Python — `[D]`
CVE-2024-21576, **CVSS 10.0**, avis publié et non lecture de source. **(4)** La table **change
entre deux vérifications** : ComfyUI-Manager fait
maintenant partie du produit (`cli_args.py:161-164`) avec installation par HTTP et un
`/manager/reboot` qui est un `os.execv`, et `--disable-manager-ui` laisse tourner les installations
programmées ; sur InvokeAI, `POST /api/v2/custom_nodes/install` fait `git clone` puis `exec_module`
**sans redémarrage**, sous un admin rendu **inconditionnel** quand `multiuser` est faux — le défaut.

`[M]` **Et le nom n'identifie rien** : un `class_type` du format API est un **nom nu**, sans
version ni éditeur ni espace de noms (`node_replace_manager.py:14-17`), et `/object_info` ne rend
aucune version. Le format *workflow* porte `cnr_id`/`ver`, **que rien dans le runtime ne lit**.
Piège pour une vérification naïve : dans un workflow à sous-graphes, `nodes[].type` rend un
**UUID**, les vrais types vivant dans `definitions.subgraphs[]`.

**La ligne du § D devient donc :**

> **La liste des types qu'un graphe NOMME est close et vérifiable ; ce que le graphe EXÉCUTE ne
> l'est pas, et aucune vérification statique ne le rendra tel.**

Ce qui borne l'exécution n'est pas une lecture du graphe mais **un runtime contraint** :
`--disable-all-custom-nodes` avec `--whitelist-custom-nodes`, `--disable-api-nodes`, pas de
Manager, et une revérification de la table **au moment de soumettre** plutôt qu'à l'installation.
`[D]` Le projet place lui-même la frontière du mauvais côté pour nous : son `SECURITY.md` exclut
« issues that require a specific custom node to be installed » et ne promet quelque chose que pour
un workflow « using only built-in nodes ». **Le § C tient donc plus que jamais** — un runtime que
la personne a démarré est le sien ; un runtime que le studio démarre engage le studio, et son jeu
de nœuds est de la surface de confiance.

`[?]` Rien n'a été exécuté : tout est lu en source. L'aplatissement des sous-graphes par le
frontend est `[D]` et non `[M]`.

### Deux pointeurs du corps à connaître

`[M]` `sttWorker.ts:79-89` (§ A) est court d'une ligne : `numThreads`, que la phrase cite comme
faisant partie de la configuration, est en **90**. Lire `:79-91`. `[M]` Et
`collect-licences.mjs:157` déclare ONNX Runtime en **`1.27.0`** quand le binaire livré rend
**`1.27.1`** — `THIRD-PARTY-NOTICES.md` et `src/shared/licences.json` sont donc générés faux.
Corriger le collecteur touche six fichiers ensemble (§ Conséquences) : **ce n'est pas fait ici**.
