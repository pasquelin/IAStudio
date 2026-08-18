# 8. Espace Image

[← Les assets](07-assets.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Modélisation →](09-espace-modelisation.md)

L’espace où l’on peint, gomme, recadre et empile des calques.

---

## Ouvrir un document image

**Le bouton `+` du rail gauche** crée un document **neuf et vide** : une toile de
**1024 × 1024 pixels**, avec un unique calque blanc nommé **Background**, déjà sélectionné.

> Ce blanc est un **vrai calque**, pas une couleur de fond. Vous pouvez le masquer, le rendre
> transparent ou le supprimer comme n’importe quel autre — le damier de transparence apparaît
> alors dessous.

Le `+` demande une seule chose : un projet ouvert. Sans projet, il est gris — il n’y aurait nulle
part où écrire le document.

### Faire entrer une image existante

**Un document image n’est pas condamné à partir du blanc.** Trois gestes y posent une image de
votre étagère, et les trois font la même chose : un **calque de plus**, au-dessus de la pile,
nommé d’après l’asset et **déjà actif** : c’est lui que le prochain trait recevra.

| Geste | Ce qu’il faut |
|---|---|
| **Glisser-déposer** l’image sur la toile | l’onglet image ouvert devant vous |
| **Double-clic** sur l’image dans l’étagère | un onglet image en avant — c’est lui qui la reçoit |
| L’outil **Image…**, groupe Formes | rien : il ouvre l’étagère, vous y choisissez |

> Seules les **images du projet** entrent — celles que vous voyez dans l’étagère, générées ou
> importées. Une image qui n’a pas encore été téléchargée dans le projet n’est pas déposable.

Il n’y a **pas de menu « Ouvrir »** : un document image ne s’ouvre pas *sur* un fichier, il
reçoit des images comme calques. La nuance compte au moment de fermer l’onglet — voir la fin de
ce chapitre.

---

## Naviguer dans l’image

Avant les outils, les gestes. Ils marchent quel que soit l’outil armé.

| Geste | Effet |
|---|---|
| **Molette** | fait défiler l’image, comme dans Figma |
| **⌘ + molette** / **Ctrl + molette** | zoome vers le pointeur |
| **Pincement** sur trackpad | zoome |
| **Maintenir Espace + glisser** | déplace la vue, quel que soit l’outil |
| **Clic du milieu + glisser** | déplace la vue aussi |

> Maintenir Espace change le curseur en main. Le geste est celui de tous les éditeurs d’image :
> vous n’avez pas à changer d’outil pour vous déplacer.

### La barre de zoom

En bas à droite de l’image, une petite barre flottante.

| Bouton | Effet | Raccourci |
|---|---|---|
| **−** | zoom arrière d’un cran | `⌘−` / `Ctrl+−` |
| **Le pourcentage** | revient à la taille réelle — un clic dessus | `⌘1` / `Ctrl+1` |
| **+** | zoom avant d’un cran | `⌘+` / `Ctrl+=` |
| **Ajuster** | l’image entière tient dans le panneau | `⌘0` / `Ctrl+0` |

Le zoom va de **2 %** à **6400 %**. En dessous de 100 %, le pourcentage affiche une décimale :
3 % et 3,7 % ne cadrent pas la même chose.

**Taille réelle** (`⌘1`) est la seule échelle où l’on juge la netteté : un pixel de l’image pour
un pixel d’écran.

### Les règles et les repères

| Élément | Raccourci | Ce que c’est |
|---|---|---|
| **Règles** | `⌘R` / `Ctrl+R` | deux graduations, en haut et à gauche |
| **Repères** | `⌘;` / `Ctrl+;` | des lignes d’alignement que vous posez |
| **Effacer les repères** | — | retire tous les repères |
| **Magnétisme** | `⇧⌘;` / `Ctrl+Shift+;` | ce que vous déplacez colle aux repères |

**Poser un repère** : tirez depuis une règle vers l’image. Tirez-le en dehors de l’image pour
l’enlever.

