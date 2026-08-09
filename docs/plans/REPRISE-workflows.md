# Reprise — chantier « workflows et node editor »

**À coller tel quel dans une nouvelle session.** Réécrit le 9 août 2026, après la fusion des
**six premières étapes**. Le travail suivant est le **montage du septième espace**, décidé et
pas commencé.

---

## Le prompt

> Je reprends le chantier « workflows et node editor » de Scenario Studio, dans
> `/Users/pasquelin/Applications/scenario`. Tu travailles en autonomie.
>
> **Mise en place, sans la raccourcir :**
>
> 1. Lis en entier, dans cet ordre : `CLAUDE.md` à la racine (il prime sur tout, y compris sur le
>    plan) ; **ce fichier** ; `docs/REPRISE.md` — le § 4 est le chantier, le § 4.5 porte ce qu’un
>    vrai lancement d’App a tranché, le § 3.6 les dettes ; puis
>    `docs/plans/2026-08-08-workflows-node-editor.md`. **Les étapes 1 à 6 sont cochées et
>    fusionnées.** Lis leurs encadrés : ils disent où le plan s’est trompé et ce qu’il ne faut pas
>    défaire.
> 2. `cd /Users/pasquelin/Applications/scenario/.claude/worktrees/workflows`. Le worktree existe,
>    `pnpm install` est fait, `secrets/.env` est copié, le binaire Electron est posé.
> 3. **Premier geste** : `git fetch origin develop`, puis `git rebase --autostash develop` (le
>    `develop` **local**), puis `pnpm validate > /tmp/v.log 2>&1; echo "EXIT=$?"`. Jamais rebase et
>    merge dans la même commande. Référence au 9 août après la fusion de l’étape 6 : **378 fichiers
>    de tests, 4759 tests, EXIT=0** — et ça monte vite, d’autres sessions livrent en parallèle.
> 4. **Vérifie le code de sortie, jamais la dernière ligne.**
> 5. **Préfixe chaque commande du chemin absolu du worktree.** Le shell retombe ailleurs entre deux
>    appels — ça s’est reproduit pendant la session du 9 août, et une casse volontaire de test a
>    tourné dans le dépôt principal au lieu du worktree. `git worktree list` d’abord.
>
> **Ce que tu fais, dans l’ordre :**
>
> 1. **le montage du septième espace** — décidé, pas commencé, détaillé plus bas ;
> 2. puis les **étapes 7 à 10** du plan.
>
> **Definition of Done à chaque étape, sans demander** : tests écrits avec le code, `pnpm validate`
> vert, `/simplify`, `/code-review`, corrections appliquées, commit, rebase, fusion dans `develop`
> puis `pnpm validate` **après** la fusion. **Casse ton propre code pour voir si le test rougit** —
> à l’étape 6, quatre tests écrits de bonne foi ne mordaient pas, et deux revues ont trouvé six
> défauts qu’aucun test n’aurait vus.
>
> **Vérifie à l’écran ce qui se voit.** Le port 9222 est unique : si une autre session a lancé
> l’application, le verrou d’instance unique d’Electron fait **quitter la tienne immédiatement**,
> sans rien dire — vérifie `pgrep -f "Scenario Studio.app/Contents/MacOS"` avant de conclure que
> ton lancement a échoué.
>
> **Tu m’arrêtes** si une étape se révèle plus grosse ou plus petite que le plan, avec ta
> recommandation.

---

## L’état exact

**Six étapes livrées et fusionnées.** `develop` au 9 août 2026 : **378 fichiers de tests, 4759
tests, `pnpm validate` vert.**

| Étape | Ce qu’elle a livré |
|---|---|
| 1 | Les deux statuts de workflow dans le `JobManager`, et la progression normalisée |
| 2 | Le limiteur de débit, sur le `fetch` du client SDK |
| 3 | Un job payé survit à la fermeture de l’application |
| — | Revue de cohérence : dix défauts, dont quatre qui perdaient du travail ou de l’argent |
| 4 | Le coût d’une génération, estimé avant et affiché après |
| 5 | Les Apps de Scenario se lancent depuis le studio |
| — | **Le prix se voit enfin** : le dry run répondait 200, on ne lisait que le 402 |
| 6 | Le canvas, la convention d’arête, le moteur de graphe |

---

## Ce qu’un vrai lancement d’App a tranché — ne pas rouvrir

`wflow_coloring-page-maker`, deux nœuds, 12 CU, lancée par le SDK avec la clé de dev le 9 août.
Le relevé complet est au **§ 4.5 de `REPRISE.md`**.

