# Scenario Studio — reprise

**Le document de travail du projet.** L’état, ce qu’il reste à faire, les savoirs qui coûteraient une
seconde fois, les mesures acquises. Vérifié dans le code le 9 août 2026 au soir, contre `develop`
à **`dcfc207`** — le sha est là pour que la passe suivante sache d’où reprendre le delta
(`git log --oneline dcfc207..develop`) au lieu de relire mille lignes.

Trois fichiers se partagent le travail, et aucun ne redit ce qu’un autre porte :

| Fichier | Ce qu’il tient |
|---|---|
| **`CLAUDE.md`** (racine) | les conventions et les invariants : langue, worktrees, rebase, definition of done, style, architecture |
| **`docs/INTERFACE.md`** | ce qui se juge à l’écran : retours, règles de disposition, protocole de vérification visuelle, captures attendues |
| **ce fichier** | l’état du chantier et ce qui reste — jamais le récit d’une correction, qui appartient au message de son commit |

> **La branche de référence est `develop`.** Elle intègre les features au fil de l’eau ; `main` ne
> reçoit que des merges de release. Ce document décrit **ce qui est sur `develop`**, donc en avance
> sur la dernière version publiée : un écart avec un binaire installé n’est pas une erreur du texte.

Pour *comprendre* le logiciel plutôt que reprendre son développement :
[guide de l’utilisateur](fr/guide-utilisateur.md) et [architecture](fr/architecture.md), également
[en anglais](en/).

## Le prompt de reprise

À coller tel quel dans une session neuve. **Le mettre à jour en même temps que le § 3 quand un
chantier est livré**, sinon il envoie la prochaine session refaire ce qui est fait.

> Je reprends le développement de **Scenario Studio**, dans `/Users/pasquelin/Applications/scenario`.
>
> Lis `docs/REPRISE.md` en entier, puis `CLAUDE.md`. **Ne refais pas les mesures du § 6** : leurs
> conclusions sont acquises. Puis `git log --oneline -15`, `git worktree list` et `pnpm validate`
> pour partir d’une base verte.
>
> **Si tu touches à l’interface, lis aussi `docs/INTERFACE.md`.** Il est commité sur `develop`, donc
> un worktree neuf le contient ; **il s’édite quand même dans le dépôt principal**,
> `/Users/pasquelin/Applications/scenario/docs/INTERFACE.md`, sans quoi chaque branche tient sa
> propre version des retours et elles divergent.
>
> **Ce qui vient d’être livré — ne le refais pas.** Le **canvas du node editor**, étape 6 du § 4,
> monté nulle part (`feat/workflows`) · **l’accueil** et ses onze bandes, avec « en refaire une
> avec… » (`feat/home`, `feat/home-creations`) · les trois accès clavier — Explorateur, double-clic
> qui traverse les espaces, étagère à assets et sa sélection multiple (`feat/explorateur-clavier`,
> `feat/double-clic`, `feat/etagere-clavier`) · les **dérivations en shader des Textures**
> (`feat/textures-derive`) · le **formulaire de génération traduit** sans rien écrire par modèle
> (`feat/i18n-schema-api`) et le **rapport d’usage** avec lui (`feat/i18n-usage`) · le prix d’une
> génération, avant et après
> (`feat/workflows`) · six passes i18n et les trois gardes de texte en dur (`feat/i18n-*`) · le
> pinceau à taille réglable (`feat/pinceau`) · le panneau matériau et la bande de canaux des
> Textures (`feat/textures-materiau`). Le détail est au § 1.
>
> **Propose-moi un ordre et attends ma réponse** avant d’ouvrir un worktree. Les candidats, sans
> priorité imposée : l’**étape 8 des Textures** (§ 3.4) · le **backlog qualité P1**
> (`.claude/loop/BACKLOG.md`, dont les statuts ont déjà menti trois fois : vérifie avant de prendre)
> · les **13 constats du § 3.3** et l’export en six faces du skybox (§ 3.5) · les **dettes
> transverses** du § 3.6.
>
> Cinq règles qui ne sont pas dans `CLAUDE.md` :
>
> - **Pose les questions avant d’attaquer. N’invente jamais** : si un choix de conception se
>   présente, demande.
> - **Aucune dépendance nouvelle sans mon accord.** Les tests e2e (Playwright) sont reportés à la
>   fin du projet, c’est décidé.
> - **`git worktree list` avant d’ouvrir quoi que ce soit** : plusieurs sessions travaillent en
>   parallèle, ne prends pas un sujet déjà tenu.
> - **Mets la doc à jour** quand le code change ce qu’elle affirme — manuel fr *et* en, et ce
>   fichier. Un grep sur les tournures de manque (« ne sait pas », « pas encore », « aucun bouton »)
>   trouve en trente secondes ce qu’aucune fusion ne signalera.
> - **Ce fichier est une reprise, pas un journal.** N’y écris que ce qui coûterait une seconde fois.

Si la demande touche l’API Scenario : `docs/scenario-api/README.md`, 209 pages aspirées en local,
**à consulter avant le web**. La conception validée est dans
`docs/specs/2026-08-06-scenario-studio-design.md`, 13 sections — la seule spec qui reste, celles de
la configuration et de l’espace 3D ayant été supprimées une fois leurs chantiers livrés.

> `docs/specs/`, `docs/scenario-api/` et `docs/superpowers/` sont **ignorés par git**. Un document
> qui compte et qui atterrit dans l’un des trois est invisible du dépôt et absent de tout worktree
> neuf. **Ce qui doit survivre à la session vient ici, et est commité.**

---

# 1. L’état

**975 fichiers dans `src/`, dont 388 de test** (relevé le 9 août au soir, sur `develop` ; `pnpm test`
en exécutait alors **4874 cas**, verts — les `it.each` en portent plusieurs chacun, donc aucun de ces
nombres ne se lit dans un fichier). **Six espaces éditables, les six genres de documents s’enregistrent**, et fermer un onglet
demande avant de perdre quoi que ce soit. L’application démarre par `pnpm start`.

## Le budget de couverture, qui est la porte du projet

`pnpm validate` est vert, **budget compris** : il lance `test:coverage`, dont les seuils sont des
**budgets d’éléments non couverts** par glob (`vitest.config.ts`), pas des pourcentages.

| Glob | État | Marge |
|---|---|---|
| `engines/{scene,skybox,viewport,texture,gpu}/**` | 232 / 310 branches | 78 — ce qui reste dessous est du WebGL que jsdom n’exécute pas |
| `engines/{timeline,canvas,audio,core}/**` | 242 / 250 | **8 — c’est lui, le tendu** |
| `main/diagnostics/**`, `renderer/src/services/**` | **zéro** | le canal qui dit les échecs : une branche que personne n’exerce y serait un échec que personne ne lirait |
| `renderer/src/app/**`, `panels/**` | **aucun budget** | c’est ce qui a laissé cinq fichiers neufs y atterrir sans qu’aucun seuil ne bouge |
| `src/main/project/**` | 115 / 115 statements | **nulle**, et `document-io.ts` à une branche près |

**Couvrir avant d’élargir** ; le commentaire du fichier dit le seul cas où élargir est légitime (un
glob dont la marge de croissance est du GPU intestable).

> **Un grain de sable environnemental : les tests lents dépassent leur budget de 5 s quand la machine
> porte plusieurs sessions** — des sous-ensembles différents à chaque passage, verts en isolation.
> Ce n’est ni un seul fichier ni une seule cause : `LicencesWindow.test.tsx` pilote `userEvent`, qui
> est lent, mais `renderer/src/eager-graph.test.ts` est tombé le 9 août et construit un graphe
> Rollup, sans `userEvent` — relancé seul, il passe en 4,93 s. **La marge est le sujet, pas le
> fichier.** Devant un échec de ce genre : `vitest run <le fichier>` en isolation, ou
> `vitest run --coverage --maxWorkers=2` pour toute la passe, avant de chercher une cause dans le
> code.
>
> **Deux fichiers ont été mesurés et réglés, et c’est un motif, pas deux accidents.**
> `ShortcutsSettings.test.tsx` (`0d59c57`) rend l’arbre le plus lourd de la suite — 115 boutons
> dont le nom accessible est redérivé à chaque appel — et tenait **1,0 s au repos contre 4,8 s sous
> charge**, pour un plafond à 5 s. `known-keys.i18n.test.ts` (`0dc2c8f`) relit à la source chaque
> fichier du renderer pour en extraire les clés nommées, et flanchait **deux fois sur trois passes**
> sous `--coverage`. Les deux passent à 20 s.
>
> D’où un `pnpm validate` vert seul et rouge en suite complète, sans qu’une ligne de production ait
> bougé : la pire façon pour une suite d’avoir tort, puisqu’elle **accuse le dernier commit venu**.
> **Un plafond de temps qu’une machine chargée fait franchir n’est pas une garde, c’est un
> générateur de fausses accusations** — et une garde qui clignote finit par être désactivée, alors
> que celle-ci est précisément ce qui empêche une clé d’atteindre l’écran sans traduction. Le
> réflexe est donc : **mesurer au repos et sous charge, relever le plafond de ce fichier-là, et ne
> jamais toucher à l’assertion** — c’est elle qui vaut d’être gardée, et c’est elle qui est lente.
>
> **Et ce grain-là ne se présente pas toujours comme un dépassement de temps.** Le 9 août au soir,
> une passe a rendu **26 échecs sur 5 fichiers** — des **échecs d’assertion**, pas des timeouts,
> dont un `toBe` d’identité dans `stores/tools.test.ts` qui compare une constante à elle-même.
> **La passe suivante, sans un seul changement, est repassée verte de bout en bout** (378 fichiers,
> 4771 cas, `EXIT=0`). Un rouge de ce genre ne se croit donc pas sur parole : **relancer une fois
> avant d’ouvrir une enquête**, et ne conclure à une régression que si le second passage rougit au
> même endroit.

## Ce qui est fait

**Le socle** — Electron + electron-vite + React 19 + TypeScript, shell à docks type IDE, design
system maison (`renderer/src/design/`), i18n fr/en partagé entre le menu natif et l’UI, contrat IPC
typé des deux côtés, `contextIsolation`/`sandbox` actifs, navigation verrouillée.

**La chaîne de génération** — réglages chiffrés par `safeStorage`, client `@scenario-labs/sdk` dans
le main, `ModelRegistry` avec auto-pagination et cache, `JobManager` qui poll seul et borne la
concurrence, `DynamicForm` construit depuis les descripteurs et chargé paresseusement, zod avec lui.
Aucun formulaire de génération écrit à la main (invariant 5).

**Et il se dit en français.** L’API ne connaît aucune langue — ni `Accept-Language`, ni locale sur
`models.retrieve` —, donc le texte qu’un modèle publie pour ses entrées est traduit ici ou nulle
part. `model-text.fr.json` est **le seul dictionnaire du studio indexé sur le texte anglais et non
sur une clé** : la moitié de ce que le panneau montre est une phrase écrite par le modèle, et
indexer sur la clé traduirait « Max splat points » en laissant sa description en anglais dessous.
Le repli est la phrase anglaise, jamais une clé — un libellé changé côté Scenario dégrade vers
l’écran d’avant. Le vocabulaire du métier (`seed`, `guidance scale`, `sampler`, `CFG`) reste en
anglais **et un test tient la liste**. Appliqué au rendu, pas à la construction des descripteurs :
changer de langue redit le formulaire ouvert, et les Apps en profitent sans une ligne.

**Le rapport d’usage, lui, ne relève pas du même outil**, et c’est la distinction à ne pas
manquer : ses actions et ses genres d’assets sont deux **unions fermées** que l’API documente, donc
une clé de bundle par valeur et une garde exhaustive dans `bundles.test.ts`. Le dictionnaire par
texte source est pour ce qui change à chaque modèle publié ; une liste fermée mérite une garde qui
rougit.

**Et un troisième cas ne se traduit pas du tout.** Les ports d’un nœud de workflow passent leur
**nom** par le même dictionnaire (`useModelText`, pas une seconde table) — mais un port sans nom
affiche son **type**, `image` ou `video`, et cette chaîne-là est ce que la vérification de
connexion compare. Traduite d’un côté de l’arête et pas de l’autre, elle ne dit plus si deux ports
vont ensemble. **Une chaîne qui est aussi une donnée n’est pas un libellé** — même partage que
`name` et `message` dans les gardes de texte en dur. Le tableau qui départage les trois est dans
`fr/architecture.md`, § Internationalisation.

**Le prix, avant et après** — `main/scenario/cost.ts` tire l’estimation d’un `?dryRun=true`, qui
**répond 200** avec `creativeUnitsCost` dans le corps ; le 402 que documente la référence est gardé
en repli et n’a jamais été observé. `useCostEstimate` la tient à jour sous le bouton Générer,
débounce plus plancher partagé avec le polling du `JobManager`. Le coût réel se capte à la
soumission **et à chaque poll** — c’est là qu’un job repris trouve le sien. Un job de workflow fait
exception : il facture 0 sur lui-même, ses nœuds portent la charge, et ce zéro-là ne s’affiche pas
(§ 4.5).

**Les projets** — un dossier, un manifeste, un catalogue SQLite. Le catalogue tourne sur son propre
`worker_threads` : de 16 blocages du thread principal à 0 (§ 6).

**Les six espaces** — Image (PixiJS), 3D (three.js), Vidéo (timeline, moniteur, ffmpeg), Audio,
Skyboxes, Textures. Un éditeur par type de document, chargé à l’ouverture, jamais avant.

**L’espace Image édite pour de bon** — calques, groupes, masques, seize modes de fusion, sélection
qui borne les outils, poignées de transformation, formes, texte, calques de réglage, cinq éditions IA
et l’export PNG. Une image de l’étagère y entre par trois portes : le dépôt sur la toile, le
double-clic, et l’outil Image… (`⇧⌘K`). **Il s’ouvre sur le pointeur, jamais sur le pinceau** : le
premier clic sur une image ne doit pas pouvoir y laisser une trace.

**La configuration** — un registre de commandes unique lu par le menu natif, le clavier et l’écran
des raccourcis ; un registre de réglages qui gouverne les préférences et la validation côté main.

**La persistance des documents** — écriture atomique, marque « modifié », puce sur l’onglet,
relecture à l’ouverture. `IO_BY_KIND` est un `Record` complet — seule liste qui fasse foi — et un
test itère `DOCUMENT_KINDS` pour le verrouiller.

