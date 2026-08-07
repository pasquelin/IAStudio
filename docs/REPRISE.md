# Prompt de reprise — Scenario Studio

Copier-coller le bloc ci-dessous au début d'une nouvelle session.

> Pour comprendre le logiciel plutôt que reprendre son développement : le
> [guide de l'utilisateur](fr/guide-utilisateur.md) et la [doc d'architecture](fr/architecture.md),
> tous deux également [en anglais](en/).

**Dernière mise à jour : 7 août 2026**, à `b3434ab`.

---

Je reprends le développement de **Scenario Studio**, dans `/Users/pasquelin/Applications/scenario`.

## Avant toute chose, lis dans cet ordre

1. `CLAUDE.md` — conventions et invariants. **La règle de langue est en tête : tout le code de
   `src/` est en anglais**, identifiants ET commentaires. Seules exceptions :
   `src/shared/i18n/fr.json` et les libellés attendus dans les tests qui viennent du bundle i18n.
2. `docs/specs/2026-08-06-scenario-studio-design.md` — la conception validée, 13 sections.
3. La spec du domaine que tu touches : `docs/specs/2026-08-07-espace-3d-design.md`,
   `docs/specs/2026-08-07-configuration-design.md`.
4. `docs/scenario-api/README.md` — l'index de la doc API Scenario aspirée en local (209 pages).
   **La consulter avant d'aller sur le web.**
5. `docs/perf/` — les audits déjà menés. **Leurs conclusions sont acquises : ne pas refaire ces
   mesures.**

Puis : `git log --oneline -15`, `find src -type f -name '*.ts*' | sort`, et `pnpm validate` pour
partir d'une base verte.

## L'état, en quatre chiffres

**511 fichiers dans `src/`, 1806 tests verts, 72 canaux IPC, 5 espaces éditables.**
`pnpm validate` est vert. L'application démarre par `pnpm start`.

## Ce qui est fait

**Le socle** — Electron + electron-vite + React 19 + TypeScript, shell à docks type IDE, design
system maison (`renderer/src/design/`), i18n fr/en partagé entre le menu natif et l'UI, contrat
IPC typé des deux côtés, `contextIsolation`/`sandbox` actifs, navigation verrouillée.

**La chaîne de génération** — réglages chiffrés par `safeStorage`, client `@scenario-labs/sdk`
dans le main, `ModelRegistry` avec auto-pagination et cache, `JobManager` qui poll seul et borne
la concurrence, `DynamicForm` construit depuis les descripteurs. Aucun formulaire de génération
écrit à la main (invariant 5).

**Les projets** — un dossier, un manifeste, un catalogue SQLite. Le catalogue tourne sur son
propre `worker_threads` : de 16 blocages du thread principal à 0 (`docs/perf/2026-08-08-catalogue-worker.md`).

**Les cinq espaces** — Image (PixiJS), 3D (three.js), Vidéo (timeline, moniteur, ffmpeg), Audio,
Skyboxes. Un éditeur par type de document, chargé à l'ouverture, jamais avant.

**La configuration** — un registre de commandes unique lu par le menu natif, le clavier et
l'écran des raccourcis ; un registre de réglages qui gouverne l'écran des préférences et la
validation côté main.

**La persistance des documents** — `main/project/documents.ts` écrit un document dans
`documents/<id>.<ext>`, atomiquement (fichier de transit puis `rename`) et en file d'attente par
fichier. **Seul l'espace 3D y est branché** : ⌘S écrit la scène, un onglet rouvert la relit, et
la puce sur l'onglet dit ce qui n'est pas sur le disque.

## Ce qu'il reste à faire

### D'abord — les documents ne sont pas finis

Le tuyau existe et une seule vanne est ouverte. Dans l'ordre :

