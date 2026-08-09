# Scenario Studio — reprise

**Le seul document de travail du projet.** État, ce qu'il reste à faire, les mesures acquises, la
méthode. Vérifié dans le code le 9 août 2026, contre `develop`.

> **La branche de référence est `develop`, plus `main`.** `develop` intègre les features au fil de
> l'eau ; `main` ne reçoit que des merges de release. Ce document, comme les deux manuels et les
> deux architectures, décrit **ce qui est sur `develop`** — donc en avance sur la dernière version
> publiée. Un écart entre ce texte et un binaire installé n'est pas une erreur du texte.

Les conventions et les invariants sont dans **`CLAUDE.md`**, à la racine — ce fichier ne les répète
pas. Pour *comprendre* le logiciel plutôt que reprendre son développement :
[guide de l'utilisateur](fr/guide-utilisateur.md) et [architecture](fr/architecture.md), également
[en anglais](en/).

## Prompt de reprise

Le texte ci-dessous est à coller tel quel dans une session neuve. Il est daté : **le mettre à jour
en même temps que le § 3 quand un chantier est livré**, sinon il envoie la prochaine session refaire
ce qui est fait.

> Je reprends le développement de **Scenario Studio**, dans `/Users/pasquelin/Applications/scenario`.
>
> Lis `docs/REPRISE.md` en entier, puis `CLAUDE.md`. Ne refais pas les mesures du § 6 : leurs
> conclusions sont acquises. Puis `git log --oneline -15`, `git worktree list` et `pnpm validate`
> pour partir d'une base verte.
>
> ## Ce qui vient d'être livré — ne le refais pas
>
> **Le prix d'une génération se voit avant et après** (`feat/workflows`, 8 août 2026). Le bouton
> Générer porte `~N UC`, réévalué pendant qu'on remplit le formulaire ; la ligne de la barre de jobs
> dit ce que la génération a réellement coûté. L'estimation vient d'un `?dryRun=true` qui répond
> **402** — le seul appel du studio où un 4xx est le chemin nominal. Un job repris au démarrage
> n'affiche aucun chiffre, délibérément.
>
> **Le formulaire de génération a quitté le premier écran** (`perf/form-lazy`). `DynamicForm` est
> `lazy()`, et zod vit dans `helpers/dynamic-form-schema` à part de `helpers/dynamic-form` : les
> deux moitiés ensemble, sinon `referencePictures` retient zod dans le graphe eager. Chunk initial
> **2 030,50 → 1 810,88 kB**, −10,8 %. **C'est le L61 du backlog** — il est FAIT, ne pas le
> reprendre.
>
> **Six passes i18n** (`feat/i18n-{cost,typo,wording,scene,order,holes}`) : le prix suit la langue,
> une seule apostrophe française (`’`) dans tout le bundle, un outil porte le même nom dans toutes
> les barres (« Sélection rectangulaire », « Sélection elliptique », « Pivoter »), les deux bundles
> se relisent dans le même ordre, et une interpolation trouve toujours sa valeur. **Les deux manuels
> et les deux architectures ont été réalignés le 9 août** — si tu renommes un libellé, `grep` le
> dans `docs/fr/manuel/` et `docs/en/manual/` dans le même mouvement.
>
> **`renderer/src/no-hardcoded-text.test.ts` voit maintenant les accolades et les branches.** Il
> attrapait un nœud de texte JSX et un attribut à littéral nu. Trois formes lui échappaient, qui
> montrent pourtant les mêmes mots : `title={'x'}` et `{'x'}` en enfant, un gabarit qui interpole,
> et surtout **`{ok ? 'Chargement…' : 'Rien à montrer'}` et `{raté && 'Une erreur'}`** — c'est la
> forme qu'on écrit quand on remplace un `t(…)` par une chaîne. La récursion s'arrête aux
> opérateurs logiques : entrer dans un `===` ferait sonner les huit `side === 'left'` du renderer.
> **Zéro trouvaille sur l'arbre au 9 août**, filet élargi.
>
> **Trois gardes couvrent tout le projet, une fois chacun.** Ils se partagent l'arbre sans se
> recouvrir, et c'est ce partage qu'il faut garder en tête avant d'en toucher un :
>
> | Garde | Ce qu'il tient |
> |---|---|
> | `renderer/src/no-hardcoded-text.test.ts` | les `.tsx` : texte entre balises, accolades, branches, attributs |
> | `main/no-hardcoded-text.test.ts`, § « the main process » | les dialogues natifs, **et depuis le 9 août les `label` du menu** |
> | `main/no-hardcoded-text.test.ts`, § « the registries » | les `.ts` de `renderer`, `shared` et `preload` |
>
> Le troisième est le moins évident et le plus utile : un descripteur de champ, une définition
> d'outil, une ligne de réglage ne sont ni un composant ni un dialogue, donc les deux premiers ne
> les voient pas — et c'est précisément là qu'un libellé habite. Il distingue une clé d'un mot :
> `label: 'skybox.exposure'` est le motif à encourager, `label: 'Exposure'` est le défaut.
>
> **Il vit dans `main/` alors qu'il surveille le renderer**, et ce n'est pas une négligence : il
> lit l'arborescence sur le disque, or `src/shared/` est compilé pour le web aussi, où `node:fs`
> n'a ni types ni raison d'être. Le poser dans `shared/` casse `pnpm typecheck`.
>
> **Deux champs sont volontairement hors surveillance**, et pas par facilité : `name`, parce qu'un
> nœud de scène en porte un comme **donnée de document** — une scène dont le contenu s'appelle
> `Groupe` ne s'échange pas avec un studio anglais — et qu'un store en porte un comme identifiant
> de stockage ; `message`, parce qu'il nomme l'échec d'un worker, jamais un écran.
>
> **Ce fichier s'appelle `no-hardcoded-text`, pas `*.i18n.test.ts`.** Une session l'a cherché sous
> le second motif, ne l'a pas trouvé, et en a réécrit un doublon complet avant de s'en apercevoir.
> Les sept gardes i18n ne portent pas tous le même nom : `grep` sur le sujet, pas sur le motif.
>
> **Avant cela**, `feat/textures-materiau` (8 août) : l'espace **Textures** a son panneau matériau —
> une face de l'inspecteur unique, avec le remap à double poignée — et sa bande de canaux, en
> colonne de droite. Le viewport est nu. Le § 3.4 dit ce que ce lot a appris et qu'il ne faut pas
> repayer ; **les étapes 6 à 8 restent entières**.
>
> ## Trois choses inachevées sur ce lot, à traiter avant de l'oublier
>
> 1. **Rien n'y est vérifié à l'écran.** jsdom ne compile aucun shader : les tests prouvent le texte
>    du GLSL, pas ce qu'il dessine. La liste de ce qu'il faut voir est à la fin du § 3.4. Il faut un
>    projet ouvert et `pnpm start:debug`, donc `secrets/.env` copié dans le worktree — une session
>    précédente s'est vu refuser cette copie par la politique de permissions, prévois-le.
> 2. **Trois angles de revue sur cinq n'ont pas rendu** sur ce diff — bugs par reproduction,
>    historique git, adverse three.js/React. Les relancer est le premier geste utile si un défaut
>    apparaît dans cet espace.
> 3. **Deux dettes notées et non traitées** : `design/MenuRow.tsx` n'expose aucun `aria-checked`
>    (aucun lecteur d'écran ne dit quelle ligne est active, dans **tous** les menus du studio), et
>    `useDocuments.refresh()` ne passe pas par `forgetDocument`, donc les vues de session d'un projet
>    quitté y survivent.
>
> ## Le plan, à trancher avec moi avant d'ouvrir un worktree
>
> Propose-moi un ordre et attends ma réponse. Les candidats, sans priorité imposée :
>
> - **§ 3.4, étapes 6 à 8** — dérivations en shader, tiling, export. La suite directe, et le plus
>   gros manque fonctionnel restant hors workflows.
> - **Backlog qualité P1** (`.claude/loop/BACKLOG.md`) — **vérifie d'abord ce qui reste** : les
>   statuts de ce fichier ont déjà menti trois fois. Au 9 août il restait L59/L60 (le `useCallback`
>   autour de `run`, débloqués depuis la fusion de `feat/ergonomie`) et L31 sur quatre budgets
>   tendus plus `app/**` et `panels/**` qui n'ont aucun budget. **L61 est fait** — voir ci-dessus.
> - **§ 3.3 + § 3.5** — les 13 lignes actionnables de la table du § 3.3, les 3 vues mortes du skybox
>   et l'export en 6 faces.
> - **§ 3.6** — les dettes transverses : borne de débit sur l'API, jobs qui ne survivent pas à la
>   fermeture, index du catalogue.
>
> ## Les règles de travail
>
> - **Un worktree par chantier**, dans `.claude/worktrees/<nom>`, branche partant de `develop`.
>   Copie `CLAUDE.md` dedans, `pnpm install`.
> - **Rebase sur `develop` LOCAL après chaque étape**, et `pnpm validate` vert **après** le rebase.
>   Plusieurs sessions travaillent en parallèle : `git worktree list` avant d'ouvrir quoi que ce
>   soit, et ne prends pas un sujet déjà tenu.
> - **Avant chaque merge : `/simplify` puis `/code-review`**, corrections appliquées. C'est la
>   definition of done du dépôt, pas une option — et une revue interrompue n'est pas une revue.
> - **Mets la doc à jour** quand le code change ce qu'elle affirme — manuel fr *et* en, et ce
>   fichier. Un grep sur les tournures de manque (« ne sait pas », « pas encore », « aucun bouton »)
>   trouve en trente secondes ce qu'aucune fusion ne signalera.
> - **Ce fichier est une reprise, pas un journal.** Le récit d'une correction appartient au message
>   du commit qui la porte. N'écris ici que ce qui coûterait une seconde fois.
> - **Pose-moi les questions avant d'attaquer. N'invente jamais** : si un choix de conception se
>   présente, demande.
> - **Aucune dépendance nouvelle** sans mon accord. Les tests e2e (Playwright) sont reportés à la
>   fin du projet, c'est décidé.
> - **Un composant = un fichier.** Vérifie que ça n'existe pas déjà avant d'écrire du custom
>   (`design/`, `helpers/`, `hooks/`, `shared/`). **Règle absolue : aucun code dupliqué.**
> - Code performant : 8,33 ms par frame dans le renderer, 16 ms pour toute opération synchrone du
>   main.
>
> ## Trois leçons des dernières sessions
>
> **Les revues qui reproduisent trouvent ce que les revues qui lisent ratent.** Demande
> explicitement la reproduction et la sortie qui la prouve. Et **casse ton propre code pour voir si
> un test rougit** : sur le dernier lot, deux tests écrits de bonne foi ne mordaient pas — l'un
> mesurait une garde au lieu du défaut, l'autre cherchait un mot qu'aucun bundle ne contient.
>
> **Une fusion sans conflit n'est pas une fusion sans contradiction.** C'est arrivé encore une fois :
> `develop` avait ajouté un test d'exhaustivité sur `LogScope` que git a fusionné proprement, et dont
> les portées neuves manquaient. Après chaque rebase, relis ce que le résultat affirme.
>
> **Un commentaire déplacé garde sa formulation et perd sa vérité.** Le dernier bug de rendu vient de
> là : une JSDoc recopiée d'un module où elle était exacte justifiait, dans le nouveau, un test faux.

Si la demande touche l'API Scenario : `docs/scenario-api/README.md`, 209 pages aspirées en local,
**à consulter avant le web**. La conception validée est dans
`docs/specs/2026-08-06-scenario-studio-design.md`, 13 sections — c'est la seule spec qui reste,
celles de la configuration et de l'espace 3D ayant été supprimées une fois leurs chantiers livrés.

> `docs/specs/`, `docs/scenario-api/` et `docs/superpowers/` sont **ignorés par git**. Un document
> qui compte et qui atterrit dans l'un des trois est invisible du dépôt et absent de tout worktree
> neuf. **Ce qui doit survivre à la session vient ici, et est commité.**

---

# 1. L'état

**892 fichiers dans `src/`, dont 352 de test — `pnpm test` en exécute 4442. 6 espaces
éditables. **Les six types de documents s'enregistrent**, et fermer un onglet demande avant de
perdre quoi que ce soit. L'espace Image est complet : ses cinq gestes sont offerts, recadrage
compris.**

> Les deux comptes sont **relevés sur une passe réelle** du 9 août, pas déclarés : les `it.each`
> exécutent plusieurs cas chacun, donc le total d'un `describe` ne se lit pas dans le fichier. Ne
> recopier aucun de ces trois nombres sans avoir relancé `pnpm validate` — plusieurs sessions
> fusionnent dans la journée.

`pnpm validate` est vert, **budget de couverture compris** : il lance `test:coverage`, dont les
seuils sont des **budgets d'éléments non couverts** par glob (`vitest.config.ts`), pas des
pourcentages.

**Il sortait en 1 sur `develop` le 8 août** : `engines/{scene,skybox,viewport,texture,gpu}/**` était
à 367 branches non couvertes pour 310 permises, depuis la fusion des espaces Image et 3D. Deux
chantiers l'ont refermé sans se concerter — `test/gpu-coverage` sur le GPU, `feat/3d-finition` sur
les 57 branches de logique pure qui n'en étaient pas. Le glob est à **232 pour 310**, 78 de marge.
Ce qui reste dessous est du moteur WebGL que jsdom n'exécute pas.

`engines/{timeline,canvas,audio,core}/**` suit à **242 pour 250**, huit de marge : c'est lui, le
tendu. Deux globs sont à **zéro** : `main/diagnostics/**` et `renderer/src/services/**`, le canal
qui dit les échecs — une branche que personne n'exerce y serait un échec que personne ne lirait.

**Couvrir avant d'élargir** ; le commentaire du fichier dit le seul cas où élargir est légitime
(un glob dont la marge de croissance est du GPU intestable).

> **Un grain de sable environnemental subsiste : les tests lents dépassent leur budget de 5 s quand
> la machine porte plusieurs sessions** — des sous-ensembles différents à chaque passage, verts en
> isolation. Ce n'est pas une régression. Il rend `validate` capricieux pour tout le monde tant que
> plusieurs worktrees tournent en parallèle.
>
> **Ce n'est pas un seul fichier, ni une seule cause.** `settings/ShortcutsSettings.test.tsx` a été
> le premier nommé, `licences/LicencesWindow.test.tsx` est tombé le 8 août : ceux-là pilotent
> `userEvent`, qui est lent. Le 9 août ce sont deux `it` de `renderer/src/eager-graph.test.ts` qui
> sont tombés en timeout — **et celui-là ne touche pas à `userEvent`** : il construit un graphe
> Rollup. Relancé seul dans la foulée, le fichier passe en 4,93 s de temps de test, sous le budget.
> La marge est le vrai sujet, pas le fichier ni le mécanisme. Devant un échec de ce genre, le
> réflexe est `vitest run <le fichier>` en isolation, ou
> `vitest run --coverage --maxWorkers=2` pour toute la passe, avant de chercher une cause dans le
> code.

L'application démarre par `pnpm start`.

## Ce qui est fait

**Le socle** — Electron + electron-vite + React 19 + TypeScript, shell à docks type IDE, design
system maison (`renderer/src/design/`), i18n fr/en partagé entre le menu natif et l'UI, contrat IPC
typé des deux côtés, `contextIsolation`/`sandbox` actifs, navigation verrouillée.

**La chaîne de génération** — réglages chiffrés par `safeStorage`, client `@scenario-labs/sdk` dans
le main, `ModelRegistry` avec auto-pagination et cache, `JobManager` qui poll seul et borne la
concurrence, `DynamicForm` construit depuis les descripteurs — et chargé paresseusement, zod avec
lui. Aucun formulaire de génération écrit à la main (invariant 5).

**Le prix, avant et après** — `main/scenario/cost.ts` tire l'estimation d'un `?dryRun=true` qui
répond 402, et `useCostEstimate` la tient à jour sous le bouton Générer, débounce plus plancher
partagé avec le polling du `JobManager`. Le coût réel se capte à la soumission, à côté du job et
non dedans, et s'affiche sous la barre de sa ligne.

**Les projets** — un dossier, un manifeste, un catalogue SQLite. Le catalogue tourne sur son propre
`worker_threads` : de 16 blocages du thread principal à 0.

**Les six espaces** — Image (PixiJS), 3D (three.js), Vidéo (timeline, moniteur, ffmpeg), Audio,
Skyboxes, Textures. Un éditeur par type de document, chargé à l'ouverture, jamais avant.

**L'espace Image édite pour de bon** — calques, groupes, masques, seize modes de fusion,
sélection qui borne les outils, poignées de transformation, formes, texte, calques de réglage,
cinq éditions IA et l'export PNG. Une image de l'étagère y entre par trois portes : le dépôt sur
la toile, le double-clic, et l'outil Image… (`⇧⌘K`). **Il s'ouvre sur le pointeur, jamais sur le
pinceau** : le premier clic sur une image ne doit pas pouvoir y laisser une trace. Le pinceau écrit
là où le curseur est, y compris sur un calque déplacé, mis à l'échelle ou pivoté. Cf. § 3.2 pour ce
qui reste.

**La configuration** — un registre de commandes unique lu par le menu natif, le clavier et l'écran
des raccourcis ; un registre de réglages qui gouverne les préférences et la validation côté main.

**La persistance des documents** — écriture atomique, marque « modifié », puce sur l'onglet,
relecture à l'ouverture. Le mécanisme est générique et **les six genres y sont branchés** depuis
`feat/documents-erreurs` : `IO_BY_KIND` est un `Record` complet, seule liste qui fasse foi, et un
test itère `DOCUMENT_KINDS` pour le verrouiller. Cette ligne annonçait encore trois genres après la
fusion qui l'a démentie — le § 3.1 disait déjà l'inverse.

**Le manuel utilisateur** — 19 chapitres, fr et en (`docs/fr/manuel/`, `docs/en/manual/`). Il ne se
relit pas, il **se vérifie** : les registres (`COMMAND_REGISTRY`, `IMAGE_TOOLS`, `UNBUILT_TOOLS`,
`TOOL_PLACEMENTS`, `IO_BY_KIND`) et le bundle i18n disent ce que le logiciel fait — l'impression
qu'on en a, non.

> **Cette méthode n'est pas décorative : elle a rattrapé une inversion complète.** `feat/panels-layout`
> a échangé les deux colonnes, et le manuel a continué pendant plusieurs fusions à envoyer le
> lecteur chercher chaque panneau du mauvais côté — 24 passages dans chaque langue. Une doc fausse
> coûte plus cher qu'une doc absente. **Un merge qui déplace une surface visible n'est pas fini
> tant que les deux manuels ne l'ont pas suivi.**

**La bibliothèque du compte** — badges d'emplacement recalculés par `assetBadgeOf` (jamais stockés :
ils dépendent du compte actif), envoi d'une sélection, facette « Emplacement », et le menu
contextuel d'un asset qui **liste** ses destinations au lieu de les enfouir dans une cascade de
`if`. `cloud.pull`, `cloud.browse` et `cloud.plan` traversent la frontière et sont testés, mais
**aucune surface ne les appelle** : le transfert n'a qu'un sens aujourd'hui, et trois des sept
badges sont hors d'atteinte tant que c'est le cas — cf. § 3.6.

**Le journal d'activité** — `main/project/activity-log.ts`, sa liste filtrable par niveau et par
sujet, son compteur dans la ligne d'état, et ses bulles. Deux décisions y sont verrouillées par le
code : **seuls les échecs font une bulle**, et **une bulle n'expire pas** — c'est sa fermeture qui
la marque lue, pas quatre secondes écoulées pendant qu'on regardait sa toile.

**Les cinq éditions par le modèle aboutissent, et se trouvent.** `familyOf` produit désormais
`upscale`, `background-removal` et `vectorization` : les capacités de l'API ne les distinguent pas
— les 24 modèles concernés déclarent tous `img2img` — et c'est le tag qui tranche, après les
capacités et seulement si elles ont répondu `image` (deux des neuf `remove-background` sont des
modèles vidéo). `FAMILY_TAGS` (`shared/domain/model.ts`) se lit dans les deux sens : le registre y
prend le tag dont il pré-filtre une liste côté serveur. Les trois familles ont leur écran de
réglages — c'est le seul endroit où leur modèle se choisit, le panneau Modèles ne montrant que la
famille de l'espace — et une édition sans modèle y mène au lieu d'ouvrir une impasse. Le générateur
suit la famille de l'édition le temps d'une parenthèse, refermée par `connectPreparation` quand on
quitte l'espace. Enfin les cinq commandes ont une ligne dans le menu Image : elles n'en avaient
aucune, et aucun raccourci non plus — elles restent sans touche, elles dépensent du crédit.

**L'entrée d'une image dans un ciel** — l'espace Skyboxes avait son moteur, son undo et son panneau,
mais aucune porte. Trois l'ouvrent : le double-clic sur un asset, le dépôt depuis l'étagère, et la
génération, qui retient le document d'où elle est partie et s'y pose seule. Les modèles de panorama
ont leur famille, reconnue au tag `sc:skybox` — cf. § 3.5.

**Le prompt s'écrit à quatre mains** — le champ que le modèle désigne (`promptSpark`, lu de son
schéma) porte trois actions : proposer des variantes réécrites, traduire le brouillon vers la langue
des modèles, lire le style des références déjà posées sur le formulaire. Une variante s'adopte en
deux gestes séparés — le texte seul, ou le texte **et** les réglages — parce qu'écraser un ratio
qu'on vient de choisir n'est pas une décision qu'une suggestion prend seule. Les réglages proposés
sont filtrés contre les descripteurs du modèle avant de traverser la frontière : le SDK les type
`unknown`, et une valeur hors bornes est écartée plutôt que ramenée de force. Côté bibliothèque, une
image qui arrive sans nom utile est nommée toute seule, en lots et sous une file bornée. Détails et
pièges : § 1, « Ce qui n'est pas commencé ».

