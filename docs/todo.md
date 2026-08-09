# Scenario Studio — ce qu'il reste à faire

**Le document de travail unique du projet.** Il remplace `docs/REPRISE.md` et `docs/INTERFACE.md`,
fusionnés ici le 9 août 2026 : ce qui était livré en est parti, ce qui reste ouvert y est entier, et
les savoirs qui coûteraient une seconde fois sont regroupés au § 12.

Deux fichiers se partagent le travail, et aucun ne redit ce qu'un autre porte :

| Fichier | Ce qu'il tient |
|---|---|
| **`CLAUDE.md`** (racine) | les conventions et les invariants : langue, worktrees, rebase, definition of done, style, architecture |
| **ce fichier** | ce qui reste à faire, et ce qu'il ne faut pas repayer — jamais le récit d'une correction, qui appartient au message de son commit |

> **La branche de référence est `develop`.** Elle intègre les features au fil de l'eau ; `main` ne
> reçoit que des merges de release. Ce document décrit **ce qui est sur `develop`**, donc en avance
> sur la dernière version publiée : un écart avec un binaire installé n'est pas une erreur du texte.

Pour *comprendre* le logiciel plutôt que reprendre son développement :
[guide de l'utilisateur](fr/guide-utilisateur.md) et [architecture](fr/architecture.md), également
[en anglais](en/).

## Comment ce fichier est ordonné

**Les sections descendent par gravité, et l'ordre est la recommandation.** Ce qui empêche de prouver
une livraison (§ 0), puis ce qui perd du travail sans le dire (§ 1), puis une décision de disposition
qui déplace des surfaces que tout le reste décrit (§ 2), puis ce qui bloque un geste (§ 3), ce qui
fait douter (§ 4), ce qui manque (§ 5 à § 7), et enfin ce qui coûtera plus tard (§ 8, § 9).

**Chaque entrée commence par le geste attendu, avant tout diagnostic.** Une phrase qui dit ce que
l'utilisateur doit pouvoir faire à l'écran — pas ce que le code fait, pas la cause, pas le remède. La
raison est un défaut réel : la dictée a quatre documents de conception et un ADR, et le geste qu'elle
devait servir — cliquer, parler, couper — **n'était écrit nulle part**. Une entrée sans son geste
décrit un mécanisme au lieu d'un besoin, et se livre « conforme » sans être utilisable.

**Ce qui se traite d'un bloc est écrit d'un bloc.** Plusieurs entrées partagent leur code, leurs clés
i18n ou leur test : les séparer ferait écrire deux fois la même chose. Chaque regroupement dit en une
phrase **pourquoi** il en est un — et un regroupement qui ne se justifie pas est un regroupement à
défaire.

> **Les numéros des entrées sont ceux du registre d'origine et ne se renumérotent pas** : des commits
> et des plans les citent. Une entrée dit **ce qui a été vu**, pas la solution — la cause se cherche
> au moment de la traiter, et une cause devinée à la volée est une cause fausse une fois sur deux.

---

## Le prompt de reprise

À coller tel quel dans une session neuve. **Le mettre à jour en même temps que ce fichier quand un
chantier est livré**, sinon il envoie la prochaine session refaire ce qui est fait.

> Je reprends le développement de **Scenario Studio**, dans `/Users/pasquelin/Applications/scenario`.
>
> Lis `docs/todo.md` en entier, puis `CLAUDE.md`. **Ne refais pas les mesures du § 12.4** : leurs
> conclusions sont acquises. Puis `git log --oneline -15`, `git worktree list` et `pnpm validate`
> pour partir d'une base verte.
>
> **Deux choses passent avant le reste** : le **§ 0** (la porte — mesurer le budget de couverture
> avant de croire une livraison verte) et l'**entrée 24 du § 2**, l'Explorateur et Apps en moitié
> basse de la colonne gauche, partout.
>
> **Pour la suite, propose-moi un ordre et attends ma réponse** avant d'ouvrir un worktree. Les
> candidats, sans priorité imposée : les **étapes 7 à 9 du node editor** — compiler, valider,
> exécuter (§ 6) · les retours d'accessibilité (§ 3) et d'affordance (§ 4) · les **manques par
> espace** (§ 5), dont deux qui ne se jugent qu'à l'écran : le fondu du pinceau et l'export des
> Textures.
>
> **Ce fichier est la seule liste qui reste.** `.claude/loop/BACKLOG.md`, qui portait le backlog
> qualité, **n'existe plus** — ne pas l'y chercher, et ne pas conclure d'un renvoi trouvé ailleurs
> qu'il est quelque part.
>
> Cinq règles qui ne sont pas dans `CLAUDE.md` :
>
> - **Pose les questions avant d'attaquer. N'invente jamais** : si un choix de conception se
>   présente, demande.
> - **Aucune dépendance nouvelle sans mon accord.** Les tests e2e (Playwright) sont reportés à la
>   fin du projet, c'est décidé.
> - **`git worktree list` avant d'ouvrir quoi que ce soit** : plusieurs sessions travaillent en
>   parallèle, ne prends pas un sujet déjà tenu.
> - **Mets la doc à jour** quand le code change ce qu'elle affirme — manuel fr *et* en, et ce
>   fichier. Un grep sur les tournures de manque (« ne sait pas », « pas encore », « aucun bouton »)
>   trouve en trente secondes ce qu'aucune fusion ne signalera.
> - **Ce fichier est une liste de ce qui reste, pas un journal.** N'y écris que ce qui coûterait une
>   seconde fois.

Si la demande touche l'API Scenario : `docs/scenario-api/README.md`, 209 pages aspirées en local,
**à consulter avant le web**. La conception validée est dans
`docs/specs/2026-08-06-scenario-studio-design.md`.

> `docs/specs/`, `docs/scenario-api/` et `docs/superpowers/` sont **ignorés par git**. Un document
> qui compte et qui atterrit dans l'un des trois est invisible du dépôt et absent de tout worktree
> neuf. **Ce qui doit survivre à la session vient ici, et est commité.**

---

# 0. La porte — rien n'est prouvable tant qu'elle n'est pas verte

Trois choses rendent aujourd'hui le filet du projet peu fiable : un budget qu'on croit tenu
sans l'avoir mesuré, une suite qui rougit ailleurs à chaque exécution, et trois branchements
que la couverture certifie alors que rien ne les tient. **Tant qu'elles tiennent, une livraison
verte ne prouve rien** — et c'est ce qui les met avant tout le reste, y compris avant ce qui
perd des données : sans porte, un correctif ne se prouve pas non plus.

## 0.1 Le budget de couverture de `renderer/src/stores/**` est annoncé dépassé

⚠️ Annoncé DÉPASSÉ depuis `bc9356a` (9 août, ~19 h), sur ses deux seuils (`statements: -90`,
`branches: -82`). **Rapporté par le message de `d73635c`, jamais mesuré** — et la distinction compte.
Aucun commit de `develop` n'a touché `vitest.config.ts` ni `renderer/src/stores/` depuis. **Premier
geste de la prochaine session : le mesurer**, avant de supposer la porte verte.

Les seuils sont des **budgets d'éléments non couverts** par glob (`vitest.config.ts`), pas des
pourcentages. **Couvrir avant d'élargir** ; le commentaire du fichier dit le seul cas où élargir est
légitime (un glob dont la marge de croissance est du GPU intestable).

| Glob | État connu | Marge |
|---|---|---|
| `engines/{scene,skybox,viewport,texture,gpu}/**` | 232 / 310 branches | 78 — ce qui reste dessous est du WebGL que jsdom n'exécute pas |
| `engines/{timeline,canvas,audio,core}/**` | 242 / 250 | **8 — c'est lui, le tendu** |
| `main/diagnostics/**`, `renderer/src/services/**` | **zéro** | le canal qui dit les échecs : une branche que personne n'exerce y serait un échec que personne ne lirait |
| `renderer/src/app/**`, `panels/**` | **aucun budget** | **trou ouvert** — c'est ce qui a laissé cinq fichiers neufs y atterrir sans qu'aucun seuil ne bouge |
| `src/main/project/**` | 113 / 115 statements · 60 / 60 branches | mesuré le 9 août au soir |

> **Les quatre premières lignes datent d'avant plusieurs fusions de moteurs et n'ont pas été
> remesurées.** Un chiffre de marge se relève par `pnpm test:coverage`, pas par lecture — et il ne se
> recopie pas d'un tour sur l'autre.

**Deux trous à combler** : `renderer/src/app/**` et `panels/**` n'ont **aucun budget**.

---

## 0.2 `develop` est rouge par intermittence, et jamais deux fois au même endroit

**Vu le 9 août 2026**, sur quatre exécutions de `pnpm validate` d'affilée. Un `validate` rouge qu'il
faut réexécuter pour croire est un filet qui ne tient plus.

**Le premier groupe est un dépassement de délai sous charge.** Le pire des trois est traité
(`55ddf63`, `ShortcutsSettings.test.tsx` de 26 s à 3 s). Restent :

| Fichier | Ce qui a été mesuré | Réponse retenue |
|---|---|---|
| `panels/channels/Channels.test.tsx` | lenteur diffuse, 487 ms au pire, 24 tests, aucun point chaud isolable | relever le délai |
| `known-keys.i18n.test.ts` | **3,6 s à importer** le graphe pour 0,5 s de tests | relever le délai |

**Le second groupe n'est pas un délai** — mesuré le 9 août à 17 h 25 sur `develop` fusionné :
`helpers/tool-registry.test.ts`, `app/document-io.test.ts`, `panels/models/model-filters.test.ts` et
`eager-graph.test.ts` répondent `Error: Unknown workspace: graph`. **Les quatre passent seuls**, et
`graph` est bien déclaré des deux côtés (`WORKSPACE_IDS`, les `ICONS` de `helpers/workspaces.ts`).
C'est un **ordre de chargement** : `WORKSPACES` est calculé à l'évaluation du module. Le suspect à
regarder en premier est `eager-graph.test.ts`, qui lit **741 sources** par `import.meta.glob`.

**Où ça bloque — 9 août, 18 h 10.** Le second groupe **ne se reproduit pas à la demande** : une
exécution complète du projet renderer (286 fichiers, 3431 tests) ne rend aucune occurrence. Ce qui
distingue les deux exécutions n'est pas le code mais **les conditions** : `validate` lance les
projets `node` et `renderer` en parallèle, et celui qui a échoué tournait sous quatre agents de revue.

**Sans reproduction, tout correctif serait une supposition.** Ce qu'il faudrait : faire échouer le
`validate` **volontairement**, en le relançant sous charge jusqu'à ce qu'il tombe, et capturer une
trace fraîche. Deux ou trois exécutions de dix minutes, machine libre.

> Une piste à ne pas perdre : la trace du 17 h 25 désignait `tool-registry.ts:97`, ligne qui est **un
> commentaire** dans le code d'une heure plus tard. Le fichier avait changé pendant que le `validate`
> tournait. **Une trace se lit avec le `git log` de son heure**, ou elle envoie chercher au mauvais
> endroit.

---

## 0.3 Trois trous que seule la mutation trouve

**Regroupée ici plutôt qu'avec l'espace 3D dont elle parle** : le sujet n'est pas la 3D, c'est
le filet. Les trois vivent dans des fichiers sans rapport et n'ont en commun que d'être verts
sous la porte.

### 35. Trois branchements que la couverture certifie et qu'aucun test ne tient

**Le geste attendu.** Casser une ligne de `frameSelection`, du builder BVH ou du quantificateur d'`isSprite` doit
faire rougir un test. Aujourd'hui les trois passent, et la porte est verte.

**Vu le 9 août 2026**, par relecture par mutation — la couverture était verte sur les trois.

- **`SceneRenderer.frameSelection` → `viewport.refit()`.** Vider entièrement le corps de
  `frameSelection` laissait **1786 tests verts** : la méthode sort tôt sans `orbit`, qui n'existe
  qu'après un `mount` exigeant WebGL. `framingPlacement`, `framingDistance` et `refit()` sont chacun
  mesurés ; les trois lignes qui les enchaînent ne le sont pas.
- **`bvh-builder.ts` — l'entrée que laisse dans `pending` une requête dont le `spawn` a été refusé.**
  Rien hors du module ne lit cette carte ; le `finally` qui la vide est une assurance, pas une
  mesure.
- **`scene-document.ts` — le quantificateur de `isSprite`.** `SPRITE_SPECS` moins la couleur ne
  laisse qu'`opacity`, et sur un singleton `every` et `some` sont indiscernables : remplacer l'un par
  l'autre ne fait rougir personne. Le test se réparera seul le jour où un second champ mesuré
  arrivera.

**Ce que la session a appris et qu'il ne faut pas réapprendre** : le budget de couverture ne voit pas
ce genre de trou — les lignes nues de `frameSelection` tenaient dans les 700 statements alloués au
glob. Seule la mutation les trouve. Et **une méthode qui sort tôt sur une dépendance que jsdom ne
peut pas fournir est un angle mort structurel** : la décision doit en sortir, ou elle n'est pas
mesurée.

---

# 1. Ce qui perd du travail en silence

Le mot qui compte est **silence** : dans les trois cas, ce qui disparaît ne laisse aucune trace,
et un utilisateur ne peut pas savoir qu'il a perdu quelque chose. Rien d'autre dans ce fichier
n'a cette propriété.

> **Deux fragments du même genre vivent ailleurs**, parce qu'ils appartiennent à un chantier qui
> les dépasse : le **document neuf jamais enregistré, perdu au rechargement** (§ 5.1) et
> l'**absence de `fsync`** (§ 7).

## 1.1 Les tables de specs — un champ ajouté fait disparaître le nœud

### 37. Un garde dérivé de sa table rend tout futur champ obligatoire, en silence

**Le geste attendu.** Ajouter un champ à une table de specs ne doit **jamais** faire disparaître un nœud des
documents déjà enregistrés.

**Vu le 9 août 2026**, sur `isSprite`, mais la dette est plus large.

`SpriteSpecs` est exhaustif sur `SpriteDescriptor` moins `map` : un champ ajouté est **forcé par le
typecheck** dans `SPRITE_SPECS`, donc dans `MEASURED_SPRITE`, et `matches(undefined, spec)` est
faux — le nœud disparaît à la relecture, sans trace, dans tous les documents déjà écrits. Un nœud
supprimé ressemble exactement à un nœud qui n'a jamais existé.

**`MEASURED_MATERIAL` et `TEXT_SPECS` dérivent depuis plus longtemps et portent le même piège.**

Le dépôt a déjà rencontré ça avec les drapeaux d'ombre et y a répondu par `isOptionalFlag` +
`withDefaults` (`scene-document.ts`). Soit on généralise ce mécanisme aux trois tables, soit on écrit
la règle noir sur blanc : **tout champ ajouté à une table de specs arrive avec son défaut**.

---

## 1.2 La couche projet — un seul chantier, trois entrées

**Elles se traitent d'un bloc, et le document le disait déjà** : c'est le même bouton qui ouvre
le sélecteur de l'entrée 16 et qui manque au panneau de l'entrée 15, et c'est le même manifeste
que la question des layouts touche. Les prendre séparément ferait écrire deux fois le chemin
d'échec.

### 15. Un panneau ne déclare pas ce dont il a besoin — l'Explorateur sans projet

**Le geste attendu.** Depuis l'Explorateur sans projet, ouvrir ou créer un projet **sans repasser par l'accueil**.

**Demandé le 9 août 2026.** Sans projet ouvert, pas d'Explorateur : un projet est le dossier qui tient
les documents et les assets.

**Le panneau connaît déjà la règle, il l'applique juste autrement.** `Explorer.tsx:36` fait
`if (!projectPath) return <EmptyState message={t('explorer.noProject')} />`.

**Et l'accueil tranche déjà dans ce sens.** `HOME_SECTIONS` donne à chaque bande un
`requires: ['project' | 'api']`, et `visibleHomeSections` l'écrit noir sur blanc : « a section whose
requirements are unmet is **dropped rather than drawn empty** ». **La même question a déjà reçu sa
réponse à trois mètres de là**, et les panneaux du dock font l'inverse.

**Ce qui manque est une notion, pas un `if`.** `ToolPlacement` (`shared/domain/tool.ts`) déclare `id`,
`zone`, `slot`, `workspaces` — **jamais de prérequis**. Ils sont **cinq** à lire `useProject` chacun de
son côté : `Explorer`, `Generator`, `AssetBrowser`, `AssetBrowserActions`, `Apps`. Porter `requires`
dans `TOOL_PLACEMENTS` réunit ces cinq réponses en une règle testable sans rien rendre.

**Tranché le 9 août 2026 : le panneau reste, on lui donne sa sortie.** Plutôt que le retirer, lui
mettre le bouton qui ouvre ou crée un projet — **aujourd'hui il faut retourner sur l'accueil**.

Ce choix évite le piège de l'autre : retirer un panneau touche le **layout persisté** — Dockview est
remonté par espace, et un panneau ajouté à l'API sortante est jeté par le `fromJSON` du suivant
(§ 5.1). Un panneau qui disparaît et revient avec le projet risquait de perdre sa place.

**Les deux gestes existent déjà** : `openPicked()` et `createPicked()` sont sur le store `useProject`,
et leurs quatre appelants sont tous sur l'accueil. **Et `EmptyState` porte déjà une action** —
`action?: { label, onClick }`, « the way out, for a panel whose emptiness the user can act on ». C'est
**une prop à remplir**, pas un composant à écrire.

**Un point à trancher, un seul.** `EmptyState` n'accepte **qu'une** action, délibérément : « every
panel offers its way out the same way, and a node would let each one grow its own button ». Or il en
faut deux — ouvrir, et créer :

- **une action secondaire dans `EmptyState`**, ajoutée une fois pour tous les panneaux — dans l'esprit
  du composant ;
- **une seule action, « Ouvrir un projet… »**, la création restant sur l'accueil — mais c'est
  précisément la moitié qui manquait.

La première est la bonne si la création doit être atteignable de là, et c'est ce qui a été demandé.

**Reste à décider quels panneaux déclarent quoi.** L'Explorateur, l'étagère à assets et l'inspecteur
exigent un projet, sans doute. Le **Générateur** est la vraie question : générer sans projet produit un
job qui ne se collecte nulle part — « un job ne collecte que dans son propre projet » (§ 12.3). Soit il
exige un projet, soit il faut dire ce que devient ce qu'il produit.

---

### 16. Ouvrir un projet ne dit rien quand ça rate, et le manifeste n'est pas défendu

**Le geste attendu.** Désigner un dossier qui n'est pas un projet doit afficher « Ce dossier n'est pas un projet
Scenario » — pas un `ENOENT` brut. Et un projet écrit par une version future doit être **refusé**,
pas aplati.

**Demandé le 9 août 2026**, à la suite de l'entrée 15 : c'est le même bouton qui va ouvrir ce
sélecteur. Le but énoncé — **un projet reste fiable même modifié de l'extérieur, et ce qui rate le dit
clairement**.

> Le § « couche projet » de l'ancien `REPRISE.md` donnait ces trois entrées (15, 16, 17) pour closes.
> **C'est faux pour 15 et 16** : seule l'entrée 17 est livrée (`f989b5e`, `feat/projet-dossier`).

**Ce qui tient déjà, et qu'il ne faut pas défaire.** Le listing des documents est solide : le dossier
fait foi sur l'extension, un document illisible ne coûte pas le listing des autres, un dossier absent
rend `[]` plutôt que d'échouer, et la lecture est séquentielle pour ne pas épuiser les descripteurs.
`open()` **répare** en repassant `ensureFolders`. Et le catalogue neuf est ouvert **avant** que
l'ancien soit lâché.

**Les quatre trous, du plus visible au plus sournois :**

| Ce qui arrive | Ce qui se passe aujourd'hui |
|---|---|
| On désigne un dossier qui n'est pas un projet | `readFile` échoue sur le manifeste, l'erreur remonte l'IPC telle quelle. Les appelants font `() => void openPicked()` : personne ne l'attrape. L'utilisateur lit un `ENOENT` au lieu de « Ce dossier n'est pas un projet Scenario » |
| Le manifeste est tronqué ou bricolé | Même chose : une `ZodError` brute, qui ne dit pas quel champ manque |
| Le projet vient d'une **version future** du studio | **Il s'ouvre**, et le studio écrit dedans avec son modèle à lui |
| Le projet est ouvert et refermé cent fois | `updatedAt` ne bouge jamais : il vaut `createdAt` à vie |

**Le troisième est le plus grave, et la règle qui manque est déjà écrite dix lignes plus bas.**
`documentEnvelope` plafonne sa version — `z.number().int().min(1).max(DOCUMENT_VERSION)` — avec ce
commentaire : « **Capped, not merely floored**: a file written by a later build must be refused rather
than read as if it were this one and silently flattened by the next save. » Le manifeste, dans le même
fichier, ne porte que `min(1)`. Un document aplati, c'est un fichier ; un projet aplati, c'est le
dossier entier.

**Le quatrième est un champ qui ment.** `updatedAt` est écrit une fois, à la création (`store.ts:98`),
et **aucune autre écriture du manifeste n'existe**. Deux réponses, il faut en choisir une : l'écrire à
chaque fermeture de projet, ou le retirer. Un champ qu'on affiche un jour en croyant qu'il dit quelque
chose est pire que pas de champ.

**Et le sélecteur ne filtre rien** : `pickPath('folder')` est un `openDirectory` générique. C'est
cohérent — le manifeste est la vérité, pas l'extension — mais ça met tout le poids sur le message
d'échec, qui est justement ce qui manque.

**Ce que ça demande :** un type d'erreur nommé plutôt qu'une exception brute (`NoProjectError` existe
déjà et donne le patron), ses clés dans les deux bundles i18n, la version du manifeste plafonnée comme
celle des documents, et une décision sur `updatedAt`. Deux des quatre points sont dans le main — c'est
un chantier, il se traite d'un bloc.

**Ce que ça touche** : `shared/domain/project.ts`, `main/project/store.ts`,
`main/project/validation.ts`, les deux bundles i18n.

---

### Où vivent les layouts — à trancher, et ce n'est pas un oubli

**Le geste attendu, et c'est la question même.** Ouvrir le même projet sur une autre machine et
y retrouver son arrangement de panneaux — ou l'assumer attaché à la machine. **Les deux se défendent ;
ce qui ne se défend pas est que la spec dise l'un et le code l'autre.**

**C'est une divergence.** La conception le prévoit — « `layouts/` : dispositions Dockview
sérialisées, par espace », § 5 de `docs/specs/2026-08-06-scenario-studio-design.md`. L'implémentation a
pris l'autre chemin : les arrangements vivent dans le `localStorage` du renderer
(`scenario-studio:layouts`), et le dossier est créé dans chaque projet sans que rien n'y écrive jamais
— c'est sa **seule occurrence dans tout `src/`**.

La question n'est pas « sert-il à quelque chose » mais **où doit vivre un arrangement** : dans le
projet, il voyage avec lui — on ouvre le projet sur une autre machine et on retrouve son écran, ce
qu'un studio fait tous les jours ; dans le `localStorage`, il suit la machine et pas le travail. La
spec a tranché pour le projet ; le code dit le contraire depuis le début. **Acter l'un des deux** :
ramener les layouts dans le dossier technique, ou assumer le `localStorage` et cesser de créer le
dossier.

> **Décision prise le 9 août** : ne plus créer `layouts/`. À vérifier dans le code — c'est la moitié
> qui n'a peut-être pas suivi.

---

## 1.3 L'écriture sur le disque

### 38. Les écritures de dossier de `documents.ts` gardent leur propre nettoyage

**Le geste attendu.** Quand l'enregistrement d'un document dossier échoue, lire l'erreur qui dit **pourquoi** — pas
celle du ménage qui a suivi.

**Vu le 9 août 2026**, en mutualisant l'écriture atomique de fichier.

`writeAtomic` (`persistence.ts`) sert maintenant les trois stores et `documents.ts` pour les
documents *fichier*. Les documents *dossier* — le manifeste et ses parties, trois `rename` autour de
`staged`/`stepped` — n'ont pas été touchés : ils ne se ramènent pas à `writeAtomic`, qui écrit un
fichier.

**À vérifier avant toute chose** : portent-ils le même défaut que celui qui vient d'être corrigé, un
`rm` de nettoyage non protégé qui lève par-dessus l'erreur que l'appelant avait besoin d'entendre ?
Si oui, c'est une ligne ; sinon, le noter pour clore la question.

**Et un piège de test à ne pas repayer** : un test de nettoyage ne mord que si les deux erreurs se
distinguent. Viser un chemin inexistant ne prouve rien — `rm` avec `force: true` n'y lève jamais. Il
faut un dossier non vide : `writeFile` répond « illegal operation on a directory », `rm` sans
`recursive` répond « rm returned EISDIR ».

---

# 2. La disposition — décidée, et prioritaire

Une seule entrée, et elle est ici parce qu'elle **déplace des surfaces que les autres entrées
décrivent** : la traiter après elles les ferait toutes mentir. C'est la seule chose de ce
fichier dont la position dans l'ordre vient de sa portée et non de sa gravité.

### 24. L'Explorateur et Apps passent au rail gauche, dans toute l'application

**Le geste attendu.** Trouver l'Explorateur et les Apps **à gauche, sous la génération**, dans les sept espaces comme
sur l'accueil.

**Décidé le 9 août 2026, et précisé le même jour : ils vont en MOITIÉ BASSE de la colonne gauche,
sous les deux panneaux de génération.** Pas un troisième et un quatrième onglet qui prennent leur
tour avec eux — une seconde moitié, sous l'IA, comme l'inspecteur occupe la moitié basse à droite.
**À prendre en premier des retours d'interface** : elle déplace des surfaces que les autres entrées
décrivent, et la traiter après elles les ferait toutes mentir.

| | Colonne gauche, après |
|---|---|
| **Moitié haute** (`left/primary`) | `models`, `generator` — la génération, inchangée |
| **Moitié basse** (`left/secondary`) | `explorer`, `apps` — qui prennent leur tour à deux |

**Une App produit des assets : c'est de la génération, donc la colonne de gauche.** Le code portait la
raison inverse, écrite noir sur blanc dans `TOOL_PLACEMENTS` — « an App is a pipeline of its own, not
a model the generator would fill a form for ». L'argument est recevable et il est écarté : ce que
l'utilisateur cherche à gauche, c'est **de quoi produire**.

**Ce que la droite garde**, une fois les deux partis :

| Espace | Colonne droite, après |
|---|---|
| Image | `layers` **seul** |
| Vidéo | `assets` **seul** |
| Audio | `assets` **seul** |
| Textures | `channels` seul — deux avec le panneau Styles |
| 3D | `scene`, `lights`, `meshes` |
| Skyboxes | `skybox`, `view` |

L'inspecteur ne bouge pas : `right/secondary`, en bas à droite dans les six espaces.

**Ce que la moitié basse règle, et que quatre onglets à la file auraient coûté** : quatre icônes
empilées dans un rail, c'est le moment où une colonne cesse d'être un endroit qu'on connaît pour
devenir une pile qu'on fouille. Deux moitiés de deux gardent la génération visible **pendant** qu'on
lit l'Explorateur, ce qu'un jeu d'onglets interdit par construction.

**Trois faits vérifiés dans le code le 9 août — ce chantier est plus petit qu'il n'en a l'air :**

- **Le domaine porte déjà la moitié.** `ToolSlot = 'primary' | 'secondary'`, et sa JSDoc dit
  « `primary` is the half nearest the window edge the zone hangs from — **the top of a side
  column** ». `left` + `secondary` **est** le bas de la colonne gauche. Rien à inventer.
- **Le shell compose les deux moitiés par zone, sans aucun cas particulier.** `Edge`
  (`app/Shell.tsx`) rend `primary`, la poignée de partage, puis `secondary` pour n'importe quelle
  zone, et `shownTool` (`helpers/tool-registry.ts`) interroge zone **et** slot génériquement.
  **Aucun changement de composition à écrire** — c'est la déclaration qui bouge, pas le rendu.
- **`canOffer` ne concerne que le générateur** (absent tant qu'aucun modèle n'est choisi) : la
  moitié basse n'hérite d'aucun repli surprise.

**Le vrai travail est de retourner la règle, et trois tests la tiennent** (`shared/domain/tool.test.ts`) :

| Test | Ce qu'il affirme aujourd'hui |
|---|---|
| `is never cut in two — nothing shares the column with the generator` (`:171`) | `if (placement.zone === 'left') expect(placement.slot).toBe('primary')` — **c'est la règle à retourner**, pas à contourner |
| la gauche d'un espace ne contient que `GENERATION_TOOLS` (`:155`) | devient « sa moitié **haute** ne contient que » |
| `share a slot, or the tool would change rail row with the workspace` (`:35`) | `explorer` porte deux placements, tous deux `primary` — voir ci-dessous |

**L'accueil suit — tranché le 9 août 2026 : `left/secondary` là aussi.** Son Explorateur est
aujourd'hui en `left/primary`, l'accueil n'ayant **pas** de génération (« the home has no document to
generate into, so the left column is free there »). Il passe quand même en moitié basse, et c'est ce
qui tient l'invariant « deux placements d'un outil partagent leur slot » : **les deux placements de
l'Explorateur fusionnent alors en un seul**

    { id: 'explorer', zone: 'left', slot: 'secondary', surfaces: [...WORKSPACE_IDS, HOME_SURFACE] }