1. **Les documents appartiennent à un projet.** Aujourd'hui `useDocuments` est persisté sans clé
   de projet, et `documents.write` résout le chemin via le projet *courant*. Projet A ouvert,
   onglet enregistré, on ouvre B : ⌘S écrit la scène de A dans `B/documents/`. Pire au
   rechargement — la lecture dans B rend `null` et l'onglet reçoit la scène par défaut par-dessus
   ce que l'utilisateur croit être son document. **C'est une perte de données, et c'est le point
   le plus urgent du dépôt.** Le remède touche les cinq espaces : changer de projet ferme les
   onglets.
2. **Fermer un onglet ne demande rien** et laisse son fichier orphelin. Personne n'appelle
   `useDocuments.close` ni `documents.remove` ; `pruneDocuments` ne nettoie qu'au démarrage
   suivant. La puce « modifié » existe mais n'est consultée nulle part à la fermeture.
3. **Les quatre autres espaces ne savent pas s'enregistrer.** `IO_BY_KIND` dans
   `app/document-io.ts` n'a qu'une entrée. Chacun a besoin de sa paire
   sérialiser / relire-et-valider ; le reste — marque, puce, ⌘S — est déjà générique.
4. **Rien ne rapporte une erreur à l'utilisateur.** `handle` ne journalise pas une promesse
   rejetée, et le renderer n'a aucune surface pour le dire. Un ⌘S qui échoue laisse la puce, et
   c'est tout ce qu'il raconte. Une ouverture qui échoue ne dit rien du tout.

Deux comportements du mécanisme d'enregistrement à connaître avant d'y toucher — le second est
un bug, le premier est délibéré :

- **Un document dont le fichier a refusé de s'ouvrir ne s'enregistre plus du tout**, jusqu'à sa
  prochaine ouverture (le `Set` `unreadable` dans `app/document-io.ts`). C'est voulu : l'éditeur
  vide qu'une lecture ratée laisse est indistinguable d'un document neuf, et sans ce refus le
  premier ⌘S écrirait `{ nodes: [] }` par-dessus la scène illisible. Mais combiné au point 4,
  l'utilisateur voit un document qui refuse de s'enregistrer sans jamais savoir pourquoi. **Le
  vrai remède est une surface d'erreur**, pas la levée du refus.
- **La marque « modifié » peut mentir après plus de 100 modifications suivies d'une annulation
  complète.** `markOf` vaut `past.at(-1) ?? null`, et `HISTORY_LIMIT` plafonne la pile à 100 :
  au-delà, les plus anciennes commandes tombent, une annulation intégrale ramène `past` à vide,
  donc à `null` — la valeur qu'un document enregistré alors que son historique était vide porte
  aussi. Le document se dit propre alors qu'il ne l'est pas. Le remède est un jeton monotone par
  commande, dans `engines/core/history.ts`, partagé par tous les espaces.

### Ensuite — l'éditeur 3D

Ce qui existe : 17 primitives, 5 types de lumières, gizmo translate/rotate/scale, sélection par
raycast, inspecteur dérivé des descripteurs, undo avec coalescing par geste, 5 slots de textures
PBR, outliner, vol libre, et l'enregistrement.

Ce qui manque, vérifié sur `main` :

| Manque | Preuve |
|---|---|
| Sélection multiple | `SceneState.selectedId` est un `string \| null` |
| Groupes / reparentage | `parentId` existe, aucune commande ne le change |
| Dupliquer, copier-coller | aucune commande dans `commands.ts` |
| Magnétisme, pivot local/monde | aucun `setTranslationSnap`, aucun `setSpace` |
| Import de modèles | aucun `GLTFLoader`, Draco ou KTX2 — alors que `mesh` est un `AssetType`. **C'est lui qui fera franchir le plafond de ⌘S** — cf. la section Performance |
| `sprite` et `text` | déclarés sans `create`, donc grisés |
| Ombres | aucun `castShadow`, `receiveShadow`, `shadowMap` |
| Environnement / IBL dans le viewport | `PMREMGenerator` n'existe que pour les skyboxes |
| Caméra ortho, vues normalisées, filaire | rien dans le viewport |
| Instanciation, LOD, BVH pour le picking | le raycast parcourt tous les objets |

