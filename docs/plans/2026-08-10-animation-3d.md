# Plan — l'animation 3D, et les pistes des trois espaces

**Base** `develop` · une branche par lot, nommée dans le tableau des lots.

Écrit le 10 août 2026, après une séance de conception avec l'utilisateur et une lecture du
catalogue Scenario **par appel** (MCP `scenario`, 50 modèles 3D publics listés, trois schémas lus
en entier). Ce qui est mesuré le dit ; ce qui est déduit le dit aussi.

> `docs/scenario-api/` **n'existe pas dans ce dépôt** — vérifié le 10 août, `ls docs/` ne rend que
> `ci`, `design-system`, `en`, `fr`, `plans`, `stt`, `todo.md`. La règle « la doc locale avant le
> web » n'a donc rien à offrir ici, et le MCP est la seule source. Ce n'est pas un pis-aller :
> § 10.3 de la todo dit qu'un appel réel vaut mieux que quatre relectures.

---

## Le geste attendu

> J'importe un personnage que Scenario a animé — je le vois **marcher**. J'ajoute une piste, j'en
> supprime une, j'en réordonne : c'est une timeline. Je pose des clés sur un os pour corriger un
> bras qui traverse le torse. J'ajoute une caméra, je l'anime, et **je sors une vidéo**.

Ce que ça remplace : un GLB animé qui s'importe, s'affiche en pose de repos, immobile, sans que
rien ne dise qu'il portait une animation.

---

## Ce que l'API Scenario offre — listé par appel le 10 août 2026

Sur les **50 modèles 3D publics** retournés par `models_list` (scan client capé à 500), **onze**
touchent au rig ou au mouvement. C'est la deuxième famille du catalogue 3D après l'image-vers-mesh.

| Famille | Modèles | Entrée → sortie |
|---|---|---|
| **Rigging** | `tripo-rigging-v1` (biped), `tripo-rigging-v2-5`, `meshy-rigging`, `uthana-character-rigging`, `cartwheel-character-rigging` | mesh → mesh + squelette |
| **Texte → mouvement** | `uthana-text-to-motion-3.0`, `cartwheel-text-to-motion` | prompt (+ mesh optionnel) → GLB/FBX animé |
| **Vidéo → mouvement** | `uthana-video-to-motion-2.1`, `cartwheel-video-to-motion` | vidéo → mocap retargetée |

**Trois schémas lus en entier, et ce qu'ils apprennent :**

- **`tripo-rigging-v2-5`** porte un paramètre `animation` à valeurs fermées — `quadruped:walk`,
  `hexapod:walk`, `octopod:walk`, `serpentine:march`, `aquatic:march`, ou vide pour « rigger
  seulement ». Scenario sait donc retargeter une animation preset en un appel. `rigType` couvre
  six morphologies non bipèdes.
- **`uthana-text-to-motion-3.0`** : `fps` ∈ {24, 30, 60}, `length` **bornée à 4–10 s**
  (`cost_impact`), et un `animationOnly` qui rend **le mouvement sans le mesh**. La borne de dix
  secondes est structurante : une animation longue est une **suite** de générations, pas une
  seule — ce qui justifie à soi seul une timeline qui sait enchaîner.
- **`cartwheel-video-to-motion`** : jusqu'à quatre personnes suivies, capture faciale (pipeline
  `comic4` seulement), 32 expressions, `loop`, `moveInPlace`, `frameRate` jusqu'à 240,
  `keyframeCleaning`, et des axes `forward`/`up` réglables.

### Le piège de format, à traiter dès le formulaire

`outputFormat` accepte `glb`, `fbx-blender`, `fbx-maya`, `fbx-unreal`, `fbx-roblox`, `ma`, `mb`.

**Le studio ne lit que `.glb`** — `IMPORTABLE_TYPES` (`main/media/link.ts:19`) déclare
`mesh: ['glb']`, et le commentaire au-dessus dit pourquoi `.gltf` est exclu : il pointe ses buffers
et ses textures par chemin relatif, et le studio ne rapatrie qu'un fichier.

Le défaut est `glb`, donc le chemin nominal marche. Mais **un formulaire qui laisse choisir
`fbx-maya` fait payer une génération dont le résultat ne s'ouvrira jamais**, en silence. C'est le
même genre de silence que l'entrée 41 : la fonction répond, personne ne lit la réponse.

---

## Ce que le studio en fait aujourd'hui : rien, et la porte se ferme en une ligne

**`src/renderer/src/engines/scene/gltf-source.ts:62`**

```ts
const gltf = await loader.loadAsync(url)
return gltf.scene          // `gltf.animations` est jeté ici, et nulle part ailleurs
```

Vérifié en conséquence, fichier par fichier :

