# 7. Les assets

[← Générer](06-generer.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Image →](08-espace-image.md)

---

## L'étagère du projet

Le panneau **Assets** montre tout ce que votre projet contient : ce que vous avez généré, et ce
que vous avez importé.

C'est l'équivalent d'un navigateur de contenu — la bibliothèque de matière première dans
laquelle vous piochez.

**Où il se trouve** dépend de l'espace où vous êtes :

| Espace | Où se trouve l'étagère |
|---|---|
| Image, 3D, Textures, Skyboxes | dans la **bande basse** |
| Vidéo, Audio | dans la **colonne de droite**, moitié haute |

Ce n'est pas un caprice : dans les espaces Vidéo et Audio, la bande basse appartient au montage,
qui a besoin de toute la largeur. Il faut pourtant que l'étagère et le montage tiennent l'écran
**ensemble** pour qu'on puisse glisser une prise de l'une vers l'autre — l'étagère prend donc la
moitié haute de la colonne de droite, celle des panneaux qui servent le document ouvert.

---

## Ce qu'on y trouve

Six types d'assets :

| Type | Ce que c'est | Où il est rangé |
|---|---|---|
| **Image** | une image fixe | `assets/img/` |
| **Vidéo** | un plan animé | `assets/vid/` |
| **Audio** | un son, une musique | `assets/aud/` |
| **Maillage** | un objet en 3D | `assets/3d/` |
| **Texture** | une matière | `assets/tex/` |
| **Skybox** | un ciel à 360° | `assets/sky/` |

---

## Chercher et filtrer

**Où sont les contrôles dépend de la place.**

| Zone | Où ils sont |
|---|---|
| **Bande basse** | sur la **ligne de titre**, à côté du nom du panneau |
| **Colonne de droite** (espaces Vidéo et Audio) | sur leur **propre ligne**, sous le titre |

Dans une bande, la ligne est large et presque vide : y loger la barre épargne une rangée
entière, et l'étagère est là pour montrer des assets, pas des boutons. Dans une colonne étroite,
la même barre pousserait le bouton de fermeture hors du cadre — elle redescend donc sous le
titre.

| Contrôle | Ce qu'il fait |
|---|---|
| **Rechercher…** | filtre sur le **nom** de l'asset, à la frappe |
| **Type** | ne garde qu'une ou plusieurs sortes d'assets |
| **Emplacement** | ne garde que les assets dans un certain état vis-à-vis de la bibliothèque |
| **Icônes** / **Liste** | grille de vignettes, ou liste dense |
| **Réduire** / **Agrandir** | la taille des vignettes |

Le filtrage est **instantané**, même sur un gros projet : tout le catalogue est déjà chargé en
mémoire, contrairement au panneau Modèles qui interroge le catalogue Scenario à distance.

Les deux vues sont **virtualisées** : seul ce qui est réellement à l'écran est dessiné. Un
projet de plusieurs milliers d'assets défile donc sans à-coups.

### Quand l'étagère est vide

Le message dit lequel des trois cas vous êtes, parce qu'ils appellent des réponses différentes :

| Message | Situation |
|---|---|
| « Ouvrez un projet pour voir ses assets. » | aucun projet n'est ouvert |
| « Aucun asset. Générez quelque chose pour commencer. » | le projet est vide |
| « Aucun résultat pour ce filtre. » | vos filtres sont trop restrictifs |

---

## Se servir d'un asset

| Geste | Effet |
|---|---|
| **Clic** | sélectionne — l'Inspecteur, à droite, montre ses informations |
| **Double-clic** | envoie l'asset dans **l'onglet ouvert devant vous** |
| **Clic droit** | ouvre la liste de **toutes** ses destinations |
| **Glisser-déposer** | dépose l'asset là où vous le lâchez |

### Le clic droit dit ce que le double-clic ne montre pas

Le double-clic prend **la première destination applicable**, et se tait sur les autres. Le clic
droit les liste toutes :

Les lignes apparaissent toujours dans le même ordre, celui que suit le double-clic :