ce qui supprime la seule raison qu'avait ce panneau d'exister en double. Le panneau garde ainsi la
même moitié et la même rangée de rail partout, ce que l'invariant existe précisément pour garantir.

> **La moitié haute vide de l'accueil n'est pas un trou visuel, vérifié dans `Edge`** : `primary &&
> secondary` seul pose la poignée de partage, et la seconde moitié reçoit `length={primary ? split :
> undefined}` — « alone, it fills the zone ». L'Explorateur occupera donc toute la colonne gauche de
> l'accueil, comme aujourd'hui. **Rien à écrire pour ça.**

> **Trois commentaires deviennent faux le jour où c'est fait** et doivent partir avec le code : « The
> left column is generation, **and only generation**, in every space » sur `models` ; « **The whole
> column, not a half of it** » dans la JSDoc de `GENERATION_TOOLS` ; et celui d'`apps` qui explique
> pourquoi il n'est *pas* à gauche. Une raison écrite pour une décision qui n'est plus prise se lit
> comme la règle en vigueur.

---

# 3. Les gestes qui n'aboutissent pas

Cinq entrées. La première échoue **complètement et en silence** ; les autres ne se constatent qu'en
lâchant la souris.

## 3.1 La dictée — le geste demandé n'a jamais existé

### 41. Trois micros pour une session, et le texte n'atterrit nulle part

**Le geste attendu.** Je clique le micro d'un champ, je parle, je reclique : **ce que j'ai dit est
écrit dans ce champ-là**. Rien d'autre ne bouge à l'écran.

**Vu le 9 août 2026, capture à l'appui** — un formulaire d'App à trois champs texte : les **trois**
micros passent en bleu ensemble, les **trois** affichent « Je vous écoute… », et rien ne s'écrit.

**Les trois symptômes ont une seule cause : rien ne relie une session de dictée à un champ.**
Vérifié dans le code, fichier par fichier :

