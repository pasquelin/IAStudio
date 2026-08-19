# 9. Espace Modélisation

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
| `↑` `←` `↓` `→` | les mêmes quatre directions |
| `E` | monter |
| `Q` | descendre |
| `⇧ Maj` | accélérer |

On se déplace **à travers** la scène au lieu d’en faire le tour, comme dans un jeu vidéo.
Relâchez le bouton droit, la caméra reprend son mode normal.

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
| **Mode de rendu** | `Z` | fait défiler les neuf façons de dessiner ; le survol les offre une à une |
| **Cadrer la sélection** | `F` | recentre la caméra sur l’objet choisi |

La barre ne porte que ce qui se réclame **sans lâcher la souris**. Le reste est au menu natif :

| Ce qui n’est pas dans la barre | Où le trouver |
|---|---|
| Projection, quatre vues, arêtes de quads, squelettes, mode pose | **Affichage**, en cases à cocher |
| Les six côtés, les neuf modes de rendu | **Affichage ▸ Point de vue** et **▸ Mode de rendu** |
| Ajouter une maille, une lumière, un objet | **Ajouter** |
| Dupliquer, grouper, supprimer | **Édition** |
| Copier, couper, coller | **les touches seules** — voir plus bas |

**Le magnétisme sert à aligner.** Sans lui, un objet se pose à 1,0374 m du précédent ; avec lui,
à 1 m tout rond. La finesse des crans — un pour le déplacement, un pour la rotation, un pour
l’échelle — se règle dans **Réglages ▸ Espaces de travail ▸ 3D**.

**Le repère local se voit sur un objet tourné.** Poignées en repère monde, la flèche rouge pointe
toujours vers l’est. En repère local, elle pointe vers la droite **de l’objet** : c’est ce qu’on
veut pour avancer une voiture dans le sens où elle roule.

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

- le menu **Ajouter**, qui range les trois familles — maille, lumière, objet ;
- les boutons **+** des panneaux **Mailles** et **Lumières** ;
- le glisser-déposer, pour un modèle qui vient de l'étagère.

L’objet se pose à **l’origine de la scène** — le centre du monde, là où les axes se croisent.

### Faire entrer un modèle existant

Les formes ci-dessous sont celles que le studio sait **construire**. Un modèle qui vient
d’ailleurs — généré par un modèle *texte vers 3D*, ou importé depuis un `.glb` — entre par
l’étagère :

| Geste | Résultat |
|---|---|
| **Double-clic** sur une maille dans l’étagère | une **scène à elle** s’ouvre, avec la maille dedans |
| **Glisser-déposer** sur la vue 3D | elle entre dans la scène **ouverte devant vous** — n’importe où sur la vue, la barre d’outils comprise |
| **Clic droit ▸ Ajouter à la scène** | idem, sans viser la vue — il suffit qu’une scène soit ouverte quelque part |

**Le double-clic ne regarde jamais l’onglet en avant** : il ouvre l’asset dans l’espace de son
type, quoi qu’il y ait à l’écran. C’est la règle de tout le studio, décrite dans
[Les assets](07-assets.md) — pour faire entrer une maille dans la scène que vous avez devant vous,
c’est le glisser-déposer ou le clic droit.

**Seules les mailles entrent dans la scène** — mais un lâcher raté n’est pas un lâcher perdu. Une
image, un son ou une vidéo lâchés sur la vue 3D **s’ouvrent dans leur propre espace**, exactement
comme au double-clic. Rien ne l’annonce avant que vous lâchiez : le pointeur montre le même `+`
que pour une maille.

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

Un texte est éclairé comme une maille, et porte la même **matière** : couleur, rugosité, métal,
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

**Ajouter ▸ Objet ▸ Sprite** en pose un à l’origine. Il arrive sans image : choisissez-la dans
l’Inspecteur, section **Sprite**, parmi les images du projet — les mêmes que celles qu’une
matière accepte en texture.

| Réglage | Ce qu’il fait |
|---|---|
| **Couleur** | teinte l’image. Sur un sprite sans image, c’est la couleur du carré lui-même |
| **Opacité** | de transparent à opaque |
| **Texture** | l’image affichée, prise dans les assets du projet |

Quatre choses à savoir :

- **Sa taille est son échelle.** Un sprite n’a pas de largeur propre : on le redimensionne avec la
  poignée d’échelle, comme n’importe quel objet. Il rapetisse avec la distance, comme le reste de
  la scène.
- **Il ne tourne pas.** Sélectionné seul, il n’a ni poignée **Pivoter**, ni ligne **Rotation**
  dans l’Inspecteur. Deux cas le font tourner pour de vrai :
  - **Des objets descendent de lui.** Il retrouve sa poignée et sa ligne : tourner l’ensemble fait
    pivoter les enfants autour de lui.
  - **Il est pris dans une sélection de plusieurs objets, et on tire la poignée.** Elle fait
    tourner le groupe autour d’un pivot commun, ce qui déplace le sprite dans l’espace. **La ligne
    Rotation de l’Inspecteur ne fait pas la même chose** : un angle tapé est **absolu** et
    s’applique à chaque objet autour du sien propre, sans pivot commun — le sprite, lui, ne bouge
    pas. La ligne reste affichée tant qu’un objet de la sélection tourne, et l’angle tapé va sur
    ceux-là.
- **Il ne joue pas avec les ombres.** Il n’en projette pas et n’en reçoit pas ; l’Inspecteur ne
  lui montre donc aucune section Ombres.
- **Il n’est pas éclairé.** Sa couleur est celle qu’on lui donne, pas celle que les lumières de la
  scène en font.

### Le chemin — le rail d’une caméra

Un *chemin* est une courbe posée dans la scène. Il ne se voit pas dans une image rendue : c’est
un rail, le long duquel une caméra peut courir pendant un plan.

**Ajouter ▸ Objet ▸ Chemin** en pose un à l’origine, avec deux points. Ses **poignées** — une
bille par point — n’apparaissent que lorsqu’on travaille dessus : chemin sélectionné, ou caméra
sélectionnée qui l’emprunte pendant un plan. Elles gardent leur taille à l’écran, où que soit la
vue.

Quatre gestes, dans la scène :