| Ligne | Où elle envoie l'asset | Pour quels types |
|---|---|---|
| **Utiliser comme ciel** | le ciel ouvert, espace Skyboxes | images |
| **Ajouter à la scène** | la scène 3D ouverte | maillages |
| **Ouvrir dans l'éditeur audio** | la prise ouverte, espace Audio | sons |
| **Placer comme calque** | l'image ouverte, espace Image | images |
| **Ajouter au montage** | la séquence ouverte, espace Vidéo | tous |
| **Utiliser comme couleur de base** | la matière ouverte, espace Textures | images |
| **Montrer dans le Finder** | ouvre le dossier qui contient le fichier | tous |

Chaque ligne porte l'icône de son espace, la même que dans la barre de titre. Le menu ne montre
que les destinations capables de recevoir **ce type-là** : le clic droit sur un son n'offre pas
de le poser comme ciel.

**En revanche, une destination dont l'espace n'a pas de document ouvert reste affichée, mais
grisée.** C'est délibéré : un menu qui change de longueur selon ce qui est ouvert est un menu
qu'on ne peut pas apprendre. Une ligne grisée vous dit quoi faire — ouvrir un document dans cet
espace — là où une ligne absente ne dit rien du tout.

C'est aussi la réponse au piège du double-clic : quand rien ne bouge, le clic droit montre en une
fois ce que cet asset peut faire, et ce qui manque pour qu'il le fasse.

### Le double-clic ne fait pas ce qu'on croit

**Il n'ouvre jamais de nouvel onglet.** C'est le point qui surprend tout le monde une fois, et une
seule : le double-clic **envoie** l'asset dans le document déjà en avant.

Ce que ça donne, selon l'onglet qui est devant :

| L'onglet en avant est… | Un double-clic sur un asset… |
|---|---|
| un **ciel** (espace Skyboxes) | pose l'image comme ciel — seules les images du projet sont acceptées |
| un **son** (espace Audio) | charge cette prise dans l'éditeur, si c'est bien un son |
| une **séquence** (espace Vidéo) | pose un clip sur une piste, à la tête de lecture |
| une **image** (espace Image) | pose l'image comme un calque de plus, déjà armé |
| une **scène 3D** | fait entrer le maillage dans la scène, s'il s'agit bien d'un maillage |
| une **texture** | **rien du tout** — une matière se remplit au glisser-déposer |
| aucun onglet ouvert | **rien du tout** |

**Rien ne prévient quand il ne se passe rien.** Pas de message, pas de refus visible : le
double-clic est simplement sans effet. Si vous double-cliquez et que rien ne bouge, la question à
se poser est **« quel onglet est devant ? »**, jamais « l'asset est-il abîmé ? ».

> **Pour ouvrir un document, c'est le bouton `+` du rail gauche**, dans l'espace voulu. Il crée un
> document neuf. Le double-clic sert ensuite à y faire entrer de la matière — quand l'espace sait
> en recevoir.

### Ce que le glisser-déposer sait faire aujourd'hui

| Vous glissez… | Vers… | Résultat |
|---|---|---|
| une vidéo ou un son | la **timeline** | un clip sur une piste |
| une image | la **toile** de l'espace Image | elle devient un calque de plus, armé |
| une image | l'aperçu d'une **texture** | elle devient la couleur de base |
| une image panoramique | l'aperçu d'un **ciel** | elle devient le ciel |
| un maillage | la **vue 3D** | il entre dans la scène, à l'origine |

**Ces cinq-là, et rien d'autre.** Dans la vue 3D, le dépôt est accepté **partout sur la vue**, la
barre d'outils comprise : un lâcher qui tombe à côté serait un raté qu'on ne voit pas venir.

---

## L'inspecteur d'un asset

Sélectionnez un asset et regardez l'**Inspecteur**, dans la colonne de droite. Il montre, selon
ce qu'il sait :

| Section | Ce qu'elle contient |
|---|---|
| **Identité** | le nom, le type |
| **Fichier** | la durée, les dimensions, la taille, la date de création, l'emplacement sur le disque |
| **Génération** | le modèle, le prompt, la graine — et le bouton **Régénérer** |

Le bouton **Révéler dans le gestionnaire de fichiers** ouvre le dossier contenant le fichier,
dans le Finder, l'Explorateur ou votre gestionnaire de fichiers.

