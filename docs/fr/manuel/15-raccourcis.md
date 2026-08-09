# 15. Tous les raccourcis

[← Tous les réglages](14-reglages.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Quand ça coince →](16-depannage.md)

La liste complète des touches, par contexte, et comment les changer.

---

## Lire un raccourci

Les touches sont écrites avec des symboles, les mêmes partout dans le studio.

| Symbole | Touche | Où |
|---|---|---|
| `⌘` | Commande | macOS. C’est `Ctrl` sur Windows et Linux |
| `⇧` | Majuscule (Shift) | partout |
| `⌥` | Option / Alt | partout |
| `⌃` | Contrôle | macOS |

`⌘Z` se lit donc « Commande + Z » sur un Mac, et « Ctrl + Z » ailleurs. Les symboles s’écrivent
collés : `⇧⌘Z` veut dire les trois touches ensemble.

> **Sur Windows et Linux, `⌘` est pris au pied de la lettre.** L’infobulle et l’écran des
> raccourcis dessinent le symbole du Mac partout ; et si les raccourcis du menu du système
> répondent bien à `Ctrl`, ceux qu’une surface écoute elle-même attendent la touche Windows. Les
> deux défauts sont listés dans [Ce qui n’existe pas encore](18-limites.md).

---

## Une notion à comprendre : le contexte

**Le même raccourci ne fait pas la même chose partout.**

`S` coupe un clip dans le montage, et redimensionne un objet dans la vue 3D. `Suppr` retire un
clip ici, un objet là. Ce n’est pas une collision : c’est **exprès**.

Le studio range chaque action dans un **contexte** — la surface où elle a un sens. Une seule
surface écoute à la fois, celle que vous regardez. Une touche partagée entre deux contextes ne
peut donc jamais être ambiguë.

Cinq contextes :

| Contexte | Où il s’applique |
|---|---|
| **Partout dans l’application** | n’importe quelle fenêtre, n’importe quel espace |
| **Dans la vue 3D** | le viewport de l’espace 3D |
| **Dans le montage** | la timeline de l’espace Vidéo et de l’espace Audio |
| **Dans l’image** | le canvas de l’espace Image |
| **Dans le ciel** | la vue de l’espace Skyboxes |

Un seul contexte est spécial : **Partout dans l’application**. Ses touches passent par le menu du
système d’exploitation, qui les attrape avant tout le monde. Elles sont donc les seules à ne
jamais pouvoir être « recouvertes » par un autre contexte — et les seules dont un conflit est
toujours un vrai conflit.

---

## Partout dans l’application

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Nouveau projet** | `⌘N` | crée un projet vide et l’ouvre |
| **Ouvrir un projet** | `⌘O` | ouvre un projet existant à la place de celui en cours |
| **Enregistrer le document** | `⌘S` | écrit le document en avant dans le projet |
| **Réglages** | `⌘,` | ouvre la fenêtre des réglages |
| **Plein écran** | `⌃⌘F` | fait occuper tout l’écran à la fenêtre |
| **Réinitialiser la disposition** | *aucune* | remet les panneaux là où ils étaient au départ |

**Réinitialiser la disposition** n’a volontairement **pas** de touche par défaut : c’est une action
qu’on cherche une fois tous les six mois, et lui donner un raccourci reviendrait à occuper une
touche pour rien. Elle est dans le menu **Affichage**, et vous pouvez lui en attribuer une (voir
plus bas).

> **Le projet ouvert s’enregistre au fur et à mesure.** `⌘S` ne concerne que le **document** en
> cours — une scène 3D, par exemple — pas le projet lui-même. L’onglet porte un point (`•`) tant
> que ce qui est à l’écran n’est pas ce qui est sur le disque.

---

## Dans la vue 3D