**Les trois gardes de texte en dur**, qui se partagent l’arbre sans se recouvrir :

| Garde | Ce qu’il tient |
|---|---|
| `renderer/src/no-hardcoded-text.test.ts` | les `.tsx` : texte entre balises, **accolades, branches**, attributs |
| `main/no-hardcoded-text.test.ts`, § « the main process » | les dialogues natifs, **et les `label` du menu** |
| `main/no-hardcoded-text.test.ts`, § « the registries » | les `.ts` de `renderer`, `shared` et `preload` |

Le troisième est le moins évident et le plus utile : un descripteur de champ, une définition d’outil,
une ligne de réglage ne sont ni un composant ni un dialogue — et c’est précisément là qu’un libellé
habite. Il distingue une clé d’un mot : `label: 'skybox.exposure'` passe, `label: 'Exposure'` non.
Quatre choses à savoir avant d’y toucher :

- le premier attrape désormais **`{ok ? 'Chargement…' : 'Rien à montrer'}` et `{raté && 'Une erreur'}`** —
  la forme qu’on écrit quand on remplace un `t(…)` par une chaîne. La récursion s’arrête aux
  opérateurs logiques : entrer dans un `===` ferait sonner les huit `side === 'left'` du renderer ;
- **le second vit dans `main/` alors qu’il surveille le renderer** : il lit l’arborescence sur le
  disque, or `src/shared/` est compilé pour le web aussi, où `node:fs` n’a ni types ni raison d’être.
  Le poser dans `shared/` casse `pnpm typecheck` ;
- **`name` et `message` sont hors surveillance, délibérément** : un nœud de scène porte un `name`
  comme **donnée de document** (une scène dont le contenu s’appelle `Groupe` ne s’échange pas avec un
  studio anglais), et `message` nomme l’échec d’un worker, jamais un écran ;
- **le fichier s’appelle `no-hardcoded-text`, pas `*.i18n.test.ts`.** Une session l’a cherché sous le
  second motif, ne l’a pas trouvé, et en a réécrit un doublon complet. **Neuf gardes i18n, et deux
  conventions de nommage** depuis que `model-text` a rejoint `*.i18n.test.ts` : six sous ce motif,
  deux en `no-hardcoded-text.test.ts`, et `bundles.test.ts` qui tient les clés composées. `grep`
  sur le sujet, pas sur le motif.

**Le manuel utilisateur** — 19 chapitres, fr et en (`docs/fr/manuel/`, `docs/en/manual/`). Il ne se
relit pas, il **se vérifie** : les registres (`COMMAND_REGISTRY`, `IMAGE_TOOLS`, `UNBUILT_TOOLS`,
`TOOL_PLACEMENTS`, `IO_BY_KIND`) et le bundle i18n disent ce que le logiciel fait — l’impression
qu’on en a, non.

> **Cette méthode a rattrapé une inversion complète.** `feat/panels-layout` a échangé les deux
> colonnes, et le manuel a continué pendant plusieurs fusions à envoyer le lecteur chercher chaque
> panneau du mauvais côté — 24 passages dans chaque langue. **Un merge qui déplace une surface
> visible n’est pas fini tant que les deux manuels ne l’ont pas suivi.** Si tu renommes un libellé,
> `grep` les deux manuels dans le même mouvement.

**La bibliothèque du compte** — badges d’emplacement recalculés par `assetBadgeOf` (jamais stockés :
ils dépendent du compte actif), envoi d’une sélection, facette « Emplacement », menu contextuel qui
**liste** les destinations d’un asset. Le transfert n’a qu’un sens aujourd’hui — cf. § 3.6.

**Le journal d’activité** — `main/project/activity-log.ts`, liste filtrable par niveau et par sujet,
compteur dans la ligne d’état, bulles. Deux décisions verrouillées par le code : **seuls les échecs
font une bulle**, et **une bulle n’expire pas** — c’est sa fermeture qui la marque lue, pas quatre
secondes écoulées pendant qu’on regardait sa toile. Les neuf portées déclarées (`activity.scope.*`)
disent ce qui est branché ; **une nouvelle voie d’échec s’y ajoute, elle ne se rejournalise pas
ailleurs.**

**Les cinq éditions par le modèle aboutissent, et se trouvent.** `familyOf` produit `upscale`,
`background-removal` et `vectorization` : les capacités de l’API ne les distinguent pas — les 24
modèles concernés déclarent tous `img2img` — et c’est le **tag** qui tranche, après les capacités et
seulement si elles ont répondu `image` (deux des neuf `remove-background` sont des modèles vidéo).
`FAMILY_TAGS` (`shared/domain/model.ts`) se lit dans les deux sens : le registre y prend le tag dont
il pré-filtre une liste côté serveur. Les trois familles ont leur écran de réglages — le seul endroit
où leur modèle se choisit. Les cinq commandes ont une ligne dans le menu Image et **restent sans
raccourci : elles dépensent du crédit.**

**L’entrée d’une image dans un ciel** — trois portes vers l’espace Skyboxes : double-clic sur un
asset, dépôt depuis l’étagère, et la génération, qui retient le document d’où elle est partie et s’y
pose seule.

**Le prompt s’écrit à quatre mains** — le champ que le modèle désigne (`promptSpark`, lu de son
schéma) porte trois actions : proposer des variantes, traduire le brouillon, lire le style des
références déjà posées. Une variante s’adopte en deux gestes séparés — le texte seul, ou le texte
**et** les réglages — parce qu’écraser un ratio qu’on vient de choisir n’est pas une décision qu’une
suggestion prend seule. Les réglages proposés sont filtrés contre les descripteurs du modèle avant de
traverser la frontière : le SDK les type `unknown`, et une valeur hors bornes est écartée plutôt que
ramenée de force.

## Ce qui n’est pas commencé

**La surface Scenario que le studio prend est plus étroite qu’elle n’en a l’air.** Treize canaux
`scenario:*`, neuf `assets:*`, quatre `cloud:*` et trois `workflows:*` couvrent la génération, le
catalogue de modèles, les jobs, l’upload, la bibliothèque, l’assistance au prompt, la consommation
de chaque clé et l’exécution des Apps — et rien d’autre. Ce qui n’est **pas** touché : l’**édition**
d’un workflow (les trois canaux cherchent, décrivent et lancent ; aucun n’écrit), `detect`, `patch`,
l’entraînement, la composition de LoRA, les écrans de collections, la recherche par similarité
visuelle. Et le **solde** ne manque pas par oubli : l’API n’expose que ce qui a été dépensé.
**Le § 4 est l’inventaire raisonné de ce trou.**

Ce qu’il faut retenir de `feat/prompt-assist` (`generate/prompt`, `caption`, `describe_style`,
`translate`) avant de toucher au reste de cette liste :

- **ces quatre-là ne sont asynchrones qu’en apparence.** Chacun répond avec un `Job`, mais son
  résultat est dans la réponse du POST — `prompts` y est une propriété *requise*. Le `JobManager`
  n’est pas concerné. **Vérifier ce point sur `detect` et `patch`** avant de supposer l’inverse ;
- **`generate/prompt` est gratuit** (0 unité créative, mesuré par `dryRun`) et rend bien plus qu’un
  texte : des `calls` complets, paramètres conformes au schéma du modèle cible ;
- **le champ à assister n’est pas deviné** : `GET /models/{id}` marque ses entrées d’un
  `promptSpark`, que `FieldDescriptor` transporte. C’est le prolongement de l’invariant 5 ;
- **`caption` exige un identifiant d’asset** : un fichier resté local n’en a pas. La description
  automatique porte donc sur le rapatriement depuis la bibliothèque, pas sur l’import d’un fichier du
  disque, qui exigerait de l’envoyer d’abord ;
- **la file `assist-queue` est à part du `JobManager`**, et le restera : ni asset à collecter, ni
  statut à interroger. C’est le seul endroit du studio qui dépense sans qu’on le lui ait demandé,
  d’où l’interrupteur `generation.captionArrivals` dans les préférences ;
- **`isRetryable` et `withRetry` vivent dans `scenario/retry.ts`**, pas dans le `JobManager`. Tout ce
  qui appelle l’API en tâche de fond passe par là plutôt que de réécrire un backoff.

## Corrigé — ne pas le re-signaler

- **Les documents n’appartenaient à aucun projet.** Le store `useDocuments` **n’est plus persisté du
  tout** : le dossier du projet dit quels documents existent, le layout persisté dit lesquels sont
  ouverts.
- **`pnpm start` chargeait `out/renderer/`** au lieu du serveur Vite. `scripts/dev-app-identity.mjs`
  renomme le bundle *et* son exécutable, ce qui faisait mentir `app.isPackaged` en plein run de
  développement. `src/main/environment.ts` lit désormais `__DEV__`, injecté par `define` au build.
- **Un second registre de commandes** orienté menu natif avait été construit en parallèle du vrai.
  Supprimé. **Ne pas recommencer.**
- **`reconcile` ne parcourait pas l’arbre entier** dans le moteur canvas, ce qui détruisait les
  textures des enfants de groupe. **Ne pas le recasser.**
- **Les deux règles de disposition** — l’étagère à assets en bande du bas, `DEFAULT_OPEN` sans
  identifiant par moitié — vivent dans **`docs/INTERFACE.md`**, au complet, avec ce qu’elles
  interdisent.

---

# 2. Le plus urgent

## Deux onglets ouverts sur « Ce document n’est plus ouvert » — au premier rechargement

**Vu à l’écran le 9 août 2026, capture à l’appui, et reproductible en trois gestes** : ouvrir deux
documents neufs dans l’espace Image, ne rien y enregistrer, recharger l’application. Les onglets
« Sans titre 1 » et « Sans titre 2 » reviennent, le centre affiche *« Ce document n’est plus
ouvert. »*, les Calques disent *« Ouvrez une image »*. **Un onglet ouvert qui affirme qu’il n’y a
pas de document est un état que l’interface ne doit pas pouvoir atteindre.**

**Ce n’est pas une régression : c’est un trou de conception, et le code le documente en le
décrivant.** `app/documents.tsx:76` porte la JSDoc « The layout is persisted, the documents are
not: a tab restored on startup outlives its document », et le rend proprement plutôt que de lever.
Ce que ce commentaire décrit comme un cas de bord est en réalité **le cas nominal** dès qu’un
document n’a pas été enregistré.

**La chaîne, vérifiée dans le code :**

1. `create` (`stores/documents.ts:198`) **n’écrit rien** dans le dossier du projet, délibérément —
   « a file per tab opened and never typed in would litter the project with empty documents ». Un
   document neuf n’existe donc que dans le store, en mémoire.
2. `useDocuments` **n’est pas persisté**, aussi délibérément (§ « Corrigé — ne pas le re-signaler » :
   persisté, les onglets d’un projet réapparaissaient dans le suivant).
3. **Le layout Dockview, lui, est persisté** — c’est même « the reliable record of what is open »
   (`panelIds`, même fichier).
4. `refresh` (`:157`) reconstruit les documents par **l’intersection dossier ∩ layout** :
   `found.filter(document => shown.has(document.id))`.

Un document jamais enregistré est absent du dossier, donc absent de l’intersection — **mais son
panneau, lui, est dans le layout.** L’intersection décide ce qui vit côté documents et **ne corrige
jamais le layout**, qui reste seul à prétendre que l’onglet existe. Personne ne ferme la boucle.

**Ce qu’il faut trancher, et le piège qui attend.** Aligner le layout sur la réalité est la bonne
moitié : un document dont rien n’est écrit ne peut pas revivre, son onglet ne doit donc pas
survivre. Mais **la condition ne peut pas être « absent du dossier »** — un document créé pendant
la session est lui aussi absent du dossier, et le balayer fermerait l’onglet sous les doigts. Il
faut « absent du dossier **et** absent de `state.documents` », et le nettoyage doit tenir compte du
fait que `refresh` est asynchrone et que `adopt` peut arriver entre-temps.

L’autre moitié est un choix de produit : un document neuf où l’on a peint sans enregistrer est
perdu au rechargement, silencieusement, aujourd’hui comme après le correctif. Décider s’il faut le
dire, ou l’écrire — et l’écrire contredit le commentaire de `create`, qui a ses raisons.

**Non commencé.** Tests de reprise à écrire dans le même mouvement : `app/**` n’est sous aucun
budget de couverture (§ 3.1), ce qui est précisément pourquoi ce chemin n’a rien qui le tienne.

---

L’espace **Textures** est le prochain manque fonctionnel par ordre de valeur hors workflows : les
**étape 8** (§ 3.4) est écrite et non commencée, et **ni les dérivations ni le tiling, livrés le
9 août, n’ont été vus à l’écran** — c’est la seule chose de cet espace qui reste à regarder.

Les deux dettes d’API qui bloquaient le node editor — borne de débit et survie des jobs — **sont
livrées** par les étapes 2 et 3 de `feat/workflows` (§ 3.6). Ce qui reste des dettes transverses :
les index du catalogue, la recherche qui ne s’interrompt pas, le décodage du clone IPC, la
coalescence d’undo volée par une commande asynchrone.

---

# 3. Ce qu’il reste à faire

## 3.1 La couche documents

**Livrée** (`feat/documents-erreurs`, 8 août 2026) : les six genres s’enregistrent, fermer un onglet
demande, un document se supprime, l’Explorateur rouvre ce qui a été fermé, et un chargement raté est
rapporté depuis `restoreDocument` — seul endroit qui sache qu’une lecture a échoué.

**Ce que le contrat a coûté, et qu’il ne faut pas repayer.** `DocumentDraft` accepte des `parts` —
des fichiers à côté du contenu — et le genre `image` s’écrit en dossier `<id>.img/`.
`DocumentIo.capture` est **asynchrone** parce qu’une lecture GPU l’est ; **la marque est lue
synchronement, avant le premier `await`**, et c’est la propriété à ne pas casser.

- **Une sauvegarde sans pixels efface ceux du disque.** Un dossier est remplacé en entier, donc
  `capture` refuse plutôt que d’écrire un document amputé quand le moteur est injoignable — ce qu’il
  est tant qu’il monte son contexte GPU, exactement quand tombe un ⌘S après un changement d’espace.