## Ce qui n'est pas commencé

**La surface Scenario que le studio prend est plus étroite qu'elle n'en a l'air.** Dix canaux
`scenario:*`, cinq `assets:*` et quatre `cloud:*` couvrent la génération, le catalogue de modèles,
les jobs, l'upload, la bibliothèque et l'assistance au prompt — et rien d'autre. Ce qui n'est **pas**
touché, endpoint par endpoint : les workflows, `dryRun` et le coût, `usages` et le solde, `detect`,
`patch`, l'entraînement, la composition de LoRA, les écrans de collections, et la recherche par
similarité visuelle. **Le § 4 est l'inventaire raisonné de ce trou**, avec ce qui vaut d'être pris et
ce qui vaut d'être laissé.

**L'assistance au prompt en est sortie** — `feat/prompt-assist`, fusionnée le 8 août 2026.
`generate/prompt`, `caption`, `describe_style` et `translate` sont branchés. Ce qu'il faut en
retenir avant de toucher au reste de la liste ci-dessus :

- **Ces quatre-là ne sont asynchrones qu'en apparence.** Chacun répond avec un `Job`, mais son
  résultat est dans la réponse du POST — `prompts` y est une propriété *requise*. Il n'y a rien à
  interroger, et le `JobManager` n'est pas concerné. Vérifier ce point sur `detect` et `patch`
  avant de supposer qu'ils ont besoin de lui.
- **`generate/prompt` est gratuit** (0 unité créative, mesuré par `dryRun`) et rend bien plus qu'un
  texte : des `calls` complets, paramètres conformes au schéma du modèle cible.
- **Le champ à assister n'est pas deviné** : `GET /models/{id}` marque ses entrées d'un
  `promptSpark`, que `FieldDescriptor` transporte désormais. C'est le prolongement de l'invariant 5.
- **`caption` exige un identifiant d'asset** : un fichier resté local n'en a pas. La description
  automatique porte donc sur le rapatriement depuis la bibliothèque, pas sur l'import d'un fichier
  du disque, qui exigerait de l'envoyer d'abord.
- **La file `assist-queue` est à part du `JobManager`**, et le restera : il n'y a ici ni asset à
  collecter, ni statut à interroger. C'est le seul endroit du studio qui dépense sans qu'on le lui
  ait demandé, d'où l'interrupteur `generation.captionArrivals` dans les préférences.
- **`isRetryable` et `withRetry` ont quitté le `JobManager`** pour `scenario/retry.ts`. Tout ce qui
  appelle l'API en tâche de fond doit passer par là plutôt que réécrire un backoff.

## Corrigé — ne pas le re-signaler

Ces quatre points traînaient dans les anciennes notes de reprise. Ils sont réglés dans le code.

- **Les documents n'appartenaient à aucun projet.** `useDocuments` était persisté sans clé de projet
  et les onglets d'un projet réapparaissaient dans le suivant, pointant sur des fichiers absents —
  ou pire, sur un fichier de même id dans un autre projet. Le store **n'est plus persisté du tout** :
  le dossier du projet dit quels documents existent, le layout persisté dit lesquels sont ouverts
  (JSDoc de `useDocuments`).
- **`pnpm start` chargeait `out/renderer/`** au lieu du serveur Vite, fenêtre vide.
  `scripts/dev-app-identity.mjs` renomme le bundle *et* son exécutable, ce qui faisait mentir
  `app.isPackaged` en plein run de développement — et six autres comportements basculaient avec lui.
  `src/main/environment.ts` lit désormais `__DEV__`, injecté par `define` au build.
- **Un second registre de commandes** orienté menu natif avait été construit en parallèle du vrai.
  Supprimé. **Ne pas recommencer** — cf. § 3.2.
- **`reconcile` ne parcourait pas l'arbre entier** dans le moteur canvas, ce qui détruisait les
  textures des enfants de groupe. Corrigé — **ne pas le recasser**.
- **L'étagère à assets était à droite dans tous les espaces**, où elle mangeait la largeur du
  canvas. `TOOL_PLACEMENTS` (`shared/domain/tool.ts`) la pose désormais en **bande du bas** partout
  sauf en Vidéo et en Audio, où la colonne de droite la porte — la timeline occupe le bas. Depuis,
  la **colonne de gauche est réservée à la génération** dans les six espaces, et la droite porte ce
  qui parle du document, inspecteur en moitié basse.
- **La disposition par défaut nommait un panneau dans chaque moitié**, ce qui imposait la réponse
  d'un espace aux cinq autres — l'Explorateur gagnait partout, y compris en Image où les Calques
  viennent en premier. Une moitié vaut désormais `null` quand personne ne l'a choisie, et chaque
  espace y lit le premier panneau qu'il déclare. **Ne pas remettre d'identifiant dans
  `DEFAULT_OPEN`.**

---

# 2. Le plus urgent

**La couche documents n'est plus ici : elle est livrée** (`feat/documents-erreurs`, 8 août 2026).
Les six genres s'enregistrent, fermer un onglet demande, un document se supprime, et l'Explorateur
rouvre ce qui a été fermé. Le détail est au § 3.1, avec ce que la revue a laissé ouvert.

**Ce qui prend la place, à trancher :** le § 3.6 — aucune borne de DÉBIT sur les appels à l'API
(100 requêtes/minute par projet, trois bornes de concurrence et zéro borne de débit), et un job qui
ne survit pas à la fermeture de l'application, donc du travail payé et perdu. Les deux sont les
étapes 2 et 3 du plan `feat/workflows`, en cours dans son propre worktree : **vérifier ce qu'il en
reste avant de les rouvrir.**

L'espace **Textures** a avancé de deux étapes le 8 août : le panneau matériau et la bande de canaux
sont livrés (§ 3.4). Il lui reste les **étapes 6 à 8** — dérivations en shader, tiling, export —
écrites et non commencées, et c'est le prochain manque fonctionnel par ordre de valeur hors
workflows.

> **La surface d'erreur n'est plus ici, et il ne faut pas l'y remettre.** Elle occupait ce
> paragraphe depuis longtemps : `handle` ne journalisait pas une promesse rejetée, et le renderer
> n'avait aucun endroit pour le dire. C'est réglé. `services/diagnostics.ts` porte `reportFailure`,
> `main/project/activity-log.ts` garde ce qui s'est passé, et l'utilisateur le lit dans la ligne
> d'état — bulle pour un échec, compteur rouge tant qu'il n'est pas lu, liste filtrable par niveau
> et par sujet. Les neuf portées déclarées (`activity.scope.*` dans le bundle i18n) disent ce qui
> est branché ; **une nouvelle voie d'échec s'y ajoute, elle ne se rejournalise pas ailleurs.**

---

# 3. Ce qu'il reste à faire

## 3.1 La couche documents

Le chantier le plus transverse : rien de ce qui suit n'est spécifique à un espace.

**Ce qui est posé.** `main/project/documents.ts` écrit dans `documents/<id>.<ext>`, **atomiquement**
(fichier de transit puis `rename`) et en file d'attente par fichier. Le tour complet — ⌘S, marque
« modifié », puce, relecture — est générique et fonctionne. `IO_BY_KIND` (`app/document-io.ts`)
porte **trois entrées sur six : `scene`, `texture` et `image`**.

**Ce que l'image a coûté au contrat, et qui sert aux trois suivants.** `DocumentDraft` accepte des
`parts` — des fichiers à côté du contenu — et le genre `image` s'écrit en dossier `<id>.img/` : un
manifeste, et un PNG par surface. `DocumentIo.capture` est devenu **asynchrone** parce qu'une
lecture GPU l'est ; la marque est lue synchronement, avant le premier `await`, et c'est la
propriété à ne pas casser. Trois pièges y ont été payés, inutile de les repayer :

