# Plan — finir l’espace 3D

**Branche** `feat/3d-completion` · **Worktree** `.claude/worktrees/3d-completion` · **Base** `main` à `105a2c2`

Ce plan couvre les **onze manques du § 3.3 de `docs/REPRISE.md`**, dans l’ordre que ce document
conseille. Il est écrit pour être exécuté sans supervision : chaque étape porte sa décision, ses
fichiers, ses pièges et son critère de fin.

## Les règles du chantier — elles ne se renégocient pas

1. **`CLAUDE.md` prime sur ce plan.** Tout ce qui vit dans `src/` est en anglais, identifiants,
   commentaires et descriptions de tests compris. Ce fichier-ci est de la documentation : il est
   en français, comme les messages de commit.
2. **Une étape = un commit.** Jamais deux étapes dans le même commit, jamais une étape à moitié.
3. **La Definition of Done de `CLAUDE.md` s’applique à chaque étape**, dans l’ordre : tests
   colocalisés écrits *avec* le code → `pnpm validate` vert → `/simplify` → `/code-review` →
   corrections retenues appliquées → commit. Une étape annoncée sans ces cinq points est invalide.
4. **Rien n’est fusionné dans `main`.** Le travail reste sur `feat/3d-completion` pour revue.
5. **Rien n’est poussé.** `origin/main` est à `84ef631`, deux commits *derrière* le `main` local.
   Un rebase sur `origin/main` ferait reculer le travail : rebaser sur **`main` local**, ou sur
   rien du tout tant que personne ne touche à `main`.
6. **`git add` par chemin explicite**, jamais `git add -A` : l’index est partagé entre worktrees.
7. **Cocher l’étape ici** (`- [x]`) dans le commit qui la livre, avec une ligne sur ce qui a
   réellement été fait si cela diverge du plan.

## L’état de départ, mesuré

Worktree installé, `pnpm rebuild:native` passé, `pnpm validate` **vert** :
**215 fichiers de tests, 2282 tests**. C’est la référence : aucune étape ne baisse ce nombre.

## Dépendances autorisées

Validé par l’utilisateur le 8 août 2026 : **Draco, KTX2 et `three-mesh-bvh`** sont autorisés pour
ce chantier. Toute autre dépendance nouvelle ne l’est pas — s’en passer ou reporter l’étape.

---

## La décision d’architecture qui gouverne l’étape 3

Elle est prise ici, une fois, parce qu’elle conditionne le reste.

**Un modèle importé est UN nœud portant une référence d’asset, jamais un sous-arbre de nœuds.**

    { type: 'model', model: { assetId: string }, ... }   // à côté de 'mesh' et 'light'

Le moteur charge le GLB depuis l’asset et l’ajoute à la scène, exactement comme `texture-cache.ts`
charge une texture depuis un `TextureRef`. Le document, lui, ne grossit que d’un nœud.

**Pourquoi, et pas l’éclatement en nœuds façon éditeur three.js :**

- **Le plafond mesuré.** `⌘S` gèle toutes les fenêtres au-delà de ~5 500 nœuds, et 73 % du coût est
  le décodage du clone IPC, intouché à ce jour. Un seul GLB éclaté y arrive tout seul. Ce plan
  n’inclut pas le chantier IPC : la référence le contourne au lieu de le heurter.
- **L’invariant 3.** Un moteur se reconstruit depuis son état sérialisé. Un `assetId` se recharge ;
  200 000 triangles inlinés dans un `.scene` ne sont pas un état, ce sont des données.
- **`NODE_KINDS` l’attend déjà** : sa JSDoc dit « A third kind of node is a row here ».

Conséquence assumée : on ne peut pas éditer l’intérieur d’un modèle importé (déplacer une roue dans
une voiture). C’est le bon compromis pour un studio de génération, et si l’édition fine devient un
besoin, elle se traitera par une commande « éclater le modèle » explicite — pas par défaut.

---

## Étape 1 — Sélection multiple

- [x] Livrée

**Ce qui a été fait, et où le plan a été suivi de biais.**

`selectedIds: readonly string[]` remplace `selectedId`, le dernier est l’ancre. Le pivot du gizmo
est en place, l’inspecteur écrit sur toute la sélection en une entrée d’historique, l’outliner et
les panneaux Mailles/Lumières partagent le même geste (⌘ bascule, ⇧ étend). 2282 → 2345 tests.

Quatre écarts assumés :

1. **Deux modes de sélection, pas trois.** Le plan annonçait `'replace' | 'toggle' | 'range'` dans
   `selectIn`. Le mode `range` n’existe pas : une plage n’a de sens que dans l’ordre où les lignes
   sont *dessinées*, que seul le composant qui les dessine connaît. `Tree` et `Collection` la
   résolvent donc eux-mêmes via `helpers/selection.ts` (`pickFrom`) et ne transmettent qu’un
   tableau déjà calculé. Le store n’a plus à connaître un ordre visuel qu’il ne peut pas voir.
2. **`setSelection(state, ids, mode)` plutôt que `setSelection` / `toggleSelection`.** Deux
   fonctions dont l’une est l’autre avec un drapeau.
3. **`selectedNode` a été supprimé**, pas conservé. `selectedNodes(nodes, ids)` rend la liste dans
   l’ordre de sélection ; l’ancre est son dernier élément. Une fonction de moins pour la même
   information, et la signature prend les deux moitiés de l’état plutôt qu’un `SceneState` — les
   appelants lisent deux sélecteurs séparés, précisément pour ne pas re-rendre sur ce qu’ils ne
   regardent pas.
4. **`Collection` a suivi `Tree`.** Le plan ne le demandait pas, mais laisser les panneaux
   Mailles/Lumières afficher une seule ligne surlignée sur trois était une incohérence visible.
   Les deux composants du design system ont désormais une seule notion de sélection.

**Une valeur tapée est absolue, un geste est relatif.** Taper une hauteur l’écrit sur tous les
nœuds sélectionnés (comme Unity) ; tirer le gizmo applique un delta. Seul l'**axe** touché est
écrit : trois cubes à qui l’on donne une hauteur gardent les colonnes où ils sont posés. Le nom
fait exception et reste sur l’ancre — trois nœuds du même nom n’est pas un renommage.

**Le piège du gizmo, résolu par parentage temporaire.** `engines/scene/pivot.ts` : la sélection est
accrochée à un `Object3D` non rendu le temps du glissement, `attach` préservant la transformation
monde dans les deux sens. Aucun delta calculé à la main, donc aucune dérive accumulée. Le module
est testé sans WebGL (c’est de l’arithmétique d’objets), ce qui donne enfin une couverture au
morceau le plus délicat de `SceneRenderer`, qui n’en a jamais eu.

**Cinq bugs trouvés par `/code-review` et corrigés.** Trois reproduits par exécution :

- la rotation d’un axe écrasait les deux autres sur toute la sélection — l’aller-retour
  radians→degrés→radians n’est pas exact à ~13 %, et les axes intacts passaient pour modifiés.
  Le diff se fait maintenant dans l’unité affichée ;
- une touche de mode pressée **pendant** un glissement rappelait `attachGizmo`, qui recentrait le
  pivot alors qu’il portait la sélection : celle-ci sautait à l’origine, et le relâchement écrivait
  ce saut dans le document. `attachGizmo` ne fait plus rien tant que le gizmo tient quelque chose,
  et `syncNode` ne réécrit pas un objet que le pivot porte ;
- un clic sec sur un axe du gizmo faisait passer chaque nœud par une décomposition de matrice qui
  ne rend pas toujours le même Euler (ni une échelle négative) : une entrée d’historique que
  personne n’avait demandée. Rien n’est rapporté tant que rien n’a bougé ;
- ⇧/⌘/Ctrl + glisser gauche est le **pan** d'`OrbitControls`, et ce sont les mêmes touches que
  l’ajout à une sélection : recadrer la vue défaisait la sélection qu’on venait de construire. Le
  picking se fait désormais au relâchement, et seulement si le pointeur n’a pas bougé ;
- l’œil de visibilité volait la sélection au clavier dans l’arbre — le correctif de `3f70ad5`
  n’avait été posé que dans `Collection`.

**Deux limites connues, laissées telles quelles :**