- **L’état atteint le moteur un commit React après le disque.** Les pixels relus visent des surfaces
  pas encore nées : ils patientent dans `pendingSnapshots`.
- **Le nom d’une partie traverse une frontière de sécurité.** Le renderer les choisit, le main en
  fait des chemins : `isPartName` n’accepte ni séparateur ni remontée, et le rôle passe DEVANT
  l’identifiant (`p_`, `m_`) pour que le nommage reste injectif.
- **La traversée JSON appartient à `textDocumentIo`**, pas aux appelants : c’est le `SyntaxError`
  d’un fichier qui n’est pas du JSON qui arme le refus d’écraser, et un lecteur qui l’avalerait
  perdrait la protection sans rien pour l’attraper.
- **L’ordre est le contrat** : la question précède l’écriture, l’écriture précède l’oubli, et
  `saveDocument` répond *si* l’écriture a eu lieu — un refus laisse l’onglet ouvert au lieu de fermer
  sur du travail qui n’a jamais atteint le disque.
- **Dockview est remonté par espace** : un panneau ajouté à l’API sortante est jeté par le `fromJSON`
  du suivant, donc la file d’attente se vide **après** la restauration. Et `relist` (lister) est
  séparé de `refresh` (réconcilier), **avec un compteur de génération chacun**, sans quoi un listage
  déclenché par le panneau fait abandonner la réconciliation du projet.

**Un document dont le fichier a refusé de s’ouvrir ne s’enregistre plus du tout**, jusqu’à sa
prochaine ouverture — le `Set` `unreadable` dans `app/document-io.ts`, dont la JSDoc porte le
pourquoi. C’est voulu : l’éditeur vide qu’une lecture ratée laisse est indistinguable d’un document
neuf, et sans ce refus le premier ⌘S écrirait `{ nodes: [] }` par-dessus la scène illisible. Le
fichier est la seule copie. **Ne pas lever ce refus.**

**La marque « modifié » ment au-delà de `HISTORY_LIMIT` — corrigé, et le mécanisme explique un
champ.** `markOf` valait `past.at(-1) ?? null` ; la pile plafonne à 100, donc après 100 modifications
suivies d’une annulation intégrale `past` retombe à vide, donc à `null` — la valeur que porte aussi
un document enregistré alors que son historique était vide. `History` retient désormais la dernière
commande qu’il a laissée tomber (`dropped`), et le remède général est le **jeton monotone par
commande** de `engines/core/history.ts`, partagé par tous les espaces.

**Les trois défauts d’interaction sont livrés** — l’Explorateur au clavier (`776e85b`), le
double-clic qui traverse les espaces (`33d31f3`), l’étagère au clavier avec sa sélection multiple
(`a98357e`) : entrées 5, 6 et 8 de `docs/INTERFACE.md`, section **Fait**. **Ce qui reste ouvert** :
la vérification à l’écran des entrées 6 et 8, et les deux trous de budget de couverture du § 1.

## 3.2 Espace Image

**Livré en deux tours** (`feat/image` puis `feat/pinceau`, 9 août 2026) : la boîte de transformation
suit la rotation du calque via `layerMatrix` — la matrice que Pixi compose déjà, donc elle ne peut
plus diverger ; la rotation s’attrape dans le quart de disque **hors** de chaque coin ; les vingt
raccourcis d’outil existent enfin ; le pinceau a une taille, ses trois réglages derrière un bouton de
la barre (en `SliderField` dans un `Flyout` : la barre fait un contrôle de large), atteignable par
`[` et `]` en `BracketLeft`/`BracketRight` — sur AZERTY ces positions portent « ) » et « ^ ».
L’aperçu est un cercle dessiné dans l’overlay au diamètre réel via `ToolChrome`, parce qu’un curseur
CSS ne suit pas le zoom. Et un outil qui ne peut rien faire le dit en `not-allowed` sous la main,
décidé par le moteur, seul à connaître `paintTarget()`.

Deux savoirs qui coûteraient une seconde fois :

- **le pas d’une taille de pinceau est un rapport, pas un nombre de pixels**, avec un plancher d’un
  pixel : l’arrondi immobilisait la touche en bas de l’échelle ;
- **`resizeBy` doit recaler la position dans l’espace tourné.** `x` et `y` portent le point autour
  duquel la rotation s’applique : corrigée dans l’espace non tourné, l’arête qu’on tire *contre*
  partait de 707 px à un quart de tour. Le test de la branche produisait le défaut sans le voir — il
  n’assertait que les échelles.

**Ce qui reste :**

- **`hardness` est déclaré et lu nulle part.** Le curseur de dureté ne déplace aucun pixel, et c’est
  la même raison qui fait que `paint/brush` et `paint/pencil` rendent le même `CanvasTool` — alors
  que le bundle promet « bord adouci » contre « bord net ». L’implémenter referme les deux d’un
  coup : un filtre de flou sur le stamp, réglé dans `setBrush` et jamais par dab.
- **Une garde sur le format des signatures manque.** `defaultBinding` accepte n’importe quelle
  chaîne : seize commandes ont été écrites `'P'` au lieu de `'KeyP'` — typecheck vert, lint vert,
  aucun test du dépôt n’a bronché, seul un test de bout en bout l’a attrapé.

## 3.3 Espace 3D

**Livré en trois temps** : onze étapes (`feat/3d-completion`, plan dans
[`docs/plans/2026-08-08-3d-completion.md`](plans/2026-08-08-3d-completion.md)), cinq commits de
finition (`feat/3d-finition`), puis la dette de relecture (`feat/3d-dette`, sept défauts confirmés et
corrigés). L’espace porte 17 primitives, 5 types de lumières, gizmos, sélection multiple, groupes et
reparentage, import glTF/GLB avec Draco et KTX2, magnétisme et repère local, ombres par nœud,
environnement IBL, `sprite`, caméra orthographique, six vues normalisées, trois modes d’affichage,
export glTF/GLB/USDZ, et un BVH construit en worker pour le picking.

> **Les décodeurs Draco et KTX2 sont copiés depuis three au postinstall et servis depuis `public/`**
> — le chemin absolu qu’on croit naturel casse en `file://`, il fallait le relatif. Vérifié sur le
> build empaqueté.

### Ce qui manque encore

| Manque | Pourquoi il reste |
|---|---|
| Instanciation, LOD | écartés par le plan tant qu’aucun cas réel ne les réclame : le seul coût mesuré était le picking, et il est réglé |
| Graisses d’une police | une seule coupe par famille est offerte, le romain. Un sélecteur demande d’indexer les faces par famille — mécanique, pas conceptuel |
| three livré deux fois | le chunk du worker BVH pèse 490 ko parce qu’il embarque three, déjà dans le bundle principal. Chargé à la demande et en local, donc supportable — mais c’est du poids d’installation en double |

### Les treize constats vérifiés que personne n’a traités

Par ordre de gravité. Chaque ligne est actionnable telle quelle.

| Où | Quoi |
|---|---|
| `shadows.ts:42` via `SceneRenderer.ts:617` | `applyShadowFlags(deep)` traverse **au-delà des nœuds enfants** : régler une ombre sur un parent écrase les drapeaux de ses enfants, que `syncNode` ne répare jamais (`previous === node`). Un changement de thème rejoue l’écrasement sur toute la scène. Corriger en arrêtant la traversée sur tout enfant portant l’id d’un nœud connu |
| `bvh-builder.ts:34-45` | `dispose()` n’est pas définitif : `workerOf()` respawne sans condition, donc la boucle série de `accelerate` fait naître un worker **après** le démontage du moteur, que rien ne terminera. Un drapeau `disposed` suffit |
| `bvh.worker.ts` | Aucun canal d’échec — pas de `try/catch`, pas de variante d’erreur, et le builder n’écoute ni `'error'` ni `'messageerror'`. Une exception laisse la promesse suspendue, garde la géométrie dans `building` pour toujours et bloque les mailles suivantes |
| `SceneRenderer.ts:772` | `void this.accelerate(holder)` avale ses rejets alors que `scene.model` est branché vingt lignes plus haut |
| `main/scene/export.ts:24` | Le message d’erreur de `writeFile` **livre le chemin absolu au renderer** (invariant 1) : un `EPERM` traverse la frontière et part au journal. À trancher avec l’asymétrie connue de `savePicture`, qui rend déjà le chemin |
| `SceneRenderer.ts:599` | Le fichier exporté porte des **UUID** en guise de noms : `object.name = node.id`, et le `name` du document n’atteint jamais le fichier. Le test qui semblait le prouver utilisait une fixture dont l’id vaut le nom |
| `scene-export.ts` | Une lumière directionnelle ou spot **perd son orientation** : la cible est sœur des nœuds, non exportée, et three prévient elle-même |
| `SceneRenderer.ts:389` | Un nœud **caché** produit un fichier vide, écrit sans un mot (`onlyVisible` vaut `true` chez les deux exporteurs) |
| `scene-export.ts` | Un GLB **riggé** sort en glTF invalide, `"joints":[null,null]` : `SkinnedMesh.copy` partage le squelette de l’original, hors du sous-arbre exporté. `model-cache.ts:28` a le même défaut — une instance riggée est pilotée par les os du cache |
| `scene-export.ts:37` | Le décodeur de textures compressées crée un `WebGLRenderer` **par slot de map**, pas par texture, et laisse derrière lui des écouteurs `dispose` morts plus un singleton de module qui retient la dernière texture. Coût sur le thread UI, et rétention |
| `services/diagnostics.ts` | `reportFailure` dédoublonne par `scope:subject`, et le sujet de l’export est le **format** : le second export raté du même format est muet. Insuffisant pour une action relancée à la main |
| `three-sync.ts:68` | Le mode `rotate` s’arme sur un sprite et n’a aucun effet — le shader ne lit que les longueurs de colonnes — mais salit le document et empile un undo vide |
| `scene-document.ts:160` | `isSprite` est le seul garde non dérivé de sa table : un champ ajouté au descripteur ne sera pas vérifié à la relecture |
| `ViewportEngine.ts:105-120` | Le passage ortho → perspective jette le zoom accumulé ; `frameSelection` ne redimensionne pas le tronc orthographique, donc `F` en ortho ne change rien à l’écran |

### Les pièges three.js déjà payés — ne pas les repayer

- **`SpriteMaterial` naît transparent**, three l’écrase exprès : l’éteindre à pleine opacité fait
  dessiner le carré entier de toute image à canal alpha. Et **un `Sprite` n’est pas un `Mesh`** :
  toute branche de libération gardée par `instanceof Mesh` laisse fuir son matériau.
- **Un type de nœud ignoré du chargeur disparaît en silence.** `isSceneNode` ne connaissait pas
  `group` : une scène groupée rouvrait sans ses groupes. Le même piège attendait `sprite`. **Tout
  nouveau type de nœud se teste par un aller-retour disque.**
- **`GLTFLoader` nomme chaque maille qu’il ramène**, donc le picking rendait `mesh_0` comme
  identifiant de nœud, écrivant un fantôme dans la sélection, l’historique et le document. `nodeIdOf`
  n’accepte plus qu’un nom que le moteur a lui-même posé.
- **Les exporteurs écrivent une transformation locale** : exporter une sélection imbriquée sans
  aplatir la place où elle est dans son parent, pas où elle est dans la scène.
- **La conversion rad→deg→rad n’est pas exacte** : diffé en radians, un axe intact était déclaré
  bougé à 13 % près, et une rotation écrasait les deux autres axes de la sélection.
- **Un `SettingRow` de genre `number` refuse les décimales** — deux réglages de magnétisme étaient
  inatteignables, leur propre défaut compris. Un test verrouille la règle pour tout futur réglage.
- **Une ligne est touchée à un monde entier d’elle-même** (`Raycaster.params.Line.threshold` vaut 1) :
  la surcouche filaire portait un halo cliquable par arête, et un clic dans le vide à côté d’un cube
  le sélectionnait. Elle est aveugle au rayon désormais.
- **Le picking d’un modèle importé est faux si le fichier entrelace ses attributs** : l’`array` d’un
  attribut entrelacé est le tampon **entier**, normales et uv compris. Les coordonnées se lisent
  attribut par attribut. Et un **index en `SHORT`** fait prendre la géométrie pour non indexée.
- **Le gizmo et le trièdre sont bâtis sur la caméra du montage** : un passage en orthographique la
  remplace, ils se rebranchent tous les deux. Une caméra posée exactement sur sa cible ne donne
  aucune direction, d’où l’écart avant lecture dans `viewFrom`.
- **`GLTFExporter` et `USDZExporter` lèvent sur une texture compressée** au lieu de la sauter : les
  deux reçoivent un décodeur, **sur un renderer à eux, jamais celui du viewport** — `decompress`
  appelle `setSize` sur celui qu’on lui donne. `USDZExporter` ne rafraîchit pas la matrice avant de
  lire, contrairement à `GLTFExporter`.
- **Un helper de lumière porte l’identifiant de sa lumière** pour qu’un clic dessus la sélectionne :
  il est donc posé dans le viewport **à côté** des nœuds, comme la grille, le trièdre et le gizmo.
  L’export s’en sort par construction — il ne reçoit que les objets des nœuds.

**Deux pistes cherchées et écartées, à ne pas refaire.** Le BVH et les groupes de matériaux : le
worker reconstruit une géométrie nue, donc l’index réordonné sur une seule plage appliquerait les
matériaux aux mauvais triangles — **non atteignable**, `GLTFLoader` fait une maille par primitive. Un
changement de type sur un id stable : `syncNode` garderait l’objet three.js du type précédent —
**non atteignable**, chaque commande qui crée un nœud bat un id neuf.

### La typographie que les deux espaces partagent

**`TextGeometry` n’est pas employé** : il lit une police au format typeface de three, dont aucun
projet ne contient d’asset, et le `TTFLoader` qui convertirait va chercher `opentype.js` sur un CDN,
ce que la politique de la fenêtre interdit. Les contours viennent d’`opentype.js` en dépendance,
deviennent des `Shape` et sont extrudés — ce que `TextGeometry` fait de toute façon.

**Trois polices OFL sont commitées** dans `src/renderer/public/fonts/`, licences à côté : une scène
qui les emploie s’ouvre à l’identique partout. Les polices du système s’ajoutent, lues par le main
(`fonts:list`, `fonts:read`) parce que le renderer n’a pas `fs`. Les deux espaces partagent la
référence (`FontRef`, `FontField`) **mais pas la machinerie** : la 3D veut des contours parsés,
l’espace Image une `FontFace` posée dans la page.