| Ce qui est vu | Ce que le code fait |
|---|---|
| Les trois micros s'allument | `dictationAccessory` accroche un `DictationField` sous **chaque** champ `longText`, et ce composant **ne sait pas sous quel champ il est** — sa JSDoc l'assume : « It holds nothing about the field it sits under ». Il lit un store **global** : une session, un booléen, N boutons branchés dessus |
| Rien ne s'écrit | `insertAtCaret` écrit dans `document.activeElement`. **Le clic sur le micro y met le bouton** — c'est un `<button>`, et rien ne préserve le focus du champ. `editableOf` rend `null`, la fonction répond `false`, et **personne ne lit ce `false`** |

**Le geste naturel est donc structurellement impossible** : cliquer arme le micro *et* fait perdre
la cible. Ça ne peut marcher qu'en recliquant dans le textarea après avoir armé — ce que personne ne
devine.

**Ce que ça demande, dans cet ordre :**

1. **Un seul micro à l'écran par session.** Soit le bouton descend dans la ligne d'état comme le
   reste de l'état de dictée — ce que `DictationButton` fait déjà pour le téléchargement et les
   échecs, avec sa raison écrite : « a form with two long text fields would otherwise offer two
   buttons to download the same 640 MB » —, soit `DictationField` reçoit l'identité de son champ et
   n'allume que le sien.
2. **Le clic ne doit pas voler le focus.** `onPointerDown` + `preventDefault` sur le bouton, le
   patron que `ContextMenu` emploie déjà pour une autre raison.
3. **Retenir le champ visé plutôt que le deviner.** Mémoriser le dernier `editableOf` focalisé au
   moment où la session s'ouvre, et écrire là — `activeElement` ne peut pas répondre pendant qu'un
   bouton est enfoncé.
4. **Un échec d'insertion doit se dire.** `insertAtCaret` rend `false` et son appelant l'ignore
   (`stores/dictation.ts:108`) : une phrase dictée disparaît sans un mot.

> **Le modèle local reste — tranché le 9 août 2026.** Parakeet TDT 0.6b, 640 Mo, dans son propre
> `utilityProcess` : **rien de ce qui est dicté ne quitte la machine**, et rien ne se facture à la
> minute. C'est `ADR-17`, et la question a été reposée à l'utilisateur qui l'a confirmée. **Les 640 Mo
> ne sont pas le défaut ; le défaut est qu'on les télécharge pour un geste qui n'aboutit pas.**

## 3.2 Les surcouches flottantes — un seul lot, trois composants

**Regroupées** : `Flyout`, `ContextMenu` et `MenuRow` sont le même sous-système du design
system, l'entrée 21 demande déjà de corriger le rôle de `Flyout` dans le même geste, et le
remède des deux entrées est le même patron de focus et de rejet. Les traiter séparément
reviendrait à écrire trois fois la gestion d'`Échap`.

> **Une troisième dette entre dans ce lot** : `design/MenuRow.tsx` n'expose aucun
> `aria-checked` — aucun lecteur d'écran ne dit quelle ligne est active, dans **tous** les menus
> du studio.

### 21. Le volet du journal ne se ferme pas au clic à côté

**Le geste attendu.** Cliquer à côté du volet du journal le referme. `Échap` aussi. Passer à une autre application
aussi.

**Vu le 9 août 2026, capture à l'appui.** Un clic en dehors du volet devrait le refermer. La seule
sortie est de recliquer sur « 1 échec » — ce que personne n'a le réflexe de faire : c'est un
indicateur d'état, pas un bouton de fermeture.

**`Flyout` ne ferme rien, par construction.** Sur ses cinq appelants, deux gèrent, deux ne gèrent pas :

| Appelant | Comment il ferme |
|---|---|
| `MenuButton`, `AccountSelect` | `useHoverFlyout` — le pointeur sort, ça ferme, avec période de grâce |
| **`ActivityStatus`, `JobsStatus`** | **un `useState` et le clic du bouton, rien d'autre** |

C'est donc **deux volets**, pas un : la barre de jobs a exactement le même défaut, moins souvent vu.

**Le remède est déjà écrit, ailleurs.** `ContextMenu` fait le travail complet, avec ses raisons en
commentaire : `pointerdown` **en capture** — « a menu that survives until mouseup stays under the
pointer while the surface behind it has already reacted to the press » —, `Escape`, `window.blur`, et
la garde qui distingue un clic **dans** le menu d'un clic dehors. Il n'y a rien à concevoir : il y a à
partager.

> **Le piège du remède rapide** : ne pas poser ce comportement dans `Flyout` d'office. Deux de ses
> appelants ouvrent et ferment au survol, avec une période de grâce — un `pointerdown` global ajouté
> sous eux se battrait avec. Une prop de rejet optionnelle, ou un hook que les deux volets appellent.

**Trois sorties valent mieux qu'une** : le clic à côté, `Échap`, et la fenêtre qui perd le focus. La
troisième compte plus qu'il n'y paraît dans un studio.

> **À corriger dans le même geste** : `Flyout` pose `role="menu"` sur son conteneur alors qu'il
> héberge des `role="group"` et des `<ul>`, et il n'implémente ni `Échap`, ni piège de focus, ni
> navigation aux flèches. Sous peine de laisser un menu qui n'en est pas un.

---

### 32. Un menu contextuel ne se prend jamais au clavier

**Le geste attendu.** Ouvrir un menu contextuel au clavier, le parcourir aux flèches, en sortir par `Échap`, et
retrouver le focus là où on l'avait laissé.

**Vu le 9 août 2026.** `design/ContextMenu.tsx` est un `createPortal` vers `document.body` portant
`role="menu"`, avec des `MenuRow` en `role="menuitem"`. Il n'a **aucune gestion du focus** : ni entrée
au focus, ni `tabIndex`, ni piège de focus, ni traitement des flèches, ni restauration à la fermeture.

**Ce que ça coûte** : même quand l'ouverture est possible au clavier, le focus reste où il était, et
le menu — ajouté en fin de `body` — ne s'atteint qu'en traversant tout le document à la tabulation.

**Le patron APG existe et il est nommé** : entrée au focus sur la première ligne, navigation aux
flèches, `tabindex` roving, `Échap` qui rend le focus à ce qui a ouvert le menu.

> **C'est préexistant et ça touche tout le monde** : `DocumentTab`, `DraggableAsset`, `AssetMenu`,
> `StyleRow`, et la barre des espaces. Le menu seul ferme WCAG 2.5.7, jamais 2.1.1.

---

## 3.3 Les infobulles

### 30. Une infobulle ne se laisse pas survoler

**Le geste attendu.** Amener le pointeur sur une infobulle pour la lire jusqu'au bout, sans qu'elle se referme en
chemin.

**Vu le 9 août 2026.** `TooltipHost` ne pose pas `clickable`, donc la bulle garde le
`pointer-events: none` de la feuille de style du cœur, à `offset: 8` de son ancre : aller vers elle
quitte l'ancre et la referme. C'est l'exigence **« survolable » de WCAG SC 1.4.13 (AA)**.

**C'est préexistant et ça vaut pour toutes les infobulles.** Quelqu'un qui zoome à 400 % doit balayer
la bulle pour lire soixante-cinq caractères, et il ne le peut pas.

**L'exigence « écartable » du même critère est réglée** (`globalCloseEvents={{ escape: true }}`).
Reste `clickable`, qui bascule `pointer-events` sur **toutes** les infobulles : à regarder d'un bloc,
avec ce que ça fait aux barres flottantes qui en portent.

---

## 3.4 Les raccourcis hors registre

**Elle était regroupée avec la garde de format des signatures ; ce regroupement est tombé** — la
garde est livrée (`isSignature`, `feat/pinceau-durete`, 9 août 2026). L'entrée reste entière et sa
phrase reste vraie : `Alt+Flèches` ne passant toujours pas par le registre, il échappe toujours à
cette garde. Elle se traite désormais seule.

### 34. Le raccourci de réordonnancement n'est pas remappable

**Le geste attendu.** Changer le raccourci de réordonnancement des espaces depuis l'écran des raccourcis, comme
n'importe quel autre.

`Alt+Flèches` est codé dans `TitleBar` et annoncé par `aria-keyshortcuts`, mais il ne passe pas par le
registre de commandes — donc il n'apparaît pas dans les réglages de raccourcis, et
`shortcuts.overrides` ne peut pas le changer.

C'est le seul geste clavier du studio dans ce cas. Tant qu'il l'est, il échappe aussi à la garde qui
vérifie le format des signatures du registre (§ 5.2).

---

# 4. Ce que l'interface ne dit pas

Dix entrées où le studio sait quelque chose et ne le montre pas. Elles ne perdent rien et ne
bloquent personne — elles font douter, ce qui coûte à chaque usage.

## 4.1 L'état d'une ligne, et d'une tuile — un seul composant, trois aspects

**Regroupées** : les entrées 20 et 40 sont le même défaut vu de deux côtés. `rowSkin` est l'unique
fonction qui peint hover, sélection et focus d'une ligne, et sa JSDoc énonce la règle — « the same
line must not light up differently depending on whether a `Tree` or a `Collection` is holding it ».
Elle est enfreinte des deux manières possibles : **la sélection ne se voit pas là où elle existe**
(20), et **elle se peint là où elle n'existe pas** (40).

### 40. La même liste s'allume en bleu, en gris, ou pas du tout

**Le geste attendu.** Voir d'un coup d'œil quelle ligne est sélectionnée — et que ce soit **la même couleur** dans les
trois panneaux.

**Vu le 9 août 2026, captures à l'appui** — trois panneaux côte à côte, trois aspects : l'Explorateur
peint une ligne en **bleu plein**, Styles en **gris**, Apps en **gris avec un liseré**.

**Ce n'est pas du code custom, et c'est ce qui rend le défaut trouvable.** Les trois passent par le
**même** `Collection`, dont les cellules peignent par le **même** `rowSkin`, et leurs trois lignes
sont le **même** `Row` du design system — vérifié fichier par fichier. Ce qui diverge est **ce que
chaque panneau met derrière la même prop** :

| Panneau | Ce qu'il passe à `Collection` | Ce qui s'affiche |
|---|---|---|
| **Explorateur** | `selectedIds={Object.keys(open)}` — les documents **ouverts** | `bg-accent-soft`, le **bleu de sélection** |
| **Styles** | ni `selectedIds` ni `onSelect` | aucune ligne n'est jamais sélectionnée : le gris est le **survol** (`hover:bg-elevated`) |
| **Apps** | `onSelect` **sans** `selectedIds` — l'id ouvert reste dans le state du panneau | même chose, plus l'anneau de `FOCUS_RING` |

**Le seul panneau qui peint une sélection est donc le seul qui n'en a pas.** L'Explorateur détourne
la prop pour dire « ouvert », et son commentaire l'assume : « Not a selection one makes — it is what
"open" looks like in this list ». `Collection` a même dû s'en défendre côté accessibilité —
`aria-selected` n'est posé que si `role === 'option'`, avec la raison en commentaire. **L'entrée 9
avait corrigé ce que la ligne annonce ; personne n'a corrigé ce qu'elle montre.**

**Et l'inverse est vrai là où ça compterait** : quel style est appliqué et quelle App est ouverte
sont exactement ce qu'une sélection dirait, et ni l'un ni l'autre ne le dit.

**Ce que ça demande, et l'ordre importe** : trancher d'abord **ce que `accent-soft` signifie** — une
sélection, ou un état actif ? — puis brancher les deux listes qui ne le passent pas, et donner à
« ouvert » sa propre marque dans l'Explorateur, qui n'est pas celle de la sélection. Un troisième
jeton n'est pas nécessaire : `chipSkin` a déjà tranché la même question dans l'autre sens
(« il lit en `accent-soft` où les autres utilisent `elevated`, le jeton de survol du studio »).

### 20. En vue Icônes, une vignette sélectionnée ne se distingue en rien

**Le geste attendu.** En vue Icônes, voir lesquelles des vignettes sont sélectionnées.

**Vu le 9 août 2026** : l'étagère annonçait trois assets sélectionnés — l'inspecteur affichait
« Éléments 3 » — et les trois carrés étaient rigoureusement identiques aux autres.

