# Scenaria Studio — conception

**Date** : 6 août 2026
**État** : validé, prêt pour la planification d'implémentation

---

## 1. Ce qu'on construit

Un **logiciel de création desktop** bâti sur l'API Scenario. Pas un client web pour une API,
mais un studio : on y génère des images, des vidéos, des modèles 3D, de l'audio, des textures
et des skyboxes, puis on les édite, on les combine, et on les assemble dans des scènes 3D ou
des montages vidéo.

L'unité de travail est le **projet**, un dossier sur le disque. L'unité d'affichage est le
**document ouvert dans un onglet**. Le shell est un système de docks à la VSCode/DaVinci,
dont la disposition change selon l'espace de travail actif.

### Ce que le projet doit démontrer

Ce logiciel est une pièce de portfolio destinée à obtenir un poste. Les trois choses qu'il
doit prouver, dans cet ordre :

1. **Une architecture défendable** : séparation stricte des processus Electron, secrets
   jamais exposés, moteurs sans framework pilotés par React, contrat IPC typé de bout en bout.
2. **La maîtrise d'une API réelle et hostile** : schémas de génération dynamiques, jobs
   asynchrones, erreurs et débit à absorber, une quarantaine de fournisseurs hétérogènes.
3. **Un vrai soin d'exécution** : ce qui est cliquable fonctionne, l'ergonomie est
   cohérente d'un espace à l'autre, les comportements natifs sont là où on les attend.

---

## 2. Les espaces de travail

Sept destinations, dont six éditent des documents et une est une fenêtre de réglages.

| Espace | Documents | Outils | `jobType` mobilisés |
|---|---|---|---|
| **Image** | `.img` — pile de calques Pixi | pinceau, masque, sélection, transform, inpaint, outpaint, détourage, upscale | `image-generation` `flux` `patch-image` `repaint` `restyle` `segment` `reframe` `remove-background` `pixelate` |
| **Video** | `.seq` — pistes | timeline multipiste V+A, découpe, transitions, prévisualisation | modèles vidéo, `video-upscale` |
| **3D** | `.scene` (niveau) et `.obj` (objet) | gizmos translate/rotate/scale, outliner, matériaux, import GLB | modèles 3D, `texture` `splat` `mesh-preview-rendering` |
| **Audio** | `.aud` | waveform, découpe, gain, envoi vers Video | modèles audio |
| **Textures** | `.tex` | tiling, canaux PBR, aperçu sur sphère | `texture` `describe-style` |
| **Skyboxes** | `.sky` | aperçu 360, export HDRI vers la 3D | `skybox-3d` `skybox-base-360` `skybox-hdri` `skybox-upscale-360` |
| **Réglages** | fenêtre native `⌘,` | — | — |

**Génération et édition ne sont pas séparées.** L'espace Image contient à la fois le
générateur et l'éditeur : on ne change pas de contexte pour retoucher ce qu'on vient de
produire. Idem partout ailleurs.

### Le fil inter-espaces

C'est ce qui fait un studio plutôt que sept outils juxtaposés.

```
Image ──▸ Textures ──▸ 3D ──┐
                            ├──▸ Video ──▸ export
Skyboxes ──▸ 3D ────────────┤
Audio ──────────────────────┘
```

Chaque flèche existe sous deux formes : une action « Envoyer vers… » sur l'asset, et un
glisser-déposer depuis l'asset browser vers l'espace cible. Un asset envoyé garde un lien
vers sa source — on peut toujours remonter à l'image qui a produit une texture.

---

## 3. Disposition du shell