- **une sauvegarde sans pixels efface ceux du disque.** Un dossier est remplacé en entier, donc
  `capture` refuse plutôt que d'écrire un document amputé quand le moteur est injoignable — ce
  qu'il est tant qu'il monte son contexte GPU, exactement quand tombe un ⌘S après un changement
  d'espace ;
- **l'état atteint le moteur un commit React après le disque.** Les pixels relus visent des
  surfaces pas encore nées : ils patientent dans `pendingSnapshots`, comme le fait déjà une image
  posée ;
- **le nom d'une partie traverse une frontière de sécurité.** Le renderer les choisit, le main en
  fait des chemins : `isPartName` n'accepte ni séparateur ni remontée, et le rôle passe DEVANT
  l'identifiant (`p_`, `m_`) pour que le nommage reste injectif.

### Les quatre points de ce paragraphe sont livrés — `feat/documents-erreurs`, 8 août 2026

**1. Les six genres s'enregistrent.** `IO_BY_KIND` est un `Record` complet, plus un `Partial`, et
un test itère `DOCUMENT_KINDS` pour le verrouiller. Les cinq genres qu'une chaîne contient passent
par **une fabrique unique**, `textDocumentIo` : la comptabilité autour du passage — lire la marque
avant l'écriture, la rendre après, charger hors historique, ouvrir propre — était écrite deux fois
et allait l'être cinq. **La traversée JSON appartient à la fabrique**, pas aux appelants : c'est le
`SyntaxError` d'un fichier qui n'est pas du JSON qui arme le refus d'écraser, et un lecteur qui
l'avalerait perdrait la protection sans rien pour l'attraper. `serializeSequence` et ses pareils
n'existent plus.

**2. Fermer un onglet demande.** La croix de Dockview est masquée — elle retire un panneau et rien
d'autre — et celle qui la remplace passe par `closeDocument`. La question est posée par l'OS
(`main/project/document-dialogs.ts`), le renderer ne la formule pas. Le clic droit sur un onglet
offre fermer / fermer les autres / **supprimer le document**, qui est le seul geste du studio qui
efface un fichier de l'utilisateur.

**L'ordre est le contrat** : la question précède l'écriture, l'écriture précède l'oubli, et
`saveDocument` répond désormais *si* l'écriture a eu lieu — un refus (fichier illisible) laisse
l'onglet ouvert au lieu de fermer sur du travail qui n'a jamais atteint le disque.

**3. L'Explorateur liste les documents du projet**, ouverts ou non, dans les six espaces ; un
double-clic ouvre en changeant d'espace si besoin. L'arbre de scène a pris son propre panneau,
`scene`. Deux pièges payés : Dockview est remonté par espace, donc un panneau ajouté à l'API
sortante est jeté par le `fromJSON` du suivant — la file d'attente se vide **après** la
restauration ; et `relist` (lister) est séparé de `refresh` (réconcilier), avec **un compteur de
génération chacun**, sans quoi un listage déclenché par le panneau faisait abandonner la
réconciliation du projet et tous les onglets restaient sans descripteur.

**4. Les erreurs se voient.** La chaîne `reportFailure` → journal → toast existait ; ce qui
manquait était que la déduplication rendait muet le second échec du **même geste**. Elle ne vaut
plus que pour ce que personne n'a demandé (`GESTURE_SCOPES` dans `services/diagnostics.ts` — pas
dans `shared/ipc.ts`, rien n'en traverse la frontière). Un chargement de document raté était
totalement silencieux dans les six espaces : il est rapporté depuis `restoreDocument`, seul endroit
qui sache qu'une lecture a échoué.

**Ce qui reste ouvert sur ce chantier**, relevé en revue et non traité :

- **l'Explorateur détourne `selectedIds` de `Collection`** pour dire « ouvert ». `Collection`
  place l'ancre et le tab stop sur la dernière ligne sélectionnée : ses lignes sont les seules du
  studio sans accès clavier. Le mécanisme qui manque est « activer une ligne » (double-clic,
  Entrée) dans `Collection` — `DraggableAsset` a déjà le même `onDoubleClick` fait main ;
- **le double-clic sur un asset ne traverse pas les espaces**, là où l'Explorateur le fait
  (`helpers/asset-intents.ts` exige un onglet déjà ouvert et refuse en silence sinon). Deux
  réponses différentes à la même question, à trancher ;
- **`src/renderer/src/app/**` et `panels/**` ne sont sous aucun budget de couverture** : c'est ce
  qui a laissé cinq fichiers neufs y atterrir sans qu'aucun seuil ne bouge ;
- **`src/main/project/**` est à marge NULLE** (115/115 statements) et `document-io.ts` à une
  branche près.

### Deux comportements à connaître avant d'y toucher

Le premier est délibéré, le second est un bug.

**Un document dont le fichier a refusé de s'ouvrir ne s'enregistre plus du tout**, jusqu'à sa
prochaine ouverture — le `Set` `unreadable` dans `app/document-io.ts`, dont la JSDoc porte le
pourquoi. C'est voulu : l'éditeur vide qu'une lecture ratée laisse est indistinguable d'un document
neuf, et sans ce refus le premier ⌘S écrirait `{ nodes: [] }` par-dessus la scène illisible. Le
fichier est la seule copie. **Ne pas lever ce refus** — et depuis `feat/documents-erreurs`, la
raison part au journal et répondre « Enregistrer » à la fermeture ne ferme plus l'onglet.

**La marque « modifié » mentait** après plus de 100 modifications suivies d'une annulation
complète — **corrigé**, `History` retient la dernière commande qu'il a laissée tomber (`dropped`),
et `markOf` vaut « la dernière de la pile, ou celle-là quand il n'en reste aucune ». Le récit
ci-dessous est gardé parce qu'il explique le champ. `markOf` valait `past.at(-1) ?? null`, et
`HISTORY_LIMIT` plafonne la pile à 100 : au-delà,
les plus anciennes commandes tombent, une annulation intégrale ramène `past` à vide, donc à `null` —
la valeur que porte aussi un document enregistré alors que son historique était vide. Le document se
dit propre alors qu'il ne l'est pas. Le remède est un **jeton monotone par commande** dans
`engines/core/history.ts`, partagé par tous les espaces.

---

## 3.2 Mode Image

**L'ergonomie de l'espace Image, premier tour.** La boîte de transformation suit la rotation du
calque — `layerBoxOf` l'ignorait, et les poignées d'un calque de travers flottaient à côté de
l'image. La géométrie passe par `layerMatrix`, la matrice que Pixi compose déjà pour le sprite,
donc elle ne peut plus diverger. La rotation n'a plus de poignée : elle s'attrape dans le quart
de disque **hors** de chaque coin, mesuré contre les deux arêtes qui en partent. Le curseur
s'oriente sur la direction nominale de la poignée, tournée par l'angle et retournée par le signe
des échelles. Les marching ants de map3D arrivent, avec un seul helper pour les trois surfaces
qui pointillent. Les vingt raccourcis d'outil existent enfin — ils étaient affichés et écoutés
par personne — et le conflit `L` (lasso contre ligne) est tranché.

> **Un défaut trouvé en revue, qui valait la branche à lui seul.** `resizeBy` recalait la
> position dans l'espace non tourné, or `x` et `y` portent le point autour duquel la rotation
> s'applique : la correction le déplaçait, et l'arête qu'on tirait *contre* partait de 707 px à
> un quart de tour. Le test de la branche produisait le défaut sans le voir — il n'assertait que
> les échelles. Corrigé, et vérifié dans l'application : le coin ancré ne bouge plus d'un pixel.

> **Un piège du registre, non refermé.** `defaultBinding` accepte n'importe quelle chaîne.
> Seize commandes ont été écrites `'P'` au lieu de `'KeyP'` : typecheck vert, lint vert, aucun
> test du dépôt n'a bronché — seul un test de bout en bout l'a attrapé. **Une garde sur le format
> des signatures manque**, et elle vaudrait son écriture.

**Ce qui reste sur cet espace**, et qui était prévu : le pinceau n'a toujours pas de taille
réglable (`BrushSettings` porte `size`, `hardness` et `opacity`, `BrushControls` n'expose que la
couleur), et un outil qui ne peut rien faire — calque verrouillé, groupe, calque de réglage — le
refuse sans un mot au lieu de le dire au curseur.

## 3.3 Espace 3D

> **Fusionné dans `main`, en deux temps.** Onze étapes d'abord
> (`feat/3d-completion`, plan et journal dans
> [`docs/plans/2026-08-08-3d-completion.md`](plans/2026-08-08-3d-completion.md)), puis cinq commits
> de finition (`feat/3d-finition`) : le canal qui dit les échecs, Draco et KTX2, la ligne du manuel
> sur le sprite, et la dette de couverture refermée.

**Ce qui existait avant** — 17 primitives, 5 types de lumières, gizmo translate/rotate/scale,
sélection par raycast, inspecteur dérivé des descripteurs, undo avec coalescing par geste, 5 slots
de textures PBR, outliner, vol libre, enregistrement du document.

**Ce que la branche ajoute** — sélection multiple, groupes et reparentage, import glTF/GLB,
magnétisme et repère local, ombres réglables par nœud, environnement IBL depuis une skybox du
projet, glisser-déposer d'un asset dans le viewport, dupliquer/copier/coller, `sprite`, caméra
orthographique, six vues normalisées, trois modes d'affichage, export glTF/GLB/USDZ, et un BVH
construit en worker pour le picking.

### Ce qui manque encore

| Manque | Pourquoi il reste |
|---|---|
| Instanciation, LOD | écartés par le plan tant qu'aucun cas réel ne les réclame : le seul coût mesuré était le picking, et il est réglé |
| Graisses d'une police | une seule coupe par famille est offerte, le romain. Un sélecteur de graisse demande d'indexer les faces par famille au lieu d'une par famille — mécanique, pas conceptuel |
| three livré deux fois | le chunk du worker BVH pèse 490 ko parce qu'il embarque three, déjà dans le bundle principal. Chargé à la demande et en local, donc supportable — mais c'est du poids d'installation en double |

**Comblé depuis** — l'export d'un sprite est documenté (ni glTF ni USDZ n'ont d'objet face à la
caméra, vérifié dans le code des exporteurs) ; le chapitre 09 a ses sections sur le magnétisme,
le repère local, les ombres et l'environnement ; **Draco et KTX2 sont branchés**, décodeurs
copiés depuis three au postinstall et servis depuis `public/` — le chemin absolu qu'on croit
naturel casse en `file://`, il fallait le relatif, vérifié sur le build empaqueté.

### Le texte 3D, et la typographie que les deux espaces partagent

**`TextGeometry` n'est pas employé.** Il lit une police au format typeface de three, dont aucun
projet ne contient d'asset et dont le studio n'embarque rien ; le `TTFLoader` qui convertirait
va chercher `opentype.js` sur un CDN, ce que la politique de la fenêtre interdit. Les contours
viennent donc d'`opentype.js` en dépendance, deviennent des `Shape` et sont extrudés directement
— ce que `TextGeometry` fait de toute façon.

**Trois polices OFL sont commitées** dans `src/renderer/public/fonts/`, licences à côté : une
scène qui les emploie s'ouvre à l'identique partout. Les polices du système s'ajoutent, lues par
le main — `fonts:list` et `fonts:read` — parce que le renderer n'a pas `fs`.

**Les deux espaces qui écrivent du texte partagent la référence, pas la machinerie.** Un
`FontRef` et une liste (`shared/domain/font.ts`, `services/fonts.ts`), le même `FontField` dans
les deux inspecteurs — mais la 3D veut des contours parsés et l'espace Image une `FontFace` posée
dans la page : un visage en chemins ne sert à rien à `Text`, et une `FontFace` ne sert à rien à
`ExtrudeGeometry`. Le calque texte de l'espace Image ne code donc plus `sans-serif` en dur.

Cinq choses apprises en le construisant, toutes trouvées en revue ou sur la vraie machine :

- **le main lit la table `name` par plages, jamais le fichier entier** : 267 familles en 200 ms.
  Une lecture entière coûterait 192 Mo rien que pour `Apple Color Emoji.ttc` ;
- **une longueur non bornée lue dans un fichier de police tue le processus main.** Node *assert*
  qu'une longueur de lecture tient dans un entier 32 bits signé, et l'assertion native passe sous
  tout `catch` : un seul fichier corrompu dans `~/Library/Fonts` empêchait le studio de démarrer.
  Les lectures sont bornées à la taille réelle du fichier, et un test le verrouille ;
- **`opentype.js` refuse la signature `ttcf`**, or macOS livre l'essentiel de ses polices en
  collections. Une face en est extraite table par table, directory réécrit ;
- **un nom de police est localisé** : sans préférence pour l'anglais, la police système d'Apple
  s'offrait sous le nom « Tipus de lletra del sistema » ;
- **89 % des polices d'une machine Apple se parsent**, pas 100 : les faces héritées emploient des
  formats de `cmap` qu'`opentype.js` ne lit pas. L'échec est dit dans le journal (`font.face`) et
  le texte retombe sur la police par défaut — le document, lui, garde le nom qu'il portait.

### Le clic du trièdre aboutit à `viewFrom`

`ViewHelper.handleClick` sert à savoir **quel côté** a été cliqué, rien de plus : son animation
est épuisée en un pas, la caméra remise où elle était, et le déplacement laissé à `viewFrom` —
qui garde la distance, écarte les pôles de l'axe et prévient `OrbitControls`.

Deux pièges trouvés en revue : le helper est bâti **sur la caméra que le viewport avait au
montage**, et un passage en orthographique la remplace — il est donc reconstruit à chaque
changement de projection ; et une caméra posée exactement sur sa cible ne donne aucune direction,
d'où l'écart avant lecture. Les trois boutons des axes négatifs, jusque-là masqués, sont
réaffichés : le helper les teste au rayon qu'ils soient dessinés ou non.

### Les échecs de la 3D ne sont plus silencieux

`diagnostics:report` va du renderer vers le main, en regard de `diagnostics.onLog` qui fait
l'inverse. Le main préfixe le domaine par `renderer/` à l'arrivée et n'accepte qu'un domaine de
la liste partagée `LOG_SCOPES` : une ligne ne peut pas se faire passer pour lui.

Six échecs y sont branchés : un `.glb` illisible, une texture introuvable — sous un nom par
espace, 3D, Textures et Skyboxes —, un export de scène ou d'image que le disque refuse, et un
enregistrement de document qui échoue.

Trois choses apprises en le construisant, toutes trouvées en revue :

- **le cache de textures est construit par trois moteurs**, et annonçait `scene.texture` pour les
  trois. Il reçoit son rapporteur comme il reçoit déjà son chargeur ;
- **un échec périmé accusait un fichier que la scène allait dessiner** : relâcher puis reprendre
  une clé pendant que le premier chargement volait encore, et son rejet était rapporté alors que
  le second allait aboutir — la déduplication gravait ensuite ce fantôme et aurait tu le vrai ;