| Ce qui était en doute | Ce que l’API répond |
|---|---|
| Graphie des statuts | `queued` → `in-progress` → `success` — le vocabulaire de la génération |
| Échelle de la progression | 0–1, **et elle ne bouge pas** : `0` du début à la fin, `1` à l’arrivée |
| `metadata.assetIds` | **peuplé**, à côté d’un `flow[]` qui porte les mêmes assets par nœud |

**C’est le SDK qui disait vrai, le guide en prose qui a tort.** Les deux assurances de l’étape 1
restent inertes, et c’est le résultat voulu.

**Deux défauts que seule l’observation pouvait trouver, corrigés :**

- **le dry run répond `200`, pas `402`**, sur les deux endpoints, avec `creativeUnitsCost` dans le
  corps. `cost.ts` ne lisait que le 402 documenté : **aucun badge de prix n’a rien affiché depuis
  l’étape 4**. Vérifié à l’écran après correction — le bouton dit « Générer ~11 UC » ;
- **un job de workflow facture `cuCost: 0`** : la charge est sur ses sous-jobs, un par nœud (le
  parent disait 0, le nœud qu’il a lancé disait 12). Ce zéro-là vaut absence de prix ; sur une
  génération, il vaut gratuit et il s’affiche.

**Deux faits acquis pour la suite** : `editorInfo` porte un **quatrième** champ, `nodeGroups`
(`{ [uuid]: { title, color } }`, avec `data.group` par nœud) ; et une App publique compte
**62 nœuds** (`wflow_H1bKz78jgpinWPKJfVCM5uAp`), donc le plafond de 50 n’est **pas** opposé aux
workflows publiés — à vérifier avant d’écrire le refus d’export de l’étape 9.

---

## Le travail suivant : le septième espace

**Tranché avec l’utilisateur le 9 août : le graphe est un septième espace**, pas un type de
document dans les six. Le graphe n’est la sortie d’aucun espace, il les traverse tous — et le code
disait la même chose : `DocumentKind` et `WorkspaceId` sont en correspondance **1:1**
(`KIND_BY_WORKSPACE`, `workspaceForKind`), donc un `kind: 'graph'` sans espace aurait été le
premier à casser cette règle.

**Rien n’en est commencé** : une tentative a été défaite pour laisser le worktree propre.

Le compilateur guide, et c’est voulu — `workspaces.ts` le dit : « a seventh workspace is a compile
error rather than a list left to drift ». Ajouter `'graph'` à `WorkspaceId` fait échouer exactement
**quatre** tables, et il n’y en a pas une cinquième :

1. `ICONS` (`renderer/helpers/workspaces.ts`) — `mdiGraphOutline` va bien ;
2. `USED_BY_WORKSPACE` (idem) — quels types d’assets l’étagère offre dans le graphe ;
3. `FAMILIES` (idem) — **c’est là qu’est la vraie question**, voir ci-dessous ;
4. `KIND_BY_WORKSPACE` (`shared/domain/document.ts`) — `graph: 'graph'`, avec `DocumentKind` étendu.

Puis, non exigés par le compilateur : `DOCUMENT_COMPONENTS` (`app/documents.tsx`, **en `lazy()`** —
`eager-graph.test.ts` verrouille ce qui atterrit dans le premier écran, et React Flow n’a rien à y
faire), `IO_BY_KIND` (`app/document-io.ts`), `TOOL_PLACEMENTS` (`shared/domain/tool.ts`), les deux
bundles i18n (`workspaces.graph`, **même ordre dans les deux fichiers**, un test le verrouille), et
les tests qui comptent « six ».

**La question à trancher : `Workspace.family`.** Chaque espace déclare une `ModelFamily` qui filtre
le catalogue de modèles. Un graphe n’appartient à aucune famille — il les enchaîne. Trois voies, et
elles ne se valent pas :

- **`family: 'other'`** — le moins de code, mais le catalogue serait filtré sur « Autre », donc faux
  dès que le panneau Modèles est dans cet espace ;
- **rendre `family` nullable** (`ModelFamily | null`) et faire que `Models` sans famille montre
  tout — c’est la vérité du domaine, et ça touche quatre lecteurs (`Models.tsx`, `Generator.tsx`,
  `recreate.ts`, `AssetInspector.tsx`) ;
- **ne pas mettre `models`/`generator` dans le graphe** — `TOOL_PLACEMENTS` les déclare aujourd’hui
  sur `WORKSPACE_IDS`, il faudrait lister les six explicitement. Attention : `revealTool` sort en
  silence si l’outil n’est pas dans l’espace, donc un bouton « Régénérer » vu depuis l’inspecteur du
  graphe ne ferait **rien** — à masquer plutôt qu’à laisser mort.