| Ce qui manque | Où c'est constaté |
|---|---|
| Aucun `AnimationMixer`, aucun `AnimationClip` | les seules occurrences d'« animation » d'`engines/` sont des `requestAnimationFrame` et le trièdre qui tourne |
| Un modèle n'est qu'un identifiant | `ModelRef = { assetId: string }` (`shared/domain/scene.ts:66`) |
| La scène ignore le temps | `SceneState = { nodes, selectedIds, environment }` — pas de durée, pas de tête de lecture |
| **Pas de caméra dans le document** | `SceneState` n'en porte aucune ; la caméra vit dans le viewport |
| La timeline existante est un montage A/V | `TrackKind = 'video' \| 'audio'`, un `Clip` porte `{ assetId, start, duration, inPoint, speed, fadeIn, fadeOut, gain }` — aucune notion de propriété animée |
| **Aucun espace ne sait ajouter une piste** | `engines/timeline/commands.ts` porte `renameTrack`, et **ni `addTrack` ni `removeTrack`** ; aucun appelant côté interface. Vidéo et Audio ont des pistes fixes |

Ce dernier point est le plus surprenant, et c'est l'utilisateur qui l'a formulé : **« add / remove
de pistes, c'est le principe d'une timeline »**. Le manque n'est donc pas propre à la 3D.

---

## Ce qui est déjà en place, et qui rend le chantier plus petit qu'il n'en a l'air

Cinq choses vérifiées, qui changent le chiffrage :

1. **Le crochet d'animation existe déjà dans la boucle de rendu.** `ViewportEngine` expose
   `onFrame?: (delta: number) => boolean` (ligne 35) et `resetClock()` (ligne 273), avec le
   commentaire qui dit qu'« une animation devrait appeler `resetClock` elle-même ». Un
   `mixer.update(delta)` s'y branche **sans toucher la boucle**.
2. **Le piège le plus cher de l'animation three est déjà payé.** `model-cache.ts:33` clone avec
   `SkeletonUtils.clone`, commentaire à l'appui : `SkinnedMesh.copy` garde le squelette de la
   source. `scene-export.ts:135` fait de même. Deux instances d'un personnage ne partagent donc
   pas leurs os.
3. **L'horloge est écrite et réutilisable telle quelle.** `engines/timeline/clock.ts` n'importe
   qu'un alias numérique (`Us`), et elle existe parce que `requestAnimationFrame` dérive
   audiblement en moins d'une minute. `timecode.ts` ne demande que le fps.
4. **Le patron d'annulation est en place.** `Command<S> = { id, apply, revert }`
   (`engines/core/history.ts:8`), déjà employé par les commandes de la timeline et de la scène.
5. **three 0.185.1 porte le mode additif nativement** — `AdditiveAnimationBlendMode`
   (`constants.js:1218`) et `AnimationUtils.makeClipAdditive` (`AnimationUtils.js:251`). La
   décision de l'utilisateur ci-dessous n'est donc pas à implémenter à la main pour les clips.

**Non réutilisable, et il faut le dire** : `timeline-geometry.ts` est bâti sur `Clip`, `Track` et
`SequenceState`, donc sur le montage A/V. Seule la conversion temps ↔ pixels en sort ; le reste ne
sert pas à une piste de clés.

---

## Les décisions tranchées avec l'utilisateur — 10 août 2026

**Elles ne se redemandent pas.**

1. **Les pistes s'additionnent.** Deux pistes qui visent le même objet ajoutent leurs
   contributions ; ce n'est pas « la piste du dessus gagne ». C'est le modèle du NLA de Blender, et
   trois.js le porte nativement pour les clips. **Conséquence assumée : aucune piste seule ne dit
   où est l'objet** — voir la section suivante, qui n'est pas facultative.
2. **La caméra devient un objet de la scène.** Visible dans l'arbre, sélectionnable, déplaçable au
   gizmo, animée par une piste ordinaire, et **exportable** — glTF sait porter une caméra. On peut
   en avoir plusieurs et choisir laquelle rend.
3. **Ajouter et supprimer une piste est écrit pour les trois espaces**, Vidéo et Audio compris.
   Le modèle de données diffère (montage A/V contre animation), donc **c'est le patron qui se
   partage, pas le code**.
4. **Les trois volets sont au programme**, en base utile : lire ce que Scenario produit, créer du
   mouvement soi-même, sortir une vidéo. « Base utile » est défini lot par lot ci-dessous, et ce
   qui en est exclu est écrit explicitement.

---

## L'architecture : une timeline, trois sortes de pistes

Une piste est **une cible et des valeurs dans le temps**. Que la cible soit un clip GLB, un os ou
une propriété de nœud ne change que ce qu'on écrit à la lecture — c'est ce qui rend « les trois »
moins cher que « trois fois un ».

