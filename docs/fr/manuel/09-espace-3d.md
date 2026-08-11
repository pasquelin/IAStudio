# 9. Espace 3D

[← Espace Image](08-espace-image.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Vidéo →](10-espace-video.md)

L’espace où l’on construit une scène en volume : des objets, des lumières, une caméra qui s’y
promène.

---

## Ouvrir une scène

Le bouton **+** du rail gauche crée une scène neuve. Un projet doit être ouvert.

Une scène neuve contient un sol quadrillé — la **grille** — et rien d’autre. Elle est noire tant
qu’aucune lumière n’y est posée : c’est normal, et le panneau Lumières le dit.

---

## Se déplacer dans la scène

Deux modes de navigation, qui coexistent.

### Tourner autour de la scène — la souris seule

| Geste | Effet |
|---|---|
| **Clic gauche + glisser** dans le vide | fait tourner la vue autour du point regardé |
| **Molette** | avance et recule |
| **Clic droit + glisser** *(voir ci-dessous)* | fait voler |

C’est le mode par défaut. On tourne **autour** de la scène, comme si on en faisait le tour.

### Voler dans la scène — le clic droit

**Maintenez le bouton droit de la souris**, et la caméra passe en vol libre. Sans lâcher :

| Touche | Mouvement |
|---|---|
| `W` `A` `S` `D` | avancer, gauche, reculer, droite |
| `E` | monter |
| `Q` | descendre |
| `⇧ Maj` | accélérer |

C’est la navigation des logiciels de jeu vidéo : on se déplace **à travers** la scène au lieu
d’en faire le tour. Relâchez le bouton droit, la caméra reprend son mode normal.

> **Les touches sont lues à leur position physique.** WASD sur un clavier QWERTY et ZQSD sur un
> clavier AZERTY sont **les mêmes quatre touches**. Il n’y a rien à reconfigurer.

Trois réglages gouvernent le vol : **Réglages ▸ Espaces de travail ▸ 3D**

| Réglage | Ce qu’il fait | Défaut |
|---|---|---|
| **Vitesse de déplacement** | mètres par seconde | 4 |
| **Accélération** | par combien Maj multiplie la vitesse | 3 |
| **Angle de vue** | ce que la caméra embrasse, en degrés | 60 |

---

## La barre d’outils

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Sélectionner** | `V` | choisit un objet sans armer de poignée |
| **Déplacer** | `G` | tire l’objet le long des flèches de couleur |
| **Pivoter** | `R` | fait pivoter l’objet avec les cercles de couleur |
| **Redimensionner** | `S` | agrandit ou rétrécit avec les poignées |
| **Magnétisme** | `M` | fait avancer les poignées **par crans** au lieu de les laisser libres |
| **Repère local** | `L` | aligne les poignées sur l’orientation de **l’objet** plutôt que sur celle du monde |
| **Cadrer la sélection** | `F` | recentre la caméra sur l’objet choisi |
| **Ajouter** | — | pose une maille ou une lumière dans la scène |
| **Supprimer** | `Suppr` | retire tout ce qui est sélectionné |

**Le magnétisme sert à aligner.** Sans lui, un objet se pose à 1,0374 m du précédent ; avec lui,
à 1 m tout rond. La finesse des crans — un pour le déplacement, un pour la rotation, un pour
l’échelle — se règle dans **Réglages ▸ Espaces de travail ▸ 3D**.

**Le repère local se voit sur un objet tourné.** Poignées en repère monde, la flèche rouge pointe
toujours vers l’est. En repère local, elle pointe vers la droite **de l’objet** : c’est ce qu’on
veut pour avancer une voiture dans le sens où elle roule.

Contrairement à l’espace Image, les trois outils de manipulation restent **trois boutons
visibles** au lieu d’être groupés. C’est délibéré : on en change plusieurs fois par minute, et
c’est ainsi que font Blender, Maya, Unity et l’éditeur three.js.

### Les poignées de couleur

Quand un outil de manipulation est armé et qu’un objet est choisi, des poignées apparaissent
autour de lui. Le code de couleur est universel :

| Couleur | Axe | Direction |
|---|---|---|
| **Rouge** | X | gauche ↔ droite |
| **Vert** | Y | bas ↔ haut |
| **Bleu** | Z | avant ↔ arrière |