| Geste | Ce qu’il fait |
|---|---|
| **Cliquer une poignée**, chemin sélectionné | la choisit : les flèches de déplacement s’y accrochent, et on la déplace comme un objet |
| **⌥ + clic sur la courbe** | pose un nouveau point dans la portion cliquée, et le choisit aussitôt |
| **⌥ ⇧ + clic n’importe où** | **allonge le chemin** : le point se pose au bout, là où l’on vient de viser. C’est le geste qui trace un trajet clic après clic |
| **Suppr**, ou clic droit sur une poignée | retire le point choisi. Un chemin garde toujours ses deux derniers points |

**⌥ ⇧ + clic se pose sur ce qu’on clique** — le sol, un mur, une caisse. Si le rayon ne rencontre
rien, le point se pose **à la hauteur du point précédent**, ce qui garde un trajet à plat quand
on clique dans le vide. Chaque clic est **un `⌘Z`**, donc un trajet se défait point par point.

**Ce qui n’est pas du décor est traversé** : les repères d’atelier — le boîtier d’une caméra,
l’ampoule d’une lampe —, les chemins eux-mêmes avec leurs poignées, et tout objet masqué à l’œil
de l’Explorateur de scène. Une caméra posée sur son propre rail ne fait donc pas obstacle au
geste qui prolonge ce rail.

> **Il faut travailler sur un seul chemin.** Le geste sert le chemin sélectionné, ou celui
> qu’emprunte la caméra sélectionnée. Si deux chemins sont en cours en même temps, il n’allonge
> aucun des deux plutôt que de choisir à votre place. **Et il ne fait alors rien d’autre non
> plus** : `⌥ ⇧` est réservé au traçage, il ne change jamais la sélection en cours de route.

L’Inspecteur, section **Chemin**, règle la **Tension** — de l’angle vif à la courbe ronde — et
**Fermé**, qui referme la boucle sur le premier point. Le **+** de la ligne **Points** ajoute un
point au bout, sans viser dans la vue : le chemin s’allonge dans la direction qu’il prenait. Sur
un chemin **fermé**, qui n’a pas de bout, le point se pose dans la portion qui revient au
premier.

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

### Projection — `O`, ou **Affichage ▸ Projection**

En **perspective**, les fuyantes convergent : c’est ce que voit un œil, et c’est le réglage par
défaut. En **orthographique**, les parallèles restent parallèles et un objet garde sa taille quelle
que soit sa distance.

C’est ce qui permet de juger un alignement. Deux cubes posés côte à côte semblent décalés en
perspective ; en orthographique, ils le sont ou ils ne le sont pas.

La bascule garde ce que vous voyez au centre à la même taille — la caméra se replace pour cela,
et son éloignement change donc au passage.

### Se placer — **Affichage ▸ Point de vue**

**De face**, **de dos**, **de gauche**, **de droite**, **de dessus**, **de dessous**. La caméra va
se poser sur l’axe correspondant, à la distance qu’elle avait déjà, et regarde le point autour
duquel elle tournait.

Combiné à la projection orthographique, c’est la vue de plan classique — celle sur laquelle on
aligne.

### Mode de rendu — `Z`, ou **Affichage ▸ Mode de rendu**

| Mode | Ce qui est dessiné |
|---|---|
| **Rendu** | les surfaces peintes par leur matière, sans les arêtes |
| **Filaire** | les arêtes seules — ce qui montre la densité du maillage |
| **Rendu et filaire** | les surfaces peintes, et les arêtes par-dessus |
| **Solide** | une argile unie sur toutes les surfaces : la forme, sans les matières |
| **Aperçu matière** | les matières sous le seul éclairage du studio, sans les lumières de la scène |
| **Matcap** | un éclairage capté sur une sphère : c’est le relief qui se lit, pas la couleur |
| **Densité** | du vert au rouge selon les triangles par unité de surface : le rouge est à optimiser |
| **Translucide** | les surfaces à peine posées, pour voir les articulations à l’intérieur |
| **Squelette seul** | plus aucune surface — il ne reste que les os, pour les corriger sans rien deviner |

Le bouton porte le mode en cours et le fait défiler à chaque clic ; son menu permet d’en choisir un
directement. `Z` fait la même chose au clavier — **et en quatre vues, sur le
quart où se trouve le pointeur** : chaque quart garde son propre mode.

**Rendu et filaire** est le plus coûteux : les arêtes sont un objet de plus par maille, construit
quand on l’allume et jeté quand on l’éteint. Sur un modèle importé de plusieurs milliers de
mailles, cela se sent.

### Quatre vues — `⇧Q`, ou **Affichage ▸ Quatre vues**

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

**C’est une reconstruction, pas une lecture du fichier** : un GLB ne stocke que des triangles.
Deux triangles dont l’arête commune sépare des faces presque coplanaires sont relus comme un
quad. **Sur une surface très courbée, la reconstruction se trompe** et efface une arête que le
modeleur avait voulue.

---

## Choisir plusieurs objets

**Un clic remplace la sélection. Un clic avec `⇧`, `⌘` ou `Ctrl` l’ajoute ou la retire** —
recliquer un objet déjà choisi le sort de la sélection.

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

**`⌘G`**, ou **Édition ▸ Grouper**.

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

Les quatre raccourcis que vous connaissez déjà. **Dupliquer** a sa ligne dans **Édition** ; les
lignes *Couper*, *Copier* et *Coller* que vous y verrez plus haut **ne sont pas celles de la
scène**.

| Geste | Raccourci | Ce qu’il fait |
|---|---|---|
| **Dupliquer** | `⌘D` | pose une copie de la sélection au même endroit, et la sélectionne |
| **Copier** | `⌘C` | retient la sélection sans toucher à la scène |
| **Couper** | `⌘X` | la retient et la retire de la scène |
| **Coller** | `⌘V` | pose ce qui a été retenu dans la scène en cours |

> **Les lignes du menu Édition agissent sur le TEXTE**, pas sur la scène : elles servent à copier
> un nom qu’on est en train de renommer. Les touches, elles, font la différence — un texte
> sélectionné garde `⌘C`, tout le reste appartient à la scène.

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
forme d’arborescence.

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
| **Matière** | Couleur, Rugosité, Métallicité, et cinq emplacements de textures |

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
| **Couleur du ciel** / **Couleur du sol** | hémisphérique seulement |

### Pour une caméra

Une caméra a **son objectif**, et, dès qu’un plan la couvre, **ce que ce plan lui fait faire**.

| Champ | Ce qu’il règle |
|---|---|
| **Angle de vue** | ce que la caméra embrasse, en degrés. C’est le zoom : petit angle = téléobjectif, grand angle = grand-angle |
| **Distance proche** | en deçà, plus rien n’est dessiné. Jamais zéro — le tri des profondeurs n’aurait plus de marge |
| **Distance lointaine** | au-delà, plus rien n’est dessiné |