Cinq faits mesurés sur la vraie machine :

- **le main lit la table `name` par plages, jamais le fichier entier** : 267 familles en 200 ms, là
  où une lecture entière coûterait 192 Mo rien que pour `Apple Color Emoji.ttc` ;
- **une longueur non bornée lue dans un fichier de police tue le processus main.** Node *assert*
  qu’une longueur de lecture tient dans un entier 32 bits signé, et l’assertion native passe sous
  tout `catch` : un seul fichier corrompu dans `~/Library/Fonts` empêchait le studio de démarrer. Les
  lectures sont bornées à la taille réelle du fichier, et un test le verrouille ;
- **`opentype.js` refuse la signature `ttcf`**, or macOS livre l’essentiel de ses polices en
  collections : une face en est extraite table par table, directory réécrit ;
- **un nom de police est localisé** — sans préférence pour l’anglais, la police système d’Apple
  s’offrait sous le nom « Tipus de lletra del sistema » ;
- **89 % des polices d’une machine Apple se parsent**, pas 100 : les faces héritées emploient des
  formats de `cmap` qu’`opentype.js` ne lit pas. L’échec est dit dans le journal (`font.face`) et le
  texte retombe sur la police par défaut — le document garde le nom qu’il portait.

### Le canal d’échec du renderer

`diagnostics:report` va du renderer vers le main, en regard de `diagnostics.onLog` qui fait
l’inverse. Le main préfixe le domaine par `renderer/` à l’arrivée et n’accepte qu’un domaine de la
liste partagée `LOG_SCOPES` : une ligne ne peut pas se faire passer pour lui. Six échecs y sont
branchés (un `.glb` illisible, une texture introuvable dans les trois espaces qui en chargent, un
export refusé par le disque, un enregistrement qui échoue). Trois règles à connaître :

- **le cache de textures est construit par trois moteurs** : il reçoit son rapporteur comme il reçoit
  déjà son chargeur, sinon les trois annoncent `scene.texture` ;
- **un échec périmé accuse un fichier que la scène va dessiner** — relâcher puis reprendre une clé
  pendant que le premier chargement vole encore ; la déduplication graverait ce fantôme et tairait le
  vrai ;
- **un rapport est dit une fois par sujet**, sinon un moteur reconstruit à chaque panneau détaché
  remplit le journal. La mémoire s’efface au changement de projet.

**Ce qui reste** : six autres avaleurs de rejets attendent (`Rail`, `peaks`, `prepareEdit`,
`decoder-pool`, `useWaveSurfer`, `Models`). Une piste écartée volontairement : journaliser dans
`handle()` couvrirait les quarante canaux d’un coup, mais **une erreur du SDK embarque la clé API** —
il faudrait la réduire avant, et `log.ts` l’écrit en gros.

### Le plafond du décodage IPC a été contourné, pas résolu

**⌘S gèle toutes les fenêtres au-delà de ~5 500 nœuds**, et c’est le **décodage du clone IPC** qui l’y
amène — 73 % du coût, deux fois et demie la sérialisation, intouché (§ 6).

L’import glTF aurait dû faire franchir ce plafond. Il ne le fait pas, parce que **le modèle importé
est un seul nœud portant une référence**, jamais un sous-arbre : le document grossit d’une ligne quel
que soit le poids du fichier. Le prix est que l’intérieur d’un modèle ne s’édite pas ; une commande
« éclater » lèverait la limite le jour où elle gênera. **Le décodage reste à traiter avant tout ce
qui poserait des nœuds par milliers.**

### Le coût d’un clic, mesuré

`scene-picking.bench.ts`. Le rayon qui *touche* est le cas cher : three teste une sphère englobante
avant de marcher les triangles, donc un rayon qui rate ne coûte rien quelle que soit la densité.

| Scène | Avant | Avec le BVH |
|---|---|---|
| 3 modèles de 131k triangles | 7,3 ms | **0,016 ms** |
| 3 modèles de 524k triangles | 32 ms | **0,018 ms** |
| 2500 petites mailles | 0,13 ms | — |

L’arbre est construit **en Web Worker** (invariant 6), seulement au-delà de 20 000 triangles, et
seulement pour les modèles importés : une primitive du studio fait trente triangles et se marche plus
vite qu’un arbre ne se construit.

### Deux asymétries connues, laissées telles quelles

- **`pickSavePath` pose un filtre d’extension, `savePicture` n’en pose aucun** : on peut enregistrer
  des octets PNG sous un nom que rien ne contraint.
- **Sur Windows et Linux, un raccourci qu’une surface écoute elle-même attend la touche Windows, pas
  `Ctrl`** — `signatureOf` lit `event.metaKey`. C’est la convention de tout `COMMAND_REGISTRY`, `⌘Z`
  compris : la corriger touche la résolution des raccourcis de toute l’application. Documenté aux
  chapitres 15 et 18 du manuel.

## 3.4 Espace Textures

**Livré jusqu’à l’étape 5** (`feat/textures-materiau`, 8 août 2026) : le document `.tex`, les huit
canaux comme domaine, le viewport partagé, le panneau matériau avec son remap à double poignée, la
bande de canaux.

### Ce que les étapes 4 et 5 ont appris

- **Les noms de chunks de three sont vérifiés, et un test les tient.** `roughnessmap_fragment`,
  `metalnessmap_fragment`, `aomap_fragment` et `void main() {` sur 0.185.1, testés contre le vrai
  `ShaderLib.physical` — un renommage amont fait rougir `material-shader.test.ts` au lieu d’un écran.
  Une ancre manquante est **rapportée** (`texture.shader`), pas avalée : le rendu continue sans son
  remap plutôt que de sortir une sphère noire.
- **Le masque de cavité n’a aucun slot** dans `MeshStandardMaterial` : il passe par un uniform à lui,
  avec sa **propre matrice d’uv** et le define `USE_UV`, parce que three ne construit la matrice que
  d’une carte qu’elle connaît.
- **Ne jamais poser `needsUpdate` sur une texture pour la déplacer.** Il incrémente aussi
  `source.needsUpdate` : three réuploade les pixels ET reconstruit les mips — huit canaux 2K, 128 Mo
  par frame. `matrixAutoUpdate` suffit ; seuls `wrapS`/`wrapT` sont de l’état d’upload.
- **Deux canaux portent de la couleur**, `baseColor` et `emissive` — `contentOf` le dit, et un test
  exhaustif sur l’union le verrouille. La version précédente testait `channel === 'baseColor'` et
  sortait l’émission assombrie.
- **Une borne se déclare une fois** (`MATERIAL_BOUNDS`, `PREVIEW_BOUNDS`), lue par le champ et par le
  parseur. Et un angle s’**enveloppe** (`normalizeAzimuth`) là où une échelle se clampe : clamper un
  angle jette ce que l’auteur du fichier avait écrit.
- **`MenuButton` agit au lieu d’ouvrir quand il n’a qu’une ligne** (`useHoverFlyout(rowCount)`). Un
  menu qui peut se retrouver à une seule ligne doit en offrir une seconde, fût-elle désactivée.
- **Un dépôt refusé doit parler**, et sa portée va dans `GESTURE_SCOPES` : `AssetDropTarget` ne peut
  pas refuser pendant le vol — un glissement annonce son type, pas où est son fichier.

**Ce qui reste de l’étape 5** : l’import d’un fichier du disque **directement** dans un canal. Le
détour existe (importer dans le projet, puis déposer sur la vignette) et il est écrit au manuel.
`IMPORTABLE_TYPES` ne connaît pas les canaux : c’est un chemin à ouvrir, pas un bug.

### L’étape 6 est livrée — ce qu’elle a appris

`engines/texture/derive/` calcule quatre canaux sur le GPU : hauteur ← luminance de la couleur de
base, normale ← hauteur par Sobel 3×3, occlusion ← hauteur par trois anneaux, rugosité ← luminance
inversée. Le résultat traverse `assets:save-texture` et devient un asset `texture` du projet.

- **Le port ouvre son propre contexte WebGL**, et c’est l’exception que nomme désormais la JSDoc de
  `GpuPipeline` : rien n’est échangé entre les deux contextes, le résultat part en PNG sur le
  disque. Le plafond de seize contextes ne fait pas échouer la dérivation — le navigateur **évince
  le plus ancien**, donc ce qui noircit est un viewport ouvert. D’où « une seule à la fois », tenue
  par le panneau et dite par les autres lignes du menu.
- **Un `ShaderMaterial` à fragment maison n’est pas encodé en sortie** : `colorspace_fragment` ne
  vit que dans les shaders de `ShaderLib`. La source est lue en `NoColorSpace` et les octets
  écrits sont ceux que le shader calcule. Vérifié en contexte réel : 128 → 128.
- **Aucune force n’est figée dans les pixels.** `normalScale`, `aoIntensity` et `roughnessRange`
  règlent déjà tout au rendu ; baker une intensité figerait dans un fichier ce que les curseurs
  rendent réversible.
- **Deux courses, trouvées par sonde et non par lecture.** La vignette accepte un dépôt pendant le
  calcul — la destination se garde comme la source ; et la garde doit être rejouée **après** les
  deux attentes longues (écriture du fichier, relistage du catalogue), pas seulement après le GPU.
- **109 ms de thread UI pour une normale 2048²**, ~400 ms en 4K, dominés par le décodage et
  `toBlob`. C’est un geste, pas une frame, mais l’invariant 6 n’est pas honoré : un
  `OffscreenCanvas` dans un worker sortirait le tout. **Mesuré, non traité.**
- **Un canal dérivé ne se met pas à jour tout seul.** Rien ne s’abonne à sa source ; les deux
  manuels le disent maintenant. Le chaînage (recalculer la normale quand la hauteur change)
  demanderait un `isStale` à côté de `canDerive` — `derivedFrom` sur l’asset porte déjà de quoi
  le calculer.

**Ce qui reste de l’étape 6** : « améliorer ce canal » par `model_sc-texture-converter`, **via le
`JobManager`**, jamais un appel direct au SDK. Un job rend six canaux ; `collector.ts` sait déjà les
répartir par `metadata.type`.

### L’étape 7 est livrée — ce qu’elle a appris

Aperçu 1×/2×/4×, décalage d’une demie pour amener les coutures au centre, mesure des coutures par
shader. Les trois vivent dans `preview`, aucun ne touche la matière.

- **L’invariant « une seule passe hors écran à la fois » appartient au port**, pas aux panneaux :
  `runOffscreenPass` (`derive/offscreen.ts`) sérialise. Il a vécu six heures réparti entre deux
  composants qui s’ignorent — la grille de canaux éteignait ses lignes, l’inspecteur avait son
  booléen — de sorte que dériver puis cliquer « Mesurer » ouvrait deux contextes et décodait deux
  4K. La file **ne reporte pas un rejet** : sans le `catch`, un contexte refusé rejetterait toutes
  les passes derrière lui pour la vie de la fenêtre.
- **Le prix de cette file, non traité** : une passe dont le `load` ne se règle jamais la bloque
  définitivement. Avant, elle ne bloquait que sa propre ligne de menu. Un délai de garde serait une
  complexité non mesurée ; c’est un choix, pas un oubli.
- **Une demie est une demi-période, pas une demi-image.** `Matrix3.setUvTransform` pose l’offset
  **après** l’échelle (`sx*(u − cx) + cx + tx`), donc la couture arrive au milieu d’une tuile quel
  que soit le multiplicateur. Une revue a affirmé le contraire ; trente secondes dans
  `node_modules/three` l’ont réfutée. **Ne pas rouvrir.**
- **Une mesure retient l’asset qu’elle a lu**, pas seulement le nombre (`{ assetId, ratio }`) :
  remplacer la couleur de base laissait « Couture visible » à l’écran pour des pixels partis. La
  donnée porte sa propre péremption, ce qui évite une garde après l’`await`.
- **Mesurer est un geste** : `texture.seam` est dans `GESTURE_SCOPES`, comme le dépôt. Un second
  clic qui échoue doit le redire, sinon le bouton a l’air muet.
- **jsdom ne voit pas la taille du frame** passée au renderer : un test qui prétendait la
  surveiller ne mordait sur aucune mutation. Ce qui se vérifie de ce côté, c’est que le pass est
  construit sur la taille de la **source**, jamais sur celle du frame réduit.
- **Un carré passe un test d’axes.** `tiling` à 3×3 laissait `repeat.set(y, x)` vert ; c’est le
  test voisin qui mordait à sa place. Toute assertion sur deux axes prend deux valeurs différentes.

### L’étape écrite et non commencée

**8 — Export.** glTF/GLB, Unity, Unreal, Roblox, canaux bruts. Empaquetage ORM (AO=R, Roughness=G,
Metallic=B) **en une passe shader**. L’écriture disque passe par le main. `GLTFExporter` vient de
`three/addons`. C’est ici que « aperçu en 1024, export en pleine résolution » s’applique.

### Vérifié à l’écran le 9 août — ne pas le redemander

> **Les dérivations n’en font pas partie** : elles sont livrées et testées, jamais vues tourner.
> C’est la seule chose de cet espace qui reste à regarder, et elle demande que l’application soit
> fermée d’abord — le verrou d’instance unique.

Sphère éclairée, remap, masque de cavité, vue à plat : les quatre sont vus sur l’application
lancée, et les cinq angles de revue ont rendu. Deux choses seulement en restent, parce qu’elles
coûteraient une seconde fois :

- **une sphère à rugosité 1 sous un IBL uniforme paraît plate, et rien n’est cassé.** Le premier
  regard conclut à un environnement mort ; ce sont les spéculaires d’une carte de rugosité qui
  prouvent l’éclairage. Juger un IBL demande un matériau qui réfléchit ;
- **le shader est vérifié contre three 0.185, chunk par chunk.** three n’émet jamais `USE_UV`
  lui-même — il génère `USE_UV1/2/3` — donc le define de `setEdgeMap` n’entre en collision avec
  rien, et `aomap_fragment` tombe deux lignes avant `totalDiffuse` dans `meshphysical`, ce qui met
  la cavité au bon endroit. Rien à réinstruire de ce côté.

