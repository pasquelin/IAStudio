# Plan — finir l'espace 3D

**Branche** `feat/3d-completion` · **Worktree** `.claude/worktrees/3d-completion` · **Base** `main` à `105a2c2`

Ce plan couvre les **onze manques du § 3.3 de `docs/REPRISE.md`**, dans l'ordre que ce document
conseille. Il est écrit pour être exécuté sans supervision : chaque étape porte sa décision, ses
fichiers, ses pièges et son critère de fin.

## Les règles du chantier — elles ne se renégocient pas

1. **`CLAUDE.md` prime sur ce plan.** Tout ce qui vit dans `src/` est en anglais, identifiants,
   commentaires et descriptions de tests compris. Ce fichier-ci est de la documentation : il est
   en français, comme les messages de commit.
2. **Une étape = un commit.** Jamais deux étapes dans le même commit, jamais une étape à moitié.
3. **La Definition of Done de `CLAUDE.md` s'applique à chaque étape**, dans l'ordre : tests
   colocalisés écrits *avec* le code → `pnpm validate` vert → `/simplify` → `/code-review` →
   corrections retenues appliquées → commit. Une étape annoncée sans ces cinq points est invalide.
4. **Rien n'est fusionné dans `main`.** Le travail reste sur `feat/3d-completion` pour revue.
5. **Rien n'est poussé.** `origin/main` est à `84ef631`, deux commits *derrière* le `main` local.
   Un rebase sur `origin/main` ferait reculer le travail : rebaser sur **`main` local**, ou sur
   rien du tout tant que personne ne touche à `main`.
6. **`git add` par chemin explicite**, jamais `git add -A` : l'index est partagé entre worktrees.
7. **Cocher l'étape ici** (`- [x]`) dans le commit qui la livre, avec une ligne sur ce qui a
   réellement été fait si cela diverge du plan.

## L'état de départ, mesuré

Worktree installé, `pnpm rebuild:native` passé, `pnpm validate` **vert** :
**215 fichiers de tests, 2282 tests**. C'est la référence : aucune étape ne baisse ce nombre.

## Dépendances autorisées

Validé par l'utilisateur le 8 août 2026 : **Draco, KTX2 et `three-mesh-bvh`** sont autorisés pour
ce chantier. Toute autre dépendance nouvelle ne l'est pas — s'en passer ou reporter l'étape.

---

## La décision d'architecture qui gouverne l'étape 3

Elle est prise ici, une fois, parce qu'elle conditionne le reste.

**Un modèle importé est UN nœud portant une référence d'asset, jamais un sous-arbre de nœuds.**

    { type: 'model', model: { assetId: string }, ... }   // à côté de 'mesh' et 'light'

Le moteur charge le GLB depuis l'asset et l'ajoute à la scène, exactement comme `texture-cache.ts`
charge une texture depuis un `TextureRef`. Le document, lui, ne grossit que d'un nœud.

**Pourquoi, et pas l'éclatement en nœuds façon éditeur three.js :**

- **Le plafond mesuré.** `⌘S` gèle toutes les fenêtres au-delà de ~5 500 nœuds, et 73 % du coût est
  le décodage du clone IPC, intouché à ce jour. Un seul GLB éclaté y arrive tout seul. Ce plan
  n'inclut pas le chantier IPC : la référence le contourne au lieu de le heurter.
- **L'invariant 3.** Un moteur se reconstruit depuis son état sérialisé. Un `assetId` se recharge ;
  200 000 triangles inlinés dans un `.scene` ne sont pas un état, ce sont des données.
- **`NODE_KINDS` l'attend déjà** : sa JSDoc dit « A third kind of node is a row here ».

Conséquence assumée : on ne peut pas éditer l'intérieur d'un modèle importé (déplacer une roue dans
une voiture). C'est le bon compromis pour un studio de génération, et si l'édition fine devient un
besoin, elle se traitera par une commande « éclater le modèle » explicite — pas par défaut.

---

## Étape 1 — Sélection multiple

- [ ] Livrée

**Pourquoi en premier.** Elle touche l'état, l'inspecteur, le gizmo et l'outliner d'un coup. Chaque
étape suivante ajoute du code autour de `selectedId` ; plus elle attend, plus elle coûte.

**Le changement de fond.** `scene-state.ts:38` — `selectedId: string | null` devient
`selectedIds: readonly string[]`. Ordre significatif : **le dernier est l'ancre**, c'est lui que
l'inspecteur montre et autour de qui le gizmo se pose.

**À écrire ou reprendre**