Le bouton **Poser cette caméra là où regarde la vue** lui donne la place et la direction de la
vue en cours : cadrez à la souris, cliquez, la caméra y est.

#### Plan caméra

Cette section porte **le plan qui couvre la tête de lecture** : ce qui **déplace** la caméra
pendant ce plan, et ce qu’elle **regarde**. Tant qu’aucun plan ne couvre la tête, elle ne montre
que le bouton **Créer un chemin pour cette caméra** — qui ouvre alors le plan et pose le rail du
même geste.

| Champ | Ce qu’il fait |
|---|---|
| **Chemin** | le rail que la caméra emprunte pendant ce plan. **Aucun** la laisse là où son emplacement et ses clés la mettent |
| **Créer un chemin pour cette caméra** | pose un chemin devant la caméra, dans son axe de visée, et le lie à ce plan. **Un seul `⌘Z` annule les deux** — et si aucun plan ne couvre la tête, le bouton en ouvre un du même geste |
| **Courbe de vitesse** | **Constante**, **Départ doux**, **Arrivée douce**, **Départ et arrivée doux**. Sans elle, un travelling démarre et s’arrête net |
| **Départ sur le chemin** / **Arrivée sur le chemin** | de 0 à 1, la portion de rail réellement parcourue. **Un départ plus grand que l’arrivée fait rouler le rail à l’envers** |
| **Cible** | **Libre** — la caméra regarde là où sa rotation la tourne · **Un point** — elle vise des coordonnées, réglées par **Point visé** · **le nom d’un objet** — elle le suit, même si cet objet est lui-même animé |

**La vitesse est régulière le long du rail**, quelles que soient les distances entre ses points :
à la moitié du plan la caméra a parcouru la moitié de la **longueur** du chemin, pas la moitié de
ses segments.

**Ces réglages vivent sur le PLAN, pas sur la caméra.** La même caméra peut donc faire un
travelling dans un plan et rester fixe dans le suivant, viser la statue ici et la porte là.

### Ombres

Deux interrupteurs, sur chaque objet qui peut en avoir :

| Interrupteur | Ce qu’il fait |
|---|---|
| **Projette une ombre** | l’objet bloque la lumière et pose son ombre sur le reste |
| **Reçoit les ombres** | les ombres des autres se dessinent sur lui |

**Les deux se décident objet par objet**, parce qu’une ombre coûte du calcul à chaque lumière qui
la projette. Un sol reçoit sans projeter ; une petite pièce de décor loin de la caméra peut ne
faire ni l’un ni l’autre sans que cela se voie.

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
| *une skybox du projet* | le ciel choisi éclaire la scène **et** se reflète dans les matières |

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

**Fichier ▸ Exporter ▸ Scène** écrit tout ce que le document contient.
**Fichier ▸ Exporter ▸ Sélection** n’écrit que les objets choisis — un groupe emmène ce qui pend
dessous.

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

**Un sprite ne sort pas non plus**, et sans avertissement : aucun des deux formats n’a d’objet qui
se tourne toujours vers la caméra. En glTF le fichier garde son nom et sa place, mais rien n’y est
dessiné ; en USDZ il n’en reste rien du tout. Une image plate qui doit survivre à l’export se fait
avec un plan et une texture.

**Une sélection imbriquée garde sa place.** Exporter un objet rangé dans un groupe l’écrit là où il
est dans la scène, pas là où il est dans son groupe.

---

## Enregistrer

`⌘S` / `Ctrl+S` écrit la scène dans le projet, sous `documents/`.

**Les scènes 3D savent s’enregistrer**, comme les six autres types de documents.

**Le fichier écrit est un `.gltf`, et c’est un vrai glTF** : un autre logiciel l’ouvre et y trouve
l’arbre de la scène, le nom et la place de chaque objet, les caméras et les lumières
directionnelles, ponctuelles et coniques. Ce que le standard ne porte pas — la forme des
primitives, les matières, les rails, les plans de caméra, l’animation — voyage dans le même
fichier mais **n’est lu que par Scenario**. Rien ne se perd d’un enregistrement à l’autre ; ce qui
s’ouvre ailleurs est plus pauvre que ce que vous voyez ici.

Un onglet dont le travail n’est pas encore écrit porte **un point** (`•`) à côté de son nom. Le
point disparaît à l’enregistrement et revient à la modification suivante.

Rouvrir le studio ramène l’onglet et relit sa scène. Un onglet jamais enregistré revient vide :
rien n’avait été écrit pour lui.

<!-- CAPTURE : la vue 3D avec une maille sélectionnée, l’arbre de scène et le panneau Mailles.
     Vers ../../images/scene-3d.png -->

---

## Animer la scène

La bande du bas de l’espace Modélisation porte une **timeline**, comme en Vidéo et en Audio, sur toute la
largeur de l’écran.

### Ce qu’un modèle apporte déjà

Un personnage généré par Scenario — par un modèle *texte vers mouvement*, ou une capture depuis une
vidéo — arrive avec ses **séquences d’animation** dans le fichier. Sélectionnez-le, et l’Inspecteur
offre la section **Animation** :

| Contrôle | Ce qu’il fait |
|---|---|
| **Clip** | choisit lequel jouer, parmi ceux que le fichier porte |
| **▶ / ⏸** | montre le bloc dans la vue, sur une horloge à lui |
| **Vitesse** | un multiplicateur, de 0,1 à 4 |
| **En boucle** | recommence à la fin, ou s’arrête sur la dernière pose |
| **Transition** | la durée du fondu **aux deux bouts** du bloc, jusqu’à une seconde |
| **Déplacement du personnage** | si ce mouvement emmène le personnage, ou le fait marcher sur place — **Automatique**, **Sur place**, **Celui de l’animation** |
| **Pilote** | quelle moitié du corps ce bloc anime — **Tout le corps**, **Le haut du corps**, **Le bas du corps** |

**Ces sept contrôles portent sur LE BLOC CHOISI sur la bande** : appuyez sur un bloc pour le
choisir, et la section bascule dessus — tant que vous n’en avez choisi aucun, c’est le premier.
Un modèle qui porte plusieurs blocs se règle donc bloc par bloc : la vitesse et la boucle
s’écrivent dans celui que vous regardez, et les autres ne bougent pas.