**Deux constats vérifiés et non traités**, hors de cet espace : l’**onglet fantôme** — un onglet
dont le document n’a jamais été enregistré survit dans le layout persisté et affiche « Ce document
n’est plus ouvert. » au centre ; et `ChannelTile`, dont le bouton d’inspection en `inset-0` recouvre
le badge d’origine, si bien que son `title` ne peut jamais s’afficher (l’`aria-label` reste lu,
c’est cosmétique).

**Deux dettes notées hors périmètre** : `design/MenuRow.tsx` n’expose aucun `aria-checked` — aucun
lecteur d’écran ne dit quelle ligne est active, dans **tous** les menus du studio ; et
`useDocuments.refresh()` ne passe pas par `forgetDocument`, donc les vues de session d’un projet
quitté y survivent.

## 3.5 Espace Skyboxes

**Livré.** Une image entre par trois chemins et le ciel s’allume.

**La famille `skybox` ne se déduit pas des capacités.** Vérifié contre l’API en ligne, pas supposé :
l’énumération des capacités n’a **aucune** valeur skybox, et les trois modèles publics
(`scenario-skybox-flux`, `scenario-skybox-gpt`, `hunyuan-world-image-to-skybox`) répondent `txt2img`
et `img2img` comme n’importe quel modèle d’image. Le tag **`sc:skybox`** est le seul signal qui
existe — d’où `familyOf(capabilities, tags)` qui consulte le tag en premier. Le même tag sert de
pré-filtre serveur : garder trois modèles sur six cents en marchant le catalogue page par page coûte
huit allers-retours pour remplir un écran. **`skybox-upscale` ne porte pas ce tag** et reste avec les
images, ce qui est correct : un agrandisseur ne produit pas le document de l’espace.

**Ce qu’il reste, dans l’ordre du coût croissant :**

0. **L’état vide est illisible**, vu à l’écran le 9 août. `SkyboxDocument.tsx:102` le pose bien
**au-dessus** du canvas — l’ordre du DOM est correct, ce n’est pas un problème d’empilement — mais
il n’a aucune plaque de fond, et derrière lui la scène n’est pas vide : le sol gris, les sondes et
les sphères de test. Un `text-muted` sur ce fond bariolé ne se lit pas, et c’est la seule phrase qui
dise quoi faire dans cet espace. Deux remèdes : une plaque sous le texte, ou ne pas peupler la scène
tant qu’aucune source n’est posée.

1. **Trois vues sur quatre sont des boutons morts.** `SKYBOX_VIEWS` en déclare quatre ; le renderer
   n’expose aucun `setView`, et le state de `SkyboxDocument.tsx` ne pilote que la couleur du bouton :
   `equirect`, `cross` et `faces` ne dessinent rien. Arbitrage à rendre : implémenter les
   projections, ou retirer le contrôle — un bouton qui ment vaut moins qu’un bouton absent.
2. **L’export n’existe pas, et son vocabulaire attend depuis le début.** `CUBE_FACES`, `FACE_LABELS`
   (`Rt`/`Lf`/`Up`…, ce que les moteurs attendent), `CROSS_CELLS`, `FACE_SIZES`, `isCubeFace` sont
   écrits et testés dans `shared/domain/skybox.ts` — et **référencés par leurs seuls tests**. Le
   domaine a été écrit pour un export qui n’a pas suivi ; le faire, c’est une passe shader et un
   écrivain, pas une refonte.

**Un piège avant d’y toucher.** Un `.hdr` **n’est pas importable** : `IMPORTABLE_TYPES`
(`main/media/link.ts`) ne connaît que vidéo, audio et image, et un `.exr` importé est catalogué
`image`, jamais `skybox`. Sans conséquence aujourd’hui — le puits accepte toute image du projet —
mais quiconque cherchera « pourquoi mon HDRI n’apparaît pas dans l’import » cherchera là.

## 3.6 Dettes transverses

### Ce qui reste ouvert

**Les index du catalogue n’ont pas été posés.** `catalog.ts` déclare des index simples
(`assets(type)`, `assets(created_at DESC)`, `asset_tags(tag)`, `assets(hash)`…). **Il manque l’index
composite `(type, created_at DESC)` et un FTS5** pour la recherche texte. Les deux requêtes coûteuses
de l’audit — `type = ?` à 15,17 ms et un `LIKE '%…%'` sans résultat à 22,53 ms — tombent dans le même
piège : parcourir toute la table pour remplir une page. **Le worker a déplacé ce coût, les index le
supprimeraient.**

**Une recherche engagée ne s’interrompt pas.** Six frappes produisent six recherches ;
`catalog-client.ts` n’expose aucun abandon, et une requête `better-sqlite3` engagée ne s’interrompt
pas. Elles ne bloquent plus rien depuis le worker, mais elles occupent le thread — et l’invariant 6
demande que toute tâche longue soit annulable. À traiter **avec les index**, qui les rendront assez
brèves pour que la question se pose autrement.

**Le décodage du clone IPC** — 73 % du coût d’un ⌘S, intouché. Cf. § 3.3 et § 6.

**L’horloge d’un viewport n’a pas d’état « au repos », et sa JSDoc prétend le contraire.**
`ViewportEngine.lastTime` est documenté comme valant `null` quand la boucle dort, mais rien ne l’y
ramène : `renderFrame` y écrit `now` à chaque frame et seul `resetClock()` y touche par ailleurs.
Chaque appelant qui démarre une animation doit donc penser à appeler `resetClock()` — et, depuis
`feat/textures-revue`, à garder cet appel sur un front montant qu’il suit lui-même.
`SceneRenderer.onPointerDown` refait déjà la même danse à la main. **Le remède est plus profond
qu’aucun des deux appelants** : que `renderFrame` remette `lastTime` à `null` quand il décide de ne
pas replanifier de frame, ce qui supprime la classe entière au lieu de la rustiner deux fois — un
viewport qui l’oublierait ouvre son mouvement sur un saut de `MAX_DELTA`, 0,1 s.

**Une commande asynchrone vole le geste en cours.** `document-store.ts` réécrit l’identifiant de
coalescence du document à **chaque** `runCommand` dès qu’un geste est ouvert, y compris pour une
commande venue d’ailleurs. Tant que toutes les écritures venaient de la main de l’utilisateur, elles
partageaient le geste. L’espace Skyboxes a introduit le premier écrivain **asynchrone** — une
génération qui aboutit — et le rend atteignable : si un job se termine pendant qu’un curseur est
tenu, l’annulation se fragmente en trois entrées, dont la génération au milieu, et un ⌘Z fait
disparaître l’image au lieu de défaire le réglage. **La ligne fautive sert les six espaces.**

**L’écriture atomique existe en deux exemplaires.** `scenario/job-store.ts` et `project/documents.ts`
écrivent tous deux une copie de transit puis renomment, avec le **même commentaire mot pour mot**, et
`isMissing` est dupliqué à l’identique. Un défaut corrigé dans le premier vit toujours dans le
second : le `rm` de nettoyage n’y est pas protégé, si bien qu’un échec du ménage remplace l’erreur
d’origine et masque la vraie cause. Un `writeAtomic` partagé — dans un `src/main/files.ts` — les
réunirait, **à condition de garder le nom de la copie en paramètre** : `documents.ts` en veut un
unique par appel (`<fichier>.<uuid>.tmp`, plusieurs fenêtres écrivent), `job-store.ts` un nom fixe
(`.staging`, ses écritures sont sérialisées et un nom unique laisserait un orphelin par crash). Les
**files** d’attente, elles, ne se factorisent pas.

**Durabilité, assumée.** `documents.ts` renomme atomiquement, ce qui protège d’un crash **en cours
d’écriture**, mais ne fait pas de `fsync` : une coupure de courant peut perdre l’écriture.

**Le double dispatch des accélérateurs Electron n’a jamais été vérifié en conditions réelles.** macOS
consomme probablement la frappe avant le renderer, Windows/Linux non. Personne ne l’a mesuré sur les
trois plateformes.

**`src/main/menu/index.ts` n’a aucun test** — empreinte, débounce, cycle de vie par fenêtre.
`src/main/ipc/test-harness.ts` mocke déjà `ipcMain`, mais il faut l’étendre à
`app` / `BrowserWindow` / `Menu`.

**Aucun test ne s’exécute sur l’application lancée** — le poste de vérification le plus cher du
projet, et le seul qu’aucune porte ne tient. Le protocole de la vérification manuelle est dans
`docs/INTERFACE.md` ; Playwright est reporté, pas abandonné (`L7` du backlog).

**La moitié rapatriement de la bibliothèque n’a pas de porte.** `cloud.pull`, `cloud.browse` et
`cloud.plan` traversent la frontière, sont testés, et **aucun composant ne les appelle** : le
planificateur sait calculer un diff bidirectionnel, et personne ne le lui demande. Seul `push` a un
bouton. Deux conséquences à ne pas confondre avec des bugs — **trois des sept badges sont
inatteignables** (`to-pull`, `conflict`, `other-account`), et `location-facet.ts` explique pourquoi à
l’endroit exact où la tentation serait d’en ajouter ; et **le manuel écrit noir sur blanc** que le
transfert est à sens unique (`docs/fr/manuel/07-assets.md`), donc ouvrir cette moitié veut dire
mettre à jour les deux manuels dans le même mouvement.

### La borne de débit — livrée, et ce qu’elle a appris

**La limite est 100 requêtes par minute et par projet**, écrite dans
`docs/scenario-api/guides/get-started/documentation/workflows-and-apps.md`, § « Rate Limits », avec
10 jobs de workflow concurrents et 50 nodes par workflow. Trois bornes de **concurrence** existaient
(`JobManager`, `assist-queue`, taille des lots de `limits.ts`) et **zéro borne de débit** : dix jobs
concurrents pollant toutes les deux secondes font 300 requêtes par minute à eux seuls.

Le limiteur (`scenario/rate-limiter.ts`) est une fenêtre glissante de 100 requêtes sur 60 secondes,
**par compte** — la limite est par projet, et une clé porte son projet. **Le passage obligé est le
`fetch` du client SDK**, injectable par `ClientOptions.fetch`, et non `reducedBy` comme le plan
l’annonçait : `reducedBy` n’enrobe que deux familles de handlers IPC, et le `JobManager` poll droit à
travers son runner sans le traverser.

- **Une fenêtre, pas un seau à jetons.** L’API compte des requêtes par minute : un studio resté
  inactif peut légitimement en dépenser cent d’un coup — c’est ce que fait l’ouverture d’un projet.
- **95, pas 100.** Le studio compte une requête quand il la lâche, l’API quand elle arrive. Cent
  admises juste avant la bascule peuvent atteindre le serveur groupées et tomber dans la même minute
  côté serveur que la première de la fenêtre suivante. `RATE_MARGIN` absorbe cette dérive.
- **Un appelant tenu longtemps se voit répondre `429`, il n’attend pas.** Le SDK arme le timeout
  d’une requête **avant** d’appeler le transport : chaque milliseconde d’attente est prise sur le
  budget de l’aller-retour. Le transport ne tient donc un appel que `MAX_WAIT_MS` (10 s) ; au-delà il
  rend un **429 de synthèse portant `retry-after-ms`**, que le SDK sait attendre et réessayer.
  **Lever une erreur ne marche pas** : le SDK rattrape tout ce qui sort du transport et le remballe
  en `APIConnectionError` — la limite arriverait à l’utilisateur en « échec réseau ».
- **Le plafond d’attente se compte à l’arrivée de l’appelant, pas quand son tour vient.** Compté au
  tour, chaque attendant recevrait un budget neuf et une file de n’importe quelle profondeur serait
  tenue indéfiniment.
- **L’horloge est monotone** (`performance.now`). Une horloge murale qui recule laisserait dans la
  fenêtre des instants situés dans le futur, que rien n’expire, et **tout appel serait refusé**.
- **Les acquisitions sont sérialisées**, sinon tous les appelants réveillés par la même expiration se
  disputent l’unique place libérée et le plus ancien peut perdre indéfiniment.
- **Les téléchargements d’assets n’y passent pas** : `download()` va chercher une URL signée par
  `net.fetch`, et les envois multipart du SDK vont directement sur S3. Ce ne sont pas des appels
  d’API.
- **L’annulation passe devant, et il faut les deux moitiés.** Passer devant dans la file ne suffit
  pas — une fenêtre pleine fait attendre la même expiration à tout le monde. D’où des **places
  réservées** (`URGENT_RESERVE`, 5 sur les 95 admises). La priorité voyage par `AsyncLocalStorage`
  (`asUrgent`) et non par un argument, parce que le seul lecteur est le transport et que le SDK, au
  milieu, n’offre aucun passage. **Réservé à l’annulation** : le seul appel dont le but est d’arrêter
  la dépense.
- **Le polling se règle sur ce qu’il a le droit de dépenser** : `max(2 s, jobs × 60 s /
  POLL_REQUESTS_PER_MINUTE)`, avec **75** requêtes par minute pour le poll seul. Une génération
  isolée garde ses 2 s, six s’espacent à 4,8 s, dix à 8 s. Sans cela, au-delà de quatre jobs le
  limiteur tenait chaque poll, le SDK réessayait, et une génération **vivante et payée** était
  rapportée en « échec — limite de débit » au bout d’une quinzaine de secondes.

### La survie des jobs — livrée, et ce qu’elle a appris

Un job ne survivait pas à la fermeture : `createJobManager` tenait tout en mémoire et **rien
n’appelait `jobs.list` au démarrage**. Une génération vidéo de dix minutes, l’application fermée
entre-temps, et le studio ne collectait **jamais** l’asset dans le projet — du travail payé et perdu.
**Prérequis dur de l’entraînement** (§ 4.8), qui dure des heures.

Les jobs inachevés sont désormais écrits en JSON dans `app.getPath('userData')`, atomiquement, et
repris **à l’ouverture du projet auquel ils appartiennent** — pas au démarrage : le collecteur écrit
dans le catalogue du projet ouvert, et il n’y en a aucun avant. La note porte le compte, le projet,
l’id distant et de quoi redessiner la ligne dans la barre de jobs ; **ni le statut ni la
progression**, qui sont ce que l’API répondra au prochain poll et dont une copie périmée serait une
seconde vérité.

- **Une note ne part que si l’API a conclu.** C’est la règle centrale, et la première version l’avait
  à l’envers : une coupure Wi-Fi de quinze secondes effaçait la note d’une génération vivante et déjà
  payée. Un échec **local** (réseau, clé indisponible, disque qui refuse) garde la note ; seuls un
  refus de l’API, une annulation qu’elle a prise et une collecte réussie l’effacent.