- mettre à l’échelle sur un seul axe un groupe contenant un nœud tourné produit un cisaillement
  qu’une décomposition TRS ne sait pas représenter : la forme obtenue diffère légèrement de ce que
  le glissement affichait. C’est inhérent à l’approche par pivot — l’éditeur three.js a la même —
  et la corriger demanderait de stocker des matrices plutôt que des TRS, ce qui changerait le
  format du document ;
- `SceneRenderer` n’a toujours pas de test (pas de contexte WebGL sous jsdom). Ce qui pouvait en
  être extrait l’a été dans `pivot.ts` ; le reste — le passage du picking au relâchement, la garde
  de glissement — n’est vérifié qu’à la lecture.

**Pourquoi en premier.** Elle touche l’état, l’inspecteur, le gizmo et l’outliner d’un coup. Chaque
étape suivante ajoute du code autour de `selectedId` ; plus elle attend, plus elle coûte.

**Le changement de fond.** `scene-state.ts:38` — `selectedId: string | null` devient
`selectedIds: readonly string[]`. Ordre significatif : **le dernier est l’ancre**, c’est lui que
l’inspecteur montre et autour de qui le gizmo se pose.

**À écrire ou reprendre**

| Fichier | Ce qui change |
|---|---|
| `engines/scene/scene-state.ts` | `selectedIds`, `selectedNode` renvoie l’ancre, ajouter `selectedNodes` |
| `engines/scene/commands.ts` | `selectNode` devient `setSelection` / `toggleSelection` — **toujours hors historique** |
| `engines/scene/SceneRenderer.ts` | `attachGizmo` sur un groupe, `onPointerDown` lit ⇧ et ⌘ |
| `stores/scenes.ts` | `selectIn` prend un tableau, plus un mode `'replace' \| 'toggle' \| 'range'` |
| `panels/explorer/SceneTree.tsx` | ⇧-clic étend, ⌘-clic bascule — `design/Tree.tsx` doit suivre |
| `panels/inspector/SceneInspector.tsx` | l’ancre pilote l’affichage ; une édition s’applique à **toute** la sélection |
| `spaces/three/SceneDocument.tsx` | `scene.delete` supprime tout le lot en **un** `multi()` |

**Le piège du gizmo.** `TransformControls` n’attache qu’un `Object3D`. La solution est un
`Object3D` pivot, non rendu, posé au barycentre de la sélection et attaché à sa place ; au
relâchement, la delta du pivot est appliquée à chaque nœud, et **un seul `multi()` entre dans
l’historique**. Ne pas attacher le gizmo au premier objet et espérer que les autres suivent.

**Le piège de la persistance.** `scene-document.ts` ne sérialise pas la sélection (« The selection
is session state ») — rien à changer côté fichier, et **le vérifier plutôt que le supposer**.

**Tests attendus** : sélection vide / simple / multiple, bascule, étendue, l’ancre après une
suppression partielle, une édition d’inspecteur appliquée à trois nœuds en une entrée d’historique.

---

## Étape 2 — Magnétisme et pivot local / monde

- [x] Livrée

**Ce qui a été fait.** Deux bascules dans la barre d’outils (`M` et `L`), trois pas dans les
préférences (déplacement 0,5 m, rotation 15°, échelle 0,1), et les quatre appels d’API du plan.
2345 → 2364 tests.

**Décisions prises en chemin :**

1. **Le repère est une bascule, pas un choix à deux valeurs affichées.** Pressée = local,
   relâchée = monde, une seule icône. Le registre `SCENE_TOOLS` reste statique — une icône qui
   change selon l’état aurait obligé le composant à la calculer, ce qui contredit « la barre est
   un registre, rien n’y est dessiné ».
2. **`pressed` est une notion neuve du design system**, à côté de `activeTool`. Une bascule et un
   outil armé sont deux questions différentes qui se dessinent pareil ; les confondre aurait fait
   du magnétisme un quatrième « mode » désarmant les trois autres. **Dette laissée** :
   `Monitor.tsx` et `AudioDocument.tsx` expriment déjà des bascules en pliant `activeTool`
   (`activeTool={playing ? 'play' : undefined}`) — ils devraient migrer vers `pressed`, mais ce
   sont deux autres espaces et l’étape 2 n’a pas à les toucher.
3. **Le on/off est de l’état de session, les pas sont des réglages.** Personne ne veut ⌘Z pour
   récupérer un repère, et un document qui se souviendrait de son magnétisme l’imposerait au
   suivant. La finesse, elle, appartient à la personne.
4. **Le repère local oriente le pivot sur l’ancre** quand plusieurs nœuds sont sélectionnés —
   comme Blender le fait avec l’objet actif. Sans cela le bouton s’allumait sans rien changer,
   puisque `placePivot` remet le pivot d’équerre avec le monde.

**Quatre bugs trouvés par `/code-review`, deux prouvés par exécution :**

- **les deux réglages décimaux étaient inécrivables.** `SettingRow` refuse un non-entier de tout
  ce qui n’est pas un `slider` : « Pas de déplacement » (0,5) et « Pas d’échelle » (0,1) avaient
  leur propre valeur par défaut hors d’atteinte, et le champ paraissait figé. Les trois sont
  devenus des sliders, et **un test de registre verrouille la règle pour tout le monde** — c’est
  le genre de piège qui se reproduit ;
- **`setSpace` pendant un glissement téléportait l’objet.** `TransformControls` réoriente son
  plan d’interaction depuis `space` à chaque frame alors que le début du geste a été capturé sur
  l’ancien : mesuré à ~1,3 unité hors de l’axe demandé, écrit dans l’historique au relâchement.
  Même garde que celle posée à l’étape 1 sur `attachGizmo`, plus une réapplication au relâchement ;
- **`mount` ne restaurait pas le mode**, alors que le commentaire promettait un moteur retrouvé
  tel qu’on l’avait laissé. L’invariant 3 n’était tenu qu’à moitié ;
- **deux textes d’aide décrivaient un magnétisme absolu** là où three.js magnétise le *geste*
  pour la rotation : « 90° donne les quatre angles droits » est faux dès que l’objet ne part pas
  de zéro. Et le pas d’échelle promettait des quarts qu’un pas de 0,1 ne peut pas atteindre.

**Deux comportements assumés, notés plutôt que corrigés :**

- le magnétisme de translation aligne le **barycentre** d’une sélection multiple, pas chaque
  objet — c’est le « median point » de Blender, et l’alternative (aligner chacun) déferait les
  écarts que l’utilisateur a construits ;
- la rotation magnétisée avance par crans **depuis là où le geste a commencé**, alors que
  déplacement et échelle magnétisent une valeur absolue. C’est three.js qui en décide ; les deux
  textes d’aide le disent maintenant.

**Le manuel a été corrigé dans le même mouvement.** Il listait « le magnétisme et le pivot local »
et « la sélection multiple » parmi ce qui n’existe pas — faux depuis l’étape 1 pour l’une, depuis
celle-ci pour l’autre. Les tables des raccourcis et des réglages ont reçu `M`, `L` et les trois
pas. C’est différent de `REPRISE.md`, que ce plan demande de ne pas toucher au fil de l’eau : le
manuel est versionné avec le code qu’il décrit, donc il doit être vrai dans cette branche ;
`REPRISE.md` décrit l’état de `main`, et le restera jusqu’à la fusion.

Deux appels d’API `TransformControls`, gain d’ergonomie immédiat, coût quasi nul :
`setTranslationSnap`, `setRotationSnap`, `setScaleSnap`, `setSpace('local' | 'world')`.

**Où vivent les réglages.** Dans le registre de réglages, avec les autres réglages du viewport 3D
(`ViewportOptions` de `SceneRenderer.ts:45` et son `configure`) — pas en constantes dans le moteur.
C’est la faute que `configure` a précisément corrigée : « these were three constants, and therefore
three settings nobody could reach ».

**L’interface.** Deux bascules dans la barre d’outils de la scène : magnétisme (on/off, pas réglable
dans les préférences), et repère local/monde. Deux entrées dans `SCENE_TOOLS`, deux `CommandId`
(`scene.snap`, `scene.space`), deux paires de clés i18n dans **`fr.json` et `en.json`**, deux `case`
dans le `switch` de `SceneDocument.tsx`. Le chemin est balisé par les huit commandes existantes.