- **un rapport est dit une fois par sujet**, sinon un moteur reconstruit à chaque panneau détaché
  remplit le journal. La mémoire s'efface au changement de projet.

**Ce qui reste du chantier « surface d'erreur »** : rien ne s'affiche encore à l'écran, et six
autres avaleurs de rejets attendent (`Rail`, `peaks`, `prepareEdit`, `decoder-pool`,
`useWaveSurfer`, `Models`). Une piste écartée volontairement : journaliser dans `handle()` couvrirait
les quarante canaux d'un coup, mais une erreur du SDK embarque la clé API — il faudrait la réduire
avant, et `log.ts` l'écrit en gros.

### Le plafond du décodage IPC a été contourné, pas résolu

**⌘S gèle toutes les fenêtres au-delà de ~5 500 nœuds**, et c'est le **décodage du clone IPC** qui
l'y amène — 73 % du coût, deux fois et demie la sérialisation, intouché.

L'import glTF aurait dû faire franchir ce plafond : un GLB apporte ses maillages par milliers. Il
ne le fait pas, parce que **le modèle importé est un seul nœud portant une référence**, jamais un
sous-arbre de nœuds. Le document grossit d'une ligne quel que soit le poids du fichier. Le prix est
que l'intérieur d'un modèle ne s'édite pas ; une commande « éclater » est ce qui lèverait la
limite le jour où elle gênera. **Le décodage reste à traiter avant tout ce qui poserait des nœuds
par milliers.**

### Ce que la nuit a appris

- **Un helper de lumière porte l'identifiant de sa lumière** pour qu'un clic dessus la sélectionne.
  Il est donc posé dans le viewport **à côté** des nœuds, comme la grille, le trièdre, le gizmo et
  la cible d'une directionnelle. L'export s'en sort par construction — il ne reçoit que les objets
  des nœuds — et c'est vérifié sur le fichier produit, pas supposé.
- **`GLTFLoader` nomme chaque maille qu'il ramène.** Le picking rendait donc `mesh_0` comme
  identifiant de nœud, écrivant un fantôme dans la sélection, l'historique et le document.
  `nodeIdOf` n'accepte plus qu'un nom que le moteur a lui-même posé.
- **Un type de nœud ignoré du chargeur disparaît en silence.** `isSceneNode` ne connaissait pas
  `group` : une scène groupée rouvrait sans ses groupes, leurs enfants pendant à un parent que
  rien ne nommait. Le même piège attendait `sprite`. **Tout nouveau type de nœud se teste par un
  aller-retour disque.**
- **Les exporteurs écrivent une transformation locale.** Exporter une sélection imbriquée sans
  aplatir la place où elle est dans son parent, pas où elle est dans la scène.
- **`SpriteMaterial` naît transparent** — three l'écrase exprès. L'éteindre à pleine opacité fait
  dessiner le carré entier de toute image à canal alpha.
- **Un `Sprite` n'est pas un `Mesh`** : toute branche de libération gardée par `instanceof Mesh`
  laisse fuir son matériau.
- **La conversion rad→deg→rad n'est pas exacte.** Diffé en radians, un axe intact était déclaré
  bougé à 13 % près : une rotation écrasait les deux autres axes de la sélection.
- **Un `SettingRow` de genre `number` refuse les décimales** — deux réglages de magnétisme étaient
  inatteignables, leur propre défaut compris. Un test verrouille la règle pour tout futur réglage.

### Le coût d'un clic, mesuré

`scene-picking.bench.ts`. Le rayon qui *touche* est le cas cher : three teste une sphère englobante
avant de marcher les triangles, donc un rayon qui rate ne coûte rien quelle que soit la densité.

| Scène | Avant | Avec le BVH |
|---|---|---|
| 3 modèles de 131k triangles | 7,3 ms | **0,016 ms** |
| 3 modèles de 524k triangles | 32 ms | **0,018 ms** |
| 2500 petites mailles | 0,13 ms | — |

Le seuil que le plan s'était fixé était 2 ms. L'arbre est construit **en Web Worker** (invariant 6),
seulement au-delà de 20 000 triangles, et seulement pour les modèles importés : une primitive du
studio fait trente triangles et se marche plus vite qu'un arbre ne se construit.

**Le chemin chaud de l'inspecteur n'est pas un sujet** — audité, chiffré, clos. Cf. § 6.

### La dette de relecture des étapes 8 à 11 est payée

**Les quatre sujets ont eu leur seconde lecture** (`feat/3d-dette`) : `sprite`, les modes
d'affichage, l'export et le BVH. Elle a rendu **sept défauts confirmés et corrigés**, chacun avec le
test qui le verrouille, et une liste de constats vérifiés mais non traités, écrits plus bas.

**Ce qui a été trouvé.**

- **Un rejet d'export n'atteignait personne.** Le `.catch` de `SceneDocument` était posé autour du
  seul appel au bridge, pas autour de l'encodage, et l'appel part en `void` : un `parseAsync` qui
  refuse laissait le clic de menu indistinguable d'un dialogue annulé — ni journal, ni écran.
  L'encodage est passé sous le même garde.
- **Aucun modèle à textures KTX2 ne s'exportait**, dans aucun des trois formats. `GLTFExporter` et
  `USDZExporter` **lèvent** sur une texture compressée au lieu de la sauter, et ni l'un ni l'autre
  ne recevait `setTextureUtils` — or le `KTX2Loader` est branché sur le chargeur de modèles depuis
  `feat/3d-finition`, donc un GLB qui en porte est ordinaire. Les deux reçoivent désormais un
  décodeur. **Il décode sur un renderer à lui, jamais celui du viewport** : `decompress` appelle
  `setSize` sur celui qu'on lui donne, et lui passer le viewport redimensionnerait le canvas qu'on
  regarde.
- **La surcouche filaire était sous le pointeur.** Une ligne est touchée à un **monde entier**
  d'elle-même (`Raycaster.params.Line.threshold` vaut 1), et la surcouche pend sous chaque maille :
  en mode « rendu + filaire », chaque arête de la scène portait un halo cliquable de cette taille,
  et un clic dans le vide à côté d'un cube le sélectionnait au lieu de vider la sélection. Elle est
  désormais aveugle au rayon, comme elle était déjà absente de la carte d'ombres.

**Ce qui a été cherché et écarté — ne pas le refaire.**

- **Le BVH et les groupes de matériaux.** `three-mesh-bvh` construit exprès une racine par plage de
  groupe pour qu'un triangle ne change jamais de groupe au réordonnancement. Le worker, lui,
  reconstruit une géométrie nue — position et index — donc sans `groups` ni `drawRange` : l'index
  qu'il renvoie est réordonné sur une seule plage, et `MeshBVH.deserialize` le repose sur la
  géométrie vivante (`setIndex` vaut `true` par défaut). Une géométrie à plusieurs groupes verrait
  donc ses matériaux appliqués aux mauvais triangles. **Non atteignable aujourd'hui** :
  `accelerate` n'est appelé que depuis `buildModel`, et `GLTFLoader` ne produit jamais de `groups`
  — il fait une maille par primitive. À traiter le jour où un arbre sera construit ailleurs que
  sur un modèle importé.
- **Un changement de type sur un id stable.** `syncNode` ne libère et ne rebâtit que sur un
  `model` devenu autre chose ; tout autre changement de type garderait l'objet three.js du type
  précédent, muet. **Non atteignable** : chaque commande qui crée un nœud bat un id neuf, et un
  document se relit dans un moteur vide. Laissé tel quel plutôt que gardé contre un état que rien
  ne produit.

Le reste de ce qui avait été trouvé au premier regard est écrit dans le plan, étape par étape.

**Quatre défauts de plus, trouvés par les passes adverses et corrigés ensuite.**

- **Le picking d'un modèle importé était faux dès que le fichier entrelaçait ses attributs.**
  `GLTFLoader` entrelace dès que le pas d'octets le dit, et l'`array` d'un attribut entrelacé est
  le tampon **entier** — normales et uv compris. Envoyé tel quel au worker, l'arbre décrivait un
  maillage inexistant et les clics rataient ce qu'ils touchaient, seulement une fois l'arbre
  arrivé. Les coordonnées sont lues attribut par attribut.
- **Un index en `SHORT` corrompait l'affichage.** Abandonné parce que ni `Uint16` ni `Uint32`, il
  faisait prendre la géométrie pour non indexée ; le worker rendait un index d'une autre longueur
  que `deserialize` écrivait par-dessus le vivant aussi loin qu'il portait, sans rien lever. Il est
  élargi.
- **L'export USDZ posait une sélection imbriquée au mauvais endroit.** `clone` recopie `matrix`, et
  décomposer la matrice monde écrit à côté d'elle ; `GLTFExporter` rafraîchit avant de lire,
  `USDZExporter` non. La correction de l'étape 10 ne valait donc que pour glTF.
- **Le gizmo gardait la caméra perspective après un passage en orthographique.** Il en reçoit une
  au montage et lance son rayon de prise depuis elle : poignées à la mauvaise taille, un tirer en
  bord de vue partait dans l'orbite, un tirer plus au centre écrivait une translation sur le
  **mauvais axe** dans le document. Il se rebranche comme le trièdre.

### Ce que la relecture a trouvé et que personne n'a encore traité

Vérifié, non corrigé, par ordre de gravité. Chaque ligne est actionnable telle quelle.