### Les outils

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Sélectionner** | `V` | l’outil de base : cliquer un objet pour le choisir, sans rien lui faire |
| **Déplacer** | `G` | tirer sur les flèches de couleur pour le glisser |
| **Pivoter** | `R` | tirer sur les cercles de couleur pour le faire tourner |
| **Redimensionner** | `S` | tirer sur les poignées. `⇧` garde les proportions |
| **Magnétisme** | `M` | fait avancer les poignées par pas réguliers. Les pas se règlent dans les préférences |
| **Repère local** | `L` | aligne les poignées sur l’orientation de l’objet plutôt que sur celle du monde |
| **Projection** | `O` | bascule entre perspective et projection orthographique |
| **Affichage** | `Z` | fait défiler rendu, filaire, rendu et filaire |
| **Cadrer la sélection** | `F` | rapproche la caméra pour que l’objet remplisse la vue |
| **Supprimer** | `Suppr` | retire tout ce qui est sélectionné. `⌘Z` le fait revenir |

### Assembler et dupliquer

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Grouper** | `⌘G` | range les objets sélectionnés sous un même groupe |
| **Dupliquer** | `⌘D` | pose une copie de la sélection au même endroit, et la sélectionne |
| **Copier** | `⌘C` | retient la sélection, sans toucher à la scène |
| **Couper** | `⌘X` | la retient et la retire de la scène |
| **Coller** | `⌘V` | pose ce qui a été retenu dans la scène en cours |

> Ce presse-papiers est celui du studio : il ne touche pas à celui du système, et `⌘C` laisse la
> main dès que du texte est sélectionné à l’écran.

### Annuler et rétablir

| Action | Touche |
|---|---|
| **Annuler** | `⌘Z` |
| **Rétablir** | `⇧⌘Z` |

### Voler dans la scène

Ces touches se **maintiennent** au lieu de se presser : tant que vous appuyez, la caméra bouge.

| Direction | Touche (clavier QWERTY) | Touche (clavier AZERTY) |
|---|---|---|
| **Avancer** | `W` | `Z` |
| **Reculer** | `S` | `S` |
| **Gauche** | `A` | `Q` |
| **Droite** | `D` | `D` |
| **Monter** | `E` | `E` |
| **Descendre** | `Q` | `A` |
| **Accélérer** | `⇧` gauche | `⇧` gauche |

> **Pourquoi deux colonnes.** Le studio écoute la **position** de la touche sur le clavier, pas la
> lettre écrite dessus. Les quatre touches de direction sont donc toujours le même carré, en haut
> à gauche : `WASD` si votre clavier est américain, `ZQSD` s’il est français. Vous n’avez rien à
> régler.

