# 8. Espace Image

[← Les assets](07-assets.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace 3D →](09-espace-3d.md)

L'espace où l'on peint, gomme, recadre et empile des calques.

---

## Ouvrir une image

Trois façons :

| Geste | Résultat |
|---|---|
| **Double-clic** sur une image dans l'étagère Assets | elle s'ouvre dans un onglet |
| Le bouton **+** du rail gauche | un document neuf, vide |
| Une génération qui aboutit | l'image arrive dans l'étagère, à vous de l'ouvrir |

---

## Naviguer dans l'image

Avant les outils, les gestes. Ils marchent quel que soit l'outil armé.

| Geste | Effet |
|---|---|
| **Molette** | fait défiler l'image, comme dans Figma |
| **⌘ + molette** / **Ctrl + molette** | zoome vers le pointeur |
| **Pincement** sur trackpad | zoome |
| **Maintenir Espace + glisser** | déplace la vue, quel que soit l'outil |
| **Clic du milieu + glisser** | déplace la vue aussi |

> Maintenir Espace change le curseur en main. Le geste est celui de tous les éditeurs d'image :
> vous n'avez pas à changer d'outil pour vous déplacer.

### La barre de zoom

En bas à droite de l'image, une petite barre flottante.

| Bouton | Effet | Raccourci |
|---|---|---|
| **−** | zoom arrière d'un cran | `⌘−` / `Ctrl+−` |
| **Le pourcentage** | revient à la taille réelle — un clic dessus | `⌘1` / `Ctrl+1` |
| **+** | zoom avant d'un cran | `⌘+` / `Ctrl+=` |
| **Ajuster** | l'image entière tient dans le panneau | `⌘0` / `Ctrl+0` |

Le zoom va de **2 %** à **6400 %**. En dessous de 100 %, le pourcentage affiche une décimale :
3 % et 3,7 % ne cadrent pas la même chose.

**Taille réelle** (`⌘1`) est la seule échelle où l'on juge la netteté : un pixel de l'image pour
un pixel d'écran.

### Les règles et les repères

| Élément | Raccourci | Ce que c'est |
|---|---|---|
| **Règles** | `⌘R` / `Ctrl+R` | deux graduations, en haut et à gauche |
| **Repères** | `⌘;` / `Ctrl+;` | des lignes d'alignement que vous posez |
| **Effacer les repères** | — | retire tous les repères |
| **Magnétisme** | `⇧⌘;` / `Ctrl+Shift+;` | ce que vous déplacez colle aux repères |

**Poser un repère** : tirez depuis une règle vers l'image. Tirez-le en dehors de l'image pour
l'enlever.

Masquer les repères ne les efface pas — ils reviennent au prochain `⌘;`.

Le magnétisme fait coller ce que vous déplacez aux repères, aux **bords de l'image** et à son
**centre**, à quelques pixels près. La tolérance est en pixels d'écran : elle ne change donc pas
selon le zoom.

---

## La barre d'outils

Elle est en haut du document. Les outils sont **groupés**, comme dans Figma :

- **survolez un groupe** pour voir le reste de ses outils ;
- **cliquez le bouton lui-même** pour armer l'outil qu'il montre déjà.

Autrement dit : un outil armé n'a jamais besoin du menu pour être repris.

### Groupe Curseur

| Outil | Raccourci | Ce qu'il fait |
|---|---|---|
| **Déplacement** | `V` | fait glisser le contenu du calque actif |
| **Main** | `H` | déplace la vue |
| **Mise à l'échelle** | `K` | *pas encore disponible* |

### Groupe Cadre

| Outil | Raccourci | Ce qu'il fait |
|---|---|---|
| **Recadrage** | `F` | redéfinit les bords de l'image |
| **Section** | `⇧S` | *pas encore disponible* |
| **Découpe** | `S` | *pas encore disponible* |

### Groupe Sélection

| Outil | Raccourci | Ce qu'il fait |
|---|---|---|
| **Sélection rectangle** | `M` | trace une zone rectangulaire |
| **Sélection ellipse** | — | trace une zone ovale |
| **Lasso** | `L` | trace une zone à main levée |