- **La collecte est idempotente** : `collector.ts` consulte `localIdOf` sur la sortie elle-même, sans
  quoi une note qui survit à un job déjà collecté réimporte tout et refacture le transfert.
- **Un job ne collecte que dans son propre projet** : plutôt que de classer une génération dans la
  mauvaise bibliothèque, il s’efface de la session et sa note attend que son projet revienne.
- **Le compte est nommé par une empreinte de sa clé** (`accountFingerprint`), pas par l’id du carnet,
  qu’un retrait suivi d’un ré-ajout renouvelle — le job repris serait perdu en silence. Même notion
  que celle qui nomme les fenêtres du limiteur.
- **Un fichier illisible n’est pas un fichier vide.** Une écriture reconstruit le fichier depuis ce
  qu’elle a lu : lire « rien » d’un fichier momentanément verrouillé effacerait les notes de tous les
  autres projets. Absent rend `[]`, illisible **refuse l’écriture**.
- **Les notes se périment à sept jours**, et l’écriture est vidangée à la fermeture et au changement
  de projet — sans quoi la dernière note d’une session, celle qui compte le plus, part avec le
  processus.

---

## 3.7 La couche projet — le dossier qu’on donne à l’utilisateur

**Décidé le 9 août 2026, non commencé.** Un projet est un dossier posé chez quelqu’un : il est
ouvert dans le Finder, synchronisé, sauvegardé, versionné, bricolé. Ce paragraphe est ce qu’il faut
lui donner à voir, et ce qu’il faut lui épargner.

Les défauts qui l’ont déclenché sont dans **`docs/INTERFACE.md`, entrées 15 à 17** — le panneau sans
sortie, les messages d’échec absents, le manifeste non défendu, l’extension et les dossiers
techniques. Ce qui suit est ce qui reste à décider ou à écrire.

### La mécanique est masquée sur les trois plateformes, sans exception

**Le point initial ne suffit pas.** Il masque sur macOS et sur Linux — c’est une convention de shell,
respectée par le Finder — et **ne masque rien sur Windows**, qui décide par l’attribut
`FILE_ATTRIBUTE_HIDDEN`, que Node n’expose pas. Le pipeline empaquette les trois OS : une solution
qui n’en couvre que deux n’est pas la solution.

**Un seul dossier technique, et non plusieurs.** C’est ce qui rend la chose robuste plutôt que
répétée : un seul chemin à masquer, donc un seul geste par plateforme, un seul endroit où l’oubli
est possible. Tout ce qui n’appartient pas à l’utilisateur y entre — le manifeste, le catalogue, les
proxies, les waveforms, les filmstrips, et `layouts/` s’il doit vivre.

> **`layouts/` est à trancher d’abord, et ce n’est pas un oubli : c’est une divergence.** La
> conception le prévoit — « `layouts/` : dispositions Dockview sérialisées, par espace », § 5 de
> `docs/specs/2026-08-06-scenario-studio-design.md`. L’implémentation a pris l’autre chemin : les
> arrangements vivent dans le `localStorage` du renderer (`scenario-studio:layouts`), et le dossier
> est créé dans chaque projet sans que rien n’y écrive jamais — c’est sa **seule occurrence dans
> tout `src/`**.
>
> La question n’est donc pas « sert-il à quelque chose » mais **où doit vivre un arrangement** :
> dans le projet, il voyage avec lui — on ouvre le projet sur une autre machine et on retrouve son
> écran, ce qu’un studio fait tous les jours ; dans le `localStorage`, il suit la machine et pas le
> travail. La spec a tranché pour le projet ; le code dit le contraire depuis le début. **Acter
> l’un des deux** : ramener les layouts dans le dossier technique, ou assumer le `localStorage` et
> cesser de créer le dossier.

**Le manifeste ne peut pas aller dans `.index/`**, et c’est le piège de l’idée simple : `.index/` est
déclaré **cache reconstructible** — un utilisateur qui le supprime pour récupérer de la place doit
retrouver son projet, pas le perdre. Le manifeste est ce qui fait qu’un dossier est un projet ; il
survit à la suppression du cache, ou il n’est pas le manifeste.

**Sur Windows, `attrib +h`, et rien à écrire pour le lancer** : `runProcess` (`main/media/runner.ts`)
est déjà un `spawn` court avec délai de garde et signal d’annulation, prévu pour exactement ce genre
d’appel dans le main. Trois règles autour :

1. **Un échec de masquage n’empêche jamais d’ouvrir ou de créer un projet.** C’est cosmétique. On
   journalise, et on continue — un projet qui refuse de s’ouvrir parce qu’un dossier n’a pas pu être
   caché serait un remède pire que le mal.
2. **C’est idempotent**, posé à la création et repassé à l’ouverture, comme `ensureFolders` répare
   déjà l’arborescence. Un projet copié depuis un Mac vers un PC arrive sans attribut.
3. **Ça ne rend pas le dossier introuvable** : masqué n’est pas protégé, et un utilisateur qui
   affiche les fichiers cachés doit pouvoir lire ce qu’il y a dedans.

### L’extension disparaît du nom du dossier

`PROJECT_EXTENSION` n’a **qu’un seul usage** dans `src/` — fabriquer le nom à la création — et
n’est **déclarée nulle part au système** : pas de `fileAssociations`, donc rien au double-clic et
aucun paquet macOS. La reconnaissance passe par le manifeste, jamais par le nom. **Retirer
l’extension ne casse aucun projet existant** : `open(path)` reçoit un chemin absolu et ne la teste
jamais.

### Ce qui reste visible, et pourquoi ça ne se négocie pas

« A project is a folder, not a binary file — **versionable, inspectable, repairable by hand** » :
c’est la raison d’être du format, elle est dans `shared/domain/project.ts`. `assets/` et
`documents/` restent là où l’utilisateur les voit, les copie et les répare. La règle est **cacher ce
qui n’est pas à lui**, pas cacher.

### Ce que ça touche

`shared/domain/project.ts` (les constantes et la liste des dossiers), `main/project/store.ts` (la
création, l’ouverture, la réparation), `main/project/validation.ts` (la version du manifeste, à
plafonner comme celle des documents), les deux bundles i18n (les messages d’échec, aujourd’hui
inexistants), et **une migration** : lire l’ancien emplacement du manifeste et écrire le nouveau, le
temps que le parc tourne.

---

# 4. Le node editor et les workflows Scenario

> **Le chantier a son plan**, écrit pour être exécuté sans supervision, dix étapes :
> [`docs/plans/2026-08-08-workflows-node-editor.md`](plans/2026-08-08-workflows-node-editor.md).
> Branche `feat/workflows`, worktree `.claude/worktrees/workflows`, base `develop`. Les deux dettes
> d’API du § 3.6 y étaient les étapes 2 et 3, parce qu’elles le bloquaient : elles sont livrées.

**Six étapes sur dix sont fusionnées dans `develop`**, l’étape 6 comprise : l’éditeur existe —
format, moteur, canvas — mais **il n’est monté nulle part**, et rien de ce qui suit n’est donc
atteignable par l’utilisateur. C’est pourquoi le manuel n’en dit pas un mot et n’a pas à en dire :
le point de montage est la décision de l’**étape 10**, et elle est prise — **le graphe sera un
septième espace**.

C’est le plus gros trou fonctionnel du projet, et le seul chantier qui ferait passer le studio de
« une interface devant une API » à « un outil ». D’où une section à lui, hors du § 3 : celui-là
liste ce qui reste d’un chantier commencé, celui-ci porte le chantier entier.

> **L’étape 5 est livrée : les Apps s’exécutent.** `workflows.list` en `privacy: 'public'` alimente
> un panneau **Apps** (colonne de droite, les six espaces), une App s’ouvre sur le formulaire que
> `translateSchema` bâtit de ses `inputs` — le même traducteur que pour un modèle, invariant 5 — et
> se lance par le `JobManager`, avec son coût estimé sur le bouton. **Trois** canaux — `workflows:search`,
> `:describe`, `:run` — et **pas un quatrième pour le prix** : `scenario:estimate-cost` price
> désormais une **cible** (`{ kind, id }`), la même que celle qu’on soumet.
>
> Trois choses à ne pas redécouvrir :
>
> - **un job dit maintenant ce qu’il lance** — `Job.kind` (`model` | `workflow`) et `Job.targetId`.
>   Sans quoi « Régénérer avec ces paramètres » rouvrait le générateur sur un id de workflow, que
>   le catalogue de modèles ne connaît pas. Les **notes de jobs déjà sur disque** nomment un
>   `modelId` : la relecture accepte les deux noms, sinon une génération payée serait abandonnée ;
> - **les sorties d’un job de workflow** se lisent d’abord dans `metadata.assetIds`, et seulement
>   s’il est vide en aplatissant `metadata.flow[].assets[]` — `outputsOf`, dans `runner.ts`, parce
>   que c’est le fichier qui parle SDK. Les deux à la fois importeraient chaque image
>   intermédiaire de la chaîne comme un résultat ;
> - **`billing.cuCost` est enfin lu**, sur le job lui-même, après `creativeUnitsCost` — pour qu’un
>   chiffre donné à la soumission l’emporte toujours. **Mais un job de workflow y répond `0`** : la
>   charge est sur ses sous-jobs, ce que le lancement réel du 9 août a montré. Voir le § 4.5 :
>   ce zéro-là ne s’affiche pas ;
> - **un statut inconnu vaut `ready`, pas `draft`.** La graphie n’a pas pu être observée : refuser
>   ce qu’on ne reconnaît pas rendrait **toutes** les Apps inertes le jour où Scenario écrirait
>   `published`. Seul un `draft` explicite éteint le bouton ;
> - **ce que le MCP ne pouvait pas dire, un vrai lancement l’a dit.** Le serveur ne liste que les
>   workflows **privés** du compte (aucun) et n’a pas de filtre `public`. Les trois inconnues — la
>   graphie des statuts, l’échelle de la progression, le peuplement d'`assetIds` — ont donc été
>   tranchées le 9 août 2026 en lançant une App par le SDK. **Le relevé est au § 4.5.**

> **L’étape 6 est livrée : le canvas existe, et il n’est monté nulle part.** `@xyflow/react`
> **12.11.2** est entré — la seule dépendance que le chantier avait le droit d’ajouter, accord
> donné, licence collectée. Ce qu’elle a laissé derrière elle :
>
> - **le format natif du studio est l’`editorInfo` de Scenario**, mais il vit dans
>   `shared/domain/graph.ts` et il est **écrit à la main plutôt qu’importé du SDK** : un graphe est
>   un document qui traverse l’IPC, donc son type appartient à `shared/`, qui ne porte aucune
>   dépendance runtime (invariant 2). C’est le **main** qui l’adaptera au convertisseur à l’étape 7,
>   et une divergence de forme échouera alors au **typecheck**, pas à l’exécution ;
> - **`nodeGroups` est porté par le domaine**, le quatrième champ d’`editorInfo` relevé au § 4.5 ;
> - **`engines/graph/` n’importe pas React** (invariant 4) : nommage des handles, règle de
>   connexion, mutations pures, relecture d’une entrée non fiable, commandes réversibles sur
>   l’historique partagé. `⌘Z` défait une arête sans défaire les nœuds qu’elle joignait ;
> - **la convention d’arête du § 4.4 est vérifiée sur données réelles**, et elle est écrite dans
>   `NodePorts.tsx` — là où l’inverser se paierait.
>
> **Trois défauts de la revue qui valent pour tout canvas contrôlé**, et qu’aucun test unitaire du
> moteur ne pouvait voir : un canvas entièrement contrôlé **ne garde aucune sélection**, donc la
> touche Suppr ne trouvait jamais rien à supprimer, ni nœud ni arête ; React Flow compare les nœuds
> **par identité**, donc refaire la liste à chaque rendu lui faisait jeter la mesure de chaque nœud
> et réabonner son `ResizeObserver`, à chaque frame d’un déplacement ; et `isValidConnection`
> refusait une entrée déjà câblée, si bien que « le nouveau fil remplace l’ancien » était vrai dans
> le moteur, prouvé par un test, et **inatteignable à la souris**.

## 4.1 Ce que l’API offre, vérifié dans la copie locale

Huit endpoints, tous dans `docs/scenario-api/reference/` : `workflows.create`, `.update`, `.run`,
`.list`, `.retrieve`, `.delete`, `.get_tags`, `.user_approval`. Le guide de référence est
`guides/get-started/documentation/workflows-and-apps.md`, 1296 lignes — **à lire avant le web**.

| Terme | Ce que c’est |
|---|---|
| **Workflow** | `inputs` + `flow` (le graphe exécutable) + `editorInfo` (l’état visuel) |
| **Flow** | tableau de nodes : le format d’**exécution** |
| **editorInfo** | `nodes` + `edges` + `inputKeys` + `nodeGroups` : le format d’**édition** |
| **App** | un workflow `privacy: public`, découvrable et exécutable par tout le monde |
| **status** | `draft` (non exécutable) · `ready` · `deleted` (suppression douce) |

**Trois limites à porter dans le domaine dès le premier jour** : 50 nodes par workflow, 10 jobs de
workflow concurrents, 100 requêtes par minute. Les deux dernières sont bornées depuis le § 3.6 ; la
première appartient à l’export et doit **échouer proprement**, pas silencieusement.

## 4.2 Ce que le SDK donne gratuitement — vérifié dans `node_modules`, pas supposé

`@scenario-labs/sdk` **v2.7.0**, celui qui est installé. Ces exports existent :

`convertWorkflowEditorToFlow` · `validateWorkflowFlow` · `validateEditorInfo` ·
`WorkflowImportError` · `VALID_EDITOR_NODE_TYPES` · `WorkflowEntity` · `EnhancedWorkflows`

**Scenario a publié le compilateur de son propre éditeur visuel.** Le format `editorInfo` est celui
de React Flow au champ près — `source`, `target`, `sourceHandle`, `targetHandle` sur une arête,
`{ id, type, data }` sur un nœud. Adopter ce format comme format natif rend gratuits la compilation
vers le flow, la validation, l’import/export, et l’aller-retour avec la webapp. **Ne pas écrire de
compilateur.**