**Pas de second registre de commandes.** `COMMAND_REGISTRY` (`shared/domain/command.ts`) est le
seul. C’est écrit dans `REPRISE.md` comme une erreur déjà commise et supprimée.

---

## Étape 3 — Import glTF

- [x] Livrée — **sans Draco/KTX2 ni Web Worker**, voir plus bas

**Ce qui est livré.** Le type de nœud `model` portant `{ assetId }`, sa validation, son cache à
comptage de références, et les trois portes d’entrée : double-clic sur un asset `mesh`, dépôt sur
le viewport, génération 3D qui revient dans le document d’où elle est partie. Plus l’import
depuis le disque. 2364 → 2401 tests.

**Deux reports, écrits noir sur blanc :**

1. **Draco et KTX2 ne sont pas branchés.** Ce ne sont pas les dépendances qui bloquent — elles
   sont autorisées — mais l’endroit d’où servir leurs décodeurs : ~700 Ko de wasm plus leur glue
   JS, dont le chemin diffère entre le serveur de dev et une application empaquetée, et je ne
   peux pas valider un build empaqueté cette nuit. Le loader est construit dans
   `gltf-source.ts` **et nulle part ailleurs** : les brancher plus tard, c’est cette fonction et
   aucune autre. En attendant, un `.glb` compressé échoue comme un fichier illisible.
2. **Le parsing n’est pas en Web Worker.** Le plan autorise explicitement ce report. Un GLB de
   300 Mo gèlera la fenêtre le temps du parsing. Le port `loadModel` est le point d’accroche : y
   passer un worker ne change rien au reste.

**Trois divergences par rapport au plan, assumées :**

1. **`NODE_KINDS` n’a pas gagné de troisième ligne.** Son test exige de chaque entrée les clés
   `add`, `remove`, `empty` et `noDocument` — c’est un registre de *panneaux*, et un modèle n’a
   ni menu Ajouter, ni panneau, ni état vide. Lui en inventer aurait été quatre clés mortes.
   D’où `PanelNodeType = Exclude<SceneNodeType, 'model'>` : un type de nœud qui mérite un panneau
   casse toujours la compilation, un modèle non. L’outliner, lui, liste bien les modèles.
2. **`.gltf` n’est pas importable, `.glb` seul l’est.** Un `.gltf` séparé pointe ses buffers et
   ses textures par chemin relatif, et un asset est servi à plat en `scenario://asset/<id>` : les
   fichiers voisins n’ont pas d’id, le loader ferait 404 sur chacun et afficherait un modèle vide
   sans rien dire. Mieux vaut refuser dans le sélecteur que trahir dans le viewport.
3. **`skybox-generation` a été factorisé avec le nouveau.** Les deux fichiers étaient identiques
   à trois valeurs près, et seul l’ancien avait des tests. `generation-landing.ts` porte la
   machinerie, les deux espaces la déclarent en dix lignes. Idem pour les caches :
   `engines/core/ref-cache.ts` porte le comptage de références et sa course subtile, que
   `texture-cache` et `model-cache` partagent désormais.

**Cinq bugs trouvés par `/simplify` et `/code-review`, tous corrigés :**

- **un modèle importé était insélectionnable à la souris.** `GLTFLoader` nomme chaque maille
  qu’il construit, et le picking remontait au premier nom trouvé : un clic répondait `mesh_0`, et
  cet id fantôme partait dans la sélection, dans l’historique et dans le document. Le picking
  n’accepte plus qu’un nom que le moteur a lui-même posé ;
- **importer un `.glb` depuis le disque créait la ligne de catalogue puis la supprimait.**
  Le pipeline média ffprobe tout type importable ; un GLB n’est pas un média, donc « illisible »,
  donc `discard`. Le fichier disparaissait de la bibliothèque une seconde après y être apparu.
  Perfide : sur cette machine le ffprobe de Homebrew est cassé, donc le bug ne s’y voyait pas —
  il aurait frappé toute machine saine ;
- **la référence du cache était relâchée deux fois** : supprimer un de deux nœuds pointant le
  même asset libérait la source que l’autre était en train de cloner ;
- **le dépôt sur le viewport ne fonctionnait pas** : `getData` rend une chaîne vide pendant un
  `dragover`, donc le `preventDefault` conditionnel n’avait jamais lieu ;
- **un `assetId` changeant sur un nœud existant** n’était traité nulle part : ancien modèle
  toujours à l’écran, ancienne référence jamais rendue, et décrément du mauvais compteur.

**Le manuel a été corrigé** : il affirmait à six endroits que les modèles 3D ne s’importent pas.

L’étape la plus grosse. Elle applique la décision d’architecture ci-dessus.

**3a — Le type de nœud.** `SceneNodeType` gagne `'model'`. `shared/domain/scene.ts` gagne
`ModelRef = { assetId: string }`. `scene-document.ts` gagne sa branche de validation — un
`assetId` absent ou non-chaîne fait tomber le nœud, pas le fichier. `NODE_KINDS` gagne sa
troisième ligne, avec son icône `@mdi/js` et son namespace i18n.

**3b — Le chargement.** `engines/scene/model-cache.ts`, calqué **sur `texture-cache.ts`** :
comptage de références, une entrée par `assetId`, un port injectable pour le loader (jsdom ne
décode pas un GLB, exactement comme il ne décode pas une image). Le port est ce qui rend l’étape
testable — ne pas câbler `GLTFLoader` en dur.

Draco et KTX2 : `DRACOLoader` et `KTX2Loader` branchés sur le `GLTFLoader`, decoders posés dans
`resources/`, jamais chargés depuis un CDN — la CSP d’Electron l’interdit et le hors-ligne est une
promesse du projet (« le chargement 3D ne dépend jamais du réseau »).

**3c — Les portes d’entrée.** Trois, comme pour les skyboxes, et pour la même raison — un espace
sans porte est un espace mort :
1. double-clic sur un asset de type `mesh` dans le navigateur d’assets ;
2. dépôt d’un asset `mesh` sur le viewport ;
3. une génération 3D qui aboutit se pose dans le document d’où elle est partie.

Regarder `stores/skybox-generation.ts` et `helpers/open-asset.ts` avant d’écrire : le mécanisme
existe, il se réutilise.

**3d — L’import de fichier local.** `IMPORTABLE_TYPES` (`main/media/link.ts`) ne connaît que vidéo,
audio et image. Un `.glb` déposé depuis le disque n’entre pas dans le catalogue. Ajouter `mesh` avec
ses extensions (`.glb`, `.gltf`) — sinon seuls les modèles générés sont importables, ce qui n’a
aucun sens.

**Le garde-fou à ne pas oublier.** Un GLB de 300 Mo ne doit pas geler la fenêtre : le parsing part
en Web Worker (invariant 6, qui nomme explicitement « parsing de gros GLB »). Si le worker
complique trop l’étape, la livrer sans, **mais le noter ici** — pas le passer sous silence.

**Tests attendus** : le cache rend la même instance à deux nœuds partageant un `assetId`, la libère
au dernier relâchement, ne ressuscite pas un modèle relâché avant son arrivée ; un nœud `model`
survit à un aller-retour d’enregistrement ; un `assetId` inconnu ne fait pas tomber la scène.

---

## Étape 4 — Ombres

- [x] Livrée

**Ce qui est livré.** `castShadow` / `receiveShadow` par nœud, deux cases dans une section
**Ombres** de l’inspecteur, `shadowMap` activé sur le viewport de la scène seule, et deux
réglages : douceur et finesse. 2401 → 2420 tests.

**Le risque silencieux, traité en premier.** Un `.scene` écrit avant cette étape n’a pas les
deux champs. `sceneFromPayload` les remplit au chargement au lieu de les exiger — un nœud refusé
est indiscernable d’un nœud qui n’a jamais existé, donc exiger les flags aurait vidé chaque
document existant sans un mot. Quatre tests le verrouillent, dont un qui reconstruit un fichier
d’avant l’étape en retirant les champs. `null` compte comme absent : un outil qui sérialise les
champs manquants ainsi ne doit pas coûter le nœud.

