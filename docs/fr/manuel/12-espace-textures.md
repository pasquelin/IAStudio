# 12. Espace Textures

[← Espace Audio](11-espace-audio.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Skyboxes →](13-espace-skyboxes.md)

L’espace où l’on juge une **matière** : du bois, du métal rouillé, du tissu, de la pierre.

---

## Une texture n’est pas une image

C’est le point de départ, et il change tout.

Une image se regarde à plat. Une **matière** ne se juge pas à plat : elle a du relief, elle
renvoie la lumière d’une certaine façon, elle brille ou elle est mate. Posée sur un plan, sous
un éclairage neutre, une belle matière et une matière ratée se ressemblent.

C’est pourquoi cet espace ne montre pas votre image dans un cadre. Il la **pose sur un objet en
volume, sous une vraie lumière**, et le fait tourner.

---

## Créer une texture

1. Passez dans l’espace **Textures**.
2. Cliquez le bouton **+** du rail gauche. Un document neuf s’ouvre.
3. **Glissez une image du projet sur l’aperçu.** Elle devient la **couleur de base**.

Tant qu’aucune image n’est posée, l’aperçu affiche : « Glissez une image du projet pour la poser
en couleur de base ».

Un cadre bleu apparaît autour de l’aperçu quand vous survolez avec une image : c’est le signe que
le dépôt sera accepté.

---

## Les réglages de l’aperçu

**Ils sont dans l’Inspecteur**, colonne de droite, section **Aperçu**. L’aperçu lui-même ne porte
aucun bouton : dans un studio on juge des finitions, et un contrôle posé sur la matière est un
contrôle devant elle.

### La forme

Cinq formes, et chacune montre quelque chose de différent :

| Forme | Ce qu’elle révèle |
|---|---|
| **Sphère** | comment la matière reçoit la lumière — la meilleure pour juger le brillant |
| **Cube** | comment elle se comporte sur des faces plates et des arêtes vives |
| **Cylindre** | la répétition sur une surface courbe |
| **Plan** | la **répétition** — c’est là qu’on voit les raccords qui se voient |
| **Nœud** | ce qui se passe là où la surface se replie sur elle-même |

**En pratique** : commencez par la **sphère** pour juger la matière, puis passez au **plan** pour
vérifier qu’elle se répète sans couture visible.

### Les quatre autres contrôles

| Contrôle | Ce qu’il fait |
|---|---|
| **Éclairage** | l’intensité de la lumière d’ambiance, de 0 à 3 |
| **Rotation du ciel** | fait tourner l’éclairage autour de l’objet, en degrés |
| **Afficher le fond** | montre l’environnement derrière l’objet, ou l’utilise seulement pour éclairer |
| **Rotation automatique** | fait tourner l’objet lentement, pour lire le relief |

**La rotation automatique est plus utile qu’elle n’en a l’air.** Un relief ne se voit pas sur une
image fixe : c’est le déplacement de la lumière sur la surface qui le révèle. La rotation du ciel
fait la même chose autrement — l’objet reste immobile et c’est la lumière qui se déplace.

---

## L’éclairage

La section **Environnement** de l’Inspecteur, sous celle de l’aperçu. C’est **exactement celle de
l’espace Modélisation** : la question est la même, et les ciels offerts sont ceux de votre projet.

Par défaut, un **studio neutre** — un éclairage doux, sans couleur dominante, comme dans un studio
photo. Aucun fichier à télécharger, et une matière lisible dès le premier document. C’est
volontairement neutre : un éclairage coloré ferait paraître belle une matière qui ne l’est pas.

Dès que votre projet contient une skybox, elle apparaît dans la liste et sert de lumière à son
tour — ce qui permet de juger une matière sous l’éclairage réel de la scène où elle finira.
« Studio » y est toujours proposé, pour y revenir.

---

## Les huit canaux d’une matière

Une matière complète n’est pas une image, mais **jusqu’à huit**, qui décrivent chacune un aspect
différent de la surface.

