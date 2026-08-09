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

**Sept étapes livrées.** L'étape 10 a été prise avant les 7 à 9, et c'était le bon ordre :
l'étape 6 avait livré un canvas que rien ne montait, donc rien de ce qui suit n'aurait été
regardable. Monter d'abord a rendu **cinq défauts invisibles autrement**, dont trois de l'étape 6.

| Étape | Ce qu’elle a livré |
|---|---|
| 1 | Les deux statuts de workflow dans le `JobManager`, et la progression normalisée |
| 2 | Le limiteur de débit, sur le `fetch` du client SDK |
| 3 | Un job payé survit à la fermeture de l’application |
| — | La revue de cohérence : dix défauts, dont quatre qui perdaient du travail ou de l’argent |
| 4 | Le coût d’une génération, estimé avant et affiché après |
| 5 | **Les Apps s’exécutent** : panneau, domaine, registre, trois canaux, `Job.kind`/`targetId` |
| 6 | **Le canvas** : `@xyflow/react`, `shared/domain/graph.ts`, `engines/graph/`, `spaces/graph/` |
| 10 | **Le septième espace**, pris hors ordre : le canvas est monté, vu à l'écran, et éditable |

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

## Ce que le septième espace a appris

- **Un espace peut n'appartenir à aucune famille de modèles.** `Workspace.family` est
  `ModelFamily | null`, et un catalogue sans famille montre **tout** — `ModelQuery.family` était
  déjà optionnel et le registre ne narrowait déjà que si la clé est là. Le `scope`
  (`ModelScope = ModelFamily | 'all'`) est **dérivé sur le record `Workspace`**, jamais recomposé
  chez les lecteurs : il l'était à quatre endroits, le cinquième a été oublié, et le graphe y a
  perdu son générateur — voir juste dessous.
- **`SCOPE_BY_WORKSPACE` est un `Partial`, donc le compilateur ne demande rien.** Un espace
  absent de cette table garde l'undo **natif**, qui prend l'accélérateur au niveau de l'OS :
  l'historique du graphe existait, était testé, et `⌘Z` ne l'atteignait jamais. **Skyboxes avait
  payé exactement ce défaut** — son commentaire le raconte. Toujours vérifier qu'un espace dont
  le store expose un `historyOf` déclare un `CommandScope`.
- **`canOffer` retire le Générateur d'un espace sans modèle.** Lire une famille `null` comme
  « pas de modèle » l'a donc supprimé du graphe **pour de bon**, en restant vert au niveau du
  registre : le verrou de disposition lit `TOOL_PLACEMENTS`, où `graph` était arrivé tout seul
  par `WORKSPACE_IDS`. Le défaut vivait dans la couche au-dessus, que ce verrou ne voit pas.
- **Trois défauts que seul l'écran pouvait rendre** : le fond à points était invisible
  (`size={0.5}` est un rayon d'un quart de pixel — lisible sur le canvas clair de la webapp,
  invisible sur notre `panel`) ; `fitView` sautait à **200 %** au premier nœud posé, parce qu'il
  se rejoue quand les nœuds arrivent et pas seulement au montage ; et **rien ne permettait de
  créer un nœud**, l'étape 6 n'ayant livré ni palette ni menu.
- **Un octet NUL littéral vivait dans `serialize.ts`**, dans la clé de déduplication, depuis
  l'étape 6. Git voyait le fichier comme binaire et le masquait dans tous les diffs — donc
  personne ne l'avait relu. Échappé en `\0` : même valeur, fichier redevenu texte.

## Ce que l'API a répondu, et que la doc ne disait pas

**Toujours faire l'appel.** `workflow_get` sur `wflow_coloring-page-maker` a corrigé quatre
choses, dont deux qui étaient déjà écrites dans le code :

| Ce qui était écrit | Ce que l'API répond |
|---|---|
| port texte `-target-text` | **`-target-prompt`**, de type `text` — le nom du champ n'est pas le type |
| une note porte `value` | elle porte **`content`** : toute note importée de Scenario s'affichait **vide** |
| aucun port conditionnel sur un nœud neuf | **tout** nœud en porte un (`-source-conditional`), la note comprise |
| aucun endpoint de publication (§ 4.5) | **`workflow_publish` existe** côté MCP, et compile `editor_info` **côté serveur** |

**Il n'y a AUCUNE API de palette de nœuds.** Les dix outils `workflows.*` n'en listent aucun, et
le SDK ne publie que les 15 types techniques, sans libellé ni catégorie. La palette de la webapp
(Input / Generators / Composers / Utilities) est une couche produit : **un « Image Generator »
est un nœud `model` narrowé à une famille**, et les cinq entrées « Input » sont des `text` et des
`asset` qui ne diffèrent que par `data.type`. Elle est donc écrite chez nous — `spaces/graph/palette.ts`,
branchée sur les familles de modèles que le studio connaît déjà. **Ne pas la rechercher côté API.**

**Un label est une donnée de DOCUMENT, pas de l'interface.** Scenario écrit `label: 'Is Active'`
sur ses ports ; nous ne l'écrivons pas. Le traduire désynchroniserait le fichier des deux
éditeurs, et l'écrire en anglais mettrait un mot en dur dans un registre — ce que la garde
`no-hardcoded-text` refuse, à raison. Un port sans label se dessine par son `name`.

## Le travail suivant : l'inspecteur d'un nœud, puis les étapes 7 à 9

**Un nœud se pose, se déplace, se relie et se supprime — mais rien ne permet d'éditer ce qu'il
contient.** Pas le texte d'un nœud texte, pas le modèle d'un générateur. C'est le premier geste à
écrire, et le plan le range dans l'étape 10 : **une face de plus dans `panels/inspector/`**, jamais
un panneau à part — `main` a posé la règle d'un inspecteur unique.

Ensuite les étapes 7 à 9, dans l'ordre du plan. Trois choses à savoir avant de les ouvrir :

1. **`workflow_publish` compile côté serveur.** L'étape 9 a donc deux voies, pas une : compiler
   localement (`convertWorkflowEditorToFlow`) ou laisser le serveur le faire. La locale reste
   préférable — la validation devient un retour instantané au lieu d'un 400 — mais l'autre existe.
2. **`workflow_create` valide `editor_info` contre le schéma d'import de la webapp**, et exige des
   tableaux `nodes`/`edges` **non vides**. Un graphe sans arête est refusé à la création.
3. **La charge machine fausse `pnpm validate`.** À 130 de load average, huit fichiers dépassent le
   délai de 5 s et la suite passe de 47 s à 200 s. Relancer les fichiers seuls avant de conclure à
   une régression — c'est écrit au § 4 du prompt, et ça s'est produit trois fois de suite.

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