> **Le ▶ de l’Inspecteur ne déplace pas la tête de lecture.** Regarder une animation est un coup
> d’œil sur un bloc, pas un déplacement de l’horloge de la scène : le bloc tourne dans la vue, la
> bande reste où vous l’avez laissée. **Les deux ne marchent jamais ensemble** — lancer la
> timeline coupe l’aperçu, déplacer la tête aussi, et lancer l’aperçu met la timeline en pause.

**La position de la tête n’est pas enregistrée** : rouvrir la scène la remet au début. Ce qui est
enregistré, ce sont les blocs — leur place sur la bande, leur vitesse, leur boucle, leur transition,
leur déplacement et ce qu’ils pilotent.

**Un seul curseur pour les deux bouts, et c’est délibéré** : ce que *Transition* règle est la façon
dont ce mouvement **rejoint ses voisins**, et un bloc dont les deux bouts fondraient sur des durées
différentes ne décrirait rien de tel. Le fondu vaut zéro par défaut, et une seconde au maximum.

**Le *Déplacement du personnage* règle une seule question : ce mouvement fait-il avancer le
personnage sur le sol ?** Une marche enregistrée le fait ; posée telle quelle sur un objet que la
bande emmène déjà d’un point à un autre, le personnage couvre le terrain **deux fois** et arrive
au-delà.

| Valeur | Ce qu’elle fait |
|---|---|
| **Automatique** | le bloc emmène le personnage, **sauf** si une trajectoire de la bande le déplace déjà. C’est le réglage qui évite le double déplacement, et le défaut |
| **Sur place** | le mouvement n’avance jamais : il est joué sur place |
| **Celui de l’animation** | le déplacement du fichier est toujours utilisé, trajectoire ou pas |

> **« Sur place » ne cloue pas le personnage au sol** : seul le déplacement **horizontal** est
> retiré. La hauteur des hanches et leur rebond restent, sans quoi une marche s’enfoncerait dans le
> sol ou glisserait au lieu de marcher.

> **Ce qui compte comme trajectoire, ce sont DEUX clés de position au moins** sur l’objet lui-même.
> Une clé isolée place le personnage, elle ne le déplace pas, et *Automatique* laisse alors le
> mouvement l’emmener.

> **Une trajectoire rendue muette compte quand même.** *Automatique* regarde si ces clés
> **existent**, pas si elles jouent : rendre une trajectoire muette arrête le personnage, ça ne
> rend pas la main au mouvement pour l’envoyer marcher tout seul.

**Un modèle sans séquence garde la section**, qui dit alors ce qui lui manque — qu’il ne porte pas
encore de squelette, ou qu’il en porte un que le studio ne reconnaît pas. Le menu, lui, ne
s’affiche que s’il y a quelque chose à choisir.

**Une séquence se voit aussi sur la bande du bas**, posée en bloc à sa longueur réelle, et c’est
**le bloc** qui porte le nom du clip. La ligne qui l’accueille est une **sous-piste**, appelée
**Anim. 1**, **Anim. 2**, et ainsi de suite. Les sous-pistes sont groupées **sous** les lignes de
clés, jamais mêlées à elles.

**Une séquence que son fichier ne nomme pas s’appelle « Animation » à l’écran**, ou
**Animation 1**, **Animation 2** — et partout où le studio la nomme : le menu **Clip**, le bloc sur
la bande, le panneau Animations et le volet d’ajout. C’est le cas le plus courant : un export Tripo
appelle son unique séquence `NlaTrack` — le nom que Blender donne par défaut à une piste qu’on n’a
pas nommée — et un export Uthana n’en nomme aucune, ce qui les fait numéroter à l’ouverture.

**Le numéro n’est pas un rang recompté** : c’est celui que le fichier porte déjà. Si des séquences
nommées sont mêlées aux autres, **la numérotation saute** — « Animation 1 », « Marche »,
« Animation 3 ».

> **Le fichier, lui, garde son mot.** Ce remplacement ne vit qu’à l’écran : ouvrez la scène
> ailleurs, `NlaTrack` est toujours là. C’est délibéré — écrire « Animation » dans le document
> figerait la langue du jour où il a été enregistré, et un fichier français resterait français pour
> un lecteur anglophone.

**Tout autre nom est laissé intact** : le studio ne remplace que ces deux écritures-là, à la
lettre. Une séquence que quelqu’un aurait vraiment appelée `NlaTrack` serait donc renommée elle
aussi — rien ne permet de l’en distinguer.

> **Une animation LIVRÉE ne suit pas cette règle** : elle porte le nom de son dossier, quoi que son
> fichier écrive. C’est un autre mécanisme, décrit plus bas.

### Rendre un modèle animable

Un modèle importé n’a le plus souvent aucun squelette : c’est une **maille**, et rien ne peut
l’animer. **La section Animation est là quand même**, et c’est elle qui le dit — « Ce modèle n’est
pas encore animable. » Une seconde section, **Squelette**, porte alors le bouton **Rendre
animable**.

**Cette seconde section ne s’affiche pas toujours, et c’est voulu** : un modèle qui arrive avec son
propre squelette n’en reçoit pas un second, et un modèle encore en cours de chargement n’a rien à
mesurer.

**Deux formes sont refusées avant tout clic**, parce que le studio pose son squelette d’après
l’encombrement du modèle : « Ce modèle est trop plat pour recevoir un squelette. » et « Ce modèle
est couché. Redressez-le avant de le rendre animable. » Dans le second cas, redressez-le et le
bouton revient.

Le bouton ouvre un petit volet, à côté de lui, avec deux réglages.

| Réglage | Ce qu’il propose |
|---|---|
| **Type de personnage** | **Automatique**, **Humain**, **Animal**, **Autre** |
| **Service** | **Automatique — le studio**, puis les services Scenario qui savent le faire |

**Le studio ne pose qu’un squelette HUMANOÏDE** — hanches, colonne, deux bras, deux jambes. Choisir
**Animal** ou **Autre** affiche la raison et **grise Créer le squelette** : mieux vaut le dire que
poser des hanches sur un cheval et vous laisser le découvrir.

> **Les services Scenario sont listés, et aucun n’est choisissable aujourd’hui.** Chacun porte la
> raison qui l’en empêche — l’abonnement qui manque, la taille du modèle, ou qu’il n’est **pas
> encore branché**. Le studio, lui, le fait **lui-même et gratuitement**, sans limite de taille :
> c’est le sens d’« Automatique — le studio », et c’est ce que **Créer le squelette** lance.