Tirez sur une flèche pour déplacer le long de cet axe seulement.

> Un déplacement complet — de l’appui au relâchement — compte pour **une seule** action dans
> l’historique. `⌘Z` le défait d’un coup.

---

## Poser des objets

Trois chemins mènent au même endroit :

- le bouton **Ajouter** de la barre d’outils ;
- les boutons **+** des panneaux **Mailles** et **Lumières** ;
- le menu **Objets ▸ Ajouter**.

L’objet se pose à **l’origine de la scène** — le centre du monde, là où les axes se croisent.

### Faire entrer un modèle existant

Les formes ci-dessous sont celles que le studio sait **construire**. Un modèle qui vient
d’ailleurs — généré par un modèle *texte vers 3D*, ou importé depuis un `.glb` — entre par
l’étagère :

| Geste | Résultat |
|---|---|
| **Double-clic** sur un maillage dans l’étagère | il entre dans la scène ouverte |
| **Glisser-déposer** sur la vue 3D | idem — n’importe où sur la vue, la barre d’outils comprise |

**Seuls les maillages entrent.** Une image, un son ou une vidéo lâchés sur la vue 3D ne font
rien : la scène ne saurait qu’en faire.

Comme le reste, le modèle se pose **à l’origine**. Il arrive parfois minuscule ou gigantesque —
un `.glb` porte son échelle d’origine, qui n’a aucune raison d’être la vôtre. La poignée
d’échelle (`S`) règle cela en un geste, et `F` recadre la caméra dessus.

### Les mailles disponibles

Une *maille* (ou *mesh*) est un objet géométrique.

| Forme | À quoi ça ressemble |
|---|---|
| **Cube** | une boîte |
| **Sphère** | une balle |
| **Capsule** | un cylindre à bouts arrondis, comme une gélule |
| **Cercle** | un disque plat |
| **Cylindre** | un tube plein |
| **Plan** | une feuille plate |
| **Anneau** | un disque percé |
| **Tore** | un donut |
| **Nœud de tore** | un donut entrelacé |
| **Tube** | un tuyau courbé |
| **Révolution** | une forme obtenue en faisant tourner un profil |
| **Tétraèdre** | 4 faces triangulaires |
| **Octaèdre** | 8 faces |
| **Dodécaèdre** | 12 faces |
| **Icosaèdre** | 20 faces |

### Le texte — des mots en volume

**Ajouter ▸ Objet ▸ Texte** pose un texte dans la scène, déjà écrit et déjà lisible. L’inspecteur
en montre trois choses : le **contenu**, la **police**, et les nombres qui donnent sa forme aux
lettres — le **corps**, la **profondeur** (mettez-la à zéro pour des lettres plates) et les
**segments de courbe**, qui décident de la finesse des arrondis.

Un texte est éclairé comme une maille, et porte le même **matériau** : couleur, rugosité, métal,
et les cinq textures. Il projette et reçoit les ombres.

#### Les polices offertes

La liste s’ouvre sur les **trois polices que le studio embarque** — Lato, IBM Plex Serif, IBM Plex
Mono — puis sur **celles que votre machine a installées**. Les trois premières sont dans
l’application : une scène qui les emploie s’ouvre à l’identique sur n’importe quelle machine.

Une police du système, non. Elle reste écrite dans le document, mais si vous ouvrez la scène
ailleurs et que la police n’y est pas, deux choses se produisent : la liste affiche son nom suivi
de **« (absente) »**, et les lettres sont dessinées dans la police embarquée par défaut pour que
le texte reste visible. Le document, lui, n’est pas réécrit — retrouvez la machine qui a la
police, et la scène redevient ce qu’elle était.

> Certaines polices anciennes du système ne s’ouvrent pas : la bibliothèque que le studio emploie
> ne lit pas tous les formats de table qu’elles emploient. Le nom reste dans la liste, le texte
> retombe sur la police par défaut, et le journal dit laquelle a échoué.

### Le sprite — une image face à la caméra

Un *sprite* n’est pas une maille : c’est une image plate qui se tourne toujours vers vous, quel
que soit l’angle de la vue. C’est ce qu’on emploie pour une étincelle, une lueur, un repère, une
étiquette au-dessus d’un objet — tout ce qui doit rester lisible d’où qu’on regarde.