> « **Fichier introuvable** » signifie qu'un média lié a été déplacé ou supprimé de son
> emplacement d'origine. Voir la section suivante.

---

## La bibliothèque de votre compte

Votre projet est un dossier sur votre disque. Votre compte Scenario, lui, a sa propre
bibliothèque, en ligne. Les deux existent séparément, et **rien ne circule entre eux sans que
vous le demandiez**.

### Ce que le badge d'une vignette raconte

Chaque vignette porte une petite marque qui dit où en est cet asset vis-à-vis de la
bibliothèque :

| Badge | Ce qu'il veut dire |
|---|---|
| **Local seulement** | le fichier est chez vous, la bibliothèque ne le connaît pas |
| **Synchronisé** | les deux côtés ont la même version |
| **Modifié ici — à envoyer** | votre copie a bougé depuis le dernier envoi |
| **Modifié dans la bibliothèque — à rapatrier** | c'est l'autre côté qui a bougé |
| **Modifié des deux côtés** | les deux versions ont divergé |
| **Le dernier envoi a échoué** | la tentative précédente n'est pas passée |
| **Appartient à un autre projet** | le jumeau en ligne relève d'une autre clé API que celle qui est active |

Ce badge n'est pas stocké, il est **recalculé** : il dépend du compte actif, et une clé API
ouvre sur un projet et un seul. Changez de compte dans la barre de titre, et les badges se
relisent — c'est le même fichier, c'est la bibliothèque d'en face qui a changé.

> **Quatre de ces sept badges sont hors d'atteinte aujourd'hui**, et c'est cohérent : tant que
> les transferts se déclenchent à la main, rien ne peut modifier la version en ligne dans votre
> dos. « À rapatrier », « modifié des deux côtés » et « autre projet » n'apparaîtront qu'avec la
> synchronisation automatique, quand elle existera. Le filtre **Emplacement** ne propose donc que
> les quatre états réellement atteignables : *local seulement*, *synchronisé*, *à envoyer* et
> *échec*.

### Envoyer une sélection

Le bouton **Envoyer**, sur la ligne de titre de l'étagère, téléverse les assets **sélectionnés**
dans la bibliothèque de votre compte.

Trois choses le décrivent mieux qu'une phrase de présentation :

- **il ne part jamais tout seul** — il faut une sélection, et un clic ;
- **il refuse de se lancer deux fois** : pendant un transfert, le bouton est inactif, pour
  qu'un second clic ne pousse pas par-dessus le premier ;
- **il rend compte asset par asset.** Ce qui est passé passe, ce qui a échoué prend le badge
  *échec* et une ligne dans le journal — un envoi n'est pas un tout ou rien.

Un asset non sélectionné, ou un projet fermé, laisse le bouton grisé.

> **Il n'y a pas encore de bouton pour rapatrier**, ni d'écran pour parcourir la bibliothèque
> depuis le studio. Le studio sait le faire — le mécanisme est écrit et testé — mais aucune porte
> ne le déclenche pour l'instant. Le sens du transfert est donc unique : de chez vous vers la
> bibliothèque.

### Nommer par ce que l'API voit

Le bouton **Décrire**, à côté, demande à l'API de regarder les images sélectionnées et de leur
donner un nom tiré de leur contenu. Rien ne part sans le clic, et les noms obtenus atterrissent
dans le catalogue du projet.

---

## Importer vos propres médias

Le bouton **Importer un média**, sur la ligne de titre de l'étagère.

### Ce qui s'importe

| Type | Extensions acceptées |
|---|---|
| **Vidéo** | `mp4` `mov` `mkv` `webm` `avi` `mxf` `m4v` |
| **Audio** | `wav` `mp3` `aac` `flac` `m4a` `ogg` |
| **Image** | `png` `jpg` `jpeg` `webp` `tif` `tiff` `exr` |
| **3D** | `glb` |