Masquer les repères ne les efface pas — ils reviennent au prochain `⌘;`.

Le magnétisme fait coller ce que vous déplacez aux repères, aux **bords de l’image** et à son
**centre**, à quelques pixels près. La tolérance est en pixels d’écran : elle ne change donc pas
selon le zoom.

---

## La barre d’outils

Elle est en haut du document. Les outils sont **groupés**, comme dans Figma :

- **survolez un groupe** pour voir le reste de ses outils, ou faites `⌥↓` si vous êtes au
  clavier ;
- **cliquez le bouton lui-même** pour armer l’outil qu’il montre déjà — `Entrée` fait la même
  chose.

Autrement dit : un outil armé n’a jamais besoin du menu pour être repris.

> **Les touches ci-dessous arment l’outil**, et elles se remappent comme toutes les autres : chaque
> outil est une commande à part entière, listée dans **Réglages ▸ Raccourcis**. Voir
> [Tous les raccourcis](15-raccourcis.md).

### Groupe Curseur

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Déplacement** | `V` | fait glisser le contenu du calque actif |
| **Main** | `H` | déplace la vue |
| **Échelle** | `K` | fait apparaître huit poignées et une rotation autour du calque actif |

> **C’est le groupe armé à l’ouverture.** Un document s’ouvre sur **Déplacement**, jamais sur le
> pinceau : le premier clic sur une image que vous venez d’ouvrir ne doit pas pouvoir y laisser
> une trace. Le pinceau est à une touche — `P`.

### Le menu **Image**

Six entrées. Les quatre dernières agissent sur **tout le document**, calques compris — pas sur le
calque actif :

| Entrée | Ce qu’elle fait |
|---|---|
| **Fusionner vers le bas** (`⌘E`) | réunit le calque actif et celui **juste en dessous, au même niveau** — jamais à travers la paroi de son groupe. Le résultat garde le nom du calque du dessous, comme partout ailleurs |
| **Aplatir l’image** | réduit toute la pile à un seul calque nommé « Arrière-plan » |
| **Miroir horizontal** | retourne le document de gauche à droite |
| **Miroir vertical** | retourne le document de haut en bas |
| **Rotation horaire** | un quart de tour vers la droite ; **le cadre pivote avec** — un portrait devient un paysage |
| **Rotation antihoraire** | un quart de tour vers la gauche, même chose |

Aucune n’a de raccourci par défaut : le menu est leur seule porte. Vous pouvez leur en donner un
dans les [réglages](14-reglages.md), comme à n’importe quelle commande.

> **Un miroir suivi du même miroir rend exactement l’image de départ.** Ce n’est pas une évidence :
> le studio retourne le calque plutôt que de réécrire ses pixels, et c’est ce qui évite qu’un
> aller-retour laisse une trace d’arrondi.

> **Aplatir perd les calques masqués**, il ne les fusionne pas — c’est aussi ce que fait Photoshop.
> Ce que vous voyez est ce que vous gardez.

**Fusionner et Aplatir écrivent vraiment des pixels**, à la différence du reste du menu : le calque
qui reste reçoit l’image composée de ce qui disparaît. `⌘Z` rend la pile — et l’image avec, tant que
le document n’a pas changé de taille entre-temps.

### Groupe Cadre

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Recadrage** | `F` | glissez un cadre sur l’image, ajustez-le, puis `⏎` pour rogner |
| **Section** | — | *pas encore disponible* |
| **Découpe** | — | *pas encore disponible* |

> **Ces deux-là n'ont pas de touche, et n'en auront qu'en arrivant.** Le registre des commandes
> ne porte que les outils qui répondent : un raccourci écrit d'avance serait une intention
> affichée, pas un geste — c'est la règle du [chapitre 18](18-limites.md).

Le geste se fait en trois temps :

1. **Glissez** un cadre sur l’image. Ce qui en sort est **assombri** — c’est exactement ce que le
   recadrage va retirer. `⇧` pendant le glissement contraint le cadre au carré.
