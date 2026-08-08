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

- [x] Livrée

**Ce qui a été fait, et où le plan a été suivi de biais.**

`selectedIds: readonly string[]` remplace `selectedId`, le dernier est l'ancre. Le pivot du gizmo
est en place, l'inspecteur écrit sur toute la sélection en une entrée d'historique, l'outliner et
les panneaux Mailles/Lumières partagent le même geste (⌘ bascule, ⇧ étend). 2282 → 2345 tests.

Quatre écarts assumés :

1. **Deux modes de sélection, pas trois.** Le plan annonçait `'replace' | 'toggle' | 'range'` dans
   `selectIn`. Le mode `range` n'existe pas : une plage n'a de sens que dans l'ordre où les lignes
   sont *dessinées*, que seul le composant qui les dessine connaît. `Tree` et `Collection` la
   résolvent donc eux-mêmes via `helpers/selection.ts` (`pickFrom`) et ne transmettent qu'un
   tableau déjà calculé. Le store n'a plus à connaître un ordre visuel qu'il ne peut pas voir.
2. **`setSelection(state, ids, mode)` plutôt que `setSelection` / `toggleSelection`.** Deux
   fonctions dont l'une est l'autre avec un drapeau.
3. **`selectedNode` a été supprimé**, pas conservé. `selectedNodes(nodes, ids)` rend la liste dans
   l'ordre de sélection ; l'ancre est son dernier élément. Une fonction de moins pour la même
   information, et la signature prend les deux moitiés de l'état plutôt qu'un `SceneState` — les
   appelants lisent deux sélecteurs séparés, précisément pour ne pas re-rendre sur ce qu'ils ne
   regardent pas.
4. **`Collection` a suivi `Tree`.** Le plan ne le demandait pas, mais laisser les panneaux
   Mailles/Lumières afficher une seule ligne surlignée sur trois était une incohérence visible.
   Les deux composants du design system ont désormais une seule notion de sélection.

**Une valeur tapée est absolue, un geste est relatif.** Taper une hauteur l'écrit sur tous les
nœuds sélectionnés (comme Unity) ; tirer le gizmo applique un delta. Seul l'**axe** touché est
écrit : trois cubes à qui l'on donne une hauteur gardent les colonnes où ils sont posés. Le nom
fait exception et reste sur l'ancre — trois nœuds du même nom n'est pas un renommage.

