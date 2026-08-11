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

Deux gestes, et **ils ne posent pas le clip au même endroit** :

| Geste | Sur quelle piste | À quel instant |
|---|---|---|
| **Glisser-déposer** depuis l’étagère | celle que vous survolez, **exactement** | là où vous lâchez |
| **Double-clic** sur l’asset | le studio choisit | à la **tête de lecture** |

**Le glisser-déposer vous obéit au pixel près.** C’est vous qui visez la piste, donc c’est vous
qui décidez — y compris de viser une piste où le clip ne s’entendra pas. Lâcher sur la **règle des
temps**, en haut, ou en dehors de toute piste, **ne fait rien** : il n’y a pas de piste sous le
pointeur.

**Le double-clic choisit à votre place**, et il choisit bien : un son va sur une piste son, tout
le reste sur une piste image, et les pistes **verrouillées** ou **rendues muettes** sont évitées —
un clip qui y atterrirait aurait l’air de n’avoir rien fait.

Dans les deux cas, le studio décide de deux choses :

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
ne pourrait plus être bougé du tout. L’outil **Main** ne montre jamais cette double flèche : il
prend toute la surface pour faire défiler.

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
| `Suppr` | supprimer le clip sélectionné |
| `⌘Z` / `⇧⌘Z` | annuler / rétablir |

> **`C` et `S` ne font pas la même chose.** `C` **arme l’outil Lame** — vous coupez ensuite là où
> vous cliquez. `S` **coupe tout de suite**, à la tête de lecture, sans changer d’outil.

**Un seul lecteur est actif à la fois.** Si vous ouvrez deux séquences, seule celle qui est en
avant répond à la barre d’espace. C’est ce qui garde la lecture fluide : deux décodeurs vidéo qui
tournent en même temps se disputent la machine.

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