```
┌─ Fichier  Édition  Créer  Fenêtre  Aide ──────────── menu natif Electron ─┐
├───────────────────────────────────────────────────────────────────────────┤
│ ●●● │ Image │ Video │ 3D │ Audio │ Textures │ Skyboxes │  barre de titre   │
├──────────┬─────────────────────────────────────────┬──────────────────────┤
│          │ ┌─────────────────────────────────────┐ │                      │
│ EXPLORER │ │ Scène.main ×│ Rocher.obj ×│ Hero ×  │ │  INSPECTEUR          │
│          │ ├─────────────────────────────────────┤ │  paramètres de la    │
│ ▾ Projet │ │                                     │ │  sélection           │
│  ▾ img/  │ │      VIEWPORT / CANVAS              │ │                      │
│  ▾ 3d/   │ │      (l'onglet actif)               │ │  GÉNÉRATEUR          │
│  ▾ tex/  │ │                                     │ │  modèle + prompt +   │
│  ▾ vid/  │ └─────────────────────────────────────┘ │  champs dynamiques   │
├──────────┴─────────────────────────────────────────┴──────────────────────┤
│ ASSET BROWSER            │ TIMELINE / CALQUES / OUTLINER                   │
│ ▦ ▦ ▦ ▦  filtres · tags  │ selon l'espace actif                           │
├───────────────────────────────────────────────────────────────────────────┤
│ ● 3 jobs   ⣾ Flux 62%   ✓ Tripo   ⋯ Veo en file        barre de jobs      │
└───────────────────────────────────────────────────────────────────────────┘
```

Le chrome est entièrement custom (`titleBarStyle: 'hiddenInset'`), les feux de circulation
restent natifs. Les onglets d'espaces vivent dans la barre de titre : on récupère la hauteur
verticale, et l'application ne ressemble pas à une page web dans un cadre.

**Un onglet = un document ouvert**, avec son propre historique undo/redo. Dockview gère le
déplacement entre groupes, le split et le détachement en fenêtre.

---

## 4. Architecture des processus

```
┌─ MAIN (Node) ─────────────────── seul à connaître la clé API ─┐
│  ScenarioClient   @scenario-labs/sdk                          │
│  ModelRegistry    cache des schémas GET /models/{id}           │
│  JobManager       file · job.wait() · progression → events     │
│  ProjectStore     dossier .scenaria · catalog.db · watcher     │
│  AssetStore       LocalBackend | ScenarioCloudBackend          │
│  MediaService     ffmpeg · sondes · vignettes                  │
│  SettingsStore    safeStorage OS pour les secrets              │
│  WindowManager    fenêtres · popout Dockview · état persisté   │
└───────────────────────────┬───────────────────────────────────┘
                     contrat IPC typé
┌───────────────────────────┴───────────────────────────────────┐
│ PRELOAD    contextBridge — aucune API Node exposée            │
└───────────────────────────┬───────────────────────────────────┘
┌───────────────────────────┴───────────────────────────────────┐
│ RENDERER(S)   React 19 + Dockview                             │
│   engines/    CanvasEngine (Pixi) · SceneEngine (three)        │
│               TimelineEngine (WebCodecs) · AudioEngine         │
│               → sans React, recréables depuis leur état         │
│   stores/     Zustand synchronisés par broadcast IPC           │
└───────────────────────────────────────────────────────────────┘
```

### Les invariants, non négociables

1. **Le renderer n'a jamais la clé API**, ni `fs`, ni `child_process`. `nodeIntegration`
   désactivé, `contextIsolation` activé, `sandbox` activé.
2. **Tout franchissement de frontière passe par `shared/ipc.ts`**, typé des deux côtés.
   Aucun `ipcRenderer.invoke` avec une chaîne littérale dans un composant.
3. **Un moteur est recréable depuis son état sérialisé**, jamais depuis son DOM. Cette
   contrainte vient du multi-fenêtres — un contexte WebGL ne survit pas au déplacement entre
   documents — mais elle offre en prime un save/load et un undo fiables.
4. **`shared/` n'a aucune dépendance runtime.** Types et constantes uniquement.

### Le multi-fenêtres

Dockview détache un groupe d'onglets via `window.open` ; Electron l'intercepte avec
`setWindowOpenHandler` et crée une vraie `BrowserWindow`. Deux catégories de panneaux :

- **Panneaux légers** (inspecteur, asset browser, explorer, jobs) : le DOM est adopté par la
  nouvelle fenêtre, l'état suit par synchronisation de store.