```
ESPACE 3D — bande du bas
┌──────────────────────────────────────────────────────────┐
│ ▶ ⏸ ↺   00:03.4 / 00:10.0   25 i/s      [ Rendre… ]      │
├──────────────────────────────────────────────────────────┤
│ ▾ Perso.glb                                    ● + −     │
│    walk        ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░       │
│    run         ░░░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░       │
│ ▾ Perso.glb › bras.L                           ● + −     │
│    rotation    ◆──────────◆───────────────◆              │
│ ▾ Cube                                         ● + −     │
│    position    ◆────────────────◆                        │
│ ▾ Caméra 1                                     ● + −     │
│    position    ◆──────────────────────────────◆          │
└──────────────────────────────────────────────────────────┘
                                                 ▲
                                    ● = piste armée en écriture
```

**Le modèle, en une phrase par champ.** Il reprend les champs de `Track` du montage A/V — `id`,
`name`, `index`, `height`, `muted`, `solo`, `locked` —, ce qui est délibéré : une piste se
manipule pareil dans les trois espaces.

- **La cible** : un nœud du document, ou un os nommé d'un modèle, ou un clip d'un modèle.
- **Le contenu** : des clips (lot 3) ou des clés (lot 4), jamais les deux sur une même piste.
- **`armed`** : la piste où le gizmo écrit. C'est ce que le mode additif exige, et rien d'autre ne
  peut y répondre.

**Les os ne sont pas des nœuds du document.** Ils vivent dans le GLB, et le document ne porte qu'un
`ModelRef`. Une piste d'os stocke donc **`{ boneName, transform }`** — un nom, jamais une référence
à un objet three. Sans ça l'invariant 3 tombe et le document ne se recharge pas.

---

## Ce que l'additif exige, et qui n'est pas gratuit

C'est la section à lire avant d'écrire la première ligne du lot 4. Le choix est bon — il est natif
dans three pour les clips — mais il a quatre conséquences qu'un modèle « le dessus gagne » n'aurait
pas eues.

1. **Il faut une valeur de base.** Une piste dit « ajoute », donc quelque chose doit dire « à
   quoi ». C'est le `transform` du nœud dans le document : la pose de repos. Résultat = base +
   somme des pistes non muettes.
2. **Les rotations ne s'additionnent pas.** Additionner des angles d'Euler donne un résultat faux
   dès que deux axes bougent. Les contributions se **composent en quaternions**. Le § 10.3 de la
   todo porte déjà le cousin de ce piège — « la conversion rad→deg→rad n'est pas exacte », un axe
   intact déclaré bougé à 13 % près.
3. **L'échelle est multiplicative, pas additive.** Son neutre est 1, pas 0. « Additif » sur une
   échelle veut dire multiplier les contributions ; deux pistes qui doublent chacune donnent ×4,
   et c'est le comportement attendu.
4. **`makeClipAdditive` soustrait une frame de référence** (`referenceFrame = 0` par défaut). Un
   clip rendu additif n'est plus lisible seul : il est un **écart** à sa première pose. Le lot doit
   donc garder le clip d'origine et sa version additive, ou décider que la première piste d'un
   modèle est lue en mode normal et les suivantes en additif — ce qui est le patron habituel.

**Et la question que l'additif pose à l'écran, qui n'est pas technique** : l'inspecteur affiche
quoi — la valeur de base, ou le résultat ? Et quand on bouge le gizmo pendant la lecture, on écrit
où ?

**La réponse retenue est celle de tous les logiciels d'animation** : le gizmo écrit dans la piste
**armée**, et dans la base si aucune ne l'est. L'inspecteur montre le résultat, et signale qu'une
piste le pilote. Sans ce bouton d'armement, l'additif est inutilisable : l'utilisateur bouge un
objet et le voit revenir.

---

## Les lots

| # | Branche | Ce qu'on peut faire à la fin |
|---|---|---|
| **1** | `feat/timeline-tracks` | **ajouter, supprimer, renommer, réordonner une piste** — Vidéo, Audio, et le socle de la 3D. C'est le principe d'une timeline, et aucun espace ne l'a |
| **2** | `feat/3d-panels` | assets à droite, timeline en bas dans l'espace 3D. Trois lignes de `tool.ts`, plus les tests et les deux manuels |
| **3** | `feat/gltf-animations` | un modèle importé **bouge** : `gltf-source` cesse de jeter les animations, un mixer par modèle branché sur le `onFrame` existant |
| **4** | `feat/skeleton` | le squelette est **visible et manipulable** : `SkeletonHelper`, os dans l'arbre, os sélectionnable au gizmo |
| **5** | `feat/animation-tracks` | la timeline 3D pour de bon : pistes de clips, pistes de clés, tête de lecture, armement, additif |
| **6** | `feat/camera-node` | la caméra entre dans le document, la séquence a une durée, **on sort une vidéo** |