La vitesse et l’accélération se règlent dans les [réglages](14-reglages.md#espaces-de-travail).

> **`S` fait deux choses à la fois dans la vue 3D** : il choisit l’outil **Redimensionner** *et*
> fait reculer la caméra tant qu’on le tient. C’est un chevauchement connu — voir
> [Ce qui n’existe pas encore](18-limites.md). En pratique on le remarque peu : appuyer sur `S`
> pour prendre l’outil recule la caméra d’un cheveu.

### Ce que la souris fait, sans raccourci

| Geste | Effet |
|---|---|
| **Clic gauche** | choisit l’objet sous le curseur |
| **Clic droit maintenu + souris** | tourne la tête, sur place |
| **Molette** | avance ou recule |
| **Clic sur une poignée + glisser** | applique l’outil en cours |

---

## Dans le montage

### Lecture

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Lire / Pause** | `Espace` | lance la lecture, ou l’arrête là où elle en est |
| **Aller au début** | `Début` (`Home`) | ramène la tête de lecture tout au début |
| **Aller à la fin** | `Fin` (`End`) | envoie la tête de lecture après le dernier clip |

> **`Espace` ne se répète pas.** Une touche maintenue répète l’appui trente fois par seconde ; une
> lecture qui démarre et s’arrête trente fois par seconde est un stroboscope, pas un raccourci. Le
> studio ignore les répétitions.

### Montage

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Couper le clip** | `S` | coupe en deux à la tête de lecture |
| **Supprimer le clip** | `Suppr` | retire le clip du montage. Le fichier d’origine reste dans les assets |

### Zoom

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Zoomer** | `⌘=` | étale le montage pour voir le détail |
| **Dézoomer** | `⌘−` | resserre pour en voir davantage d’un coup |
| **Tout afficher** | `⇧Z` | ajuste pour que le montage entier tienne à l’écran |

### Annuler et rétablir

| Action | Touche |
|---|---|
| **Annuler** | `⌘Z` |
| **Rétablir** | `⇧⌘Z` |

---

## Dans l’image

### Armer un outil

Chaque outil de la barre est une commande : sa touche l’arme, et se remappe comme les autres.

| Touche | Outil | | Touche | Outil |
|---|---|---|---|---|
| `V` | Déplacement | | `R` | Rectangle |
| `H` | Main | | `⇧R` | Trait |
| `K` | Mise à l’échelle | | `A` | Flèche |
| `F` | Recadrage | | `O` | Ellipse |
| `M` | Sélection rectangulaire | | `P` | Pinceau |
| `L` | Lasso | | `⇧P` | Crayon |
| `T` | Texte | | `E` | Gomme |
| `G` | Remplir le calque | | `I` | Pipette |

**Quatre outils n’ont pas de touche par défaut** — sélection elliptique, polygone, étoile, gomme
sélective — et vous pouvez leur en donner une dans les réglages.

> **Le Trait a changé de touche.** Il répondait à `L`, qui servait déjà au Lasso dans le même
> contexte ; il est passé à `⇧R`, près du Rectangle, et la Flèche à `A`.

### Recadrage

Ces deux touches n’agissent **que** tant qu’un cadre de recadrage est posé sur l’image, et
seulement dans l’onglet en avant. Ailleurs elles gardent leur sens habituel.

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Appliquer le recadrage** | `⏎` | rogne le document au cadre. `⌘Z` rend le cadre, pas les pixels |
| **Abandonner le recadrage** | `⎋` | retire le cadre sans rien rogner |

### Zoom et cadrage

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Zoom avant** | `⌘=` | agrandit la vue d’un cran, autour du centre |
| **Zoom arrière** | `⌘−` | réduit la vue d’un cran |
| **Ajuster à la fenêtre** | `⌘0` | cadre l’image entière, avec une marge, sans jamais l’agrandir |
| **Taille réelle** | `⌘1` | un pixel de l’image pour un pixel d’écran |

> **`⌘1` est la seule échelle où l’on juge la netteté.** À n’importe quel autre zoom, ce que vous
> voyez est un calcul, pas l’image.

### Repères

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Règles** | `⌘R` | affiche ou masque les deux règles graduées |
| **Repères** | `⌘;` | affiche ou masque les repères posés sur l’image |
| **Magnétisme** | `⇧⌘;` | fait coller ce qu’on déplace aux repères, aux bords et au centre |
| **Effacer les repères** | *aucune* | retire tous les repères. Annulable |

**Masquer les repères ne les efface pas** : ce sont deux actions différentes, et c’est pour cela
que la seconde n’a pas de raccourci — on ne veut pas l’atteindre par erreur.

### Sélection

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Désélectionner** | `⌘D` | abandonne la région sélectionnée : le pinceau retrouve tout le calque |
| **Faire un masque de la sélection** | *aucune* | masque le calque actif hors de la région sélectionnée |

### Demander au modèle

Cinq commandes qui envoient l’image au service. Aucune n’a de raccourci par défaut : elles coûtent
du crédit, et une touche pressée par mégarde n’a pas à en dépenser.

| Action | Ce qu’elle fait |
|---|---|
| **Régénérer la zone** | fait repeindre la région masquée du calque actif |
| **Étendre** | fait peindre au-delà des bords de l’image |
| **Détourer** | retire l’arrière-plan de l’image aplatie |
| **Agrandir** | augmente la définition de l’image aplatie |
| **Vectoriser** | convertit l’image aplatie en tracés |

**Aucune ne part toute seule.** Chacune aplatit le document, l’envoie, puis **remplit le
formulaire du panneau Génération** et vous le montre. C’est vous qui appuyez sur Générer, après
avoir vu ce qui part et avec quels réglages.

**Elles vivent dans le menu Image**, et nulle part ailleurs : sans raccourci par défaut, c’est la
seule porte. Détourer, Agrandir et Vectoriser demandent chacune un modèle d’une famille qui n’a pas
d’espace à elle ; il se règle dans **Réglages ▸ Génération**. Tant qu’aucun n’est réglé, l’édition
ne part pas et ouvre l’écran où en choisir un.

### Exporter

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Exporter l’image** | `⇧⌘E` | écrit le document aplati sur le disque, au format PNG |
| **Fusionner vers le bas** | `⌘E` | réunit le calque actif et celui juste en dessous, au même niveau |

Les cinq autres entrées du menu **Image** — Aplatir, les deux miroirs, les deux rotations — n’ont
pas de touche par défaut. Vous pouvez leur en donner une dans les [réglages](14-reglages.md).

### Annuler et rétablir

| Action | Touche |
|---|---|
| **Annuler** | `⌘Z` |
| **Rétablir** | `⇧⌘Z` |

---

## Dans le ciel

L’espace Skyboxes répond au clavier comme les autres.

| Action | Touche | Ce qu’elle fait |
|---|---|---|
| **Changer de vue** | `V` | fait défiler les quatre façons de regarder le ciel : immersive, panoramique, croix, faces |
| **Sondes de lumière** | `P` | montre ou cache les sphères témoins |
| **Annuler** | `⌘Z` | |
| **Rétablir** | `⇧⌘Z` | |

> **Les sondes ne sont pas un gadget.** Un ciel se juge à ce qu’il éclaire, pas à sa propre
> image : les sphères témoins montrent ce que votre panorama fait à une surface mate et à une
> surface miroir.

> **`V` fait bien défiler les quatre vues, mais trois ne dessinent rien encore.** Seule la vue
> immersive est branchée ; Équirect, Croix et 6 faces changent le bouton actif et rien d’autre.
> Voir [L’espace Skyboxes](13-espace-skyboxes.md).

---

## Une chose importante sur ⌘Z

**Chaque document a sa propre pile d’annulation.**

`⌘Z` défait la dernière action **de l’onglet en cours**, pas la dernière action que vous avez faite
dans le studio. Si vous retouchez une image, passez à une scène 3D, puis appuyez sur `⌘Z`, c’est
la scène qui recule d’un cran — l’image n’a pas bougé.

> **« ⌘Z semble ne rien faire. »** C’est presque toujours ceci : l’action que vous visez appartient
> à un autre onglet. Activez l’onglet, puis annulez.

**Quand vous tapez du texte, `⌘Z` annule votre texte.** Renommez un calque ou une piste, faites une
faute, appuyez sur `⌘Z` : c’est le mot que vous venez de taper qui recule, pas le dernier trait de
pinceau. Le studio s’efface tant que le curseur est dans un champ de saisie, et reprend la main dès
que vous en sortez.

Cela vaut aussi pour `⌘X`, `⌘C` et `⌘V` : dans un champ, ils travaillent sur le texte ; ailleurs,
sur ce que l’espace a sélectionné.

---

## Changer un raccourci

Réglages (`⌘,`) → **Raccourcis**.

Chaque action est une ligne : son nom, une phrase qui explique ce qu’elle fait, et un bouton
portant sa touche actuelle.

**Pour la changer :**

1. **cliquez sur le bouton** de la touche. Il devient bleu et affiche « Appuyez… » ;
2. **appuyez sur la combinaison** que vous voulez. Elle est enregistrée aussitôt.

Rien à taper, rien à épeler. C’est délibéré : personne ne sait comment s’appelle `⌘[`, et tout le
monde sait appuyer dessus.

| Situation | Ce qui se passe |
|---|---|
| Vous appuyez sur `Échap` | la capture s’arrête, la touche ne change pas |
| Vous appuyez sur une touche modificatrice seule (`⇧`, `⌘`…) | rien : un modificateur seul n’est pas un raccourci, il se tient pendant qu’on en presse une autre |
| L’action n’a aucune touche | le bouton affiche « Aucune » |

**Pour revenir à la touche d’origine** : la petite flèche circulaire à droite du bouton. Elle est
éteinte tant que vous n’avez rien changé.

> **Un raccourci changé n’est pas enregistré tout de suite.** Comme tous les réglages, il attend
> **Appliquer** ou **OK**. **Annuler** le rend à ce qu’il était.

### Les conflits

Si deux actions du **même contexte** — ou une action et une du contexte **Partout dans
l’application** — se retrouvent sur la même touche, les deux lignes passent en rouge, avec un
triangle d’alerte et le message :

> *Deux actions se disputent cette touche : une seule répondra.*

Le studio **ne vous empêche pas** de le faire. Il vous le montre, et vous laissez ou vous
corrigez.

**Deux contextes différents qui partagent une touche ne sont pas en conflit** et ne s’affichent
jamais en rouge : `S` dans le montage et `S` dans la vue 3D est le fonctionnement voulu, pas une
erreur.

### Retrouver ce qu’une touche fait

En haut de l’écran des raccourcis, un bouton **Chercher par touche**.

Cliquez, appuyez sur la combinaison qui vous intrigue, et la liste ne garde que les actions qui y
répondent. Si aucune ne s’affiche, le studio le dit :

> *Aucune action n’utilise cette touche : elle est libre.*

C’est la question qu’on se pose vraiment — « qu’est-ce que `⌘K` fait déjà ? » — plutôt que
l’inverse. Le bouton **Tout afficher** rend la liste complète.

### Ce qui ne se change pas encore

**Les touches de vol** (`W A S D Q E` et l’accélération) ne sont pas dans cet écran. Elles sont
figées pour l’instant. Voir [Ce qui n’existe pas encore](18-limites.md).

---

## Aide-mémoire, tout sur une page

| Touche | Partout | Vue 3D | Montage | Image | Ciel |
|---|---|---|---|---|---|
| `⌘N` | Nouveau projet | | | | |
| `⌘O` | Ouvrir un projet | | | | |
| `⌘S` | Enregistrer | | | | |
| `⌘,` | Réglages | | | | |
| `⌃⌘F` | Plein écran | | | | |
| `⌘Z` | | Annuler | Annuler | Annuler | Annuler |
| `⇧⌘Z` | | Rétablir | Rétablir | Rétablir | Rétablir |
| `⌘G` | | Grouper | | | |
| `⌘D` | | Dupliquer | | Désélectionner | |
| `⌘C` / `⌘X` / `⌘V` | | Copier / Couper / Coller | | | |
| `O` | | Projection | | | |
| `Z` | | Affichage | | | |
| `V` | | Sélectionner | | | Changer de vue |
| `P` | | | | | Sondes de lumière |
| `G` | | Déplacer | | | |
| `R` | | Pivoter | | | |
| `S` | | Redimensionner *(et reculer)* | Couper le clip | | |
| `M` | | Magnétisme | | | |
| `L` | | Repère local | | | |
| `F` | | Cadrer la sélection | | | |
| `Suppr` | | Supprimer l’objet | Supprimer le clip | | |
| `W A S D` | | Voler | | | |
| `Q` / `E` | | Descendre / Monter | | | |
| `⇧` gauche | | Accélérer | | | |
| `Espace` | | | Lire / Pause | | |
| `Début` / `Fin` | | | Début / Fin du montage | | |
| `⌘=` | | | Zoomer | Zoom avant | |
| `⌘−` | | | Dézoomer | Zoom arrière | |
| `⇧Z` | | | Tout afficher | | |
| `⌘0` | | | | Ajuster à la fenêtre | |
| `⌘1` | | | | Taille réelle | |
| `⌘R` | | | | Règles | |
| `⌘;` | | | | Repères | |
| `⇧⌘;` | | | | Magnétisme | |
| `⇧⌘E` | | | | Exporter l’image | |

---

[← Tous les réglages](14-reglages.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Quand ça coince →](16-depannage.md)