| Fichier | Ce qui change |
|---|---|
| `engines/scene/scene-state.ts` | `selectedIds`, `selectedNode` renvoie l'ancre, ajouter `selectedNodes` |
| `engines/scene/commands.ts` | `selectNode` devient `setSelection` / `toggleSelection` — **toujours hors historique** |
| `engines/scene/SceneRenderer.ts` | `attachGizmo` sur un groupe, `onPointerDown` lit ⇧ et ⌘ |
| `stores/scenes.ts` | `selectIn` prend un tableau, plus un mode `'replace' \| 'toggle' \| 'range'` |
| `panels/explorer/SceneTree.tsx` | ⇧-clic étend, ⌘-clic bascule — `design/Tree.tsx` doit suivre |
| `panels/inspector/SceneInspector.tsx` | l'ancre pilote l'affichage ; une édition s'applique à **toute** la sélection |
| `spaces/three/SceneDocument.tsx` | `scene.delete` supprime tout le lot en **un** `multi()` |

**Le piège du gizmo.** `TransformControls` n'attache qu'un `Object3D`. La solution est un
`Object3D` pivot, non rendu, posé au barycentre de la sélection et attaché à sa place ; au
relâchement, la delta du pivot est appliquée à chaque nœud, et **un seul `multi()` entre dans
l'historique**. Ne pas attacher le gizmo au premier objet et espérer que les autres suivent.

**Le piège de la persistance.** `scene-document.ts` ne sérialise pas la sélection (« The selection
is session state ») — rien à changer côté fichier, et **le vérifier plutôt que le supposer**.

**Tests attendus** : sélection vide / simple / multiple, bascule, étendue, l'ancre après une
suppression partielle, une édition d'inspecteur appliquée à trois nœuds en une entrée d'historique.

---

## Étape 2 — Magnétisme et pivot local / monde

- [ ] Livrée

Deux appels d'API `TransformControls`, gain d'ergonomie immédiat, coût quasi nul :
`setTranslationSnap`, `setRotationSnap`, `setScaleSnap`, `setSpace('local' | 'world')`.

**Où vivent les réglages.** Dans le registre de réglages, avec les autres réglages du viewport 3D
(`ViewportOptions` de `SceneRenderer.ts:45` et son `configure`) — pas en constantes dans le moteur.
C'est la faute que `configure` a précisément corrigée : « these were three constants, and therefore
three settings nobody could reach ».

**L'interface.** Deux bascules dans la barre d'outils de la scène : magnétisme (on/off, pas réglable
dans les préférences), et repère local/monde. Deux entrées dans `SCENE_TOOLS`, deux `CommandId`
(`scene.snap`, `scene.space`), deux paires de clés i18n dans **`fr.json` et `en.json`**, deux `case`
dans le `switch` de `SceneDocument.tsx`. Le chemin est balisé par les huit commandes existantes.

**Pas de second registre de commandes.** `COMMAND_REGISTRY` (`shared/domain/command.ts`) est le
seul. C'est écrit dans `REPRISE.md` comme une erreur déjà commise et supprimée.

---

## Étape 3 — Import glTF

- [ ] Livrée

L'étape la plus grosse. Elle applique la décision d'architecture ci-dessus.

**3a — Le type de nœud.** `SceneNodeType` gagne `'model'`. `shared/domain/scene.ts` gagne
`ModelRef = { assetId: string }`. `scene-document.ts` gagne sa branche de validation — un
`assetId` absent ou non-chaîne fait tomber le nœud, pas le fichier. `NODE_KINDS` gagne sa
troisième ligne, avec son icône `@mdi/js` et son namespace i18n.

**3b — Le chargement.** `engines/scene/model-cache.ts`, calqué **sur `texture-cache.ts`** :
comptage de références, une entrée par `assetId`, un port injectable pour le loader (jsdom ne
décode pas un GLB, exactement comme il ne décode pas une image). Le port est ce qui rend l'étape
testable — ne pas câbler `GLTFLoader` en dur.

Draco et KTX2 : `DRACOLoader` et `KTX2Loader` branchés sur le `GLTFLoader`, decoders posés dans
`resources/`, jamais chargés depuis un CDN — la CSP d'Electron l'interdit et le hors-ligne est une
promesse du projet (« le chargement 3D ne dépend jamais du réseau »).

**3c — Les portes d'entrée.** Trois, comme pour les skyboxes, et pour la même raison — un espace
sans porte est un espace mort :
1. double-clic sur un asset de type `mesh` dans le navigateur d'assets ;
2. dépôt d'un asset `mesh` sur le viewport ;
3. une génération 3D qui aboutit se pose dans le document d'où elle est partie.

Regarder `stores/skybox-generation.ts` et `helpers/open-asset.ts` avant d'écrire : le mécanisme
existe, il se réutilise.

**3d — L'import de fichier local.** `IMPORTABLE_TYPES` (`main/media/link.ts`) ne connaît que vidéo,
audio et image. Un `.glb` déposé depuis le disque n'entre pas dans le catalogue. Ajouter `mesh` avec
ses extensions (`.glb`, `.gltf`) — sinon seuls les modèles générés sont importables, ce qui n'a
aucun sens.

