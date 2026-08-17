# 7. Les assets

[← Générer](06-generer.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Image →](08-espace-image.md)

---

## L’étagère du projet

Le panneau **Assets** montre tout ce que votre projet contient : ce que vous avez généré, et ce
que vous avez importé.

C’est l’équivalent d’un navigateur de contenu — la bibliothèque de matière première dans
laquelle vous piochez.

**Où il se trouve** dépend de l’espace où vous êtes :

| Espace | Où se trouve l’étagère |
|---|---|
| Image, Textures, Skyboxes | dans la **bande basse** |
| Vidéo, Audio, 3D | dans la **colonne de droite**, moitié haute |

Ce n’est pas un caprice : dans les espaces Vidéo, Audio et 3D, la bande basse appartient à la
timeline, qui a besoin de toute la largeur. Il faut pourtant que l’étagère et la timeline tiennent
l’écran **ensemble** pour qu’on puisse glisser une prise ou un modèle de l’une vers l’autre —
l’étagère prend donc la moitié haute de la colonne de droite, celle des panneaux qui servent le
document ouvert.

---

## Ce qu’on y trouve

Six types d’assets :

| Type | Ce que c’est | Où il atterrit |
|---|---|---|
| **Image** | une image fixe | `Images/` |
| **Vidéo** | un plan animé | `Video/` |
| **Audio** | un son, une musique | `Audio/` |
| **Maille** | un objet en 3D | `3D/` |
| **Texture** | une matière | `Textures/` |
| **Skybox** | un ciel à 360° | `Sky/` |

**Où il atterrit, pas où il vit.** Ces six dossiers sont posés à la création du projet et ne sont
qu’un point de départ : déplacez un asset où vous voulez, renommez le dossier, videz-le. Ce qu’un
fichier EST ne dépend pas de l’endroit où il est — le studio le retrouve, et sa fiche le suit.

---

## Chercher et filtrer

**Où sont les contrôles dépend de la place.**

| Zone | Où ils sont |
|---|---|
| **Bande basse** | sur la **ligne de titre**, à côté du nom du panneau |
| **Colonne de droite** (espaces Vidéo, Audio et 3D) | sur leur **propre ligne**, sous le titre |

Dans une bande, la ligne est large et presque vide : y loger la barre épargne une rangée
entière, et l’étagère est là pour montrer des assets, pas des boutons. Dans une colonne étroite,
la même barre pousserait le bouton de fermeture hors du cadre — elle redescend donc sous le
titre.

| Contrôle | Ce qu’il fait |
|---|---|
| **Rechercher…** | filtre sur le **nom** de l’asset, à la frappe |
| **Type** | ne garde qu’**une seule** sorte d’assets — en choisir une remplace la précédente |
| **Emplacement** | ne garde que les assets dans un certain état vis-à-vis de la bibliothèque |
| **Icônes** / **Liste** | grille de vignettes, ou liste dense |
| **Réduire les vignettes** / **Agrandir les vignettes** | leur taille |

Le filtrage est **instantané**, même sur un gros projet : tout le catalogue est déjà chargé en
mémoire, contrairement au panneau Modèles qui interroge le catalogue Scenario à distance.

> **La recherche ne réclame pas vos accents.** Taper `foret` trouve « Forêt d’hiver », et `ete`
> trouve « Été ». C’est vrai ici et dans la recherche des préférences : on cherche en tapant, pas
> en épelant. Le panneau **Modèles** n’en dit rien, parce qu’il ne cherche pas lui-même — il passe
> le mot à l’API et affiche ce qu’elle rend.
>
> Cela vaut aussi pour les fichiers venus du Finder. macOS écrit les noms sous une forme où
> l’accent est un caractère à part, invisible à l’œil mais différent pour la machine — un asset
> importé ne répondait donc pas toujours à son propre nom retapé ici. Les deux formes sont
> désormais traitées comme une seule.

Les deux vues sont **virtualisées** : seul ce qui est réellement à l’écran est dessiné. Un
projet de plusieurs milliers d’assets défile donc sans à-coups.

**Un son se montre par son onde**, en vignette, et non par un pictogramme de haut-parleur : deux
prises de même durée se ressemblaient trait pour trait tant qu’on ne les avait pas écoutées.
L’onde est celle que le montage dessine, calculée à l’import — elle apparaît donc une fraction de
seconde après la vignette, le temps qu’elle arrive.