| Canal | Ce qu’il décrit | Ce que ça donne |
|---|---|---|
| **Couleur de base** | la couleur, sans ombre ni reflet | l’aspect « peinture » de la surface |
| **Normales** | les micro-reliefs | des bosses et des creux qui accrochent la lumière, sans ajouter de géométrie |
| **Rugosité** | mat ou brillant, zone par zone | une flaque brillante sur un asphalte mat |
| **Métallicité** | métal ou non-métal, zone par zone | des rivets métalliques sur un bois |
| **Occlusion ambiante** | les coins où la lumière entre mal | de la profondeur dans les creux |
| **Hauteur** | le relief réel | un déplacement de la surface, plus fort que les normales |
| **Émission** | ce qui brille par soi-même | une enseigne au néon, des braises |
| **Cavité** | les creux et les arêtes de la surface | assombrit le fond des rainures, réglable par le curseur *Cavité* de la section **Matière** |

> **L’inspecteur écrit trois de ces noms plus court** : la ligne dit **Normale**, **Métal** et
> **Occlusion** là où ce tableau et le [glossaire](17-glossaire.md) disent *Normales*,
> *Métallicité* et *Occlusion ambiante*. Ce sont les mêmes canaux — les noms longs sont ceux du
> métier, les courts tiennent dans la colonne des noms.

Chaque canal a une **origine** :

| Origine | Ce que ça veut dire |
|---|---|
| **Généré** | produit par un modèle distant — il est figé |
| **Dérivé** | calculé par le studio depuis un autre canal, à la demande |
| **Importé** | une image que vous avez posée vous-même |

### La section Canaux

Première section de l’**Inspecteur** — c’est ce que Textures est. Une ligne par canal, les huit,
**y compris ceux qui sont vides** : ce qui manque à une matière compte autant que ce qu’elle a.

| Geste | Ce qu’il fait |
|---|---|
| **Glisser une image sur une ligne** | pose cette image dans **ce** canal |
| **La liste de la ligne** | choisit parmi les images du projet, ou vide le canal |
| **Le bouton parcourir** | ouvre la fenêtre de choix, en vignettes plutôt qu’en liste |
| **La croix** | vide le canal |
| **Clic droit sur la ligne** | calcule le canal depuis sa source |
| **Cliquer la vignette** | montre ce canal **seul**, à plat |
| **Cliquer la même à nouveau** | revient à la matière éclairée |

Le badge en haut à gauche d’une vignette dit son **origine** — généré, dérivé ou importé.

**La vue à plat n’est pas un aperçu, c’est une lecture.** Elle affiche les pixels sans lissage :
une carte de normales ou de hauteur s’inspecte précisément pour le bruit et les paliers que le
lissage d’un navigateur cacherait. Elle ne s’enregistre pas avec le document, et `⌘Z` ne la rend
pas — c’est une façon de regarder, pas une décision.

Une ligne vide n’a pas de vignette à cliquer : il n’y a rien à regarder.

> **Une image glissée sur l’aperçu, elle, va toujours dans la couleur de base.** C’est le canal
> sans lequel une matière ne se juge pas, et l’aperçu ne peut pas devenir : pour viser un autre
> canal, déposez sur sa ligne.

### Calculer un canal depuis un autre

Quatre canaux se calculent depuis un autre, sur votre carte graphique — sans appel à l’API, donc
**sans dépenser un crédit**.

| Canal | Calculé depuis | Ce que le calcul fait |
|---|---|---|
| **Hauteur** | Couleur de base | la luminosité de l’image devient un relief |
| **Normales** | Hauteur | un filtre de Sobel lit la pente sous chaque pixel |
| **Occlusion ambiante** | Hauteur | ce qui est plus bas que son voisinage s’assombrit |
| **Rugosité** | Couleur de base | les zones sombres deviennent mates, les claires brillantes |

Le calcul est ce que le **clic droit sur la ligne** offre. Si le canal source est vide, l’entrée le
dit et ne se clique pas : c’est celui-là qu’il faut remplir d’abord.