**Ajouter ▸ Sprite** en pose un à l’origine. Il arrive sans image : choisissez-la dans
l’Inspecteur, section **Sprite**, parmi les images du projet — les mêmes que celles qu’un
matériau accepte en texture.

| Réglage | Ce qu’il fait |
|---|---|
| **Couleur** | teinte l’image. Sur un sprite sans image, c’est la couleur du carré lui-même |
| **Opacité** | de transparent à opaque |
| **Texture** | l’image affichée, prise dans les assets du projet |

Quatre choses à savoir :

- **Sa taille est son échelle.** Un sprite n’a pas de largeur propre : on le redimensionne avec la
  poignée d’échelle, comme n’importe quel objet. Il rapetisse avec la distance, comme le reste de
  la scène.
- **Il ne tourne pas.** Puisqu’il fait toujours face à la caméra, lui donner un angle ne se verrait
  nulle part : sélectionné seul, il n’a ni poignée de l’outil **Pivoter**, ni ligne **Rotation**
  dans l’Inspecteur — plutôt qu’un nombre qui ne change rien à l’écran mais coûte un `⌘Z`. Deux
  cas le font tourner pour de vrai, et les deux se voient :
  - **Des objets descendent de lui.** Il retrouve sa poignée et sa ligne : tourner l’ensemble fait
    pivoter les enfants autour de lui.
  - **Il est pris dans une sélection de plusieurs objets, et on tire la poignée.** Elle fait
    tourner le groupe autour d’un pivot commun, ce qui déplace le sprite dans l’espace. Attention,
    **la ligne Rotation de l’Inspecteur ne fait pas la même chose** : un angle tapé est absolu et
    s’applique à chaque objet autour du sien propre, sans pivot commun — le sprite, lui, ne bouge
    pas. La ligne reste affichée tant qu’un objet de la sélection tourne, et l’angle tapé va sur
    ceux-là.
- **Il ne joue pas avec les ombres.** Il n’en projette pas et n’en reçoit pas — three.js ne dessine
  que des mailles dans une carte d’ombres. L’Inspecteur ne lui montre donc aucune section Ombres,
  plutôt que deux interrupteurs sans effet.
- **Il n’est pas éclairé.** Sa couleur est celle qu’on lui donne, pas celle que les lumières de la
  scène en font.

### Les lumières disponibles

Sans lumière, la scène reste noire.

| Lumière | Ce qu’elle fait | Quand l’utiliser |
|---|---|---|
| **Ambiante** | éclaire tout, uniformément, sans ombre | pour déboucher les noirs |
| **Directionnelle** | des rayons parallèles, comme le soleil | l’éclairage principal d’une scène extérieure |
| **Hémisphérique** | une couleur venant du ciel, une autre du sol | un rendu extérieur doux et naturel |
| **Ponctuelle** | rayonne dans toutes les directions depuis un point | une ampoule, une bougie |
| **Projecteur** | un cône de lumière | un spot de théâtre, un phare |

**Pour commencer** : une **directionnelle** pour l’éclairage principal, plus une **ambiante**
faible pour que les ombres ne soient pas complètement noires. C’est la recette classique.

---

## Regarder la scène autrement

Trois boutons, entre les bascules et le cadrage. Ils ne changent rien à la scène : ils changent la
façon de la regarder. Rien de tout cela n’est enregistré avec le document, et `⌘Z` n’y touche pas.

### Projection — `O`

En **perspective**, les fuyantes convergent : c’est ce que voit un œil, et c’est le réglage par
défaut. En **orthographique**, les parallèles restent parallèles et un objet garde sa taille quelle
que soit sa distance.

C’est ce qui permet de juger un alignement. Deux cubes posés côte à côte semblent décalés en
perspective ; en orthographique, ils le sont ou ils ne le sont pas.

La bascule ne change pas ce que vous voyez, et c'est la seule promesse qu'elle tient : la caméra,
elle, se replace pour cela. En orthographique le tronc de la projection est calculé pour que ce qui
est au centre garde sa taille ; au retour en perspective, où l'on ne peut zoomer qu'en avançant, ce
que la molette avait grossi devient de la distance.

### Se placer — les six côtés