### Quand l’étagère est vide

Le message dit lequel des trois cas vous êtes, parce qu’ils appellent des réponses différentes :

| Message | Situation |
|---|---|
| « Ouvrez un projet pour voir ses assets. » | aucun projet n’est ouvert |
| « Aucun asset. Générez quelque chose pour commencer. » | le projet est vide |
| « Aucun résultat pour ce filtre. » | vos filtres sont trop restrictifs |

---

## Se servir d’un asset

| Geste | Effet |
|---|---|
| **Clic** | sélectionne — l’Inspecteur, à droite, montre ses informations |
| **⌘-clic** *(Ctrl ailleurs)* | ajoute cet asset à la sélection, ou l’en retire |
| **Maj-clic** | sélectionne toute la plage entre le dernier choisi et celui-ci |
| **Double-clic** | **ouvre l’asset dans son propre onglet**, dans l’espace qui édite son type |
| **Clic droit** | ouvre la liste de **toutes** ses destinations |
| **Glisser-déposer** | dépose l’asset là où vous le lâchez |

### Choisir plusieurs assets

Deux actions de l’étagère travaillent sur **plusieurs** assets à la fois : **Envoyer** et
**Nommer**. C’est pour elles que la sélection multiple existe.

**Maj-clic étend, ⌘-clic pioche.** Le premier prend tout ce qui se trouve entre le dernier asset
choisi et celui que vous cliquez ; le second n’ajoute — ou ne retire — que celui-là. Un clic nu
recommence à zéro.

**Le point de départ suit vos choix.** Après un ⌘-clic, c’est ce dernier asset qui sert d’ancre au
Maj-clic suivant : vous piochez trois vignettes ici, puis vous étendez à partir de la troisième,
pas de la première.

