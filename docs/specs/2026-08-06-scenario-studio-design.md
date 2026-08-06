# Scenario Studio — conception

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
│  ProjectStore     dossier .scenario · catalog.db · watcher     │
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
MonProjet.scenario/
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
protocole `scenario://` · position et taille des fenêtres restaurées.

**Écartés** : vibrancy, imitation des contrôles système, barre de titre native.

---

## 8. Outils, historique et lecture

### 8.1 La barre d'outils — reprise de `map3D`

**Un seul composant**, dans `design/`, partagé par les six espaces. Chaque espace ne fournit
que son registre d'outils. Repris de `map3D` :

| Mécanisme | Usage ici |
|---|---|
| `ToolButton` — icône `@mdi/js`, état actif, tooltip et `aria-label` porteurs du raccourci | Tous les outils. Un bouton sans nom accessible reste impossible. |
| Sections en **slots** (`components: SlotConfig`) : `false` masque, ReactNode remplace | Un espace masque ce qui ne le concerne pas sans forker la barre |
| **Flyouts de modes** — un seul mode = pas de flyout, le bouton agit directement | Sélection rect/lasso/baguette, pinceau/gomme, translate/rotate/scale |
| `extraTools` | Les outils IA sont des outils normaux, pas des boutons flottants |
| `useFitColumns` — compactage puis passage en colonnes | Indispensable : un panneau docké se redimensionne sans cesse |
| `--sc-bar-scale` — géométrie proportionnelle | Branché sur le réglage de densité |
| Deux profondeurs d'ombre : *meuble* / *surface flottante* | Règle reprise telle quelle |
| Panneaux ancrés portés à la racine, jamais rendus dans la barre | `backdrop-filter` sur la barre en ferait une racine de fond |

Deux adaptations : le `backdrop-filter: blur()` n'est conservé **que** pour les surfaces
flottant au-dessus d'un canvas ou d'un viewport — dans un dock sur fond opaque il ne fait que
coûter de la composition par frame. Et les boutons passent de 38 px à **28 px confort /
24 px compact** : un studio empile bien plus d'outils qu'une carte.

### 8.2 L'espace 3D et l'éditeur three.js

L'éditeur officiel (`mrdoob/three.js/editor/`) **n'est pas une bibliothèque** : pas de
`package.json`, absent du paquet npm `three`, JavaScript non typé avec son propre constructeur
de DOM (`libs/ui.js`) et son bus `signals`. Il n'est donc pas importable. Il est en revanche
sous licence MIT, et sa structure est excellente.

**Repris** : les 24 commandes de `js/commands/` (`AddObject`, `RemoveObject`, `MoveObject`,
`SetPosition/Rotation/Scale`, `SetMaterial*`, `SetGeometry`, `MultiCmds`…), réimplémentées en
TypeScript — c'est le vrai apport ; la structure `Sidebar.Object/.Geometry/.Material` pour
notre inspecteur ; `Loader.js` pour les formats et leurs pièges ; le modèle `Editor` +
`Selector` pour le `SceneEngine`.

**Écarté** : `libs/ui.js`, le CSS, `Player`/`Script`.

L'essentiel de ce qui *se voit* dans cet éditeur vient d'addons présents, eux, dans le paquet
npm : `TransformControls` (gizmos), `ViewHelper` (trièdre), `OrbitControls`, `GLTFLoader` +
`DRACOLoader` + `KTX2Loader`, `RGBELoader` + `PMREMGenerator`, `GLTFExporter`, `USDZExporter`.

### 8.3 L'historique — par grande section

Le mécanisme est générique dans `engines/core/history.ts` ; **chaque grande section instancie
le sien**. `⌘Z` annule la dernière action de la section active, quel que soit l'onglet.

Modèle **Command**, pas snapshot : contrairement à `map3D` dont les états sont petits, ici une
pile de calques 4K ou un mesh de 200 000 triangles interdit de photographier l'état à chaque
action. Chaque moteur déclare ses commandes ; l'historique est générique. On en tire
gratuitement l'historique visible façon Photoshop et le regroupement d'actions.