**De face**, **de dos**, **de gauche**, **de droite**, **de dessus**, **de dessous**. La caméra va
se poser sur l’axe correspondant, à la distance qu’elle avait déjà, et regarde le point autour
duquel elle tournait.

Combiné à la projection orthographique, c’est la vue de plan classique — celle sur laquelle on
aligne.

### Affichage — `Z`

| Mode | Ce qui est dessiné |
|---|---|
| **Rendu** | les surfaces peintes par leur matériau, sans les arêtes |
| **Filaire** | les arêtes seules — ce qui montre la densité du maillage |
| **Rendu et filaire** | les surfaces peintes, et les arêtes par-dessus |
| **Solide** | une argile unie sur toutes les surfaces : la forme, sans les matériaux |
| **Aperçu matériau** | les matériaux sous le seul éclairage du studio, sans les lumières de la scène |
| **Matcap** | un éclairage capté sur une sphère : c’est le relief qui se lit, pas la couleur |
| **Densité** | du vert au rouge selon les triangles au centimètre carré : le rouge est à optimiser |

Le bouton porte le mode en cours et le fait défiler à chaque clic ; son menu permet d’en choisir un
directement. `Z` fait la même chose au clavier, comme dans Blender — **et en quatre vues, sur le
quart où se trouve le pointeur** : chaque quart garde son propre mode.

**Rendu et filaire** est le plus coûteux : les arêtes sont un objet de plus par maille, construit
quand on l’allume et jeté quand on l’éteint. Sur un modèle importé de plusieurs milliers de
mailles, cela se sent.

### Quatre vues — `⇧Q`

Le viewport se partage en quatre. **Le quart en haut à gauche garde le cadrage que vous aviez** ;
il repasse en perspective si vous étiez en projection orthographique. Les trois autres arrivent en
orthographique : **dessus** en haut à droite, **face** en bas à gauche, **profil gauche** en bas à
droite.

**Les quatre sont des plans de travail**, pas des aperçus : les poignées de transformation suivent
le quart où se trouve votre pointeur. On sélectionne et on déplace dans n’importe lequel.

**Le nom d’une vue, en haut à droite de son quart, est aussi la façon d’en changer.** Sept choix :
la vue libre et les six côtés. Rien n’oblige à garder la disposition de départ — deux perspectives
et deux axes se demandent aussi bien.

**Seule la vue libre tourne.** Faire glisser dans un quart de côté ne le fait pas pivoter : une vue
de dessus qui bascule n’est plus une vue de dessus, et c’est précisément ce qu’on lui demande.
**C’est la vue qui décide, jamais la projection** — passer la vue libre en orthographique avec `O`
ne l’empêche pas de tourner. Le déplacement latéral et le zoom marchent partout.

**Changer la vue d’un quart recadre tous les quarts de côté** sur la scène entière : ils n’ont pas
de cadrage à eux qu’ils retrouveraient. Seule la vue libre garde le sien.

### Arêtes en quads — `⇧W`

En filaire, le studio redessine les arêtes **sans les diagonales que la triangulation a
ajoutées** — un cube perd ainsi celles qui barraient ses faces, une par face.

**Ce n’est pas une lecture des quads du fichier, parce qu’il n’y en a pas.** Un GLB ne stocke que
des triangles, quel que soit le logiciel qui l’a produit. Ce que vous voyez est une
reconstruction : deux triangles dont l’arête commune sépare des faces presque coplanaires sont
relus comme un quad. Sur une surface très courbée, la reconstruction se trompe — elle efface une
arête que le modeleur avait voulue.

---

## Choisir plusieurs objets

**Un clic remplace la sélection. Un clic avec `⇧`, `⌘` ou `Ctrl` l’ajoute ou la retire.**

C’est la convention de tous les logiciels : le modificateur bascule l’objet cliqué sans toucher au
reste. Recliquer un objet déjà choisi le sort de la sélection.

| Geste | Effet |
|---|---|
| **Clic** sur un objet | il devient la sélection, seul |
| **`⇧`/`⌘`/`Ctrl` + clic** | il entre dans la sélection, ou en sort s’il y était |
| **Clic dans le vide** | tout est désélectionné |
| **`⇧`/`⌘`/`Ctrl` + clic dans le vide** | **rien ne change** — un raté ne doit pas défaire un tri patient |

