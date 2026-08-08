# 11. Espace Audio

[← Espace Vidéo](10-espace-video.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Textures →](12-espace-textures.md)

L'espace où l'on met un son en forme : le raccourcir, le faire monter en douceur, égaliser son
volume.

---

## Ouvrir un son

**Double-cliquez sur un asset audio** dans l'étagère.

Tant qu'aucun son n'est ouvert, l'espace affiche : « Aucun son ouvert. Double-cliquez sur un
asset audio pour l'éditer. »

Si le fichier ne peut pas être décodé, il le dit aussi : « Ce fichier n'a pas pu être décodé. »
C'est généralement un format inhabituel, ou un fichier abîmé.

---

## La forme d'onde

Le son s'affiche sous forme de **forme d'onde** : un dessin qui monte et descend selon le volume.

C'est la représentation universelle du son. On y voit d'un coup d'œil :

- **où ça parle et où c'est silencieux** — les creux plats sont des silences ;
- **où ça sature** — quand le dessin touche le haut et le bas du cadre ;
- **le rythme** — les pics réguliers d'une musique.

### Sélectionner une portion

**Glissez sur la forme d'onde** pour tracer une sélection. C'est sur cette portion que les outils
travaillent.

La lecture boucle sur la sélection tant qu'elle existe, ce qui permet de juger un passage en le
réécoutant.

Sans sélection, les outils qui en ont besoin travaillent sur des valeurs par défaut — un fondu
d'une seconde, par exemple.

---

## Les outils

| Outil | Ce qu'il fait |
|---|---|
| **Rogner** | ne garde que la sélection, jette le reste |
| **Fondu d'entrée** | fait monter le son depuis le silence, sur la sélection |
| **Fondu de sortie** | fait descendre le son vers le silence, sur la sélection |
| **Normaliser** | ramène le niveau général à −14 LUFS |
| **Couper les silences** | retire le silence au début et à la fin |
| **A/B** | fait entendre la source d'origine, sans rien annuler |

### Ce que « normaliser » veut dire

Rendre le son **ni trop faible, ni trop fort**, à un niveau standard.

**−14 LUFS** est la cible retenue par la plupart des plateformes de diffusion — YouTube, Spotify,
et les autres. Un son normalisé à cette valeur sonnera à peu près au même volume que ce qui
l'entoure, au lieu de faire sursauter ou d'obliger à monter le son.

Le « LUFS » mesure le volume **perçu**, pas le volume mesuré : il tient compte de la façon dont
l'oreille humaine entend. C'est pourquoi il vaut mieux que la simple recherche du pic le plus
fort.

### À quoi sert le bouton A/B

À **entendre ce que vous avez changé**.

Un clic, et le studio joue le son d'origine, tel qu'il était avant vos retouches. Un second clic,
et il rejoue votre version. Rien n'est annulé : c'est une comparaison, pas un retour en arrière.

C'est le geste le plus utile de tout l'espace. On croit souvent avoir amélioré un son, et l'A/B
dit la vérité en trois secondes.

---

## Rien n'est écrit tant que vous ne le dites pas

C'est le point important de cet espace.

Vos outils **n'écrivent pas dans le fichier**. Ils empilent une liste d'instructions — « rogner
ici », « fondu d'une seconde », « normaliser » — qui est rejouée par-dessus le son d'origine à
chaque fois.

Deux conséquences très pratiques :

- **annuler ne coûte rien**, quel que soit le nombre d'étapes ;
- **l'A/B est instantané**, parce que la source est toujours là, intacte.

Ce n'est qu'au moment où vous le demandez explicitement que quelque chose est écrit :

| Bouton | Ce qu'il fait |
|---|---|
| **Appliquer** | **réécrit l'asset** avec vos modifications. L'original est remplacé |
| **Enregistrer comme nouveau** | crée un **nouvel asset** à côté, nommé « *(édité)* » |

> **En cas de doute, prenez « Enregistrer comme nouveau ».** Vous gardez l'original, et vous
> pourrez toujours supprimer la copie si elle ne va pas.

---

## Annuler et rétablir

`⌘Z` / `Ctrl+Z` défait la dernière étape de la chaîne. `⇧⌘Z` la refait.

Comme partout dans le studio, l'historique appartient au document : l'onglet visé doit être en
avant.

---

## Ce que l'espace Audio ne fait pas

Volontairement. Ce ne sont pas des oublis :

- pas de **réduction de bruit** ;
- pas de **dé-esseur** ;
- pas de **réparation spectrale** ;
- pas d'**égaliseur**, pas de **compresseur**.

La raison est simple : ces outils répondent à des problèmes de **prise de son réelle** — un
micro qui souffle, une pièce qui résonne, un sifflement sur les « s ». Un son **généré** n'a pas
ces défauts : il est propre par construction.

Ce qui reste utile sur un son généré, c'est de le raccourcir, de l'amener au bon niveau et de le
faire entrer et sortir proprement. C'est exactement ce que fait cet espace.

> **Un son édité ne se réenregistre pas comme document.** L'espace Audio écrit directement des
> assets, via Appliquer ou Enregistrer comme nouveau. Il n'y a pas de fichier `.aud` sur le
> disque pour l'instant — voir [Ce qui n'existe pas encore](18-limites.md).

---

[← Espace Vidéo](10-espace-video.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Textures →](12-espace-textures.md)
