# Reprise — chantier « workflows et node editor »

**À coller tel quel dans une nouvelle session.** Réécrit le 9 août 2026, après la **fusion de
l’étape 6 dans `develop`**.

---

## Le prompt

> Je reprends le chantier « workflows et node editor » de Scenario Studio, dans
> `/Users/pasquelin/Applications/scenario`. Tu travailles en autonomie.
>
> **Mise en place, sans la raccourcir :**
>
> 1. Lis en entier, dans cet ordre : `CLAUDE.md` à la racine (il prime sur tout, y compris sur le
>    plan) ; **ce fichier** ; `docs/REPRISE.md` — le § 4 est le chantier, le § 3.6 les dettes ;
>    puis `docs/plans/2026-08-08-workflows-node-editor.md`. **Les étapes 1 à 6 sont cochées.** Lis
>    leurs encadrés : ils disent où le plan s’est trompé et ce qu’il ne faut pas défaire.
> 2. `cd /Users/pasquelin/Applications/scenario/.claude/worktrees/workflows`. Le worktree existe,
>    `pnpm install` est fait, le binaire Electron est posé, `secrets/.env` est copié.
> 3. **Première chose à faire, avant toute ligne de code** — l’étape 6 est fusionnée, mais le
>    worktree est resté sur son commit et `develop` avance sans lui :
>
>    ```bash
>    cd /Users/pasquelin/Applications/scenario/.claude/worktrees/workflows
>    git fetch origin develop
>    git rebase --autostash develop        # `develop` LOCAL
>    pnpm install                          # seulement si le lockfile a bougé
>    pnpm validate > /tmp/v.log 2>&1; echo "EXIT=$?"
>    ```
>
>    **N’enchaîne jamais rebase et merge dans une seule commande.** À la fin d’une étape, depuis le
>    dépôt principal (`/Users/pasquelin/Applications/scenario`, où `develop` est sorti) :
>    `git merge --no-ff feat/workflows`, et `pnpm validate` **après** la fusion — une fusion sans
>    conflit n’est pas une fusion sans contradiction.
> 4. **Vérifie le code de sortie, jamais la dernière ligne.**
> 5. **Préfixe chaque commande du chemin absolu du worktree.**
>
> **Ce que tu fais, dans cet ordre :**
>
> 1. **le montage du septième espace** — tranché avec moi le 9 août, pas encore écrit ; le détail
>    est plus bas, section « Le travail suivant » ;
> 2. puis les **étapes 7 à 10**. L’étape 7 compile le graphe vers le `flow` de Scenario, le valide
>    et l’exécute — c’est le **main** qui adapte `shared/domain/graph.ts` au convertisseur du SDK,
>    et une divergence de forme doit échouer au **typecheck**, pas à l’exécution.
>
> **Definition of Done à chaque étape, sans demander :** tests écrits avec le code, `pnpm validate`
> vert, `/simplify`, `/code-review`, corrections appliquées, commit. Ces deux passes trouvent des
> défauts réels — à l’étape 5 elles ont rendu **deux bugs reproduits** et une décision d’API à
> revoir, à l’étape 6 **six défauts** qu’aucun test unitaire du moteur ne pouvait voir. **Casse ton
> propre code pour voir si le test rougit** : deux de mes tests ne mordaient pas, et l’un d’eux ne
> s’était même pas inséré dans le fichier.
>
> **Une chose sur laquelle tu m’arrêtes :** si une étape se révèle plus grosse **ou plus petite**
> que le plan, dis-le avec ta recommandation. La question du point de montage, elle, est
> **tranchée** — le graphe sera un **septième espace**, c’est l’étape 10.

---

## L’état exact au moment d’écrire

**Six étapes livrées, et toutes fusionnées dans `develop`.**

| Étape | Ce qu’elle a livré |
|---|---|
| 1 | Les deux statuts de workflow dans le `JobManager`, et la progression normalisée |
| 2 | Le limiteur de débit, sur le `fetch` du client SDK |
| 3 | Un job payé survit à la fermeture de l’application |
| — | La revue de cohérence : dix défauts, dont quatre qui perdaient du travail ou de l’argent |
| 4 | Le coût d’une génération, estimé avant et affiché après |
| 5 | **Les Apps s’exécutent** : panneau, domaine, registre, trois canaux, `Job.kind`/`targetId` |
| 6 | **Le canvas** : `@xyflow/react`, `shared/domain/graph.ts`, `engines/graph/`, `spaces/graph/` |

## Ce que l’étape 5 a appris, et qui vaut pour la suite

- **Un job dit ce qu’il lance.** `Job.kind` (`model` | `workflow`) et `Job.targetId` ont remplacé
  `modelId`. Les notes de jobs **déjà sur disque** nomment un `modelId` : la relecture accepte les
  deux noms (`storedJob`, `validation.ts`), sinon une génération payée est abandonnée. Ne pas
  simplifier ce schéma.