**Règle qui rend la portée « par section » lisible** : chaque commande porte le document
qu'elle touche, et si l'undo vise un autre document que celui affiché, **l'onglet
correspondant est activé avant d'annuler**. On voit toujours ce qu'on défait.

### 8.4 L'espace Image — calques et masques

| Rapide | Moyen |
|---|---|
| Calques (ordre, opacité, visibilité, verrouillage, groupes) · modes de fusion GPU · **masques de calque et d'écrêtage** · pinceau/gomme/seau sur `RenderTexture` · ajustements non destructifs (luminosité, contraste, saturation, teinte, courbes, LUT) · recadrage, retournement, rotation, redimensionnement · formes, texte, pipette, zoom/pan | Sélection rectangle et lasso (deviennent des masques) · **poignées de transformation** (Pixi ne fournit pas de Transformer) · règles, guides, magnétisme |

Outils fournis par l'API sans les écrire : `segment` (baguette magique), `patch-image`
(inpainting), `reframe` (outpainting), `remove-background`, `restyle`, `upscale`, `pixelate`,
`vectorize`.

**Le principe qui relie l'éditeur et l'IA** : le masque de calque et le masque d'inpainting
sont le même objet. On peint un masque au pinceau, on demande à régénérer la zone, le masque
part vers `patch-image`, le résultat revient comme nouveau calque. Aucun export intermédiaire.

### 8.5 L'espace Textures — un matériau, pas une image

Un `.tex` est un **matériau PBR** : albedo, normal, roughness, metalness, AO, height.

- **Les canaux dérivés se calculent en local**, pas par l'IA : normal depuis height (Sobel en
  shader), AO depuis height, roughness depuis luminance. Instantané, gratuit, hors ligne.
  L'IA génère l'albedo (`texture`, ou n'importe quelle image de l'espace Image).
- **L'aperçu utilise le HDRI courant de l'espace Skyboxes** — une texture jugée sous le mauvais
  éclairage ne veut rien dire, et ça crée le lien Skyboxes → Textures → 3D sans effort.
- Tiling : aperçu en répétition 3 × 3, détection de coutures, action « rendre raccordable ».

### 8.6 L'espace Video — deux moniteurs

**Convention Premiere/DaVinci** : source à gauche, programme à droite.

```
┌────────────────┬─────────────────┐
│    SOURCE      │     FINAL       │
│  (rush + cuts) │   (montage)     │
│ ▶ ▐▐ ■ [┐──┘]  │  ▶ ▐▐ ■  00:42  │
├────────────────┴─────────────────┤
│ V2 ▓▓▓▓    ▓▓▓▓▓▓▓▓              │
│ V1 ▓▓▓▓▓▓▓▓▓▓▓▓  ▓▓▓▓▓▓▓▓▓▓▓▓    │
│ A1 ▁▂▄▆█▆▄▂▁▂▄▆█▆▄▂▁             │
└──────────────────────────────────┘
```

### 8.7 Un seul lecteur à la fois

Règle globale à toute l'application, pas seulement à la vidéo. Un `PlaybackManager` détient un
**jeton de lecture unique** : moniteur source, moniteur programme, aperçu audio, vignette
animée et plein écran le prennent tour à tour, et le prendre révoque son détenteur précédent.

Sans cela : deux flux audibles en même temps, deux décodeurs matériels qui se disputent le GPU,
et un scrubbing qui saccade sans cause apparente.

Le plein écran prend le jeton comme les autres — il coupe donc naturellement ce qui jouait,
mais **mémorise la position de lecture interrompue** pour la reprendre en sortant. En
multi-fenêtres, le jeton est **arbitré par le main** : une lecture lancée sur un écran arrête
celle de l'autre.

### 8.8 Le budget de calcul — où s'exécute quoi

**Le thread UI ne fait que de l'UI.** Toute opération susceptible de dépasser 16 ms part
ailleurs. C'est la règle qui décide, pas le confort d'écriture.