2. **Ajustez-le.** Le cadre reste à l’écran quand vous relâchez, avec ses huit poignées : tirez
   un coin ou une arête pour le corriger. Glisser ailleurs recommence un cadre neuf.
3. **`⏎` applique**, `⎋` abandonne.

Rien n’est modifié avant `⏎` : vous pouvez zoomer, faire glisser la vue au bouton du milieu, et
revenir au cadre. Changer d’outil l’abandonne ; redimensionner ou pivoter l’image aussi, puisque
le cadre ne désignerait plus la même chose.

Le cadre ne sort jamais de l’image — un recadrage rogne, il n’agrandit pas.

> ⚠️ **`⌘Z` rend le cadre, pas les pixels rognés.** Rétrécir le document jette pour de bon ce
> qui tombait dehors : l’annulation rétablit la taille d’origine, mais la zone retirée revient
> vide. C’est le comportement de Photoshop lorsque « Supprimer les pixels rognés » est coché —
> à ceci près que Photoshop, lui, sait les rendre. **Exportez avant de rogner large** si vous
> comptez revenir en arrière.

### Groupe Sélection

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Sélection rectangulaire** | `M` | trace une zone rectangulaire — **Maj pour un carré** |
| **Sélection elliptique** | — | trace une zone ovale — **Maj pour un cercle** |
| **Lasso** | `L` | trace une zone à main levée |

**`Maj` contraint la zone pendant le glissement**, comme il contraint les formes du groupe
suivant. Le **Lasso** l’ignore : une zone tracée point par point n’a pas de côtés à égaliser.

> Tant qu’une zone est tracée, **le pinceau, la gomme, le remplissage et les formes n’agissent
> qu’à l’intérieur**. Un clic sans glisser abandonne la zone, comme `⌘D`.

### Groupe Formes

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Rectangle** | `R` | Maj pour un carré |
| **Trait** | `⇧R` | Maj pour le contraindre à 45° |
| **Flèche** | `A` | Maj pour la contraindre à 45° |
| **Ellipse** | `O` | Maj pour un cercle |
| **Polygone** | — | tracé depuis son centre |
| **Étoile** | — | tracée depuis son centre |
| **Image…** | — | ouvre la bibliothèque, pour poser une image comme calque |

### Groupe Dessin

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Pinceau** | `P` | peint, bord adouci |
| **Crayon** | `⇧P` | peint, bord net |
| **Plume** | — | *pas encore disponible* |

### Groupe Texte

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Texte** | `T` | pose du texte sur le calque actif |
| **Texte sur chemin** | — | *pas encore disponible* |

Un calque texte reste du texte : il se corrige, et il reste net à tous les zooms. L’inspecteur en
règle le **contenu**, le **corps** et la **police**.