Le résultat est une **image du projet** comme une autre — elle apparaît dans l’Explorateur, se regarde à
plat, part avec le projet — et le canal la porte avec le badge « dérivé ». Chaque calcul en crée une
nouvelle : relancer trois fois laisse trois images, dont une seule est en place.

**Aucune force n’est figée dans les pixels.** L’intensité se règle après coup, dans l’Inspecteur :
*Normale* (section **Relief**) pour la force du relief, *Occlusion* (section **Matière**) pour
l’ombrage des creux, la *plage de rugosité* pour le contraste du mat au brillant. C’est ce qui rend
une dérivation réversible sans la refaire.

**Un canal calculé ne se met pas à jour tout seul.** Si vous remplacez la hauteur, la normale qui en
venait décrit encore l’ancienne : relancez son calcul.

### Juger la répétition, et voir les coutures

Une matière ne se juge pas sur un seul carreau. Trois contrôles, dans **Inspecteur ▸ Répétition**,
sous les valeurs qu’ils regardent :

| Contrôle | Ce qu’il fait |
|---|---|
| **Aperçu de la répétition** — 1×, 2×, 4× | multiplie la répétition **pour l’œil seulement** |
| **Amener les coutures au centre** | décale tous les canaux d’une demi-largeur **et d’une demi-hauteur** : les deux bords qui se raccordent arrivent au milieu de l’aperçu |
| **Coutures** — le bouton **Mesurer** | compare le raccord au grain de l’image et répond en trois mots |

**Les deux premiers ne touchent jamais la matière.** Ils changent la façon de la regarder, pas ce
qu’elle est : la répétition qui part dans une scène reste celle du champ **Répéter**, et le décalage
reste celui du champ **Décalage**. Regarder à 4× ne fabrique pas une texture répétée quatre fois.

**La mesure est un rapport, pas une différence.** Une pierre bruitée supporte un saut qui ferait une
cicatrice sur un enduit lisse : ce qu’on lit comme une couture, c’est la marche au raccord comparée
au grain que l’image a déjà. D’où trois réponses — *aucune couture visible*, *couture discrète*,
*couture visible* — plutôt qu’un pourcentage qui ne voudrait rien dire seul.

Elle porte sur la **couleur de base** : c’est le canal où une couture se voit, et les huit sont
posés ensemble. Le bouton reste éteint tant qu’aucune couleur de base n’est en place, et les mots
disparaissent dès qu’on la remplace — ils décrivaient des pixels qui ne sont plus là.

La mesure et le calcul d’un canal passent par la même carte graphique, **une passe à la fois** :
demander l’une pendant que l’autre tourne ne la refuse pas, elle attend son tour.

---

## Rugosité et métallicité, expliquées

Ce sont les deux mots qu’il faut comprendre pour lire une matière.

**Rugosité** — à quel point la surface est mate.

| Valeur | Aspect |
|---|---|
| 0 | miroir parfait |
| 0,3 | métal poli, plastique brillant |
| 0,6 | bois verni, cuir |
| 1 | craie, velours, béton brut |

Certains logiciels appellent cela « brillance » (*glossiness* ou *smoothness*), qui est
exactement l’inverse : brillance 0,9 = rugosité 0,1. **Le studio dit toujours rugosité**, partout —
un mot pour une grandeur, ici comme dans l’espace Modélisation.

Ce n’est pas qu’une question de vocabulaire : certains modèles distants répondent en *brillance*.
Le studio garde alors les pixels tels qu’ils sont arrivés et retourne la lecture au moment de
l’affichage. Vous n’avez rien à faire, et vous ne verrez jamais une matière éclairée à l’envers.

**Métallicité** — est-ce du métal, oui ou non.

Ce réglage est presque toujours **0 ou 1**, rarement entre les deux. Un métal renvoie la lumière
d’une façon complètement différente d’un non-métal ; il n’y a pas grand-chose entre les deux,
sauf sur un métal peint ou rouillé, où la valeur varie **zone par zone** grâce à une carte.

---