Tout ce qui suit — déplacer, tourner, supprimer, grouper, dupliquer, régler dans l’Inspecteur —
agit sur **toute** la sélection, pas seulement sur le dernier objet cliqué.

---

## Grouper

**`⌘G`**, ou le bouton **Grouper** de la barre d’outils.

Un groupe range plusieurs objets sous un même parent. **Déplacer le groupe les déplace tous**, et
il se replie d’un clic dans le panneau Scène — une scène de trente objets redevient lisible.

Deux façons de défaire ou de refaire un rangement :

- **`⌘Z`** annule le groupement, comme n’importe quelle action ;
- **glisser une ligne sur une autre**, dans le panneau Scène, la range sous elle. Pour **sortir** un
  objet de son groupe, lâchez-le sur la **première ligne**, celle qui porte le nom de la scène :
  elle représente la racine.

La branche d’accueil **se déplie toute seule** après le dépôt — sinon l’objet qu’on vient de
ranger disparaîtrait de l’écran, et on le croirait perdu.

> **Un groupe ne peut pas descendre dans son propre contenu.** Le studio refuse le dépôt plutôt
> que de fabriquer une boucle. De même, relâcher une ligne là où elle était déjà ne fait rien —
> ni action, ni entrée dans l’historique.

---

## Dupliquer, copier, coller

Quatre boutons en fin de barre d’outils, et les quatre raccourcis que vous connaissez déjà.

| Geste | Raccourci | Ce qu’il fait |
|---|---|---|
| **Dupliquer** | `⌘D` | pose une copie de la sélection au même endroit, et la sélectionne |
| **Copier** | `⌘C` | retient la sélection sans toucher à la scène |
| **Couper** | `⌘X` | la retient et la retire de la scène |
| **Coller** | `⌘V` | pose ce qui a été retenu dans la scène en cours |

Trois choses valent d’être sues :

- **Un groupe se duplique entier**, avec tout ce qui pend dessous. Copier un enfant seul le copie
  seul, et il retrouve son parent — sauf si vous le collez dans une scène qui n’a pas ce parent,
  où il se pose alors à la racine.
- **La copie tombe exactement sur l’original.** Elle est sélectionnée : la déplacer est le geste
  suivant, pas une manœuvre de rattrapage.
- **Ce presse-papiers est celui du studio**, pas celui du système. Copier un objet ne jette pas le
  texte que vous aviez en réserve, et vous pouvez coller dans une autre scène. Il se vide en
  revanche quand vous changez de projet : un objet importé y nomme un asset qui n’existe nulle
  part ailleurs.

---

## Le panneau Scène — l’arbre de la scène

Le panneau **Scène**, dans la colonne de droite, montre tout ce que la scène contient, sous
forme d’arborescence. Il s’appelait l’Explorateur ; celui-ci liste maintenant les documents du
projet, ce qui est une autre question et vaut dans tous les espaces.

- **Cliquez** une ligne pour sélectionner l’objet — avec `⇧`, `⌘` ou `Ctrl` pour en choisir
  plusieurs, exactement comme dans la vue.
- **Les flèches du clavier** parcourent l’arbre.
- **L’œil** à droite de chaque ligne affiche ou masque l’objet.
- **Glissez une ligne sur une autre** pour la ranger dessous ; sur la ligne du haut, celle qui
  porte le nom de la scène, pour la sortir de son groupe.

La sélection est la **même** des deux côtés : ce que vous choisissez dans l’arbre s’entoure de
poignées dans la vue, et réciproquement.

Seules les lignes visibles sont réellement dessinées : une scène lourde défile sans peine.

---

## L’Inspecteur — tout ce qui se règle

Le panneau **Inspecteur**, dans la colonne de droite. Il montre **ce qui est sélectionné**, et
tout ce qui le définit.

Ses champs viennent du **type de l’objet**, pas d’un formulaire écrit pour chacun. Une sphère
montre son rayon, un tore montre son tube, un projecteur montre son angle.

### Pour un objet