| Exécution | Ce qui y va | Pourquoi |
|---|---|---|
| **GPU (shaders)** | filtres et ajustements d'image, blend de calques, normal map par Sobel, AO, occlusion, redimensionnement, aperçu de tiling | Premier réflexe : ne jamais mettre sur CPU ce que le GPU fait par pixel et gratuitement |
| **Web Worker (renderer)** | vignettes, waveforms audio, construction de BVH (`three-mesh-bvh`), parsing de gros GLB, sérialisation d'états lourds, décodage d'images via `createImageBitmap` | Ce sont des calculs JS longs : sur le thread UI ils gèlent la fenêtre |
| **OffscreenCanvas + Worker** | rendu de vignettes 3D (`mesh-preview`), export d'images, génération de planches de contact | Rendre sans bloquer, et sans monopoliser le viewport visible |
| **WebAssembly** | Draco, KTX2/Basis, démultiplexage `mediabunny` | Déjà wasm chez leurs auteurs. **Rien n'est embarqué « au cas où »** : chaque wasm doit justifier son poids |
| **`utilityProcess` Electron** | ffmpeg (export, transcodage, extraction de vignettes), indexation et scan de dossiers, hachage, transferts d'assets | API Electron dédiée aux tâches Node longues, avec IPC intégré — préférée à `child_process` |

**Deux pièges nommés :**

- **`better-sqlite3` est synchrone.** Une requête lourde exécutée dans le process main bloque
  la gestion des fenêtres — donc toute l'interface, y compris les fenêtres détachées. Les
  requêtes de catalogue non triviales passent par un `worker_threads` Node.
- **WebCodecs décode en matériel, mais le nombre de décodeurs est limité.** C'est la raison
  technique de la règle du lecteur unique (§ 8.7), pas seulement le confort sonore.

**Discipline commune à toute tâche longue** : elle est **annulable**, elle **rapporte sa
progression**, et elle s'exécute dans un **pool borné** (`hardwareConcurrency − 2`). Une tâche
qu'on ne peut ni suivre ni interrompre est un bug d'ergonomie, pas une tâche lourde.

---

## 9. Les réglages

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

## 10. Arborescence

```
scenario/
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

## 11. Dépendances

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

## 12. Risques identifiés

| Risque | Traitement |
|---|---|
| Contexte WebGL perdu au détachement de fenêtre | Moteurs recréables depuis leur état, dès la première ligne |
| Schémas de modèles imprévisibles | `kind` inconnu → saisie brute, jamais de formulaire vide |
| Débit de l'API inconnu (aucun seuil publié) | Backoff exponentiel, concurrence bornée et réglable |
| `better-sqlite3` est natif → recompilation Electron | `electron-rebuild` câblé dès le premier commit |
| `better-sqlite3` est **synchrone** → bloque le main, donc toutes les fenêtres | Requêtes de catalogue non triviales dans un `worker_threads` |
| Décodeurs matériels WebCodecs en nombre limité | Règle du lecteur unique arbitrée par le main (§ 8.7) |
| Une tâche longue non annulable gèle l'usage sans geler l'UI | Toute tâche longue est annulable et rapporte sa progression (§ 8.8) |
| Deux fenêtres éditant le même document | Un seul détenteur du focus d'édition par document |
| Poids du binaire (ffmpeg + Electron) | Assumé : c'est le prix d'un logiciel qui s'installe et fonctionne |

---

## 13. Ce qu’on ne construit pas

À dire explicitement, pour que ce soit un choix et pas un oubli :

- Pas de synchronisation bidirectionnelle des assets.
- Pas de collaboration temps réel ni de multi-utilisateurs.
- Pas d'éditeur de nœuds maison — l'API `workflows` de Scenario est pilotable, on l'expose
  sans réimplémenter son interface.
- Pas d'entraînement de modèles dans une première version, bien que l'API l'offre
  (`models.train`) : c'est un espace de travail à part entière.
- Pas d'auto-update tant que le logiciel n'est pas distribué.