**Mesuré plutôt que supposé** : la cellule fait 114 × 114 et la `figure` de `MediaTile` en fait
**autant**. Le fond que `rowSkin` peint sur la cellule sélectionnée — `bg-accent-soft`, vérifié
présent dans la classe — est intégralement recouvert par une tuile opaque (`bg-surface`, sa bordure,
l'image en `object-cover`). Il n'en dépasse **aucun pixel**. Le liseré qu'on croit voir au bord est la
bordure de la tuile, la même sélectionnée ou non.

**La même sélection se voit parfaitement en vue Liste**, où la ligne n'a pas de tuile par-dessus : le
tort n'est pas dans `rowSkin`.

**Deux panneaux au moins, pas un** — l'étagère à assets et le panneau **Modèles**. `MediaTile` a
**quatre** appelants : `AssetCard`, `Models`, `ChannelTile`, `ShelfCard`. À regarder d'un bloc.

**Ce qui marche déjà, et qui montre la voie** : l'anneau de focus se voit — la cellule atteinte au
clavier porte un `ring-accent` net autour de la tuile. Le focus est dessiné **par dessus**, la
sélection **par dessous**.

> Ne pas confondre les deux états en les réglant : une cellule peut être focalisée sans être
> sélectionnée, et l'inverse.

---

## 4.2 Les cinq bandes de l'accueil disparaissent quand on leur refuse la réponse

### 42. `useShelf` avale les rejets, et une bande refusée se retire de la page

**Le geste attendu.** Quand une bande de l'accueil n'obtient pas sa réponse, **elle reste à
l'écran**, le dit sobrement, et propose de réessayer. Elle ne s'efface pas.

**Vérifié le 9 août 2026**, fichier par fichier. `useShelf` a **une** politique d'échec et son
`.catch` remet la valeur initiale : « refusé » et « rien à montrer » deviennent le même état, et la
bande se retire de la page.

| Bande | Ce qu'elle lit | Ce qu'elle fait d'un refus |
|---|---|---|
| **Library** | `cloud.browse` | `if (page.length === 0) return null` — un 429 la fait disparaître sans un mot. Et depuis que `cloudBrowse` passe par `quietlyReducedBy`, **le journal ne le dit pas non plus** : plus aucune trace côté utilisateur |
| **Usage** | `scenario.usageReport` | `if (!report) return marker` — même confusion, même silence |
| **Creations** | `assets.search` | catalogue local : un échec est rare, la confusion est la même |
| **ByMode** | `assets.counts` | idem |
| **Similar** | `cloud.browse` + `cloud.similar` | **la seule qui s'en sort — mais par le haut** |

**Similar est déjà sortie de là, et c'est le vrai signal.** Elle s'est donné un type à trois états,
son propre `try/catch` dans `lookalikes()`, et un compteur `attempt` glissé dans la clé de `useShelf`
pour se fabriquer un « Réessayer ». **C'est un mécanisme de relance générique reconstruit dans un
composant** — la deuxième bande qui le voudra le recopiera.

**La forme juste : `useShelf` rend l'état, pas seulement la valeur.**

    { value, state: 'reading' | 'refused' | 'ready', retry }

Le `attempt` de Similar disparaît alors dans le hook, et `Similar.tsx` n'a plus à attraper ce que le
hook aurait dû lui dire.

**Trois points que la lecture du code a tranchés, et qu'il ne faut pas redécouvrir :**

- **Un `read()` qui répond `undefined` doit devenir `ready`, pas `reading`.** C'est le cas ordinaire
  — pas de projet ouvert, pas de pont — et le laisser en lecture ferait dessiner à toute bande sans
  projet une attente qui ne finit jamais.
- **`useDeferredShelf` doit forcer `reading` tant que la bande n'a pas été atteinte.** Sinon une
  bande jamais lue se déclare prête, retire son marqueur — et **n'est alors jamais lue**, puisque le
  marqueur est ce qui se fait observer.
- **Le retry doit vivre dans le hook**, pas dans la bande : l'effet dépend déjà de `source`, un
  compteur interne ajouté à ses deps suffit. Vérifier qu'il fonctionne sur une bande **différée dont
  le `seen` est déjà verrouillé** — c'est le cas de Similar et d'Usage.

**Ce que chaque bande affiche sur un refus, à décider.** Similar montre une ligne et un bouton ; les
quatre autres n'ont pas eu la question posée. **Une bande décorative qui afficherait une erreur rouge
serait pire que le silence** — mais disparaître sans laisser de trace est ce qui a produit cette
dette. La piste : le même bloc pour les cinq, `SectionNote` en ton `muted` et un bouton
« Réessayer » (`home.retry` existe déjà), sorti dans un composant partagé plutôt que copié cinq fois.

> **Deux pièges déjà payés sur ce chantier.** Un test qui passe ne prouve rien tant qu'il n'a pas
> échoué : vérifier que chaque test rougit quand on retire son correctif. **Attention au faux
> `IntersectionObserver` de `test-setup.ts`** — il répond « visible » par défaut, donc un test de
> chargement différé passe même si le mécanisme est entièrement supprimé ; installer
> `installIntersectionObserver({ eager: false })`. Et **ne jamais écrire un fichier de test sans
> l'avoir lu** : les quatre tests de `useShelf` ont été écrasés comme ça, et c'est le compteur de
> tests qui l'a révélé.

> **Deux manuels deviennent faux le jour où c'est fait.** Le chapitre 03, fr et en, affirme depuis le
> 9 août que Similar est **« la seule du lot »** à distinguer un refus d'un compte qui n'a rien de
> ressemblant.

---

## 4.3 Les mises en page qui divergent d'un panneau à l'autre

**Regroupées** : dans les deux cas, deux surfaces qui devraient se ressembler ne se ressemblent pas
parce qu'**un gabarit existe et n'est pas partagé** — la largeur d'une colonne de libellés pour
l'une, la formule d'une colonne défilante pour l'autre. Ce sont les deux mêmes questions que
`--sc-control` a déjà tranchées pour la hauteur des contrôles : une gauge déclarée une fois, lue
partout.

### 43. Deux familles de lignes, deux largeurs de label, dans le même groupe

**Le geste attendu.** Dans un même bloc de l'inspecteur, **toutes les lignes s'alignent** : même
colonne de libellés, même retrait, même hauteur — quel que soit l'espace où l'on se trouve.

**Vu le 9 août 2026, capture à l'appui** (l'inspecteur d'un nœud de graphe) : « Identité » et
« Type » sur une colonne, « Titre » et « Mots » sur une autre, et les champs qui commencent ailleurs
encore.

**Mesuré dans le code, pas déduit.** Deux gabarits coexistent, et rien ne les accorde :

| | `PropertyRow` (`design/PropertyRow.tsx`) | Les champs (`TextField`… via `FIELD_ROW`) |
|---|---|---|
| Largeur du libellé | **`w-20`** — 80 px | **`w-16`** — 64 px |
| Retrait horizontal | `px-2` | **aucun** |
| Hauteur | `min-h-(--sc-control)` | aucune |
| Retrait vertical | `py-1` | aucun |
| Valeur | `flex-1 truncate text-right` | champ `flex-1`, texte à gauche |

**Le `gap-2` n'est pas en cause** — les deux l'ont, et `panels/inspector/` ne contient aucun autre
espacement. Ce qui décale tout, c'est **80 px contre 64**, et **8 px de retrait contre zéro**.

**Et ce n'est pas un défaut du graphe : cinq inspecteurs sur six mélangent les deux familles**, sur
`develop`, depuis longtemps — `LayerInspector` (7 lignes contre 13 champs), `TextureInspector`
(5 contre 16), `ClipInspector` (10 contre 4), `TrackInspector` (6 contre 1). Seul `AssetInspector`
n'emploie que `PropertyRow`, et c'est pourquoi lui seul est aligné.

> **Le nœud de graphe n'est pas encore sur `develop`** : `GraphNodeInspector.tsx` vit dans le
> worktree `workflows`. La capture vient de là — **mais le défaut qu'elle montre est en amont**, et
> le corriger dans le graphe seul le laisserait dans les quatre autres.

**Ce que ça demande** : que les deux familles partagent une seule colonne de libellé. `FIELD_LABEL`
et le `w-20` de `PropertyRow` sont deux déclarations de la même chose — une gauge, comme
`--sc-control` en est une pour la hauteur des contrôles. Les commentaires des deux fichiers disent
d'ailleurs le même but avec des mots différents : « so the controls of a section line up rather than
each starting where its name ends » d'un côté, « share a gauge and an alignment rather than each
inventing a two-column layout » de l'autre.

### 44. Le nom du modèle est coupé en deux dans le panneau Génération

**Le geste attendu.** Lire le nom du modèle choisi, en entier, en haut du panneau Génération.

**Vu le 9 août 2026, capture à l'appui** : « GPT Image 2 » n'est pas tronqué en largeur — il est
**rogné en hauteur**. On voit le haut des lettres, le bas est coupé net.

**La cause tient en une règle CSS que `truncate` déclenche sans le dire.** Le titre est un `<p>` nu,
enfant direct de la colonne du panneau :

    <div className="flex h-full flex-col overflow-auto">          {/* Generator.tsx:136 */}
      <p className="text-muted truncate px-2 pt-2 text-[11px]">{descriptor.data?.name}</p>

Un item flex est normalement protégé par `min-height: auto`, qui l'empêche d'être comprimé sous la
hauteur de son contenu. **Cette protection tombe dès que l'`overflow` de l'item n'est plus
`visible`** — et `truncate` pose précisément `overflow: hidden`. Le `<p>` devient donc écrasable à
zéro, le formulaire qui le suit prend la place, et son propre `overflow: hidden` rogne le texte au
lieu de le laisser dépasser. **`truncate` sur un enfant de colonne flex sans `shrink-0` coupe
verticalement — c'est ce que la capture montre.**

**Le même panneau, écrit deux fois, et l'autre version est juste.** `Apps.tsx:158` rend exactement
la même chose : une colonne défilante, un titre, puis le formulaire construit des mêmes
descripteurs. Deux différences, et chacune compte :

| | `Generator.tsx` | `Apps.tsx` |
|---|---|---|
| La colonne | `flex h-full flex-col overflow-auto` | `flex h-full **min-h-0** flex-col overflow-auto` |
| Le titre | un `<p className="truncate">` **nu**, enfant direct de la colonne | un `<p className="truncate">` dans un en-tête à lui — `flex items-center border-b px-1 py-1.5` — dont un `ToolButton` tient la hauteur |

**Ce que ça demande** : `shrink-0` sur la ligne du titre, et la même formule de colonne des deux
côtés. La question de fond est celle du regroupement ci-dessus — **ces deux panneaux rendent le même
formulaire depuis les mêmes descripteurs, et leur en-tête n'est pas le même composant.** Un en-tête
de panneau partagé fermerait les deux écarts d'un coup, et il en existe déjà un : `PanelHeader`.

---

## 4.4 L'Explorateur n'explore rien

### 39. Le panneau s'appelle « Explorateur » et liste six documents à plat

**Le geste attendu.** Parcourir le dossier du projet comme un **arbre** — dossiers dépliables, fichiers dedans — au
lieu d'une liste plate de documents.

**Vu le 9 août 2026** — « pourquoi l'Explorateur ne ressemble pas à un explorateur ? ». La référence
donnée est l'arbre de projet d'un IDE : le dossier racine, ses sous-dossiers, dépliables, avec les
fichiers dedans.

**Ce que le panneau fait aujourd'hui** : `Explorer.tsx` rend un `Collection` sur `stored`, c'est-à-dire
**les documents du projet**, sans hiérarchie, sans dossier, sans dépliage. Une ligne, un titre, une
icône d'espace, et « Ouvert » en sous-titre. C'est une **liste de documents récents**, et elle porte
le nom d'un explorateur de fichiers.

**Et le studio a déjà l'arbre.** `design/Tree.tsx` existe : `flattenTree`, dépliage par nœud,
virtualisation, glisser de ligne, sélection multiple par `pickFrom`, et il peint par le **même**
`rowSkin` que `Collection` — précisément pour qu'une ligne d'arbre et une ligne de liste soient
identiques. **Il n'a qu'un seul appelant : `SceneTree`**, l'outliner 3D.

**Ce n'est donc pas qu'un changement de composant**, et c'est ce qu'il faut trancher avant d'écrire
une ligne : un arbre de fichiers montrerait **le dossier du projet** — `assets/`, `documents/`, et ce
que l'utilisateur y a déposé lui-même — là où le panneau ne montre aujourd'hui que les documents que
le studio sait ouvrir. Trois questions, dans cet ordre :

1. **Qu'est-ce que la racine ?** Le dossier du projet, ou `documents/` seul ? Le premier expose la
   mécanique que l'entrée 17 vient justement de masquer (`.index/` caché sur les trois plateformes) —
   il faudra dire ce qui se montre et ce qui reste caché.
2. **Que fait un double-clic sur un fichier que le studio ne sait pas ouvrir ?** Aujourd'hui la
   question ne se pose pas : tout ce qui est listé s'ouvre.
3. **Le panneau suit-il le disque ?** Un arbre qui ne se rafraîchit qu'au montage ment dès qu'on
   copie un fichier dans le dossier depuis le Finder — et `relist` n'est appelé qu'au changement de
   projet.

> **Ce que le panneau a de juste et qu'un arbre ne doit pas perdre** : il rend un document fermé
> atteignable de nouveau, et c'est sa raison d'être — sa JSDoc le dit. Un document fermé alors
> qu'aucun layout ne le tenait n'était trouvable que sur le disque.

---

## 4.5 L'accueil — deux entrées, une surface

**Regroupées** : l'entrée 13 finit sur le constat de l'entrée 12 — le menu « … » qui masque une
bande n'a pas été trouvé, « l'accueil ne montre pas ce qu'il permet ». Même page, même défaut
de fond, et le correctif de l'une se juge en regardant l'autre.

### 12. L'accueil ne dit pas ce que cliquer va faire — et ça n'ouvre jamais le fichier

**Le geste attendu.** Sur l'accueil, savoir **avant** de cliquer ce que la vignette va faire — et pouvoir simplement
ouvrir le fichier.

**Vu le 9 août 2026, capture à l'appui.** « Je clique sur une vignette, il y a une activité, mais ça
n'ouvre pas le fichier, et je ne comprends pas ce qui se passe. »

**Le fichier ne s'ouvre pas parce qu'aucune étagère n'ouvre quoi que ce soit.** Trois étagères
dessinent le **même carré** et font **trois choses différentes**, dont aucune n'est « ouvrir » :

| Étagère | Ce que le clic fait |
|---|---|
| **Ce que vous avez produit** | `recreate(asset.type, generation)` — **relance une génération** |
| **Votre bibliothèque** | `useCloud.pull([asset.id])` — **rapatrie** l'asset dans le projet |
| **Votre bibliothèque**, asset déjà rapatrié | **rien** : `fetchable` faux retire le `onClick`, et la vignette devient inerte sans le dire |

Sur la capture, la **même image** figure dans les deux étagères — deux carrés identiques côte à côte,
l'un qui régénère et l'autre qui télécharge.

**L'intention est écrite, mais nulle part visible.** Chaque vignette porte son verbe —
`home.creations.recreate`, `home.library.fetch` — dans un **`aria-label`** : un lecteur d'écran
l'entend, l'œil ne le voit jamais. Le `hint` est un `title` natif. Ce qui reste à l'écran est un
`hover:opacity-90`, identique pour les trois.

Ce n'est donc pas un défaut de compréhension mais **d'affordance**.

> À trancher au moment de traiter : « ouvrir » est-il l'action attendue par défaut sur ces vignettes,
> les verbes actuels devenant secondaires ? La capture dit que c'est ce qu'on croit cliquer.

---

### 13. L'activité est affichée deux fois

**Le geste attendu.** Ne pas voir deux fois la même activité.

La bande « Activité récente » de l'accueil montre ce que le volet du bas montre déjà.

C'est bien la **même source** : `home/sections/Activity.tsx` lit `useActivity(state => state.entries)`
exactement comme `ActivityList`. Elle est redondante par construction.

**Rien n'est perdu en la retirant** : `ActivityStatus` est dans la ligne d'état en permanence, et le
volet complet est à un clic. **Le mécanisme existe déjà** — les sections de l'accueil sont ordonnables
et masquables (`hiddenHomeSections`). C'est donc un **changement de défaut**, pas une suppression.

Que ce menu « … » n'ait pas été trouvé est un retour en soi, et il rejoint l'entrée 12.

---

## 4.6 Les Apps — deux entrées, un panneau

**Regroupées** : les deux demandent d'écrire une phrase que le panneau ne porte pas, elles
coûtent leurs clés dans les deux mêmes bundles, et la réponse de l'une conditionne l'autre —
dire *ce qu'est* une App et dire *ce qu'elle produit* sont deux moitiés du même texte.
**L'entrée 24 (§ 2) déplace ce panneau** : la faire d'abord, sans quoi la phrase serait écrite
dans une colonne qu'elle quitte.

### 19. « Apps » ne dit pas ce que le panneau contient

**Le geste attendu.** Comprendre ce qu'est une App sans quitter le panneau.

**Vu le 9 août 2026** — « c'est quoi App, le titre je ne le comprends pas ». Le panneau liste seize
entrées et ne dit nulle part ce qu'elles sont.

**Le mot vient de Scenario** et il est **délibérément non traduit** — `panels.apps` vaut « Apps » dans
les deux bundles. Ce qui se défend. Mais un nom de produit tenu par une plateforme tierce ne suffit
pas à expliquer un panneau dans un dock.

**La phrase qui a fini par expliquer**, à reprendre telle quelle : la Génération, c'est **un modèle,
une étape** ; une App, c'est **plusieurs modèles enchaînés, déjà montés par quelqu'un** — un seul
formulaire, la chaîne entière tourne.

**Ce qui n'aide pas** : le panneau n'a d'explication qu'à vide (`apps.none`), c'est-à-dire dans le
seul cas où l'utilisateur n'a rien sous les yeux à comprendre.

Trois endroits possibles, à trancher : une ligne sous le titre du panneau, l'infobulle de son icône
dans le rail — qui ne dit aujourd'hui que « Apps » elle aussi —, ou le manuel seul. Les deux premiers
coûtent une clé i18n dans chaque bundle.

> À savoir avant d'écrire cette phrase : le panneau ne montre **que les workflows publics**
> (`privacy: 'public'`), délibérément. Un workflow privé appartient au compte qui l'a écrit, et le
> studio n'a pas encore d'éditeur pour ça (§ 6). La formulation ne doit donc pas promettre « vos
> workflows ».

---

### 23. Une App n'appartient à aucun espace, et rien ne dit ce qu'elle produit

**Le geste attendu.** Savoir ce qu'une App produit **avant** de la lancer, et où le résultat est parti **après**.

**Constaté le 9 août 2026** — « je le vois sur toutes les sections ». C'est exact : `TOOL_PLACEMENTS`
déclare `apps` pour `WORKSPACE_IDS`, et `searchApps` ne filtre que `privacy: 'public'`. **La même
liste s'affiche dans les six espaces**, sans aucun tri.

**Une App n'est liée à aucun type** : `WorkflowSummary` porte `id`, `name`, `description`, `status`,
`privacy`, `tags`, `thumbnail`, `locked` — **aucune notion de sortie**. Le seul signal existant est
`tags`, qui ne sert aujourd'hui que de sous-titre de secours.

**Le multi-sorties fonctionne déjà, et bien.** `assetTypeOfRemote` lit le type que l'API annonce
**pour chaque sortie**, l'asset est importé sous ce type et atterrit dans l'étagère correspondante ;
plusieurs sorties reçoivent un `groupId` commun et un `outputIndex`. Un type inconnu est ignoré plutôt
que rangé de travers.

**La conséquence à l'écran est celle qu'on ne voit pas venir : le résultat n'apparaît pas forcément là
où on l'a lancé.** Une App lancée depuis la 3D peut déposer une image dans l'étagère Image.

**Ne pas filtrer par espace est correct** : filtrer cacherait justement les Apps les plus utiles.
Mais l'absence de filtre n'exempte pas d'expliquer — deux manques, dans l'ordre :

1. **Dire ce qu'une App produit**, avant de la lancer. Vérifier d'abord si l'API le dit : le
   descripteur ne le porte pas, ses `tags` peut-être. À mesurer contre l'API réelle avant d'inventer.
2. **Dire où le résultat est parti**, après. La barre de jobs et le journal savent qu'il est arrivé ;
   ni l'un ni l'autre ne dit dans quelle étagère.

---

# 5. Les manques par espace

Ce qui reste d'un chantier commencé, espace par espace. Rien ici ne perd de données ni ne bloque
un geste : ce sont des fonctions annoncées et pas finies.

## 5.1 Couche documents

**Ce qui reste ouvert :**

- **La croix de fermeture d'onglet.** Celle de Dockview est masquée **délibérément** (elle retire un
  panneau, ce qui n'est pas fermer un document). **Ne pas « réparer » ce masquage.**
- **Un document neuf où l'on a peint sans enregistrer est perdu au rechargement, silencieusement.**
  Avant comme après le correctif des onglets fantômes. Décider s'il faut le dire ou l'écrire, sachant
  qu'écrire contredit le commentaire de `create`, qui a ses raisons. **Choix de produit, pas
  correctif.**
- **`useDocuments.refresh()` ne passe pas par `forgetDocument`** : les vues de session d'un projet
  quitté y survivent.
- Les deux trous de budget de couverture du § 0.1 (`app/**`, `panels/**`).

---

## 5.2 Espace Image

> **La dureté du pinceau et la garde des signatures sont livrées** (`feat/pinceau-durete`, 9 août
> 2026). Ce que les deux ont appris est au § 12.3.

- **Le curseur de dureté reste vivant sous le crayon**, et ne déplace rien. Le défaut est **déplacé
  d'un cran, pas refermé** : un contrôle sans effet ne s'affiche pas — c'est la règle que le studio
  applique déjà à la case d'ombre d'un sprite. `BRUSH_FIELDS` est déjà une table : de quoi griser une
  ligne selon l'outil armé y tiendrait.
- **L'adoucissement est réservé au pinceau, et la gomme attend le sien.** Sous filtre, un stamp en
  `erase` gomme contre du vide (§ 12.3) : le rendre à la gomme demande de porter le blend sur le
  filtre, **et une vérification GPU** — se tromper là veut dire une gomme qui cesse de servir sans
  rien dire.

**À voir à l'écran, et rien d'autre ne le dira** : le fondu du pinceau, et que la gomme efface
toujours. **Aucun test ne peut les regarder — il n'y a pas de GPU sous vitest.**

---

## 5.3 Espace 3D

L'espace porte 17 primitives, 5 types de lumières, gizmos, sélection multiple, groupes et reparentage,
import glTF/GLB avec Draco et KTX2, magnétisme et repère local, ombres par nœud, environnement IBL,
`sprite`, caméra orthographique, six vues normalisées, trois modes d'affichage, export glTF/GLB/USDZ,
et un BVH construit en worker pour le picking.

| Manque | Pourquoi il reste |
|---|---|
| Instanciation, LOD | écartés par le plan tant qu'aucun cas réel ne les réclame : le seul coût mesuré était le picking, et il est réglé |
| Graisses d'une police | une seule coupe par famille est offerte, le romain. Un sélecteur demande d'indexer les faces par famille — mécanique, pas conceptuel |
| three livré deux fois | le chunk du worker BVH pèse 490 ko parce qu'il embarque three, déjà dans le bundle principal. Chargé à la demande et en local, donc supportable — mais c'est du poids d'installation en double |

**Deux dettes de cet espace sont rangées ailleurs, et pour la même raison : leur sujet n'est pas la
3D.** Les tables de specs qui rendent tout futur champ obligatoire sont au **§ 1.1** — elles perdent
des nœuds dans des documents déjà écrits, ce qui les met avec le reste de ce qui perd du travail. Les
branchements que la couverture certifie sans que rien ne les tienne sont au **§ 0.3** : ce qu'ils
mettent en cause est le filet, pas l'espace. **L'entrée 36 ci-dessous, elle, est bien de la 3D**, et
elle voisine ce que le lot sprite a laissé derrière lui.

**Le canal d'échec du renderer — ce qui reste** : six avaleurs de rejets attendent (`Rail`, `peaks`,
`prepareEdit`, `decoder-pool`, `useWaveSurfer`, `Models`). Une piste écartée volontairement :
journaliser dans `handle()` couvrirait les quarante canaux d'un coup, mais **une erreur du SDK embarque
la clé API** — il faudrait la réduire avant, et `log.ts` l'écrit en gros.

