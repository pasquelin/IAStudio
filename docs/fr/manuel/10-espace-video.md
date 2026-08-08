# 10. Espace Vidéo

[← Espace 3D](09-espace-3d.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Audio →](11-espace-audio.md)

L'espace où l'on assemble des plans les uns après les autres pour en faire une séquence.

---

## Comment l'espace est disposé

C'est le seul espace où la **bande basse appartient au montage**. Une séquence se lit sur toute
la largeur de l'écran : la **Timeline** y prend donc toute la place, et l'étagère à assets passe
dans la moitié haute de la colonne de gauche — libre dans cet espace — pour rester visible en même
temps.

Au centre, deux moniteurs côte à côte — la convention de Premiere et de DaVinci :

| Moniteur | Ce qu'il montre |
|---|---|
| **Source**, à gauche | le clip sélectionné, seul |
| **Programme**, à droite | le montage tel qu'il sera |

Quand aucun clip n'est sélectionné, le moniteur Source affiche « Sélectionnez un clip pour le
voir ici. »

---

## Le vocabulaire du montage

| Mot | Ce que c'est |
|---|---|
| **Séquence** | le montage entier, avec ses pistes |
| **Piste** | une ligne horizontale qui reçoit des clips. Il y a des pistes image et des pistes son |
| **Clip** | un morceau de média posé sur une piste |
| **Tête de lecture** | le trait vertical qui indique où on en est |
| **Rogner** (*trim*) | raccourcir un clip par l'un de ses bouts |
| **Point d'entrée** | l'endroit du fichier d'origine où le clip commence |

---

## Poser un premier clip

**Glissez un asset depuis l'étagère et lâchez-le sur la timeline.**

Le studio choisit alors :

- **la piste** — un son va sur une piste son, tout le reste sur une piste image. Les pistes
  verrouillées et muettes sont évitées, parce qu'un dépôt qui y atterrit a l'air de n'avoir rien
  fait ;
- **la durée** — celle du média. Une image fixe, ou un média dont la durée est inconnue, dure
  **5 secondes** par défaut ;
- **la position** — calée sur une image entière, jamais entre deux.

---

## Les outils

| Outil | Raccourci | Ce qu'il fait |
|---|---|---|
| **Sélection** | `V` | sélectionne, déplace et rogne les clips |
| **Lame** | `C` | coupe un clip là où vous cliquez |
| **Main** | `H` | fait défiler la timeline — molette pour zoomer |

### Avec l'outil Sélection

| Geste | Effet |
|---|---|
| **Clic** sur un clip | le sélectionne — l'inspecteur le montre |
| **Glisser** le corps du clip | le déplace, y compris d'une piste à l'autre |
| **Glisser** un bord du clip | le rogne de ce côté |

**Le magnétisme est automatique.** Un clip déplacé colle :

- à la **grille des images** — jamais entre deux images ;
- aux **bords des clips voisins**, pour qu'il n'y ait pas de trou d'un millième de seconde
  invisible à l'œil.

> Un clip rogné ne peut pas dépasser la longueur du média d'origine. Le studio arrête le
> rognage tout seul plutôt que d'afficher du noir.

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
| `⇧Z` | tout afficher — le montage entier tient à l'écran |
| `S` | **couper le clip à la tête de lecture** |
| `Suppr` | supprimer le clip sélectionné |
| `⌘Z` / `⇧⌘Z` | annuler / rétablir |

> **`C` et `S` ne font pas la même chose.** `C` **arme l'outil Lame** — vous coupez ensuite là où
> vous cliquez. `S` **coupe tout de suite**, à la tête de lecture, sans changer d'outil.

**Un seul lecteur est actif à la fois.** Si vous ouvrez deux séquences, seule celle qui est en
avant répond à la barre d'espace. C'est ce qui garde la lecture fluide : deux décodeurs vidéo qui
tournent en même temps se disputent la machine.

---

## Les pistes

La colonne de gauche de la timeline, face à chaque ligne.

| Contrôle | Effet |
|---|---|
| **Double-clic sur le nom** | renomme la piste |
| **Muette** | la piste n'est plus entendue |
| **Solo** | **seules** les pistes en solo sont entendues |
| **Verrouillée** | la piste refuse toute modification |
| **Tirer le bas de l'en-tête** | change la hauteur de la ligne |

**Solo l'emporte sur muet.** Dès qu'une piste passe en solo, toutes celles qui ne le sont pas se
taisent, qu'elles soient muettes ou non. C'est la convention de tous les logiciels de montage.

---

## L'inspecteur d'un clip

Sélectionnez un clip, et regardez l'**Inspecteur**, dans la colonne de droite.

| Champ | Ce qu'il fait |
|---|---|
| **Source** | de quel asset le clip vient |
| **Début** | où le clip commence dans la séquence |
| **Fin** | où il finit |
| **Durée** | sa longueur |
| **Point d'entrée** | à quel endroit du fichier d'origine il commence |
| **Fondu d'entrée** | une montée depuis le noir ou le silence, au début |
| **Fondu de sortie** | une descente vers le noir ou le silence, à la fin |
| **Vitesse** | 1 = normal, 0,5 = deux fois plus lent, 2 = deux fois plus rapide |
| **Gain** | le volume, en décibels. 0 laisse le son tel qu'il a été enregistré |

### L'inspecteur d'une piste

| Champ | Ce qu'il fait |
|---|---|
| **Nom** | le nom affiché |
| **Type** | image ou son |
| **Clips** | combien elle en contient |
| **État** | Muette, Solo, Verrouillée |
| **Hauteur** | la hauteur de la ligne |

<!-- CAPTURE : l'espace Vidéo, timeline avec plusieurs clips et les deux moniteurs au-dessus.
     Vers ../../images/timeline.png -->

---

## Les réglages d'une séquence

Une séquence neuve part sur :

| Réglage | Valeur |
|---|---|
| **Dimensions** | 1920 × 1080 |
| **Images par seconde** | 25 |
| **Fréquence d'échantillonnage audio** | 48 000 Hz |

Le temps est compté en **microsecondes** en interne, jamais en secondes décimales : sur un
montage long, les arrondis finiraient par décaler l'image du son.

---

## Pourquoi la lecture est fluide

Quand vous importez une vidéo, le studio en fabrique une **copie allégée** — un *proxy*. C'est
elle qui est lue pendant que vous montez, ce qui permet de naviguer dans un rush lourd sans
saccade.

Si ffmpeg est absent, il n'y a pas de proxy, et la navigation dans les gros fichiers devient
laborieuse. Voir [Les assets](07-assets.md#si-ffmpeg-est-absent).

**À l'arrêt, le moniteur ne dessine rien.** Une image fixe repeinte soixante fois par seconde
consomme autant qu'une lecture — pour rien. Le moniteur s'arrête dès que la lecture s'arrête, ce qui
se remarque surtout sur un portable : le ventilateur se tait, la batterie tient.

---

## Ce qui manque encore

> **Une séquence ne s'enregistre pas encore sur le disque.** Fermer son onglet perd le montage.
> Les assets, eux, restent dans le projet.
>
> Il n'y a pas non plus d'**export** : on ne peut pas encore écrire un fichier vidéo final. Voir
> [Ce qui n'existe pas encore](18-limites.md).

---

[← Espace 3D](09-espace-3d.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Audio →](11-espace-audio.md)
