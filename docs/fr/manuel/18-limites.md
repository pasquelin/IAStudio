# 18. Ce qui n'existe pas encore

[← Glossaire](17-glossaire.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Comment faire pour… →](19-recettes.md)

Les boutons gris, les promesses en cours, et ce qu'il ne faut pas attendre. La liste complète, à
jour, et honnête.

---

## Pourquoi ce chapitre existe

Un logiciel qui cache ce qu'il ne sait pas faire vous fait perdre une heure à chercher un bouton
qui n'existe pas.

Le studio a choisi l'inverse : **il montre ce qui vient**. Les outils qui ne fonctionnent pas
encore sont visibles et grisés, les vues à venir sont dans les barres, et ce chapitre dit
exactement où sont les bords.

Trois catégories, à ne pas confondre :

| | |
|---|---|
| **Pas encore fait** | c'est prévu, ce sera là un jour |
| **Volontairement absent** | ce ne sera pas fait, et il y a une raison |
| **Défaut connu** | ça marche mal, et c'est identifié |

---

## La limite qui compte le plus : l'enregistrement

**Trois types de documents sur six ne s'enregistrent pas encore.**

| Document | Extension | S'enregistre ? |
|---|---|---|
| Scène 3D | `.scene` | **oui** |
| Matière | `.tex` | **oui** |
| Image en calques | `.img` | **oui** |
| Séquence vidéo | `.seq` | non |
| Son édité | `.aud` | non |
| Ciel | `.sky` | non |

**Ce que cela veut dire concrètement.** Vous montez une séquence, vous éditez un son, vous réglez
un ciel. Vous fermez l'onglet. **Tout ce travail est perdu.** Les *assets* d'origine sont toujours
dans le projet — c'est votre travail dessus qui disparaît. L'image et la scène 3D, elles, se
rouvrent telles quelles.

**Ce qui n'est jamais perdu :**

- les **assets** — tout ce qui a été généré ou importé reste dans le projet, quoi qu'il arrive ;
- les **scènes 3D** et les **matières**, qui s'écrivent bien sur le disque ;
- en Audio, ce que vous validez par **Appliquer** ou **Enregistrer comme nouveau** : cet espace
  écrit directement des assets, sans passer par un document.

**En attendant :** ne fermez pas l'onglet tant que le travail compte, et notez ailleurs ce qui
mérite d'être refait — le *prompt*, la *graine*, le modèle.

---

## Espace Image

### Un document image ne s'ouvre pas *sur* un fichier

Une image de l'étagère **entre** bien dans un document — glissée sur la toile, double-cliquée, ou
choisie par l'outil **Image…** (`⇧⌘K`) : elle y devient un calque. Voir
[Espace Image](08-espace-image.md).

Ce qui n'existe pas, c'est le geste inverse : **rouvrir plus tard le document qu'on a composé**.
Il n'y a pas de menu « Ouvrir », parce qu'il n'y a rien à rouvrir — la pile de calques ne
s'enregistre nulle part. `⇧⌘E` sort un `.png` aplati ; ce PNG, réimporté, revient comme une image
et non comme ses calques.

### Outils annoncés mais inactifs

Ils sont visibles dans la barre d'outils, en gris.

| Outil | Groupe |
|---|---|
| **Section** (`⇧S`) | Cadre |
| **Découpe** (`S`) | Cadre |
| **Plume** | Dessin |
| **Texte sur chemin** | Texte |

**Le Commentaire (`C`) est le seul qui ne soit pas grisé.** Il s'arme comme les autres, et il ne
fait rien : cliquer dans l'image ne pose aucune note. C'est le seul bouton du studio qui ait l'air
vivant sans l'être — les autres disent leur état par leur gris.

### Le recadrage ne rend pas ses pixels à l'annulation

**Les cinq sont offerts** — Fusionner, Aplatir, le miroir, le quart de tour, et depuis peu le
**recadrage** (`F`). Ce qui les bloquait était qu'une surface de calque ne suivait pas son
document ; elle le suit maintenant.

Le recadrage a en revanche une limite qu'il faut connaître avant de s'en servir : **rétrécir le
document jette pour de bon ce qui tombe hors du cadre**. `⌘Z` rétablit la taille d'origine, mais
la zone retirée revient vide, et les traits de pinceau qu'elle contenait ne reviennent pas non
plus. C'est le comportement de Photoshop quand « Supprimer les pixels rognés » est coché — sauf
que son historique à lui sait les rendre.