L’évaluateur **CEL** vit dans `@scenario-labs/sdk/tools/cel` (`createCelEnvironment`, `evaluateCel`).
Il repose sur `@marcbachmann/cel-js`, **dépendance du SDK déjà présente dans le store pnpm** : donc
l’évaluation locale d’un node `transform`, et son aperçu en direct pendant la frappe, **ne coûtent
aucune dépendance nouvelle**. Le seul paquet à ajouter était le canvas lui-même — **`@xyflow/react`
12.11.2, entré à l’étape 6** avec l’accord de l’utilisateur. Le chantier n’en ajoute pas d’autre.

## 4.3 Les deux vocabulaires de nodes, et le compte exact

Ce sont **deux graphes différents**, et c’est le piège structurant du sujet.

**Nodes d’exécution — 10**, union littérale de `resources/workflows.d.ts` : `custom-model` · `model` ·
`workflow` · `remove-background` · `generate-prompt` · `logic` · `transform` · `for-each` · `list` ·
`user-approval`

**Nodes d’éditeur — 15**, `WorkflowEditorNodeType` : `text` · `asset` · `aspectRatio` · `model` ·
`modelInput` · `llm` · `transformText` · `splitText` · `ifElse` · `groupItems` · `sliceAssets` ·
`forEach` · `forEachEnd` · `stickyNote` · `approval`

> **Le tableau du guide n’en liste que 7 et il est incomplet** — il ignore `model`, `for-each` et
> `list`. C’est le **type du SDK qui fait foi**, pas la page de doc. Et un rapport tiers qui annonce
> 14 types d’éditeur a été écrit avant `modelInput`.

`stickyNote` n’existe pas à l’exécution. La paire visuelle `forEach` / `forEachEnd` se compile en un
seul node `for-each` portant `loopBodyNodeIds`. **Un mapping 1:1 entre les deux vocabulaires n’existe
pas et ne doit pas être cherché.**

## 4.4 La convention d’arête est INVERSÉE, et c’est le piège qui coûterait le plus cher

Si l’éditeur est câblé dans le sens intuitif, `convertWorkflowEditorToFlow` produit un graphe
retourné et **tout export vers Scenario est faux** — sans erreur, sans avertissement. À lire avant
d’écrire la première arête.

**Ce n’est pas une déduction.** Le code du SDK porte la règle en commentaire, dans
`node_modules/@scenario-labs/sdk/lib/workflow_converter.js`, autour de la ligne 588 :

    // edge convention: `{ source: consumer, target: provider }` — an input handle
    // on `source` reads an output handle on `target`.
    const providersOf = id => edges.filter(e => e.source === id).map(e => e.target)
    const consumersOf = id => edges.filter(e => e.target === id).map(e => e.source)

Et l’implémentation s’y tient partout : c’est **`targetNode.data.outputHandles`** qui est cherché par
`edge.targetHandle` (l. 240, 258, 285, 294, 367).

| | Côté écran | Champ React Flow | Ce que c’est |
|---|---|---|---|
| **Sortie** d’un node (le producteur) | droite | `target` / `targetHandle` | `outputHandles` |
| **Entrée** d’un node (le consommateur) | gauche | `source` / `sourceHandle` | les inputs du modèle |

La donnée va de gauche à droite à l’écran ; **l’objet arête pointe de droite à gauche.** L’attribut
d’accessibilité que la webapp rend le dit tel quel : *edge from imageGenerator1 to text1*, pour une
arête qui alimente `imageGenerator1` depuis `text1`.

**Les conventions de nommage, à copier telles quelles** — le convertisseur les lit :

| Quoi | Forme | Vérification |
|---|---|---|
| handle | `` `${nodeId}-${'source'\|'target'}-${fieldName}` `` | `workflow_converter.js:326` teste littéralement `` `${nodeId}-source-items` `` |
| sorties d’un `forEach` | `` `${nodeId}-output-${n}` `` | `:254`, expression régulière `/-output-(\d+)$/` |
| nom de sortie par défaut | `output` | `:320`, `?? 'output'` |
| id de node | `` `${typeCamelCase}${index}` `` | `text1`, `imageGenerator1` — observé dans la webapp |
| id d’arête | `` `${handleDeSortie}--TO--${handleDEntrée}` `` | confort de lecture : le convertisseur ne lit pas les ids d’arête |

**Le canvas de Scenario est `@xyflow/react` v12, et ce n’est plus une hypothèse.** Le DOM de
`app.scenario.com/workflows/[id]` porte `react-flow__viewport xyflow__viewport`,
`data-testid="rf__wrapper"`, `rf__node-*`, `rf__edge-*`, `react-flow__aria-live-*`. Les composants
employés : `<ReactFlow>`, `<Background variant="dots" gap={20} size={0.5} />`, `<NodeResizeControl>`
(poignée bas-droite), `<Handle>`, `<EdgeLabelRenderer>`, `<ViewportPortal>`, arête bézier par défaut
stylée en CSS (`stroke-width: 3; stroke-dasharray: 8`). **Ni `<Controls>` ni `<MiniMap>`** : leur
barre d’outils est flottante et maison — ce qui tombe bien, le studio a la sienne
(`design/Toolbar.tsx`).

**Deux types de l’éditeur à ne pas réinventer**, tous deux exportés : `WorkflowEditorHandleInput`
porte `type?: string | string[]` — un tableau signifie un port **polymorphe**, matière de
`isValidConnection` et du code couleur des ports — plus `subHandles` pour les sous-ports.
`WorkflowEditorConditionBlock` est
`{ conditions: { field?, operator, value? }[], logic: 'and' | 'or' }` : l’UI d’un `ifElse` est un
**query builder** de groupes ET/OU, et le format existe déjà.

## 4.5 Quatre pièges trouvés en lisant, avant d’avoir écrit une ligne

> **Les deux premiers reposaient sur la prose du guide, et le SDK la contredit** — vérifié le 8 août
> 2026. `resources/workflows.d.ts` (l. 4079-4091) décrit la réponse de `workflows.run` : `status` y
> prend **les huit valeurs de la génération** (`canceled | failure | finalizing | in-progress |
> pending | queued | success | warming-up`), sans `succeeded` ni `failed`, et `progress` va de 0 à 1.
> `jobs.retrieve` dit la même chose (`resources/jobs.d.ts`, l. 39-51), et le filtre du serveur MCP
> officiel aussi. **Le guide en prose est la seule des trois sources** à annoncer `succeeded`/`failed`
> et une progression en 0-100. Aucun job de workflow n’existait alors dans l’historique du compte
> pour trancher à l’observation : les deux corrections sont donc livrées **comme des assurances, pas
> comme des correctifs**. **Tranché depuis** — voir juste dessous.
>
> ### Tranché à l’observation le 9 août 2026 — une App lancée pour de vrai
>
> `wflow_coloring-page-maker` (deux nœuds, 12 CU), lancée par le SDK avec la clé de développement,
> le job suivi par `jobs.retrieve` jusqu’à son terme. **C’est le SDK qui disait vrai, sur les deux
> points, et le guide en prose qui a tort.** Ne pas rouvrir la question.
>
> | Ce qui était en doute | Ce que l’API répond |
> |---|---|
> | La graphie des statuts | `queued` → `in-progress` → `success` — le vocabulaire de la génération |
> | L’échelle de la progression | `0` … `0` … `1`. En 0–1, **et elle ne bouge pas d’ici là** |
> | `metadata.assetIds` | **peuplé**, à côté d’un `flow[]` qui porte les mêmes assets par nœud |
>
> Les deux assurances de l’étape 1 restent donc **inertes** — et c’est le résultat voulu : elles ne
> coûtent rien et elles tiennent si Scenario change de vocabulaire.
>
> **Deux défauts que seule l’observation pouvait trouver, corrigés dans la foulée :**
>
> 1. **Le dry run répond `200`, pas `402`** — sur `generate.runModel` comme sur `workflows.run`.
>    Le corps porte `creativeUnitsCost` (et `creativeUnitsDiscount`) à côté d’un `job` vide. Le
>    402 à `estimatedCost` que documente `workflows-and-apps.md` n’a **jamais** été observé.
>    `cost.ts` ne lisait que lui : **aucun badge de prix n’a rien affiché depuis l’étape 4**, et
>    rien ne pouvait le dire — un bouton sans badge se lit comme un modèle que l’API refuse de
>    tarifer. Les deux formes sont désormais lues, le 402 en repli.
> 2. **Un job de workflow facture `cuCost: 0`.** La charge est sur ses **sous-jobs**, un par nœud :
>    le parent `job_fZ1b…` disait 0, le nœud `job_14DZ…` qu’il a lancé disait 12. Le studio aurait
>    affiché « 0 CU » sur une chaîne payée. Un `cuCost` nul sur un job de **workflow** vaut donc
>    absence de prix ; sur une génération il vaut gratuit, et il s’affiche.
>
> **Deux faits acquis pour la suite.** L’`editorInfo` d’une App porte un **quatrième** champ que
> le § 4.4 ne nommait pas : `nodeGroups`, `{ [uuid]: { title, color } }`, avec un `data.group` sur
> chaque nœud — ce sont les boîtes de regroupement de la webapp. Et une App publique compte
> **62 nœuds** (`wflow_H1bKz78jgpinWPKJfVCM5uAp`) : le plafond de 50 n’est pas opposé aux
> workflows publiés, ce qui est à vérifier avant d’écrire le refus d’export de l’étape 9.
>
> **La convention d’arête inversée du § 4.4 est confirmée par des données réelles** :
> `{ source: 'imageGenerator1', target: 'image1' }` pour une arête qui alimente le générateur
> depuis l’asset, avec `sourcePosition: 'left’` et `targetPosition: 'right’` sur les nœuds.

**1. Un job de workflow pollerait pour toujours** — si le guide dit vrai. Un statut inconnu est traité
comme `running`, **délibérément et à raison** : c’est ce qui protège d’un statut que Scenario
ajouterait. Conséquence : `succeeded` et `failed` n’auraient jamais été reconnus, `isFinished` jamais
vrai, et le job serait resté au compteur de concurrence jusqu’à la fermeture. Deux lignes dans
`STATUS` et un test — aucune collision, ces graphies n’ont pas d’autre sens dans le vocabulaire de la
génération.

**2. La progression serait affichée à 10000 %** — même condition. Normaliser **à l’entrée**
(`p > 2 ? p / 100 : p`, puis borner à `[0, 1]`) et non à l’affichage : la valeur est stockée dans
`Job.progress`, et `JobsStatus` la **somme** sur tous les jobs, ce qu’un clamp d’affichage ne
rattraperait pas. **Le seuil est 2, et pas 1** — une génération dépasse sa propre échelle (un job
rapporte 1.02), si bien que diviser dès 1 faisait retomber la fin de chaque génération à **1 %** :
une régression sur le chemin vivant, introduite pour un vocabulaire que personne n’a observé.

**3. Les sorties d’un workflow ne sont pas là où le manager les cherche.** `RemoteJob` ne lit que
`metadata.assetIds` ; un job de workflow rend `metadata.flow[]`, **une entrée par node avec son
`status` et ses `assets[{ assetId, url }]`**. `collector.ts` n’a besoin d’aucun changement — il prend
une liste d’ids distants ; il faut aplatir `flow[]` vers cette liste. Et `metadata.flow` rend le
**retour visuel par node gratuit** : un seul poll met à jour tout le graphe, halo et vignette
compris.

**4. Une seule voie de publication est documentée.** `create` et `update` laissent le workflow en
`draft`, donc non exécutable. Un endpoint de publication côté serveur n’est dans **aucune des 209
pages locales**. La compilation **locale** est donc le seul chemin documenté :
`convertWorkflowEditorToFlow`, puis `validateWorkflowFlow`, puis `update({ flow, status: 'ready' })`.
C’est aussi le meilleur : la validation devient un retour instantané dans l’éditeur au lieu d’un 400.

Deux détails à ne pas redécouvrir : `"workflow"` est **réservé** dans `ref.node` — il désigne les
inputs du workflow parent, donc **ne jamais nommer un node `workflow`** ; et
`convertWorkflowEditorToFlow` rend `type: string` là où l’API attend une union littérale, ce qui
impose l’un des rares `as` justifiés du dépôt, avec son commentaire d’une ligne.

## 4.6 La décision d’architecture : où le graphe s’exécute

C’est **la** question du chantier, et elle n’est pas tranchée.

| | **A — déléguer à Scenario** | **B — exécuteur local** |
|---|---|---|
| Comment | `workflows.run` → un job → `metadata.flow` | tri topologique local, un `runModel` par node |
| Progression par node | fournie | à écrire |
| Nodes non-Scenario (ffmpeg, noyau GPU, fichier local, export moteur) | **impossible** | possible |
| 50 nodes / 10 jobs concurrents | subis | contournés |
| Re-run partiel par cache de hash | **impossible** | possible |
| Publication en App, partage | natif | impossible |

**La recommandation est B comme moteur, A comme export**, et la raison est le cache : changer le
prompt du dernier node ne doit relancer que ce node. C’est ce qui rend un node editor supportable, et
c’est exactement ce que déléguer interdit. Mais B est une semaine de plus, et A seul serait déjà un
produit. **À arbitrer avec l’utilisateur avant d’ouvrir la branche.**

Un point qui penche : les nodes que Scenario n’a pas sont ceux qui donneraient sa valeur au studio —
`localFile`, `ffmpegConcat`, un aperçu PBR sur le noyau GPU existant, un export Unity ou Godot. Ils
n’existent que sous B.

## 4.7 Ce que le chantier apporterait par ricochet

**Les Apps sont une bibliothèque de modèles de workflows, gratuite.** `workflows.list` avec
`privacy: public` rend des workflows exécutables tels quels, filtrables par tag : le « ready-made »
de la webapp sans écrire un seul graphe, et surtout des **exemples réels d’`editorInfo`** pour
vérifier le rendu du canvas contre des données que Scenario a produites.

**`user-approval` ouvre une phase que le `JobManager` n’a pas.** Un job de workflow peut se suspendre
en attendant l’utilisateur ; `workflows.userApproval` le débloque. `JobStatus` n’a rien entre
`running` et fini : c’est une valeur de plus dans le domaine, et elle change `isFinished`, donc elle
se traite avec les corrections du § 4.5.