**Deux asymétries connues, laissées telles quelles :**

- `pickSavePath` pose un filtre d'extension, `savePicture` n'en pose aucun : on peut enregistrer des
  octets PNG sous un nom que rien ne contraint.
- Sur Windows et Linux, un raccourci qu'une surface écoute elle-même attend la touche Windows, pas
  `Ctrl` — `signatureOf` lit `event.metaKey`. C'est la convention de tout `COMMAND_REGISTRY`, `⌘Z`
  compris : la corriger touche la résolution des raccourcis de toute l'application. Documenté aux
  chapitres 15 et 18 du manuel.

---

### 36. Un sprite refuse la poignée de rotation, mais l'inspecteur laisse encore taper l'angle

**Le geste attendu.** Sur un sprite seul, la ligne Rotation de l'inspecteur ne doit pas accepter une valeur qui ne se
voit nulle part.

**Vu le 9 août 2026.** `gizmoTargetFor` refuse désormais la poignée sur un sprite seul et sans
enfant — three ne lit jamais la rotation d'objet d'un sprite, vérifié dans `sprite.glsl.js` de three
0.185 : le shader lit les *longueurs* des deux premières colonnes de la matrice, qu'une rotation
laisse intactes, et prend son angle d'un `uniform` de matériau.

Mais `TransformSection` rend la ligne Rotation pour tous les types sans consulter `canRotate`, et la
garde de commande (`commands.ts`, `refuses`) ne filtre que les drapeaux d'ombre. La saisie numérique
salit donc toujours le document et empile un undo sans effet visuel.

**La condition qui rend ça délicat** : la garde de commande doit tenir compte des enfants —
`state.nodes.some(n => n.parentId === node.id)` — sinon elle casse un cas légitime, puisque tourner
un sprite dont d'autres nœuds descendent les fait pivoter, et ça se voit. Le précédent du dépôt est à
trois côtés : `canCastShadow`/`canReceiveShadow` sont consultés dans le renderer, dans
`ShadowSection` **et** dans la garde de commande.

---

## 5.4 Espace Textures

**Ce qui reste, par étape :**

- **Étape 5** — l'import d'un fichier du disque **directement** dans un canal. Le détour existe
  (importer dans le projet, puis déposer sur la vignette) et il est écrit au manuel.
  `IMPORTABLE_TYPES` ne connaît pas les canaux : c'est un chemin à ouvrir, pas un bug.
- **Étape 6** — « améliorer ce canal » par `model_sc-texture-converter`, **via le `JobManager`**,
  jamais un appel direct au SDK. Un job rend six canaux ; `collector.ts` sait déjà les répartir par
  `metadata.type`.
- **Étape 6, mesuré et non traité** — **109 ms de thread UI pour une normale 2048²**, ~400 ms en 4K,
  dominés par le décodage et `toBlob`. C'est un geste, pas une frame, mais l'invariant 6 n'est pas
  honoré : un `OffscreenCanvas` dans un worker sortirait le tout.
- **Étape 6, chaînage** — un canal dérivé ne se met pas à jour tout seul ; rien ne s'abonne à sa
  source, et les deux manuels le disent. Recalculer la normale quand la hauteur change demanderait un
  `isStale` à côté de `canDerive` — `derivedFrom` sur l'asset porte déjà de quoi le calculer.
- **Étape 8, mesuré et non traité** — la cible glTF encode quatre PNG puis les redécode aussitôt pour
  les remonter en textures : un aller-retour d'encodeur pour des octets qu'elle n'écrit jamais, de
  l'ordre de trois à sept secondes sur un export 4K. Sortir un `ImageBitmap` de la passe l'éviterait,
  au prix d'une passe qui répond deux choses selon la cible.
- **Le prix de la file hors écran, non traité** : une passe dont le `load` ne se règle jamais bloque
  `runOffscreenPass` définitivement. Avant, elle ne bloquait que sa propre ligne de menu. Un délai de
  garde serait une complexité non mesurée ; **c'est un choix, pas un oubli.**

**Deux dettes nommées :**

- **`invertNormalGreen` est stocké sous le matériau alors que ce n'est pas un réglage de rendu** : il
  dit dans quelle convention la normale est **arrivée**. Il descend jusqu'à l'export, seul endroit où
  la convention d'un canal et celle d'une cible se rencontrent. Il reste là où il est parce que les
  `.tex` déjà écrits l'y portent.
- **`ChannelTile`** : le bouton d'inspection en `inset-0` recouvre le badge d'origine, si bien que son
  `title` ne peut jamais s'afficher (l'`aria-label` reste lu, c'est cosmétique).

**Une dette hors périmètre** : `design/MenuRow.tsx` n'expose aucun `aria-checked` — aucun lecteur
d'écran ne dit quelle ligne est active, dans **tous** les menus du studio.

**À regarder à l'écran, et c'est tout ce qui reste de cet espace** : les **dérivations**, le **tiling**
et l'**export**. Livrés et testés, jamais vus tourner. Cela demande que l'application soit fermée
d'abord (verrou d'instance unique).

> Pour l'export, deux choses ne se jugent qu'à l'œil et qu'aucun test ne peut rendre : ce que donne un
> `.glb` **ouvert ailleurs** (Blender, un moteur), et ce que vaut un `_MaskMap` **relu par Unity**,
> puisque c'est un canal alpha et que rien ici n'en affiche un.

---

## 5.5 Espace Skyboxes

> **L'export en six faces est livré** (`feat/skybox-export`, 9 août 2026). Ce qu'il a appris est au
> § 12.3.

**Ce qu'il reste : le HDRI, et rien d'autre.** Les six faces sortent en PNG, donc en **8 bits par
canal** — ce qui dépasse le blanc est écrêté, et un éclairage à forte dynamique n'a pas de sortie. Un
`.exr` en écriture demanderait un encodeur que le studio n'embarque pas ; **c'est donc une dépendance
à accorder avant d'ouvrir le sujet**, pas un chantier à lancer.

> **Un piège avant d'y toucher.** Un `.hdr` **n'est pas importable** : `IMPORTABLE_TYPES`
> (`main/media/link.ts`) ne connaît que vidéo, audio et image, et un `.exr` importé est catalogué
> `image`, jamais `skybox`. Sans conséquence aujourd'hui — le puits accepte toute image du projet —
> mais quiconque cherchera « pourquoi mon HDRI n'apparaît pas dans l'import » cherchera là.

---

# 6. Le node editor et les workflows Scenario

> **Le chantier a son plan**, dix étapes :
> [`docs/plans/2026-08-08-workflows-node-editor.md`](plans/2026-08-08-workflows-node-editor.md).

**Sept étapes sur dix sont fusionnées dans `develop`** — les six premières, puis **la dixième**. Le
graphe est un espace pour de bon : document `.graph`, entrée dans `IO_BY_KIND`, composant en `lazy()`,
palette et barre. Le manuel le décrit dans les deux langues, avec l'avertissement qui convient — **il
s'ouvre, on y pose des nœuds et on les enregistre, il ne sait pas encore exécuter ce qu'il décrit.**

## 6.1 Ce qui reste — étapes 7 à 9

Le cœur exécutable : **compiler** vers le `flow`, **valider**, **exécuter** en local. Puis la logique,
les boucles, les transforms, l'approbation, et enfin l'import/export et la publication.

**Trois limites à porter dans le domaine** : 50 nodes par workflow, 10 jobs de workflow concurrents,
100 requêtes par minute. Les deux dernières sont bornées ; la première appartient à l'export et doit
**échouer proprement**, pas silencieusement.

> Une App publique compte **62 nœuds** (`wflow_H1bKz78jgpinWPKJfVCM5uAp`) : le plafond de 50 n'est pas
> opposé aux workflows publiés, **ce qui est à vérifier avant d'écrire le refus d'export de l'étape 9.**

## 6.2 La décision d'architecture : où le graphe s'exécute — NON TRANCHÉE

C'est **la** question du chantier.

| | **A — déléguer à Scenario** | **B — exécuteur local** |
|---|---|---|
| Comment | `workflows.run` → un job → `metadata.flow` | tri topologique local, un `runModel` par node |
| Progression par node | fournie | à écrire |
| Nodes non-Scenario (ffmpeg, noyau GPU, fichier local, export moteur) | **impossible** | possible |
| 50 nodes / 10 jobs concurrents | subis | contournés |
| Re-run partiel par cache de hash | **impossible** | possible |
| Publication en App, partage | natif | impossible |

**La recommandation est B comme moteur, A comme export**, et la raison est le cache : changer le prompt
du dernier node ne doit relancer que ce node. C'est ce qui rend un node editor supportable, et c'est
exactement ce que déléguer interdit. Mais B est une semaine de plus, et A seul serait déjà un produit.
**À arbitrer avec l'utilisateur avant d'ouvrir la branche.**

Un point qui penche : les nodes que Scenario n'a pas sont ceux qui donneraient sa valeur au studio —
`localFile`, `ffmpegConcat`, un aperçu PBR sur le noyau GPU existant, un export Unity ou Godot. **Ils
n'existent que sous B.**

## 6.3 Ce que le chantier apporterait par ricochet

**`user-approval` ouvre une phase que le `JobManager` n'a pas.** Un job de workflow peut se suspendre
en attendant l'utilisateur ; `workflows.userApproval` le débloque. `JobStatus` n'a rien entre `running`
et fini : c'est une valeur de plus dans le domaine, et elle change `isFinished`.

**Les modèles utilitaires de Scenario sont la matière première d'un graphe, et le studio n'en appelle
aucun.** Ce sont des **opérations déterministes exposées comme des modèles**, donc chaînables dans un
flow et atteignables par le `runModel` déjà écrit — sans une ligne de code spécifique, puisque leur
formulaire se construit tout seul (invariant 5).

| Famille | Modèles | Ce qu'ils donnent au studio |
|---|---|---|
| Géométrie | `scenario-compose-image`, `-image-slicer`, `-grid-maker`, `-resize-image`, `-padding-remover`, `-convert-to-mask-image` | les nodes de composition et de découpe d'un graphe |
| **Calques** | `scenario-image-layers-extractor` | `separationInstruction` en langage naturel, `maxLayers` 1–10 : **un clic « décomposer en calques » → une pile éditable** dans un espace Image qui a déjà l'arbre de calques |
| ControlNet | `scenario-detection`, param `modality` | `canny` `depth` `grayscale` `lineart_anime` `mlsd` `normal` `pose` `scribble` `segmentation` `sketch` — un node « Detect » à un menu, et `depth`/`normal` alimentent le noyau GPU existant |
| Étalonnage | 18 × `scenario-postprocessing-*` | `lut` (~180 presets film), `grain` (22 profils), `color-correction`, `sharpen`, `glow`, `vignette`… |

