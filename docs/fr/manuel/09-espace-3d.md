# 9. Espace 3D

[← Espace Image](08-espace-image.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Vidéo →](10-espace-video.md)

L'espace où l'on construit une scène en volume : des objets, des lumières, une caméra qui s'y
promène.

---

## Ouvrir une scène

Le bouton **+** du rail gauche crée une scène neuve. Un projet doit être ouvert.

Une scène neuve contient un sol quadrillé — la **grille** — et rien d'autre. Elle est noire tant
qu'aucune lumière n'y est posée : c'est normal, et le panneau Lumières le dit.

---

## Se déplacer dans la scène

Deux modes de navigation, qui coexistent.

### Tourner autour de la scène — la souris seule

| Geste | Effet |
|---|---|
| **Clic gauche + glisser** dans le vide | fait tourner la vue autour du point regardé |
| **Molette** | avance et recule |
| **Clic droit + glisser** *(voir ci-dessous)* | fait voler |

C'est le mode par défaut. On tourne **autour** de la scène, comme si on en faisait le tour.

### Voler dans la scène — le clic droit

**Maintenez le bouton droit de la souris**, et la caméra passe en vol libre. Sans lâcher :

| Touche | Mouvement |
|---|---|
| `W` `A` `S` `D` | avancer, gauche, reculer, droite |
| `E` | monter |
| `Q` | descendre |
| `⇧ Maj` | accélérer |

C'est la navigation des logiciels de jeu vidéo : on se déplace **à travers** la scène au lieu
d'en faire le tour. Relâchez le bouton droit, la caméra reprend son mode normal.

> **Les touches sont lues à leur position physique.** WASD sur un clavier QWERTY et ZQSD sur un
> clavier AZERTY sont **les mêmes quatre touches**. Il n'y a rien à reconfigurer.

Trois réglages gouvernent le vol : **Réglages ▸ Espaces de travail ▸ 3D**

| Réglage | Ce qu'il fait | Défaut |
|---|---|---|
| **Vitesse de déplacement** | mètres par seconde | 4 |
| **Accélération** | par combien Maj multiplie la vitesse | 3 |
| **Angle de vue** | ce que la caméra embrasse, en degrés | 60 |

---

## La barre d'outils

| Outil | Raccourci | Ce qu'il fait |
|---|---|---|
| **Sélectionner** | `V` | choisit un objet sans armer de poignée |
| **Déplacer** | `G` | tire l'objet le long des flèches de couleur |
| **Tourner** | `R` | fait pivoter l'objet avec les cercles de couleur |
| **Redimensionner** | `S` | agrandit ou rétrécit avec les poignées |
| **Cadrer la sélection** | `F` | recentre la caméra sur l'objet choisi |
| **Ajouter** | — | pose une maille ou une lumière dans la scène |
| **Supprimer** | `Suppr` | retire l'objet choisi |

Contrairement à l'espace Image, les trois outils de manipulation restent **trois boutons
visibles** au lieu d'être groupés. C'est délibéré : on en change plusieurs fois par minute, et
c'est ainsi que font Blender, Maya, Unity et l'éditeur three.js.

### Les poignées de couleur

Quand un outil de manipulation est armé et qu'un objet est choisi, des poignées apparaissent
autour de lui. Le code de couleur est universel :

| Couleur | Axe | Direction |
|---|---|---|
| **Rouge** | X | gauche ↔ droite |
| **Vert** | Y | bas ↔ haut |
| **Bleu** | Z | avant ↔ arrière |

Tirez sur une flèche pour déplacer le long de cet axe seulement.

> Un déplacement complet — de l'appui au relâchement — compte pour **une seule** action dans
> l'historique. `⌘Z` le défait d'un coup.

---

## Poser des objets

Trois chemins mènent au même endroit :

- le bouton **Ajouter** de la barre d'outils ;
- les boutons **+** des panneaux **Mailles** et **Lumières** ;
- le menu **Objets ▸ Ajouter**.

L'objet se pose à **l'origine de la scène** — le centre du monde, là où les axes se croisent.

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