## Régler la matière

Inspecteur, section **Matière**. Quatre sections en tout, et elles répondent à quatre questions
différentes.

### Matière

| Réglage | Ce qu’il fait |
|---|---|
| **Teinte de base** | une couleur multipliée par la couleur de base — pour teinter sans repeindre |
| **Rugosité** | mat ou brillant, pour toute la surface |
| **Remappage** (sous la rugosité) | **deux poignées sur un rail** : la plage dans laquelle la carte est relue |
| **Métal** | métal ou non, pour toute la surface |
| **Remappage** (sous le métal) | la même chose, pour la carte de métallicité |
| **Occlusion** | à quel point la carte d’occlusion assombrit les creux |
| **Cavité** | à quel point la carte d’arêtes assombrit les bords |

**Le remappage est le réglage le plus utile de cette section, et le moins évident.** Une carte
générée est souvent **plate** — tout y est autour de 0,5, et la matière paraît uniformément
moyenne. Le remappage rétrécit ou élargit la plage : mettre la rugosité « de 0,2 à 0,9 » étale ce
que la carte contenait et fait apparaître le contraste entre les zones mates et les zones
brillantes.

Les deux poignées **peuvent se rejoindre, jamais se croiser**. Une plage inversée remapperait toute
la carte sur rien, et la matière deviendrait plate sans que rien à l’écran ne dise pourquoi.

**Quand aucune carte n’est posée, le remappage ne fait rien** : il décrit la façon de relire une
carte, pas une valeur.

### Relief

| Réglage | Ce qu’il fait |
|---|---|
| **Normale** | la force des micro-reliefs, de −2 à 2 |
| **Inverser le vert** | pour une carte de normales cuite dans l’autre convention |
| **Déplacement** | le relief réel, qui déforme la surface — à 0 par défaut |

**Une normale négative retourne le relief** : les bosses deviennent des creux. Ce n’est pas un
bug, c’est la réponse à une carte cuite à l’envers — l’autre réponse étant « Inverser le vert ».
OpenGL et DirectX ne sont pas d’accord sur le sens du canal vert, et une carte venue d’un moteur
éclaire depuis le mauvais côté jusqu’à ce que l’un des deux soit corrigé.

**Le déplacement est à 0 volontairement.** Il déforme vraiment la géométrie, ce qui coûte plus
cher que la scène qu’on prévisualise : c’est quelque chose qu’on demande, pas qu’on subit.

### Émission

Une couleur et une intensité, pour ce qui brille par soi-même.

### Répétition

Cette section est **repliée** à l’ouverture : une répétition se règle une fois et se laisse.

| Réglage | Ce qu’il fait |
|---|---|
| **Répéter** | combien de fois la matière se répète, en X et en Y |
| **Décalage** | où elle commence |
| **Rotation** | de 0 à 360°, autour du centre |

**Les trois s’appliquent aux huit canaux à la fois.** Appliqués à un seul, les canaux se
désaligneraient et le relief cesserait de correspondre à l’image qu’il soulève.

---

## Les styles — garder un réglage pour la matière suivante

Une matière bien réglée, c’est une quinzaine de valeurs. Les retrouver à la main sur la matière
d’après, c’est le genre de travail qu’on ne refait pas deux fois de bon cœur.

**Le bouton en haut à droite de l’inspecteur** enregistre l’état courant de la matière sous un nom
généré — « Style 1 », « Style 2 ». La section **Styles** de l’inspecteur, juste sous les canaux,
les liste tous.

**Cliquez un style** pour l’appliquer à la matière ouverte. C’est une seule annulation : `⌘Z`
remet exactement ce qui était réglé avant.

**Clic droit ▸ Renommer**, comme dans un IDE. Le nom s’édite là où il se lit.
**Clic droit ▸ Supprimer** retire le style.

### Ce qu’un style emporte, et ce qu’il n’emporte pas

