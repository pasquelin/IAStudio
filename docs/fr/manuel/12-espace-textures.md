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
l’espace 3D** : la question est la même, et les ciels offerts sont ceux de votre projet.

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
| **Arêtes** | où sont les bords | sert à d’autres calculs |

Chaque canal a une **origine** :

| Origine | Ce que ça veut dire |
|---|---|
| **Généré** | produit par un modèle Scenario — il est figé |
| **Dérivé** | calculé par le studio depuis un autre canal, à la demande |
| **Importé** | une image que vous avez posée vous-même |

### Le panneau Canaux

Colonne de droite, premier panneau de l’espace — c’est ce que Textures est. Une vignette par
canal, les huit, **y compris ceux qui sont vides** : ce qui manque à une matière compte autant que
ce qu’elle a.

| Geste | Ce qu’il fait |
|---|---|
| **Glisser une image sur une vignette** | pose cette image dans **ce** canal |
| **Le menu d’une vignette** | calcule le canal depuis sa source, choisit parmi les images du projet, ou vide le canal |
| **Cliquer une vignette** | montre ce canal **seul**, à plat |
| **Cliquer la même à nouveau** | revient à la matière éclairée |

Le badge en haut à gauche d’une vignette dit son **origine** — généré, dérivé ou importé.

**La vue à plat n’est pas un aperçu, c’est une lecture.** Elle affiche les pixels sans lissage :
une carte de normales ou de hauteur s’inspecte précisément pour le bruit et les paliers que le
lissage d’un navigateur cacherait. Elle ne s’enregistre pas avec le document, et `⌘Z` ne la rend
pas — c’est une façon de regarder, pas une décision.

Une vignette vide ne se clique pas : il n’y a rien à regarder.

> **Une image glissée sur l’aperçu, elle, va toujours dans la couleur de base.** C’est le canal
> sans lequel une matière ne se juge pas, et l’aperçu ne peut pas devenir : pour viser un autre
> canal, déposez sur sa vignette.

### Calculer un canal depuis un autre

Quatre canaux se calculent depuis un autre, sur votre carte graphique — sans appel à l’API, donc
**sans dépenser un crédit**.

| Canal | Calculé depuis | Ce que le calcul fait |
|---|---|---|
| **Hauteur** | Couleur de base | la luminosité de l’image devient un relief |
| **Normales** | Hauteur | un filtre de Sobel lit la pente sous chaque pixel |
| **Occlusion ambiante** | Hauteur | ce qui est plus bas que son voisinage s’assombrit |
| **Rugosité** | Couleur de base | les zones sombres deviennent mates, les claires brillantes |

Le calcul est la **première ligne du menu de la vignette**. Si le canal source est vide, la ligne le
dit et ne se clique pas : c’est celui-là qu’il faut remplir d’abord.

Le résultat est une **image du projet** comme une autre — elle apparaît dans l’étagère, se regarde à
plat, part avec le projet — et le canal la porte avec le badge « dérivé ». Chaque calcul en crée une
nouvelle : relancer trois fois laisse trois images, dont une seule est en place.

**Aucune force n’est figée dans les pixels.** L’intensité se règle après coup, dans l’Inspecteur :
*Normale* (section **Relief**) pour la force du relief, *Occlusion* (section **Matériau**) pour
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
un mot pour une grandeur, ici comme dans l’espace 3D.

Ce n’est pas qu’une question de vocabulaire : certains modèles Scenario répondent en *brillance*.
Le studio garde alors les pixels tels qu’ils sont arrivés et retourne la lecture au moment de
l’affichage. Vous n’avez rien à faire, et vous ne verrez jamais une matière éclairée à l’envers.

**Métallicité** — est-ce du métal, oui ou non.

Ce réglage est presque toujours **0 ou 1**, rarement entre les deux. Un métal renvoie la lumière
d’une façon complètement différente d’un non-métal ; il n’y a pas grand-chose entre les deux,
sauf sur un métal peint ou rouillé, où la valeur varie **zone par zone** grâce à une carte.

---

## Régler la matière

Inspecteur, section **Matériau**. Quatre sections en tout, et elles répondent à quatre questions
différentes.

### Matériau

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

## Enregistrer

Tout est enregistré **automatiquement**, quelques instants après votre dernier geste, dans un
fichier `.tex` du dossier `documents/` de votre projet.

**Rien n’est cuit dans les pixels.** Rouvrez le document dans six mois : chaque réglage est
encore là, et se règle encore. Ce qui est écrit, ce sont vos décisions, pas leur résultat.

**Tous les types de documents s’enregistrent désormais**, mais la matière garde une particularité :
elle est la seule à s’écrire **toute seule**. Ailleurs, c’est `⌘S` qui décide du moment, et la
puce sur l’onglet dit ce qui attend encore d’être écrit.

---

## Ce qui manque encore

- l’**import d’un fichier du disque** directement dans un canal. Passez par l’import du projet
  (chapitre 7), puis posez l’image sur la vignette ;
- l’**export** vers glTF, Unity, Unreal, Roblox.

Le détail est dans [Ce qui n’existe pas encore](18-limites.md).

---

[← Espace Audio](11-espace-audio.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Skyboxes →](13-espace-skyboxes.md)