> **Sprite** et **Texte** apparaissent grisés dans le menu. Ils sont annoncés mais pas encore
> constructibles. Voir [Ce qui n'existe pas encore](18-limites.md).

### Les lumières disponibles

Sans lumière, la scène reste noire.

| Lumière | Ce qu'elle fait | Quand l'utiliser |
|---|---|---|
| **Ambiante** | éclaire tout, uniformément, sans ombre | pour déboucher les noirs |
| **Directionnelle** | des rayons parallèles, comme le soleil | l'éclairage principal d'une scène extérieure |
| **Hémisphérique** | une couleur venant du ciel, une autre du sol | un rendu extérieur doux et naturel |
| **Ponctuelle** | rayonne dans toutes les directions depuis un point | une ampoule, une bougie |
| **Projecteur** | un cône de lumière | un spot de théâtre, un phare |

**Pour commencer** : une **directionnelle** pour l'éclairage principal, plus une **ambiante**
faible pour que les ombres ne soient pas complètement noires. C'est la recette classique.

---

## Dupliquer, copier, coller

Quatre boutons en fin de barre d'outils, et les quatre raccourcis que vous connaissez déjà.

| Geste | Raccourci | Ce qu'il fait |
|---|---|---|
| **Dupliquer** | `⌘D` | pose une copie de la sélection au même endroit, et la sélectionne |
| **Copier** | `⌘C` | retient la sélection sans toucher à la scène |
| **Couper** | `⌘X` | la retient et la retire de la scène |
| **Coller** | `⌘V` | pose ce qui a été retenu dans la scène en cours |

Trois choses valent d'être sues :

- **Un groupe se duplique entier**, avec tout ce qui pend dessous. Copier un enfant seul le copie
  seul, et il retrouve son parent — sauf si vous le collez dans une scène qui n'a pas ce parent,
  où il se pose alors à la racine.
- **La copie tombe exactement sur l'original.** Elle est sélectionnée : la déplacer est le geste
  suivant, pas une manœuvre de rattrapage.
- **Ce presse-papiers est celui du studio**, pas celui du système. Copier un objet ne jette pas le
  texte que vous aviez en réserve, et vous pouvez coller dans une autre scène. Il se vide en
  revanche quand vous changez de projet : un objet importé y nomme un asset qui n'existe nulle
  part ailleurs.

---

## L'Explorateur — l'arbre de la scène

Le panneau **Explorateur**, dans la colonne de gauche, montre tout ce que la scène contient,
sous forme d'arborescence.

- **Cliquez** une ligne pour sélectionner l'objet.
- **Les flèches du clavier** parcourent l'arbre.
- **L'œil** à droite de chaque ligne affiche ou masque l'objet.

Seules les lignes visibles sont réellement dessinées : une scène lourde défile sans peine.

---

## L'Inspecteur — tout ce qui se règle

Le panneau **Inspecteur**, dans la colonne de droite. Il montre **ce qui est sélectionné**, et
tout ce qui le définit.

Ses champs viennent du **type de l'objet**, pas d'un formulaire écrit pour chacun. Une sphère
montre son rayon, un tore montre son tube, un projecteur montre son angle.

### Pour un objet

| Section | Ce qu'elle contient |
|---|---|
| **Identité** | le nom, modifiable |
| **Transformation** | Position, Rotation, Échelle — trois nombres chacune (X, Y, Z) |
| **Géométrie** | ce qui définit la forme : rayon, largeur, segments… |
| **Matériau** | Couleur, Rugosité, Métallicité, et cinq emplacements de textures |

#### Les champs de géométrie, tous

Vous ne les verrez jamais tous en même temps : chaque forme montre les siens.

| Champ | Ce qu'il règle | Sur quelles formes |
|---|---|---|
| **Largeur**, **Hauteur**, **Profondeur** | les trois côtés d'une boîte | Cube, Plan |
| **Rayon** | la taille d'une forme ronde | Sphère, Cercle, Capsule, Tore, Nœud, polyèdres |
| **Rayon supérieur**, **Rayon inférieur** | les deux bouts d'un cylindre — inégaux, on obtient un cône | Cylindre |
| **Rayon intérieur**, **Rayon extérieur** | le trou et le bord | Anneau |
| **Tube** | l'épaisseur du boudin | Tore, Nœud de tore, Tube |
| **Segments** | le nombre de facettes | la plupart des formes rondes |
| **Segments radiaux** | les facettes tout autour | Cylindre, Capsule, Tore, Tube |
| **Segments tubulaires** | les facettes le long du boudin | Tore, Nœud de tore |
| **Segments en largeur**, **en hauteur** | la finesse dans chaque direction | Sphère, Plan |
| **Segments de calotte** | la finesse des bouts arrondis | Capsule |
| **Enroulements P**, **Enroulements Q** | combien de fois le nœud tourne sur lui-même | Nœud de tore |

**Les segments** méritent un mot : c'est le nombre de facettes qui composent une forme ronde.
Peu de segments = anguleux et léger ; beaucoup = lisse et lourd. 32 est un bon compromis pour
une sphère.

**Enroulements P et Q** sont les deux nombres qui définissent un nœud. P est le nombre de tours
autour de l'axe, Q le nombre de tours à travers le trou. `P=2, Q=3` donne le nœud de trèfle, celui
qu'on voit partout. Changez-en un, vous obtenez un autre nœud — c'est le seul champ du studio dont
on ne peut pas prévoir le résultat sans essayer.

**Rugosité et Métallicité** sont les deux réglages qui font tout l'aspect d'une matière :

| Réglage | À 0 | À 1 |
|---|---|---|
| **Rugosité** | miroir parfait | mat complet |
| **Métallicité** | plastique, bois, pierre | métal |

Les cinq emplacements de textures — **Texture**, **Normales**, **Carte de rugosité**, **Carte de
métallicité**, **Occlusion ambiante** — reçoivent des images du projet. Le bouton **Choisir une
texture** ouvre la liste ; **Retirer la texture** la vide.

### Pour une lumière

| Champ | Ce qu'il fait |
|---|---|
| **Couleur** | la teinte de la lumière |
| **Intensité** | sa puissance |
| **Portée** | jusqu'où elle éclaire — ponctuelle et projecteur |
| **Atténuation** | à quelle vitesse elle faiblit avec la distance |
| **Angle** | l'ouverture du cône — projecteur seulement |
| **Pénombre** | la douceur du bord du cône — projecteur seulement |
| **Cible** | vers quoi elle pointe |
| **Couleur du ciel** / **du sol** | hémisphérique seulement |

> L'Inspecteur **n'est pas un panneau de la 3D**. Le même inspecteur lit un clip, une piste ou un
> asset quand c'est cela qui est sélectionné. C'est pourquoi il reste ouvert dans tous les
> espaces.

---

## La grille au sol

Le quadrillage n'est **pas** un objet de la scène : c'est un repère, pour savoir où sont les
choses et à quelle hauteur. Il n'apparaît dans aucun rendu.

**Réglages ▸ Espaces de travail ▸ 3D** :

| Réglage | Ce qu'il fait | Défaut |
|---|---|---|
| **Afficher la grille** | l'affiche ou la cache | activée |
| **Taille de la grille** | son étendue en mètres — un carreau vaut toujours 1 m | 20 |

Cachez-la pour juger une image sans rien autour.

---

## Enregistrer

`⌘S` / `Ctrl+S` écrit la scène dans le projet, sous `documents/`.

**Les scènes 3D savent s'enregistrer** — c'est l'un des deux seuls types de documents qui le
sachent aujourd'hui.

Un onglet dont le travail n'est pas encore écrit porte **un point** (`•`) à côté de son nom. Le
point disparaît à l'enregistrement et revient à la modification suivante.

Rouvrir le studio ramène l'onglet et relit sa scène. Un onglet jamais enregistré revient vide :
rien n'avait été écrit pour lui.

<!-- CAPTURE : la vue 3D avec une maille sélectionnée, l'arbre de scène et le panneau Mailles.
     Vers ../../images/scene-3d.png -->

---

## Ce qui manque encore

L'espace 3D est fonctionnel mais jeune. Ne cherchez pas encore :

- **Sprite** et **Texte** — les deux entrées grisées du menu **Ajouter** ;
- les **vues normalisées** (dessus, face, côté) et la **caméra orthographique** ;
- l'**export** d'une scène vers un fichier `.glb` ou `.usdz`.

Le détail est dans [Ce qui n'existe pas encore](18-limites.md).

---

[← Espace Image](08-espace-image.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Vidéo →](10-espace-video.md)