> Ces trois outils **dessinent** la zone mais ne la limitent pas encore : aucun outil ne
> restreint son action à la sélection pour l'instant. Voir
> [Ce qui n'existe pas encore](18-limites.md).

### Groupe Formes

| Outil | Raccourci | Ce qu'il fait |
|---|---|---|
| **Rectangle** | `R` | Maj pour un carré |
| **Trait** | `L` | Maj pour le contraindre à 45° |
| **Flèche** | `⇧L` | Maj pour la contraindre à 45° |
| **Ellipse** | `O` | Maj pour un cercle |
| **Polygone** | — | tracé depuis son centre |
| **Étoile** | — | tracée depuis son centre |
| **Image…** | `⇧⌘K` | *pas encore disponible* |

### Groupe Dessin

| Outil | Raccourci | Ce qu'il fait |
|---|---|---|
| **Pinceau** | `P` | peint, bord adouci |
| **Crayon** | `⇧P` | peint, bord net |
| **Plume** | — | *pas encore disponible* |

### Groupe Texte

| Outil | Raccourci | Ce qu'il fait |
|---|---|---|
| **Texte** | `T` | pose du texte sur le calque actif |
| **Texte sur chemin** | — | *pas encore disponible* |

### Groupe Gomme

| Outil | Raccourci | Ce qu'il fait |
|---|---|---|
| **Gomme ponctuelle** | `E` | efface au passage du pointeur |
| **Gomme sélective** | — | efface l'intérieur de la sélection d'un geste |

La gomme efface **vers la transparence**, elle ne peint pas en blanc.

### Outils isolés

| Outil | Raccourci | Ce qu'il fait |
|---|---|---|
| **Commentaire** | `C` | pose une note sur l'image |
| **Remplir le calque** | `G` | remplit **tout** le calque actif de la couleur courante |
| **Pipette** | `I` | prélève la couleur sous le pointeur |
| **Couleur** | — | la couleur du pinceau, des formes et du remplissage |

> **Remplir n'est pas un pot de peinture.** Il remplit le calque entier, d'un bord à l'autre.
> C'est ce qui donne un fond uni en un geste, mais ce n'est pas le remplissage par zone que vous
> connaissez peut-être ailleurs.

### Les outils grisés

Certains outils sont visibles mais inactifs. **C'est délibéré** : la barre annonce ce qui vient
plutôt que de cacher ce qui manque. Un outil qui apparaîtrait un jour sans prévenir serait plus
déroutant qu'un bouton gris.

Le chapitre [Ce qui n'existe pas encore](18-limites.md) en donne la liste complète.

---

## Les calques

Le panneau **Calques**, dans la colonne de gauche.

Un calque est une couche transparente empilée sur les autres. Le calque du haut recouvre ceux du
dessous. Vous peignez sur celui qui est **actif** — cliquez sur son nom pour le choisir.

| Action | Comment |
|---|---|
| **Ajouter un calque** | le bouton **+** du panneau — il se pose au-dessus de la pile |
| **Supprimer le calque** | le bouton de suppression — le dernier calque ne peut pas être supprimé |
| **Masquer / afficher** | l'œil, à gauche du nom |
| **Réordonner** | les boutons de pile, ou le glisser-déposer |

Un calque masqué est **estompé et barré** : on voit d'un coup d'œil ce qui est caché.

---

## Annuler et rétablir

| Action | Raccourci |
|---|---|
| **Annuler** | `⌘Z` / `Ctrl+Z` |
| **Rétablir** | `⇧⌘Z` / `Ctrl+Shift+Z` |

**L'historique appartient au document**, pas à l'application. Chaque onglet a sa propre pile.
Si `⌘Z` semble ne rien faire, c'est très probablement que l'action que vous visez appartient à un
autre onglet : cliquez d'abord sur celui-là.

Les gestes continus — un trait de pinceau, un glissement de calque — comptent pour **une seule**
entrée d'historique. Vous n'annulez pas un trait pixel par pixel.

> L'historique garde les **100 dernières** actions. Au-delà, les plus anciennes disparaissent.

<!-- CAPTURE : un document image, le volet du groupe Formes ouvert, la pile de calques visible.
     Vers ../../images/image-tools.png -->

---

## Ce qu'il faut savoir avant de fermer un onglet

> **Une image ne s'enregistre pas encore sur le disque.** Fermer son onglet perd les calques et
> l'historique. L'asset d'origine, lui, reste dans le projet — c'est le travail de retouche qui
> est perdu.
>
> Voir [Ce qui n'existe pas encore](18-limites.md).

---

[← Les assets](07-assets.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace 3D →](09-espace-3d.md)