- **Panneaux à contexte GPU** (viewport 3D, canvas image, prévisualisation vidéo) : le moteur
  est **détruit et reconstruit** dans la fenêtre cible depuis son état sérialisé.

L'état des documents est détenu par le main ; chaque renderer en tient une réplique Zustand
mise à jour par diffusion IPC. Une seule fenêtre détient le *focus d'édition* d'un document
donné, pour éviter deux historiques undo divergents sur la même chose.

---

## 5. Modèle de données

### Le projet

```
MonProjet.scenaria/
├── project.json          manifest : nom, version, réglages du projet
├── assets/
│   ├── img/  3d/  tex/  vid/  aud/  sky/
├── documents/            .img .scene .obj .seq .aud .tex .sky
├── .index/
│   └── catalog.db        SQLite : assets, tags, dérivations, recherche
└── layouts/              dispositions Dockview sérialisées, par espace
```

Un **dossier**, pas un fichier binaire — comme Unreal ou Blender. Versionnable, inspectable,
réparable à la main.

### Les entités

| Entité | Rôle | Vit dans |
|---|---|---|
| `Asset` | un média + ses métadonnées : type, tags, `location`, origine (`jobId`/`assetId` Scenario), dérivations | `catalog.db` + fichier |
| `Document` | ce qu'un onglet édite ; référence des assets, ne les duplique pas | `documents/` |
| `Job` | une génération en cours ou terminée | mémoire + `catalog.db` |
| `ModelDescriptor` | un modèle Scenario + son schéma d'entrées traduit | cache `ModelRegistry` |

### Stockage des assets — local par défaut, cloud en option

`AssetStore` expose une interface unique et délègue à un backend :

- **`LocalBackend`** (défaut) : le disque est la vérité. Toute génération est rapatriée dans
  `assets/` et indexée. L'application reste utilisable hors ligne, sauf pour générer. Le
  scrubbing vidéo et le chargement 3D ne dépendent jamais du réseau.
- **`ScenarioCloudBackend`** (activable dans les réglages) : la bibliothèque Scenario devient
  une source consultable et un emplacement de stockage.

Chaque asset porte sa `location`. **Pas de synchronisation automatique** : deux actions
explicites, « pousser vers le cloud » et « rapatrier ». Un moteur de synchro bidirectionnelle
est un projet à part entière et une source inépuisable de bugs — on ne le construit pas.

---

## 6. La gestion des modèles

C'est la pièce centrale, celle qui distingue ce projet d'un CRUD illustré.

L'API expose un endpoint de génération unique, `POST /generate/custom/{modelId}`, dont le
corps est **propre à chaque modèle** et typé `unknown` dans le SDK. Le schéma réel se
découvre à l'exécution via `GET /models/{modelId}` → `inputs`. Avec une quarantaine de
fournisseurs répartis sur image, vidéo, 3D, audio, upscale, détourage et vectorisation,
écrire les formulaires à la main est intenable et périmé à chaque nouveauté Scenario.

```
GET /models  (paginé)
      │  cache SQLite + TTL
      ▼
GET /models/{id} → inputs
      │
      ▼  ModelRegistry.describe()
FieldDescriptor[]  { key, kind, label, min, max, step,
                     default, options, dependsOn, group }
      │
      ▼  renderer
<DynamicForm/>  ── react-hook-form + schéma zod construit à la volée
      │
      ▼
POST /generate/custom/{modelId} → Job → JobManager.wait() → Asset
```

**Aucun formulaire écrit à la main.** Un nouveau fournisseur chez Scenario n'appelle aucune
ligne de code chez nous. Des **presets** par modèle sont enregistrés dans le projet.

Le `ModelRegistry` doit tolérer l'inattendu : un champ dont le `kind` est inconnu se rend en
saisie brute plutôt que de faire disparaître le formulaire.

### Le cycle de vie d'un job