**Sur « mesurer avant de décider ».** Le plan demandait de mesurer le coût avant de choisir le
défaut. Je n’ai pas mesuré de fps — l’app ne tourne pas dans cette boucle — mais le comptage est
exact et suffisant : une scène neuve a une ambiante, une directionnelle et une hémisphérique, et
seule la directionnelle projette, soit **une passe de profondeur plus la passe principale, deux
rendus par frame**. Aucune ponctuelle par défaut, donc jamais les six. Le défaut retenu est celui
que le plan désignait comme repli, et il est visible : une case par lumière dans l’inspecteur.
Le spot est off lui aussi, bien qu’il ne coûte qu’une passe comme la directionnelle — sa raison
est autre : pointé vers −Y sur un décor que personne n’a encore visé, il produit surtout de
l’acné d’ombre.

**Quatre bugs trouvés par `/simplify` et `/code-review`, tous corrigés :**

- **le troisième niveau de douceur ne faisait rien.** `PCFSoftShadowMap` est déprécié dans
  three 0.185 : le moteur le remplace par `PCFShadowMap` et journalise un avertissement — à
  chaque `configure`, puisque le garde d’idempotence ne mordait plus. « Très douce » rendait donc
  exactement comme « Douce ». Le réglage n’offre plus que les deux filtres réellement appliqués ;
- **un modèle importé ne projetait aucune ombre.** Son fichier arrive après le sync qui a bâti
  son porteur, et le sync suivant saute un nœud inchangé : les flags n’atteignaient jamais ce qui
  était arrivé. Ils sont posés là où le fichier atterrit ;
- **la directionnelle n’éclairait qu’un carré de dix unités.** Son frustum d’ombre naît en
  ±5 ; sur la grille de vingt mètres contre laquelle une scène se construit, la moitié des objets
  ne projetait rien, sans le moindre indice. Il est maintenant dimensionné sur la grille ;
- **cocher « projette une ombre » sur une ambiante** faisait avertir three.js à chaque frame pour
  un effet nul — et la scène par défaut en contient deux. La case n’est plus offerte aux lumières
  qui n’ont pas de caméra d’ombre.

**Une correction d’honnêteté.** Le commentaire justifiant `needsUpdate` décrivait un mécanisme
inexistant : three.js recompile de lui-même sur changement de type, et `needsUpdate` n’est lu que
si `autoUpdate` est coupé, ce qu’il n’est jamais ici. L’écriture et son commentaire sont partis.

**Le manuel a été corrigé** : il listait les ombres portées parmi ce qui n’existe pas, et sa table
des valeurs par défaut ignorait les deux nouveaux réglages.

`shadowMap` activé sur le renderer du `ViewportEngine`, `castShadow` / `receiveShadow` par nœud —
deux booléens dans `SceneNodeBase`, donc deux cases dans l’inspecteur et **deux champs de plus à
valider** dans `scene-document.ts`. Type de map et résolution : deux réglages du viewport, pas deux
constantes.

**Compatibilité du format.** Un `.scene` écrit avant cette étape n’a pas ces champs. La validation
doit les traiter comme absents-donc-défaut, **pas** comme un nœud invalide — sinon toute scène
existante se vide au chargement. C’est le vrai risque de cette étape, et il est silencieux.

**Le coût.** Une `PointLight` avec ombres, c’est six rendus de la scène par frame. Si le viewport
tombe sous 60 fps sur une scène simple, l’ombre par défaut est **off** sur les lumières autres que
directionnelle, et le réglage est visible. Mesurer avant de décider.

---

## Étape 5 — Environnement / IBL dans le viewport

- [x] Livrée

**Ce qui est livré.** `createEnvironment` branché dans `SceneRenderer`, l’environnement choisi
porté par le document (studio ou skybox du projet), une section **Environnement** dans
l’inspecteur — visible même sans sélection, puisque c’est une propriété du document et non d’un
nœud. C’est le lien Skyboxes → 3D que la conception promettait. 2420 → 2434 tests.

**Une décision de conception.** L’inspecteur n’affiche plus « sélectionnez un objet » quand rien
n’est sélectionné : il affiche l’environnement. Le message disait au panneau d’être vide alors
qu’il avait quelque chose à montrer, et l'`EmptyState` empilé sous une section faisait défiler le
panneau au lieu de se centrer.

**Une correction que le plan n’avait pas prévue : l’IBL annulait l’étape précédente.** Un
environnement éclaire de partout et n’est occulté par rien ; à pleine intensité il remplit les
ombres que les lumières viennent de projeter. Le studio de l’éditeur de scène est donc posé à
0,4 — la préversion de texture, qui n’a ni lumières ni ombres, garde sa pleine intensité.

**Trois bugs, tous dans la portion que j’avais recopiée depuis `TextureRenderer` :**

- **revenir au studio laissait le viewport noir.** `setStudio` éclaire la scène mais n’accroche
  rien derrière : après avoir effacé le ciel, le fond restait vide. Reproductible en trois clics ;
- **le ciel disparaissait du fond au changement de thème ou de taille de grille.** `applyPalette`
  repeint le fond, écrasant la texture — et rien ne la reposait, si bien que les matériaux
  réfléchissaient un ciel que le fond n’affichait plus ;
- **le ciel était libéré du GPU avant que son remplaçant soit en place**, donc détruit alors
  qu’il était encore accroché au fond : three.js le ré-uploadait à la frame suivante, sans plus
  rien pour le libérer.

Les trois vivaient aussi dans l’espace Textures, d’où ils venaient. `viewport/sky-binding.ts`
porte désormais la mécanique une seule fois, avec ses huit tests — l’ordre des opérations est
toute la subtilité, et deux copies en étaient une de trop. `readEnvironment` a suivi le même
chemin vers `shared/domain`, et `PreviewEnvironment` n’est plus qu’un nom pour `EnvironmentRef`.

**Un arbitrage identifié et non pris : le tone mapping.** `ViewportEngine` documente que « un
viewport qui juge un environnement HDR l’active », et l’espace Textures l’active. L’espace 3D ne
l’active pas, si bien qu’un même ciel sur un même matériau ne rend pas pareil dans les deux. Je ne
l’ai pas activé : cela change l’aspect de toutes les scènes existantes, et je ne peux pas le
regarder cette nuit. À trancher en voyant les deux images.

**Rien à écrire : à brancher.** `engines/viewport/environment.ts` porte déjà `createEnvironment`
avec `setStudio`, `setTexture`, `refresh`, `setIntensity`, `setRotation`,
`setBackgroundVisible`. `TextureRenderer` et `SkyboxRenderer` l’utilisent tous les deux —
`SceneRenderer` est le seul des trois à s’en passer, et c’est pourquoi la 3D s’éclaire moins bien
que l’aperçu d’une texture.

1. `SceneRenderer.mount` appelle `createEnvironment` puis `setStudio()`, comme
   `TextureRenderer.ts:69-70`. Une scène neuve est éclairée, même sans lumière.
2. Le document porte l’environnement choisi : studio, ou une skybox du projet par son `assetId`.
   Un champ sur `SceneState`, donc un champ de plus dans `ScenePayload` et sa validation.
3. `refresh` est cher (chaîne de mips complète) : appelé quand le geste se pose, jamais par frame.
   C’est écrit dans la JSDoc du module, la respecter.

C’est le lien **Skyboxes → 3D** que la conception promet depuis le début.

---

## Étape 6 — Groupes et reparentage

- [x] Livrée

**Ce qui est livré.** `parentId` cesse d’attendre : un quatrième type de nœud `group`, la commande
`reparentNode`, `groupNodes` derrière ⌘G et un bouton dans la barre, le glisser-déposer dans
l’outliner avec sa cible surlignée, et le raccrochage côté moteur en seconde passe — un enfant
peut être synchronisé avant que le parent dont il dépend existe. 2434 → 2457 tests.

**La décision du plan, tranchée.** `group` devient un quatrième type de nœud, comme `model` : il
n’a ni menu Ajouter ni panneau, donc il reste hors de `NODE_KINDS`, qui est un registre de
panneaux. Un groupe ne porte rien — un transform, un nom, et ce qui pend dessous.