**L’étagère s’atteint aussi au clavier**, comme les autres listes du studio — voir
[Parcourir une liste au clavier](15-raccourcis.md#parcourir-une-liste-au-clavier).

### Le clic droit envoie l’asset ailleurs que le double-clic

**Les deux gestes ne servent pas le même besoin, et c’est le partage à retenir** : le double-clic
sert **l’asset** — il l’ouvre chez lui ; le clic droit sert **le document déjà ouvert** — il y
envoie l’asset. Le premier crée un onglet, le second n’en crée aucun.

Le clic droit liste toutes les destinations, toujours dans le même ordre :

| Ligne | Où elle envoie l’asset | Pour quels types |
|---|---|---|
| **Utiliser comme ciel** | le ciel ouvert, espace Skyboxes | images |
| **Ajouter à la scène** | la scène 3D ouverte | mailles |
| **Ouvrir dans l’éditeur audio** | le montage ouvert, espace Audio | sons |
| **Placer comme calque** | l’image ouverte, espace Image | images |
| **Ajouter au montage** | la séquence ouverte, espace Vidéo | tous |
| **Utiliser comme couleur de base** | la matière ouverte, espace Textures | images |
| **Renommer** | ouvre le nom sur la vignette elle-même | tous |
| **Afficher dans le dossier** | ouvre le gestionnaire de fichiers sur le fichier | tous |

**Renommer ne change le nom que dans ce projet** — celui du compte Scenario ne bouge pas. Un même
asset est tiré dans plusieurs projets et nommé pour ce que chacun en fait. Le nom est aussi
modifiable dans l’Inspecteur, d’un double-clic sur la ligne **Nom**, et dans l’Explorateur.

**Le fichier suit, et c’est le même nom partout.** Un asset généré se pose sur le disque sous son
prompt — `Ruelle bleue au crépuscule.png` — et le renommer déplace vraiment le fichier. Ce que
lisent l’étagère, l’Inspecteur, l’onglet qui l’édite et votre Finder est donc une seule et même
chose. Un nom que le système de fichiers refuserait est refusé ici aussi, plutôt que corrigé en
silence ; un nom que le dossier tient déjà l’est également, plutôt que d’écraser une autre image.

> Les fichiers arrivés **avant** cette règle gardent le nom technique qu’ils portaient
> — `asset_40f76c36-8ad4-4def-a1b3-9125cba4da98.png`. Ils prennent leur vrai nom le jour où vous
> les renommez, et pas avant : le studio ne remue pas votre dossier tout seul.

Chaque ligne porte l’icône de son espace, la même que dans la barre de titre. Le menu ne montre
que les destinations capables de recevoir **ce type-là** : le clic droit sur un son n’offre pas
de le poser comme ciel.

**En revanche, une destination dont l’espace n’a pas de document ouvert reste affichée, mais
grisée.** C’est délibéré : un menu qui change de longueur selon ce qui est ouvert est un menu
qu’on ne peut pas apprendre. Une ligne grisée vous dit quoi faire — ouvrir un document dans cet
espace — là où une ligne absente ne dit rien du tout.

C’est aussi ce qu’il faut regarder quand un envoi ne mène nulle part : le clic droit montre en une
fois ce que cet asset peut faire, et ce qui manque pour qu’il le fasse.

### Le double-clic ouvre l’asset, il ne l’envoie nulle part

**Un asset ouvert par double-clic a son onglet à lui**, dans l’espace qui édite son type : une
image dans Image, une maille dans 3D, un son dans Audio. Vous n’avez rien à ouvrir avant.

**Il ne regarde jamais l’onglet que vous avez devant vous** : le double-clic ouvre l’asset dans
l’espace de son type, quoi qu’il y ait à l’écran.

**Rouvrir le même asset revient à son onglet**, il n’en naît pas un second : deux onglets sur un
même document sont deux historiques, et la seconde sauvegarde écraserait la première.

**Un refus se dit**, plutôt que de laisser un onglet vide à la place : un asset qu’aucun éditeur
ne prend, ou qui n’est pas encore descendu sur votre disque, vous le fait savoir.

Le type de l’asset désigne son éditeur, et rien d’autre n’entre en compte :

| Ce que vous double-cliquez | Où il s’ouvre |
|---|---|
| une **image** | l’espace Image |
| une **texture** | l’espace Textures |
| un **ciel** | l’espace Skyboxes |
| une **maille** | l’espace 3D |
| un **son** | l’espace Audio |
| une **vidéo** | l’espace Vidéo |

**Un double-clic qui ne mène nulle part le dit** : « Cet asset n’a pas pu être ouvert ». C’est le
cas d’un type qu’aucun éditeur ne prend, ou d’un asset qui n’est pas encore descendu sur votre
disque — pas d’un asset abîmé.

> **Le bouton `+` du rail gauche crée un document VIDE**, dans l’espace voulu. Le double-clic, lui,
> ouvre un document **sur un asset**. Ce sont les deux façons de commencer, et le clic droit sert
> ensuite à faire entrer de la matière dans ce qui est ouvert.

### Ce que le glisser-déposer sait faire aujourd’hui

| Vous glissez… | Vers… | Résultat |
|---|---|---|
| n’importe quel asset | la **timeline** | un clip sur la piste visée |
| une image | la **toile** de l’espace Image | elle devient un calque de plus, armé |
| une image | l’aperçu d’une **matière** | elle devient la couleur de base |
| une image | la vignette d’un **canal** précis | elle devient ce canal-là |
| une image panoramique | l’aperçu d’un **ciel** | elle devient le ciel |
| une maille | la **vue 3D** | elle entre dans la scène, à l’origine |
| un son | l’**éditeur audio** | il s’ajoute au montage comme un clip, et c’est lui qu’on édite |
| un asset | un **champ d’asset** d’un formulaire de génération | il devient l’entrée du champ |

**La timeline ne trie pas.** Elle prend ce qu’on lui donne : un asset sans durée propre reçoit une
durée par défaut plutôt qu’un refus. Dans la vue 3D, le dépôt est accepté **partout sur la vue**,
la barre d’outils comprise : un lâcher qui tombe à côté serait un raté qu’on ne voit pas venir.

---

## L’inspecteur d’un asset

Sélectionnez un asset et regardez l’**Inspecteur**, dans la colonne de droite. Il montre, selon
ce qu’il sait :

| Section | Ce qu’elle contient |
|---|---|
| **Identité** | le nom, le type, la durée, les dimensions, la taille, la date de création |
| **Génération** | le modèle, la graine, le prompt — et deux boutons, **Épingler la recette** et **Régénérer** |
| **Fichier** | l’**Emplacement** sur le disque, et rien d’autre — le groupe n’apparaît que pour un asset présent localement |

Le bouton **Afficher dans le dossier** sort du studio : il ouvre le Finder, l’Explorateur ou
votre gestionnaire de fichiers, le fichier déjà sélectionné.

> « **Fichier introuvable** » signifie qu’un média lié a été déplacé ou supprimé de son
> emplacement d’origine. Voir la section suivante.

---

## La bibliothèque de votre compte

Votre projet est un dossier sur votre disque. Votre compte Scenario, lui, a sa propre
bibliothèque, en ligne. Les deux existent séparément, et **rien ne circule entre eux sans que
vous le demandiez**.

> **« Demander » ne veut pas dire « demander depuis cette étagère ».** Deux gestes faits
> ailleurs envoient une image sans passer par les boutons ci-dessous : **lancer une génération**
> qui porte une image de référence, et cliquer sur **Décrire le style des références** dans le
> générateur (chapitre 6). Dans les deux cas l’API doit voir l’image pour répondre, donc le
> studio l’envoie une fois, et son badge passe à **Synchronisé**. Rien n’est envoyé pendant que
> vous tapez.

### Ce que le badge d’une vignette raconte

Une petite marque dit où en est un asset vis-à-vis de la bibliothèque :

| Badge | Ce qu’il veut dire |
|---|---|
| **Local seulement** | le fichier est chez vous, la bibliothèque ne le connaît pas |
| **Synchronisé avec la bibliothèque** | les deux côtés ont la même version |
| **Modifié ici — à envoyer** | votre copie a bougé depuis le dernier envoi |
| **Modifié dans la bibliothèque — à rapatrier** | c’est l’autre côté qui a bougé |
| **Modifié des deux côtés** | les deux versions ont divergé |
| **Le dernier envoi a échoué** | la tentative précédente n’est pas passée |
| **Appartient à un autre projet** | le jumeau en ligne relève d’une autre clé API que celle qui est active |

**Les deux premiers ne se dessinent qu’en vue liste.** Sur une vignette, « local seulement » et
« synchronisé » restent muets : ce sont les deux états ordinaires, et les marquer couvrirait la
grille de pastilles qui ne disent rien. Une vignette sans badge est donc une vignette qui va
bien : ce qu’on cherche du regard, c’est ce qui s’affiche.

Ce badge n’est pas stocké, il est **recalculé** : il dépend du compte actif, et une clé API
ouvre sur un projet et un seul. Changez de compte dans la barre de titre, et les badges se
relisent — c’est le même fichier, c’est la bibliothèque d’en face qui a changé.

> **Deux de ces sept badges sont hors d’atteinte aujourd’hui**, et c’est cohérent : tant que les
> transferts se déclenchent à la main, rien ne peut modifier la version en ligne dans votre dos.
> « À rapatrier » et « modifié des deux côtés » n’apparaîtront qu’avec la synchronisation
> automatique, quand elle existera.
>
> **« Appartient à un autre projet », lui, s’obtient sans rien attendre** : rapatriez un asset
> avec une clé, basculez sur une autre dans la barre de titre, et il porte le badge. C’est le
> paragraphe ci-dessus à l’œuvre, pas un cas de synchronisation.
>
> Le filtre **Emplacement** ne propose pourtant que quatre états — *local seulement*,
> *synchronisé*, *à envoyer* et *échec*. « Autre projet » peut donc s’afficher sur une vignette
> sans qu’on puisse s’en servir pour filtrer.

### Envoyer une sélection

Le bouton **Envoyer**, sur la ligne de titre de l’étagère, téléverse les assets **sélectionnés**
dans la bibliothèque de votre compte — voir [Choisir plusieurs assets](#choisir-plusieurs-assets)
pour en désigner plus d’un.

Trois choses le décrivent mieux qu’une phrase de présentation :

- **il ne part jamais tout seul** — il faut une sélection, et un clic ;
- **il refuse de se lancer deux fois** : pendant un transfert, le bouton est inactif, pour
  qu’un second clic ne pousse pas par-dessus le premier ;
- **il rend compte asset par asset.** Ce qui est passé passe, ce qui a échoué prend le badge
  *échec* et une ligne dans le journal — un envoi n’est pas un tout ou rien.

Un asset non sélectionné, ou un projet fermé, laisse le bouton grisé.

> **L’étagère n’a pas de bouton pour rapatrier ; l’accueil en a un.** La bande **Votre
> bibliothèque**, sur la page d’accueil, liste ce que votre compte détient, et cliquer une
> vignette la fait descendre dans le projet ouvert. Le transfert va donc dans les deux sens —
> mais chaque sens a sa porte, et ce n’est pas la même : l’envoi part de l’étagère, le
> rapatriement de l’accueil.
>
> **Le clic ne rapatrie qu’une fois.** Si l’asset est déjà sur votre disque, la même vignette
> l’**ouvre** au lieu de le retélécharger. Et sans projet ouvert, ou pendant un transfert en
> cours, elle ne réagit pas du tout.

### Nommer par ce que l’API voit

Le bouton **Nommer**, à côté, demande à l’API de regarder les images sélectionnées et de leur
donner un nom tiré de leur contenu. Les noms obtenus atterrissent dans le catalogue du projet.

**Il ne voit que les images que la bibliothèque connaît déjà.** L’API décrit ce qu’elle héberge :
une image qui n’a jamais été envoyée est écartée de la demande, sans le dire. Envoyez-la d’abord,
nommez ensuite.

> **Ce bouton n’est pas la seule porte, et c’est la seule chose à retenir ici.** Le réglage
> **Nommer les assets rapatriés**, dans **Génération**, est **coché par défaut** : une image qui
> arrive sans nom utile est envoyée à l’API sans qu’on ait cliqué, et cela **consomme des unités
> créatives**. Le chapitre [Tous les réglages](14-reglages.md) le détaille — c’est le seul endroit
> où le studio dépense de lui-même, et le décocher suffit à l’arrêter.

---

## Importer vos propres médias

Le bouton **Importer un média**, sur la ligne de titre de l’étagère.

### Ce qui s’importe

| Type | Extensions acceptées |
|---|---|
| **Vidéo** | `mp4` `mov` `mkv` `webm` `avi` `mxf` `m4v` |
| **Audio** | `wav` `mp3` `aac` `flac` `m4a` `ogg` |
| **Image** | `png` `jpg` `jpeg` `webp` `tif` `tiff` `exr` |
| **3D** | `glb` |

> **Les modèles 3D s’importent au format `.glb`.** Le `.gltf` séparé (avec ses fichiers `.bin`
> et ses textures à côté) ne s’importe pas : le studio sert chaque asset seul, sans son
> voisinage, et les fichiers liés resteraient introuvables. `.obj`, `.fbx` et les HDRI (`.hdr`)
> ne s’importent pas encore.
> Un `.exr` importé est catalogué comme une image, pas comme un ciel. Voir
> [Ce qui n’existe pas encore](18-limites.md).

### Le fichier n’est pas copié — à l’import

**Important.** À l’import, le studio ne copie pas votre fichier dans le projet : il crée un
**lien** vers l’endroit où il se trouve.

Deux conséquences :

- **Avantage** — un rush vidéo de 12 Go n’est pas dupliqué. Votre projet reste léger.
- **Inconvénient** — si vous déplacez, renommez ou supprimez le fichier d’origine, le lien se
  casse **en silence** : rien ne le signale tant que vous n’avez pas cliqué sur **Afficher dans le
  dossier**, et c’est ce clic, ne trouvant rien, qui fait apparaître
  « Fichier introuvable » dans l’inspecteur.

Si vous devez emporter un projet ailleurs, emportez aussi les médias qu’il pointe — ou copiez-les
vous-même dans le dossier du projet avant de les importer.

**Mais l’ÉDITER le fait entrer dans le projet.** Un média lié que vous retouchez puis enregistrez —
`⌘S` sur une image, **Appliquer** sur une prise sonore — est écrit dans le dossier du projet, et
c’est cette copie que le studio montre ensuite partout : l’étagère, la scène, l’inspecteur.
Le lien est remplacé par un vrai fichier, et **Afficher dans le dossier** mène
désormais là.

**Le fichier que vous aviez pointé n’est pas touché.** Il reste où il est, dans l’état où vous
l’avez laissé : écrire dans un dossier que vous avez seulement montré au studio serait un autre
geste que celui d’éditer un asset. Si vous vouliez modifier l’original, faites-le dans l’outil qui
l’a produit.

### Ce qui se passe pendant l’import

Un bandeau apparaît au-dessus de l’étagère et suit chaque fichier, étape par étape :

| Étape | Ce qui se passe | Pourquoi |
|---|---|---|
| **En attente…** | le fichier fait la queue | |
| **Analyse…** | le studio lit ce que le fichier est réellement | durée, codec, dimensions, images par seconde |
| **Empreinte…** | il calcule une signature du contenu | pour repérer les doublons |
| **Proxy…** | il fabrique une copie allégée de la vidéo | pour naviguer dedans sans à-coups |
| **Forme d’onde…** | il dessine la forme d’onde du son | pour la voir sur la piste audio |
| **Prêt** | terminé | |

**Chaque étape est interruptible.** Le bouton **Interrompre la préparation** l’arrête : vous
n’avez pas à attendre le proxy d’un rush de vingt minutes pour commencer à travailler. Le
fichier reste importé, simplement sans son proxy.

Deux messages particuliers :

| Message | Ce que ça veut dire |
|---|---|
| **Déjà dans le projet** | ce fichier exact y est déjà — c’est l’empreinte qui l’a vu |
| **Fichier illisible** | le fichier est corrompu, ou dans un format que le studio ne décode pas |

### Si la préparation vidéo est indisponible

Le proxy et la forme d’onde sont fabriqués par **ffmpeg**, un utilitaire de traitement vidéo.

**Le studio porte le sien**, sur macOS, Windows et Linux. Vous n’avez rien à installer : c’est
une décision assumée, parce qu’un import qui a besoin d’un proxy n’est pas le moment d’apprendre
à quelqu’un ce qu’est un codec.

Le studio essaie trois candidats, dans cet ordre :

1. le binaire **livré avec l’application** ;
2. le chemin que vous avez indiqué dans **Réglages ▸ Médias ▸ Chemin de ffmpeg** ;
3. ce qui se trouve sur le `PATH` de votre système.

Il retient le **premier qui existe**, et s’arrête là : il ne redescend pas la liste. Le binaire
retenu est bien lancé ensuite, mais pour dire si la préparation vidéo est disponible — pas pour
choisir.

**Deux conséquences, et la seconde surprend.** Le chemin des réglages ne sert que si le binaire
livré est **absent** — c’est le cas quand on lance le studio depuis son code source sans avoir
exécuté `pnpm ffmpeg:fetch`. Et si le binaire retenu est présent mais ne démarre pas, indiquer un
autre chemin dans les réglages **ne le rattrape pas** : le studio annonce l’indisponibilité, il
faut réparer ou remplacer ce binaire-là. Voir
[Quand ça coince](16-depannage.md#le-cas-déroutant--ffmpeg-est-là-et-le-studio-dit-quil-ny-est-pas).

Quand le candidat retenu ne démarre pas — ou qu’il n’y en a aucun — un **triangle d’alerte ambre**
apparaît dans la barre de titre de
l’étagère à assets, à gauche du compteur. Survolez-le, ou atteignez-le au clavier, et il dit :
« Préparation vidéo indisponible : ni copie allégée ni forme d’onde. » `Échap` referme l’infobulle.

**L’import fonctionne quand même.** Vous perdez seulement le confort : la navigation dans les
vidéos sera moins fluide, et les pistes audio n’afficheront pas leur dessin.

**Ce cas est devenu rare.** Il ne concerne guère que qui a lancé le studio depuis son code source
sans avoir exécuté `pnpm ffmpeg:fetch`.

---

## Où sont vraiment vos fichiers

**Là où vous les avez mis.** Un asset généré atterrit dans l’un des six dossiers de départ — voir
[Ce qu’on y trouve](#ce-quon-y-trouve) — et rien ne l’y retient : déplacez-le, rangez-le dans une
arborescence à vous, l’étagère continue de le montrer et sa fiche le suit. La disposition du
dossier de projet est décrite au chapitre [Les projets](04-projets.md#ce-quil-y-a-dedans).

Ce sont de **vrais fichiers, dans de vrais formats**. Vous pouvez les ouvrir avec n’importe quel
autre logiciel, les copier, les envoyer.

**Sauf les médias importés**, qui restent là où ils étaient — c’est tout l’intérêt du lien. Jusqu’à
ce que vous les éditiez : la version enregistrée, elle, est écrite dans le projet.

---

[← Générer](06-generer.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Image →](08-espace-image.md)