**Le solde et la consommation ne sont toujours appelés nulle part.** `usages.list` (unités
consommées, par modèle, par période) et `pricing.oscu.retrievePrices` : la consommation du mois dans
Réglages > Compte est deux canaux et aucune dépendance. Le prix par génération, lui, est livré (§ 1).

**Les modèles utilitaires de Scenario sont la matière première d’un graphe, et le studio n’en appelle
aucun.** Ce sont des **opérations déterministes exposées comme des modèles**, donc chaînables dans un
flow et atteignables par le `runModel` déjà écrit — sans une ligne de code spécifique, puisque leur
formulaire se construit tout seul (invariant 5).

| Famille | Modèles | Ce qu’ils donnent au studio |
|---|---|---|
| Géométrie | `scenario-compose-image`, `-image-slicer`, `-grid-maker`, `-resize-image`, `-padding-remover`, `-convert-to-mask-image` | les nodes de composition et de découpe d’un graphe |
| **Calques** | `scenario-image-layers-extractor` | `separationInstruction` en langage naturel, `maxLayers` 1–10 : **un clic « décomposer en calques » → une pile éditable** dans un espace Image qui a déjà l’arbre de calques |
| ControlNet | `scenario-detection`, param `modality` | `canny` `depth` `grayscale` `lineart_anime` `mlsd` `normal` `pose` `scribble` `segmentation` `sketch` — un node « Detect » à un menu, et `depth`/`normal` alimentent le noyau GPU existant |
| Étalonnage | 18 × `scenario-postprocessing-*` | `lut` (~180 presets film), `grain` (22 profils), `color-correction`, `sharpen`, `glow`, `vignette`… |

Deux réserves à porter dans le plan. Ce sont des **appels réseau facturés** : pour un aperçu
interactif, le noyau GPU du studio refait la passe en shader et Scenario n’est appelé qu’au rendu
final — le mapping paramètre → uniform est direct, les noms et les bornes venant du schéma. Et
`scenario-smart-reframe` en `textDensity: DENSE` + `thinkingLevel: HIGH` est **nettement plus
coûteux** : ces deux champs veulent un avertissement et un `dryRun` affiché.

## 4.8 Hors périmètre, et pourquoi c’est écrit ici

Pour qu’une prochaine session ne reparte pas chercher.

- **Train et Compose n’existent pas** (`models.train.trigger`, `models.training_images.*`,
  `models.create` en `flux.1-composition` avec ses `concepts[]` à `scale`). Tout est documenté en
  local, rien n’est écrit. Un entraînement dure des **heures** : la persistance des jobs du § 3.6 en
  était le vrai prérequis, et elle est livrée. Écarté pour l’instant, pas oublié.
- **Le mode « Live » de la webapp n’a AUCUN endpoint dans les 209 pages locales** — ni streaming, ni
  WebSocket. Ce n’est pas un manque du studio, c’est une fonctionnalité que l’API n’expose pas. À
  défaut, un `runModel` débouncé sur un modèle rapide avec annulation du job précédent en serait
  l’imitation honnête. **Ne pas la chercher à nouveau dans la doc : elle n’y est pas.**
- **Le serveur MCP de Scenario est en BETA** et n’a pas à devenir une dépendance produit. Le panneau
  Modèles à facettes est la réponse déterministe au même besoin, et il est livré.

---

# 5. Méthode — ce qui a marché

**Les revues qui exécutent le code trouvent beaucoup plus que celles qui le lisent.** Trois points de
comparaison, tous sur le mode Image :

| Quand | Comment | Trouvé |
|---|---|---|
| Jalon 0 | huit agents qui ont **lu** le code | 3 défauts |
| Jalon 2 | trois agents à qui il était demandé d’écrire des sondes vitest et de **reproduire** chaque défaut | **12 défauts**, dont une régression critique introduite par la passe de simplification elle-même |
| Jalon 3 | un agent muni d’une **sonde instrumentée** | le nouveau chemin du déplacement de calque payait cinquante réordonnancements par frame — aucune lecture ne l’avait vu |

Quand une revue est déléguée, demander explicitement : de **reproduire empiriquement** chaque défaut
avant de l’affirmer, de rendre **la sortie de la sonde qui le prouve**, de séparer les défauts
confirmés des suspicions non reproduites, et de **nettoyer derrière soi** — le répertoire de travail
est le scratchpad indiqué en tête de session, jamais `src/`, jamais `/tmp`.

**Casser son propre code pour voir si un test rougit.** Sur un lot récent, deux tests écrits de bonne
foi ne mordaient pas : l’un mesurait une garde au lieu du défaut, l’autre cherchait un mot qu’aucun
bundle ne contient.

**Une fusion sans conflit n’est pas une fusion sans contradiction.** C’est arrivé deux fois. Un autre
travail avait documenté dans huit chapitres du manuel que « l’espace Image ne sait pas ouvrir une
image existante » — au moment précis où une branche l’implémentait ; git a mêlé les deux proprement,
et le manuel décrivait deux logiciels à la fois. Puis `develop` a ajouté un test d’exhaustivité sur
`LogScope` dont les portées neuves manquaient, fusionné sans un mot.

La règle qui en sort : **après toute fusion touchant à la fois du code et de la documentation, relire
ce que la doc affirme sur ce que le code vient de changer**, et vérifier chaque affirmation dans le
code plutôt qu’au jugé — sur quatre limites suspectes d’un lot, trois étaient tombées et **une tenait
encore**. Supprimer la quatrième aurait fait mentir la doc dans l’autre sens.

**Un commentaire déplacé garde sa formulation et perd sa vérité.** Un bug de rendu est venu de là :
une JSDoc recopiée d’un module où elle était exacte justifiait, dans le nouveau, un test faux. Quand
on change un comportement, on relit les commentaires autour.

**Rebaser souvent.** Plusieurs sessions travaillent en parallèle dans `.claude/worktrees/` : deux ont
déjà réécrit le panneau des calques et le registre de commandes en même temps. Corollaire pratique :
préfixer chaque commande par le chemin absolu de son worktree — le shell retombe ailleurs entre deux
appels, et un build lancé au mauvais endroit écrase le `out/` du voisin.

---

# 6. Performance — les mesures acquises

**Trois audits, tous menés le 7 août 2026** sur Apple M2 Max / macOS 26.5.2, en **build de
production**. **Ne pas refaire ces mesures.**

## Les six chiffres à ne pas redécouvrir

1. **8,33 ms** — le budget par frame du renderer sur un écran 120 Hz. C’est le chiffre qui compte, pas
   les 16,7 ms d’un écran 60 Hz.
2. **16 ms** — au-delà, une opération synchrone dans le **main** gèle TOUTES les fenêtres, y compris
   les détachées.
3. **React ne pèse rien en production** (0,15 ms/frame, 4,5 % du CPU occupé) et **huit fois plus en
   dev**. Mesurer en dev, c’est mesurer `jsxDEV` et `validateProperty`, qui n’existent pas en
   production.
4. **Le navigateur coalesce déjà les `pointermove`** : 600 événements injectés en 44 ms, 7 reçus. Il
   n’arrive jamais plus d’un `pointermove` par frame — il n’y a rien à coalescer dans un rAF.
5. **Le catalogue franchit les 16 ms vers 100 000 assets** et atteint 44 ms à 200 000.
6. **⌘S gèle toutes les fenêtres au-delà de ~5 500 nœuds.** Inatteignable au menu Ajouter,
   atteignable au premier import glTF.

**Une optimisation non mesurée est une complexité gratuite.** L’audit 3D est le cas d’école : cinq
pistes de revue, cinq réfutées par la mesure, **zéro ligne changée**.

## Audit 1 — le chemin chaud de l’inspecteur 3D : ce n’en est pas un

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

- *« La géométrie se reconstruit dans l’événement, pas dans la frame »* — il n’y a rien à coalescer :
  299 frames, 299 émissions d’état, 299 reconstructions. Rapport 1,00.
- *« Rien n’est mémoïsé dans le panneau »* — mémoïser tout l’inspecteur ne peut pas rapporter plus que
  les 0,15 ms que React coûte en tout.
- *« La pile d’historique est recopiée par frame »* — `runCoalescing` coûte **0,0005 ms**. Copier 100
  références est un `memcpy` de 800 octets, six millièmes de pour cent du budget.
- *« Tout l’espace 3D se re-rend »* — l’amplification est réelle mais bornée par la précédente :
  passer de 1 à 50 mailles coûte +0,010 ms par maille. Il faudrait ~500 mailles pour saturer le
  budget.
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

Renderer sur `localhost:9334`, onglet Performance. Cinq panneaux ouverts, une sphère, ses deux
comptes de segments à 128, puis glisser le champ visé sur la largeur du panneau. Sans les drapeaux,
Chrome suspend le `requestAnimationFrame` d’une fenêtre occultée et il n’y a plus rien à mesurer.

## Audit 2 — le catalogue quitte le thread principal

Coût d’une requête, driver de production `better-sqlite3` :

| Assets | par type | texte sans résultat | deux tags | première page | par id |
|---|---|---|---|---|---|
| 1 000 | 0,15 ms | 0,44 ms | 0,12 ms | 0,14 ms | 0,004 ms |
| 10 000 | 1,69 ms | 1,32 ms | 0,75 ms | 0,48 ms | 0,004 ms |
| **100 000** | **15,17 ms** | **22,53 ms** | 7,69 ms | 0,49 ms | 0,004 ms |
| **200 000** | **33,73 ms** | **43,82 ms** | **20,49 ms** | — | — |

Blocage mesuré dans l’application, 100 000 assets, seize recherches lourdes, sonde IPC continue :

| | AVANT (dans le main) | APRÈS (sur son thread) |
|---|---|---|
| Sondes | 16 687 | 32 297 |
| Pic maximal | **22,1 ms** | **8,4 ms** |
| **Sondes au-dessus de 16,7 ms** | **16** | **0** |

**Seize recherches lourdes, seize blocages** — un par requête, et le pic de 22,1 ms est très
exactement la requête mesurée à 22,53 ms au banc. Après : aucun blocage sur 32 297 sondes.

Le correctif est un seul changement : le catalogue s’exécute sur son propre `worker_threads`.
**`catalog.ts` n’a pas changé d’une ligne** — c’est ce que le port `SqliteDriver` rendait possible, à
une nuance près : échanger le driver ne pouvait pas suffire puisque toutes ses méthodes sont
synchrones, c’est le catalogue entier qui devait partir.

Trois décisions : **un thread, pas un pool** (SQLite n’accepte qu’un écrivain, les requêtes sont
courtes) ; **tout le catalogue part, pas seulement `search`** (une seconde connexion au même fichier
serait moins sûre, et `find` à 0,004 ms n’y perd qu’une latence de message) ; **le client rejette ce
qui est en vol si le thread meurt** (sans quoi un worker qui plante laisse l’interface attendre une
promesse que plus personne ne réglera).

**La recherche n’est pas devenue plus rapide — ce n’était pas l’objet.** C’est le même SQL, simplement
plus sur le thread qui dessine les fenêtres. Le prochain gain est dans les index (§ 3.6).

**Reproduire :**

```bash
pnpm exec electron-vite build
pnpm exec electron . --remote-debugging-port=9338 \
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding
```

Ouvrir un projet dont `.index/catalog.db` porte 100 000 lignes, puis, depuis la console du renderer,
marteler `window.studio.project.current()` en mesurant son aller-retour pendant que
`window.studio.assets.search({ type: 'video', limit: 200 })` tourne. Toute latence supérieure à
16,7 ms sur la première est une frame perdue par toutes les fenêtres.

## Audit 3 — enregistrer et rouvrir un document 3D

Coût complet d’un ⌘S sur le thread principal — décoder le clone IPC, puis produire le texte. Un
`invoke` fait traverser un **objet**, pas un texte : `ipcMain` en décode le clone structuré sur le
thread principal avant d’appeler le handler, et l’ignorer sous-estime le coût réel.

| Nœuds | Total main | dont `JSON.stringify` | part du décodage | % du seuil de 16 ms |
|---|---|---|---|---|
| 50 | **0,130 ms** | 0,038 ms | 71 % | 1 % |
| 500 | 1,41 ms | 0,364 ms | 74 % | 9 % |
| 5 000 | 14,6 ms | 3,90 ms | 73 % | 91 % |
| 10 000 | 29,4 ms | 7,92 ms | 73 % | 184 % |
| 50 000 | 163 ms | 39,9 ms | 76 % | 1019 % |

Franchissement des 16 ms : **≈ 5 500 nœuds**.

`documents.ts` écrit sans indentation, et l’instinct était juste — l’indentation coûtait 1,7×
(6,70 ms contre 3,90 ms à 5 000 nœuds). Mais **c’est la plus petite moitié qui a été optimisée** : le
décodage pèse presque trois fois la sérialisation et n’est traité nulle part. Sans indentation le
plafond passe de ≈ 4 700 à ≈ 5 500 nœuds — pas d’ordre de grandeur.

Ouvrir : côté main, `JSON.parse` + encodage du clone, 0,127 ms à 50 nœuds, 14,0 ms à 5 000. Côté
renderer, la validation contre `property-fields.ts` est du travail sur le thread UI **une fois par
ouverture, pas par frame** — 0,020 ms à 50 nœuds, 19,5 ms à 50 000. Une correction d’une ligne y a
gagné 27 % : la liste des champs numériques d’un matériau était reconstruite
(`Object.entries(MATERIAL_SPECS).filter(…)`) **pour chaque nœud**, alors que la table est une
constante de module.

Le marqueur « modifié », lu par un sélecteur zustand **une fois par frame** pendant un glissement :
**0,00005 ms**, soit 0,0006 % d’une frame.

Corrigé sans mesure : **une double lecture au montage**. Le `StrictMode` de React 19 exécute deux fois
chaque effet, et `DocumentArea` est remonté à chaque changement d’espace — une ouverture valait deux
`JSON.parse` dans le main. `restoreDocument` retient la lecture en cours.

**Reproduire :** `pnpm bench`. Les trois fichiers sont versionnés —
`src/main/project/documents.bench.ts`, `src/renderer/src/engines/scene/scene-document.bench.ts`,
`src/renderer/src/stores/document-store.bench.ts`. Aux grandes tailles les mesures sont dominées par
le GC (`rme` jusqu’à 20 %) : la colonne à retenir est le **minimum**.