**Le cycle, interdit à un seul endroit.** `canReparent` refuse qu’un nœud devienne l’enfant de
son propre descendant, avec cinq tests dont un sur un arbre déjà bouclé. C’est le bug classique
de cette fonctionnalité, et c’est une fonction plutôt qu’une vérification recopiée partout où un
parent se choisit.

**Deux bugs de données, tous deux prouvés par exécution en revue :**

- **un groupe était jeté au rechargement.** `isSceneNode` ne connaissait pas le type : enregistrer
  une scène groupée puis la rouvrir supprimait tous les groupes, et leurs enfants gardaient un
  parent que plus rien ne désignait — invisibles dans l’outliner, invisibles dans le viewport, et
  conservés dans le fichier. Le travail de groupage disparaissait en silence ;
- **`subtreeOf` ratait une branche** dès qu’un enfant était déclaré avant son parent — ce que
  `reparentNode` rend possible, puisqu’il change un `parentId` sur place sans toucher à l’ordre.
  Supprimer un groupe laissait alors un nœud fantôme : introuvable, insupprimable, sauvegardé.
  La descente se fait maintenant par index, jamais en pariant sur l’ordre.

**Quatre autres corrections de la revue :**

- **le nom du groupe était traduit**, ce qu’interdit noir sur blanc le commentaire de
  `node-factory` : une scène dont les objets s’appellent « Groupe » en français et « Group » en
  anglais ne se partage pas. Un groupe s’appelle `Group`, comme un cube s’appelle `Box` ;
- **un glissement de gizmo sur une sélection groupée** écrivait une transformation monde dans un
  champ local : le pivot rendait ses objets à la scène plutôt qu’à leur parent, et la
  transformation du groupe s’appliquait une seconde fois au sync suivant ;
- **cocher l’ombre d’un groupe** estampillait tout son sous-arbre sans rien écrire dans les nœuds
  — l’affichage et le document divergeaient. Le parcours profond reste pour les modèles importés,
  qui n’ont qu’un nœud pour tout un arbre ;
- **un dépôt qui ne changeait rien** — reposer une ligne d’où elle vient, le geste le plus courant
  du glisser — entrait quand même dans l’historique, laissant un ⌘Z qui ne fait rien.

**Deux affordances ajoutées en chemin** : un groupe s’ouvre à sa première apparition, faute de
quoi ⌘G faisait disparaître les objets qu’on venait d’y mettre ; et le nouveau groupe se pose là
où vivait la sélection quand elle partageait un parent, au lieu de remonter à la racine.

`helpers/drag.ts` porte désormais le canal de glisser une seule fois — `asset-drag` en était la
première moitié, l’outliner en aurait été la seconde, et la timeline sera la troisième.

`parentId` existe sur `SceneNodeBase` et **aucune commande ne le change** — le champ attend depuis
le premier jour, sa JSDoc le dit (« Reparenting is not offered yet »).

- Une commande `reparent(id, parentId)` dans `commands.ts`, sur le modèle de `editNode` : capturer
  l’ancien parent **à l’application**, pas à la construction.
- Un nœud `group` — ou un `Object3D` vide comme parent. Trancher en regardant `NODE_KINDS` : si
  `group` devient un quatrième type, il suit le même chemin que `model`.
- Le glisser-déposer dans `SceneTree`, avec indicateur d’insertion.
- **Interdire le cycle** : reparenter un nœud sous l’un de ses propres descendants doit être refusé,
  pas produire un arbre qui boucle. Un test dédié, c’est le bug classique de cette fonctionnalité.
- Côté moteur : `syncNode` ajoute aujourd’hui tout objet à `viewport.scene`. Il doit l’ajouter à
  l’objet du parent — et **l’ordre d’application n’est pas garanti**, un enfant peut arriver avant
  son parent. Deux passes, ou un raccrochage différé.

---

## Étape 7 — Dupliquer, copier-coller

- [x] Livrée

**Ce qui existe maintenant.** `copiesOf(nodes, picked)` cloné un sous-arbre entier en réécrivant les
`parentId` vers les nouveaux identifiants, `rootedIn(copies, nodes)` coupe ce qui pend dans le vide,
`addNodes` les pose et les sélectionne. Le presse-papiers est un store du studio
(`stores/scene-clipboard.ts`). Quatre commandes — `scene.duplicate`, `scene.copy`, `scene.cut`,
`scene.paste` — au clavier (`⌘D` `⌘C` `⌘X` `⌘V`) et en quatre boutons de barre d’outils.

**Décisions prises seul, et pourquoi.**

- *Pas de décalage à la duplication.* Le plan l’offrait en option. La copie tombe exactement sur
  l’original et **est sélectionnée** : le geste suivant est de la déplacer, avec la poignée déjà
  armée. Un décalage arbitraire en unités de scène n’a de sens ni sur une maille de 0,1 ni sur un
  modèle de 40 — et il ferait mentir « à côté », qui dans un arbre veut dire « sous le même
  parent ».
- *`addNode` est devenu `addNodes([node])`.* Les deux étaient identiques ligne à ligne, id de
  commande compris.
- *`⌘C` / `⌘X` / `⌘V` malgré `role: 'editMenu'`* (`src/main/menu/template.ts`). Vérifié plutôt que
  supposé : Chromium délivre `keydown` à la page **avant** les accélérateurs de menu, et
  `useShortcuts` fait `preventDefault()` — c’est le même profil que `scene.undo` contre le rôle
  `undo`, qui fonctionne. Dans un champ de saisie, `isTyping` sort sans consommer et l’édition
  native reprend la main.
- *`⌘C` s’efface devant une sélection de texte.* Le raccourci est écouté sur `window` : sans cela,
  copier un nom d’asset ou une ligne de journal pendant qu’un onglet 3D est actif devenait
  impossible. `copiesText(signature)` dans `shared/domain/shortcut.ts` nomme les deux accords
  concernés.
- *Le presse-papiers se vide au changement de projet.* Un nœud `model` nomme un `assetId` du
  catalogue d’origine : collé ailleurs, il se listerait dans l’outliner sans rien dessiner.
- *Les quatre gestes ont un bouton.* Le menu Édition natif affiche Copier/Couper/Coller qui agissent
  sur le texte : sans bouton de la scène, rien ne dirait qu’elle a les siens.

**Bugs trouvés en revue et corrigés.**

- *Le nœud orphelin au collage.* `copiesOf` conserve volontairement un `parentId` hors du set copié
  — c’est ce qui pose un `⌘D` sous le même parent. Mais collé dans une autre scène, ce parent ne
  nomme rien : `flattenTree` retire le nœud de l’outliner **pendant que le viewport le dessine**, et
  il devient injoignable, indélébile et sauvegardé. D’où `rootedIn`, appliqué à la destination.
- *`addNodes([])` vidait la sélection* et posait une entrée d’historique `add:` vide, qui aurait
  coalescé avec la suivante. Un tableau vide rend l’état inchangé.

**Une limite constatée, laissée telle quelle et documentée.** Sur Windows et Linux, `signatureOf`
lit `event.metaKey` : un raccourci `Meta+…` écouté par une surface attend la touche Windows, pas
`Ctrl`. Ce n’est pas propre à cette étape — c’est la convention de tout `COMMAND_REGISTRY`, `⌘Z`
compris — et la corriger touche la résolution des raccourcis de toute l’application. Hors du
périmètre du plan, donc : le manuel disait « c’est un défaut d’affichage, pas de fonctionnement »,
ce qui était faux, et dit maintenant la vérité (§ 15 et § 18, les deux langues).

**Manuel.** Le chapitre 09 a gagné « Dupliquer, copier, coller », le chapitre 15 la table des
raccourcis correspondante. Sa liste « Ce qui manque encore » annonçait encore comme absents les
groupes, l’IBL et la sélection multiple, livrés aux étapes 1, 2 et 5 : corrigée, ici et au
chapitre 18. **Reste à faire en fin de chantier** : le chapitre 09 n’a toujours aucune section sur
le magnétisme, le repère local, les ombres ni l’environnement — les étapes 1 à 6 ont corrigé ce qui
était faux, pas comblé ce qui manque.

Aucune commande dans `commands.ts` aujourd’hui.