**Un style ne contient aucune carte.** Il dit *comment lire* les canaux de la matière en face,
jamais *lesquels*. C’est précisément ce qui lui permet de s’appliquer à n’importe quelle
matière : un style qui apporterait ses propres canaux ne s’appliquerait plus, il remplacerait.

Conséquence à connaître, qui n’est pas un défaut : **une bonne moitié des réglages ne fait rien
sans la carte correspondante**. Un « effet métal » posé sur une matière sans carte agit par sa
couleur, sa rugosité et sa métallicité ; les plages de remappage et la force de normale
attendront que les canaux arrivent. Elles sont gardées telles quelles, et prendront effet le
jour où la matière se complète.

**Les styles suivent la machine, pas le projet.** Ils sont rangés dans votre dossier
d’utilisateur, à côté des favoris, et sont donc là quel que soit le projet ouvert. C’est voulu :
une carte appartient au catalogue d’un projet, un tour de main n’appartient à aucun.

---

## Enregistrer

Tout est enregistré **automatiquement**, quelques instants après votre dernier geste, dans un
fichier `.mtlx` du dossier `documents/` de votre projet.

**Rien n’est cuit dans les pixels.** Rouvrez le document dans six mois : chaque réglage est
encore là, et se règle encore. Ce qui est écrit, ce sont vos décisions, pas leur résultat.

**Tous les types de documents s’enregistrent désormais**, mais la matière garde une particularité :
elle est la seule à s’écrire **toute seule**. Ailleurs, c’est `⌘S` qui décide du moment, et la
puce sur l’onglet dit ce qui attend encore d’être écrit.

---

## Exporter la matière

Menu **Fichier ▸ Exporter ▸ Matière**, puis la ligne du moteur qui va la recevoir. Le menu
n'apparaît que dans l'espace Textures, et il s'adresse à **l'onglet au premier plan** : deux
matières ouvertes ne répondent pas ensemble au même clic.

Le studio demande **un dossier**, et crée dedans un sous-dossier au nom de votre document. Les
fichiers d'un export ne veulent rien dire séparés — une couleur de base sans son ORM à côté est
la moitié d'une matière —, alors ils voyagent ensemble.

### Les cinq destinations

| Ligne | Ce qui est écrit |
|---|---|
| **glTF / GLB** | **un seul fichier** `.glb`, textures embarquées, posé sur la forme de l'aperçu |
| **Unity (URP)** | `_BaseMap`, `_BumpMap`, `_MaskMap`, `_EmissionMap`, `_ParallaxMap` |
| **Unreal Engine** | `_BaseColor`, `_Normal`, `_ORM`, `_Emissive`, `_Height` |
| **Roblox** | `_ColorMap`, `_NormalMap`, `_RoughnessMap`, `_MetalnessMap` |
| **Canaux bruts** | les huit canaux, un fichier chacun, masque de cavité compris |

Les canaux sortent en **PNG**, sans perte : un canal est de la donnée avant d'être une image, et
le JPEG inventerait des dégradés là où le relief se lit. La première ligne, elle, écrit un seul
fichier `.glb` qui porte ses images à l'intérieur.

### Ce que veut dire « empaqueter »

Un moteur ne lit pas huit fichiers quand trois composantes lui suffisent. Trois canaux gris
tiennent dans une seule image, un par composante — c'est ce qu'on appelle un *pack*, et chaque
moteur a le sien :

- **`_ORM` d'Unreal** : occlusion sur le **rouge**, rugosité sur le **vert**, métallicité sur le
  **bleu**. C'est aussi ce que lit glTF, qui prend la même image pour son occlusion et pour son
  couple métallique-rugosité ;
- **`_MaskMap` d'Unity** : métallicité sur le **rouge**, occlusion sur le **vert**, et le
  **lissage sur l'alpha**. Une seule image, à poser dans les **deux** emplacements — celui du
  métallique et celui de l'occlusion ;
- **Roblox** ne pack rien : sa `SurfaceAppearance` prend exactement quatre cartes séparées.

Le calcul se fait **sur le GPU, en une passe** par image. Une image 4K, c'est seize millions de
pixels et trois canaux lus par pixel : une boucle en JavaScript figerait la fenêtre.