**Le garde-fou à ne pas oublier.** Un GLB de 300 Mo ne doit pas geler la fenêtre : le parsing part
en Web Worker (invariant 6, qui nomme explicitement « parsing de gros GLB »). Si le worker
complique trop l'étape, la livrer sans, **mais le noter ici** — pas le passer sous silence.

**Tests attendus** : le cache rend la même instance à deux nœuds partageant un `assetId`, la libère
au dernier relâchement, ne ressuscite pas un modèle relâché avant son arrivée ; un nœud `model`
survit à un aller-retour d'enregistrement ; un `assetId` inconnu ne fait pas tomber la scène.

---

## Étape 4 — Ombres

- [ ] Livrée

`shadowMap` activé sur le renderer du `ViewportEngine`, `castShadow` / `receiveShadow` par nœud —
deux booléens dans `SceneNodeBase`, donc deux cases dans l'inspecteur et **deux champs de plus à
valider** dans `scene-document.ts`. Type de map et résolution : deux réglages du viewport, pas deux
constantes.

**Compatibilité du format.** Un `.scene` écrit avant cette étape n'a pas ces champs. La validation
doit les traiter comme absents-donc-défaut, **pas** comme un nœud invalide — sinon toute scène
existante se vide au chargement. C'est le vrai risque de cette étape, et il est silencieux.

**Le coût.** Une `PointLight` avec ombres, c'est six rendus de la scène par frame. Si le viewport
tombe sous 60 fps sur une scène simple, l'ombre par défaut est **off** sur les lumières autres que
directionnelle, et le réglage est visible. Mesurer avant de décider.

---

## Étape 5 — Environnement / IBL dans le viewport

- [ ] Livrée

**Rien à écrire : à brancher.** `engines/viewport/environment.ts` porte déjà `createEnvironment`
avec `setStudio`, `setTexture`, `refresh`, `setIntensity`, `setRotation`,
`setBackgroundVisible`. `TextureRenderer` et `SkyboxRenderer` l'utilisent tous les deux —
`SceneRenderer` est le seul des trois à s'en passer, et c'est pourquoi la 3D s'éclaire moins bien
que l'aperçu d'une texture.

1. `SceneRenderer.mount` appelle `createEnvironment` puis `setStudio()`, comme
   `TextureRenderer.ts:69-70`. Une scène neuve est éclairée, même sans lumière.
2. Le document porte l'environnement choisi : studio, ou une skybox du projet par son `assetId`.
   Un champ sur `SceneState`, donc un champ de plus dans `ScenePayload` et sa validation.
3. `refresh` est cher (chaîne de mips complète) : appelé quand le geste se pose, jamais par frame.
   C'est écrit dans la JSDoc du module, la respecter.

C'est le lien **Skyboxes → 3D** que la conception promet depuis le début.

---

## Étape 6 — Groupes et reparentage

- [ ] Livrée

`parentId` existe sur `SceneNodeBase` et **aucune commande ne le change** — le champ attend depuis
le premier jour, sa JSDoc le dit (« Reparenting is not offered yet »).

- Une commande `reparent(id, parentId)` dans `commands.ts`, sur le modèle de `editNode` : capturer
  l'ancien parent **à l'application**, pas à la construction.
- Un nœud `group` — ou un `Object3D` vide comme parent. Trancher en regardant `NODE_KINDS` : si
  `group` devient un quatrième type, il suit le même chemin que `model`.
- Le glisser-déposer dans `SceneTree`, avec indicateur d'insertion.
- **Interdire le cycle** : reparenter un nœud sous l'un de ses propres descendants doit être refusé,
  pas produire un arbre qui boucle. Un test dédié, c'est le bug classique de cette fonctionnalité.
- Côté moteur : `syncNode` ajoute aujourd'hui tout objet à `viewport.scene`. Il doit l'ajouter à
  l'objet du parent — et **l'ordre d'application n'est pas garanti**, un enfant peut arriver avant
  son parent. Deux passes, ou un raccrochage différé.

---

## Étape 7 — Dupliquer, copier-coller

- [ ] Livrée

Aucune commande dans `commands.ts` aujourd'hui.