L'ordre conseillé : **sélection multiple** tant que le code est petit — elle touche l'état,
l'inspecteur, le gizmo et l'outliner — puis **magnétisme et pivot** (deux appels d'API
`TransformControls`, gain d'ergonomie immédiat), puis **l'import glTF**, puis **ombres et HDRI**,
et enfin groupes, duplication, modes d'affichage, export.

### Ce qui traîne ailleurs

- **Le catalogue n'a pas d'index composite `(type, created_at DESC)` ni de FTS5.** Les requêtes
  coûteuses tombées sous la milliseconde qu'annonce l'audit ne sont pas encore gagnées : le
  worker a déplacé le coût, les index le supprimeraient.
- **Une recherche engagée ne s'interrompt pas** : six frappes produisent six recherches. Elles ne
  bloquent plus rien mais occupent le thread.
- **`pnpm start` charge `out/renderer/` au lieu du serveur Vite**, parce que
  `scripts/dev-app-identity.mjs` renomme le bundle Electron et met `app.isPackaged` à `true` en
  développement. La fenêtre est vide. Contournement : `pnpm exec electron-vite build` puis
  `pnpm exec electron .`. Le remède est de comparer `process.defaultApp` plutôt que
  `app.isPackaged` dans `main/window/windows.ts`.

## Performance — les règles non négociables

**Invariant 6 : le thread UI ne fait que de l'UI.** Deux seuils, pas un :

- **8,33 ms** — le budget par frame du renderer sur un écran 120 Hz. C'est le chiffre qui compte,
  pas les 16,7 ms d'un écran 60 Hz.
- **16 ms** — au-delà, une opération synchrone dans le **main** gèle TOUTES les fenêtres, y
  compris les détachées.

Ce qui part hors du thread UI, dans l'ordre du réflexe : GPU, Web Worker, OffscreenCanvas +
Worker, `utilityProcess`. Toute tâche longue est **annulable**, **rapporte sa progression**, et
tourne dans un pool borné à `hardwareConcurrency − 2`.

**Une optimisation non mesurée est une complexité gratuite.** Mesurer en build de **production**,
jamais en dev : le profil dev est dominé par `jsxDEV` et `validateProperty`, qui n'existent pas en
production. `pnpm bench` rejoue les micro-benchmarks ; `docs/perf/` porte le protocole complet et
ses pièges.

Deux plafonds déjà chiffrés, à ne pas redécouvrir :

- Le chemin chaud de l'inspecteur 3D **n'est pas un problème** : 3,31 ms sur 8,33 ms au pire cas,
  zéro frame perdue sur 299.
- **Un ⌘S gèle toutes les fenêtres au-delà de ~5 500 nœuds**, et c'est le décodage du clone IPC —
  73 % du coût — pas la sérialisation. Inatteignable au menu Ajouter, atteignable à l'import glTF.

## Contraintes à ne pas perdre de vue

- La clé API ne quitte jamais le process main. Le renderer demande « suis-je authentifié ? »,
  jamais « quelle est ma clé ? ».
- Tout handler qui prend des arguments venant du renderer les **valide à l'exécution** (`zod`) :
  le contrat TypeScript est effacé au runtime.
- Zéro `any`, pas de `as const`, `type` plutôt qu'`interface`, pas de `as` sans le pourquoi en
  commentaire d'une ligne.
- **Une feature = une branche = un worktree**, dans `.claude/worktrees/`, partant de `main`.
  Plusieurs sessions travaillent en parallèle dans ce clone : `git add` par chemin explicite,
  jamais `git add -A`, jamais de `git stash` nu. Préfixe chaque commande par le chemin absolu de
  ton worktree — le shell retombe ailleurs entre deux appels, et un build lancé au mauvais endroit
  écrase le `out/` du voisin.
- **Definition of done** : les tests unitaires accompagnent le code dans le même mouvement, puis
  `pnpm validate`, puis `/simplify`, puis `/code-review`, puis seulement on annonce la livraison.

Commence par me proposer ton plan avant de coder.
