# Reprise — chantier « workflows et node editor »

**À coller tel quel dans une nouvelle session.** Réécrit le 9 août 2026, après le commit de
l’**étape 5** — livrée, **pas encore rebasée ni fusionnée**.

---

## Le prompt

> Je reprends le chantier « workflows et node editor » de Scenario Studio, dans
> `/Users/pasquelin/Applications/scenario`. Tu travailles en autonomie.
>
> **Mise en place, sans la raccourcir :**
>
> 1. Lis en entier, dans cet ordre : `CLAUDE.md` à la racine (il prime sur tout, y compris sur le
>    plan) ; **ce fichier** ; `docs/REPRISE.md` — le § 4 est le chantier, le § 3.6 les dettes ;
>    puis `docs/plans/2026-08-08-workflows-node-editor.md`. **Les étapes 1 à 5 sont cochées.** Lis
>    leurs encadrés : ils disent où le plan s’est trompé et ce qu’il ne faut pas défaire.
> 2. `cd /Users/pasquelin/Applications/scenario/.claude/worktrees/workflows`. Le worktree existe,
>    `pnpm install` est fait, le binaire Electron est posé, `secrets/.env` est copié.
> 3. **Première chose à faire, avant toute ligne de code** — l’étape 5 est commitée mais pas
>    intégrée, et `develop` a pris une dizaine de commits pendant qu’elle s’écrivait :
>
>    ```bash
>    cd /Users/pasquelin/Applications/scenario/.claude/worktrees/workflows
>    git fetch origin develop
>    git rebase --autostash develop        # `develop` LOCAL
>    pnpm validate > /tmp/v.log 2>&1; echo "EXIT=$?"
>    ```
>
>    **N’enchaîne jamais rebase et merge dans une seule commande.** Puis, depuis le dépôt principal
>    (`/Users/pasquelin/Applications/scenario`, où `develop` est sorti) : `git merge --no-ff
>    feat/workflows`, et `pnpm validate` **après** la fusion — une fusion sans conflit n’est pas une
>    fusion sans contradiction.
> 4. **Vérifie le code de sortie, jamais la dernière ligne.** Référence après l’étape 5 :
>    **356 fichiers de tests, 4495 tests**, `EXIT=0`.
> 5. **Préfixe chaque commande du chemin absolu du worktree.**
>
> **Ce que tu fais : les étapes 6 à 10**, dans l’ordre. L’étape 6 est le canvas — et le
> propriétaire du dépôt a fourni une capture de l’éditeur de la webapp Scenario comme cible
> visuelle : deux nœuds (`Text 1` avec son compteur de caractères, `Image Generator 1` avec sa
> vignette et son modèle en pied de carte), poignées rondes colorées, arête bézier **pointillée**,
> fond en points, barre d’outils flottante à droite (curseur, main, undo/redo, zoom), et un bouton
> **Run** bleu en haut à droite. Demande-la-lui si tu en as besoin.
>
> **Definition of Done à chaque étape, sans demander :** tests écrits avec le code, `pnpm validate`
> vert, `/simplify`, `/code-review`, corrections appliquées, commit. Ces deux passes trouvent des
> défauts réels — à l’étape 5 elles ont rendu **deux bugs reproduits** et une décision d’API à
> revoir. **Casse ton propre code pour voir si le test rougit** : deux de mes tests ne mordaient
> pas, et l’un d’eux ne s’était même pas inséré dans le fichier.
>
> **Deux choses sur lesquelles tu m’arrêtes :** à l’étape 10, le graphe devient-il un septième
> espace ou un type de document dans les six ? Pose-la en arrivant à l’étape. Et si une étape se
> révèle plus grosse **ou plus petite** que le plan, dis-le avec ta recommandation.

---

## L’état exact au moment d’écrire

**Cinq étapes livrées.** Les quatre premières sont fusionnées dans `develop` ; la cinquième est
**commitée sur `feat/workflows` (`4d69a6a`) et n’a pas encore été rebasée ni fusionnée.**

| Étape | Ce qu’elle a livré |
|---|---|
| 1 | Les deux statuts de workflow dans le `JobManager`, et la progression normalisée |
| 2 | Le limiteur de débit, sur le `fetch` du client SDK |
| 3 | Un job payé survit à la fermeture de l’application |
| — | La revue de cohérence : dix défauts, dont quatre qui perdaient du travail ou de l’argent |
| 4 | Le coût d’une génération, estimé avant et affiché après |
| 5 | **Les Apps s’exécutent** : panneau, domaine, registre, trois canaux, `Job.kind`/`targetId` |

## Ce que l’étape 5 a appris, et qui vaut pour la suite

- **Un job dit ce qu’il lance.** `Job.kind` (`model` | `workflow`) et `Job.targetId` ont remplacé
  `modelId`. Les notes de jobs **déjà sur disque** nomment un `modelId` : la relecture accepte les
  deux noms (`storedJob`, `validation.ts`), sinon une génération payée est abandonnée. Ne pas
  simplifier ce schéma.
- **Un seul canal price les deux.** `scenario:estimate-cost` prend une `JobTarget`. Il n’y a **pas**
  de `workflows:estimate-cost` — trois canaux `workflows:*` seulement.
- **`billing.cuCost` est lu**, après `creativeUnitsCost` : c’est le seul chiffre qu’une App puisse
  afficher, et le doute du § 4.5 est levé côté doc (déclaré par les deux références), pas côté
  observation.
- **Un statut inconnu vaut `ready`.** Refuser ce qu’on ne reconnaît pas rendrait toutes les Apps
  inertes si Scenario écrivait `published`. Même esprit que le `kind` inconnu d’un champ, qui
  retombe en saisie brute.
- **Le plancher entre deux estimations est partagé par la fenêtre** (`resetCostBudget` pour les
  tests). Le générateur est à gauche, les Apps à droite : les deux formulaires sont à l’écran
  ensemble, et la boucle de poll est dimensionnée une seule fois sur cette part.
- **`outputsOf` vit dans `runner.ts`**, pas dans le manager : c’est le fichier qui parle SDK. Il
  lit `metadata.assetIds` d’abord, `metadata.flow[].assets[]` ensuite, et déduplique les deux.

## Ce qui reste ouvert sur l’étape 5

1. **Rien n’a été vérifié à l’écran.** Le port de debug 9222 était tenu par une autre session
   (worktree `textures-revue`) ; l’application a bien démarré sur **9223**, mais le MCP `electron`
   ne cherche que 9222. **À faire dès que 9222 est libre** : ouvrir le panneau Apps dans les six
   espaces, vérifier que la liste se remplit, qu’une App s’ouvre sur son formulaire, que le prix
   s’affiche, et lancer la moins chère pour observer ce qu’un **vrai** job de workflow répond.
2. **Trois inconnues attendent ce premier lancement** : la graphie des statuts, l’échelle de la
   progression, et si `metadata.assetIds` est peuplé — ou s’il faut vraiment aplatir `flow[]`.
   Le serveur MCP ne les tranchera pas : il ne liste que les workflows **privés** du compte, et il
   n’y en a aucun.
3. **`git worktree list`** avant de commencer : plusieurs sessions travaillent en parallèle.

## Les pièges déjà payés — ne pas les repayer

- **La convention d’arête de Scenario est inversée** — `{ source: consumer, target: provider }`,
  vérifié dans `lib/workflow_converter.js`. Relire le § 4.4 de `REPRISE.md` **avant la première
  arête** de l’étape 6. Câbler dans le sens intuitif produit un flow retourné à l’export, sans
  erreur et sans avertissement.
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