**Ce que ça change, une fois créé** : une barre **Préparation du personnage** pendant le calcul,
puis « Ce modèle a reçu un squelette. » La section Animation cesse de dire qu’il n’est pas
animable — « Ce personnage est prêt à être animé. » — et le **mode pose** attrape enfin ses os, qui
n’existaient pas avant.

### Ajouter une animation

La section **Animation** ouvre elle-même de quoi en choisir une : le lien **Ajouter une animation**
déroule un volet sous lui, avec trois onglets.

| Onglet | Ce qu’il offre |
|---|---|
| **Bibliothèque** | tout ce qui est déjà sous la main, en une seule liste : les séquences que le fichier du personnage porte, celles livrées avec le studio, et les animations rangées dans le projet |
| **Import** | un fichier pris sur le disque — `.glb`, `.gltf`, `.fbx` |
| **IA** | les modèles Scenario qui **fabriquent** un mouvement |

**L’onglet Bibliothèque n’est pas le panneau *Animations*** décrit plus bas, et les deux listes ne
se valent pas : l’onglet compte une source de plus — les animations rangées dans le projet — et il
**pose** ce qu’on choisit, là où le panneau se glisse sur la bande.

**Choisir une ligne POSE le bloc, ce n’est pas une répétition.** Le mouvement est écrit sur le vrai
personnage, transposé comme il le sera, et il se met à jouer aussitôt : ce que vous regardez **est**
le résultat, il n’y a pas d’aperçu qui pourrait en différer. Continuer à parcourir remplace le bloc
posé par le suivant — il n’en reste jamais deux.

**Deux boutons pour sortir.** **Garder** laisse le bloc où il est et referme le volet : garder,
c’est ne rien faire de plus. **Annuler** le reprend, et la scène revient où elle était.

**Le volet se ferme aussi tout seul, et ce qu’il advient du bloc dépend de la raison.** Cliquer
hors du volet ou appuyer sur `Échap` sont des façons de le FERMER : le bloc est repris, comme avec
Annuler. **Passer à une autre application n’en est pas une** — le studio referme le volet en
**gardant** le bloc, exactement comme si vous aviez appuyé sur Garder, plutôt que de le reprendre
pendant que vous regardez ailleurs.

**Sous la liste, l’aperçu porte ses propres contrôles** : *Revenir au début*, *Jouer l’aperçu*,
*Aller à la fin*, puis **Position**, **Vitesse** et **En boucle** — ces deux derniers étant les
réglages de la section, écrits dans le bloc que vous venez de poser. Comme le ▶ de l’Inspecteur,
cet aperçu tourne sur une horloge à lui et ne déplace pas la tête de lecture.

**Position TIENT la pose où vous la laissez**, au lieu de tout ramener au début : c’est ce qui
permet de juger une pose plutôt qu’un mouvement, et la lecture repart ensuite de là. *Aller à la
fin* montre la dernière pose du mouvement — celle qui compte pour enchaîner sur le bloc suivant.

**Le volet dit ensuite si le mouvement va au squelette**, en une ligne : « Le personnage sait jouer
ce mouvement. », ou bien qu’il ne lui va pas parfaitement. **Aucun nom d’os n’est affiché
d’emblée** — *Voir les articulations concernées* ouvre la liste, et ce sont des **rôles**, jamais
des noms d’os : deux squelettes ne partagent que ce vocabulaire-là. Chaque ligne dit ce qui arrive à
l’articulation — « reste au repos » pour une articulation de votre personnage que le mouvement
n’anime pas, « non reprise » pour une articulation du mouvement que votre personnage n’a pas.

> **Une séquence venue du fichier du personnage ne dit rien de tout cela**, et c’est normal : elle
> parle déjà son squelette, il n’y a eu aucune transposition à juger.

**Un fichier importé reste où il est** — le studio le référence, il ne le recopie pas, comme tout
import. Un fichier qui ne porte aucun mouvement est refusé sur place, avec sa raison, plutôt que de
ne rien faire.

**L’onglet IA ne fait aujourd’hui que LISTER**, et il le dit : aucune génération ne s’y lance
encore. Chaque ligne porte la raison qui l’en empêche — l’abonnement qui manque, ou « Pas encore
branché ». Quand le catalogue n’offre aucun service de mouvement, l’onglet le dit aussi.

### La bibliothèque d’animations

Le panneau **Animations**, dans la colonne de droite, liste **ce qu’un personnage peut jouer** :
d’abord les séquences que le fichier du modèle sélectionné porte, puis celles livrées avec le
studio. Les deux sources se suivent dans une seule liste, et se glissent de la même façon.

**Une ligne se glisse sur une sous-piste de la bande, et c’est ce qui y pose un bloc.** Il commence
là où vous lâchez, cadré sur l’image la plus proche, et prend la longueur réelle du fichier. Il est
choisi aussitôt : l’Inspecteur décrit alors ce que vous venez de poser.

> **Seule une sous-piste accepte un dépôt.** Une ligne de clés porte des clés, la ligne d’un objet
> est l’objet lui-même, et la règle du haut n’est pas une piste : lâcher sur l’une des trois ne
> fait rien.

**Chaque ligne porte aussi un ▶ — *Jouer sur le personnage*** — et c’est le moyen d’essayer une
animation sans viser une sous-piste. **Il pose un VRAI bloc** sur le personnage sélectionné, avec
les mêmes réglages de départ qu’un glisser, et le joue aussitôt. **Il le pose au DÉBUT de la
première sous-piste**, là où le glisser vous laisse choisir la ligne et l’endroit.

> **Ce n’est pas le ▶ de l’Inspecteur**, qui regarde un bloc **déjà posé** sans jamais rien écrire.
> Celui-ci pose le bloc lui-même, et peut le reprendre.

**Un second appui l’arrête ET retire le bloc** : le bouton le dit, *Arrêter et retirer le bloc*.
Appuyer sur le ▶ d’une **autre** ligne retire d’abord **celui qui joue** — jamais deux aperçus à la
fois.

> **Ce qui reste dépend de la façon dont ça s’est arrêté**, et c’est la seule subtilité de ce
> bouton. Arrêté par vous, le bloc s’en va. **Interrompu par la tête de lecture — parce que vous
> avez lancé la bande ou déplacé la tête — le bloc RESTE**, posé sur le personnage. Ce n’est pas un
> accident : c’est ce qui transforme un essai concluant en travail gardé. **Et plus rien ne le
> reprend** : le ▶ suivant pose son essai EN PLUS, au même endroit.