- `duplicateNodes(ids)` : nouveaux `id`, décalage optionnel, **la copie devient la sélection**.
- Copier / coller via un presse-papiers interne au studio (pas le presse-papiers système : un
  `SceneNode` n’a pas de représentation texte utile, et le presse-papiers système est partagé avec
  le reste de l’OS).
- Un sous-arbre se duplique **entier**, avec ses `parentId` réécrits vers les nouveaux identifiants.
  C’est ce qui rend cette étape dépendante de l’étape 6 — la faire après, pas avant.
- Quatre `CommandId` (`scene.duplicate`, `scene.copy`, `scene.paste`, et `scene.cut` si le geste est
  offert), avec leurs clés i18n dans les deux bundles.

---

## Étape 8 — `sprite` et `text`

- [x] Livrée pour `sprite`. **`text` reporté**, raison écrite plus bas.

**Le chemin choisi est le premier des deux que proposait cette étape** : `sprite` est un type de
nœud à part entière, comme `model` et `group`. `SpriteDescriptor { color, opacity, map }` vit dans
`shared/domain/scene.ts`, le moteur construit un `Sprite` + `SpriteMaterial`, l’inspecteur lui
donne sa section, et le document le relit. `sprite` et `text` ont quitté `MESH_ENTRIES` pour
`OBJECT_ENTRIES` : `MeshKind = GeometryDescriptor['kind']` redevient vrai, et le menu natif gagne
un sous-menu **Objet** à côté de Maille et Lumière.

**Pourquoi `text` est reporté, noir sur blanc.** three.js construit un texte en volume avec
`TextGeometry`, qui exige un **fichier de police converti** au format typeface JSON. Trois voies,
toutes fermées ce soir :

1. *Depuis le projet*, comme le demandait le plan — le catalogue ne connaît que `image`, `video`,
   `audio`, `mesh`, `texture` et `skybox`. Ajouter un genre `font` traverse toute la chaîne
   d’import (collector, dossiers, filtres du navigateur d’assets, vignettes, i18n) : c’est une
   étape à soi seule, plus grosse que celle-ci.
2. *Embarquée dans l’application* — convertir une police au format attendu demande un outil que je
   n’ai pas hors ligne.
3. *Celle que livre three.js* (`helvetiker`) — dérivée d’Helvetica. Embarquer ça dans une
   application fermée est une décision de licence, pas une décision technique, et elle n’est pas la
   mienne à prendre.

L’entrée reste donc grisée, et le manuel dit maintenant **pourquoi** au lieu de « annoncé mais pas
encore constructible ». Le plan prévoyait ce cas : « elle est la plus reportable des onze ».

**Décisions prises seul.**

- *Pas de panneau Sprites.* `PanelNodeType` exclut désormais `sprite` : un panneau listant les
  sprites d’une scène serait un panneau d’une ligne et d’un bouton Ajouter. Le sprite s’ajoute
  depuis la barre d’outils et le menu natif, et se retrouve dans l’Explorateur comme tout le reste.
- *Le panneau Mailles n’offre plus Sprite.* Il ajoute ce qu’il liste ; proposer un nœud qu’il ne
  montrerait jamais était le vrai défaut de l’ancien registre.
- *`Exclude` gardé plutôt qu'`Extract` pour `PanelNodeType`*, contre l’avis de la passe de
  simplification. La liste d’exclusion grandit, c’est vrai — mais c’est exactement elle qui a forcé
  la question « ce type a-t-il un panneau ? » à la compilation quand `sprite` est apparu. Un
  `Extract` aurait laissé passer l’oubli en silence.
- *Pas de `sizeAttenuation` ni de rotation dans le descripteur.* Aucun contrôle booléen n’existe
  dans `PropertySpec`, et la taille d’un sprite est déjà son échelle de transformation.

**Deux bugs trouvés en revue et corrigés.**

- *La transparence éteinte à pleine opacité.* J’avais écrit `material.transparent = opacity < 1`,
  ce qui paraissait économe. Or `SpriteMaterial` allume `transparent` dans son constructeur — three
  le commente « sprite materials are transparent ». Ma ligne l’éteignait dans le cas normal, et
  toute image à canal alpha — une lueur, une étincelle, l’usage même d’un sprite — aurait dessiné
  son carré entier. La ligne est partie ; un test verrouille la règle.
- *Le `SpriteMaterial` jamais disposé.* `release` libère le matériau sous `if (object instanceof
  Mesh)` — un `Sprite` n’en est pas un. Sa géométrie, elle, est délibérément laissée : three.js
  partage un seul quad entre tous les sprites, et la disposer casserait les autres.

**Passe de simplification, ce qui a été appliqué.** Le JSDoc de `setMaterialOn` s’était retrouvé
au-dessus d’une autre fonction ; `patchMesh`/`patchLight`/`patchSprite` sont devenus un seul
`patchPart<T>` générique, sans `as` ; `SceneNodeType` se dérive maintenant de l’union `SceneNode`
au lieu d’être réécrit à côté ; `shadowDefaults` lit ses deux prédicats au lieu de rejouer leurs
cas ; la règle « pas d’ombres pour un sprite » appartient à `ShadowSection` plutôt que d’être
écrite aussi chez son appelant ; `PictureField` porte une fois les trois libellés que les deux
sections répétaient ; et le `create?:` optionnel des primitives, devenu inatteignable, a disparu
avec la branche morte qu’il imposait à `createNodeOf`.

**Manuel.** Le chapitre 09 gagne « Le sprite — une image face à la caméra », et sa liste de manques
ne mentionne plus que le texte. Le chapitre 18 explique le report plutôt que de le constater.

Déclarés dans `MESH_ENTRIES` avec `disabled: true`, grisés dans tous les menus parce que
`MESH_BUILDERS` ne leur donne pas de `create` (`mesh-primitives.ts:141`). Leur JSDoc dit le pourquoi :
« neither is a geometry ».

Ils ne sont donc **pas** des `GeometryDescriptor`. Deux chemins possibles, trancher et écrire
lequel :
- ils deviennent des types de nœuds à part (comme `model`), ce qui est cohérent avec le reste ;
- ou `MeshNode` accueille un descripteur non géométrique, ce qui abîme l’union qui protège
  aujourd’hui le format.

**Le premier chemin est le bon** — c’est celui que ce plan a déjà pris deux fois. Le texte 3D
demande une police : la charger depuis le projet, jamais depuis le réseau.

Si l’étape déborde, elle est la **plus reportable des onze** : deux entrées grisées ne sont pas une
régression. Le noter ici plutôt que de la bâcler.

---

## Étape 9 — Caméra orthographique, vues normalisées, filaire

- [x] Livrée

**Les trois y sont.** La projection bascule (`O`), la caméra va se poser sur l’un des six côtés, et
le viewport dessine les surfaces, leurs arêtes, ou les deux (`Z`, comme dans Blender). Tout cela
est de l'**état de session**, dans un store `scene-views` calqué sur `canvas-views` : par document,
jamais enregistré, jamais dans l’historique.

**Qui d’autre lit `viewport.camera`, vérifié avant d’y toucher** : `SkyboxRenderer`,
`TextureRenderer` et `SceneRenderer`. La bascule ne leur impose rien — `ViewportEngine` garde ses
deux caméras, `camera` devient un accesseur sur celle qui dessine, et les deux autres espaces ne
touchent jamais à `setProjection`. Une seule ligne a dû bouger ailleurs : `SceneRenderer` écrivait
`camera.fov` directement, il passe maintenant par `viewport.setFieldOfView` — le tronc
orthographique est dérivé de ce champ de vision, il doit se redimensionner avec lui.

**Décisions prises seul.**

- *Le clic du `ViewHelper` n’est pas câblé*, alors que le plan le suggérait. Son animation déplace
  la caméra autour de son propre `center` sans rien dire à `OrbitControls` : la cible de l’orbite
  et la caméra divergeraient, et le premier glisser suivant ramènerait la vue ailleurs. Les six
  côtés passent donc par `viewFrom`, qui repose la caméra puis appelle `orbit.update()`. Câbler le
  helper demanderait de tenir son `center` et la cible de l’orbite en phase : à faire un jour, pas
  au prix d’une vue qui saute.