### Deux conventions que l'export réconcilie pour vous

**Le vert d'une normale.** OpenGL et DirectX ne sont pas d'accord sur son sens. Le studio écrit de
l'OpenGL ; Unreal attend du DirectX. L'export retourne donc le vert pour Unreal, et pas pour les
autres. Et si vous aviez coché **Inverser le vert** parce que votre normale était arrivée en
DirectX, l'export le sait : il ne retourne pas deux fois.

**La rugosité rangée à l'envers.** Le convertisseur distant répond parfois avec une carte de
*lissage* — la même image lue dans l'autre sens. Le studio la garde telle qu'elle est arrivée et
retient qu'elle est inversée. Un fichier `_Roughness` contient donc bien de la rugosité, et le
`_MaskMap` d'Unity bien du lissage : le nom du fichier dit ce qu'il y a dedans.

### Quatre choses à savoir

**Vos réglages de plage partent avec.** La double poignée de la section Matière — celle qui
resserre la rugosité ou la métallicité — n’existe dans aucun des quatre formats. Elle est donc
**écrite dans les pixels** : une rugosité resserrée entre 0,3 et 0,7 à l’écran sort resserrée.
Une seule exception, et c’est sa raison d’être : **les canaux bruts sortent tels qu’ils sont
stockés**, sans remappage — c’est la ligne qu’on choisit précisément pour récupérer ses pixels
intacts.

**La pleine résolution, pas celle de l'aperçu.** L'export lit chaque canal à la taille où il est
stocké. Une seule exception, et elle n'est pas la nôtre : **Roblox refuse une carte au-delà de
1024 px**, donc ses quatre fichiers sont ramenés sous ce plafond, en gardant les proportions.

**Une image qu'aucun canal ne nourrit n'est pas écrite.** Une matière sans occlusion ni
métallicité ne produit pas d'`_ORM` gris uniforme : tout l'intérêt de cet emplacement est que ce
qu'il contient a été mesuré. Les composantes manquantes d'une image qui, elle, est écrite prennent
une valeur neutre — pas d'occlusion, pas de métal.

**Ré-exporter écrase fichier par fichier, et ne fait pas le ménage.** Le même document exporté
deux fois au même endroit réécrit les fichiers de même nom, mais **ne vide pas le dossier** :
exporter vers Unreal puis vers Roblox laisse les deux jeux côte à côte, et un canal supprimé
entre-temps y laisse son fichier périmé. Videz le dossier vous-même si vous voulez qu'il ne
contienne que le dernier export.

### Ce que le `.glb` emporte en plus

Lui seul est un objet et pas un jeu de fichiers : il part avec **la forme de l'aperçu**, et avec
les réglages de la section Matière que le format sait porter : la teinte, la rugosité, la
métallicité, la force de la normale, l'intensité d'occlusion, l'émission et son intensité, et la
répétition avec son décalage et sa rotation. Ouvert ailleurs, il ressemble à ce que vous jugiez à
l'écran.

Deux choses n'y entrent pas, faute d'exister dans le format : le **relief** — glTF n'a pas
d'emplacement de déplacement, donc la hauteur ne part ni comme carte ni comme force — et le
**centre de la rotation**. `KHR_texture_transform` n'a pas de pivot : une matière exportée avec
une rotation tourne autour du coin de l'image là où l'aperçu tourne autour du milieu.

La **prévisualisation** de la répétition (×1, ×2, ×4) n'en fait pas partie, et c'est voulu :
juger une répétition et en choisir une sont deux gestes, et seul celui que vous avez choisi
appartient à un fichier.

---

## Ce qui manque encore

- l’**import d’un fichier du disque** directement dans un canal. Passez par l’import du projet
  (chapitre 7), puis posez l’image sur la ligne du canal.

Le détail est dans [Ce qui n’existe pas encore](18-limites.md).

---

[← Espace Audio](11-espace-audio.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Skyboxes →](13-espace-skyboxes.md)