- `duplicateNodes(ids)` : nouveaux `id`, décalage optionnel, **la copie devient la sélection**.
- Copier / coller via un presse-papiers interne au studio (pas le presse-papiers système : un
  `SceneNode` n'a pas de représentation texte utile, et le presse-papiers système est partagé avec
  le reste de l'OS).
- Un sous-arbre se duplique **entier**, avec ses `parentId` réécrits vers les nouveaux identifiants.
  C'est ce qui rend cette étape dépendante de l'étape 6 — la faire après, pas avant.
- Quatre `CommandId` (`scene.duplicate`, `scene.copy`, `scene.paste`, et `scene.cut` si le geste est
  offert), avec leurs clés i18n dans les deux bundles.

---

## Étape 8 — `sprite` et `text`

- [ ] Livrée

Déclarés dans `MESH_ENTRIES` avec `disabled: true`, grisés dans tous les menus parce que
`MESH_BUILDERS` ne leur donne pas de `create` (`mesh-primitives.ts:141`). Leur JSDoc dit le pourquoi :
« neither is a geometry ».

Ils ne sont donc **pas** des `GeometryDescriptor`. Deux chemins possibles, trancher et écrire
lequel :
- ils deviennent des types de nœuds à part (comme `model`), ce qui est cohérent avec le reste ;
- ou `MeshNode` accueille un descripteur non géométrique, ce qui abîme l'union qui protège
  aujourd'hui le format.

**Le premier chemin est le bon** — c'est celui que ce plan a déjà pris deux fois. Le texte 3D
demande une police : la charger depuis le projet, jamais depuis le réseau.

Si l'étape déborde, elle est la **plus reportable des onze** : deux entrées grisées ne sont pas une
régression. Le noter ici plutôt que de la bâcler.

---

## Étape 9 — Caméra orthographique, vues normalisées, filaire

- [ ] Livrée

Rien de tout cela n'existe dans le viewport.

- Bascule perspective / orthographique. La caméra vit dans `ViewportEngine`, **partagé avec les
  espaces Textures et Skyboxes** : la bascule ne doit pas leur imposer un comportement. Regarder qui
  d'autre lit `viewport.camera` avant d'y toucher.
- Vues normalisées : dessus, dessous, face, dos, gauche, droite. Le `ViewHelper` est déjà là et son
  clic pourrait les servir.
- Affichage : rendu, filaire, rendu + filaire. Sur les matériaux, pas sur un second passage de
  rendu.
- Ces trois-là sont de l'**état de session**, jamais du document et jamais de l'historique : c'est
  la règle que `canvas-views.ts` a posée pour l'espace Image, la suivre.

---

## Étape 10 — Export glTF / GLB / USDZ

- [ ] Livrée

`GLTFExporter` et `USDZExporter` viennent de `three/addons`, aucune dépendance nouvelle. La spec les
nomme au § 8.2.

**L'écriture disque passe par le main** — le renderer n'a pas `fs`, c'est l'invariant 1. Un canal
IPC typé dans `shared/ipc.ts`, jamais un `ipcRenderer.invoke('...')` avec une chaîne littérale.

Exporter la scène entière ou la seule sélection (l'étape 1 rend la question naturelle). Ce qui n'est
pas du document ne s'exporte pas : ni grille, ni trièdre, ni gizmo, ni helper de lumière — **le
vérifier sur le fichier produit** plutôt que le supposer, c'est la leçon que le plan de l'espace
Image a écrite pour son propre export.

---

## Étape 11 — BVH pour le picking, instanciation, LOD

- [ ] Livrée

**À faire en dernier, et seulement mesure en main.** Le raycast parcourt aujourd'hui tous les objets
(`SceneRenderer.ts:438-439`) et personne ne s'en est plaint — parce qu'aucune scène n'est encore
assez lourde. L'étape 3 change cela.

1. **Mesurer d'abord** : temps de `intersectObjects` sur une scène avec trois GLB denses. Écrire le
   chiffre ici. Sous 2 ms, l'étape se réduit à sa note et s'arrête là.
2. Si c'est lourd : `three-mesh-bvh` (autorisé), BVH construit **en Web Worker** — invariant 6, qui
   nomme « construction de BVH » explicitement.
3. Instanciation et LOD : ne rien faire sans un cas réel. Une optimisation sans mesure est une
   complication.

---

## Ce que ce plan ne couvre pas, délibérément

Deux chantiers transverses, écartés par l'utilisateur pour cette nuit — ils touchent les six
espaces, pas seulement la 3D :

- **Le décodage du clone IPC** (73 % du coût d'un `⌘S`, gel au-delà de ~5 500 nœuds). Contourné par
  la décision d'architecture de l'étape 3, pas résolu.
- **La surface d'erreur** (§ 2 de `REPRISE.md`). Conséquence concrète ici : un import glTF qui
  échoue ne dira rien à l'utilisateur. Chaque étape doit donc **au minimum journaliser** ses échecs
  côté main, pour qu'ils soient trouvables même sans surface.

Si une étape butte sur l'un des deux, elle s'arrête et le note — elle ne lance pas le chantier
transverse en passant.

## Au réveil

`docs/REPRISE.md` § 3.3 devra être réécrit pour refléter ce qui a été livré. **Ne pas le faire au
fil de l'eau** : le tableau des manques est vrai jusqu'à la fusion, et un document qui décrit un
état non fusionné est pire qu'un document daté. Une dernière étape, après la revue.