Deux réserves à porter dans le plan. Ce sont des **appels réseau facturés** : pour un aperçu
interactif, le noyau GPU du studio refait la passe en shader et Scenario n'est appelé qu'au rendu final
— le mapping paramètre → uniform est direct, les noms et les bornes venant du schéma. Et
`scenario-smart-reframe` en `textDensity: DENSE` + `thinkingLevel: HIGH` est **nettement plus coûteux** :
ces deux champs veulent un avertissement et un `dryRun` affiché.

## 6.4 Hors périmètre, et pourquoi c'est écrit ici

Pour qu'une prochaine session ne reparte pas chercher.

- **Train et Compose n'existent pas** (`models.train.trigger`, `models.training_images.*`,
  `models.create` en `flux.1-composition` avec ses `concepts[]` à `scale`). Tout est documenté en
  local, rien n'est écrit. Un entraînement dure des **heures** : la persistance des jobs en était le
  vrai prérequis, et elle est livrée. **Écarté pour l'instant, pas oublié.**
- **Le mode « Live » de la webapp n'a AUCUN endpoint dans les 209 pages locales** — ni streaming, ni
  WebSocket. Ce n'est pas un manque du studio, c'est une fonctionnalité que l'API n'expose pas. À
  défaut, un `runModel` débouncé sur un modèle rapide avec annulation du job précédent en serait
  l'imitation honnête. **Ne pas la chercher à nouveau dans la doc : elle n'y est pas.**
- **Le serveur MCP de Scenario est en BETA** et n'a pas à devenir une dépendance produit. Le panneau
  Modèles à facettes est la réponse déterministe au même besoin, et il est livré.