**Les lots 1 et 2 ne dépendent de rien** et peuvent partir en parallèle — ils ne touchent pas les
mêmes fichiers. Les lots 3 et 4 ne dépendent que d'eux-mêmes. Le lot 5 demande 1, 3 et 4 ; le lot 6
demande 5.

### Ce que « base utile » exclut, lot par lot

Écrit ici pour qu'aucune revue ne le signale comme un manque :

- **Lot 3** : un seul clip actif à la fois par modèle. **Pas de mélange de clips** — le fondu entre
  walk et run est un chantier à lui seul.
- **Lot 4** : on montre et on tourne un os. **Pas de retargeting**, pas de cinématique inverse,
  pas de contraintes.
- **Lot 5** : **interpolation linéaire seulement**. Des clés, pas de courbes de Bézier, pas
  d'éditeur de courbes.
- **Lot 6** : une caméra rend, une seule à la fois. Pas de montage multi-caméra, pas de profondeur
  de champ.

Aucun de ces quatre n'est nécessaire pour que l'ensemble serve, et chacun est un lot ultérieur
identifiable.

---

## Les pièges, connus d'avance

- **`.glb` uniquement.** Un `fbx-maya` généré est un asset payé et inaffichable — voir plus haut.
- **Une animation est un chemin par image.** Le § 10.4 est catégorique : 8,33 ms de budget par
  frame, et « une garde posée sur un chemin par image ne prend son argument que si elle en a
  besoin ». Un évaluateur de pistes qui balaie `state.nodes` à chaque frame se paiera, et la mesure
  du 10 août sur `rotationShows` dit exactement combien.
- **`resetClock` avant toute lecture**, sinon le premier delta vaut l'âge de la fenêtre. Le
  commentaire de `ViewportEngine.ts:355` le dit déjà, et prévient que « celle qui l'oublie ouvre
  son propre trou ».
- **Tout nouveau type de nœud se teste par un aller-retour disque** (§ 10.3) : un type que le
  chargeur ignore disparaît en silence. Ça vaut pour le nœud caméra du lot 6.
- **Un champ ajouté à une table de specs arrive avec son défaut** dans la constante correspondante,
  faute de quoi il revit en `undefined` (`feat/spec-defaults`, § 10.3).
- **Supprimer une piste qui porte du travail doit être annulable.** `Command<S>` le donne
  gratuitement — encore faut-il que `removeTrack` soit une commande et non une mutation.
- **Le décodage du clone IPC** (§ 6) : `⌘S` gèle toutes les fenêtres au-delà d'environ 5 500 nœuds.
  Des pistes de clés font grossir le document **sans ajouter de nœuds**, donc le plafond ne se
  déplace pas de la même façon — mais il n'a jamais été mesuré sur un document lourd en clés.
- **Un helper porte l'identifiant de ce qu'il aide** et se pose dans le viewport **à côté** des
  nœuds, comme la grille, le trièdre et le gizmo (§ 10.3). Ça vaut pour `SkeletonHelper`.

---

## Ce qui n'est pas mesuré, et qu'il ne faut pas présenter comme acquis

- **Aucun modèle de motion n'a été lancé.** Les schémas sont lus, les valeurs sont réelles, mais
  **aucun GLB animé n'est passé par le studio**. La forme exacte des clips que ces modèles
  produisent — leur nombre, leur nommage, leur durée réelle — reste à constater sur un fichier.
- **L'encodage vidéo n'existe pas.** ffmpeg est bien présent (`main/resources.ts`,
  `main/services.ts`) mais il sert la lecture des médias. Rien n'encode aujourd'hui une suite
  d'images en vidéo. `main/export/folder.ts` sait écrire un dossier, ce qui est la moitié du
  chemin ; l'autre moitié est à écrire au lot 6.
- **Le coût d'un mixer par frame n'est pas mesuré**, sur aucune taille de scène.
- **Le plafond de nœuds avec des pistes de clés** n'est pas mesuré non plus (voir les pièges).

---

## Hors périmètre

- **Les splats gaussiens.** Six modèles du catalogue en produisent (`.spz`, `.ply` — Marble,
  TripoSplat, Hunyuan World). Le studio ne les lit pas, et ce n'est pas un manque de ce chantier.
- **Le mélange de clips, les courbes, la cinématique inverse, le multi-caméra** — voir « ce que
  base utile exclut ».
- **Le retargeting local.** Scenario le fait côté serveur (`tripo-rigging-v2-5` et les modèles de
  motion) ; le refaire dans le studio serait réécrire ce qu'on appelle déjà.