| Section | Ce qu’elle contient |
|---|---|
| **Identité** | le nom, modifiable |
| **Transformation** | Position, Rotation, Échelle — trois nombres chacune (X, Y, Z). Un sprite sans enfant, sélectionné seul, n’a pas de ligne Rotation : elle ne se verrait nulle part |
| **Géométrie** | ce qui définit la forme : rayon, largeur, segments… |
| **Matériau** | Couleur, Rugosité, Métallicité, et cinq emplacements de textures |

#### Les champs de géométrie, tous

Vous ne les verrez jamais tous en même temps : chaque forme montre les siens.

| Champ | Ce qu’il règle | Sur quelles formes |
|---|---|---|
| **Largeur**, **Hauteur**, **Profondeur** | les trois côtés d’une boîte | Cube, Plan |
| **Rayon** | la taille d’une forme ronde | Sphère, Cercle, Capsule, Tore, Nœud, polyèdres |
| **Rayon supérieur**, **Rayon inférieur** | les deux bouts d’un cylindre — inégaux, on obtient un cône | Cylindre |
| **Rayon intérieur**, **Rayon extérieur** | le trou et le bord | Anneau |
| **Tube** | l’épaisseur du boudin | Tore, Nœud de tore, Tube |
| **Segments** | le nombre de facettes | la plupart des formes rondes |
| **Segments radiaux** | les facettes tout autour | Cylindre, Capsule, Tore, Tube |
| **Segments tubulaires** | les facettes le long du boudin | Tore, Nœud de tore |
| **Segments en largeur**, **en hauteur** | la finesse dans chaque direction | Sphère, Plan |
| **Segments de calotte** | la finesse des bouts arrondis | Capsule |
| **Enroulements P**, **Enroulements Q** | combien de fois le nœud tourne sur lui-même | Nœud de tore |

**Les segments** méritent un mot : c’est le nombre de facettes qui composent une forme ronde.
Peu de segments = anguleux et léger ; beaucoup = lisse et lourd. 32 est un bon compromis pour
une sphère.

**Enroulements P et Q** sont les deux nombres qui définissent un nœud. P est le nombre de tours
autour de l’axe, Q le nombre de tours à travers le trou. `P=2, Q=3` donne le nœud de trèfle, celui
qu’on voit partout. Changez-en un, vous obtenez un autre nœud — c’est le seul champ du studio dont
on ne peut pas prévoir le résultat sans essayer.

**Rugosité et Métallicité** sont les deux réglages qui font tout l’aspect d’une matière :

| Réglage | À 0 | À 1 |
|---|---|---|
| **Rugosité** | miroir parfait | mat complet |
| **Métallicité** | plastique, bois, pierre | métal |

Les cinq emplacements de textures — **Texture**, **Normales**, **Carte de rugosité**, **Carte de
métallicité**, **Occlusion ambiante** — reçoivent des images du projet. Le bouton **Choisir une
texture** ouvre la liste ; **Retirer la texture** la vide.

### Pour une lumière

| Champ | Ce qu’il fait |
|---|---|
| **Couleur** | la teinte de la lumière |
| **Intensité** | sa puissance |
| **Portée** | jusqu’où elle éclaire — ponctuelle et projecteur |
| **Atténuation** | à quelle vitesse elle faiblit avec la distance |
| **Angle** | l’ouverture du cône — projecteur seulement |
| **Pénombre** | la douceur du bord du cône — projecteur seulement |
| **Cible** | vers quoi elle pointe |
| **Couleur du ciel** / **du sol** | hémisphérique seulement |

### Ombres

Deux interrupteurs, sur chaque objet qui peut en avoir :

| Interrupteur | Ce qu’il fait |
|---|---|
| **Projette une ombre** | l’objet bloque la lumière et pose son ombre sur le reste |
| **Reçoit les ombres** | les ombres des autres se dessinent sur lui |

**Les deux se décident objet par objet**, et c’est voulu : une ombre coûte du calcul à chaque
lumière qui la projette. Un sol reçoit sans projeter ; une petite pièce de décor loin de la
caméra peut ne faire ni l’un ni l’autre sans que cela se voie.

> **La section n’apparaît pas toujours.** Un *sprite* ne joue pas du tout avec les ombres, une
> lumière ambiante ou hémisphérique n’en projette aucune : plutôt que d’afficher un interrupteur
> sans effet, le studio n’affiche rien.