**La raison.** Les pixels ne vivent pas dans le document mais dans des textures GPU, et
l'historique n'en garde que des tuiles de 512 px, plafonnées à 256 Mo. Un recadrage sévère
retirerait plus de tuiles que ce plafond n'en autorise. Garder l'intégralité de l'image d'avant
demanderait des instantanés pleine taille dans la pile d'annulation, ce que le studio s'interdit
justement pour que `⌘Z` reste instantané sur des documents lourds.

**Ce qu'il faut faire :** `⇧⌘E` avant un recadrage large, si vous pensez revenir en arrière.

### Remplir n'est pas un pot de peinture

**Remplir le calque** (`G`) remplit le calque **entier**, d'un bord à l'autre. Ce n'est pas le
remplissage par zone que vous connaissez peut-être ailleurs — celui qui s'arrête aux contours.

Ce n'est pas un défaut : c'est un outil différent, qui porte bien son nom.

### L'historique s'arrête à 100

La *pile d'annulation* garde les **100 dernières** actions. Au-delà, les plus anciennes
disparaissent définitivement.

### L'export aplatit, l'enregistrement non

`⇧⌘E` écrit le document **aplati** en `.png` où vous voulez : une seule image, les calques fondus
ensemble. Ce n'est pas une sauvegarde — c'est une sortie.

Pour garder la pile de calques, c'est `⌘S` : un document image **s'enregistre** depuis peu, en
dossier `.img`. Les deux gestes ne servent pas à la même chose et aucun ne remplace l'autre.

---

## Espace 3D

### Le texte 3D n'offre qu'une graisse par famille