| Où | Quoi |
|---|---|
| `shadows.ts:42` via `SceneRenderer.ts:617` | `applyShadowFlags(deep)` traverse **au-delà des nœuds enfants** : régler une ombre sur un parent écrase les drapeaux de ses enfants, que `syncNode` ne répare jamais (`previous === node`). Un changement de thème rejoue l'écrasement sur toute la scène. Corriger en arrêtant la traversée sur tout enfant portant l'id d'un nœud connu |
| `bvh-builder.ts:34-45` | `dispose()` n'est pas définitif : `workerOf()` respawne sans condition, donc la boucle série de `accelerate` fait naître un worker **après** le démontage du moteur, que rien ne terminera. Un drapeau `disposed` suffit |
| `bvh.worker.ts` | Aucun canal d'échec — pas de `try/catch`, pas de variante d'erreur, et le builder n'écoute ni `'error'` ni `'messageerror'`. Une exception laisse la promesse suspendue, garde la géométrie dans `building` pour toujours et bloque les mailles suivantes |
| `SceneRenderer.ts:772` | `void this.accelerate(holder)` avale ses rejets alors que `scene.model` est branché vingt lignes plus haut |
| `main/scene/export.ts:24` | Le message d'erreur de `writeFile` **livre le chemin absolu au renderer** (invariant 1) : un `EPERM` traverse la frontière et part au journal. À trancher avec l'asymétrie connue de `savePicture`, qui rend déjà le chemin |
| `SceneRenderer.ts:599` | Le fichier exporté porte des **UUID** en guise de noms : `object.name = node.id`, et le `name` du document n'atteint jamais le fichier. Le test qui semblait le prouver utilisait une fixture dont l'id vaut le nom |
| `scene-export.ts` | Une lumière directionnelle ou spot **perd son orientation** : la cible est sœur des nœuds, non exportée, et three prévient elle-même |
| `SceneRenderer.ts:389` | Un nœud **caché** produit un fichier vide, écrit sans un mot (`onlyVisible` vaut `true` chez les deux exporteurs) |
| `scene-export.ts` | Un GLB **riggé** sort en glTF invalide, `"joints":[null,null]` : `SkinnedMesh.copy` partage le squelette de l'original, hors du sous-arbre exporté. `model-cache.ts:28` a le même défaut — une instance riggée est pilotée par les os du cache |
| `scene-export.ts:37` | Le décodeur de textures compressées crée un `WebGLRenderer` **par slot de map**, pas par texture (le cache de `GLTFExporter` n'indexe pas la compressée), et laisse derrière lui des écouteurs `dispose` morts plus un singleton de module qui retient la dernière texture. Coût sur le thread UI, et rétention |
| `services/diagnostics.ts` | `reportFailure` dédoublonne par `scope:subject`, et le sujet de l'export est le **format** : le second export raté du même format est muet. Insuffisant pour une action relancée à la main |
| `three-sync.ts:68` | Le mode `rotate` s'arme sur un sprite et n'a aucun effet — le shader ne lit que les longueurs de colonnes — mais salit le document et empile un undo vide |
| `scene-document.ts:160` | `isSprite` est le seul garde non dérivé de sa table : un champ ajouté au descripteur ne sera pas vérifié à la relecture |
| `ViewportEngine.ts:105-120` | Le passage ortho → perspective jette le zoom accumulé ; `frameSelection` ne redimensionne pas le tronc orthographique, donc `F` en ortho ne change rien à l'écran |

**Sur le sprite, l'export et le BVH, « rien trouvé » n'est plus le verdict** : les passes ont rendu
sur les trois. Ce qui reste ci-dessus n'a pas été traité faute de périmètre, pas faute d'avoir
regardé.

**Les deux résolutions de rebase sont relues.** `image-generation.ts` réimplémentait
`generation-landing.ts` — 91 lignes contre 15, mêmes claims, même settle, à une différence de
comportement près : l'espace Image pose *tous* les assets d'un lot, les autres le premier. Cette
différence est devenue un champ, `takes: 'first' | 'every'`, et les quatre espaces passent par le
même mécanisme. L'extraction de `saveDialog` dans `services.ts` est propre ; **une asymétrie
confirmée et laissée telle quelle** : `pickSavePath` pose un filtre d'extension, `savePicture`
n'en pose aucun — on peut donc enregistrer des octets PNG sous un nom que rien ne contraint.

Second point : **sur Windows et Linux, un raccourci qu'une surface écoute elle-même attend la
touche Windows, pas `Ctrl`** — `signatureOf` lit `event.metaKey`. C'est la convention de tout
`COMMAND_REGISTRY`, `⌘Z` compris, donc antérieure à cette branche ; la corriger touche la
résolution des raccourcis de toute l'application. Documenté aux chapitres 15 et 18 du manuel.

---

## 3.4 Espace Textures

**Livré jusqu'à l'étape 5** (`feat/textures-materiau`, 8 août 2026). Le document `.tex`, les huit
canaux comme domaine, le viewport partagé, le panneau matériau, la bande de canaux — et la
vérification à l'écran reste due, cf. la fin de ce §.

### Ce que les étapes 4 et 5 ont appris, et qu'il ne faut pas repayer

Le récit de ce qui a été corrigé est dans les messages de `feat/textures-materiau`. Ne restent ici
que les faits qui coûteraient une seconde fois.

- **Les noms de chunks de three sont vérifiés, et un test les tient.** `roughnessmap_fragment`,
  `metalnessmap_fragment`, `aomap_fragment` et `void main() {` sur 0.185.1, testés contre le vrai
  `ShaderLib.physical` — un renommage amont fait rougir `material-shader.test.ts` au lieu d'un
  écran. Une ancre manquante est **rapportée** (`texture.shader`), pas avalée : le rendu continue
  sans son remap plutôt que de sortir une sphère noire.
- **Le masque de cavité n'a aucun slot** dans `MeshStandardMaterial` : il passe par un uniform à
  lui, avec sa **propre matrice d'uv** et le define `USE_UV`, parce que three ne construit la
  matrice que d'une carte qu'elle connaît.
- **Ne jamais poser `needsUpdate` sur une texture pour la déplacer.** Il incrémente aussi
  `source.needsUpdate` : three réuploade les pixels ET reconstruit les mips. Huit canaux 2K, c'est
  128 Mo par frame. `matrixAutoUpdate` suffit ; seuls `wrapS`/`wrapT` sont de l'état d'upload.
- **Deux canaux portent de la couleur**, `baseColor` et `emissive` — `contentOf` le dit, et un
  test exhaustif sur l'union le verrouille. La version précédente testait `channel === 'baseColor'`
  et sortait l'émission assombrie.
- **Une borne se déclare une fois** (`MATERIAL_BOUNDS`, `PREVIEW_BOUNDS`), lue par le champ et par
  le parseur. Et un angle s'**enveloppe** (`normalizeAzimuth`) là où une échelle se clampe : clamper
  un angle jette ce que l'auteur du fichier avait écrit.
- **`MenuButton` agit au lieu d'ouvrir quand il n'a qu'une ligne** (`useHoverFlyout(rowCount)`).
  Un menu qui peut se retrouver à une seule ligne doit en offrir une seconde, fût-elle désactivée.
- **Un dépôt refusé doit parler**, et sa portée va dans `GESTURE_SCOPES` : `AssetDropTarget` ne
  peut pas refuser pendant le vol — un glissement annonce son type, pas où est son fichier.

**Ce qui reste de l'étape 5** : l'import d'un fichier du disque **directement** dans un canal. Le
détour existe (importer dans le projet, puis déposer sur la vignette) et il est écrit au manuel.
`IMPORTABLE_TYPES` ne connaît pas les canaux, donc c'est un chemin à ouvrir, pas un bug.

**Trois angles de revue sur cinq n'ont pas rendu** sur ce lot — bugs par reproduction, historique
git, adverse three.js/React. Les relancer sur ce diff est le premier geste utile si un défaut
apparaît dans cet espace.

**Noté ailleurs, hors périmètre** : `design/MenuRow.tsx` n'expose aucun `aria-checked`, dans tous
les menus du studio ; `useDocuments.refresh()` ne passe pas par `forgetDocument`, donc les vues de
session d'un projet quitté y survivent.

**6 — Dérivations en shader.** `engines/texture/derive/` : quad plein écran, `WebGLRenderTarget`,
**port injectable** (jsdom n'a pas de WebGL). Sobel height→normal d'abord. **Aucune boucle JS sur des
pixels.** Puis « améliorer ce canal » : `model_sc-texture-converter`, **via le `JobManager`**, jamais
un appel direct au SDK. Un job rend six canaux ; `collector.ts` sait déjà les répartir par
`metadata.type`.

**7 — Tiling.** Aperçu 1×/2×/4× (multiplicateur **local**, jamais écrit dans `material.tiling`),
détection de coutures par gradient aux bords, seamless par décalage d'une demi-largeur. `overlap` et
`featherRadius` sont les paramètres de `model_scenario-texture`. Appliqué à tous les canaux **avec les
mêmes valeurs**, sinon ils se désalignent.

**8 — Export.** glTF/GLB, Unity, Unreal, Roblox, canaux bruts. Empaquetage ORM (AO=R, Roughness=G,
Metallic=B) **en une passe shader**. L'écriture disque passe par le main. `GLTFExporter` vient de
`three/addons`. C'est ici que « aperçu en 1024, export en pleine résolution » s'applique.

**Ce qui n'est TOUJOURS pas vérifié à l'écran, et qui devrait l'être avant l'étape 6.** L'espace
s'ouvre, le document se crée, l'état vide s'affiche — c'était acquis avant ce lot. Restent à voir de
ses propres yeux, avec un projet ouvert et le MCP `electron` après `pnpm start:debug` :

- **la sphère éclairée** et une image posée en couleur de base (le viewport noir d'avant venait de
  l'environnement studio manquant, corrigé depuis) ;
- **le remap** : un canal de rugosité plat, les deux poignées écartées, et le contraste qui apparaît.
  jsdom ne compile aucun shader, donc les tests de `material-shader.test.ts` prouvent le texte du
  GLSL et **pas** ce qu'il dessine ;
- **le masque de cavité**, pour la même raison, et parce que c'est le seul uniform à porter sa propre
  matrice d'uv ;
- **la vue à plat** d'un canal, en `image-rendering: pixelated`.

Un jalon visuel validé uniquement par des tests unitaires n'est validé qu'à moitié — § 5.

---

## 3.5 Espace Skyboxes

**Livré.** Une image entre par trois chemins et le ciel s'allume. Le moteur, l'étalonnage GPU, le
soleil attrapable au raycast, les sondes et l'undo étaient déjà là depuis l'étape précédente ;
`setSource` n'était simplement appelé de nulle part, et l'état vide promettait depuis le début
« Générez-en une ou déposez un panorama » sans que rien ne tienne la promesse.

**La famille `skybox` ne se déduit pas des capacités.** Vérifié contre l'API en ligne, pas supposé :
l'énumération des capacités n'a **aucune** valeur skybox, et les trois modèles publics
(`scenario-skybox-flux`, `scenario-skybox-gpt`, `hunyuan-world-image-to-skybox`) répondent `txt2img`
et `img2img` comme n'importe quel modèle d'image. Le tag **`sc:skybox`** est le seul signal qui
existe — d'où `familyOf(capabilities, tags)` qui consulte le tag en premier. Le même tag sert de
pré-filtre serveur : garder trois modèles sur six cents en marchant le catalogue page par page coûte
huit allers-retours pour remplir un écran. **`skybox-upscale` ne porte pas ce tag** et reste avec les
images, ce qui est correct : un agrandisseur ne produit pas le document de l'espace.

**Ce qu'il reste, dans l'ordre du coût croissant :**

**1. Trois vues sur quatre sont des boutons morts.** `SKYBOX_VIEWS` en déclare quatre ; le renderer
n'expose aucun `setView`. Le state de `SkyboxDocument.tsx` ne pilote que la couleur du bouton :
`equirect`, `cross` et `faces` ne dessinent rien.

**2. L'export n'existe pas, et son vocabulaire attend depuis le début.** `CUBE_FACES`, `FACE_LABELS`
(`Rt`/`Lf`/`Up`…, ce que les moteurs attendent), `CROSS_CELLS`, `FACE_SIZES`, `isCubeFace` sont
écrits et testés dans `shared/domain/skybox.ts` — et **référencés par leurs seuls tests**. Rien ne
convertit l'équirectangulaire en six faces, alors que la conception promet « aperçu 360, export HDRI
vers la 3D ». Le domaine a été écrit pour un export qui n'a pas suivi ; le faire, c'est une passe
shader et un écrivain, pas une refonte.

**3. Le `.sky` ne s'enregistre pas** — c'est l'un des quatre `DocumentIo` manquants du § 3.1, à
traiter avec eux et non à part.

**Un piège à connaître avant d'y toucher.** Un `.hdr` **n'est pas importable** : `IMPORTABLE_TYPES`
(`main/media/link.ts`) ne connaît que vidéo, audio et image, et un `.exr` importé est catalogué
`image`, jamais `skybox`. C'est sans conséquence aujourd'hui — le puits accepte toute image du
projet, quelle que soit son étagère — mais quiconque cherchera « pourquoi mon HDRI n'apparaît pas
dans l'import » cherchera là.

---

## 3.6 Dettes transverses

> **Le débit est borné depuis l'étape 2 de `feat/workflows`** (`scenario/rate-limiter.ts`). Ce qui
> suit décrit la dette et reste vrai de son diagnostic ; ce qui a changé est dit à la fin.

**Rien ne bornait le DÉBIT des appels à l'API.** La limite est **100 requêtes par minute et par
projet** — écrite noir sur blanc dans la copie locale,
`docs/scenario-api/guides/get-started/documentation/workflows-and-apps.md`, § « Rate Limits », avec
10 jobs de workflow concurrents et 50 nodes par workflow. `limits.ts` ne borne que la **taille des
lots** (`GET_BULK_MAX` 200, `DELETE_MAX` 100, `PAGE_SIZE_MAX` 100), et le `JobManager` ne borne que
la **concurrence**. Ce sont trois grandeurs différentes : dix jobs concurrents qui pollent toutes les
deux secondes font déjà 300 requêtes par minute à eux seuls, et par-dessus s'ajoutent le catalogue,
les vignettes de modèles par lots de 100 ids, les previews, et une synchro d'assets.

Depuis `feat/prompt-assist`, il y a une **troisième** source d'appels : `assist-queue.ts` borne la
concurrence de l'assistance de fond, et sa JSDoc dit elle-même qu'elle « décide seulement quand le
travail tourne » — donc pas le débit. Trois bornes de concurrence, zéro borne de débit.

Ce qui tenait, et pourquoi ce n'était pas une solution : le `retry` de `scenario/retry.ts` réessaie
les 429 en backoff exponentiel. **Le studio dégradait au lieu de casser** — mais un limiteur est ce
qui évite d'y arriver, et un backoff sous rafale rallonge chaque génération de la file.

**Ce qui a été livré, et l'endroit où le plan se trompait.** Une fenêtre glissante de 100 requêtes
sur 60 secondes, **par compte** — la limite est par projet, et une clé porte son projet. Elle n'est
pas dans `reducedBy` comme le plan l'annonçait : `reducedBy` **n'est pas le passage obligé**, c'est
un enrobage de deux familles de handlers IPC (`scenario` et `assets`), et le `JobManager` poll
droit à travers son runner sans le traverser. Le vrai passage obligé est le **`fetch` du client
SDK**, injectable par `ClientOptions.fetch` : aucun appel n'existe sans client, la pagination
automatique et les réessais internes du SDK y passent aussi, et un appelant ne peut pas l'oublier.

Six choses à savoir avant d'y toucher, dont deux qui ont coûté une revue chacune :

- **une fenêtre, pas un seau à jetons.** L'API compte des requêtes par minute : un studio resté
  inactif peut légitimement en dépenser cent d'un coup — c'est ce que fait l'ouverture d'un projet —
  là où un seau qui se remplit d'un jeton toutes les 600 ms étalerait cette rafale pour rien ;
- **95, pas 100.** Le studio compte une requête quand il la lâche, l'API quand elle arrive. Cent
  admises juste avant la bascule peuvent atteindre le serveur groupées derrière un uplink lent et
  tomber dans la même minute côté serveur que la première de la fenêtre suivante — un 429 pour un
  client irréprochable. `RATE_MARGIN` absorbe cette dérive ;
- **un appelant tenu longtemps se voit répondre `429`, il n'attend pas.** Le SDK arme le timeout
  d'une requête **avant** d'appeler le transport (`client.js`, `fetchWithTimeout`) : chaque
  milliseconde d'attente est prise sur le budget de l'aller-retour lui-même. Le transport ne tient
  donc un appel que `MAX_WAIT_MS` (10 s) ; au-delà il rend une réponse **429 de synthèse portant
  `retry-after-ms`**, que le SDK sait attendre au millimètre et réessayer. **Lever une erreur ne
  marche pas** : le SDK rattrape tout ce qui sort du transport, le réessaie et le remballe en
  `APIConnectionError` — la limite de débit arriverait à l'utilisateur en « échec réseau » sur une
  connexion saine ;
- **le plafond d'attente est compté à l'arrivée de l'appelant, pas quand son tour vient.** Compté
  au tour, chaque attendant recevrait un budget neuf à mesure que le précédent est servi, et une
  file de n'importe quelle profondeur serait tenue aussi longtemps qu'il le faut — exactement ce
  que le plafond existe pour borner ;
- **l'horloge est monotone** (`performance.now`). Une horloge murale qui recule — un portable qui
  se réveille, un pas NTP — laisserait dans la fenêtre des instants situés dans le futur, que rien
  n'expire, et **tout appel d'API serait refusé** jusqu'à ce que le temps rattrape ;
- **les acquisitions sont sérialisées**, sinon tous les appelants réveillés par la même expiration
  se disputent l'unique place libérée et le plus ancien peut perdre indéfiniment. C'est de l'ordre,
  pas de la priorité : une ouverture de projet passe toujours ses lectures de catalogue devant la
  génération demandée juste après ;
- **les téléchargements d'assets n'y passent pas.** `download()` (`services.ts`) va chercher une
  URL signée par `net.fetch`, et les envois multipart du SDK vont directement sur S3 avec le
  `fetch` global (`lib/upload.js`). Les deux sont hors du quota, et c'est correct : ce ne sont pas
  des appels d'API.

**L'annulation passe devant — la dette est payée, pas assumée.** Elle était écrite ici comme
insoluble à bon compte : une annulation est un appel d'API comme un autre, donc elle prenait un
ticket dans la même file, se voyait tenue 10 s, puis répondre 429 que le SDK réessaie — le bouton
Annuler pouvait rester mort **deux minutes** sur un job facturé pendant ce temps. La revue de
cohérence de la branche l'a reproduite et l'utilisateur a tranché pour le vrai remède, celui que
cette section nommait déjà : **une file à priorité**.

Deux moitiés, et il faut les deux. Passer devant dans la file ne suffit pas — une fenêtre pleine
fait attendre la même expiration à tout le monde, quel que soit l'ordre. Il faut donc aussi des
**places réservées** (`URGENT_RESERVE`, 5 sur les 95 admises) qu'un appel ordinaire ne peut pas
prendre. La priorité voyage par `AsyncLocalStorage` (`asUrgent`) et non par un argument, parce que
le seul lecteur est le transport et que tout ce qui se trouve entre les deux est le SDK, qui
n'offre aucun passage. **Réservé à l'annulation** : c'est le seul appel dont le but est d'arrêter
la dépense.

**Le polling se règle sur ce qu'il a le droit de dépenser.** À la concurrence par défaut
(`concurrentJobs: 3`) et un poll toutes les 2 s, trois jobs dépensaient **90 requêtes par minute
sur les 100** — avant le catalogue, les vignettes et l'assistance ; à la concurrence 10 des
workflows, 300. Ce n'était pas qu'un inconfort : au-delà de quatre jobs, le limiteur tenait chaque
poll, le SDK réessayait, et une génération **vivante et payée** était rapportée en « échec — limite
de débit » au bout d'une quinzaine de secondes.

L'intervalle est donc calculé, plus fixe : `max(2 s, jobs × 60 s / POLL_REQUESTS_PER_MINUTE)`, avec
**75** requêtes par minute pour le poll seul. Une génération isolée garde ses 2 s — une barre qui
avance vaut ses requêtes ; six s'espacent à 4,8 s ; dix à 8 s. Le budget est sous les 90 places
ordinaires (95 moins la réserve d'annulation), de sorte qu'une ouverture de projet derrière trois
générations garde une part au lieu de faire la queue derrière une boucle qui ne s'arrête jamais.
Le `JobManager` le calcule depuis son propre compteur `running`, sans rien demander au limiteur :
aucun câblage entre les deux.

**La moitié rapatriement de la bibliothèque n'a pas de porte.** `cloud.pull`, `cloud.browse` et
`cloud.plan` traversent la frontière, sont testés, et **aucun composant ne les appelle** — la JSDoc
de `stores/cloud.ts` le dit elle-même : le planificateur sait calculer un diff bidirectionnel, et
personne ne le lui demande. Seul `push` a un bouton, dans la barre de l'étagère.

Deux conséquences à ne pas confondre avec des bugs :

- **trois des sept badges sont inatteignables** — `to-pull`, `conflict` et `other-account` ne
  peuvent pas se produire tant que rien ne modifie le côté distant sans qu'on le demande. La
  facette « Emplacement » n'en propose donc que quatre, et `location-facet.ts` explique pourquoi
  à l'endroit exact où la tentation serait d'en ajouter ;
- **le manuel l'écrit noir sur blanc** (`docs/fr/manuel/07-assets.md`, § « La bibliothèque de votre
  compte ») : le transfert est à sens unique. Ouvrir cette moitié veut donc dire mettre à jour les
  deux manuels dans le même mouvement, sinon la doc redevient fausse dans l'autre sens.

> **Réglé par l'étape 3 de `feat/workflows`** (`scenario/job-store.ts`). Le diagnostic ci-dessous
> reste exact ; ce qui a été livré, et ce que la revue a corrigé en chemin, suit.

**Un job ne survivait pas à la fermeture de l'application.** `createJobManager` tenait tout dans une
`Map` en mémoire, et **rien n'appelait `jobs.list` au démarrage**. Une génération vidéo de dix
minutes, l'application fermée entre-temps : le job aboutit chez Scenario, l'asset existe dans la
bibliothèque du compte, et le studio ne le collectait **jamais** dans le projet — `collect` n'est
appelé que par la boucle qui a soumis. Ce n'était pas une reprise d'affichage : c'était du travail
payé et perdu. **Prérequis dur de l'entraînement** (§ 4.8), qui dure des heures.

**Ce qui est livré.** Les jobs inachevés sont écrits en JSON dans `app.getPath('userData')`,
atomiquement (copie de transit puis `rename`), et repris **à l'ouverture du projet auquel ils
appartiennent** — pas au démarrage : le collecteur écrit dans le catalogue du projet ouvert, et il
n'y en a aucun avant. La note porte le compte, le projet, l'id distant et de quoi redessiner la
ligne dans la barre de jobs ; ni le statut ni la progression, qui sont ce que l'API répondra au
prochain poll et dont une copie périmée serait une seconde vérité.

Six choses à savoir, dont quatre sont des défauts que la revue a trouvés dans la première version :

- **une note ne part que si l'API a conclu.** C'est la règle centrale, et la première version
  l'avait à l'envers : `settle` oubliait le job sur *tout* statut terminal, donc une coupure Wi-Fi
  de quinze secondes au-delà du budget de réessai effaçait la note d'une génération vivante et
  déjà payée — exactement la perte que le mécanisme existe pour empêcher. Un échec **local**
  (réseau, clé indisponible, disque qui refuse) garde la note ; seuls un refus de l'API, une
  annulation qu'elle a prise et une collecte réussie l'effacent ;
- **la collecte est idempotente.** `collector.ts` frappait un id local neuf par sortie : une note
  qui survivait à un job déjà collecté réimportait tout, et refacturait le transfert. Il consulte
  désormais `localIdOf` sur la sortie elle-même, comme il le faisait déjà sur le parent ;
- **un job ne collecte que dans son propre projet.** Le collecteur écrit là où le projet est
  ouvert : plutôt que de classer une génération dans la mauvaise bibliothèque, le job s'efface de
  la session et sa note attend que son projet revienne ;
- **le compte est nommé par une empreinte de sa clé** (`accountFingerprint`), pas par l'id du
  carnet, qu'un retrait suivi d'un ré-ajout renouvelle — le job repris ne retrouverait plus son
  compte et serait perdu en silence. Même notion que celle qui nomme les fenêtres du limiteur ;
- **un fichier illisible n'est pas un fichier vide.** Une écriture reconstruit le fichier depuis ce
  qu'elle a lu : lire « rien » d'un fichier momentanément verrouillé aurait effacé les notes de
  tous les autres projets d'un coup. Absent rend `[]`, illisible **refuse l'écriture** ;
- **les notes se périment à sept jours**, et l'écriture est vidangée à la fermeture et au
  changement de projet, à côté du journal — sans quoi la dernière note d'une session, celle qui
  compte le plus, part avec le processus.

**Les index du catalogue n'ont pas été posés.** `catalog.ts` déclare des index simples
(`assets(type)`, `assets(created_at DESC)`, `asset_tags(tag)`, `assets(hash)`…). **Il manque l'index
composite `(type, created_at DESC)` et un FTS5** pour la recherche texte. Les deux requêtes coûteuses
de l'audit — `type = ?` à 15,17 ms et un `LIKE '%…%'` sans résultat à 22,53 ms — tombent dans le même
piège : parcourir toute la table pour remplir une page. **Le worker a déplacé ce coût, les index le
supprimeraient.**

**Une recherche engagée ne s'interrompt pas.** Six frappes produisent six recherches.
`catalog-client.ts` n'expose aucun abandon, et une requête `better-sqlite3` engagée ne s'interrompt
pas. Elles ne bloquent plus rien depuis le worker, mais elles occupent le thread — et l'invariant 6
demande que toute tâche longue soit annulable. À traiter **avec les index**, qui les rendront assez
brèves pour que la question se pose autrement.

**Le décodage du clone IPC** — 73 % du coût d'un ⌘S, intouché. Cf. § 3.3.

**Une commande asynchrone vole le geste en cours.** `document-store.ts` réécrit l'identifiant de
coalescence du document à **chaque** `runCommand` dès qu'un geste est ouvert, y compris pour une
commande venue d'ailleurs. Tant que toutes les écritures venaient de la main de l'utilisateur, elles
partageaient le geste et personne ne le voyait. L'espace Skyboxes a introduit le premier écrivain
**asynchrone** — une génération qui aboutit — et le rend atteignable : si un job se termine pendant
qu'un curseur est tenu, la suite du glissement cesse de fusionner et l'annulation se fragmente en
trois entrées au lieu d'une, dont la génération elle-même au milieu. Un ⌘Z fait alors disparaître
l'image au lieu de continuer à défaire le réglage. La ligne fautive est antérieure et sert les cinq
espaces : **la corriger touche l'historique de tous**, d'où son classement ici plutôt qu'un
rustinage local.

**Durabilité.** `documents.ts` renomme atomiquement, ce qui protège d'un crash **en cours
d'écriture**, mais ne fait pas de `fsync` : une coupure de courant peut perdre l'écriture. C'est écrit
dans son propre commentaire, et assumé.

**L'écriture atomique existe en deux exemplaires, et la preuve qu'elle devrait n'en faire qu'un est
déjà là.** `scenario/job-store.ts` et `project/documents.ts` écrivent tous deux une copie de transit
puis renomment, avec le **même commentaire mot pour mot**. La revue de cohérence de `feat/workflows`
a corrigé dans le premier un défaut que le second porte toujours : le `rm` de nettoyage n'était pas
protégé, si bien qu'un échec du ménage remplaçait l'erreur d'origine et masquait la vraie cause.
Corrigé dans `job-store.ts`, **pas** dans `documents.ts` (`store` et `storeFolder`) — hors périmètre
de cette branche. `isMissing` est dupliqué à l'identique entre les deux fichiers, commentaire
compris.

Un `writeAtomic` partagé — dans un `src/main/files.ts` — les réunirait, à condition de **garder le
nom de la copie en paramètre** : `documents.ts` en veut un unique par appel (`<fichier>.<uuid>.tmp`,
parce que plusieurs fenêtres écrivent et que le dossier appartient à l'utilisateur), `job-store.ts`
un nom fixe (`.staging`, parce que ses écritures sont sérialisées et qu'un nom unique laisserait un
orphelin par crash). Les **files** d'attente, elles, ne se factorisent pas : `documents.ts` en tient
une par fichier dans une `Map`, `job-store.ts` une seule pour un seul fichier.

**Le double dispatch des accélérateurs Electron n'a jamais été vérifié en conditions réelles.** macOS
consomme probablement la frappe avant le renderer, Windows/Linux non. Personne ne l'a mesuré sur les
trois plateformes.

**`src/main/menu/index.ts` n'a aucun test** — empreinte, débounce, cycle de vie par fenêtre.
`src/main/ipc/test-harness.ts` mocke déjà `ipcMain`, mais il faut l'étendre à
`app` / `BrowserWindow` / `Menu`.

**Aucun test ne s'exécute sur l'application lancée.** Les 250 fichiers de test sont unitaires :
`find src -name '*.e2e.*'` ne rend rien. Tout ce qui ne se prouve qu'en conditions réelles —
ouverture, parcours des six espaces, détachement d'un panneau, fermeture propre, consoles main et
renderer sans erreur — est vérifié à la main, à chaque fois, par qui livre. C'est le poste de
vérification le plus cher du projet et le seul qu'aucune porte ne tient.

En ajouter demande **Playwright ou équivalent**, donc une dépendance : la décision revient au
propriétaire du dépôt. **Reporté le 8 août 2026, pas abandonné** — noté ici pour que la prochaine
session le retrouve. Suivi sous `L7` dans `.claude/loop/BACKLOG.md`.

---

# 4. Le node editor et les workflows Scenario

> **Le chantier a son plan**, écrit pour être exécuté sans supervision, dix étapes :
> [`docs/plans/2026-08-08-workflows-node-editor.md`](plans/2026-08-08-workflows-node-editor.md).
> Branche `feat/workflows`, worktree `.claude/worktrees/workflows`, base `develop`. Les deux dettes
> d'API du § 3.6 y sont les étapes 2 et 3, parce qu'elles le bloquent.

**Rien n'existe.** `grep -rl "workflow" src/` ne rend aucun fichier, et aucune note de reprise
antérieure ne mentionne le sujet — ni comme manque, ni comme report, ni comme arbitrage. C'est le
plus gros trou fonctionnel du projet, et le seul chantier qui le ferait passer de « une interface
devant une API » à « un outil ». D'où une section à lui, hors du § 3 : celui-là liste ce qui reste
d'un chantier commencé, celui-ci ouvre un chantier qui ne l'est pas.

## 4.1 Ce que l'API offre, vérifié dans la copie locale

Huit endpoints, tous dans `docs/scenario-api/reference/` : `workflows.create`, `.update`, `.run`,
`.list`, `.retrieve`, `.delete`, `.get_tags`, `.user_approval`. Le guide de référence est
`guides/get-started/documentation/workflows-and-apps.md`, 1296 lignes — **à lire avant le web**.

| Terme | Ce que c'est |
|---|---|
| **Workflow** | `inputs` + `flow` (le graphe exécutable) + `editorInfo` (l'état visuel) |
| **Flow** | tableau de nodes : le format d'**exécution** |
| **editorInfo** | `nodes` + `edges` + `inputKeys` : le format d'**édition** |
| **App** | un workflow `privacy: public`, découvrable et exécutable par tout le monde |
| **status** | `draft` (non exécutable) · `ready` · `deleted` (suppression douce) |

**Trois limites à porter dans le domaine dès le premier jour** : 50 nodes par workflow, 10 jobs de
workflow concurrents, 100 requêtes par minute. Les deux dernières sont la dette du § 3.6 ; la
première appartient à l'export et doit **échouer proprement**, pas silencieusement.

## 4.2 Ce que le SDK donne gratuitement — vérifié dans `node_modules`, pas supposé

`@scenario-labs/sdk` **v2.7.0**, celui qui est installé. Ces exports existent :

`convertWorkflowEditorToFlow` · `validateWorkflowFlow` · `validateEditorInfo` ·
`WorkflowImportError` · `VALID_EDITOR_NODE_TYPES` · `WorkflowEntity` · `EnhancedWorkflows`

**Scenario a publié le compilateur de son propre éditeur visuel.** Le format `editorInfo` est celui
de React Flow au champ près — `source`, `target`, `sourceHandle`, `targetHandle` sur une arête,
`{ id, type, data }` sur un nœud. Adopter ce format comme format natif du node editor rend gratuits :
la compilation vers le flow, la validation, l'import/export, et l'aller-retour avec la webapp.
**Ne pas écrire de compilateur.**

L'évaluateur **CEL** vit dans `@scenario-labs/sdk/tools/cel` (`createCelEnvironment`, `evaluateCel`).
Il repose sur `@marcbachmann/cel-js`, qui est une **dépendance du SDK, déjà présente dans le store
pnpm** — donc l'évaluation locale d'un node `transform`, et son aperçu en direct pendant la frappe,
**ne coûtent aucune dépendance nouvelle**. Le seul paquet à ajouter serait le canvas lui-même
(`@xyflow/react`), et **ça demande la validation de l'utilisateur** (interdit du § 3.2).

## 4.3 Les deux vocabulaires de nodes, et le compte exact

Ce sont **deux graphes différents**, et c'est le piège structurant du sujet.

**Nodes d'exécution — 10**, union littérale de `resources/workflows.d.ts` :
`custom-model` · `model` · `workflow` · `remove-background` · `generate-prompt` · `logic` ·
`transform` · `for-each` · `list` · `user-approval`

**Nodes d'éditeur — 15**, `WorkflowEditorNodeType` :
`text` · `asset` · `aspectRatio` · `model` · `modelInput` · `llm` · `transformText` · `splitText` ·
`ifElse` · `groupItems` · `sliceAssets` · `forEach` · `forEachEnd` · `stickyNote` · `approval`

> **Le tableau du guide n'en liste que 7 et il est incomplet** — il ignore `model`, `for-each` et
> `list`. C'est le **type du SDK qui fait foi**, pas la page de doc. Et un rapport tiers qui annonce
> 14 types d'éditeur a été écrit avant `modelInput`.

`stickyNote` n'existe pas à l'exécution. La paire visuelle `forEach` / `forEachEnd` se compile en un
seul node `for-each` portant `loopBodyNodeIds`. Un mapping 1:1 entre les deux vocabulaires n'existe
pas et ne doit pas être cherché.

## 4.4 La convention d'arête est INVERSÉE, et c'est le piège qui coûterait le plus cher

Si l'éditeur est câblé dans le sens intuitif, `convertWorkflowEditorToFlow` produit un graphe
retourné et **tout export vers Scenario est faux** — sans erreur, sans avertissement. À lire avant
d'écrire la première arête.

**Ce n'est pas une déduction.** Le code du SDK porte la règle en commentaire, dans
`node_modules/@scenario-labs/sdk/lib/workflow_converter.js`, autour de la ligne 588 :

    // edge convention: `{ source: consumer, target: provider }` — an input handle
    // on `source` reads an output handle on `target`.
    const providersOf = id => edges.filter(e => e.source === id).map(e => e.target)
    const consumersOf = id => edges.filter(e => e.target === id).map(e => e.source)

Et l'implémentation s'y tient partout : c'est **`targetNode.data.outputHandles`** qui est cherché
par `edge.targetHandle` (l. 240, 258, 285, 294, 367).

| | Côté écran | Champ React Flow | Ce que c'est |
|---|---|---|---|
| **Sortie** d'un node (le producteur) | droite | `target` / `targetHandle` | `outputHandles` |
| **Entrée** d'un node (le consommateur) | gauche | `source` / `sourceHandle` | les inputs du modèle |

La donnée va de gauche à droite à l'écran ; **l'objet arête pointe de droite à gauche.** L'attribut
d'accessibilité que la webapp rend le dit tel quel : *edge from imageGenerator1 to text1*, pour une
arête qui alimente `imageGenerator1` depuis `text1`.

**Les conventions de nommage, à copier telles quelles** — le convertisseur les lit :

| Quoi | Forme | Vérification |
|---|---|---|
| handle | `` `${nodeId}-${'source'\|'target'}-${fieldName}` `` | `workflow_converter.js:326` teste littéralement `` `${nodeId}-source-items` `` |
| sorties d'un `forEach` | `` `${nodeId}-output-${n}` `` | `:254`, expression régulière `/-output-(\d+)$/` |
| nom de sortie par défaut | `output` | `:320`, `?? 'output'` |
| id de node | `` `${typeCamelCase}${index}` `` | `text1`, `imageGenerator1` — observé dans la webapp |
| id d'arête | `` `${handleDeSortie}--TO--${handleDEntrée}` `` | observé dans la webapp ; le convertisseur ne lit pas les ids d'arête, c'est donc du confort de lecture — mais autant être compatible |

**Le canvas de Scenario est bien `@xyflow/react` v12, et ce n'est plus une hypothèse.** Le DOM de
`app.scenario.com/workflows/[id]` porte `react-flow__viewport xyflow__viewport`,
`data-testid="rf__wrapper"`, `rf__node-*`, `rf__edge-*`, `react-flow__aria-live-*` et
`react-flow__viewport-portal`. Les composants employés : `<ReactFlow>`,
`<Background variant="dots" gap={20} size={0.5} />`, `<NodeResizeControl>` (poignée bas-droite),
`<Handle>`, `<EdgeLabelRenderer>`, `<ViewportPortal>`, arête bézier par défaut stylée en CSS
(`stroke-width: 3; stroke-dasharray: 8`). **Ni `<Controls>` ni `<MiniMap>`** : leur barre d'outils
est flottante et maison — ce qui tombe bien, le studio a la sienne (`design/Toolbar.tsx`).

**Deux types de l'éditeur à ne pas réinventer**, tous deux exportés :
`WorkflowEditorHandleInput` porte `type?: string | string[]` — un tableau signifie un port
**polymorphe**, et c'est la matière de `isValidConnection` et du code couleur des ports — plus
`subHandles` pour les sous-ports. `WorkflowEditorConditionBlock` est
`{ conditions: { field?, operator, value? }[], logic: 'and' | 'or' }` : l'UI d'un `ifElse` est un
**query builder** de groupes ET/OU, et le format existe déjà.

## 4.5 Quatre pièges trouvés en lisant, avant d'avoir écrit une ligne

> **Les deux premiers reposaient sur la prose du guide, et le SDK la contredit — vérifié le
> 8 août 2026, avant d'écrire l'étape 1.** `node_modules/@scenario-labs/sdk/resources/workflows.d.ts`,
> l. 4079-4091, décrit la réponse de `workflows.run` : `status` y prend **les huit valeurs de la
> génération** (`canceled | failure | finalizing | in-progress | pending | queued | success |
> warming-up`), sans `succeeded` ni `failed`, et `progress` y porte le commentaire *« Progress of
> the job (between 0 and 1) »*. `jobs.retrieve` — le seul endpoint que le `JobManager` interroge —
> dit exactement la même chose (`resources/jobs.d.ts`, l. 39-51), et le filtre de statut du serveur
> MCP officiel n'admet lui aussi que ces huit valeurs. Le guide en prose est donc **la seule des
> trois sources** à annoncer `succeeded`/`failed` et une progression en 0–100.
>
> Aucun job de workflow n'existe dans l'historique du compte pour trancher à l'observation
> (`jobs_list` filtré sur `type: workflow` rend une liste vide). L'étape 1 a donc livré les deux
> corrections **comme des assurances, pas comme des correctifs** : elles ne coûtent rien si le SDK
> dit vrai, et elles évitent la panne si c'est le guide.

**1. Un job de workflow pollerait pour toujours** — si le guide dit vrai. La table `STATUS` du
`JobManager` connaissait `success`, `failure`, `canceled`, les valeurs de l'API de génération. Un
statut inconnu est traité comme `running`, **délibérément et à raison** : c'est ce qui protège d'un
statut que Scenario ajouterait. Conséquence : `succeeded` et `failed` n'auraient jamais été
reconnus, `isFinished` jamais vrai, la boucle ne se serait pas arrêtée et le job serait resté au
compteur de concurrence jusqu'à la fermeture. **Deux lignes dans `STATUS` et un test** — livrées à
l'étape 1. Aucune collision : aucune des deux graphies n'a d'autre sens dans le vocabulaire de la
génération, la table unique est donc sans perte.

**2. La progression serait affichée à 10000 %** — même condition. `advance` recopiait
`remote.progress` tel quel. Normaliser **à l'entrée** — `p > 2 ? p / 100 : p`, puis borner à
`[0, 1]` — et non à l'affichage : la valeur est stockée dans `Job.progress`, et `JobsStatus` la
**somme** sur tous les jobs en cours, ce qu'un clamp d'affichage ne rattraperait pas. Livré à
l'étape 1.

**Le seuil est 2, et pas 1** — la première version divisait dès 1 et `/code-review` l'a rattrapée.
Une génération dépasse sa propre échelle : `design/ProgressBar.tsx` est borné parce qu'un job
rapporte 1.02, si bien que diviser dès 1 faisait retomber la fin de chaque génération à **1 %** —
une régression sur le chemin vivant, introduite pour un vocabulaire que personne n'a observé.
Au-dessus de 2, aucune fraction ne peut vivre. L'heuristique reste inerte si le SDK dit vrai.

**3. Les sorties d'un workflow ne sont pas là où le manager les cherche.** `RemoteJob` ne lit que
`metadata.assetIds`. Un job de workflow rend `metadata.flow[]`, **une entrée par node avec son
`status` et ses `assets[{ assetId, url }]`**. Bonne nouvelle : `collector.ts` n'a besoin d'aucun
changement — il prend une liste d'ids distants. Ce qu'il faut est aplatir `flow[]` vers cette liste.
Et `metadata.flow` est aussi ce qui rend le **retour visuel par node gratuit** : un seul poll met à
jour l'état de tout le graphe, halo et vignette compris.

**4. Une seule voie de publication est documentée.** `create` et `update` laissent le workflow en
`draft`, donc non exécutable. Un endpoint de publication côté serveur qui compilerait `editorInfo`
existe peut-être — **il n'est dans aucune des 209 pages locales**. La compilation **locale** est donc
le seul chemin documenté : `convertWorkflowEditorToFlow`, puis `validateWorkflowFlow`, puis
`update({ flow, status: 'ready' })`. C'est aussi le meilleur, parce que la validation devient un
retour instantané dans l'éditeur au lieu d'un 400.

Deux détails à ne pas redécouvrir : `"workflow"` est **réservé** dans `ref.node` — il désigne les
inputs du workflow parent, donc **ne jamais nommer un node `workflow`** ; et
`convertWorkflowEditorToFlow` rend `type: string` là où l'API attend une union littérale, ce qui
impose l'un des rares `as` justifiés du dépôt, avec son commentaire d'une ligne.

## 4.6 La décision d'architecture : où le graphe s'exécute

C'est **la** question du chantier, et elle n'est pas tranchée.

| | **A — déléguer à Scenario** | **B — exécuteur local** |
|---|---|---|
| Comment | `workflows.run` → un job → `metadata.flow` | tri topologique local, un `runModel` par node |
| Progression par node | fournie | à écrire |
| Nodes non-Scenario (ffmpeg, noyau GPU, fichier local, export moteur) | **impossible** | possible |
| 50 nodes / 10 jobs concurrents | subis | contournés |
| Re-run partiel par cache de hash | **impossible** | possible |
| Publication en App, partage | natif | impossible |

**La recommandation est B comme moteur, A comme export**, et la raison est le cache : changer le
prompt du dernier node ne doit relancer que ce node. C'est ce qui rend un node editor supportable, et
c'est exactement ce que déléguer interdit. Mais B est une semaine de plus, et A seul serait déjà un
produit. **À arbitrer avec l'utilisateur avant d'ouvrir la branche.**

Un point qui penche : les nodes que Scenario n'a pas sont ceux qui donneraient sa valeur au studio —
`localFile`, `ffmpegConcat`, un aperçu PBR sur le noyau GPU existant, un export Unity ou Godot. Ils
n'existent que sous B.

## 4.7 Ce que le chantier apporterait par ricochet, et qui manque aujourd'hui

Trois choses tombent dans l'escarcelle en même temps, et deux d'entre elles valent d'être faites
**avant** le node editor parce qu'elles servent seules.

**`dryRun`, à faire d'abord et séparément.** Documenté sur `generate.run_model` (`reference/…:21`),
sur `workflows.run` et sur `models.train.trigger` : aucun job créé, aucun crédit débité, un coût
estimé rendu. `grep -rn dryRun src/` → **zéro**. Aujourd'hui le bouton Générer ne dit pas ce qu'il
va coûter, et rien ne dit le solde : `usages.list` (unités consommées, par modèle, par période) et
`pricing.oscu.retrievePrices` ne sont appelés nulle part. Un badge « ~12 CU » sur chaque bouton et la
consommation du mois dans Réglages > Compte : aucune dépendance, deux canaux, et c'est la première
chose qu'on remarque. **Prérequis du node editor** — un graphe sans coût par node est un graphe qu'on
n'ose pas lancer.

**Les Apps sont une bibliothèque de modèles de workflows, gratuite.** `workflows.list` avec
`privacy: public` rend des workflows exécutables tels quels, filtrables par tag. Ça donne le
« ready-made » de la webapp sans écrire un seul graphe, et ça donne surtout des **exemples réels de
`editorInfo`** pour vérifier le rendu du canvas contre des données que Scenario a produites.

**`user-approval` ouvre une phase que le `JobManager` n'a pas.** Un job de workflow peut se
suspendre en attendant l'utilisateur ; `workflows.userApproval` le débloque. `JobStatus` n'a rien
entre `running` et fini. C'est une valeur de plus dans le domaine, et une ligne dans la barre de
jobs — mais elle change `isFinished`, donc elle se traite avec les deux corrections du § 4.5.

**Les modèles utilitaires de Scenario sont la matière première d'un graphe, et le studio n'en
appelle aucun.** `grep -rn "model_sc\|model_scenario" src/` ne rend qu'un commentaire de test. Ce
sont des **opérations déterministes exposées comme des modèles**, donc chaînables dans un flow et
atteignables par le `runModel` déjà écrit — sans une ligne de code spécifique, puisque leur
formulaire se construit tout seul (invariant 5).

| Famille | Modèles | Ce qu'ils donnent au studio |
|---|---|---|
| Géométrie | `scenario-compose-image`, `-image-slicer`, `-grid-maker`, `-resize-image`, `-padding-remover`, `-convert-to-mask-image` | les nodes de composition et de découpe d'un graphe |
| **Calques** | `scenario-image-layers-extractor` | `separationInstruction` en langage naturel, `maxLayers` 1–10 : **un clic « décomposer en calques » → une pile éditable** dans un espace Image qui a déjà l'arbre de calques |
| ControlNet | `scenario-detection`, param `modality` | `canny` `depth` `grayscale` `lineart_anime` `mlsd` `normal` `pose` `scribble` `segmentation` `sketch` — un node « Detect » à un menu, et `depth`/`normal` alimentent le noyau GPU existant |
| Étalonnage | 18 × `scenario-postprocessing-*` | `lut` (~180 presets film), `grain` (22 profils), `color-correction`, `sharpen`, `glow`, `vignette`… |

Deux réserves à porter dans le plan. Ce sont des **appels réseau facturés** : pour un aperçu
interactif, le noyau GPU du studio refait la passe en shader et Scenario n'est appelé qu'au rendu
final — le mapping paramètre → uniform est direct, les noms et les bornes venant du schéma. Et
`scenario-smart-reframe` en `textDensity: DENSE` + `thinkingLevel: HIGH` est **nettement plus
coûteux** : ces deux champs veulent un avertissement et un `dryRun` affiché.

## 4.8 Ce qui reste hors périmètre, et pourquoi c'est écrit ici

Pour qu'une prochaine session ne reparte pas chercher.

- **Train et Compose n'existent pas** (`models.train.trigger`, `models.training_images.*`,
  `models.create` en `flux.1-composition` avec ses `concepts[]` à `scale`). Tout est documenté en
  local, rien n'est écrit. Un entraînement dure des **heures** : c'est la persistance des jobs du
  § 3.6 qui en est le vrai prérequis, pas l'inverse. Écarté pour l'instant, pas oublié.
- **Le mode « Live » de la webapp n'a AUCUN endpoint dans les 209 pages locales** — ni streaming, ni
  WebSocket, ni rien. Ce n'est pas un manque du studio, c'est une fonctionnalité que l'API n'expose
  pas. À défaut, un `runModel` débouncé sur un modèle rapide avec annulation du job précédent en
  serait l'imitation honnête. **Ne pas la chercher à nouveau dans la doc : elle n'y est pas.**
- **Le serveur MCP de Scenario est en BETA** et n'a pas à devenir une dépendance produit.
  `recommend` et `plan_generation` seraient un bonus ; le panneau Modèles à facettes mesurées du § 1
  est la réponse déterministe au même besoin, et elle est déjà livrée.

---

# 5. Méthode — ce qui a marché

**Les revues qui exécutent le code trouvent beaucoup plus que celles qui le lisent.** Trois points de
comparaison, tous sur le mode Image :

| Quand | Comment | Trouvé |
|---|---|---|
| Jalon 0 | huit agents qui ont **lu** le code | 3 défauts |
| Jalon 2 | trois agents à qui il était demandé d'écrire des sondes vitest et de **reproduire** chaque défaut | **12 défauts**, dont une régression critique introduite par la passe de simplification elle-même — un garde ajouté dans `apply` neutralisait le replay de `mount`, et un document s'ouvrait sans aucune texture |
| Jalon 3 | un agent muni d'une **sonde instrumentée** | le nouveau chemin du déplacement de calque payait cinquante réordonnancements par frame — aucune lecture ne l'avait vu |

Quand une revue est déléguée, demander explicitement : de **reproduire empiriquement** chaque défaut
avant de l'affirmer, de rendre **la sortie de la sonde qui le prouve**, de séparer les défauts
confirmés des suspicions non reproduites, et de **nettoyer derrière soi** — le répertoire de travail
est le scratchpad indiqué en tête de session, jamais `src/`, jamais `/tmp`.

**Vérifier à l'écran ce qui se voit.** Le MCP `electron` fonctionne après `pnpm start:debug`. Règles,
repères, zoom, compositing, pointillés, viewport éclairé : **un jalon visuel validé uniquement par des
tests unitaires n'est validé qu'à moitié**. L'espace Textures en porte la trace — un viewport noir
venait de l'environnement studio manquant, ce qu'aucun test n'aurait dit. Attention, **le port 9222
est unique** : si une autre session a déjà lancé l'application, c'est son instance qu'on pilote.

**Deux réflexes qui ont payé.** Les tests existants attrapent les régressions de portée : deux d'entre
eux ont révélé qu'un bouton d'annulation agissait sur le mauvais document. Et **un commentaire qui
décrit un comportement disparu est un défaut à part entière** — quand on change un comportement, on
relit les commentaires autour.

**Rebaser souvent.** Plusieurs sessions travaillent en parallèle dans `.claude/worktrees/`. Les
conflits grossissent vite et deviennent des collisions de conception : **deux sessions ont déjà réécrit
le panneau des calques et le registre de commandes en même temps**. Corollaire pratique : préfixer
chaque commande par le chemin absolu de son worktree — le shell retombe ailleurs entre deux appels, et
un build lancé au mauvais endroit écrase le `out/` du voisin.

**Une fusion sans conflit n'est pas une fusion sans contradiction.** La fusion de `feat/image` en a
fait la démonstration : un autre travail avait documenté, dans huit chapitres du manuel, que
« l'espace Image ne sait pas ouvrir une image existante » — au moment précis où cette branche
l'implémentait. Les deux textes touchaient des lignes différentes, donc **git les a mêlés
proprement, sans rien signaler**, et le manuel décrivait deux logiciels à la fois.

La règle qui en sort : **après toute fusion touchant à la fois du code et de la documentation,
relire ce que la doc affirme sur ce que le code vient de changer** — un grep sur les tournures de
manque (« ne sait pas », « pas encore », « rien du tout », « aucun bouton ») trouve en trente
secondes ce qu'aucun outil de fusion ne verra jamais. Et vérifier chaque affirmation dans le code
plutôt qu'au jugé : sur les quatre limites suspectes de ce lot, **trois étaient tombées, une
tenait encore** — le recadrage, toujours dans `UNBUILT_TOOLS`. Supprimer la quatrième aurait fait
mentir la doc dans l'autre sens.

---

# 6. Performance — les mesures acquises

**Trois audits, tous menés le 7 août 2026** sur Apple M2 Max / macOS 26.5.2, en **build de
production**. **Ne pas refaire ces mesures.**

## Les six chiffres à ne pas redécouvrir

1. **8,33 ms** — le budget par frame du renderer sur un écran 120 Hz. C'est le chiffre qui compte, pas
   les 16,7 ms d'un écran 60 Hz.
2. **16 ms** — au-delà, une opération synchrone dans le **main** gèle TOUTES les fenêtres, y compris
   les détachées.
3. **React ne pèse rien en production** (0,15 ms/frame, 4,5 % du CPU occupé) et **huit fois plus en
   dev**. Mesurer en dev, c'est mesurer `jsxDEV` et `validateProperty`, qui n'existent pas en
   production.
4. **Le navigateur coalesce déjà les `pointermove`** : 600 événements injectés en 44 ms, 7 reçus. Il
   n'arrive jamais plus d'un `pointermove` par frame — il n'y a rien à coalescer dans un rAF.
5. **Le catalogue franchit les 16 ms vers 100 000 assets** et atteint 44 ms à 200 000.
6. **⌘S gèle toutes les fenêtres au-delà de ~5 500 nœuds.** Inatteignable au menu Ajouter, atteignable
   au premier import glTF.

**Une optimisation non mesurée est une complexité gratuite.** L'audit 3D est le cas d'école : cinq
pistes de revue, cinq réfutées par la mesure, **zéro ligne changée**.

## Audit 1 — le chemin chaud de l'inspecteur 3D : ce n'en est pas un

Scène au pire cas légal : sphère 128 × 128 (~16 000 sommets), cinq panneaux ouverts, 300 frames de
glissement par scénario.

| Scénario | CPU occupé / frame | % du budget 8,33 ms | Frames > 16,7 ms |
|---|---|---|---|
| Position X, 1 maille | 1,85 ms | 22 % | **0 / 299** |
| Segments 68↔128 | 2,18 ms | 26 % | **0 / 299** |
| Rayon, 1 maille | **3,31 ms** | 40 % | **0 / 299** |
| Rayon, 50 mailles | 3,81 ms | 46 % | **0 / 299** |
| Rayon, 1 maille, **dev** | 6,57 ms | 79 % | 0 / 299 |

Répartition (rayon, 1 maille, production) : reconstruction de géométrie **1,08 ms/frame, 33 % du CPU
occupé** ; `(program)` natif 0,81 ms ; `ViewHelper.render` (le trièdre, à chaque frame) 0,14 ms ;
**React 0,15 ms, 4,5 %** ; i18next 0,05 ms.

**Les cinq pistes de revue, réfutées une à une :**

- *« La géométrie se reconstruit dans l'événement, pas dans la frame »* — il n'y a rien à coalescer :
  299 frames, 299 émissions d'état, 299 reconstructions. Rapport 1,00.
- *« Rien n'est mémoïsé dans le panneau »* — mémoïser tout l'inspecteur ne peut pas rapporter plus que
  les 0,15 ms que React coûte en tout.
- *« La pile d'historique est recopiée par frame »* — `runCoalescing` coûte **0,0005 ms**. Copier 100
  références est un `memcpy` de 800 octets, six millièmes de pour cent du budget.
- *« Tout l'espace 3D se re-rend »* — l'amplification est réelle mais bornée par la précédente : passer
  de 1 à 50 mailles coûte +0,010 ms par maille. Il faudrait ~500 mailles pour saturer le budget.
- *« `TextureField` fait un `find` linéaire »* — cinq emplacements sur 2 000 assets en pire cas :
  0,0167 ms, 0,2 % du budget.

**Reproduire :**

```bash
pnpm exec electron-vite build
pnpm exec electron . --remote-debugging-port=9334 \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling
```

Renderer sur `localhost:9334`, onglet Performance. Cinq panneaux ouverts, une sphère, ses deux comptes
de segments à 128, puis glisser le champ visé sur la largeur du panneau. Sans les drapeaux, Chrome
suspend le `requestAnimationFrame` d'une fenêtre occultée et il n'y a plus rien à mesurer.

## Audit 2 — le catalogue quitte le thread principal

Coût d'une requête, driver de production `better-sqlite3` :

| Assets | par type | texte sans résultat | deux tags | première page | par id |
|---|---|---|---|---|---|
| 1 000 | 0,15 ms | 0,44 ms | 0,12 ms | 0,14 ms | 0,004 ms |
| 10 000 | 1,69 ms | 1,32 ms | 0,75 ms | 0,48 ms | 0,004 ms |
| **100 000** | **15,17 ms** | **22,53 ms** | 7,69 ms | 0,49 ms | 0,004 ms |
| **200 000** | **33,73 ms** | **43,82 ms** | **20,49 ms** | — | — |

Blocage mesuré dans l'application, 100 000 assets, seize recherches lourdes, sonde IPC continue :

| | AVANT (dans le main) | APRÈS (sur son thread) |
|---|---|---|
| Sondes | 16 687 | 32 297 |
| Pic maximal | **22,1 ms** | **8,4 ms** |
| **Sondes au-dessus de 16,7 ms** | **16** | **0** |

**Seize recherches lourdes, seize blocages** — un par requête, et le pic de 22,1 ms est très exactement
la requête mesurée à 22,53 ms au banc. Après : aucun blocage sur 32 297 sondes.

Le correctif est un seul changement : le catalogue s'exécute sur son propre `worker_threads`.
**`catalog.ts` n'a pas changé d'une ligne** — c'est ce que le port `SqliteDriver` rendait possible, à
une nuance près : échanger le driver ne pouvait pas suffire puisque toutes ses méthodes sont
synchrones, c'est le catalogue entier qui devait partir. Fichiers : `catalog-protocol.ts`,
`catalog-dispatch.ts`, `catalog-client.ts`, `catalog-thread.ts`, `catalog-worker.ts`,
`catalog-fixtures.ts`.

Trois décisions : **un thread, pas un pool** (SQLite n'accepte qu'un écrivain, les requêtes sont
courtes) ; **tout le catalogue part, pas seulement `search`** (une seconde connexion au même fichier
serait moins sûre, et `find` à 0,004 ms n'y perd qu'une latence de message) ; **le client rejette ce
qui est en vol si le thread meurt** (sans quoi un worker qui plante laisse l'interface attendre une
promesse que plus personne ne réglera).

**La recherche n'est pas devenue plus rapide — ce n'était pas l'objet.** C'est le même SQL, simplement
plus sur le thread qui dessine les fenêtres. Le prochain gain est dans les index (§ 3.6).

**Reproduire :**

```bash
pnpm exec electron-vite build
pnpm exec electron . --remote-debugging-port=9338 \
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding
```

Ouvrir un projet dont `.index/catalog.db` porte 100 000 lignes, puis, depuis la console du renderer,
marteler `window.studio.project.current()` en mesurant son aller-retour pendant que
`window.studio.assets.search({ type: 'video', limit: 200 })` tourne. Toute latence supérieure à 16,7 ms
sur la première est une frame perdue par toutes les fenêtres.

## Audit 3 — enregistrer et rouvrir un document 3D

Coût complet d'un ⌘S sur le thread principal — décoder le clone IPC, puis produire le texte. Un
`invoke` fait traverser un **objet**, pas un texte : `ipcMain` en décode le clone structuré sur le
thread principal avant d'appeler le handler, et l'ignorer sous-estime le coût réel.

| Nœuds | Total main | dont `JSON.stringify` | part du décodage | % du seuil de 16 ms |
|---|---|---|---|---|
| 50 | **0,130 ms** | 0,038 ms | 71 % | 1 % |
| 500 | 1,41 ms | 0,364 ms | 74 % | 9 % |
| 5 000 | 14,6 ms | 3,90 ms | 73 % | 91 % |
| 10 000 | 29,4 ms | 7,92 ms | 73 % | 184 % |
| 50 000 | 163 ms | 39,9 ms | 76 % | 1019 % |

Franchissement des 16 ms : **≈ 5 500 nœuds**.

`documents.ts` écrit sans indentation, et l'instinct était juste — l'indentation coûtait 1,7× (6,70 ms
contre 3,90 ms à 5 000 nœuds). Mais **c'est la plus petite moitié qui a été optimisée** : le décodage
pèse presque trois fois la sérialisation et n'est traité nulle part. Sans indentation le plafond passe
de ≈ 4 700 à ≈ 5 500 nœuds — pas d'ordre de grandeur.

Ouvrir : côté main, `JSON.parse` + encodage du clone, 0,127 ms à 50 nœuds, 14,0 ms à 5 000. Côté
renderer, la validation contre `property-fields.ts` est du travail sur le thread UI **une fois par
ouverture, pas par frame** — 0,020 ms à 50 nœuds, 19,5 ms à 50 000. Une correction d'une ligne y a
gagné 27 % : la liste des champs numériques d'un matériau était reconstruite
(`Object.entries(MATERIAL_SPECS).filter(…)`) **pour chaque nœud**, alors que la table est une constante
de module.

Le marqueur « modifié », lu par un sélecteur zustand **une fois par frame** pendant un glissement :
**0,00005 ms**, soit 0,0006 % d'une frame. Trois millièmes de pour cent de ce que React coûte déjà.

Corrigé sans mesure : **une double lecture au montage**. Le `StrictMode` de React 19 exécute deux fois
chaque effet, et `DocumentArea` est remonté à chaque changement d'espace — une ouverture valait deux
`JSON.parse` dans le main. `restoreDocument` retient la lecture en cours.

**Reproduire :** `pnpm bench`. Les trois fichiers sont versionnés — `src/main/project/documents.bench.ts`,
`src/renderer/src/engines/scene/scene-document.bench.ts`,
`src/renderer/src/stores/document-store.bench.ts`. Aux grandes tailles les mesures sont dominées par le
GC (`rme` jusqu'à 20 %) : la colonne à retenir est le **minimum**.

---

# 7. Les captures d'écran attendues

Le `README.md` racine et les deux guides utilisateur référencent des images qui n'existent pas encore.
Tant qu'un fichier manque, son emplacement reste visible dans le markdown sous forme de commentaire
HTML — rien ne casse.

| Fichier | Sujet |
|---|---|
| `docs/images/studio-3d.png` | Le studio dans l'espace 3D : rails aux deux bords, vue de scène au centre, arbre de scène et maillages à gauche, modèles à droite, étagère à assets en bas |
| `docs/images/studio-image.png` | L'espace Image : pile de calques, volet d'un groupe d'outils ouvert |
| `docs/images/settings-account.png` | La fenêtre de Réglages, section Compte, état authentifié visible |
| `docs/images/models-grid.png` | Le panneau Modèles en grille, facettes ouvertes |
| `docs/images/generate.png` | Le panneau Génération avec le formulaire d'un modèle, et la bande Jobs avec un job en cours |
| `docs/images/image-tools.png` | Un document image, volet du groupe Forme ouvert, pile de calques visible |
| `docs/images/scene-3d.png` | La vue 3D avec un maillage sélectionné, l'arbre de scène et le panneau Maillages |
| `docs/images/timeline.png` | L'espace Vidéo : timeline avec plusieurs clips, moniteur au-dessus |

**Conventions.** PNG, thème sombre, densité confort. **2560 × 1600** pour les vues plein écran,
recadrées au panneau pour les vues de détail. Fenêtre sans ombre portée du système — elle se voit mal
sur le fond clair de GitHub. **Un projet réel ouvert, avec de vrais assets** : une fenêtre vide ne
montre rien de ce que le logiciel sait faire. **Aucun identifiant, aucun jeton, aucun chemin personnel
lisible** ; la section Compte se capture avec des champs remplis mais masqués.

`pnpm start:debug` ouvre le port 9222, ce qui permet de piloter la fenêtre et de déclencher les
captures depuis l'extérieur plutôt qu'à la main.
