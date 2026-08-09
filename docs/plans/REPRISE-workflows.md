# Reprise — chantier « workflows et node editor »

**À coller tel quel dans une nouvelle session.** Réécrit le 9 août 2026 au soir, après la fusion
des **lots B1 et B2** dans `develop` (`7f5c440`).

> ⚠️ **Ce fichier avait disparu.** Le commit `4c48253`, message « clear », a supprimé **cinq**
> documents de `docs/plans/` — 2294 lignes. Celui-ci et le plan du node editor ont été restaurés ;
> **`2026-08-08-3d-completion.md`, `2026-08-08-accueil-verification.md` et
> `2026-08-09-accueil-lot-2.md` manquent toujours à `develop`.** Ils n'appartiennent pas à ce
> chantier : à restaurer par la session qui les a écrits, ou à laisser partir sciemment.

---

## Le prompt

> Je reprends le chantier « workflows et node editor » de Scenario Studio, dans
> `/Users/pasquelin/Applications/scenario`. Tu travailles en autonomie.
>
> **Mise en place, sans la raccourcir :**
>
> 1. Lis en entier, dans cet ordre : `CLAUDE.md` à la racine — il prime sur tout, y compris sur le
>    plan, et sa section « La doc dit la forme ; seul un appel dit la donnée » gouverne tout ce qui
>    touche à l'API ; **ce fichier** ; `docs/REPRISE.md` § 4, § 4.5 et § 3.6 ; puis
>    `docs/plans/2026-08-08-workflows-node-editor.md`. **Les étapes 1 à 6 et 10 sont cochées et
>    fusionnées.** Lis leurs encadrés : ils disent où le plan s'est trompé. Lis surtout, sous
>    l'étape 10, « Le correctif du 9 août », « Le lot B1 » et « Le lot B2 » — elles portent ce que
>    **dix agents de revue** ont rendu.
> 2. `git worktree list`, puis
>    `cd /Users/pasquelin/Applications/scenario/.claude/worktrees/workflows`. Le worktree existe,
>    `pnpm install` est fait, `secrets/.env` est copié.
> 3. **Premier geste** : `git fetch origin develop`, puis `git rebase --autostash develop` (le
>    `develop` LOCAL), puis `pnpm install` si le lockfile a bougé, puis
>    `pnpm validate > /tmp/v.log 2>&1; echo "EXIT=$?"`.
>    **Jamais rebase et merge dans la même commande.**
>    Référence au 9 août au soir, après fusion de B2 (`7f5c440`) : **454 fichiers de test,
>    5759 tests, EXIT=0**, et 1124 fichiers `.ts`/`.tsx` dans `src/`.
> 4. **Vérifie le code de sortie, jamais la dernière ligne.** Si un test échoue dans un fichier que
>    tu n'as pas touché, relance-le seul avant de conclure. Vérifie `uptime` d'abord : à 300 de
>    load average la suite passe de 47 s à 230 s et des fichiers dépassent le délai de 5 s. **Et
>    vérifie à qui appartient un échec** : un budget de couverture qui déborde vient souvent d'un
>    commit arrivé d'ailleurs. La façon de le prouver en quatre minutes : `git checkout --detach
>    HEAD~1`, `pnpm test:coverage`, puis retour sur la branche.
> 5. **Préfixe chaque commande du chemin absolu du worktree.** Le shell retombe dans le dépôt
>    principal entre deux appels — ça a coûté un commit posé sur `develop` au lieu de la branche.
> 6. **Avant toute fusion** : `git status` dans le dépôt principal. L'index est partagé entre
>    sessions du même clone. Compare les chemins sales à `git diff --name-only develop...<branche>`
>    et n'y touche pas s'ils se recouvrent.
>
> **Ce que tu fais, dans l'ordre : les étapes 7, 8 et 9 du plan.**
>
> **Definition of Done à chaque étape, sans demander** : tests écrits avec le code, `pnpm validate`
> vert, `/simplify`, revue de code par **deux agents adverses** (`/code-review` n'est pas invocable
> par le modèle), corrections appliquées, commit, rebase, fusion dans `develop`, puis
> `pnpm validate` **après** la fusion.
>
> **Casse ton propre code pour voir si le test rougit**, une mutation par comportement, et dis
> combien mordent. **Vérifie que la mutation s'est appliquée** avant de conclure qu'elle ne mord
> pas : deux des miennes ont d'abord été rapportées « vertes » alors qu'elles ne s'étaient jamais
> écrites.
>
> **Vérifie à l'écran ce qui se voit.** `pnpm start:debug` puis MCP `electron`.
> ⚠️ Le port 9222 est unique et le verrou d'instance est **global** :
> `lsof -nP -iTCP:9222 -sTCP:LISTEN` avant de lancer, sinon ta fenêtre quitte sans rien dire — et
> si une autre session tient le verrou, **demande** avant de tuer son processus.
>
> **Tu m'arrêtes** si une étape se révèle plus grosse ou plus petite que le plan, avec ta
> recommandation.

---

## L'état exact

**Neuf lots livrés.** Les étapes 1 à 6, l'étape 10 (le septième espace), puis le lot A (la chaîne
du choix de modèle) et les lots B1 et B2 (l'inspecteur d'un nœud).

| Ce qui marche aujourd'hui | Ce qui ne marche pas encore |
|---|---|
| Le graphe est un espace, avec son document `.graph`, sa palette, sa barre et son `⌘Z` | **Rien ne s'exécute** : le graphe décrit, il ne lance pas |
| Un nœud se pose, se déplace, se relie, se supprime | Aucune compilation vers le `flow` de Scenario |
| Un nœud s'édite dans l'inspecteur : texte, note, titre, source d'asset | Onze des quinze types de nœuds n'ont ni face ni comportement |
| Un générateur choisit son modèle, et ses ports se reconstruisent | Aucun import ni export de `.workflow.json` |
| Les Apps de Scenario se listent et se lancent | |

---

## Ce qu'il reste — les étapes 7, 8 et 9

### Étape 7 — compiler, valider, exécuter en local

C'est le cœur, et le plan en donne le détail. Trois choses à ne pas redécouvrir :

1. **Ne pas écrire de compilateur.** `convertWorkflowEditorToFlow({ nodes, edges, inputKeys,
   getModel })` existe dans le SDK. Il rend `type: string` là où l'API veut une union littérale :
   c'est **l'un des rares `as` justifiés du dépôt**, avec son commentaire d'une ligne.
2. **C'est le MAIN qui parle SDK.** `shared/domain/graph.ts` est écrit à la main précisément pour
   que `shared/` ne porte aucune dépendance runtime (invariant 2). Une divergence de forme doit
   échouer au **typecheck** du main, pas à l'exécution.
3. **Le cache par hash est le point à ne pas rater** : changer le prompt du dernier nœud ne doit
   relancer que ce nœud. C'est ce qui rend un node editor supportable.

**Fin d'étape** : cinq nœuds s'exécutent, le prompt du dernier change, **seul le dernier se
relance**, et un cycle est refusé avec un message qui nomme les nœuds en cause.

### Étape 8 — logique, boucles, transforms, approbation

Les onze types restants. `ifElse` est un query builder dont le format existe déjà
(`WorkflowEditorConditionBlock`) ; `transform` évalue du **CEL**, et
`@scenario-labs/sdk/tools/cel` est **déjà installé** — donc l'aperçu en direct pendant la frappe
ne coûte aucune dépendance ; `forEach`/`forEachEnd` est une **paire visuelle** qui se compile en un
seul nœud `for-each`. `approval` ajoute `awaiting-approval` à `JobStatus`, **ce qui change
`isFinished`**.

### Étape 9 — import, export, publication

`validateEditorInfo` accepte la version `'1.0'`. **`workflow_create` exige des tableaux
`nodes`/`edges` NON VIDES** : un graphe sans arête est refusé à la création. Deux refus doivent
**parler** : au-delà de 50 nœuds, et dès qu'un nœud local est dans le graphe — mais **une App
publique en compte 62**, donc vérifier le plafond avant d'écrire le refus.

---

## Les onze pièges déjà payés — ne pas les repayer

1. **La convention d'arête est INVERSÉE** (§ 4.4) : `{ source: consumer, target: provider }`. Une
   entrée est un handle `source` à GAUCHE, une sortie un handle `target` à DROITE. **À relire avant
   la première ligne de l'étape 7** — l'inversion ne produit ni erreur ni avertissement, seulement
   un flow retourné à l'export.
2. **`workflow_publish` existe** côté MCP et compile `editor_info` côté serveur. L'étape 9 a donc
   deux voies ; la compilation locale reste préférable (validation instantanée au lieu d'un 400).
3. **Il n'y a AUCUNE API de palette de nœuds.** La palette est écrite chez nous
   (`spaces/graph/palette.ts`) ; un « générateur d'image » est un nœud `model` narrowé à une
   famille, pas un type de plus.
4. **Un `Partial<Record<…>>` n'exige rien du compilateur.** C'est ainsi que `⌘Z` n'a jamais marché
   dans le graphe. Quand tu ajoutes une capacité à un espace, cherche les tables `Partial`.
5. **`parseGraph` valide le nœud, PAS son `data`.** Tout code qui déréférence `node.data.*` traite
   une entrée non fiable : `"value": null` a fait planter le panneau inspecteur dans son
   `ErrorBoundary`, et un objet sous `type` est parti à React comme enfant. `Array.isArray` et un
   test de chaîne, jamais `typeof … === 'object'`.
6. **`Selection` ne porte qu'UN genre à la fois**, et l'étagère d'assets partage l'écran du graphe.
   La sélection de nœuds vit donc dans `GraphDocument` et n'est que **publiée** au store — mise
   dans le store, cliquer une vignette désélectionnait le nœud et `Suppr` ne trouvait plus rien.
   Le jour où une arête gagne une face d'inspecteur, c'est `Selection` qui doit apprendre à porter
   plusieurs genres, pas `GraphCanvas` qui doit changer.
7. **React Flow ne rapporte la désélection que d'un nœud qu'il a MONTÉ.** Un nœud sorti du graphe
   pendant que le panneau était démonté n'est plus jamais nommé : son id restait dans la sélection
   pour la session entière, et chaque clic suivant se lisait comme deux nœuds.
8. **`DynamicForm` rapporte par frappe et n'a ni focus ni blur.** Sans geste ouvert, un prompt de
   120 caractères fait 120 entrées d'undo, et `HISTORY_LIMIT` vaut 100 : les nœuds et les fils sont
   évincés par la phrase qui les décrit. Il **doit** être chargé en `lazy()` : il tire `zod` et
   `react-hook-form`, 220 kB, et l'inspecteur est placé dans **tous** les espaces.
9. **Le compilateur React n'est PAS actif dans la build**, seule sa règle de lint l'est. Un
   `useMemo` garde son sens, mais une dépendance destructurée d'un record le fait refuser.
10. **jsdom n'a pas `DOMMatrixReadOnly`** — polyfill identité déjà posé dans `test-setup.ts`, ne
    pas le retirer. Et **React Flow n'émet AUCUN changement quand un clic ne modifie rien** : un
    test qui prétend couvrir ce cas reste vert quelle que soit la garde.
11. **Un agent de revue laisse des fichiers sondes dans `src/`.** `find src -name 'zz*'` avant
    chaque commit — ils font échouer `validate` et se commitent sans qu'on les voie.

---

## Ce que la méthode a appris, et qui vaut pour la suite

- **Les deux revues adverses valent leur prix.** Sur les lots B1 et B2 elles ont rendu **dix
  défauts confirmés**, dont une régression introduite par le lot lui-même, deux plantages
  reproduits, et une régression de taille de bundle de 220 kB. Donne-leur des angles différents
  (correction d'un côté, conception et cohérence de l'autre), exige **un scénario d'échec concret
  par défaut**, et qu'elles vérifient chaque piste dans le code avant de la rapporter.
- **Un harnais de test qui fige son objet ne prouve rien.** Un inspecteur relit le store à chaque
  rendu : passé en constante, chaque frappe repart de la valeur d'ouverture, si bien qu'un test
  tapant **un** caractère passe pendant que le deuxième écrase le premier. S'abonner comme
  l'application le fait.
- **Un faux qui ignore son argument est un test qui ne peut pas rougir.** Un `searchModels` bouchon
  laissait passer la suppression du filtre de famille ET la division de la limite par douze.
- **Retirer un test qui ment vaut mieux que le garder.** Quand une garde n'est pas atteignable sous
  jsdom, le dire à l'endroit du test plutôt que de laisser croire qu'elle est couverte.

---

## Trois questions ouvertes, à trancher avec l'utilisateur

1. **Le menu de modèles de l'inspecteur tient en une page de 60** et ne suit pas le curseur, alors
   que le filtre de famille est appliqué **côté main, à la main** (`model-registry.ts`) : sur 642
   modèles publics, celui qu'on cherche peut être sur une page que personne ne demande. Une entrée
   « Parcourir les modèles… » ouvrant `offerModelsOfFamily` rendrait le geste riche du panneau.
2. **Ni identifiants manquants, ni erreur, ni chargement** ne sont dits dans cette face :
   `MissingCredentials` et `failureKeyOf` existent déjà et servent le générateur.
3. **`prepare()` n'apprend toujours pas la famille** — laissé tel quel **délibérément**, l'arbitrage
   étant que le nœud porte son propre sélecteur de modèle. Un seul appelant est touché
   (`AssetInspector.tsx`), pas deux : `home/recreate.ts` passe par `workspaceOfType(type)`, qui ne
   rend jamais `graph`. Et dans l'espace Vidéo, « Régénérer » sur un asset image arme le générateur
   vidéo d'un modèle d'image — hors périmètre, noté pour ne pas être redécouvert.
