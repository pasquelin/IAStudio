# 11. Espace Audio

[← Espace Vidéo](10-espace-video.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Textures →](12-espace-textures.md)

L’espace où l’on met un son en forme : le raccourcir, le faire monter en douceur, égaliser son
volume.

---

## Comment l’espace est disposé

Comme en Vidéo, la **bande basse appartient au montage** et l’étagère à assets prend la moitié
haute de la **colonne de droite**, pour qu’une prise se glisse de l’une vers l’autre sans avoir à
changer de panneau. La colonne de gauche porte les Modèles et la Génération, comme partout
ailleurs.

> **La bande basse est réservée, pas encore remplie.** Le montage multipiste de l’espace Audio
> n’existe pas : le panneau y affiche l’état vide de la Timeline tant qu’aucune séquence n’est en
> avant. La place lui est gardée ; ce chapitre décrit l’éditeur d’une prise à la fois.

---

## Ouvrir un son

**Deux gestes, dans cet ordre, et l’ordre compte :**

1. **Le bouton `+` du rail gauche** — il ouvre un onglet audio, vide pour l’instant.
2. **Double-cliquez sur un asset audio** dans l’étagère — la prise entre dans l’onglet. Vous
   pouvez aussi **l’y glisser** depuis l’étagère, ou passer par le clic droit, ligne
   **Ouvrir dans l’éditeur audio**.

Tant qu’aucun son n’est chargé, l’onglet affiche : « Aucun son ouvert. Déposez une prise ici, ou
double-cliquez sur un asset audio. »

> **Double-cliquer sans avoir ouvert d’onglet ne fait rien**, et rien ne le dit. Le double-clic
> envoie toujours l’asset dans l’onglet en avant ; s’il n’y en a pas, il n’a nulle part où
> l’envoyer. C’est expliqué en détail dans [Les assets](07-assets.md).

**Changer de prise se fait de la même façon** : double-cliquez sur un autre son, il remplace le
précédent. Attention, **tout ce que vous aviez réglé est perdu** — les coupes et les fondus se
mesurent sur la prise qui les a reçus, et n’auraient aucun sens reportés sur une autre.

Si le fichier ne peut pas être décodé, il le dit aussi : « Ce fichier n’a pas pu être décodé. »
C’est généralement un format inhabituel, ou un fichier abîmé.

---

## La forme d’onde

Le son s’affiche sous forme de **forme d’onde** : un dessin qui monte et descend selon le volume.

C’est la représentation universelle du son. On y voit d’un coup d’œil :

- **où ça parle et où c’est silencieux** — les creux plats sont des silences ;
- **où ça sature** — quand le dessin touche le haut et le bas du cadre ;
- **le rythme** — les pics réguliers d’une musique.

### Sélectionner une portion

**Glissez sur la forme d’onde** pour tracer une sélection. C’est sur cette portion que les outils
travaillent.

La lecture boucle sur la sélection tant qu’elle existe, ce qui permet de juger un passage en le
réécoutant.

Sans sélection, les outils qui en ont besoin travaillent sur des valeurs par défaut — un fondu
d’une seconde, par exemple.

---

## Les outils

| Outil | Ce qu’il fait |
|---|---|
| **Rogner** | ne garde que la sélection, jette le reste |
| **Fondu d’entrée** | fait monter le son depuis le silence, sur la sélection |
| **Fondu de sortie** | fait descendre le son vers le silence, sur la sélection |
| **Normaliser** | ramène le niveau général à −14 LUFS |
| **Couper les silences** | retire le silence au début et à la fin |
| **A/B** | fait entendre la source d’origine, sans rien annuler |

### Ce que « normaliser » veut dire

Rendre le son **ni trop faible, ni trop fort**, à un niveau standard.

**−14 LUFS** est la cible retenue par la plupart des plateformes de diffusion — YouTube, Spotify,
et les autres. Un son normalisé à cette valeur sonnera à peu près au même volume que ce qui
l’entoure, au lieu de faire sursauter ou d’obliger à monter le son.

Le « LUFS » mesure le volume **perçu**, pas le volume mesuré : il tient compte de la façon dont
l’oreille humaine entend. C’est pourquoi il vaut mieux que la simple recherche du pic le plus
fort.

### À quoi sert le bouton A/B

À **entendre ce que vous avez changé**.

Un clic, et le studio joue le son d’origine, tel qu’il était avant vos retouches. Un second clic,
et il rejoue votre version. Rien n’est annulé : c’est une comparaison, pas un retour en arrière.

C’est le geste le plus utile de tout l’espace. On croit souvent avoir amélioré un son, et l’A/B
dit la vérité en trois secondes.

---

## Rien n’est écrit tant que vous ne le dites pas

C’est le point important de cet espace.

Vos outils **n’écrivent pas dans le fichier**. Ils empilent une liste d’instructions — « rogner
ici », « fondu d’une seconde », « normaliser » — qui est rejouée par-dessus le son d’origine à
chaque fois.

Deux conséquences très pratiques :

- **annuler ne coûte rien**, quel que soit le nombre d’étapes ;
- **l’A/B est instantané**, parce que la source est toujours là, intacte.

Ce n’est qu’au moment où vous le demandez explicitement que quelque chose est écrit :

| Bouton | Ce qu’il fait |
|---|---|
| **Appliquer** | **réécrit l’asset** avec vos modifications. L’original est remplacé |
| **Enregistrer comme nouveau** | crée un **nouvel asset** à côté, nommé « *(édité)* » |

> **En cas de doute, prenez « Enregistrer comme nouveau ».** Vous gardez l’original, et vous
> pourrez toujours supprimer la copie si elle ne va pas.

---

## Annuler et rétablir

`⌘Z` / `Ctrl+Z` défait la dernière étape de la chaîne. `⇧⌘Z` la refait.

Comme partout dans le studio, l’historique appartient au document : l’onglet visé doit être en
avant.

---

## Ce que l’espace Audio ne fait pas

Volontairement. Ce ne sont pas des oublis :

- pas de **réduction de bruit** ;
- pas de **dé-esseur** ;
- pas de **réparation spectrale** ;
- pas d’**égaliseur**, pas de **compresseur**.

La raison est simple : ces outils répondent à des problèmes de **prise de son réelle** — un
micro qui souffle, une pièce qui résonne, un sifflement sur les « s ». Un son **généré** n’a pas
ces défauts : il est propre par construction.

Ce qui reste utile sur un son généré, c’est de le raccourcir, de l’amener au bon niveau et de le
faire entrer et sortir proprement. C’est exactement ce que fait cet espace.

> **Deux gestes différents, et il faut les distinguer.** `⌘S` enregistre le **document** — vos
> coupes, vos fondus, vos réglages — dans un fichier `.aud` du projet, qui se rouvre tel quel.
> **Appliquer** et **Enregistrer comme nouveau** écrivent un **asset audio**, c’est-à-dire un son
> utilisable ailleurs, avec les réglages fondus dedans.
>
> Autrement dit : `⌘S` garde votre travail modifiable, Appliquer en sort le résultat. Une seule
> chose ne revient pas d’un document rouvert : l’écoute A/B, qui repart toujours sur la chaîne.

---

[← Espace Vidéo](10-espace-video.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Textures →](12-espace-textures.md)