À quoi ressemble une ombre — bord net ou adouci, finesse du calcul — se règle une fois pour toute
la scène dans **Réglages ▸ Espaces de travail ▸ 3D**.

### Environnement — le ciel qui éclaire

**Cette section s’affiche même quand rien n’est sélectionné**, parce qu’elle appartient à la
scène entière et non à un objet.

| Valeur | Ce que ça donne |
|---|---|
| **Studio** *(départ)* | un éclairage neutre, calculé, qui existe avant que vous n’ayez rien généré |
| *une skybox du projet* | le ciel choisi éclaire la scène **et** se reflète dans les matériaux |

C’est le pont entre les deux espaces : un ciel fabriqué dans l’espace **Skyboxes** devient ici la
lumière de votre scène. Un coucher de soleil pose une lumière orange rasante sur tout, sans que
vous ayez à placer une seule lampe.

La liste ne propose que les **skyboxes du projet, présentes sur votre disque**. Un ciel resté
dans le nuage n’y figure pas : il serait choisi, et rien ne s’afficherait.

> L’Inspecteur **n’est pas un panneau de la 3D**. Le même inspecteur lit un clip, une piste ou un
> asset quand c’est cela qui est sélectionné. C’est pourquoi il reste ouvert dans tous les
> espaces.

---

## La grille au sol

Le quadrillage n’est **pas** un objet de la scène : c’est un repère, pour savoir où sont les
choses et à quelle hauteur. Il n’apparaît dans aucun rendu.

**Réglages ▸ Espaces de travail ▸ 3D** :

| Réglage | Ce qu’il fait | Défaut |
|---|---|---|
| **Afficher la grille** | l’affiche ou la cache | activée |
| **Taille de la grille** | son étendue en mètres — un carreau vaut toujours 1 m | 20 |

Cachez-la pour juger une image sans rien autour.

---

## Sortir une scène du studio

**Fichier ▸ Exporter la scène** écrit tout ce que le document contient. **Fichier ▸ Exporter la
sélection** n’écrit que les objets choisis — un groupe emmène ce qui pend dessous.

| Format | Ce que c’est | Quand l’employer |
|---|---|---|
| **glTF binaire (`.glb`)** | un seul fichier, géométries comprises | le choix par défaut, et celui que lisent la plupart des moteurs |
| **glTF (`.gltf`)** | la même chose en JSON, lisible | pour inspecter ou comparer le contenu |
| **USDZ (`.usdz`)** | le format des visionneuses d’Apple | pour ouvrir la scène sur un iPhone ou un Mac |

Une boîte d’enregistrement s’ouvre pour choisir où le fichier va. Son nom est celui du document ;
l’extension suit le format choisi.

**Ce qui ne sort pas.** La grille au sol, le trièdre du coin, les poignées de transformation et les
repères de lumière ne font pas partie de la scène : ce sont des aides d’affichage. Le fichier ne
contient que ce que le panneau Scène liste. Les arêtes du mode « rendu et filaire » n’en sont pas non
plus.

**Un sprite ne sort pas non plus.** Ni en glTF, ni en USDZ : aucun des deux formats n’a d’objet qui
se tourne toujours vers la caméra, et three.js le laisse simplement de côté — sans un mot. En glTF
le fichier garde son nom et sa place, mais rien n’y est dessiné ; en USDZ il n’en reste rien du
tout. Une image plate qui doit survivre à l’export se fait avec un plan et une texture.

**Une sélection imbriquée garde sa place.** Exporter un objet rangé dans un groupe l’écrit là où il
est dans la scène, pas là où il est dans son groupe.

---

## Enregistrer

`⌘S` / `Ctrl+S` écrit la scène dans le projet, sous `documents/`.

**Les scènes 3D savent s’enregistrer** — c’est l’un des deux seuls types de documents qui le
sachent aujourd’hui.

Un onglet dont le travail n’est pas encore écrit porte **un point** (`•`) à côté de son nom. Le
point disparaît à l’enregistrement et revient à la modification suivante.

Rouvrir le studio ramène l’onglet et relit sa scène. Un onglet jamais enregistré revient vide :
rien n’avait été écrit pour lui.

<!-- CAPTURE : la vue 3D avec une maille sélectionnée, l’arbre de scène et le panneau Mailles.
     Vers ../../images/scene-3d.png -->