**L’aperçu ne montre jamais que le dernier essai, seul.** C’est la BANDE qui, ensuite, partage la
pose entre les blocs qui se recouvrent sous la tête de lecture : deux essais empilés au même
endroit se moyennent, et le personnage fait les deux à moitié. Écartez-les sur la sous-piste — un
bloc se glisse à la souris — pour les voir l’un après l’autre.

**Le ▶ est éteint tant qu’aucun modèle n’est sélectionné dans la scène** : il n’y a alors rien sur
quoi jouer un mouvement. **Un modèle suffit — il n’a pas besoin d’être déjà animable** ; ce qu’il
sait vraiment jouer, la section Animation le dira. La liste, elle, reste affichée.

**Une animation livrée est rejouée sur le squelette de VOTRE personnage** — elle a été montée pour
un autre, et le studio la transpose. Le personnage qui la portait n’entre pas dans la scène.

**Une animation livrée porte le nom de son DOSSIER**, jamais celui écrit dans le fichier — un
export Tripo appelle son unique séquence `NlaTrack`, un export Uthana n’en nomme aucune. Une
vignette s’affiche si le dossier en porte une, sinon une marque générique. Un dossier vaut **une**
animation : si son fichier en épelle plusieurs, c’est la première qui est jouée.

**Le studio peut être livré sans aucune animation.** Quand ni le modèle sélectionné ni le dossier
livré n’ont rien à offrir, le panneau le dit : « Aucune animation. Sélectionnez un personnage, ou
installez des animations dans le dossier de l’application. » Ce dossier est commun à tous les
projets, et il se met à jour en mettant le studio à jour.

### Superposer deux animations

**Deux blocs ne se superposent pas sur une même sous-piste.** Là où ils se chevauchent, ils se
partagent le personnage à parts égales, et la pose obtenue est leur moyenne — c’est-à-dire ni
l’un ni l’autre. Posez-les **bout à bout** pour les enchaîner : hors de son bloc, un mouvement
tient sa pose de bord, et c’est le suivant qui prend la main.

**Pour les jouer ensemble, donnez-leur chacun une ligne.** Le bouton **+** de la dernière
sous-piste — *Ajouter une sous-piste* — en ouvre une en dessous, et une sous-piste restée seule ne
se supprime pas : c’est elle qui reçoit ce qu’on dépose sur l’objet. Leur ordre se change en
glissant leur en-tête, et **il ne change que l’endroit où elles sont dessinées** — contrairement
aux plans de caméra, aucune sous-piste ne passe devant une autre.

**C’est là que *Pilote* sert.** Deux blocs réglés sur **Tout le corps** n’ont rien de plus à donner
que leur moyenne, même sur deux lignes : ils se disputent les mêmes os. Réglez l’un sur **Le haut
du corps** et l’autre sur **Le bas du corps**, et chacun garde sa moitié entière — marcher *et*
lever les bras devient les deux à la fois, au lieu d’un demi-pas les bras à mi-hauteur.

> **Les hanches vont avec les jambes**, et c’est délibéré : elles portent le placement du
> personnage, donc un bloc du haut du corps l’emmènerait ailleurs que là où ses jambes l’ont posé.

> **Les moitiés se lisent sur le squelette, pas sur le fichier.** Un os qui ne remplit aucun rôle
> reconnu suit le membre auquel il pend — un os de torsion, un doigt que personne n’a nommé, une
> queue. Et quand rien au-dessus de lui n’est reconnu non plus, il part avec le bas du corps : sur
> un modèle dont la section annonce **un squelette dont aucune articulation n’est reconnue**, ne
> comptez pas sur les moitiés et laissez les blocs sur **Tout le corps**.

### Modifier un bloc posé

**Un bloc choisi répond à trois gestes**, et le clic droit sur le bloc les porte tous les trois —
sans ce menu, aucun ne se découvrirait.

| Geste | Touche | Ce qu’il fait |
|---|---|---|
| **Dupliquer** | `⌘D` | pose une copie du bloc **juste après lui**, bout à bout |
| **Couper le bloc** | `S` | coupe le bloc en deux là où se trouve la tête de lecture |
| **Supprimer** | `Suppr` | retire le bloc de la bande. **L’animation elle-même n’est pas touchée** |

**La coupe ne pose aucun fondu au joint**, exactement comme celle du montage : les deux moitiés se
lisent comme un seul mouvement, et une rampe au milieu ferait fondre la pose là où il ne se passe
rien. La seconde moitié reprend le mouvement là où la première s’arrête.

**Couper reste grisé tant que la tête de lecture n’est pas STRICTEMENT à l’intérieur du bloc** :
posée sur l’un de ses deux bords, elle ne le couperait en rien. Le menu garde l’entrée grisée
plutôt que de la retirer — une liste dont la longueur suit la tête de lecture ne s’apprend pas.

> **Ces trois touches n’appartiennent à aucun contexte de l’écran des raccourcis**, et ne s’y
> changent donc pas : elles sont liées à la bande, qui doit avoir le focus. **Les deux mêmes
> touches font autre chose dans la vue 3D** — `S` y redimensionne, `⌘D` y duplique l’objet
> sélectionné — et c’est la surface qui a le focus qui tranche. Le clic droit reste le chemin sûr.
> Voir [Les raccourcis clavier](15-raccourcis.md).

### Voir le squelette

Un modèle à squelette porte des **os**. La touche **B**, ou **Affichage ▸ Afficher les squelettes**,
les dessine par-dessus la scène. La ligne est cochée tant qu'ils sont visibles.

**Pour en attraper un, passez en mode pose** — touche **P**, ou **Affichage ▸ Mode pose**. Le clic
cesse alors de choisir des objets et choisit des os.

> **Le studio prend l’os le plus proche du pointeur à l’écran**, qu’il soit devant ou derrière une
> épaule. Visez donc **l’articulation elle-même** plutôt que le membre qu’elle pilote.

### Retoucher un squelette

**Un os choisi en mode pose ouvre ses réglages dans la section Squelette** — et il doit appartenir
au modèle que l’Inspecteur décrit. Tant qu’aucun os n’est choisi, la section garde l’état du
personnage, **Ajouter les mains** s’il a quelque chose à faire, et **Retirer le squelette**.