```
soumission ──▸ queued ──▸ in-progress ──▸ success ──▸ asset rapatrié + indexé
                  │            │              │
                  └── annulable┘              └─ failure ──▸ erreur portée à l'UI
```

Le `JobManager` détient la file, borne la concurrence (réglable), applique un backoff
exponentiel sur 429 et 5xx, et diffuse la progression au renderer par events. La barre de
jobs est globale : on lance une génération vidéo et on part travailler ailleurs.

---

## 7. Interface et design system

### Socle

Design system maison pour tout ce qui vit dans un dock. DaisyUI conservé aux marges :
préférences, dialogues, clés API, onboarding. **La règle est simple et elle est écrite dans
`CLAUDE.md` : si le composant vit dans un dock, il est maison.**

Motif repris de `map3D` : `ToolButton` avec icône `@mdi/js`, état actif, tooltip et
`aria-label` porteurs du raccourci ; `Toolbar` à sections remplaçables par slots ;
`FloatingPanel` et dock épinglé ; thème traduit en variables CSS.

### Direction visuelle

Relevée sur `app.scenario.com`, puis resserrée pour un studio.

| Jeton | Valeur | Usage |
|---|---|---|
| `bg-base` | `#121212` | fond de l'application |
| `bg-surface` | `#1d1f27` | panneaux, docks |
| `bg-elevated` | `#252833` | menus, popovers |
| `accent` | `#3c5ccf` | sélection, état actif |
| `danger` | `#ff715b` | destructif, erreurs de job |
| `text` / `text-muted` | `#f8efe6` / `#8b8d98` | — |
| rayons | 4 / 6 / 8 px | — |
| police | Poppins (UI), Geist Mono (valeurs) | — |
| densité | contrôles 24 px compact, 28 px confort | réglable |

**Le fond reste opaque.** Pas de vibrancy ni de transparence : dans un studio on juge des
couleurs, un fond translucide fausse la perception de tout ce qui est affiché au-dessus.
C'est une décision de métier, pas d'esthétique.

### Comportements natifs retenus

Menu applicatif et raccourcis système · dialogues open/save natifs · glisser-déposer depuis
le Finder **et vers** le Finder (`webContents.startDrag`) · progression des jobs sur l'icône
du Dock · notification à la fin d'un job long · `setDocumentEdited` et documents récents ·
protocole `scenaria://` · position et taille des fenêtres restaurées.

**Écartés** : vibrancy, imitation des contrôles système, barre de titre native.

---

## 8. Les réglages

Fenêtre native dédiée, ouverte par `⌘,`. Les réglages *du projet* restent un panneau du shell.

| Onglet | Contenu |
|---|---|
| Compte | clé et secret API chiffrés par `safeStorage` (Keychain / DPAPI), test de connexion, consommation via `usages`, tarifs via `pricing` |
| Apparence | thème, accent, densité, police, échelle |
| Génération | modèle par défaut par type, jobs simultanés, politique de retry, action en fin de job |
| Stockage | backend d'assets (local / cloud), emplacement des projets, cache disque et purge, dossier d'export |
| Raccourcis | table remappable, détection de conflits, export/import |
| Performance | résolution du viewport, qualité des vignettes, plafond mémoire du cache |
| Avancé | chemin ffmpeg, niveau de log, DevTools, réinitialisation |

**Les secrets ne sont jamais écrits en clair** et ne traversent jamais l'IPC en lecture :
le renderer demande « suis-je authentifié ? », pas « quelle est ma clé ? ».

---

## 9. Arborescence