- **Un seul canal price les deux.** `scenario:estimate-cost` prend une `JobTarget`. Il n’y a **pas**
  de `workflows:estimate-cost` — trois canaux `workflows:*` seulement.
- **`billing.cuCost` est lu**, après `creativeUnitsCost` — **mais un job de workflow y répond `0`** :
  la charge est sur ses sous-jobs, un par nœud. Un `cuCost` nul sur un **workflow** vaut absence de
  prix ; sur une génération il vaut gratuit, et il s’affiche.
- **Un statut inconnu vaut `ready`.** Refuser ce qu’on ne reconnaît pas rendrait toutes les Apps
  inertes si Scenario écrivait `published`. Même esprit que le `kind` inconnu d’un champ, qui
  retombe en saisie brute.
- **Le plancher entre deux estimations est partagé par la fenêtre** (`resetCostBudget` pour les
  tests). Le générateur est à gauche, les Apps à droite : les deux formulaires sont à l’écran
  ensemble, et la boucle de poll est dimensionnée une seule fois sur cette part.
- **`outputsOf` vit dans `runner.ts`**, pas dans le manager : c’est le fichier qui parle SDK. Il
  lit `metadata.assetIds` d’abord, `metadata.flow[].assets[]` ensuite, et déduplique les deux.

## Ce que l’étape 6 a appris, et qui gouverne les étapes 7 à 10

- **Le format natif est l’`editorInfo` de Scenario, et il vit dans `shared/domain/graph.ts`** —
  écrit à la main plutôt qu’importé du SDK : un graphe est un document qui traverse l’IPC, donc son
  type appartient à `shared/`, qui ne porte aucune dépendance runtime (invariant 2). **C’est le
  main qui l’adaptera au convertisseur**, à l’étape 7.
- **`editorInfo` a un quatrième champ** : `nodeGroups`, `{ [uuid]: { title, color } }`, avec un
  `data.group` par nœud. Le domaine le porte ; l’éditeur ne le rend pas encore.
- **La convention d’arête inversée est écrite dans `NodePorts.tsx`**, là où l’inverser se paierait :
  une ENTRÉE est un handle de type `source` posé à GAUCHE, une SORTIE un handle `target` posé à
  DROITE. Vérifiée sur données réelles, § 4.4 et § 4.5 de `REPRISE.md`.
- **`engines/graph/` n’importe pas React** (invariant 4), et ses commandes passent par l’historique
  partagé : `⌘Z` défait une arête sans défaire les nœuds qu’elle joignait.
- **Trois pièges de canvas contrôlé, payés une fois** : un canvas entièrement contrôlé **ne garde
  aucune sélection** (donc Suppr ne trouvait rien à supprimer, ni nœud ni arête) ; React Flow
  compare les nœuds **par identité**, donc refaire la liste à chaque rendu lui fait jeter la mesure
  de chaque nœud et réabonner son `ResizeObserver`, à chaque frame d’un déplacement ; et
  `isValidConnection` refusait une entrée déjà câblée, rendant « le nouveau fil remplace l’ancien »
  vrai dans le moteur et inatteignable à la souris.

## Le travail suivant : le septième espace

**Tranché avec l’utilisateur le 9 août 2026 : le graphe est un septième espace**, pas un type de
document dans les six. Il n’est la sortie d’aucun espace, il les traverse tous — et le code disait
déjà la même chose : `DocumentKind` et `WorkspaceId` sont en correspondance **1:1**
(`KIND_BY_WORKSPACE`, `workspaceForKind`), donc un `kind: 'graph'` sans espace aurait été le premier
à casser cette règle, et il aurait fallu désigner un espace d’accueil — question sans bonne réponse.

**Rien n’en est écrit** : une tentative a été défaite pour laisser le worktree propre.

Le compilateur guide, et c’est voulu — `helpers/workspaces.ts` le dit lui-même : *« a seventh
workspace is a compile error rather than a list left to drift »*. Ajouter `'graph'` à `WorkspaceId`
fait échouer exactement **quatre** tables, et il n’y en a pas une cinquième :

1. `ICONS` (`renderer/helpers/workspaces.ts`) — `mdiGraphOutline` convient ;
2. `USED_BY_WORKSPACE` (idem) — ce que l’étagère offre dans le graphe ;
3. `FAMILIES` (idem) — **c’est là qu’est la question**, voir plus bas ;
4. `KIND_BY_WORKSPACE` (`shared/domain/document.ts`) — avec `DocumentKind` étendu à `'graph'`.

