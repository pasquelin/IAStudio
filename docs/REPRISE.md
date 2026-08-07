# Prompt de reprise — Scenario Studio

Copier-coller le bloc ci-dessous au début d'une nouvelle session.

---

Je reprends le développement de **Scenario Studio**, dans `/Users/pasquelin/Applications/scenario`.

## Avant toute chose, lis dans cet ordre

1. `CLAUDE.md` — conventions et invariants. **La règle de langue est en tête : tout le code de `src/` est en anglais**, identifiants ET commentaires. Seules exceptions : `src/shared/i18n/fr.json` et les libellés attendus dans les tests qui viennent du bundle i18n.
2. `docs/specs/2026-08-06-scenario-studio-design.md` — la conception validée, 13 sections.
3. `docs/superpowers/plans/2026-08-06-socle.md` — le plan du socle, dont les tâches 1 à 10 sont faites.
4. `docs/scenario-api/README.md` — l'index de la doc API Scenario aspirée en local (209 pages). **La consulter avant d'aller sur le web.**

Puis : `git log --oneline -15`, `find src -type f -name '*.ts*' | sort`, et `pnpm validate` pour partir d'une base verte.

## Ce qui est fait

Le **socle applicatif** est complet et testé : 62 tests verts, `pnpm validate` vert, l'application démarre par `pnpm dev` (hot reload sur main, preload et renderer).

- **Electron + electron-vite + React 19 + TypeScript**, trois cibles, alias `@/`, `@shared/`, `@main/`.
- **Shell type IDE** : rails d'icônes aux bords, quatre zones dockables (`left`/`right`/`top`/`bottom`), une fenêtre d'outil par zone, redimensionnement borné qui réserve la place du centre, repli, Dockview au centre pour les documents uniquement, barre de titre custom avec feux natifs, ligne d'état.
- **Design system maison** (`renderer/src/design/`) : `ToolButton`, `Toolbar` (slots, transposée de map3D), `UiIcon`, `Separator`, `TooltipHost`, `cn`.
- **i18n** français/anglais, un JSON par langue dans `shared/i18n/`, partagé entre le menu natif et l'UI.
- **Contrat IPC typé des deux côtés** : `shared/ipc.ts` déclare `CHANNELS` en types littéraux et `StudioBridge` ; `main/ipc/handle.ts` dérive la signature de chaque handler du canal lui-même.
- **Sécurité** : `contextIsolation`/`sandbox` actifs, navigation verrouillée au niveau `app` (`main/window/navigation.ts`), `openExternal` filtré sur `https:`, DevTools retirés des builds packagés.
- **Prêt mais pas câblé** : `main/settings/store.ts` (chiffrement `safeStorage`, testé) et `main/scenario/schema.ts` (`translateSchema`, `familyOf`, testé) ne sont importés nulle part.

Le code a passé `/simplify` et une revue en cinq angles ; les corrections sont appliquées et commitées.

## Où ça s'arrête exactement

**Deux handlers IPC sur dix-huit canaux déclarés.** Seuls `window:state` et `window:toggle-full-screen` existent côté main. Les canaux `settings:*`, `scenario:*`, `project:*` et `assets:*` sont déclarés, typés, exposés par le preload — et rejettent à l'appel.

Conséquence : on ne peut ni saisir ses identifiants, ni lister les modèles, ni générer. Les panneaux Génération et Assets affichent leur état vide parce qu'il n'y a rien derrière.

## Ce que je veux faire maintenant

Rendre l'application testable de bout en bout : **saisir mes identifiants, voir la liste de mes modèles Scenario, et générer une image**.

Dans cet ordre :