---

## Animer la scène

La bande du bas de l’espace 3D porte une **timeline**, comme en Vidéo et en Audio — et l’étagère
à assets monte dans la colonne de droite pour lui laisser toute la largeur.

### Ce qu’un modèle apporte déjà

Un personnage généré par Scenario — par un modèle *texte vers mouvement*, ou une capture depuis une
vidéo — arrive avec ses **séquences d’animation** dans le fichier. Sélectionnez-le, et l’Inspecteur
offre la section **Animation** :

| Contrôle | Ce qu’il fait |
|---|---|
| **Séquence** | choisit laquelle jouer, parmi celles que le fichier porte |
| **▶ / ⏸** | lance ou arrête la lecture |
| **Vitesse** | un multiplicateur, de 0,1 à 4 |
| **En boucle** | recommence à la fin, ou s’arrête sur la dernière pose |

**La pose est enregistrée avec le document.** Rouvrir la scène la retrouve là où vous l’avez
laissée, pas au début.

**Un modèle sans séquence n’affiche pas la section** — plutôt qu’un menu vide.

### Voir le squelette

Un modèle rigué porte des **os**. La touche **B**, ou le bouton en forme d’os de la barre d’outils,
les dessine par-dessus la scène. Ils ne se cliquent pas : les os d’un rig traversent chaque maille
qu’ils pilotent, et un clic tomberait sur un trait plutôt que sur le modèle.

### Poser vos propres mouvements

Sélectionnez un objet, puis ajoutez une piste depuis la barre de la timeline : **Position**,
**Rotation** ou **Échelle**. Si l’objet est un modèle rigué, le menu **Os** apparaît à côté : la
piste porte alors sur cet os-là, ce qui est la façon de corriger un bras sans déplacer tout le
personnage.

| Geste | Effet |
|---|---|
| **+ Position / Rotation / Échelle** | ajoute une piste sur l’objet sélectionné |
| **◆** | pose une clé là où est la tête de lecture, ou retire celle qui s’y trouve |
| **●** | **arme** la piste : le gizmo écrit dedans au lieu de déplacer l’objet |
| **🔇 / 🎧 / 🔒** | rend la piste muette, l’écoute seule, la verrouille |
| **🗑** | supprime la piste, avec ses clés |

**Les pistes s’additionnent.** Deux pistes de position sur un même objet ajoutent leurs
déplacements ; deux pistes d’échelle **multiplient** les leurs — deux fois deux font quatre, ce qui
est ce qu’on veut en les empilant. C’est différent d’un montage vidéo, où le clip du dessus cache
celui du dessous.

> **Pourquoi armer une piste.** Comme les pistes s’ajoutent à la pose de l’objet, déplacer un objet
> au gizmo sans piste armée écrit sa **pose de repos** — et les pistes se rajoutent par-dessus à
> l’image suivante, si bien que l’objet revient sous la main. Armez la piste, et le geste devient
> une clé sur elle.

### Sortir une vidéo

Ajoutez une **caméra** à la scène (menu Ajouter → Objet → Caméra). C’est un objet comme un autre :
elle se déplace au gizmo, elle s’anime par une piste, et un export glTF l’emporte avec lui.

Le bouton **Rendre en vidéo** de la timeline écrit un fichier `.mp4` de ce que voit cette caméra,
sur toute la durée de la timeline. Le studio demande **où enregistrer avant de calculer quoi que ce
soit** : un rendu prend des minutes, et une boîte de dialogue à la fin serait le meilleur moyen de
le jeter d’un appui sur Échap.

**Sans caméra dans la scène, le bouton est grisé** : il n’y a rien à travers quoi regarder.

---

## Ce qui manque encore

L’espace 3D a désormais tout ce que ce manuel décrit. Ce qui reste tient en deux phrases : les
polices s’offrent en une seule graisse par famille, et un texte ne se plie pas le long d’une
courbe. Côté animation, les clés s’enchaînent en ligne droite — il n’y a pas encore de courbes
d’accélération —, et une séquence d’un modèle se joue seule, sans fondu vers une autre.

Le détail est dans [Ce qui n’existe pas encore](18-limites.md).

---

[← Espace Image](08-espace-image.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Vidéo →](10-espace-video.md)