Puis, que le compilateur n’exigera pas : `DOCUMENT_COMPONENTS` (`app/documents.tsx`, **en
`lazy()`** — `eager-graph.test.ts` verrouille ce qui atterrit dans le premier écran, et React Flow
n’a rien à y faire), `IO_BY_KIND` (`app/document-io.ts`), `TOOL_PLACEMENTS`
(`shared/domain/tool.ts`), les deux bundles i18n (`workspaces.graph`, **même ordre dans les deux
fichiers**, un test le verrouille), et les tests qui comptent « six ».

**La question à poser avant d’écrire : `Workspace.family`.** Chaque espace déclare une
`ModelFamily` qui filtre le catalogue de modèles. Un graphe n’appartient à aucune famille — il les
enchaîne. Trois voies, et elles ne se valent pas :

- **`family: 'other'`** — le moins de code, mais le catalogue serait filtré sur « Autre », donc faux
  dès que le panneau Modèles est dans cet espace ;
- **rendre `family` nullable** et faire qu’un catalogue sans famille montre tout — c’est la vérité
  du domaine, et ça touche quatre lecteurs (`Models.tsx`, `Generator.tsx`, `recreate.ts`,
  `AssetInspector.tsx`) ;
- **ne pas mettre `models`/`generator` dans le graphe** — `TOOL_PLACEMENTS` les déclare sur
  `WORKSPACE_IDS`, il faudrait lister les six explicitement. Attention : `revealTool` sort **en
  silence** si l’outil n’est pas dans l’espace, donc un « Régénérer » vu depuis l’inspecteur du
  graphe ne ferait rien — à masquer plutôt qu’à laisser mort.

Recommandation : la deuxième, avec le bouton masqué là où il n’y a pas de générateur. Mais c’est un
arbitrage, pas une évidence : **le poser avant d’écrire.**

Deux règles de disposition à ne pas enfreindre (`docs/interface.md`) : la colonne de gauche est
réservée à la génération dans les six espaces média — une bibliothèque de nœuds ne peut donc **pas**
y aller ; et le centre ne porte que la barre d’outils et les règles, ce qui tombe bien, la barre du
canvas est flottante.

## Ce qui reste ouvert

1. **Le canvas n’est monté nulle part**, donc rien de l’étape 6 n’a été vu à l’écran et aucune
   capture n’existe. Ce n’est plus une question ouverte : le montage est **tranché et décrit**
   ci-dessous, et c’est le travail suivant.
2. **Le panneau Apps n’a pas été vérifié à l’écran non plus.** Les trois inconnues d’API, elles,
   sont tranchées : une App a été lancée pour de vrai le 9 août 2026 par le SDK, relevé au § 4.5 de
   `REPRISE.md` — statuts `queued`/`in-progress`/`success`, progression en 0–1, `metadata.assetIds`
   peuplé. **Ce qui reste est de l’ordre du regard** : ouvrir le panneau Apps dans les six espaces,
   voir la liste se remplir, une App s’ouvrir sur son formulaire, le prix s’afficher.
3. **Une App publique compte 62 nœuds** (`wflow_H1bKz78jgpinWPKJfVCM5uAp`) : le plafond de 50
   annoncé par le guide n’est pas opposé aux workflows publiés. À vérifier **avant** d’écrire le
   refus d’export de l’étape 9.
4. **`git worktree list`** avant de commencer : plusieurs sessions travaillent en parallèle.

## Les pièges déjà payés — ne pas les repayer

- **La convention d’arête de Scenario est inversée** — `{ source: consumer, target: provider }`,
  vérifié dans `lib/workflow_converter.js` puis sur les données d’une App publiée. Relire le § 4.4
  de `REPRISE.md` **avant la première ligne de l’étape 7** : c’est à la compilation que l’inversion
  se manifesterait, sans erreur et sans avertissement.
- **Le type du SDK fait foi contre la page de doc.** Vérifié quatre fois.
- **Le SDK arme le timeout d’une requête AVANT d’appeler le transport** : toute attente dans le
  `fetch` est prise sur le budget de l’aller-retour.
- **`Error: Electron uninstall` au premier `pnpm start`** d’un worktree neuf :
  `node node_modules/electron/install.js`.
- **Le LSP de la session indexe parfois un autre worktree** et invente des erreurs sur des fichiers
  qui n’existent pas ici. `pnpm typecheck` fait foi.
- **Un agent de revue peut laisser des fichiers sonde dans `src/`** (`zzprobe.test.ts`) : ils font
  échouer `validate` et se commitent sans qu’on les voie. `git status` avant chaque commit.

## Deux dettes, écrites pour ne pas être redécouvertes

- **L’écriture atomique existe en double** entre `scenario/job-store.ts` et `project/documents.ts`,
  commentaire identique compris. Le correctif du `rm` de nettoyage n’a été appliqué qu’au premier.
  § 3.6 de `REPRISE.md` pour la marche à suivre.
- **`accounts.of` reconstruit un client par job repris**, sur le chemin de démarrage.
  `credentialsByFingerprint` prend déjà un carnet en argument : la couture existe.
