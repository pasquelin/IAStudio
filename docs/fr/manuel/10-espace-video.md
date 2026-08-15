# 10. Espace Vidéo

[← Espace 3D](09-espace-3d.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Audio →](11-espace-audio.md)

L’espace où l’on assemble des plans les uns après les autres pour en faire une séquence.

---

## Comment l’espace est disposé

Comme l’espace Audio, c’est un espace où la **bande basse appartient au montage**. Une séquence se
lit sur toute la largeur de l’écran : la **Timeline** y prend donc toute la place, et l’étagère à
assets passe dans la moitié haute de la colonne de droite, pour rester visible en même temps.

Au centre, deux moniteurs côte à côte — la convention de Premiere et de DaVinci :

| Moniteur | Ce qu’il montre |
|---|---|
| **Source**, à gauche | le clip sélectionné, seul |
| **Programme**, à droite | le montage tel qu’il sera |

Quand aucun clip n’est sélectionné, le moniteur Source affiche « Sélectionnez un clip pour le
voir ici. » Quand le clip **image** sous la tête de lecture ne peut pas être décodé, c’est
[l’autre message](#quand-un-clip-ne-peut-pas-safficher) qui prend sa place ; un clip son
introuvable, lui, reste noir et muet sans rien annoncer.

---

## Le vocabulaire du montage

| Mot | Ce que c’est |
|---|---|
| **Séquence** | le montage entier, avec ses pistes |
| **Piste** | une ligne horizontale qui reçoit des clips. Il y a des pistes image et des pistes son |
| **Clip** | un morceau de média posé sur une piste |
| **Tête de lecture** | le trait vertical qui indique où on en est |
| **Rogner** (*trim*) | raccourcir **ou allonger** un clip par l’un de ses bouts |
| **Poignée** | la barre verticale à chaque bout d’un clip, celle qu’on attrape pour le rogner |
| **Point d’entrée** | l’endroit du fichier d’origine où le clip commence |

---

## Poser un premier clip

Trois gestes, et **ils ne posent pas le clip au même endroit** :

| Geste | Sur quelle piste | À quel instant |
|---|---|---|
| **Glisser-déposer** depuis l’étagère | celle que vous survolez, **si elle peut le prendre** | là où vous lâchez |
| **Glisser-déposer** dans le vide, sous la dernière piste | une **nouvelle** piste, ouverte pour lui | là où vous lâchez |
| **Double-clic** sur l’asset | le studio choisit | à la **tête de lecture** |

**Le glisser-déposer vous obéit au pixel près pour l’INSTANT ; pour la piste, il vous corrige.**
Vous lâchez exactement où vous voulez dans le temps. Mais **viser une piste qui ne peut pas
prendre le clip ne l’y pose pas** : une piste image pour un son, une piste verrouillée, muette, ou
tue par le solo d’une autre. Le studio choisit alors à votre place, comme au double-clic, et le
clip atterrit **ailleurs que sous le pointeur**.

C’est une règle unique et non deux : une piste muette acceptée sous le pointeur et évitée partout
ailleurs répondrait deux fois à la même question. Mais **rien ne le dit à l’écran**, et c’est le
seul endroit du montage où le geste ne fait pas ce qu’il montre.

**Lâcher sous la dernière piste ouvre les pistes qu’il faut** plutôt que de ne rien faire : une
piste image, et la piste son à côté pour une prise qui porte du son. Les deux arrivent d’un seul
geste, et **⌘Z les reprend d’un seul coup** — les clips et les pistes.

Deux endroits ne prennent toujours rien : la **règle des temps**, en haut, et un montage qui n’a
aucune piste image — celui de l’espace Audio — où lâcher un rush ne fait qu’ouvrir l’asset,
puisqu’il n’y a là aucun moniteur pour l’afficher.

**Le double-clic choisit à votre place**, et il choisit bien : un son va sur une piste son, tout
le reste sur une piste image, et **toute piste qui ne se fait pas entendre est évitée** — un clip
qui y atterrirait aurait l’air de n’avoir rien fait. Cela vise les **verrouillées** et les
**muettes**, mais aussi celles que le **solo d’une autre piste** a fait taire : une piste que rien
ne distingue à l’œil, et sur laquelle le double-clic ne posera pourtant rien.

Dans tous les cas, le studio décide de deux choses :

- **la durée** — celle du média. Une image fixe, ou un média dont la durée est inconnue, dure
  **5 secondes** par défaut. Ce n’est qu’un point de départ : le temps qu’une image reste à
  l’écran se décide en tirant sur l’un ou l’autre de ses bouts, voir plus bas ;
- **le calage** — sur une image entière, jamais entre deux. Vous pouvez viser au pixel, le clip
  se range tout seul sur l’image la plus proche.

---

## Les outils

| Outil | Raccourci | Ce qu’il fait |
|---|---|---|
| **Sélection** | `V` | sélectionne, déplace, rogne et allonge les clips |
| **Lame** | `C` | coupe un clip là où vous cliquez |
| **Main** | `H` | fait défiler la timeline — molette pour zoomer |

> **Ces trois touches ne sont pas encore actives** : elles s’affichent dans les infobulles, mais
> rien ne les écoute. Un outil se choisit à la souris. Les touches en service dans le montage —
> `Espace`, `S`, `Suppr`, les zooms — sont dans [Tous les raccourcis](15-raccourcis.md).

### Avec l’outil Sélection

| Geste | Effet |
|---|---|
| **Clic** sur un clip | le sélectionne — l’inspecteur le montre |
| **Glisser** le corps du clip | le déplace, y compris d’une piste à l’autre |
| **Glisser** un bord du clip | le rogne ou l’allonge de ce côté |

**Chaque bout d’un clip porte une poignée**, une barre verticale, et le curseur y devient une
double flèche : c’est le signe que le bord est attrapable. Sur un clip trop étroit pour les
porter, les poignées disparaissent et le milieu reste au déplacement — sans quoi un clip mince
ne pourrait plus être bougé du tout. **Seul l’outil Sélection montre cette double flèche** : la
**Main** prend toute la surface pour faire défiler, et la **Lame** coupe là où l’on clique — ni
l’une ni l’autre ne rogne, et leur curseur ne le promet donc pas.

**Un clip allongé recouvre son voisin** plutôt que de buter dessus, comme dans DaVinci ou
Premiere : allonger un plan, c’est demander au suivant de céder la place. `⌘Z` remet la piste
entière comme elle était.

**Le magnétisme est automatique.** Un clip déplacé colle :

- à la **grille des images** — jamais entre deux images ;
- aux **bords des clips voisins**, pour qu’il n’y ait pas de trou d’un millième de seconde
  invisible à l’œil.

> **Une vidéo ou un son** ne peut pas dépasser la longueur du média d’origine. Le studio arrête
> le rognage tout seul plutôt que d’afficher du noir.
>
> **Une image fixe n’a aucun média à dépasser** : ses deux bouts l’allongent autant qu’on veut,
> et la seule borne est le début de la séquence. C’est ainsi qu’on décide du temps qu’un carton
> de titre reste à l’écran.

---

## Le transport — lire, mettre en pause

Sous chaque moniteur :

| Bouton | Raccourci | Effet |
|---|---|---|
| **Lire** / **Pause** | `Espace` | lance ou arrête la lecture |
| **Retour au début** | `Début` (Home) | ramène la tête de lecture au tout début |

| Raccourci | Effet |
|---|---|
| `Espace` | lire / pause |
| `Début` (Home) | aller au début |
| `Fin` (End) | aller à la fin |
| `⌘=` / `Ctrl+=` | zoomer sur la timeline |
| `⌘−` / `Ctrl+−` | dézoomer |
| `⇧Z` | tout afficher — le montage entier tient à l’écran |
| `S` | **couper le clip à la tête de lecture** |
| `F` | ouvrir la **fenêtre de retour**, pour un second écran |
| `Suppr` | supprimer le clip sélectionné |
| `⌘Z` / `⇧⌘Z` | annuler / rétablir |

> **`C` et `S` ne font pas la même chose.** `C` **arme l’outil Lame** — vous coupez ensuite là où
> vous cliquez. `S` **coupe tout de suite**, à la tête de lecture, sans changer d’outil.

**Un seul lecteur est actif à la fois.** Si vous ouvrez deux séquences, seule celle qui est en
avant répond à la barre d’espace. C’est ce qui garde la lecture fluide : deux décodeurs vidéo qui
tournent en même temps se disputent la machine.

---

## La fenêtre de retour — regarder sur un second écran

**`F`**, ou le bouton **Fenêtre de retour** sous le moniteur **Programme**. Une fenêtre s’ouvre,
qui ne contient rien d’autre que l’image du montage : ni timeline, ni outils, ni barre. Posez-la
sur un second écran, et vous regardez votre montage pendant que vous le montez.

C’est le geste qu’on fait en **regardant** plutôt qu’en éditant, et c’est pourquoi la touche est
nue — pas de `⌘`, pas de `⇧`.

### Ce qu’elle montre, et ce qu’elle ne montre pas

**Le Programme, toujours.** Le montage entier, tel qu’il sera exporté. Jamais la **Source** : la
touche appartient au moniteur qui tient la lecture, et c’est celui du montage.

**Elle est MUETTE, et ce n’est pas un oubli.** Le studio joue déjà le son de ce montage-là. Deux
sorties sur la même machine se décalent de quelques millisecondes et **s’entendent comme un
écho** — ce qu’on regarde sur le second écran, c’est l’image ; ce qu’on écoute reste là où l’on
travaille.

### Elle suit, y compris pendant la lecture

Tout ce que vous faites au montage s’y voit : une coupe, un déplacement de clip, un fondu. Quand
vous déplacez la tête de lecture, elle bouge avec vous, **image par image**.

**Et quand vous lisez, elle lit.** Elle ne reçoit pas les images une par une — elle lance sa
propre lecture, à partir du point où vous en êtes. C’est ce qui l’empêche de traîner d’un cran
derrière l’image qu’elle est censée reproduire.

### Une seule fenêtre, jamais deux

**Un second appui sur `F` n’ouvre pas une deuxième fenêtre.** Il n’y en a qu’une, et elle montre
**le montage qui est devant vous**. Si vous passez à un autre onglet de séquence et redemandez le
retour, **c’est la même fenêtre qui se tourne vers lui** — pas une troisième qui vient s’empiler
sur le bureau.

### À l’ouverture, et à la fermeture

**Vous n’avez rien à faire pour la remplir.** Elle réclame l’état du montage dès qu’elle
s’ouvre, même si le montage a été ouvert bien avant elle.

Tant qu’aucun montage n’est devant, elle affiche :

> *En attente du studio. Ouvrez un montage pour le voir ici.*

**Et elle y revient si vous fermez l’onglet du montage**, plutôt que de rester figée sur la
dernière image d’un travail qui n’est plus ouvert.

Elle se ferme comme n’importe quelle fenêtre. Rien de ce qui est en cours ne s’arrête quand elle
part.

---

## Les pistes

La colonne de gauche de la timeline, face à chaque ligne.

| Contrôle | Effet |
|---|---|
| **Double-clic sur le nom** | renomme la piste |
| **Muette** | la piste n’est plus entendue |
| **Solo** | **seules** les pistes en solo sont entendues |
| **Verrouillée** | la piste refuse toute modification |
| **Tirer le bas de l’en-tête** | change la hauteur de la ligne |

**Solo l’emporte sur muet.** Dès qu’une piste passe en solo, toutes celles qui ne le sont pas se
taisent, qu’elles soient muettes ou non. C’est la convention de tous les logiciels de montage.

### En ajouter une

**Deux boutons, dans la barre du panneau Timeline** — en haut, à côté des outils :
**Ajouter une piste vidéo** et **Ajouter une piste audio**. La piste arrive vide, **au bas de la
colonne**.

Ils sont en haut et non sous la colonne pour une raison pratique : le bas de la colonne descend
avec le montage, et un bouton qui s’y trouve finit derrière ce que l’on regarde.

**Un troisième geste en crée aussi** : lâcher un asset dans le vide, sous la dernière piste, ouvre
les pistes qu’il faut et y pose le clip — [décrit plus haut](#poser-un-premier-clip). Les boutons
servent quand on veut la piste **avant** d’avoir quoi que ce soit à y mettre.

> **L’espace Audio n’en a qu’un**, celui des pistes son : il n’y a pas d’image à y montrer.
> Voir [Espace Audio](11-espace-audio.md).

### Les déplacer dans la pile

**L’ordre des pistes compte** : quand vous **double-cliquez** un asset, le studio le pose sur la
**première piste du bon genre qui se fait entendre**, en partant du haut. Monter une piste, c’est
donc en faire la destination par défaut. Chaque en-tête porte une **poignée** sur son bord gauche.

- **Tirez-la** vers le haut ou vers le bas. La ligne tenue **s’estompe** le temps du geste : c’est
  la seule chose qui dise qu’un déplacement est en cours, la pile se renumérotant d’un rang à la
  fois. Un glissement de trois rangs reste **un seul geste** — `⌘Z` le défait d’un coup, et non
  rang par rang.
- **Au clavier** : la poignée est un bouton. Donnez-lui le focus, puis `↑` et `↓`.

**Rien ne bouge aux extrémités.** La première piste ne monte pas, la dernière ne descend pas, et
l’essai ne laisse pas d’étape à annuler.

### En supprimer une

**Clic droit sur l’en-tête**, ou le bouton **Actions de la piste** de la ligne — le clic droit
n’étant pas un geste de clavier, ce bouton est ce qui rend ces trois lignes atteignables sans
souris. Le menu en porte trois :

| Ligne | Effet |
|---|---|
| **Monter la piste** | l’échange avec celle du dessus. Grisée sur la première |
| **Descendre la piste** | l’échange avec celle du dessous. Grisée sur la dernière |
| **Supprimer la piste** | la retire **avec tous les clips qu’elle porte** |

> **Une piste verrouillée ne se supprime pas, et le menu ne le dit pas** : la ligne reste
> cliquable, et le clic ne fait rien. Le verrou vaut pour la piste elle-même, pas seulement pour
> ses clips — déverrouillez-la d’abord.

Comme tout le reste, la suppression s’annule par `⌘Z`, et la piste revient **à son rang**, avec
tout ce qu’elle portait.

---

## L’inspecteur d’un clip

Sélectionnez un clip, et regardez l’**Inspecteur**, dans la colonne de droite.

| Champ | Ce qu’il fait |
|---|---|
| **Source** | de quel asset le clip vient |
| **Début** | où le clip commence dans la séquence |
| **Fin** | où il finit |
| **Durée** | sa longueur |
| **Point d’entrée** | à quel endroit du fichier d’origine il commence |
| **Fondu d’entrée** | une montée depuis le noir, au début — entendue sur un clip son, seulement dessinée sur un clip image |
| **Fondu de sortie** | une descente vers le noir, à la fin — même partage |
| **Vitesse** | 1 = normal, 0,5 = deux fois plus lent, 2 = deux fois plus rapide |
| **Gain** | le volume, en décibels. 0 laisse le son tel qu’il a été enregistré |

### L’inspecteur d’une piste

| Champ | Ce qu’il fait |
|---|---|
| **Nom** | le nom affiché |
| **Type** | image ou son |
| **Clips** | combien elle en contient |
| **État** | Muette, Solo, Verrouillée |
| **Hauteur** | la hauteur de la ligne |

<!-- CAPTURE : l’espace Vidéo, timeline avec plusieurs clips et les deux moniteurs au-dessus.
     Vers ../../images/timeline.png -->

---

## Les réglages d’une séquence

Une séquence neuve part sur :

| Réglage | Valeur |
|---|---|
| **Dimensions** | 1920 × 1080 |
| **Images par seconde** | 25 |
| **Fréquence d’échantillonnage audio** | 48 000 Hz |

Le temps est compté en **microsecondes** en interne, jamais en secondes décimales : sur un
montage long, les arrondis finiraient par décaler l’image du son.

---

## Pourquoi la lecture est fluide

Quand vous importez une vidéo, le studio en fabrique une **copie allégée** — un *proxy*. C’est
elle qui est lue pendant que vous montez, ce qui permet de naviguer dans un rush lourd sans
saccade.

Si ffmpeg est absent, il n’y a pas de proxy, et la navigation dans les gros fichiers devient
laborieuse. Voir [Les assets](07-assets.md#si-la-préparation-vidéo-est-indisponible).

**À l’arrêt, le moniteur ne dessine rien.** Une image fixe repeinte soixante fois par seconde
consomme autant qu’une lecture — pour rien. Le moniteur s’arrête dès que la lecture s’arrête, ce qui
se remarque surtout sur un portable : le ventilateur se tait, la batterie tient.

---

## Le son du montage

**Le moniteur Programme joue les pistes audio pendant la lecture.** Appuyez sur lecture : chaque
clip posé sur une piste son se fait entendre à sa place, à son gain, à ses fondus et à sa vitesse,
et une piste muette ou hors solo se tait aussitôt — sans attendre la fin du clip en cours.

Quatre choses à savoir, parce qu’elles se remarquent :

- **Le son ne sort qu’en lecture.** Déplacer la tête de lecture à la main ne fait rien entendre :
  c’est l’image qui suit le curseur, pas le son.
- **Le moniteur Source joue le clip sélectionné**, son compris quand c’en est un — mais il
  n’affiche alors aucune image, un son n’en ayant pas. Sa tête de lecture ne se replace pas
  seule : venue d’un clip plus long, elle peut tomber après la fin du nouveau, qui reste muet.
- **Le son d’une vidéo n’est pas encore joué** : seules les pistes de son le sont. Une vidéo posée
  sur une piste image se voit sans s’entendre.
- **Le premier son peut mettre un instant à venir** : le fichier est décodé entier avant d’être
  joué. Un clip dont le début est déjà passé pendant ce temps ne rattrape pas son retard, il est
  sauté — le son resterait sinon derrière l’image pour tout le reste du clip.

---

## Quand un clip ne peut pas s’afficher

Le moniteur affiche alors, à la place de l’image :

> Ce clip n’a pas pu être affiché : son média est introuvable, ou son format n’est pas lisible ici.

Trois formats d’image s’importent sans s’afficher dans un moniteur — **`.exr`, `.tif` et
`.tiff`**. Ils entrent bien dans le projet, ils se posent bien sur une piste, mais le décodeur
d’images du studio ne les ouvre pas. Un fichier vidéo tronqué ou abîmé donne le même message.

**Le studio ne convertit rien.** Le message dit ce qui se passe ; il ne remplace pas votre
fichier. Pour monter un `.exr` ou un `.tif`, convertissez-le vous-même en `.png` avant de
l’importer.

> **Le message n’apparaît que si le moniteur ne montre rien d’autre.** Un clip illisible posé
> **au-dessus** d’une piste qui, elle, s’affiche laisse voir cette dernière, et se contente de
> disparaître : recouvrir une image correcte pour signaler l’autre coûterait plus qu’il ne
> rapporte.

---

## Ce qui manque encore

> **Une séquence s’enregistre** en `.seq` par `⌘S`, et se rouvre telle quelle : pistes, clips,
> fondus et gains. Ce qui ne revient pas, c’est l’historique d’annulation.
>
> Il n’y a en revanche toujours pas d’**export** : on ne peut pas encore écrire un fichier vidéo
> final. Voir [Ce qui n’existe pas encore](18-limites.md).

---

[← Espace 3D](09-espace-3d.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Audio →](11-espace-audio.md)