**Ajouter ▸ Objet ▸ Texte** fonctionne — voir [l'espace 3D](09-espace-3d.md). Deux réserves.

**Une seule coupe par famille.** La liste offre le romain de chaque police et rien d'autre : pas
de gras, pas d'italique. Une famille qui installe neuf graisses n'occupe donc qu'une ligne, ce
qui est le bon compromis tant que le studio n'a pas de sélecteur de graisse.

**Une police du système ne voyage pas.** Elle reste écrite dans le document, mais une machine qui
ne l'a pas dessine les lettres dans la police embarquée par défaut, en marquant le nom manquant
dans la liste. Les trois polices que le studio embarque, elles, s'ouvrent partout à l'identique.

**Et quelques polices anciennes ne s'ouvrent pas du tout** : la bibliothèque de lecture de polices
que le studio emploie ne connaît pas tous les formats de table que les faces héritées d'avant les
années 2000 emploient. Sur une machine Apple, cela concerne une police sur dix environ. Le texte
retombe alors sur la police par défaut, et le journal dit laquelle a échoué.

### Le raccourci `S` fait deux choses à la fois

Dans la vue 3D, `S` choisit l'outil **Redimensionner** *et* fait reculer la caméra tant qu'on le
tient. Les deux tables de touches — les outils et le vol — sont lues sur le même appui.

En pratique on le remarque peu : prendre l'outil recule la caméra d'un cheveu. Mais c'est un
chevauchement, pas une intention.

### Les touches de vol ne se remappent pas

`W A S D Q E` et la touche d'accélération sont figées. Elles n'apparaissent pas dans l'écran des
raccourcis, et le bouton **Chercher par touche** ne les trouve pas.

---

## Espace Vidéo

### Pas d'enregistrement, pas d'export

**Une séquence ne s'écrit pas sur le disque** : fermer l'onglet perd le montage.

**Il n'y a pas d'export** : on ne peut pas encore produire un fichier vidéo final. C'est la limite
la plus lourde du studio à ce jour, parce qu'elle empêche de livrer.

Les *assets* qui composaient le montage, eux, restent dans le projet.

### Les réglages d'une séquence sont figés

Une séquence neuve part toujours sur 1920 × 1080, 25 images par seconde, 48 000 Hz. Ces valeurs ne
se changent pas encore.

---

## Espace Audio

### Ce qui est volontairement absent

Ce ne sont **pas** des oublis :

- pas de **réduction de bruit** ;
- pas de **dé-esseur** ;
- pas de **réparation spectrale** ;
- pas d'**égaliseur**, pas de **compresseur**.

**La raison.** Ces outils répondent à des problèmes de **prise de son réelle** : un micro qui
souffle, une pièce qui résonne, un sifflement sur les « s ». Un son **généré** n'a pas ces
défauts — il est propre par construction.

Ce qui reste utile sur un son généré, c'est de le raccourcir, de l'amener au bon niveau et de le
faire entrer et sortir proprement. C'est exactement ce que fait cet espace, et rien de plus.

### Pas de document audio

Il n'y a pas de fichier `.aud` sur le disque. L'espace Audio écrit directement des *assets*, via
**Appliquer** ou **Enregistrer comme nouveau**. Ce n'est pas une perte : c'est un autre modèle de
travail, et il est complet.

---

## Espace Textures

### Ce qui manque

- **le panneau de matière** — rugosité, métallicité, relief, répétition, émission, réglables en
  direct ;
- **la bande des huit canaux**, avec leurs vignettes et leur import individuel ;
- **les dérivations automatiques** — fabriquer les *normales* depuis la *hauteur*, par exemple ;
- **l'aperçu de répétition** en 1×, 2×, 4×, et la détection des coutures visibles ;
- **l'export** vers glTF, Unity, Unreal, Roblox.

Ce qui fonctionne aujourd'hui : générer une matière, la regarder sur cinq formes différentes sous
un éclairage neutre, et l'enregistrer. C'est déjà le geste central — juger une matière sur un
objet éclairé plutôt que sur un carré à plat.

---

## Espace Skyboxes

### Trois vues sur quatre ne dessinent rien

La barre d'aperçu propose quatre vues. Une seule fonctionne.

| Vue | État |
|---|---|
| **360°** | fonctionne |
| **Équirect** | bouton inactif |
| **Croix** | bouton inactif |
| **6 faces** | bouton inactif |

### La section Génération n'a pas ses boutons

Elle affiche bien le modèle, le prompt et la graine qui ont produit le ciel, en lecture seule. Mais
les deux boutons que les traductions annoncent — **Régénérer** et **Réinitialiser** — ne sont posés
nulle part dans le panneau.

En attendant, on recopie le prompt et la graine à la main dans le panneau **Génération**, ce qui
revient au même en trois gestes de plus.

### Pas d'enregistrement, pas d'export

Un ciel ne s'écrit pas dans un fichier `.sky` : **fermer l'onglet perd les réglages** —
l'exposition, la rotation de l'horizon, la position du soleil.

Et l'on ne peut pas exporter les six faces d'un cube, ni un *HDRI* utilisable dans un autre
logiciel.

---

## Import

### Ce qui s'importe

| Type | Extensions |
|---|---|
| **Vidéo** | `mp4` `mov` `mkv` `webm` `avi` `mxf` `m4v` |
| **Audio** | `wav` `mp3` `aac` `flac` `m4a` `ogg` |
| **Image** | `png` `jpg` `jpeg` `webp` `tif` `tiff` `exr` |
| **3D** | `glb` |

### Ce qui ne s'importe pas

- **les fichiers 3D autres que `.glb`** — `.gltf` séparé, `.obj`, `.fbx` ;
- **les HDRI** — `.hdr`.

Un `.exr` s'importe, mais il est catalogué comme **image**, pas comme ciel. Il fonctionne quand
même comme source pour une *skybox* : il faut simplement aller le chercher dans les images.

### Le fichier n'est pas copié

Le studio crée un **lien** vers votre fichier, là où il se trouve. Déplacer ou supprimer
l'original casse le lien.

Ce n'est pas un défaut mais un choix : copier des rushes de plusieurs gigaoctets dans chaque
projet remplirait votre disque pour rien.

---

## Réglages et raccourcis

### Deux familles n'ont pas de modèle par défaut

**Réglages ▸ Génération** propose sept sous-sections : Image, Vidéo, 3D, Audio, Agrandissement,
Détourage, Vectorisation. **Texture** et **Skybox** manquent, alors que ce sont désormais des
familles de modèles à part entière.

Conséquence : dans les espaces Textures et Skyboxes, le panneau **Génération** n'apparaît qu'après
avoir choisi un modèle à la main, et il faut recommencer à chaque session — les autres espaces
peuvent, eux, mémoriser leur choix.

### Un projet reste sur votre disque, toujours

Le fichier de réglages prévoit un choix entre « sur votre disque » et « dans le nuage » pour
l'endroit où un projet vit. **Le second n'est pas implémenté**, et le choix n'est donc offert
nulle part dans l'interface. Offrir un bouton qui ne mène nulle part serait une promesse que le
logiciel ne peut pas tenir.

> **À ne pas confondre avec la bibliothèque de votre compte**, qui, elle, existe : vous pouvez
> **envoyer** des assets vers elle depuis l'étagère. Ce sont deux choses différentes — l'une est
> l'endroit où le projet lui-même est rangé, l'autre est un stock d'assets en ligne à côté du
> projet. Voir [Les assets](07-assets.md).

### Le rapatriement n'a pas de bouton

L'envoi vers la bibliothèque existe ; le chemin inverse non. Le studio sait rapatrier et sait
comparer les deux côtés — c'est écrit et testé — mais aucun bouton ne le déclenche, et aucun écran
ne montre le contenu de la bibliothèque.

Conséquence directe, et ce n'est pas une panne : sur les sept badges qu'un asset peut porter,
**trois ne peuvent pas apparaître** — « à rapatrier », « modifié des deux côtés » et « appartient
à un autre projet ». Tant que rien ne bouge sans que vous le demandiez, l'autre côté ne peut pas
prendre de l'avance sur le vôtre.

### Sur Windows et Linux, `⌘` est pris au pied de la lettre

Deux défauts distincts, l'un d'affichage, l'autre de fonctionnement.

**L'affichage** : les infobulles et l'écran des raccourcis dessinent le symbole `⌘` du Mac au lieu
de `Ctrl`, partout.

**Le fonctionnement** : les raccourcis portés par le menu du système — `⌘Z`, `⌘S`, `⌘N` — répondent
bien à `Ctrl`, c'est le menu qui les déclenche. Mais ceux qu'une surface écoute elle-même, comme
`⌘D` dans la vue 3D, attendent la touche **Windows** et non `Ctrl` : ils sont pour l'instant hors
d'atteinte ailleurs que sur un Mac.

---

## Ce que le studio ne fera pas

Ce ne sont pas des manques : ce sont des bornes assumées.

### Il ne travaille pas hors ligne pour générer

La fabrication se passe sur les serveurs de Scenario. Sans connexion, vous pouvez ouvrir,
retoucher, monter, enregistrer — mais pas créer de nouveau contenu.

### Il n'est pas gratuit à l'usage

Chaque génération consomme le crédit de votre compte Scenario. Le studio ne vous facture rien : il
transmet. Mais votre compte, lui, compte.

### Il ne remplace pas Photoshop, Blender ni Premiere

Il en fait une part utile, au même endroit, **autour de la génération**. C'est un outil de
fabrication assistée, pas une suite de production complète.

### La fenêtre ne sera jamais translucide

Pas de vibrancy, pas de fond flouté derrière la fenêtre.

Dans un studio, on juge des couleurs. Un fond translucide fausse la perception de tout ce qui est
affiché au-dessus. C'est une décision de métier, et elle ne changera pas.

### Vos identifiants ne s'afficheront jamais

Il n'y a pas de bouton « voir ma clé API », et il n'y en aura pas. Une fois enregistrée, la clé
est chiffrée par le *trousseau* de votre système, et la partie du logiciel qui dessine l'écran
n'y a **structurellement** pas accès.

Ce n'est pas une gêne à contourner : c'est ce qui garantit qu'une capture d'écran de vos réglages
ne peut pas divulguer votre compte.

---

## Récapitulatif : par ordre d'importance

Si vous ne deviez retenir que cinq choses de ce chapitre :

1. **Les séquences, sons et ciels ne s'enregistrent pas** — fermer l'onglet perd le travail ;
   l'image et la scène 3D, elles, se rouvrent telles quelles ;
2. **un recadrage ne se défait qu'à moitié** — `⌘Z` rend le cadre, jamais les pixels rognés ;
   exportez avant de rogner large ;
3. **il n'y a pas d'export vidéo** — le studio ne peut pas encore livrer un fichier final ;
4. **les familles Texture et Skybox n'ont pas de modèle par défaut** — ces deux espaces font
   rechoisir leur modèle à chaque session ;
5. **on ne peut pas importer de HDRI** ni de modèle 3D autre qu'un `.glb`.

Tout le reste est du confort.

---

[← Glossaire](17-glossaire.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Comment faire pour… →](19-recettes.md)