```
scenaria/
├── CLAUDE.md
├── electron.vite.config.ts · electron-builder.yml
├── docs/
│   ├── scenario-api/         base de connaissance (209 pages)
│   └── specs/
├── scripts/fetch-scenario-docs.sh
├── resources/                icône, binaires ffmpeg
└── src/
    ├── shared/               contrat main ⇄ renderer, zéro dépendance
    │   ├── ipc.ts
    │   ├── domain/           Asset · Document · Job · ModelDescriptor
    │   └── settings.ts
    ├── main/
    │   ├── windows/ menu/ ipc/
    │   ├── scenario/         client · ModelRegistry · JobManager
    │   ├── project/          ProjectStore · catalog · watcher
    │   ├── assets/           AssetStore · LocalBackend · ScenarioCloudBackend
    │   ├── media/            ffmpeg · probe · thumbnails
    │   └── settings/
    ├── preload/
    └── renderer/src/
        ├── app/              chrome · titlebar · Dockview · espaces
        ├── design/           jetons + primitives maison
        ├── engines/          cœur sans React
        │   ├── canvas/       CanvasEngine · Layer · Tool · History
        │   ├── scene/        SceneEngine · Outliner · Gizmo
        │   ├── timeline/     TimelineEngine · Track · Clip
        │   └── audio/
        ├── spaces/           image/ video/ three/ audio/ textures/ skyboxes/
        ├── panels/           explorer · assets · jobs · inspector · generator
        ├── stores/
        └── hooks/
```

`engines/` applique la règle de `map3D` : le cœur ignore React, React le pilote. Tests
colocalisés en `*.test.ts`.

---

## 10. Dépendances

| Domaine | Paquets |
|---|---|
| Socle | `electron` · `electron-vite` · `electron-builder` · `react` 19 · `react-dom` · `typescript` · `vite` |
| Shell | `dockview-react` · `tailwindcss` 4 + `@tailwindcss/vite` · `daisyui` · `@mdi/js` + `@mdi/react` · `@tanstack/react-virtual` · `@dnd-kit/*` · `react-toastify` · `tailwind-merge` |
| État | `zustand` + `immer` + `zundo` · `@tanstack/react-query` · `react-hook-form` + `@hookform/resolvers` · `zod` |
| Moteurs | `pixi.js` v8 · `three` · `three-mesh-bvh` · `wavesurfer.js` · `mediabunny` |
| Main | `@scenario-labs/sdk` · `better-sqlite3` · `electron-store` · ffmpeg embarqué |
| Qualité | `prettier` + `prettier-plugin-tailwindcss` · `eslint` 10 + `typescript-eslint` · `vitest` + `@testing-library/react` · `@playwright/test` |

**ffmpeg est embarqué** (build LGPL, environ 80 Mo par plateforme). Dépendre d'un ffmpeg
système rendrait le logiciel non distribuable : qui télécharge un `.dmg` n'installe pas
Homebrew d'abord.

Conventions reprises de GoSecure : Prettier en 2 espaces, guillemets simples, sans
point-virgule, `printWidth` 100, `arrowParens: avoid`. Alias `@/`. TypeScript strict, zéro
`any`, `type` plutôt qu'`interface`.

---

## 11. Risques identifiés

| Risque | Traitement |
|---|---|
| Contexte WebGL perdu au détachement de fenêtre | Moteurs recréables depuis leur état, dès la première ligne |
| Schémas de modèles imprévisibles | `kind` inconnu → saisie brute, jamais de formulaire vide |
| Débit de l'API inconnu (aucun seuil publié) | Backoff exponentiel, concurrence bornée et réglable |
| `better-sqlite3` est natif → recompilation Electron | `electron-rebuild` câblé dès le premier commit |
| Deux fenêtres éditant le même document | Un seul détenteur du focus d'édition par document |
| Poids du binaire (ffmpeg + Electron) | Assumé : c'est le prix d'un logiciel qui s'installe et fonctionne |

---

## 12. Ce qu'on ne construit pas

À dire explicitement, pour que ce soit un choix et pas un oubli :

- Pas de synchronisation bidirectionnelle des assets.
- Pas de collaboration temps réel ni de multi-utilisateurs.
- Pas d'éditeur de nœuds maison — l'API `workflows` de Scenario est pilotable, on l'expose
  sans réimplémenter son interface.
- Pas d'entraînement de modèles dans une première version, bien que l'API l'offre
  (`models.train`) : c'est un espace de travail à part entière.
- Pas d'auto-update tant que le logiciel n'est pas distribué.