**La liste des polices est celle de l’espace Modélisation** : les trois polices que le studio embarque
d’abord, puis celles de votre machine. Ce que dit
[l’espace Modélisation](09-espace-modelisation.md#les-polices-offertes) des polices absentes vaut mot pour mot ici.

### Groupe Gomme

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Gomme ponctuelle** | `E` | efface au passage du pointeur |
| **Gomme sélective** | — | efface l’intérieur de la sélection d’un geste |

La gomme efface **vers la transparence**, elle ne peint pas en blanc.

### Outils isolés

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Commentaire** | — | *pas encore disponible* |
| **Remplir le calque** | `G` | remplit le calque actif — ou la **zone sélectionnée**, s’il y en a une |
| **Pipette** | `I` | prélève la couleur sous le pointeur |
| **Couleur** | — | la couleur du pinceau, du crayon, des formes et du remplissage |
| **Réglages du pinceau** | `[` et `]` | la taille, la dureté et l’opacité |

> **Ces deux contrôles suivent l’outil armé, et disparaissent quand il ne les lit pas.** La
> pipette, le pointeur, le recadrage et la légende ne peignent aucun pixel : la barre n’affiche
> alors ni couleur ni curseurs. La gomme n’offre pas de couleur — son trait est le blanc que le
> mélange d’effacement lit, et le nuancier n’y choisissait rien. Le pot de peinture n’offre que
> la couleur. Un contrôle sans effet **n’est pas grisé, il n’est pas là** : c’est la règle que
> l’inspecteur applique déjà à un sprite, qui n’a aucune section d’ombre plutôt qu’une section
> morte.

> **Remplir n’est pas un pot de peinture.** Il ne cherche pas la plage de couleur sous le
> pointeur : il remplit **tout le calque**, d’un bord à l’autre — ou, **si une zone est
> sélectionnée, cette zone seulement**. C’est ce qui donne un fond uni en un geste, et une zone sa
> couleur plate ; ce n’est pas le remplissage par proximité de couleur que vous connaissez
> peut-être ailleurs.

### Les réglages du pinceau

Le dernier bouton de la barre ouvre les curseurs que l’outil armé lit — trois sous le pinceau,
deux partout ailleurs.

| Réglage | Plage | Ce qu’il fait |
|---|---|---|
| **Taille** | 1 à 512 px | le diamètre du trait |
| **Dureté** | 0 à 1 | 1 donne un bord net, 0 un bord entièrement fondu |
| **Opacité** | 0 à 1 | la transparence de ce qui est déposé |

**La taille et l’opacité valent pour quatre outils à la fois** : le pinceau, le crayon, la gomme
et le trait des formes. Un pinceau de 40 px et une gomme de 4 px, ce n’est pas possible — c’est le
même réglage.

**La dureté, elle, n’en touche qu’un : le pinceau — et elle ne s’affiche que là.** Le crayon, la
gomme et le trait des formes ont un bord net ; ils lisent la taille et l’opacité comme les autres.

**En dessous d’un certain point, adoucir ne se voit plus.** Un fondu qui n’atteindrait pas un
demi-pixel ne déplace rien qu’un œil distingue : sur un pinceau de 4 px, il faut descendre la
dureté à 0,5 pour que le fondu commence. Et le fondu ne mange jamais plus de la moitié du rayon —
il adoucit un bord, il ne dissout pas la marque.

**`[` rétrécit, `]` élargit**, sans rien ouvrir : c’est ce dont la main se sert en plein tracé. Le
pas n’est pas un nombre de pixels mais un rapport — un cran fait environ ×1,4 — sans quoi un pas
fixe ramperait à 400 px et bondirait à 4. En bas de l’échelle il reste d’au moins un pixel.

> **Le cercle qui suit le pointeur montre ce que le prochain trait couvrira**, au diamètre réel.
> Il grandit et rétrécit avec le zoom, comme le ferait le trait : un pinceau de 24 px couvre la
> moitié de l’écran à 1600 %, et un point à 5 %.

> **Le curseur devient un sens interdit quand l’outil ne peut rien faire ici** — un groupe est
> armé, le calque actif est un calque de réglage, ses pixels ou sa position sont verrouillés. Le
> refus se lit **avant** le geste, plutôt qu’après coup dans un message : une image qui ne prend
> pas la peinture ressemble sinon exactement à une image dont le trait est parti ailleurs.

### Les outils grisés

Certains outils sont visibles mais inactifs. **C’est délibéré** : la barre annonce ce qui vient
plutôt que de cacher ce qui manque. Un outil qui apparaîtrait un jour sans prévenir serait plus
déroutant qu’un bouton gris.

Le chapitre [Ce qui n’existe pas encore](18-limites.md) en donne la liste complète.

---

## Les calques

Le panneau **Calques**, dans la colonne de droite.

Un calque est une couche transparente empilée sur les autres. Le calque du haut recouvre ceux du
dessous. Vous peignez sur celui qui est **actif** — cliquez sur son nom pour le choisir.

| Action | Comment |
|---|---|
| **Ajouter un calque** | le bouton **+** du panneau — il se pose au-dessus de la pile |
| **Supprimer le calque** | le bouton de suppression — le dernier calque ne peut pas être supprimé |
| **Afficher ou masquer** | l’œil, à gauche du nom |
| **Réordonner** | les boutons de pile, ou le glisser-déposer |

Un calque masqué est **estompé et barré** : on voit d’un coup d’œil ce qui est caché.

---

## Annuler et rétablir

| Action | Raccourci |
|---|---|
| **Annuler** | `⌘Z` / `Ctrl+Z` |
| **Rétablir** | `⇧⌘Z` / `Ctrl+Shift+Z` |

**L’historique appartient au document**, pas à l’application. Chaque onglet a sa propre pile.
Si `⌘Z` semble ne rien faire, c’est très probablement que l’action que vous visez appartient à un
autre onglet : cliquez d’abord sur celui-là.

Les gestes continus — un trait de pinceau, un glissement de calque — comptent pour **une seule**
entrée d’historique. Vous n’annulez pas un trait pixel par pixel.

> L’historique garde les **100 dernières** actions. Au-delà, les plus anciennes disparaissent.

<!-- CAPTURE : un document image, le volet du groupe Formes ouvert, la pile de calques visible.
     Vers ../../images/image-tools.png -->

---

## Sortir l’image du studio

**`⇧⌘E` écrit le document aplati en `.png`**, où vous voulez sur le disque. Les calques sont
composités à l’export ; les règles, les repères et les pointillés de sélection n’y sont pas.

> **`⌘S` enregistre le document lui-même**, calques compris, dans le projet — et il se rouvre
> tel quel. Ce n’est pas la même chose que `⇧⌘E` : l’export aplatit et sort du studio, tandis que
> l’enregistrement garde la pile intacte pour continuer à travailler.
>
> **Et si ce document a été ouvert depuis un asset, `⌘S` réécrit AUSSI cet asset** — la vignette
> de l’étagère suit donc ce que vous éditez, au lieu de montrer la génération d’origine. Les deux
> écritures sont dans cet ordre, et il compte : le document porte les calques et l’historique,
> l’asset une image plate. Si la seconde échoue, votre travail est déjà sur le disque et c’est la
> vignette qui est en retard — jamais l’inverse.
>
> **`⌘S` écrit l’asset à la taille du DOCUMENT.** Recadrer ou redimensionner puis enregistrer réduit
> donc l’asset d’origine — et si cet asset vit dans le projet, son image précédente est remplacée.
> C’est voulu : un recadrage est une édition comme une autre, et un éditeur qui refuserait
> d’enregistrer un document redimensionné n’en serait pas un. **Un [média lié](07-assets.md), lui,
> n’est jamais touché** : l’édition entre dans le projet, votre fichier reste où il est.
>
> **Le studio le dit quand il constate que le document ne mesure plus son asset**, à deux moments
> qui ne se valent pas. En rouvrant l’asset depuis l’étagère alors que son onglet est déjà là,
> c’est un avertissement : rien n’est encore écrit, vous pouvez choisir. À l’enregistrement, c’est
> un constat — **rien n’est refusé et l’écriture a lieu**. Et il se tait quand il ne peut pas
> mesurer : un asset illisible, ou un onglet qui n’a pas fini de s’ouvrir. Pour garder l’original
> intact, `⇧⌘S` écrit une copie.
>
> **`⇧⌘S` — Enregistrer sous — écrit une copie à côté et continue dessus.** Aucune boîte de
> dialogue ne demande de nom : la copie s’appelle *« (le nom) copie »*, et l’asset que vous aviez
> ouvert reste tel qu’il était au dernier `⌘S`.
>
> L’image s’écrit en **dossier** `documents/<id>.img/` : un `document.json` pour la pile, et un
> `.png` par calque — plus un second pour son masque, s’il en a un. C’est volontairement
> inspectable : vous pouvez ouvrir le dossier et regarder les calques un par un.
>
> **Ce qui ne s’enregistre pas :** l’historique d’annulation. Rouvrir un document, c’est repartir
> d’une pile propre — les pixels sont là, les cinquante derniers gestes ne le sont plus.

---

[← Les assets](07-assets.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Modélisation →](09-espace-modelisation.md)