**Le piège du gizmo, résolu par parentage temporaire.** `engines/scene/pivot.ts` : la sélection est
accrochée à un `Object3D` non rendu le temps du glissement, `attach` préservant la transformation
monde dans les deux sens. Aucun delta calculé à la main, donc aucune dérive accumulée. Le module
est testé sans WebGL (c'est de l'arithmétique d'objets), ce qui donne enfin une couverture au
morceau le plus délicat de `SceneRenderer`, qui n'en a jamais eu.

**Cinq bugs trouvés par `/code-review` et corrigés.** Trois reproduits par exécution :

- la rotation d'un axe écrasait les deux autres sur toute la sélection — l'aller-retour
  radians→degrés→radians n'est pas exact à ~13 %, et les axes intacts passaient pour modifiés.
  Le diff se fait maintenant dans l'unité affichée ;
- une touche de mode pressée **pendant** un glissement rappelait `attachGizmo`, qui recentrait le
  pivot alors qu'il portait la sélection : celle-ci sautait à l'origine, et le relâchement écrivait
  ce saut dans le document. `attachGizmo` ne fait plus rien tant que le gizmo tient quelque chose,
  et `syncNode` ne réécrit pas un objet que le pivot porte ;
- un clic sec sur un axe du gizmo faisait passer chaque nœud par une décomposition de matrice qui
  ne rend pas toujours le même Euler (ni une échelle négative) : une entrée d'historique que
  personne n'avait demandée. Rien n'est rapporté tant que rien n'a bougé ;
- ⇧/⌘/Ctrl + glisser gauche est le **pan** d'`OrbitControls`, et ce sont les mêmes touches que
  l'ajout à une sélection : recadrer la vue défaisait la sélection qu'on venait de construire. Le
  picking se fait désormais au relâchement, et seulement si le pointeur n'a pas bougé ;
- l'œil de visibilité volait la sélection au clavier dans l'arbre — le correctif de `3f70ad5`
  n'avait été posé que dans `Collection`.

**Deux limites connues, laissées telles quelles :**

- mettre à l'échelle sur un seul axe un groupe contenant un nœud tourné produit un cisaillement
  qu'une décomposition TRS ne sait pas représenter : la forme obtenue diffère légèrement de ce que
  le glissement affichait. C'est inhérent à l'approche par pivot — l'éditeur three.js a la même —
  et la corriger demanderait de stocker des matrices plutôt que des TRS, ce qui changerait le
  format du document ;
- `SceneRenderer` n'a toujours pas de test (pas de contexte WebGL sous jsdom). Ce qui pouvait en
  être extrait l'a été dans `pivot.ts` ; le reste — le passage du picking au relâchement, la garde
  de glissement — n'est vérifié qu'à la lecture.

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

- [x] Livrée

**Ce qui a été fait.** Deux bascules dans la barre d'outils (`M` et `L`), trois pas dans les
préférences (déplacement 0,5 m, rotation 15°, échelle 0,1), et les quatre appels d'API du plan.
2345 → 2364 tests.

**Décisions prises en chemin :**

1. **Le repère est une bascule, pas un choix à deux valeurs affichées.** Pressée = local,
   relâchée = monde, une seule icône. Le registre `SCENE_TOOLS` reste statique — une icône qui
   change selon l'état aurait obligé le composant à la calculer, ce qui contredit « la barre est
   un registre, rien n'y est dessiné ».
2. **`pressed` est une notion neuve du design system**, à côté de `activeTool`. Une bascule et un
   outil armé sont deux questions différentes qui se dessinent pareil ; les confondre aurait fait
   du magnétisme un quatrième « mode » désarmant les trois autres. **Dette laissée** :
   `Monitor.tsx` et `AudioDocument.tsx` expriment déjà des bascules en pliant `activeTool`
   (`activeTool={playing ? 'play' : undefined}`) — ils devraient migrer vers `pressed`, mais ce
   sont deux autres espaces et l'étape 2 n'a pas à les toucher.
3. **Le on/off est de l'état de session, les pas sont des réglages.** Personne ne veut ⌘Z pour
   récupérer un repère, et un document qui se souviendrait de son magnétisme l'imposerait au
   suivant. La finesse, elle, appartient à la personne.
4. **Le repère local oriente le pivot sur l'ancre** quand plusieurs nœuds sont sélectionnés —
   comme Blender le fait avec l'objet actif. Sans cela le bouton s'allumait sans rien changer,
   puisque `placePivot` remet le pivot d'équerre avec le monde.

**Quatre bugs trouvés par `/code-review`, deux prouvés par exécution :**

- **les deux réglages décimaux étaient inécrivables.** `SettingRow` refuse un non-entier de tout
  ce qui n'est pas un `slider` : « Pas de déplacement » (0,5) et « Pas d'échelle » (0,1) avaient
  leur propre valeur par défaut hors d'atteinte, et le champ paraissait figé. Les trois sont
  devenus des sliders, et **un test de registre verrouille la règle pour tout le monde** — c'est
  le genre de piège qui se reproduit ;
- **`setSpace` pendant un glissement téléportait l'objet.** `TransformControls` réoriente son
  plan d'interaction depuis `space` à chaque frame alors que le début du geste a été capturé sur
  l'ancien : mesuré à ~1,3 unité hors de l'axe demandé, écrit dans l'historique au relâchement.
  Même garde que celle posée à l'étape 1 sur `attachGizmo`, plus une réapplication au relâchement ;
- **`mount` ne restaurait pas le mode**, alors que le commentaire promettait un moteur retrouvé
  tel qu'on l'avait laissé. L'invariant 3 n'était tenu qu'à moitié ;
- **deux textes d'aide décrivaient un magnétisme absolu** là où three.js magnétise le *geste*
  pour la rotation : « 90° donne les quatre angles droits » est faux dès que l'objet ne part pas
  de zéro. Et le pas d'échelle promettait des quarts qu'un pas de 0,1 ne peut pas atteindre.

**Deux comportements assumés, notés plutôt que corrigés :**

- le magnétisme de translation aligne le **barycentre** d'une sélection multiple, pas chaque
  objet — c'est le « median point » de Blender, et l'alternative (aligner chacun) déferait les
  écarts que l'utilisateur a construits ;
- la rotation magnétisée avance par crans **depuis là où le geste a commencé**, alors que
  déplacement et échelle magnétisent une valeur absolue. C'est three.js qui en décide ; les deux
  textes d'aide le disent maintenant.

**Le manuel a été corrigé dans le même mouvement.** Il listait « le magnétisme et le pivot local »
et « la sélection multiple » parmi ce qui n'existe pas — faux depuis l'étape 1 pour l'une, depuis
celle-ci pour l'autre. Les tables des raccourcis et des réglages ont reçu `M`, `L` et les trois
pas. C'est différent de `REPRISE.md`, que ce plan demande de ne pas toucher au fil de l'eau : le
manuel est versionné avec le code qu'il décrit, donc il doit être vrai dans cette branche ;
`REPRISE.md` décrit l'état de `main`, et le restera jusqu'à la fusion.

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

- [x] Livrée — **sans Draco/KTX2 ni Web Worker**, voir plus bas

**Ce qui est livré.** Le type de nœud `model` portant `{ assetId }`, sa validation, son cache à
comptage de références, et les trois portes d'entrée : double-clic sur un asset `mesh`, dépôt sur
le viewport, génération 3D qui revient dans le document d'où elle est partie. Plus l'import
depuis le disque. 2364 → 2401 tests.

**Deux reports, écrits noir sur blanc :**

1. **Draco et KTX2 ne sont pas branchés.** Ce ne sont pas les dépendances qui bloquent — elles
   sont autorisées — mais l'endroit d'où servir leurs décodeurs : ~700 Ko de wasm plus leur glue
   JS, dont le chemin diffère entre le serveur de dev et une application empaquetée, et je ne
   peux pas valider un build empaqueté cette nuit. Le loader est construit dans
   `gltf-source.ts` **et nulle part ailleurs** : les brancher plus tard, c'est cette fonction et
   aucune autre. En attendant, un `.glb` compressé échoue comme un fichier illisible.
2. **Le parsing n'est pas en Web Worker.** Le plan autorise explicitement ce report. Un GLB de
   300 Mo gèlera la fenêtre le temps du parsing. Le port `loadModel` est le point d'accroche : y
   passer un worker ne change rien au reste.

**Trois divergences par rapport au plan, assumées :**

1. **`NODE_KINDS` n'a pas gagné de troisième ligne.** Son test exige de chaque entrée les clés
   `add`, `remove`, `empty` et `noDocument` — c'est un registre de *panneaux*, et un modèle n'a
   ni menu Ajouter, ni panneau, ni état vide. Lui en inventer aurait été quatre clés mortes.
   D'où `PanelNodeType = Exclude<SceneNodeType, 'model'>` : un type de nœud qui mérite un panneau
   casse toujours la compilation, un modèle non. L'outliner, lui, liste bien les modèles.
2. **`.gltf` n'est pas importable, `.glb` seul l'est.** Un `.gltf` séparé pointe ses buffers et
   ses textures par chemin relatif, et un asset est servi à plat en `scenario://asset/<id>` : les
   fichiers voisins n'ont pas d'id, le loader ferait 404 sur chacun et afficherait un modèle vide
   sans rien dire. Mieux vaut refuser dans le sélecteur que trahir dans le viewport.
3. **`skybox-generation` a été factorisé avec le nouveau.** Les deux fichiers étaient identiques
   à trois valeurs près, et seul l'ancien avait des tests. `generation-landing.ts` porte la
   machinerie, les deux espaces la déclarent en dix lignes. Idem pour les caches :
   `engines/core/ref-cache.ts` porte le comptage de références et sa course subtile, que
   `texture-cache` et `model-cache` partagent désormais.

**Cinq bugs trouvés par `/simplify` et `/code-review`, tous corrigés :**

- **un modèle importé était insélectionnable à la souris.** `GLTFLoader` nomme chaque maille
  qu'il construit, et le picking remontait au premier nom trouvé : un clic répondait `mesh_0`, et
  cet id fantôme partait dans la sélection, dans l'historique et dans le document. Le picking
  n'accepte plus qu'un nom que le moteur a lui-même posé ;
- **importer un `.glb` depuis le disque créait la ligne de catalogue puis la supprimait.**
  Le pipeline média ffprobe tout type importable ; un GLB n'est pas un média, donc « illisible »,
  donc `discard`. Le fichier disparaissait de la bibliothèque une seconde après y être apparu.
  Perfide : sur cette machine le ffprobe de Homebrew est cassé, donc le bug ne s'y voyait pas —
  il aurait frappé toute machine saine ;
- **la référence du cache était relâchée deux fois** : supprimer un de deux nœuds pointant le
  même asset libérait la source que l'autre était en train de cloner ;
- **le dépôt sur le viewport ne fonctionnait pas** : `getData` rend une chaîne vide pendant un
  `dragover`, donc le `preventDefault` conditionnel n'avait jamais lieu ;
- **un `assetId` changeant sur un nœud existant** n'était traité nulle part : ancien modèle
  toujours à l'écran, ancienne référence jamais rendue, et décrément du mauvais compteur.

**Le manuel a été corrigé** : il affirmait à six endroits que les modèles 3D ne s'importent pas.

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

- [x] Livrée

**Ce qui est livré.** `castShadow` / `receiveShadow` par nœud, deux cases dans une section
**Ombres** de l'inspecteur, `shadowMap` activé sur le viewport de la scène seule, et deux
réglages : douceur et finesse. 2401 → 2420 tests.

**Le risque silencieux, traité en premier.** Un `.scene` écrit avant cette étape n'a pas les
deux champs. `sceneFromPayload` les remplit au chargement au lieu de les exiger — un nœud refusé
est indiscernable d'un nœud qui n'a jamais existé, donc exiger les flags aurait vidé chaque
document existant sans un mot. Quatre tests le verrouillent, dont un qui reconstruit un fichier
d'avant l'étape en retirant les champs. `null` compte comme absent : un outil qui sérialise les
champs manquants ainsi ne doit pas coûter le nœud.

**Sur « mesurer avant de décider ».** Le plan demandait de mesurer le coût avant de choisir le
défaut. Je n'ai pas mesuré de fps — l'app ne tourne pas dans cette boucle — mais le comptage est
exact et suffisant : une scène neuve a une ambiante, une directionnelle et une hémisphérique, et
seule la directionnelle projette, soit **une passe de profondeur plus la passe principale, deux
rendus par frame**. Aucune ponctuelle par défaut, donc jamais les six. Le défaut retenu est celui
que le plan désignait comme repli, et il est visible : une case par lumière dans l'inspecteur.
Le spot est off lui aussi, bien qu'il ne coûte qu'une passe comme la directionnelle — sa raison
est autre : pointé vers −Y sur un décor que personne n'a encore visé, il produit surtout de
l'acné d'ombre.

**Quatre bugs trouvés par `/simplify` et `/code-review`, tous corrigés :**

- **le troisième niveau de douceur ne faisait rien.** `PCFSoftShadowMap` est déprécié dans
  three 0.185 : le moteur le remplace par `PCFShadowMap` et journalise un avertissement — à
  chaque `configure`, puisque le garde d'idempotence ne mordait plus. « Très douce » rendait donc
  exactement comme « Douce ». Le réglage n'offre plus que les deux filtres réellement appliqués ;
- **un modèle importé ne projetait aucune ombre.** Son fichier arrive après le sync qui a bâti
  son porteur, et le sync suivant saute un nœud inchangé : les flags n'atteignaient jamais ce qui
  était arrivé. Ils sont posés là où le fichier atterrit ;
- **la directionnelle n'éclairait qu'un carré de dix unités.** Son frustum d'ombre naît en
  ±5 ; sur la grille de vingt mètres contre laquelle une scène se construit, la moitié des objets
  ne projetait rien, sans le moindre indice. Il est maintenant dimensionné sur la grille ;
- **cocher « projette une ombre » sur une ambiante** faisait avertir three.js à chaque frame pour
  un effet nul — et la scène par défaut en contient deux. La case n'est plus offerte aux lumières
  qui n'ont pas de caméra d'ombre.

**Une correction d'honnêteté.** Le commentaire justifiant `needsUpdate` décrivait un mécanisme
inexistant : three.js recompile de lui-même sur changement de type, et `needsUpdate` n'est lu que
si `autoUpdate` est coupé, ce qu'il n'est jamais ici. L'écriture et son commentaire sont partis.

**Le manuel a été corrigé** : il listait les ombres portées parmi ce qui n'existe pas, et sa table
des valeurs par défaut ignorait les deux nouveaux réglages.

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