- **La surface Scenario non touchée** : l'**édition** d'un workflow (les trois canaux cherchent,
  décrivent et lancent ; aucun n'écrit), `detect`, `patch`, l'entraînement, la composition de LoRA, les
  écrans de collections, la recherche par similarité visuelle. Et le **solde** ne manque pas par
  oubli : l'API n'expose que ce qui a été dépensé.

> **Avant de toucher à `detect` ou `patch`** : vérifier s'ils sont asynchrones pour de bon.
> `generate/prompt`, `caption`, `describe_style` et `translate` **ne le sont qu'en apparence** —
> chacun répond avec un `Job`, mais son résultat est dans la réponse du POST. Le `JobManager` n'est pas
> concerné. **Ne pas supposer l'inverse pour les autres.**

---

# 7. Les dettes transverses

**Le décodage du clone IPC** — **73 % du coût d'un ⌘S, intouché**. `⌘S` gèle toutes les fenêtres
au-delà de **~5 500 nœuds**, et c'est le décodage qui l'y amène, deux fois et demie la sérialisation
(§ 12.4).

L'import glTF aurait dû faire franchir ce plafond. Il ne le fait pas, parce que **le modèle importé est
un seul nœud portant une référence**, jamais un sous-arbre : le document grossit d'une ligne quel que
soit le poids du fichier. Le prix est que l'intérieur d'un modèle ne s'édite pas ; une commande
« éclater » lèverait la limite le jour où elle gênera. **Le décodage reste à traiter avant tout ce qui
poserait des nœuds par milliers.**

**L'horloge d'un viewport n'a pas d'état « au repos », et sa JSDoc prétend le contraire.**
`ViewportEngine.lastTime` est documenté comme valant `null` quand la boucle dort, mais rien ne l'y
ramène : `renderFrame` y écrit `now` à chaque frame et seul `resetClock()` y touche par ailleurs.
Chaque appelant qui démarre une animation doit donc penser à appeler `resetClock()` — et à garder cet
appel sur un front montant qu'il suit lui-même. `SceneRenderer.onPointerDown` refait déjà la même danse
à la main. **Le remède est plus profond qu'aucun des deux appelants** : que `renderFrame` remette
`lastTime` à `null` quand il décide de ne pas replanifier de frame, ce qui supprime la classe entière
au lieu de la rustiner deux fois — un viewport qui l'oublierait ouvre son mouvement sur un saut de
`MAX_DELTA`, 0,1 s.

**Les écritures de *dossier* de `documents.ts` gardent leur propre nettoyage** — entrée **38** du
§ 1.3, avec le piège de test qui va avec.

**Durabilité, assumée.** `documents.ts` renomme atomiquement, ce qui protège d'un crash **en cours
d'écriture**, mais ne fait pas de `fsync` : une coupure de courant peut perdre l'écriture.

**Le double dispatch des accélérateurs Electron n'a jamais été vérifié en conditions réelles.** macOS
consomme probablement la frappe avant le renderer, Windows/Linux non. **Personne ne l'a mesuré sur les
trois plateformes.**

**`src/main/menu/index.ts` n'a aucun test** — empreinte, débounce, cycle de vie par fenêtre.
`src/main/ipc/test-harness.ts` mocke déjà `ipcMain`, mais il faut l'étendre à
`app` / `BrowserWindow` / `Menu`.

**Aucun test ne s'exécute sur l'application lancée** — le poste de vérification le plus cher du projet,
et le seul qu'aucune porte ne tient. Le protocole de vérification manuelle est au § 10 ; **Playwright
est reporté le 8 août 2026, pas abandonné**. Son suivi vivait sous `L7` dans
`.claude/loop/BACKLOG.md`, **qui n'existe plus** : la décision n'a donc plus d'autre trace que cette
ligne, et c'est pour ça qu'elle y est écrite en entier plutôt qu'en renvoi.

**La moitié rapatriement de la bibliothèque n'a pas de porte.** `cloud.pull`, `cloud.browse` et
`cloud.plan` traversent la frontière, sont testés, et **aucun composant ne les appelle** : le
planificateur sait calculer un diff bidirectionnel, et personne ne le lui demande. Seul `push` a un
bouton. Deux conséquences à ne pas confondre avec des bugs — **trois des sept badges sont
inatteignables** (`to-pull`, `conflict`, `other-account`), et `location-facet.ts` explique pourquoi à
l'endroit exact où la tentation serait d'en ajouter ; et **le manuel écrit noir sur blanc** que le
transfert est à sens unique (`docs/fr/manuel/07-assets.md`), donc ouvrir cette moitié veut dire mettre
à jour les deux manuels dans le même mouvement.

**L'abandon d'une recherche est livré comme une assurance, pas comme un correctif.** Aucun composant du
renderer n'envoie encore `text:` au catalogue local. **Le brancher au handler IPC serait un bug** :
`stores/assets.ts` lit un rejet comme « pas de projet » et **VIDE l'étagère**. Un champ de recherche
devra donc distinguer `ABANDONED` d'un échec avant de tenir un `AbortController`.

**La famille `other` n'attrape rien, et le seul modèle qu'elle devrait attraper part dans Image.**
Vérifié par un appel le 9 août 2026 : sur les 100 premiers modèles publics, **quinze capacités
distinctes**, dont une seule qu'aucun motif de `FAMILY_BY_CAPABILITY` ne classe — `txt2txt`. Elle
appartient à `model_scenario-llm`, qui déclare **aussi `img2txt`**, et `img2txt` contient `img` : le
motif de l'image mord, et le LLM est catalogué modèle d'**image**. Le test
`familyOf(['txt2txt'], []) === 'other'` (`schema.test.ts:151`) garde donc un jeu de capacités
qu'**aucun modèle réel ne porte**. Conséquence à l'écran, non vérifiée : le panneau Modèles de l'espace
Image liste un modèle qui produit du texte. **Le remède serait un motif de sortie (`txt$`) avant celui
de l'image, pas une nouvelle famille.**

---

# 8. Duplication et cohérence

Deux entrées qui ne cassent rien aujourd'hui et qui coûteront le jour où quelqu'un modifiera
l'une des deux copies sans savoir que l'autre existe.

## 8.1 Un algorithme écrit deux fois

### 33. Le même algorithme de réconciliation d'ordre, écrit deux fois

**Le geste attendu.** Aucun geste — c'est une duplication, et elle coûtera au premier qui modifiera une des deux
copies sans savoir que l'autre existe.

**Vu par deux agents de revue indépendamment.** `workspaceOrder` (`shared/domain/workspace.ts`) et
`homeSections` (`shared/domain/home.ts`) portent la même boucle à deux passes : garder les ids stockés
que le build connaît encore, puis réinsérer chaque entrée manquante du registre **juste après son
dernier voisin antérieur encore présent**.

C'est la partie subtile — le calcul de l'indice d'insertion — dupliquée presque mot pour mot, et **deux
suites de tests prouvent séparément le même algorithme**.

Un générique `reconcileOrder<T, K>(stored, registry, keyOf)` dans `shared/domain/` absorbe les deux :
une vingtaine de lignes contre deux sites d'appel de trois. La différence de forme — ids nus d'un côté,
`{ id, visible, limit }` de l'autre — se règle par `keyOf`.

**Ne pas généraliser les `moved*` avec** : `movedWorkspace` déplace vers une cible (sémantique du
lâcher), `movedHomeSection` échange deux voisins (sémantique du menu). Un paramètre de mode coûterait
plus en indirection que deux fonctions de dix lignes ne rendent.

> **Un trou jumeau, connu** : `home.sections` a le même défaut de `.catch` sur l'élément plutôt que
> sur la branche que `order` avait — un ordre mal formé y jette encore tout le fichier de réglages.

---

## 8.2 Une police déclarée et jamais chargée

### 29. `Inter` est déclarée comme police de l'interface, et n'est chargée nulle part

**Le geste attendu.** Que l'interface s'affiche avec la **même** police sur les trois plateformes, et qu'un libellé
coupe au même endroit partout.

`--font-sans` nomme `'Inter', system-ui, …` dans `index.css`, mais **aucun `@font-face`, aucune
dépendance dans `package.json`, aucun lien dans `index.html`** : la pile retombe sur `system-ui`,
c'est-à-dire une police différente sur chacune des trois plateformes que le pipeline empaquette.

**Ce que ça ne casse pas, contrairement à ce qu'on croirait** : les hauteurs de ligne. Le préflight
Tailwind pose `line-height: 1.5` sur `html`, sans unité, donc calculé sur la taille de chaque élément
et non sur les métriques de la fonte.

**Ce que ça change quand même** : la chasse et le dessin des lettres, donc la largeur d'un libellé,
donc le point où un `truncate` coupe. Deux issues, pas trois : embarquer Inter, ou cesser de la
nommer. **La nommer sans la charger est la seule qui mente.**

---

# 9. Bloqué

Une entrée, et elle ne bouge pas sans une mesure sur l'application lancée.

### 4. Aucun sélecteur de couleur ne s'ouvre

**Le geste attendu.** Cliquer un carré de couleur ouvre un sélecteur.

Les **quatre** `input type="color"` de l'application sont muets — pinceau, inspecteur, formulaire de
génération, réglages. Ce n'est donc pas un défaut de la barre d'outils : la cause est sous le renderer.

Ce qui a déjà été écarté : aucun `preventDefault` sur le chemin du clic, aucun
`appendSwitch`/`--disable-features` dans le main, ni `alwaysOnTop` ni fenêtre transparente — les deux
configurations connues pour garder le panneau caché sur macOS. La littérature Electron ne documente
rien qui corresponde.

**Bloqué sur deux mesures**, qui exigent l'application avec le port de debug :

1. `input.showPicker()` dans un `try/catch` — ce qu'il lève, ou son silence.
2. `document.hasFocus()` juste après le clic — un panneau natif vole le focus ; s'il reste `true`,
   rien ne s'est ouvert du tout.

Si Electron n'expose aucun `ColorChooser`, la décision inscrite dans `BrushControls` — « un input
natif, délibérément, parce que macOS ouvre le sélecteur système » — tombe, et il faut un sélecteur
maison dans `design/`, partagé par les quatre appelants. **C'est une décision de conception, pas une
correction.**

---

# 10. Vérifier à l'écran

**Un jalon visuel validé uniquement par des tests unitaires n'est validé qu'à moitié.** Règles,
repères, zoom, compositing, pointillés, viewport éclairé : rien de tout cela ne se prouve dans vitest.
L'espace Textures en porte la trace — un viewport noir venait de l'environnement studio manquant, ce
qu'aucun test n'aurait dit.

Le MCP `electron` pilote la fenêtre après `pnpm start:debug`. **Le port 9222 est unique** : si une
autre session a déjà lancé l'application, c'est son instance qu'on pilote, et on croit mesurer sa
propre branche. Il faut aussi un projet ouvert, donc `secrets/.env` copié dans le worktree — une
session s'est déjà vu refuser cette copie par la politique de permissions, le prévoir.

> **Une instance à soi contourne le verrou d'instance unique** : port 9224 et `--user-data-dir` dédié,
> ce qui permet à plusieurs sessions de piloter chacune la sienne. Le MCP `electron` ne parlant qu'au
> 9222, la mesure passe alors par CDP direct (`WebSocket` natif de Node, aucune dépendance).

Ouverture, parcours des six espaces, détachement d'un panneau, fermeture propre, consoles main et
renderer sans erreur : **vérifié à la main, à chaque fois, par qui livre.**

## Les captures d'écran attendues

Le `README.md` racine et les deux guides utilisateur référencent des images qui **n'existent pas
encore**. Tant qu'un fichier manque, son emplacement reste visible dans le markdown sous forme de
commentaire HTML — rien ne casse.

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

---

# 11. Méthode — ce qui a marché

**Les revues qui exécutent le code trouvent beaucoup plus que celles qui le lisent.** Trois points de
comparaison, tous sur le mode Image :

| Quand | Comment | Trouvé |
|---|---|---|
| Jalon 0 | huit agents qui ont **lu** le code | 3 défauts |
| Jalon 2 | trois agents à qui il était demandé d'écrire des sondes vitest et de **reproduire** chaque défaut | **12 défauts**, dont une régression critique introduite par la passe de simplification elle-même |
| Jalon 3 | un agent muni d'une **sonde instrumentée** | le nouveau chemin du déplacement de calque payait cinquante réordonnancements par frame — aucune lecture ne l'avait vu |

Quand une revue est déléguée, demander explicitement : de **reproduire empiriquement** chaque défaut
avant de l'affirmer, de rendre **la sortie de la sonde qui le prouve**, de séparer les défauts confirmés
des suspicions non reproduites, et de **nettoyer derrière soi** — le répertoire de travail est le
scratchpad indiqué en tête de session, jamais `src/`, jamais `/tmp`.

**Casser son propre code pour voir si un test rougit.** Sur un lot récent, deux tests écrits de bonne
foi ne mordaient pas : l'un mesurait une garde au lieu du défaut, l'autre cherchait un mot qu'aucun
bundle ne contient.

**Une fusion sans conflit n'est pas une fusion sans contradiction.** C'est arrivé deux fois. Un autre
travail avait documenté dans huit chapitres du manuel que « l'espace Image ne sait pas ouvrir une image
existante » — au moment précis où une branche l'implémentait ; git a mêlé les deux proprement, et le
manuel décrivait deux logiciels à la fois. Puis `develop` a ajouté un test d'exhaustivité sur `LogScope`
dont les portées neuves manquaient, fusionné sans un mot.

La règle qui en sort : **après toute fusion touchant à la fois du code et de la documentation, relire ce
que la doc affirme sur ce que le code vient de changer**, et vérifier chaque affirmation dans le code
plutôt qu'au jugé — sur quatre limites suspectes d'un lot, trois étaient tombées et **une tenait
encore**. Supprimer la quatrième aurait fait mentir la doc dans l'autre sens.

**Un commentaire déplacé garde sa formulation et perd sa vérité.** Un bug de rendu est venu de là : une
JSDoc recopiée d'un module où elle était exacte justifiait, dans le nouveau, un test faux. Quand on
change un comportement, on relit les commentaires autour.

**Rebaser souvent.** Plusieurs sessions travaillent en parallèle dans `.claude/worktrees/` : deux ont
déjà réécrit le panneau des calques et le registre de commandes en même temps. Corollaire pratique :
préfixer chaque commande par le chemin absolu de son worktree — le shell retombe ailleurs entre deux
appels, et un build lancé au mauvais endroit écrase le `out/` du voisin.

**Le manuel utilisateur ne se relit pas, il se vérifie.** 19 chapitres, fr et en. Les registres
(`COMMAND_REGISTRY`, `IMAGE_TOOLS`, `UNBUILT_TOOLS`, `TOOL_PLACEMENTS`, `IO_BY_KIND`) et le bundle i18n
disent ce que le logiciel fait — l'impression qu'on en a, non. Cette méthode a rattrapé une inversion
complète : `feat/panels-layout` a échangé les deux colonnes, et le manuel a continué pendant plusieurs
fusions à envoyer le lecteur chercher chaque panneau du mauvais côté, 24 passages dans chaque langue.
**Un merge qui déplace une surface visible n'est pas fini tant que les deux manuels ne l'ont pas suivi.**

---

# 12. Ne pas repayer, ne pas rouvrir

Ce qui suit n'est pas une liste de tâches : ce sont les réponses déjà données, et c'est à elles qu'un
nouveau constat se compare.

## 12.1 Les règles de disposition — tranchées

**La colonne de gauche est réservée à la génération**, dans les six espaces. La droite porte ce qui
parle du document, **inspecteur en moitié basse**. L'étagère à assets est en **bande du bas** partout —
sauf en Vidéo et en Audio, où la timeline occupe le bas et où c'est la colonne de droite qui la porte
(`TOOL_PLACEMENTS`, `shared/domain/tool.ts`).

> Avant, l'étagère était à droite dans tous les espaces, où elle mangeait la largeur du canvas.
>
> **L'entrée 24 du § 2 amende la première règle, et c'est la seule des trois qui bouge** : la
> génération garde la colonne gauche, mais **sa moitié haute seulement** — l'Explorateur et Apps
> prennent la moitié basse, partout, accueil compris. Les deux colonnes se lisent alors pareil : ce
> qu'on choisit en haut, ce qu'on parcourt en bas.

**Une moitié vaut `null` quand personne ne l'a choisie**, et chaque espace y lit le premier panneau
qu'il déclare. **Ne pas remettre d'identifiant dans `DEFAULT_OPEN`** : nommer un panneau par moitié
imposait la réponse d'un espace aux cinq autres.

**Le centre ne porte que la barre d'outils et les règles.** C'est la conséquence directe des deux règles
précédentes, et c'est pour ça qu'un menu horizontal posé en haut du centre est un défaut et pas un
choix.

**Le fond reste opaque** : pas de vibrancy, pas de transparence de fenêtre. Dans un studio on juge des
couleurs. C'est une décision de métier, pas une occasion d'améliorer.

**Les `gap-1.5` sont laissés tels quels, délibérément** : ils sont déjà plus larges qu'un, et quelques
rangées denses reposent sur ce demi-cran. Un test (`design/spacing.test.ts`) refuse tout `gap-1` nu.

**« Tout » dans les filtres du journal ne dit pas « rien n'est caché », il dit « aucun filtre n'est
posé »** — cocher les trois niveaux un par un laisse « Tout » éteint, et c'est voulu. Et `flex-wrap`
est conservé **à l'intérieur** de chaque rangée : la largeur des puces suit la langue, aucune largeur
de volet ne garantit une ligne.

## 12.2 Les corrections déjà faites — ne pas les re-signaler

- **Les documents n'appartenaient à aucun projet.** Le store `useDocuments` **n'est plus persisté du
  tout** : le dossier du projet dit quels documents existent, le layout persisté dit lesquels sont
  ouverts.
- **`pnpm start` chargeait `out/renderer/`** au lieu du serveur Vite. `src/main/environment.ts` lit
  désormais `__DEV__`, injecté par `define` au build.
- **Un second registre de commandes** orienté menu natif avait été construit en parallèle du vrai.
  Supprimé. **Ne pas recommencer.**
- **`reconcile` ne parcourait pas l'arbre entier** dans le moteur canvas, ce qui détruisait les textures
  des enfants de groupe. **Ne pas le recasser.**
- **Un document dont le fichier a refusé de s'ouvrir ne s'enregistre plus du tout**, jusqu'à sa
  prochaine ouverture (le `Set` `unreadable` dans `app/document-io.ts`). C'est voulu : l'éditeur vide
  qu'une lecture ratée laisse est indistinguable d'un document neuf, et sans ce refus le premier ⌘S
  écrirait `{ nodes: [] }` par-dessus la scène illisible. **Ne pas lever ce refus.**
- **`applyDisplayMode` et `applyWireOverlay` ne portent pas le défaut de traversée des ombres.** Une
  revue l'a signalé comme un défaut jumeau ; c'en est un faux — le mode d'affichage est unique pour tout
  le viewport.
- **Ne pas retenter « n'épingler le geste que sur sa première commande »** pour l'undo : ça déplace la
  fenêtre de course au lieu de la fermer. Un champ ouvre son geste **au focus**, sans aucune commande, et
  une génération qui atterrit dans cette fenêtre silencieuse nommait le geste — après quoi plus rien ne
  fusionnait, soit une entrée par frame pour tout un glissement. **Le store ne peut pas inférer la
  provenance, il faut la lui dire** (`runOutsideGesture`).
- **Une demie est une demi-période, pas une demi-image.** `Matrix3.setUvTransform` pose l'offset **après**
  l'échelle. Une revue a affirmé le contraire ; trente secondes dans `node_modules/three` l'ont réfutée.
- **Mutualiser la file de promesses du BVH avec `catalog-client.ts`** : écarté. Les deux fichiers sont de
  part et d'autre de la frontière main/renderer, et les sémantiques divergent — le catalogue rejette à la
  fermeture, le BVH résout `null`.
- **`configure({ defaultHidden: true })` dans `test-setup.ts`** : mesuré à **33 %** de gain sur tout le
  dépôt, et refusé. Un bouton `aria-hidden` deviendrait trouvable par `getByRole` dans les quatre cents
  fichiers — un angle mort permanent.

## 12.3 Les pièges déjà payés

### three.js

- **`SpriteMaterial` naît transparent**, three l'écrase exprès : l'éteindre à pleine opacité fait
  dessiner le carré entier de toute image à canal alpha. Et **un `Sprite` n'est pas un `Mesh`** : toute
  branche de libération gardée par `instanceof Mesh` laisse fuir son matériau.
- **Un type de nœud ignoré du chargeur disparaît en silence.** **Tout nouveau type de nœud se teste par
  un aller-retour disque.**
- **`GLTFLoader` nomme chaque maille qu'il ramène**, donc le picking rendait `mesh_0` comme identifiant
  de nœud, écrivant un fantôme dans la sélection, l'historique et le document. `nodeIdOf` n'accepte plus
  qu'un nom que le moteur a lui-même posé.
- **Les exporteurs écrivent une transformation locale** : exporter une sélection imbriquée sans aplatir
  la place où elle est dans son parent.
- **La conversion rad→deg→rad n'est pas exacte** : diffé en radians, un axe intact était déclaré bougé à
  13 % près.
- **Un `SettingRow` de genre `number` refuse les décimales** — deux réglages de magnétisme étaient
  inatteignables. Un test verrouille la règle pour tout futur réglage.
- **Une ligne est touchée à un monde entier d'elle-même** (`Raycaster.params.Line.threshold` vaut 1) : la
  surcouche filaire portait un halo cliquable par arête.
- **Le picking d'un modèle importé est faux si le fichier entrelace ses attributs** : l'`array` d'un
  attribut entrelacé est le tampon **entier**. Et un **index en `SHORT`** fait prendre la géométrie pour
  non indexée.
- **Le gizmo et le trièdre sont bâtis sur la caméra du montage** : un passage en orthographique la
  remplace, ils se rebranchent tous les deux.
- **`GLTFExporter` et `USDZExporter` lèvent sur une texture compressée** au lieu de la sauter : les deux
  reçoivent un décodeur, **sur un renderer à eux, jamais celui du viewport** — `decompress` appelle
  `setSize` sur celui qu'on lui donne, et sans renderer en fabrique un à chaque appel.
- **`SkinnedMesh.copy` garde le squelette de l'ORIGINAL.** `SkeletonUtils.clone` est le seul clone qui
  relie une copie à ses propres os.
- **glTF n'a pas de cible de lumière.** `KHR_lights_punctual` lit le −Z du nœud.
- **Un helper de lumière porte l'identifiant de sa lumière**, il est donc posé dans le viewport **à côté**
  des nœuds, comme la grille, le trièdre et le gizmo.
- **Un zoom orthographique se dépense en distance** (`distance / zoom`), et **il n'est borné par rien** —
  `minZoom` vaut 0. La dépense est bornée à une demi-plaque des deux plans. Règle générale : **une valeur
  qu'on convertit d'un espace à un autre doit atterrir dans les bornes du second**, même quand le premier
  n'en a pas.
- **Déplacer une caméra orthographique ne change rien à ce qu'elle montre**, d'où `refit()`. Sur les six
  endroits de `src/` qui écrivent `camera.position`, `frameSelection` est le **seul** qui change la
  distance à la cible. Poser `refit()` dans le viewport à chaque déplacement serait le mauvais geste.
- **`TextGeometry` n'est pas employé** : il lit une police au format typeface de three, et le `TTFLoader`
  qui convertirait va chercher `opentype.js` sur un CDN, ce que la politique de la fenêtre interdit.
- **Les décodeurs Draco et KTX2 sont copiés depuis three au postinstall et servis depuis `public/`** — le
  chemin absolu qu'on croit naturel casse en `file://`.

### Pixi, filtres et pinceau

- **Un filtre isole ce qu'il filtre, et le blend du conteneur ne survit pas.** Pixi dessine un
  conteneur filtré dans une texture à lui, vidée d'abord, puis recompose avec le blend du **filtre**.
  Un stamp en `erase` sous filtre gomme donc **contre du vide** : la gomme cessait d'effacer, et par
  défaut, la dureté valant 0,8. D'où un adoucissement **réservé au pinceau**.
- **Un filtre travaille en pixels de surface, un rayon de pinceau en pixels de document.** Le filtre
  s'applique une fois la transformation du conteneur passée. Additionnées **avant** la projection, les
  deux marges donnaient sur un calque agrandi deux fois une boîte d'annulation deux fois trop petite,
  et l'undo laissait la frange. La marge s'ajoute **après** `mapRect`.
- **Le pas d'une taille de pinceau est un rapport, pas un nombre de pixels**, avec un plancher d'un
  pixel : l'arrondi immobilisait la touche en bas de l'échelle.

### Raccourcis et réglages persistés

- **Une garde de forme, jamais une liste.** `isSignature` lisait une liste des codes qui existent :
  elle en refusait quarante qu'un vrai clavier émet, `IntlBackslash` — la touche « < > » de tout
  AZERTY — en tête, et le refus **jetait le fichier de réglages entier**. Le pari n'est pas
  symétrique : un code refusé est une touche que personne ne peut lier ; un code accepté qu'aucun
  clavier n'émet n'est qu'un raccourci qui ne part jamais.
- **Une entrée illisible coûte sa ligne, jamais le fichier.** `overrides` filtre par entrée comme
  `home.sections`. Sans cela, une touche liée sous une version antérieure emportait le thème et le
  dossier de projets à la mise à jour.

### Skybox et export

- **Le haut de chaque face regardait le sol, et personne ne l'a vu.** `PlaneGeometry` écrit
  `vertices.push(x, -y, 0)` avec `v = 1 - iy / gridY`, donc **`v` vaut 1 en HAUT du quad** : un `t`
  qui descendait quand `v` montait visait le sol. Quatre des six faces sont un horizon, et **un
  horizon retourné reste un horizon** — rien à l'écran ne le disait. Le remède est structurel :
  `faceDirection` est **généré depuis `FACE_BASES`**, comme la croix l'est depuis `CROSS_CELLS`. **Une
  seconde table écrite en GLSL est une table que rien ne vérifie.**
- **Pas de tone mapping à l'export, et c'est un choix.** Le contexte hors écran n'en a pas par
  défaut ; un moteur applique le sien, et le cuire dans le fichier le ferait appliquer deux fois.
  L'aperçu et le PNG diffèrent donc volontairement — les deux manuels le disent.
- **`loadSource` force `colorSpace = NoColorSpace`** : juste pour un canal PBR, **faux pour un ciel**,
  qui est une couleur. Le port le remet à `SRGBColorSpace` + `needsUpdate`, sinon le grading travaille
  sur des nombres sRGB et la sortie les encode une seconde fois. **`needsUpdate` est un setter en
  écriture seule dans three** : ce qui s'observe est `version`.
- **Un export grade à la résolution de la source**, pas à celle de l'aperçu : le viewport passe par un
  target 2048×1024 pour l'IBL, et l'export ne le traverse pas. Une seule passe de grading pour les six
  faces, un seul décodage.
- **Écrire plusieurs fichiers dans un dossier n'appartient plus aux textures** : `main/export/`, deux
  canaux (`texture:export`, `skybox:export`) sur un seul corps, `ExportedFile` /
  `FolderExportRequest`. Le validateur zod était déjà générique.
- **Un test « le garde a refusé » doit s'ancrer sur le message**, jamais sur l'absence d'effet : en
  jsdom, un export qui aurait franchi le garde échouerait aussi, et le test passerait des deux façons.

### Textures et GPU

- **Ne jamais poser `needsUpdate` sur une texture pour la déplacer.** Il incrémente aussi
  `source.needsUpdate` : three réuploade les pixels ET reconstruit les mips — huit canaux 2K, 128 Mo par
  frame. `matrixAutoUpdate` suffit ; seuls `wrapS`/`wrapT` sont de l'état d'upload.
- **Le contexte hors écran est prémultiplié, et `alpha: false` ne l'atteint pas.** three met
  `premultipliedAlpha: true` par défaut. Une passe qui écrit des valeurs droites se fait diviser par son
  alpha à `toBlob`. **Toute passe future qui écrit un alpha qui varie dépend de cette ligne.**
- **Un `ShaderMaterial` à fragment maison n'est pas encodé en sortie** : `colorspace_fragment` ne vit que
  dans les shaders de `ShaderLib`.
- **Le plafond de seize contextes WebGL ne fait pas échouer une dérivation** — le navigateur **évince le
  plus ancien**, donc ce qui noircit est un viewport ouvert. D'où « une seule à la fois ».
- **Le masque de cavité n'a aucun slot** dans `MeshStandardMaterial` : uniform à lui, propre matrice d'uv,
  define `USE_UV` — three n'émet jamais `USE_UV` lui-même (il génère `USE_UV1/2/3`), donc aucune
  collision.
- **Les noms de chunks de three sont vérifiés par un test** (`material-shader.test.ts`) : un renommage
  amont fait rougir un test au lieu d'un écran.
- **glTF ne porte ni déplacement ni pivot** : pas de `displacementMap`, et `KHR_texture_transform` n'a pas
  de champ de pivot — `GLTFExporter` ne lit jamais `texture.center`.
- **Roblox refuse une carte au-delà de 1024 px.** Le seul plafond, et il ne vient pas de nous.
- **Un export est un dossier, pas un fichier**, et `mkdir` n'en vide aucun : ré-exporter écrase fichier par
  fichier et laisse les périmés. Dit au manuel plutôt que corrigé — vider le dossier de quelqu'un est un
  geste qu'on ne prend pas seul.
- **Une sphère à rugosité 1 sous un IBL uniforme paraît plate, et rien n'est cassé.** Juger un IBL demande
  un matériau qui réfléchit.

### Polices

- **Le main lit la table `name` par plages, jamais le fichier entier** : 267 familles en 200 ms, là où une
  lecture entière coûterait 192 Mo rien que pour `Apple Color Emoji.ttc`.
- **Une longueur non bornée lue dans un fichier de police tue le processus main.** L'assertion native de
  Node passe sous tout `catch` : un seul fichier corrompu dans `~/Library/Fonts` empêchait le studio de
  démarrer.
- **`opentype.js` refuse la signature `ttcf`**, or macOS livre l'essentiel de ses polices en collections.
- **Un nom de police est localisé** — sans préférence pour l'anglais, la police système d'Apple s'offrait
  sous le nom « Tipus de lletra del sistema ».
- **89 % des polices d'une machine Apple se parsent**, pas 100.

### Recherche et i18n

- **Une recherche ne réclame jamais l'accent, et deux mécanismes distincts le tiennent.** Ne pas router
  l'un vers l'autre : **en mémoire** → `foldForSearch` (`shared/text.ts`), **jamais `toLowerCase`** ;
  **dans SQLite** → le tokenizer FTS5 `unicode61 remove_diacritics 2`, rien à plier côté JS. Le fold JS
  **décompose en NFD d'abord** — **macOS livre ses noms de fichiers en forme décomposée**, donc un asset
  déposé depuis le Finder ne répondait pas à son propre nom retapé dans le studio.
- **La recherche texte ne trouve plus au milieu d'un mot**, c'est le prix du FTS5 et il est volontaire.
  La ponctuation seule retombe sur le `LIKE`. Et **SQLite recycle les rowid**, ce qui rend le trigger de
  suppression nécessaire.
- **`model-text.fr.json` s'indexe sur le texte anglais et non sur une clé** — la moitié de ce que le
  panneau montre est une phrase écrite par le modèle. Le repli est la phrase anglaise, jamais une clé.
- **Une chaîne qui est aussi une donnée n'est pas un libellé.** Un port de nœud sans nom affiche son
  **type**, et c'est cette chaîne que la vérification de connexion compare. Même raison pour laquelle
  `name` et `message` sont hors surveillance des gardes de texte en dur.
- **Neuf gardes i18n, et deux conventions de nommage** : six en `*.i18n.test.ts`, deux en
  `no-hardcoded-text.test.ts`, plus `bundles.test.ts`. **`grep` sur le sujet, pas sur le motif** — une
  session a cherché sous le mauvais motif et réécrit un doublon complet.

### API Scenario

- **La convention d'arête est INVERSÉE**, et c'est le piège qui coûterait le plus cher. Si l'éditeur est
  câblé dans le sens intuitif, `convertWorkflowEditorToFlow` produit un graphe retourné et **tout export
  vers Scenario est faux** — sans erreur, sans avertissement.

      // edge convention: `{ source: consumer, target: provider }` — an input handle
      // on `source` reads an output handle on `target`.

  | | Côté écran | Champ React Flow | Ce que c'est |
  |---|---|---|---|
  | **Sortie** d'un node (le producteur) | droite | `target` / `targetHandle` | `outputHandles` |
  | **Entrée** d'un node (le consommateur) | gauche | `source` / `sourceHandle` | les inputs du modèle |

  **Vérifié sur données réelles** : `{ source: 'imageGenerator1', target: 'image1' }` pour une arête qui
  alimente le générateur depuis l'asset. C'est écrit dans `NodePorts.tsx`, là où l'inverser se paierait.
- **Les conventions de nommage, à copier telles quelles** — handle
  `` `${nodeId}-${'source'|'target'}-${fieldName}` `` ; sorties d'un `forEach`
  `` `${nodeId}-output-${n}` `` ; nom de sortie par défaut `output` ; id de node
  `` `${typeCamelCase}${index}` ``.
- **Deux vocabulaires de nodes, et un mapping 1:1 n'existe pas.** Exécution : **10** types. Éditeur :
  **15**. `stickyNote` n'existe pas à l'exécution ; la paire `forEach`/`forEachEnd` se compile en un seul
  `for-each`. **Le tableau du guide n'en liste que 7 et il est incomplet** — c'est le type du SDK qui fait
  foi.
- **`"workflow"` est réservé dans `ref.node`** — il désigne les inputs du workflow parent, donc **ne
  jamais nommer un node `workflow`**.
- **Scenario a publié le compilateur de son propre éditeur visuel** (`convertWorkflowEditorToFlow`,
  `validateWorkflowFlow`, `validateEditorInfo`). **Ne pas écrire de compilateur.** L'évaluateur CEL vit
  dans `@scenario-labs/sdk/tools/cel` et ne coûte aucune dépendance nouvelle.
- **Le dry run répond `200`, pas `402`** — sur `generate.runModel` comme sur `workflows.run`. Le corps
  porte `creativeUnitsCost`. Le 402 documenté n'a **jamais** été observé et n'est gardé qu'en repli.
- **Un job de workflow facture `cuCost: 0`.** La charge est sur ses **sous-jobs**. Un `cuCost` nul sur un
  job de **workflow** vaut absence de prix ; sur une génération il vaut gratuit, et il s'affiche.
- **Les statuts et la progression : le SDK dit vrai, le guide en prose a tort.** Tranché à l'observation
  le 9 août 2026 en lançant une App : `queued` → `in-progress` → `success`, progression en **0–1**,
  `metadata.assetIds` **peuplé**. **Ne pas rouvrir la question.**
- **Un statut inconnu vaut `running`** (et `ready` pour une App, pas `draft`) : refuser ce qu'on ne
  reconnaît pas rendrait toutes les Apps inertes le jour où Scenario écrirait `published`.
- **Le seuil de normalisation de la progression est 2, pas 1** — une génération dépasse sa propre échelle
  (un job rapporte 1.02), si bien que diviser dès 1 faisait retomber la fin de chaque génération à 1 %.
- **Les sorties d'un job de workflow** se lisent d'abord dans `metadata.assetIds`, et seulement s'il est
  vide en aplatissant `metadata.flow[].assets[]`. **Les deux à la fois importeraient chaque image
  intermédiaire comme un résultat.**
- **Un appel réel vaut mieux que quatre relectures** — c'est la troisième fois que le sujet l'apprend. Le
  port d'un nœud texte est `-target-prompt` de type `text`, **pas** `-target-text` ; une note porte son
  texte sous `content`, **pas** `value` ; et **tout** nœud porte un port conditionnel, la note comprise.
  `workflow_publish` **existe** côté MCP, contrairement à ce qui avait été écrit.
- **La famille `skybox` ne se déduit pas des capacités** : l'énumération n'a **aucune** valeur skybox, et
  les trois modèles publics répondent `txt2img` et `img2img`. Le tag **`sc:skybox`** est le seul signal
  qui existe.
- **La limite de débit est 100 requêtes par minute et par projet.** Le limiteur est une **fenêtre
  glissante, pas un seau à jetons** — un studio inactif peut légitimement en dépenser cent d'un coup.
  **95, pas 100** : le studio compte quand il lâche, l'API quand elle arrive. **Le passage obligé est le
  `fetch` du client SDK**, injectable par `ClientOptions.fetch`. Un appelant tenu longtemps se voit
  répondre un **429 de synthèse** portant `retry-after-ms` — **lever une erreur ne marche pas**, le SDK
  remballe tout en `APIConnectionError`. L'horloge est **monotone**. Les téléchargements d'assets n'y
  passent pas.
- **Le polling se règle sur ce qu'il a le droit de dépenser** : `max(2 s, jobs × 60 s / 75)`. Sans cela,
  au-delà de quatre jobs une génération **vivante et payée** était rapportée en « échec — limite de
  débit ».
- **Une note de job ne part que si l'API a conclu.** Un échec **local** (réseau, clé indisponible, disque)
  garde la note ; seuls un refus de l'API, une annulation prise et une collecte réussie l'effacent. **Un
  fichier illisible n'est pas un fichier vide** : absent rend `[]`, illisible **refuse l'écriture**.
- **Un job ne collecte que dans son propre projet**, et **le compte est nommé par une empreinte de sa
  clé**, pas par l'id du carnet.

### Tests et outillage

- **Deux sessions ne peuvent pas lancer `pnpm test:coverage` dans le même clone en même temps, et la
  collision RESSEMBLE À DES TESTS ROUGES.** `coverage.reportsDirectory` est un chemin unique du dépôt.
  **Devant un rouge sous couverture, relancer `pnpm test` sans elle avant de chercher une cause dans le
  code.**
- **Un rouge ne se croit pas sur parole.** Le 9 août, une passe a rendu 26 échecs d'assertion sur 5
  fichiers ; la passe suivante, sans un seul changement, est repassée verte de bout en bout. **Relancer
  une fois avant d'ouvrir une enquête**, et ne conclure à une régression que si le second passage rougit
  au même endroit.
- **Un projet vitest n'hérite pas du bloc `test` de la racine.** `TEST_TIMEOUT` est nommé et répété dans
  les deux projets, où il compte. Un réglage qui semble global dans un fichier de configuration à projets
  ne l'est pas.
- **Chercher par label, puis vérifier le rôle sur l'élément trouvé (`toHaveRole`)**, plutôt que chercher
  par rôle et par nom. Le panneau des raccourcis rend **171 boutons**, et `getByRole(…, { name })`
  redérive le nom accessible de chacun — un rendu complet coûte 230 ms, un seul de ces appels en coûtait
  3 600.
- **Les deux projets ont aussi deux `tsconfig`, et `vitest run` n'est pas `pnpm validate`.** Une suite
  verte ne dit rien du typecheck : la porte est `pnpm validate`, en entier, **après** la fusion comme
  avant.
- **Une porte de couverture ne voit pas ce qu'une mutation voit.** Vider entièrement le corps de
  `frameSelection` laissait **1786 tests verts**. **Une méthode qui sort tôt sur une dépendance que jsdom
  ne peut pas fournir est un angle mort structurel.**
- **Un test peut passer pour une raison qui n'est pas la sienne**, et **un carré passe un test d'axes** :
  toute assertion sur deux axes prend deux valeurs différentes.
- **Le MCP `electron` ne peut pas prouver un glisser HTML5** — `electron_drag_from_to` envoie des
  événements souris, dont Chromium ne démarre aucun glisser. C'est le CDP direct qui tranche. Aucun clic
  du MCP ne porte de modificateur non plus.

## 12.4 Performance — les mesures acquises

**Trois audits, tous menés le 7 août 2026** sur Apple M2 Max / macOS 26.5.2, en **build de production**.
**Ne pas refaire ces mesures.**

### Les six chiffres à ne pas redécouvrir

1. **8,33 ms** — le budget par frame du renderer sur un écran 120 Hz. C'est le chiffre qui compte, pas les
   16,7 ms d'un écran 60 Hz.
2. **16 ms** — au-delà, une opération synchrone dans le **main** gèle TOUTES les fenêtres, y compris les
   détachées.
3. **React ne pèse rien en production** (0,15 ms/frame, 4,5 % du CPU occupé) et **huit fois plus en dev**.
4. **Le navigateur coalesce déjà les `pointermove`** : 600 événements injectés en 44 ms, 7 reçus. Il n'y a
   rien à coalescer dans un rAF.
5. **Le catalogue franchit les 16 ms vers 100 000 assets** et atteint 44 ms à 200 000.
6. **⌘S gèle toutes les fenêtres au-delà de ~5 500 nœuds.**

**Une optimisation non mesurée est une complexité gratuite.** L'audit 3D est le cas d'école : cinq pistes
de revue, cinq réfutées par la mesure, **zéro ligne changée**.

### Audit 1 — le chemin chaud de l'inspecteur 3D : ce n'en est pas un

Scène au pire cas légal : sphère 128 × 128 (~16 000 sommets), cinq panneaux ouverts, 300 frames.

| Scénario | CPU occupé / frame | % du budget 8,33 ms | Frames > 16,7 ms |
|---|---|---|---|
| Position X, 1 maille | 1,85 ms | 22 % | **0 / 299** |
| Segments 68↔128 | 2,18 ms | 26 % | **0 / 299** |
| Rayon, 1 maille | **3,31 ms** | 40 % | **0 / 299** |
| Rayon, 50 mailles | 3,81 ms | 46 % | **0 / 299** |
| Rayon, 1 maille, **dev** | 6,57 ms | 79 % | 0 / 299 |

Les cinq pistes de revue, réfutées une à une : rien à coalescer (rapport 1,00) ; mémoïser l'inspecteur ne
peut pas rapporter plus que les 0,15 ms de React ; `runCoalescing` coûte **0,0005 ms** ; passer de 1 à 50
mailles coûte +0,010 ms par maille, il en faudrait ~500 pour saturer ; `TextureField` et son `find`
linéaire coûtent 0,0167 ms sur 2 000 assets.

**Reproduire :**

```bash
pnpm exec electron-vite build
pnpm exec electron . --remote-debugging-port=9334 \
  --disable-backgrounding-occluded-windows \
  --disable-renderer-backgrounding \
  --disable-background-timer-throttling
```

Sans les drapeaux, Chrome suspend le `requestAnimationFrame` d'une fenêtre occultée et il n'y a plus rien
à mesurer.

### Audit 2 — le catalogue quitte le thread principal

Coût d'une requête, driver de production `better-sqlite3` :

| Assets | par type | texte sans résultat | deux tags | première page | par id |
|---|---|---|---|---|---|
| 1 000 | 0,15 ms | 0,44 ms | 0,12 ms | 0,14 ms | 0,004 ms |
| 10 000 | 1,69 ms | 1,32 ms | 0,75 ms | 0,48 ms | 0,004 ms |
| **100 000** | **15,17 ms** | **22,53 ms** | 7,69 ms | 0,49 ms | 0,004 ms |
| **200 000** | **33,73 ms** | **43,82 ms** | **20,49 ms** | — | — |

Blocage mesuré dans l'application, 100 000 assets, seize recherches lourdes :

| | AVANT (dans le main) | APRÈS (sur son thread) |
|---|---|---|
| Sondes | 16 687 | 32 297 |
| Pic maximal | **22,1 ms** | **8,4 ms** |
| **Sondes au-dessus de 16,7 ms** | **16** | **0** |

Trois décisions : **un thread, pas un pool** ; **tout le catalogue part, pas seulement `search`** ; **le
client rejette ce qui est en vol si le thread meurt**. `catalog.ts` n'a pas changé d'une ligne — c'est ce
que le port `SqliteDriver` rendait possible.

**La recherche n'est pas devenue plus rapide — ce n'était pas l'objet.**

### Audit 3 — enregistrer et rouvrir un document 3D

Coût complet d'un ⌘S sur le thread principal. Un `invoke` fait traverser un **objet**, pas un texte :
`ipcMain` en décode le clone structuré sur le thread principal avant d'appeler le handler.

| Nœuds | Total main | dont `JSON.stringify` | part du décodage | % du seuil de 16 ms |
|---|---|---|---|---|
| 50 | **0,130 ms** | 0,038 ms | 71 % | 1 % |
| 500 | 1,41 ms | 0,364 ms | 74 % | 9 % |
| 5 000 | 14,6 ms | 3,90 ms | 73 % | 91 % |
| 10 000 | 29,4 ms | 7,92 ms | 73 % | 184 % |
| 50 000 | 163 ms | 39,9 ms | 76 % | 1019 % |

Franchissement des 16 ms : **≈ 5 500 nœuds**. **C'est la plus petite moitié qui a été optimisée** : le
décodage pèse presque trois fois la sérialisation et n'est traité nulle part (§ 7).

**Reproduire :** `pnpm bench`. Aux grandes tailles les mesures sont dominées par le GC (`rme` jusqu'à
20 %) : la colonne à retenir est le **minimum**.

> **Le studio sait chiffrer une frame 3D** (`engines/viewport/gpu-stats.ts`) : appels de dessin,
> triangles, points, lignes, plus les géométries et textures encore vivantes. Deux pièges payés à
> l'écriture — three.js remet `info` à zéro en tête de chaque `render`, et la passe d'overlay **rappelle
> `render`** ; d'où `autoReset = false` et un `frames` compté à la main.