| Réglage ou bouton | Ce qu’il fait |
|---|---|
| **Nom** | renomme l’os choisi. Un nom déjà pris est refusé, et rien ne change |
| **Articulation** | quel rôle cet os tient dans un corps humain — ou **Aucune** |
| **Ajouter un os enfant** | pose un os sous celui qui est choisi, exactement à sa place |
| **Retirer cet os** | retire l’os choisi du squelette |
| **Ajouter une poignée à suivre** | donne à cette articulation une poignée qu’elle cherche à atteindre |
| **Ajouter les mains** | pose des doigts sur les mains d’un personnage qui n’en a pas |
| **Retirer le squelette** | rend le modèle à son état de maille |

**Renommer sert plus qu’on ne croit** : un squelette arrive avec les noms de son fichier, et
`mixamorigHips` n’est le choix de personne. Le nom est celui que vous lirez ensuite partout.

***Articulation* est ce qui rend un mouvement transposable.** C’est par ces rôles — et non par les
noms — que le studio fait jouer à votre personnage une animation montée pour un autre : deux
squelettes ne partagent que ce vocabulaire. Un os qui n’en tient aucun reste sur **Aucune** et ne
gêne rien.

> **Les rôles sont écrits en anglais et ne sont pas traduits** : c’est la liste que se partagent
> les logiciels d’animation, et la traduire ici la rendrait introuvable ailleurs.

**Une poignée à suivre pose un pied au sol ou une main sur une prise.** L’articulation cherche à
l’atteindre, et **les os au-dessus d’elle tournent pour suivre — deux au plus** : le parent et le
grand-parent. C’est ce qui distingue un pied qui reste posé d’un pied qui traverse le sol quand la
hanche bouge. Le bouton devient **Retirer la poignée** pour une articulation qui en a déjà une.

> **Ce n’est pas la poignée d’un gizmo**, ni celle qui rogne un clip : celle-ci est un point que
> l’articulation VISE, et elle reste posée dans la scène.

> **Sur un os qui n’a rien au-dessus de lui, le bouton ne fait rien** — les hanches, par exemple,
> n’ont aucun ancêtre à faire tourner. Un os dont le parent est déjà la racine n’en fait suivre
> qu’un.

**Ajouter les mains n’apparaît que là où il a quelque chose à faire** : il faut une main et un
avant-bras reconnus, et **une main qui porte déjà un pouce est laissée intacte**. **La condition se
juge côté par côté** — si une seule main la remplit, le bouton apparaît et ne pose des doigts que
de ce côté-là, sans rien dire de l’autre.

**Un os ajouté naît sous son parent, au même endroit que lui**, et porte son nom suivi d’un
numéro. C’est le gizmo qui le met où il doit aller.

> **Retirer le squelette n’efface pas les animations posées.** Le modèle redevient une maille, mais
> les blocs et les clés qui visaient ses os restent dans le document — sans os pour les porter,
> donc sans effet. `⌘Z` ramène le squelette et tout se rattache ; sinon, retirez les blocs
> vous-même.

### Poser vos propres mouvements

**Vos objets sont déjà dans la bande.** Chaque objet de la scène y a sa ligne : il n’y a rien à
créer, et aucun bouton pour cela.

Placez la tête de lecture, puis **posez une clé sur la ligne de l’objet**. Les trois propriétés
animées — Position, Rotation, Échelle — naissent à ce moment-là, ensemble, et en **une seule
annulation**. Si l’objet est un modèle à squelette, le menu **Os** apparaît dans la barre : il s’ouvre
sur **Le modèle entier**, et choisir un os fait porter les clés sur lui seul, ce qui est la façon
de corriger un bras sans déplacer tout le personnage.

**La bande se lit par objet.** Une ligne par objet — ou par os — et ses propriétés
animées **repliées dessous**. La ligne repliée montre toutes les clés de l’objet, celles de ses
trois propriétés confondues ; la déplier les sépare. **Replier ne perd jamais une clé**, cela ne
change que ce qui est montré.

| Contrôle de la barre | Ce qu’il fait |
|---|---|
| **Revenir au début** | ramène la tête de lecture à zéro |
| **Lire** / **Mettre en pause** | joue la timeline |
| **Enregistrement automatique** | bouger un objet **pose une clé** au lieu de déplacer sa pose de repos |
| **Durée** et **Images/s** | la longueur de la timeline, et sa cadence |
| **Os** | sur un modèle à squelette : l’os que la prochaine clé animera, ou **Le modèle entier**. Un os **cliqué dans la vue** en mode pose l’emporte sur ce choix |
| **Poser une clé sur tout ce qui est animé** | le même geste, sur tout ce qui est **déjà** animé — grisé tant que rien ne l’est |
| **Rendre en vidéo** | voir plus bas — grisé tant qu’aucune caméra n’est dans la scène |

**Chaque ligne porte les siens**, à gauche de la bande :

| Sur l’en-tête d’une ligne | Ce qu’il fait |
|---|---|
| le chevron | **Afficher ou masquer les propriétés animées** |
| **Poser une clé sur *(le nom)*** | enregistre le déplacement fait depuis, sur toutes les propriétés de cet objet. **Le même bouton bascule** : là où une clé se tient déjà, il s’allume et devient **Retirer la clé de *(le nom)*** |
| **Rendre muette** / **Écouter seule** / **Verrouiller** | les trois interrupteurs d’une ligne, les mêmes qu’en Vidéo |
| **Supprimer la piste *(le nom)*** | sur une ligne de propriété, la retire avec ses clés |

**La tête de lecture s’attrape et se déplace** sur la règle graduée, et **les clés se déplacent**
sur leur ligne. **Au-delà de la durée, la bande est assombrie** : la tête ne va pas plus loin, et aucune clé ne
s’y pose — un bloc de clip, lui, s’y dépose encore.

**Une clé se retire de deux façons.** Le losange de l’en-tête, pressé là où une clé se tient sous
la tête de lecture, la retire de **toutes les propriétés qui en portent une à cet instant** — d’un
seul coup, comme il les avait posées, et `⌘Z` les fait toutes revenir ensemble. Sur la bande,
**cliquez une clé pour la choisir, puis `Suppr` ou `Retour arrière`** : elle part de la ligne où
elle est, et c’est **la ligne qui décide de la portée**, jamais son pliage — celle d’un objet
emporte toutes ses propriétés, celle d’une propriété dépliée n’emporte qu’elle. **Une ligne
verrouillée garde la sienne** — le verrou protège du retrait comme il protège de la pose.