- *Les vues de dessus et de dessous sont décalées d’un dix-millième de la distance.* Un angle
  polaire de zéro exact n’a pas d’azimut : `OrbitControls` lit la position en coordonnées
  sphériques, et le glisser suivant collerait la vue sur un côté arbitraire.
- *Le troisième mode d’affichage est une surcouche, pas un second passage de rendu* — comme le plan
  l’exigeait. Un matériau filaire ne dessine aucune surface : « rendu **et** filaire » ne peut donc
  pas être un drapeau de matériau. Ce sont des `LineSegments` accrochés sous chaque maille,
  construits quand le mode s’allume et jetés quand il s’éteint, plutôt que gardés en vie pour un
  mode que personne ne laisse allumé.
- *Le bouton Affichage porte une commande*, contrairement à Ajouter et aux six côtés. Un bouton qui
  affiche le mode en cours n’ouvre pas son menu au clic — c’est la règle de `Toolbar` — et il
  serait resté un clic mort. Il fait donc défiler les trois modes, et son menu permet toujours de
  choisir directement.

**Trois bugs trouvés à la relecture et corrigés.**

- *Un modèle qui atterrit après la bascule n’avait pas ses arêtes.* Un GLB arrive longtemps après
  la frame qui l’a demandé : le mode avait été appliqué à un porteur encore vide. Corrigé au même
  endroit, et pour la même raison, que les drapeaux d’ombre.
- *Les arêtes fuyaient à la suppression d’un nœud.* Elles sont un enfant de la maille, avec leur
  propre tampon ; `release` ne disposait que la géométrie de la maille elle-même.
- *Le tronc orthographique se calculait depuis une position périmée.* Un redimensionnement de
  fenêtre pendant que la perspective est active lisait la place où la caméra orthographique était
  au dernier échange. Il lit maintenant celle qui dessine.

**Manuel.** Le chapitre 09 gagne « Regarder la scène autrement », le chapitre 15 ses raccourcis. La
table anglaise des outils avait perdu Magnétisme et Repère local depuis l’étape 1 : remise en
accord avec la française au passage.

Rien de tout cela n’existe dans le viewport.

- Bascule perspective / orthographique. La caméra vit dans `ViewportEngine`, **partagé avec les
  espaces Textures et Skyboxes** : la bascule ne doit pas leur imposer un comportement. Regarder qui
  d’autre lit `viewport.camera` avant d’y toucher.
- Vues normalisées : dessus, dessous, face, dos, gauche, droite. Le `ViewHelper` est déjà là et son
  clic pourrait les servir.
- Affichage : rendu, filaire, rendu + filaire. Sur les matériaux, pas sur un second passage de
  rendu.
- Ces trois-là sont de l'**état de session**, jamais du document et jamais de l’historique : c’est
  la règle que `canvas-views.ts` a posée pour l’espace Image, la suivre.

---

## Étape 10 — Export glTF / GLB / USDZ

- [x] Livrée

**Fichier ▸ Exporter la scène** et **Fichier ▸ Exporter la sélection**, trois formats chacun. Aucune
dépendance nouvelle : `GLTFExporter` et `USDZExporter` viennent de `three/addons`.

**L’invariant 1 est tenu.** Le renderer encode et n’obtient jamais de chemin : il envoie des octets
sur `scene:export`, le main ouvre la boîte d’enregistrement, écrit, et répond **le nom du fichier**,
jamais son chemin — la même règle que `withoutSourcePath` applique aux assets. Le canal est typé des
deux côtés dans `shared/ipc.ts`, et validé par zod à l’arrivée : format connu, nom sans séparateur,
octets bornés.

**« Le vérifier sur le fichier produit », comme le plan l’exigeait.** Les exporteurs de three
tournent sous jsdom sans contexte GL : les tests écrivent un vrai `.gltf`, le relisent en JSON et
regardent ce qu’il contient. `scene-renderer-export.test.ts` construit un `SceneRenderer` sans le
monter, lui donne une maille et une lumière directionnelle — laquelle fabrique **un helper et une
cible**, tous deux posés dans le viewport à côté des nœuds, le helper portant même l’identifiant de
la lumière — puis vérifie que le fichier contient exactement deux nœuds. Ni grille, ni helper, ni
cible, ni trièdre.

**Décisions prises seul.**

- *Six entrées de menu plutôt qu’un dialogue d’export.* La portée (scène ou sélection) et le format
  sont deux choix ; sans dialogue maison, les poser dans le menu natif évite d’inventer une surface
  et laisse la boîte d’enregistrement faire ce qu’elle sait faire. Aucun `CommandId` n’est créé : le
  menu passe par le même chemin d’événement que l’ajout de nœud.
- *L’export est écouté dans `SceneDocument`, pas dans `useNativeMenu`.* Il lit les objets three.js,
  et ce composant est le seul qui les détienne. Seulement pendant que l’onglet est devant, sans quoi
  deux scènes ouvertes répondraient toutes deux au même clic.
- *Pas de message de confirmation.* Le studio n’a pas de système de notification, et en inventer un
  pour cette étape serait un chantier transverse. La boîte d’enregistrement est la confirmation.

**Deux bugs trouvés à la relecture, avant qu’ils n’atteignent un fichier.**

- *Une sélection imbriquée sortait à la mauvaise place.* Les exporteurs écrivent une transformation
  **locale** : un objet rangé dans un groupe déplacé serait apparu à l’origine. Ce sont désormais
  des copies qui sont remises aux exporteurs, chacune portant la transformation monde de son
  original.
- *L’export réécrivait l’arbre vivant.* `USDZExporter` ne prend qu’une racine ; ma première version
  sortait les objets du viewport pour les regrouper le temps de l’export, et les rendait ensuite.
  Une frame dessinée pendant ce temps aurait fait disparaître la scène, et un échec au milieu
  l’aurait laissée démembrée. Les copies règlent les deux, et permettent au passage de retirer les
  arêtes du mode filaire de la copie plutôt que de les masquer dans l’original.

**Ce qui ne s’exporte pas, et c’est normal** : un sprite. Ni glTF ni USDZ n’ont de notion
d’objet-toujours-face-à-la-caméra ; three les ignore silencieusement. À écrire dans le manuel le
jour où quelqu’un s’en étonne.

`GLTFExporter` et `USDZExporter` viennent de `three/addons`, aucune dépendance nouvelle. La spec les
nomme au § 8.2.

**L’écriture disque passe par le main** — le renderer n’a pas `fs`, c’est l’invariant 1. Un canal
IPC typé dans `shared/ipc.ts`, jamais un `ipcRenderer.invoke('...')` avec une chaîne littérale.

Exporter la scène entière ou la seule sélection (l’étape 1 rend la question naturelle). Ce qui n’est
pas du document ne s’exporte pas : ni grille, ni trièdre, ni gizmo, ni helper de lumière — **le
vérifier sur le fichier produit** plutôt que le supposer, c’est la leçon que le plan de l’espace
Image a écrite pour son propre export.

---

## Étape 11 — BVH pour le picking, instanciation, LOD

- [x] Livrée pour le BVH. **Instanciation et LOD non faits, délibérément** — voir plus bas.

**1. La mesure, d’abord, comme le plan l’exigeait.** `scene-picking.bench.ts` mesure
`intersectObjects` sur des scènes qui tiennent lieu de « trois GLB denses ». Le rayon qui *touche*
est le cas cher : three teste une sphère englobante avant de marcher les triangles, donc un rayon
qui rate ne coûte rien quelle que soit la densité.

| Scène | Rayon qui touche | Rayon qui rate |
|---|---|---|
| 3 modèles de 32k triangles | **1,87 ms** | 0,0002 ms |
| 3 modèles de 131k triangles | **7,29 ms** | 0,0002 ms |
| 3 modèles de 524k triangles | **32,2 ms** | 0,0002 ms |
| 2500 petites mailles | 0,13 ms | 0,13 ms |

Le seuil du plan était 2 ms. Trois modèles de 131k triangles — un asset généré tout à fait
ordinaire — coûtent **7,3 ms par clic**, et des modèles denses en coûtent 32, soit deux frames
perdues sur un simple clic. L’étape ne s’arrête donc pas à sa note.