Recommandation : la deuxième, avec le bouton « Régénérer » masqué là où il n’y a pas de générateur.
Mais c’est un arbitrage à poser à l’utilisateur avant d’écrire.

**Deux règles de disposition à ne pas enfreindre** (`docs/interface.md`, § « Les règles de
disposition ») : la colonne de gauche est réservée à la génération dans les six espaces média — une
bibliothèque de nœuds ne peut donc **pas** y aller ; et le centre ne porte que la barre d’outils et
les règles, ce qui est cohérent avec la barre flottante du canvas.

---

## Ce que l’étape 6 a livré, et ce qu’il ne faut pas défaire

- **Le format vit dans `shared/domain/graph.ts`**, écrit à la main plutôt qu’importé du SDK : un
  graphe traverse l’IPC, donc son type appartient à `shared/`, qui ne porte aucune dépendance
  runtime. Le principal l’adaptera au convertisseur à l’étape 7, et une divergence échouera alors
  au **typecheck**, pas à l’exécution.
- **La convention d’arête décide de quel côté va chaque port** : une ENTRÉE est un `<Handle>` React
  Flow de type `source` posé à GAUCHE, une SORTIE un handle `target` posé à DROITE. C’est écrit dans
  `NodePorts.tsx`, parce que c’est là que l’inversion se paierait — et c’est confirmé sur les
  données réelles d’une App publiée.
- **`isValidConnection` répond ce qui peut être DÉPOSÉ**, pas ce qui peut être connecté
  (`canDropConnection`) : une entrée déjà câblée accepte un nouveau fil, et l’ancien s’en va. Le
  refuser rendait le recâblage **inatteignable à la souris** alors que le moteur savait le faire.
- **La sélection redescend dans les nœuds et les arêtes.** Un canvas entièrement contrôlé n’en garde
  aucune : ce qui ne lui est pas rendu n’est pas sélectionné, et la touche Suppr ne trouve alors
  rien à supprimer.
- **Les nœuds inchangés sont rendus par référence** (`canvasNodesOf`, cache `WeakMap` clé = le nœud
  immuable). React Flow compare par identité : un objet neuf lui fait jeter la mesure du nœud et
  réabonner son `ResizeObserver`. Ne pas revenir à un `.map()` complet.
- **Les quinze types de nœuds ont un rendu**, dont onze en `PlainNode` (nom et ports). Un `Record`
  sur l’union entière : un seizième type est une erreur de compilation.
- **`parseGraph` est une porte**, pas un `JSON.parse` : id réservé `workflow` refusé, ids de nœuds
  dédupliqués, une seule arête par entrée. Les mutations matchent par id — deux nœuds `text1`
  auraient été déplacés et supprimés ensemble.

---

## Les pièges déjà payés — ne pas les repayer

- **Le SDK arme le timeout d’une requête AVANT d’appeler le transport.** Au-delà de dix secondes, le
  limiteur rend un **429 de synthèse portant `retry-after-ms`** — lever une erreur ne marche pas.
- **Une note de job ne part que si l’API a conclu.** Un échec local garde la note.
- **`accountFingerprint`** nomme un compte par un digest de sa clé — la notion qu’emploient le
  limiteur, la persistance des jobs et le lecteur de conso.
- **Tout client passe par `clientFor(credentials, transport)`.**
- **`"workflow"` est réservé dans `ref.node`** — ne jamais nommer un nœud ainsi.
- **Le LSP de la session indexe parfois un autre worktree** et invente des erreurs. `pnpm typecheck`
  fait foi.
- **Une fusion sans conflit n’est pas une fusion sans contradiction** : l’étape 5 a été fusionnée
  alors qu’un autre travail avait ajouté un test construisant un `Job` avec `modelId`, champ que
  l’étape 5 avait remplacé. Git n’a rien signalé ; le typecheck si.

## Deux dettes, écrites pour ne pas être redécouvertes

- **L’écriture atomique existe en double** entre `scenario/job-store.ts` et `project/documents.ts`,
  commentaire identique compris. Le correctif du `rm` de nettoyage n’a été appliqué qu’au premier.
  Le § 3.6 de `REPRISE.md` porte la marche à suivre — le nom de la copie de transit doit rester un
  paramètre.
- **`accounts.of` reconstruit un client par job repris**, chacun coûtant un déchiffrement keychain.
  Sur le chemin de démarrage. Sous la milliseconde pour une poignée de jobs : une remarque de forme.