1. **Réglages** — un `PersistenceAdapter` réel (`electron-store` + `safeStorage`), instancier `createSettingsStore`, câbler les 5 canaux `settings:*`.
2. **Client Scenario** — `@scenario-labs/sdk` dans le main, lisant les identifiants du store, avec repli sur `secrets/.env` en développement (le fichier existe déjà, lu **à l'exécution**, jamais bundlé — voir `secrets/README.md`). Traduire les `Scenario.APIError` en codes de `AuthFailure`, jamais en texte brut.
3. **ModelRegistry** — `GET /models` avec auto-pagination et cache, `GET /models/{id}` → `translateSchema` (déjà écrit et testé) → `ModelDescriptor`. Câbler `scenario:list-models` et `scenario:describe-model`.
4. **UI** — un panneau Compte pour saisir clé et secret, et le panneau Génération qui liste les modèles de la famille de l'espace actif (`workspaces.ts` porte déjà `family`).
5. **JobManager** — file bornée, backoff exponentiel sur 429/5xx, `job.wait()` du SDK, progression poussée par `evt:job-progress`.
6. **DynamicForm** — le formulaire construit depuis `FieldDescriptor[]`, avec `react-hook-form` + `zod`. **Aucun formulaire de génération écrit à la main** (invariant 5).

## Thème et design system — ne pas réinventer

La direction visuelle est **calquée sur une interface JetBrains**, validée capture à l'appui. Elle
est déjà en place dans `src/renderer/src/index.css` : **ne pas toucher à la palette, ne pas écrire de
valeur hexadécimale dans un composant, ne pas ajouter de bibliothèque de composants.**

### La règle qui gouverne le reste

**Le châssis est plus CLAIR que les surfaces.** C'est l'inverse de l'habitude web, et c'est
précisément ce qui donne la lecture « panneaux posés » d'un IDE : un fond gris moyen qui sert de
gouttière, et des surfaces plus sombres, arrondies, flottant dessus.

| Jeton | Valeur | Rôle |
|---|---|---|
| `chassis` | `#2b2d30` | fond de fenêtre, gouttière entre les surfaces |
| `base` | `#191a1c` | surfaces : panneaux, centre |
| `surface` | `#202124` | contenus à l'intérieur d'une surface |
| `elevated` | `#3c3f44` | survol, état actif d'un bouton |
| `border` | `#34363a` | séparateurs |
| `accent` / `accent-soft` | `#3574f0` / `#2e436e` | zone focalisée, sélection |
| `danger` | `#ff715b` | destructif, échec de job |
| `text` / `muted` | `#dfe1e5` / `#868a91` | — |

Rayons : `--radius-sc-sm/md/lg` = 4 / 6 / 10 px. Police : Inter (UI), SF Mono (valeurs).

### Gabarits, pilotés par la densité

Tout est en variables CSS, jamais en dur. `[data-density='compact']` les réduit en bloc, posé par
`useDensity` sur l'élément racine.

| Variable | Confort | Compact |
|---|---|---|
| `--sc-control` | 28 px | 24 px |
| `--sc-rail` / `--sc-rail-button` | 48 / 36 px | 42 / 32 px |
| `--sc-gutter` | 6 px | 4 px |
| `--sc-header` | 32 px | 28 px |

Deux ombres, et deux seulement : `--sc-shadow-furniture` pour les meubles (barres, docks) et
`--sc-shadow-floating` pour ce qui vient de s'ouvrir par-dessus.

### Primitives existantes — les réutiliser

`src/renderer/src/design/` :

- **`ToolButton`** — le bouton d'outil. Icône `@mdi/js`, états `active` (fond neutre) et
  `accented` (fond bleu, quand la zone a le focus), variante `header` pour les barres de titre de
  panneau, nom accessible portant le raccourci. **Tout bouton d'icône passe par lui.**
- **`Toolbar`** — la barre partagée, transposée de map3D : sections en slots (`false` masque, un
  `ReactNode` remplace), `extras` pour les outils de l'espace, annuler/rétablir intégrés.
- **`UiIcon`** — unique porte d'entrée des icônes. **Aucun SVG inline dans un composant.**
- **`Separator`**, **`TooltipHost`** (infobulle partagée montée une fois à la racine),
  **`tooltip.ts`** (instances `TIP_TOP` / `TIP_RIGHT` / `TIP_BOTTOM` — ne jamais fabriquer une
  infobulle dans un corps de composant), **`cn`**, **`slots.ts`**.
- **`Panel`** — la surface arrondie sombre dont le studio est fait, et **`PanelHeader`**, sa
  ligne de titre sur la gauge `--sc-header`.
- **`Row`** — **la** ligne, partout : vignette ou icône, titre, sous-titre, actions, infobulle
  sur le nom tronqué. Le stack de calques, l'outliner, les panneaux maillages et lumières, les
  modèles et les assets en dépendent. Une ligne écrite à la main est un bug de style.
- **`Collection`** — la liste virtualisée à deux vues (grille et lignes), et **`CollectionBar`**,
  sa barre de recherche, de facettes et de tri.
- **`MediaTile`** (la tuile carrée légendée) et **`Thumbnail`** (la même image à taille fixe,
  pour une ligne ou un en-tête). Les deux partagent `useLoadable` — une URL signée expire, le
  placeholder doit prendre la relève.
- **`EmptyState`**, **`DynamicForm`** (le seul formulaire de génération : cf. invariant 5),
  **`Tree`**, **`Flyout`**, **`MenuButton`**, **`MenuRow`**, **`Timecode`**.
- **`styles.ts`** — les chaînes de classes partagées par plus d'un composant : `FOCUS_RING`,
  `CONTROL` (les contrôles de barre), `MEDIA_FRAME` (le cadre des images). Une forme propre à un
  seul composant reste chez lui.

Dans `app/` : `Rail`, `ToolWindow`, `ResizeHandle`, `TitleBar`, `Footer`.

### Trois règles non négociables

1. **Le fond reste opaque.** Pas de vibrancy, pas de transparence de fenêtre. Dans un studio on
   juge des couleurs : un fond translucide fausse la perception de tout ce qui est au-dessus.
   C'est une décision de métier, pas d'esthétique — ne pas la « améliorer ».
2. **Si le composant vit dans un dock, il est maison.** DaisyUI est réservé aux surfaces où
   l'application redevient une application : préférences, dialogues, clés API, onboarding.
3. **Les onglets appartiennent au centre.** Un document a un nom, donc un onglet. Un outil a une
   icône, donc une place sur un rail. Aucune fenêtre d'outil n'entre dans le centre.

Icônes : `@mdi/js` + `@mdi/react` exclusivement, via `UiIcon`.

## Contraintes à ne pas perdre de vue

- La clé API ne quitte jamais le process main. Le renderer demande « suis-je authentifié ? », jamais « quelle est ma clé ? ».
- Tout handler qui prend des arguments venant du renderer doit les **valider à l'exécution** (`zod` est déjà en dépendance) : le contrat TypeScript est effacé au runtime, et `main/ipc/handle.ts` est le point de passage naturel pour ça.
- Zéro `any`, pas de `as const`, `type` plutôt qu'`interface`, pas de `as` sans le pourquoi en commentaire d'une ligne.
- **Definition of done** : les tests unitaires accompagnent le code dans le même mouvement, puis `pnpm validate`, puis `/simplify`, puis `/code-review`, puis seulement on annonce la livraison.

Commence par me proposer ton plan avant de coder.