> **Les modèles 3D s'importent au format `.glb`.** Le `.gltf` séparé (avec ses fichiers `.bin`
> et ses textures à côté) ne s'importe pas : le studio sert chaque asset seul, sans son
> voisinage, et les fichiers liés resteraient introuvables. `.obj`, `.fbx` et les HDRI (`.hdr`)
> ne s'importent pas encore.
> Un `.exr` importé est catalogué comme une image, pas comme un ciel. Voir
> [Ce qui n'existe pas encore](18-limites.md).

### Le fichier n'est pas copié

**Important.** Le studio ne copie pas votre fichier dans le projet : il crée un **lien** vers
l'endroit où il se trouve.

Deux conséquences :

- **Avantage** — un rush vidéo de 12 Go n'est pas dupliqué. Votre projet reste léger.
- **Inconvénient** — si vous déplacez, renommez ou supprimez le fichier d'origine, le lien se
  casse, et l'inspecteur affiche « Fichier introuvable ».

Si vous devez emporter un projet ailleurs, emportez aussi les médias qu'il pointe — ou copiez-les
vous-même dans le dossier du projet avant de les importer.

### Ce qui se passe pendant l'import

Un bandeau apparaît au-dessus de l'étagère et suit chaque fichier, étape par étape :

| Étape | Ce qui se passe | Pourquoi |
|---|---|---|
| **En attente…** | le fichier fait la queue | |
| **Analyse…** | le studio lit ce que le fichier est réellement | durée, codec, dimensions, images par seconde |
| **Empreinte…** | il calcule une signature du contenu | pour repérer les doublons |
| **Proxy…** | il fabrique une copie allégée de la vidéo | pour naviguer dedans sans à-coups |
| **Waveform…** | il dessine la forme d'onde du son | pour la voir sur la piste audio |
| **Prêt** | terminé | |

**Chaque étape est interruptible.** Le bouton **Interrompre la préparation** l'arrête : vous
n'avez pas à attendre le proxy d'un rush de vingt minutes pour commencer à travailler. Le
fichier reste importé, simplement sans son proxy.

Deux messages particuliers :

| Message | Ce que ça veut dire |
|---|---|
| **Déjà dans le projet** | ce fichier exact y est déjà — c'est l'empreinte qui l'a vu |
| **Fichier illisible** | le fichier est corrompu, ou dans un format que le studio ne décode pas |

### Si la préparation vidéo est indisponible

Le proxy et la forme d'onde sont fabriqués par **ffmpeg**, un utilitaire de traitement vidéo.

**Le studio porte le sien**, sur macOS, Windows et Linux. Vous n'avez rien à installer : c'est
une décision assumée, parce qu'un import qui a besoin d'un proxy n'est pas le moment d'apprendre
à quelqu'un ce qu'est un codec.

Le studio essaie trois candidats, dans cet ordre :

1. le binaire **livré avec l'application** ;
2. le chemin que vous avez indiqué dans **Réglages ▸ Médias ▸ Chemin de ffmpeg** ;
3. ce qui se trouve sur le `PATH` de votre système.

Et il retient le premier qui **démarre**, pas le premier qui existe : il le lance pour vérifier.
Un binaire présent mais cassé est traité comme absent — voir
[Quand ça coince](16-depannage.md#le-cas-déroutant--ffmpeg-est-là-et-le-studio-dit-quil-ny-est-pas).

Si aucun des trois ne répond, le bandeau le dit : « Préparation vidéo indisponible : ni copie
allégée ni forme d'onde. »

**L'import fonctionne quand même.** Vous perdez seulement le confort : la navigation dans les
vidéos sera moins fluide, et les pistes audio n'afficheront pas leur dessin.

**Ce cas est devenu rare.** Il ne concerne guère que qui a lancé le studio depuis son code source
sans avoir exécuté `pnpm ffmpeg:fetch`.

---

## Où sont vraiment vos fichiers

Tout est dans le dossier du projet, à un endroit précis et lisible :

```
mon-projet.scenario/
└── assets/
    ├── img/     les images
    ├── vid/     les vidéos
    ├── aud/     les sons
    ├── 3d/      les objets 3D
    ├── tex/     les textures
    └── sky/     les ciels
```

Ce sont de vrais fichiers, dans de vrais formats. Vous pouvez les ouvrir avec n'importe quel
autre logiciel, les copier, les envoyer.

**Sauf les médias importés**, qui restent là où ils étaient — c'est tout l'intérêt du lien.

---

[← Générer](06-generer.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Image →](08-espace-image.md)