**2. Le BVH, en Web Worker comme l’invariant 6 le nomme.** `three-mesh-bvh` (autorisé) construit
l’arbre dans `bvh-worker.ts` ; seuls les tampons traversent, jamais une géométrie — elle n’est pas
clonable par structure, et le worker n’a pas de scène où la mettre. Ce qui revient est l’arbre
sérialisé **plus l’index sur lequel la construction s’est arrêtée** : three-mesh-bvh réordonne les
triangles, et la géométrie de l’autre côté doit prendre cet index avec l’arbre, sinon les deux
décrivent des maillages différents.

**La mesure d’après, sur la même machine :**

| Scène | Avant | Avec l’arbre |
|---|---|---|
| 3 modèles de 131k triangles | 7,87 ms | **0,016 ms** |
| 3 modèles de 524k triangles | 34,0 ms | **0,018 ms** |

**3. Instanciation et LOD : non faits, et c’est le plan qui le demande.** « Ne rien faire sans un
cas réel. Une optimisation sans mesure est une complication. » Aucun cas réel ne s’est présenté
cette nuit : le seul coût mesuré était le picking, et il est réglé. Les deux restent à faire le jour
où une scène les réclame, mesure en main.

**Décisions prises seul.**

- *Un seul worker, pas un pool.* L’invariant 6 borne un pool à `hardwareConcurrency − 2`, et un est
  dans cette borne. Ce que l’invariant protège, c’est que la construction quitte le thread UI ; un
  second worker n’aiderait qu’une scène important plusieurs modèles denses au même instant.
- *Un seuil de 20 000 triangles.* En dessous, marcher les triangles est déjà plus rapide que
  construire l’arbre — a fortiori que l’envoyer deux fois à travers une frontière. Une primitive du
  studio fait trente triangles.
- *Le worker ne démarre qu’au premier modèle dense.* Un thread ouvert au montage coûterait pour
  rien dans une scène qui n’aura jamais que des cubes.
- *Les prototypes sont patchés une fois pour toutes.* `acceleratedRaycast` retombe sur le raycast
  d’origine quand la géométrie n’a pas d’arbre — vérifié dans la source — donc les espaces Textures
  et Skyboxes, qui n’en construisent jamais, ne changent pas de comportement.

**Un bug trouvé à la relecture.** `dispose()` vidait la table des requêtes en vol sans les résoudre :
la promesse attendue ne se terminait jamais, et sa fermeture gardait la maille en vie. Un panneau
détaché, un document fermé — c’est fréquent ici. Elles se résolvent maintenant sur rien.

**Licence.** `three-mesh-bvh` est MIT ; sa notice est ajoutée à `licences.json`, que le test de
licences vérifie dépendance par dépendance. Les requêtes de `LicencesWindow.test.tsx` ont dû être
ancrées : `three` est un préfixe de `three-mesh-bvh`, et `/three/` trouvait désormais les deux.

**À faire en dernier, et seulement mesure en main.** Le raycast parcourt aujourd’hui tous les objets
(`SceneRenderer.ts:438-439`) et personne ne s’en est plaint — parce qu’aucune scène n’est encore
assez lourde. L’étape 3 change cela.

1. **Mesurer d’abord** : temps de `intersectObjects` sur une scène avec trois GLB denses. Écrire le
   chiffre ici. Sous 2 ms, l’étape se réduit à sa note et s’arrête là.
2. Si c’est lourd : `three-mesh-bvh` (autorisé), BVH construit **en Web Worker** — invariant 6, qui
   nomme « construction de BVH » explicitement.
3. Instanciation et LOD : ne rien faire sans un cas réel. Une optimisation sans mesure est une
   complication.

---

## Récapitulatif, au terme des onze étapes

Onze étapes, onze commits, sur `feat/3d-completion`. `pnpm validate` vert à chaque commit ; 2561
tests au dernier.

### Ce qui est livré

| # | Étape | Ce que le logiciel sait faire de plus |
|---|---|---|
| 1 | Sélection multiple | plusieurs objets se choisissent, se déplacent et s’éditent ensemble |
| 2 | Reparentage et groupes | les objets se rangent en arbre, au glisser comme au `⌘G` |
| 3 | Import de modèles | un GLB du projet entre dans la scène en un nœud |
| 4 | Ombres | les objets projettent et reçoivent, réglable par nœud |
| 5 | Environnement | une skybox du projet éclaire la scène et s’y reflète |
| 6 | Glisser-déposer | un asset se dépose dans le viewport |
| 7 | Dupliquer, copier-coller | `⌘D` `⌘C` `⌘X` `⌘V`, d’une scène à l’autre |
| 8 | `sprite` | une image qui fait toujours face à la caméra |
| 9 | Projection, vues, filaire | vue orthographique, six côtés, trois modes de dessin |
| 10 | Export | glTF, GLB et USDZ, scène entière ou sélection |
| 11 | BVH | un clic sur un modèle dense passe de 7,3 ms à 0,016 ms |

### Ce qui est reporté, et pourquoi

- **Le texte 3D** (étape 8). `TextGeometry` exige un fichier de police converti. Le catalogue ne
  connaît pas ce genre d’asset et lui en ajouter un traverse toute la chaîne d’import ; convertir
  une police hors ligne demande un outil absent ; et la seule que livre three.js dérive
  d’Helvetica, ce qui est une décision de licence pour une application fermée, pas une décision
  technique. L’entrée reste grisée et le manuel dit pourquoi.
- **Instanciation et LOD** (étape 11), sur ordre du plan : aucun cas réel ne s’est présenté, et le
  seul coût mesuré était le picking.
- **Le clic du `ViewHelper`** (étape 9) : son animation déplace la caméra sans rien dire à
  `OrbitControls`, la cible de l’orbite et la caméra divergeraient. Les six côtés passent par du
  code qui repose la caméra puis met l’orbite à jour.

### Ce qui reste à revoir

1. **Les points 3 et 4 de la Definition of Done ont été menés à un seul regard à partir de
   l’étape 8.** La limite hebdomadaire de l’API a coupé les sous-agents en pleine revue de
   l’étape 8 ; les étapes 8 à 11 ont été relues par moi seul. C’est là qu’une revue humaine a le
   plus de valeur. Les bugs trouvés à ces relectures sont écrits étape par étape ci-dessus.
2. **Sur Windows et Linux, les raccourcis qu’une surface écoute elle-même attendent la touche
   Windows, pas `Ctrl`** — `signatureOf` lit `event.metaKey`. Convention de tout
   `COMMAND_REGISTRY`, `⌘Z` compris ; la corriger touche la résolution des raccourcis de toute
   l’application. Documenté aux chapitres 15 et 18 du manuel.
3. **Un sprite ne s’exporte pas** : ni glTF ni USDZ n’ont de notion d’objet toujours face à la
   caméra, et three les ignore silencieusement. Non documenté dans le manuel.
4. **Le chapitre 09 du manuel n’a pas de section** sur le magnétisme, le repère local, les ombres
   ni l’environnement. Les étapes 1 à 6 ont corrigé ce qui y était faux, pas comblé ce qui manque.
5. **`docs/REPRISE.md` § 3.3 est à réécrire** — voir « Au réveil » ci-dessous. Volontairement pas
   fait au fil de l’eau.

---

## Ce que ce plan ne couvre pas, délibérément

Deux chantiers transverses, écartés par l’utilisateur pour cette nuit — ils touchent les six
espaces, pas seulement la 3D :

- **Le décodage du clone IPC** (73 % du coût d’un `⌘S`, gel au-delà de ~5 500 nœuds). Contourné par
  la décision d’architecture de l’étape 3, pas résolu.
- **La surface d’erreur** (§ 2 de `REPRISE.md`). Conséquence concrète ici : un import glTF qui
  échoue ne dira rien à l’utilisateur. Chaque étape doit donc **au minimum journaliser** ses échecs
  côté main, pour qu’ils soient trouvables même sans surface.

Si une étape butte sur l’un des deux, elle s’arrête et le note — elle ne lance pas le chantier
transverse en passant.

## Au réveil

`docs/REPRISE.md` § 3.3 devra être réécrit pour refléter ce qui a été livré. **Ne pas le faire au
fil de l’eau** : le tableau des manques est vrai jusqu’à la fusion, et un document qui décrit un
état non fusionné est pire qu’un document daté. Une dernière étape, après la revue.
