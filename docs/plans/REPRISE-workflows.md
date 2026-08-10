# Reprise — chantier « workflows et node editor »

**À coller tel quel dans une nouvelle session.** Réécrit le 10 août 2026 à 15 h, après la fusion
du lot C3, du correctif `typesConnect`, du lot `getModel` et des quatre dettes de la revue C3.
**Les étapes 1 à 7 sont terminées ; restent l'étape 8 et l'étape 9.**

> ⚠️ **Deux dossiers que le prompt nommait n'existent plus sur le disque, et les chercher fait
> perdre un quart d'heure.** `docs/REPRISE.md` a été **fusionné dans `docs/todo.md`** par le commit
> `94567bf` : ses § 4 et § 3.6 sont devenus les § 6 et § 7. La version d'origine, plus détaillée,
> se relit par `git show 94567bf~1:docs/REPRISE.md`. Et **`docs/scenario-api/` n'est plus là non
> plus** — ni dans le dépôt principal, vérifié : `pnpm docs:scenario` le régénère, sinon le SDK
> dans `node_modules` et le MCP `scenario` font foi.

---

## Le prompt

> Tu finis le chantier « workflows et node editor » de Scenario Studio, dans
> `/Users/pasquelin/Applications/scenario`. Tu travailles en boucle : **un lot par tour**, du
> début à la fusion dans `develop`, et chaque tour se termine sur un dépôt propre.
>
> **Premier geste de CHAQUE tour, sans exception** — ton état vit sur le disque, jamais dans la
> conversation :
>
> ```bash
> cd /Users/pasquelin/Applications/scenario
> git log --oneline -15 && git status --short && git worktree list
> ```
>
> puis lis, dans cet ordre : **`docs/prompt-loop.md`** — le protocole d'un tour, il prime ;
> **`CLAUDE.md`** — les invariants ; **`docs/todo.md` § 5** — ce qui reste, à jour ; et **ce
> fichier**, pour les pièges déjà payés.
>
> **Ce qu'il reste, et rien d'autre :**
>
> 1. **Étape 8** — les onze types de nœuds qui n'ont ni face ni comportement. **Elle a été
>    dimensionnée : c'est au moins quatre lots**, dans cet ordre recommandé — `approval` d'abord
>    (le plus petit, mais il ajoute `awaiting-approval` à `JobStatus`, donc il change `isFinished`
>    et tout le reste se pose dessus), puis `transform` (du CEL, `@scenario-labs/sdk/tools/cel` est
>    déjà installé), puis `ifElse` (un query builder, format `WorkflowEditorConditionBlock`), puis
>    la paire `forEach`/`forEachEnd` (deux nœuds à l'écran, un seul `for-each` à la compilation).
> 2. **Étape 9** — import, export, publication.
> 3. **Les neuf dettes courtes** des revues du lot C2, listées au § 5.1 de `docs/todo.md` : à
>    prendre entre deux lots, jamais à la place d'un.
>
> **Definition of done à chaque lot, sans demander** : tests écrits avec le code, `pnpm validate`
> vert, passe de simplification, revue, mutation (« casse ton propre code et dis combien de
> mutations mordent »), commit, rebase, fusion, `pnpm validate` après la fusion.
>
> **Tu m'arrêtes** si une étape se révèle plus grosse ou plus petite que le plan, avec ta
> recommandation — et tu prends autre chose en attendant ma réponse plutôt que de bloquer.

---

## Le verrou de revue — RÉGLÉ le 10 août à midi, et voici ce qui marche

La definition of done exige `/code-review`, que **le modèle ne peut pas invoquer**. Le substitut
— deux agents de revue adverse — a fonctionné sur C0 et C2, puis quatre agents de suite n'ont plus
rendu que des notifications « disponible ». **Ce n'était pas le mécanisme, c'étaient les agents.**

Ce qui a marché au tour du lot C3, à refaire tel quel :

- **des agents NEUFS** à chaque lot, jamais un agent d'un tour précédent ;
- **deux angles séparés** — « défauts avec un scénario d'échec concret » d'un côté, « réutilisation,
  cohérence, altitude » de l'autre — chacun avec ses questions numérotées ;
- **une seule relance**, formulée « rends ton rapport maintenant, même partiel ; un rapport *rien de
  bloquant* est une réponse valide ». L'agent conception a rendu **quatorze constats sourcés** après
  cette relance ; l'agent correction n'a rien rendu, ni avant ni après. **Un sur deux suffit.**
- **lecture seule, et travail depuis le dépôt principal** (`git diff develop...feat/<nom>`), jamais
  dans le worktree de la session : un agent y a déjà effacé un refactor par `git checkout --`.

**Ne pas boucler** : une relance, puis on avance avec ce qu'on a — le harnais de mutation et une
relecture propre en plus.

**Et jamais d'accès en écriture au worktree où la session travaille** : un agent de revue a muté
un fichier pour vérifier qu'un test rougissait, puis l'a restauré par `git checkout --`, effaçant
un refactor en cours. Lui donner sa propre copie, ou exiger la lecture seule.

---

## L'état exact — au 10 août 2026, 15 h

**Fusionné dans `develop`** : les étapes 1 à 6 et 10, les lots A, B1, B2, C0, C1, C2, **C3**
(compiler et valider), **`typesConnect`** (le fil texte → prompt), **`getModel`** (les fils qui
arrivent dans le flow) et **les quatre dettes de la revue C3**. `pnpm validate` après la dernière
fusion : **470 fichiers, 6073 tests, exit 0**.

**Les étapes 1 à 7 sont terminées.** Il reste l'étape 8 et l'étape 9, et rien d'autre.

| Ce qui marche aujourd'hui | Ce qui ne marche pas |
|---|---|
| Le graphe est un espace : document `.graph`, palette, barre, `⌘Z`, inspecteur | Onze des quinze types de nœuds n'ont ni face ni comportement — c'est l'étape 8 |
| **Un nœud texte alimente le port prompt d'un générateur** — table de compatibilité dans `handles.ts` | Aucun import ni export de `.workflow.json` — c'est l'étape 9 |
| **Il s'exécute** : un bouton, un état par nœud, un cache qui ne relance que ce qui a changé | L'exécution n'a **jamais** été lancée contre l'API — vérification groupée à la fin, décidée avec l'utilisateur |
| Un nœud se marque comme résultat de l'App, et le graphe dit s'il compilerait et en combien d'étapes | Neuf dettes courtes des revues du lot C2, listées au § 5.1 |
| **Les fils entrant dans un générateur arrivent dans le flow compilé** (`getModel`, résolu avant le convertisseur) | `develop` porte un rouge intermittent qui n'est pas du chantier : `Library.test.tsx` |

> ⚠️ **`develop` est rouge par intermittence** sur
> `home/sections/Library.test.tsx > opens an asset the project has already fetched` — vérifié sur
> `develop` SEUL, sans aucun lot de ce chantier. Une autre session le chasse (commit `f2eec12a`).
> **Conséquence découverte le 10 août : quand la suite rougit, vitest n'évalue pas les seuils de
> couverture du tout** — la porte de couverture est donc désarmée tant que ce rouge dure.

## Les deux défauts que ce chantier a payés — corrigés, et la leçon qui reste

**`typesConnect` refusait le fil pour lequel l'espace existe.** Corrigé par une table de
compatibilité dans `handles.ts`, portant les deux seules paires qu'une App publique câble
(`image` → `image` 69 fois, `text` → `prompt` 25 fois, sur `wflow_H1bKz78jgpinWPKJfVCM5uAp`).

**La leçon coûte plus cher que le correctif** : le défaut a survécu à trois lots parce que
`graph-fixtures.ts` fabriquait un nœud texte que `createNode` ne fabrique pas — champ `output` au
lieu de `prompt`, type `prompt` au lieu de `text`. **Une fixture qui diverge de la fabrique rend
une suite entière aveugle.** `graph-fixtures.test.ts` le verrouille désormais : une fixture peut
en dire moins que la fabrique, jamais autre chose.

**Le flow compilé perdait les fils entrant dans un générateur**, faute de `getModel`. Corrigé :
`ModelRegistry.inputsOf` sert les entrées brutes de l'API depuis la même requête que `describe`,
et le handler résout les modèles du graphe — à travers la file bornée — avant d'appeler le
convertisseur, qui est synchrone.

## Le lot C0 — livré le 10 août, et ce qu'il a appris

**Le défaut, et il touchait tout le studio, pas seulement le graphe.** Le collecteur frappe chaque
asset d'un id local `asset_<uuid>` et range l'identifiant Scenario à part, dans `remoteAssetId`. Or
`AssetDropField` écrit l'id **local** dans le formulaire et `parseGenerationBody` ne réécrit rien :
ce qui partait à l'API était un identifiant qu'elle ne connaît pas. **Vérifié par appel — elle
répond `404`.** La génération était soumise, payée, et répondait comme si aucune référence n'avait
été donnée.

**Arbitré avec l'utilisateur** : la traduction se fait dans le **main**, à la soumission de **tout**
job — pas dans le seul graphe, pour ne pas avoir deux chemins vers la même grandeur.

Cinq choses à ne pas redécouvrir :

1. **Le point d'appel est `execute()` du `JobManager`, pas la frontière IPC.** Un envoi est un
   transfert de fichier de n'importe quelle taille : fait avant que le job existe, il tient le canal
   ouvert sans rien afficher, hors de la borne de concurrence, et sans entrée à annuler.
2. **Il passe par le même `withRetry` que la soumission d'à côté.** C'est le plus long des deux sur
   le fil, donc celui qu'une coupure trouve — et sans retry, un `ECONNRESET` à la deuxième minute
   d'un envoi de 200 Mo réglait le job en échec sans une seule tentative.
3. **Les envois en cours sont partagés entre les appels**, pas par appel. La boucle en exécute deux
   à la fois : relancer une génération pendant qu'une autre tient la même image jamais envoyée la
   faisait partir deux fois — payée deux fois, deux jumeaux dans une bibliothèque qui n'en note
   qu'un. La clé porte le compte, un id ne voulant pas dire la même chose sous une autre clé.
4. **Trois cas où le jumeau enregistré ne vaut rien, et aucun ne dit son nom** : il n'existe pas ; il
   appartient à un autre projet (`isForeignTwin`, le lecteur du badge — l'API répondrait 404) ; ou le
   fichier a été retouché depuis (`movedSince` — la génération tournerait sur une image que
   l'utilisateur ne voit plus). Les deux prédicats vivent désormais dans `shared/domain/asset.ts`,
   côte à côte : ils répondent aux moitiés d'une même question et ont **trois** lecteurs.
5. **Une annulation arrivée pendant l'envoi l'emporte sur l'échec qui suit.** Rien n'interrompt un
   transfert en cours ; sans cette garde, un job que l'utilisateur a arrêté était rapporté « échec »
   et écrit comme tel au journal.

**Deux limites écrites plutôt que tues** (`docs/todo.md`, § 7) : l'estimation de coût ne traduit
rien — délibéré, elle est demandée à chaque frappe — mais `referenceImages` porte
`cost_impact: true`, donc **elle peut annoncer moins que le prix réel** ; et l'assistance de prompt
(`prompts.suggest`, `describeStyle`) envoie encore des ids locaux, donc **l'API ne voit jamais les
images sur lesquelles on lui demande d'écrire**.

---

## Ce qu'il reste — l'étape 7 en trois lots, puis 8 et 9

L'étape 7 s'est révélée **plus grosse que le plan**, pour une raison que le plan ne nommait pas (le
lot C0 ci-dessus). Elle se termine en trois lots.

### Lot C1 — le plan d'exécution, pur et sans réseau

`engines/graph/` ne contient **aucun import React** (invariant 4), et tout ceci se teste sans DOM :

1. tri topologique (Kahn) et **détection de cycle** — un cycle se dit et **nomme les nœuds en
   cause**, il ne boucle pas ;
2. résolution des entrées d'un nœud depuis ses arêtes. **Attention à la convention inversée** :
   les fournisseurs d'un nœud sont `edges.filter(e => e.source === id).map(e => e.target)`.
   `providersOf` et `consumersOf` existent déjà dans `engines/graph/mutations.ts` ;
3. `hash(nodeId + type + params résolus + hashes des parents)`. **Le `nodeId` en fait partie et ce
   n'est pas un oubli** : une génération est stochastique, donc deux nœuds « même modèle, même
   prompt » doivent rendre deux images. Ce qui n'entre pas dans le hash : la position et le titre.

**Le cache est le point à ne pas rater** : changer le prompt du dernier nœud ne doit relancer que
ce nœud.

> **`src/renderer/src/engines/graph/**` n'a AUCUN budget de couverture.** `vitest.config.ts` prévient
> lui-même qu'« un nouveau sous-dossier `engines/` atterrit sous aucun budget, sans avertissement » —
> les deux globs nomment `{timeline,canvas,audio,core}` et `{scene,skybox,viewport,texture,gpu}`, et
> `graph` a été créé à l'étape 6 sans y entrer. **Poser le budget avec le lot qui y écrit du code**,
> après avoir mesuré sur la suite complète (une mesure sur le seul dossier ment : `commands.ts` est
> couvert depuis `GraphDocument.test.tsx`).

### Lot C2 — l'exécution branchée — **LIVRÉ le 10 août 2026**

`engines/graph/executor.ts`, `stores/graph-runs.ts`, le bouton Exécuter / Arrêter, et l'état de
chaque nœud dans le coin de son en-tête. Le détail de ce que le lot a appris est sous l'étape 7 du
plan (« Le lot C2 »). Les trois choses à ne pas redécouvrir :

1. **`document-io.ts` est dans le chunk d'ouverture** et atteint `stores/graph-runs.ts` pour
   oublier un document fermé, d'où l'**import dynamique** de l'exécuteur. `eager-graph.test.ts`
   refuse tout module de `engines/graph/` autre que le lecteur sur le premier écran.
2. **Les blancs du formulaire sont retirés du corps** avant soumission : `modelDataOf` écrit
   `defaultValues`, qui ne passe pas par `buildBody`, et une énumération optionnelle vide vaut 400.
3. **L'exécution n'a jamais été lancée contre l'API.** Ce serait une vraie génération, donc des
   crédits. À grouper avec la vérification du lot C0.

### Lot C3 — compiler et valider

**Gardé dans l'étape 7, arbitré avec l'utilisateur** alors que la compilation ne sert que l'export.

- **Ne pas écrire de compilateur** : `convertWorkflowEditorToFlow({ nodes, edges, inputKeys,
  getModel })` existe. Il rend `type: string` là où l'API veut une union littérale — l'un des rares
  `as` justifiés du dépôt, avec son commentaire d'une ligne.
- **C'est le MAIN qui parle SDK.** `shared/domain/graph.ts` est écrit à la main pour que `shared/`
  ne porte aucune dépendance runtime (invariant 2). Une divergence de forme doit échouer au
  **typecheck** du main, pas à l'exécution.
- ⚠️ **Le convertisseur ne compile QUE les branches menant à un nœud `data.isOutput`** — vérifié sur
  `wflow_coloring-page-maker`, où `imageGenerator1` le porte. **Rien dans le studio n'écrit ce
  champ** : `grep isOutput src/` ne rend que sa déclaration. Sans un geste pour marquer une sortie,
  **le flow compilé est vide**. C'est le premier travail de ce lot, et le plan ne le nommait pas.
- `validateWorkflowFlow(flow)` jette à la **première** violation. Le brancher en direct dans
  l'éditeur : un surlignage pendant la frappe, pas un 400 à l'envoi.

### Étape 8 — logique, boucles, transforms, approbation

Les onze types restants. `ifElse` est un query builder dont le format existe
(`WorkflowEditorConditionBlock`) ; `transform` évalue du **CEL**, et `@scenario-labs/sdk/tools/cel`
est **déjà installé** — l'aperçu en direct ne coûte aucune dépendance ; `forEach`/`forEachEnd` est
une **paire visuelle** qui se compile en un seul nœud `for-each`. `approval` ajoute
`awaiting-approval` à `JobStatus`, **ce qui change `isFinished`**.

### Étape 9 — import, export, publication

`validateEditorInfo` accepte la version `'1.0'`. **`workflow_create` exige des tableaux
`nodes`/`edges` NON VIDES**. Deux refus doivent **parler** : au-delà de 50 nœuds, et dès qu'un nœud
local est dans le graphe — mais **une App publique en compte 62**, donc vérifier le plafond avant
d'écrire le refus.

---

## Les treize pièges déjà payés — ne pas les repayer

1. **La convention d'arête est INVERSÉE** : `{ source: consumer, target: provider }`. Une entrée est
   un handle `source` à GAUCHE, une sortie un handle `target` à DROITE. **À relire avant la première
   ligne du lot C1** — l'inversion ne produit ni erreur ni avertissement.
2. **Il n'y a AUCUNE API de palette de nœuds.** La palette est écrite chez nous
   (`spaces/graph/palette.ts`) ; un « générateur d'image » est un nœud `model` narrowé à une
   famille, pas un type de plus.
3. **Un `Partial<Record<…>>` n'exige rien du compilateur.** C'est ainsi que `⌘Z` n'a jamais marché
   dans le graphe. Quand tu ajoutes une capacité à un espace, cherche les tables `Partial`.
4. **`parseGraph` valide le nœud, PAS son `data`.** `Array.isArray` et un test de chaîne, jamais
   `typeof … === 'object'`.
5. **`Selection` ne porte qu'UN genre à la fois**, et l'étagère d'assets partage l'écran du graphe.
   La sélection de nœuds vit dans `GraphDocument` et n'est que **publiée** au store.
6. **React Flow ne rapporte la désélection que d'un nœud qu'il a MONTÉ.**
7. **`DynamicForm` rapporte par frappe et n'a ni focus ni blur.** Sans geste ouvert, un prompt de
   120 caractères fait 120 entrées d'undo, et `HISTORY_LIMIT` vaut 100. Il **doit** être chargé en
   `lazy()` : 220 kB, et l'inspecteur est placé dans **tous** les espaces.
8. **Le compilateur React n'est PAS actif dans la build**, seule sa règle de lint l'est.
9. **jsdom n'a pas `DOMMatrixReadOnly`** — polyfill identité déjà posé dans `test-setup.ts`. Et
   **React Flow n'émet AUCUN changement quand un clic ne modifie rien**.
10. **Un agent de revue laisse des fichiers sondes dans `src/`.** `find src -name 'zz*'` avant chaque
    commit. **Et l'IDE rapporte des diagnostics périmés sur ces fichiers longtemps après leur
    disparition** : ne pas leur courir après, `pnpm typecheck` fait foi.
11. **Un id d'asset local n'est pas un id Scenario** — voir le lot C0. Le `JobManager` traduit
    désormais ; **ne pas ajouter un second traducteur** ailleurs.
12. **Le lint refuse `as const`** (règle du dépôt) : un tuple `[key, value] as const` dans un
    `Object.entries().map()` fait échouer `validate`. Une boucle `for` fait le même travail.
13. **`docs/REPRISE.md` et `docs/scenario-api/` n'existent plus sur le disque.** Le premier est
    fusionné dans `docs/todo.md`, le second se régénère par `pnpm docs:scenario`. Ne pas conclure
    qu'ils ont été perdus, ne pas les recréer à la main.

---

## Le harnais de mutation — il a menti deux fois, dans les deux sens

Il n'y a pas de méthode qui vaille sans ces deux gardes, et chacune a coûté un rapport faux :

- **`zsh` ne découpe pas les variables en mots.** `TESTS="a.ts b.ts"` puis `vitest run $TESTS` passe
  **un seul** argument que vitest ne trouve pas : zéro test exécuté, et onze mutations rapportées
  « SURVIT » alors que rien n'avait tourné. Utiliser un tableau `TESTS=(a.ts b.ts)` et
  `"${TESTS[@]}"` — **et refuser tout verdict dont la sortie ne contient pas de compte de tests.**
- **Une mutation qui fait déborder la pile ne dit pas « failed ».** Vitest rapporte alors
  « Test Files 1 passed (2) » sans ligne d'échec : le fichier est mort, pas rouge. **Comparer les
  comptes** (`2 passed (2)`), pas chercher le mot.

**Quinze mutations sur quinze mordent** sur le lot C0, vérifiées une par une après ces corrections.

---

## Ce que la méthode a appris, et qui vaut pour la suite

- **Les revues adverses ont rendu, sur le seul lot C0, trois défauts qu'aucun test ne voyait** : la
  traduction placée à la mauvaise profondeur, l'absence de retry sur l'appel le plus long, et une
  déduplication qui ne tenait qu'à l'intérieur d'un appel alors que la boucle en exécute deux.
  Donne-leur des angles différents (correction d'un côté, conception et cohérence de l'autre),
  exige **un scénario d'échec concret par défaut**, et qu'elles vérifient chaque piste dans le code.
- **Un faux qui ignore son argument est un test qui ne peut pas rougir.** Une revue l'a prouvé sur
  un test de cette session en appelant le résolveur avec `{}` : le test restait vert. Un `vi.fn()`
  et un `toHaveBeenCalledWith` sur ce que l'appelant a vraiment passé.
- **Un commentaire peut mentir plus longtemps qu'un test.** Celui qui justifiait un parcours
  séquentiel invoquait une borne du `JobManager` qui ne s'applique pas à ce moment-là. Une revue
  d'efficacité l'a démonté. Quand une raison est écrite, elle doit être vérifiable.
- **Dire franchement ce qui est une assurance.** La récursion sous un objet imbriqué est gardée
  alors qu'aucun modèle du compte n'en publie : c'est écrit comme telle dans le fichier, pas
  maquillé en correctif.

---

## Les questions ouvertes, à trancher avec l'utilisateur

1. **Vérifier le lot C0 à l'écran demande une vraie génération avec image de référence**, donc des
   crédits. Elle n'a pas été lancée. À grouper avec la vérification des lots suivants.
2. **L'estimation de coût peut annoncer moins que le prix réel** quand le formulaire porte une
   image. Ce qui se ferait sans rien envoyer : lire le `remoteAssetId` quand il existe déjà. C'est
   une variante « traduis, n'envoie pas » du résolveur, pas un second mécanisme.
3. **L'assistance de prompt n'a jamais vu les images** qu'on lui donne en référence. Le geste est
   explicite (un bouton, pas une frappe), donc téléverser y serait défendable.
4. **Le menu de modèles de l'inspecteur tient en une page de 60** et ne suit pas le curseur, sur 642
   modèles publics. Une entrée « Parcourir les modèles… » ouvrant `offerModelsOfFamily` rendrait le
   geste riche du panneau.
5. **Ni identifiants manquants, ni erreur, ni chargement** ne sont dits dans la face d'un nœud
   modèle : `MissingCredentials` et `failureKeyOf` existent déjà.