**Lire quand la tête est déjà au bout rembobine** au lieu de s’arrêter sur l’image où l’on est.

**L’animation compose avec la pose de l’objet, elle ne la remplace pas** — et pas de la même
façon selon la propriété : les déplacements **s’ajoutent**, les échelles se **multiplient**.
C’est l’inverse d’un montage vidéo, où le clip du dessus cache celui du dessous.

> **Pour empiler deux fois la même propriété sur un objet, verrouillez ses lignes** : la clé
> suivante en ouvre de nouvelles par-dessus. Deux positions de 2 et 3 donnent 5 ; deux échelles
> qui doublent chacune donnent **quatre fois** la taille.

> **Un objet DÉJÀ animé enregistre de lui-même, quoi que dise l’interrupteur.** Une fois qu’il
> porte une clé, le bouger édite son animation. L’interrupteur ne décide donc que d’une chose :
> si un objet **pas encore animé** se met à l’être — et la distinction porte sur les **clés**,
> pas sur les lignes : des propriétés ouvertes et vides ne sont pas encore une animation, et
> l’interrupteur y garde son mot.
>
> **Un os sans clé est un cas à part** : n’ayant pas de pose de repos où retomber, le geste est
> abandonné et l’os revient où il était.

### Poser les clés à la main

L’enregistrement automatique n’est pas obligatoire. Le geste, dans l’ordre :

1. **posez une clé** au départ, sur la ligne de l’objet — elle ouvre ses trois propriétés (une
   caméra en a une quatrième, son **angle de vue**) et retient la pose où il se tient à cet
   instant, contre laquelle toutes ses clés se mesureront ;
2. **déplacez la tête** sur la règle ;
3. **déplacez l’objet**, puis **posez une clé** à nouveau.

> **Les chiffres de l’Inspecteur reviennent à la pose de référence, pas l’objet à l’écran.** La
> clé retient le déplacement, et la position enregistrée repart de la référence. Dans la vue,
> **rien ne bouge** : ce que vous voyez est la référence plus la clé, donc l’endroit où vous venez
> de poser l’objet.

**Un os ne travaille pas ainsi** : ses propriétés n’ont pas de pose de référence, donc y poser une
clé **fige ce qu’elles tiennent déjà** et rien ne revient en place. Pour animer un os, passez par
l’enregistrement automatique et le mode pose plutôt que par ces trois étapes.

### Sortir une vidéo

Ajoutez une **caméra** à la scène (menu Ajouter → Objet → Caméra). C’est un objet comme un autre :
elle se déplace au gizmo, elle s’anime comme n’importe quel objet, et un export glTF l’emporte
avec lui.

#### L’aperçu — voir ce que la caméra filme

**Choisissez une caméra, et un encart s’ouvre en haut à droite de la vue** : ce qu’elle voit, à
l’instant où se tient la tête de lecture, au format d’une vidéo. En haut, son nom. Il se referme
en désélectionnant la caméra.

Ce n’est pas une vue de travail mais une **image de rendu** : ni grille, ni poignées, ni
squelettes, ni repères de lumières ou de caméras — exactement ce que le fichier vidéo contiendra.

| Geste | Ce qu’il fait |
|---|---|
| **Glisser l’encart** | le déplace dans la vue, s’il gêne |
| **Agrandir l’aperçu à toute la vue** | l’encart prend toute la surface. Le même bouton, devenu **Remettre l’aperçu dans son coin**, le renvoie d’où il vient |

**La pastille « À l’antenne »** s’allume quand la caméra choisie est aussi celle que le montage
désigne à cet instant. C’est la seule chose qui distingue les deux : **l’aperçu suit ce que vous
avez sélectionné**, le montage et le rendu suivent ce que les plans décident — voir plus bas.

**Une scène peut en porter plusieurs et changer de caméra en cours de route.** C’est le rôle des
**plans**, posés sur la bande du bas :

1. **choisissez la caméra** dans la scène ou dans l’arbre ;
2. **placez la tête de lecture** là où le plan doit commencer ;
3. **Mettre cette caméra à l’antenne**, dans la barre de la timeline. Le plan s’ouvre à partir de
   la tête, sur **trois secondes** — ou ce qui reste de la bande, si c’est moins.

Un plan se **glisse** et se **rogne** ensuite comme un clip de montage. Chaque caméra a **sa
ligne**, et **l’ordre de ces lignes fait la loi** : là où deux plans se recouvrent, c’est la ligne
la plus haute qui passe à l’antenne. Glissez un en-tête de ligne pour la changer de rang — cela
modifie le document, et `⌘Z` le rend.

> **Sans aucun plan, rien n’est perdu** : c’est la première caméra de la scène qui filme, sur toute
> la durée. Et **supprimer une caméra ne troue pas le film** — ses plans sont sautés plutôt que
> rendus en noir, et annuler la suppression les ramène entiers.

**L’angle de vue s’anime comme le reste**, et c’est le zoom d’un plan. Posez une clé sur la ligne
de la caméra — elle ouvre l’**angle de vue** avec les trois autres propriétés —, puis réglez ce
champ dans l’Inspecteur : avec l’**enregistrement automatique**, chaque réglage devient une clé à
la tête plutôt qu’un changement d’objectif. Une caméra **déjà animée** enregistre même sans, comme
un objet déjà animé le fait d’un déplacement. Le champ affiche alors ce que l’objectif lit **à
l’instant où se tient la tête**, clés comprises.

Le bouton **Rendre en vidéo** de la timeline écrit un fichier `.mp4` sur toute la durée, chaque
image prise par la caméra que le montage désigne à cet instant. Le studio demande **où enregistrer
avant de calculer quoi que ce soit** — un rendu prend des minutes.

**Sans caméra dans la scène, le bouton est grisé** : il n’y a rien à travers quoi regarder.

---

## Ce qui manque encore

L’espace Modélisation a désormais tout ce que ce manuel décrit. Ce qui reste tient en deux phrases : les
polices s’offrent en une seule graisse par famille, et un texte ne se plie pas le long d’une
courbe. Côté animation, **les clés** s’enchaînent en ligne droite — il n’y a pas encore de courbes
d’accélération pour elles, la **Courbe de vitesse** d’un plan caméra étant la seule du studio —, et
une séquence d’un modèle se joue seule, sans fondu vers une autre.

Le détail est dans [Ce qui n’existe pas encore](18-limites.md).

---

[← Espace Image](08-espace-image.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Vidéo →](10-espace-video.md)
