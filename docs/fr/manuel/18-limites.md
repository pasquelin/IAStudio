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

**Quatre types de documents sur six ne s'enregistrent pas encore.**

| Document | Extension | S'enregistre ? |
|---|---|---|
| Scène 3D | `.scene` | **oui** |
| Matière | `.tex` | **oui** |
| Image en calques | `.img` | non |
| Séquence vidéo | `.seq` | non |
| Son édité | `.aud` | non |
| Ciel | `.sky` | non |

**Ce que cela veut dire concrètement.** Vous retouchez une image : vous peignez, vous ajoutez des
calques, vous recadrez. Vous fermez l'onglet. **Tout ce travail est perdu.** L'*asset* d'origine
est toujours dans le projet — c'est votre retouche qui disparaît.

Idem pour un montage vidéo, pour les réglages d'un ciel.

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
| **Recadrage** (`F`) | Cadre |
| **Section** (`⇧S`) | Cadre |
| **Découpe** (`S`) | Cadre |
| **Plume** | Dessin |
| **Texte sur chemin** | Texte |
| **Commentaire** (`C`) | Commentaire |

### Recadrer, retourner et pivoter ne sont pas offerts

Le geste est écrit et le recadrage fonctionne, mais **redimensionner le cadre déplace les calques
sans déplacer leurs pixels** : après un recadrage, le pinceau peindrait à côté du curseur. Il en va
de même pour un miroir ou un quart de tour, qui poseraient les calques hors du cadre.

C'est la même pièce manquante qui empêche **Fusionner** et **Aplatir** d'être proposés. Un bouton
qui abîme le document est pire qu'un bouton absent.

### Remplir n'est pas un pot de peinture

**Remplir le calque** (`G`) remplit le calque **entier**, d'un bord à l'autre. Ce n'est pas le
remplissage par zone que vous connaissez peut-être ailleurs — celui qui s'arrête aux contours.

Ce n'est pas un défaut : c'est un outil différent, qui porte bien son nom.

### L'historique s'arrête à 100

La *pile d'annulation* garde les **100 dernières** actions. Au-delà, les plus anciennes
disparaissent définitivement.

### L'export existe, l'enregistrement non

`⇧⌘E` écrit le document aplati en `.png` où vous voulez. En revanche **un document image ne
s'enregistre pas** : fermer l'onglet perd la pile de calques et tout ce qui a été peint. Voir plus
haut, « Ce que cela veut dire concrètement ».

---

## Espace 3D

### Ce qui manque

- **la sélection multiple** — un seul objet à la fois ;
- **les groupes** et le reparentage — on ne peut pas assembler des objets en un sous-ensemble ;
- **le copier-coller** et la duplication ;
- **l'import de modèles** `.glb`, `.gltf`, `.obj` — on ne peut poser que ce que le studio sait
  construire ou générer ;
- **les ombres portées** — les objets sont éclairés, mais ne projettent pas d'ombre ;
- **l'éclairage par image** (*IBL*) dans le viewport — une *skybox* n'éclaire pas encore une
  scène 3D, alors qu'elle éclaire bien l'aperçu de l'espace Skyboxes ;
- **le magnétisme** et le pivot local.

### Deux objets annoncés mais non constructibles

**Sprite** et **Texte** apparaissent grisés dans le menu **Ajouter**.

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

### Un ciel n'éclaire pas encore une scène 3D

L'*IBL* fonctionne dans l'aperçu de l'espace Skyboxes — c'est ce qui éclaire les sphères témoins.
Mais on ne peut pas encore poser ce ciel autour d'une scène de l'espace 3D pour qu'il l'éclaire.

C'est le pont manquant entre les deux espaces.

---

## Générer

### Il n'y a pas de bouton « agrandir », « détourer » ni « vectoriser »

Le studio range les modèles en **familles**, et chaque espace de travail montre exactement une
famille : Image dans l'espace Image, Vidéo dans l'espace Vidéo, et ainsi de suite pour les six.

Quatre familles supplémentaires sont prévues dans le code — **agrandissement**, **détourage**,
**vectorisation** et **autre** — et aucune n'a d'espace pour l'accueillir.

Il y a plus surprenant : **aucun modèle n'est jamais rangé dans ces familles.** Le studio devine
la famille d'un modèle à partir de ce que le modèle sait recevoir et rendre. Un agrandisseur, lui,
reçoit une image et rend une image : il est donc rangé — correctement — dans la famille **Image**.

> **Bonne nouvelle : les agrandisseurs sont utilisables.** Ils sont simplement dans l'espace
> Image, mélangés aux autres. Cherchez `upscale` dans le panneau **Modèles**, ou filtrez sur le
> tag `image-upscale`.

Ce qui manque n'est donc pas le modèle, c'est **le raccourci** : un bouton « agrandir cette
image » qui prendrait l'image sous votre curseur et l'enverrait au bon modèle sans que vous ayez
à la retrouver et à la redéposer dans un formulaire.

### La sous-section « Agrandissement » des réglages est toujours vide

C'est la conséquence directe de ce qui précède. **Réglages ▸ Génération ▸ Agrandissement** existe,
s'ouvre, et n'a **qu'une seule entrée : « Demander à chaque fois »**. Sa liste se remplit avec les
modèles de la famille agrandissement — et il n'y en a aucun.

Ce n'est pas une panne, et une liste vide ne signifie pas que vous êtes déconnecté : c'est un
réglage écrit en avance sur l'espace qui l'utilisera.

---

## Import

### Ce qui s'importe

| Type | Extensions |
|---|---|
| **Vidéo** | `mp4` `mov` `mkv` `webm` `avi` `mxf` `m4v` |
| **Audio** | `wav` `mp3` `aac` `flac` `m4a` `ogg` |
| **Image** | `png` `jpg` `jpeg` `webp` `tif` `tiff` `exr` |

### Ce qui ne s'importe pas

- **les fichiers 3D** — `.glb`, `.gltf`, `.obj`, `.fbx` ;
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

### La famille Texture n'a pas de modèle par défaut

**Réglages ▸ Génération** propose cinq sous-sections : Image, Vidéo, 3D, Audio, Agrandissement.
**Texture** manque, alors que c'est désormais une famille de modèles à part entière.

Conséquence : dans l'espace Textures, le panneau **Génération** n'apparaît qu'après avoir choisi un
modèle à la main, et il faut recommencer à chaque session — les autres espaces peuvent, eux,
mémoriser leur choix.

### Le stockage dans le nuage n'existe pas

Le fichier de réglages prévoit un choix entre « sur votre disque » et « dans le nuage ». **Le
second n'est pas implémenté**, et le choix n'est donc offert nulle part dans l'interface.

Offrir un bouton qui ne mène nulle part serait une promesse que le logiciel ne peut pas tenir.

### Sur Windows et Linux, l'affichage montre `⌘`

Les raccourcis **fonctionnent** avec `Ctrl` — le menu du système est correct. Mais les infobulles
et l'écran des raccourcis dessinent le symbole `⌘` du Mac au lieu de `Ctrl`.

C'est un défaut d'affichage, pas de fonctionnement.

### Un intitulé de contexte manque dans l'écran des raccourcis

Les quatre groupes de raccourcis portent un titre : « Partout dans l'application », « Dans la vue
3D », « Dans le montage »… et le quatrième, celui de l'image, affiche un code technique au lieu de
son nom.

Les raccourcis du groupe fonctionnent normalement.

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

Si vous ne deviez retenir que six choses de ce chapitre :

1. **Les images, séquences, sons et ciels ne s'enregistrent pas** — fermer l'onglet perd le
   travail ; dans l'espace Image, `⇧⌘E` sort au moins un PNG avant de fermer ;
2. **recadrer, retourner ou pivoter une image n'est pas offert** — les pixels ne suivraient pas
   le cadre ;
3. **il n'y a pas d'export vidéo** — le studio ne peut pas encore livrer un fichier final ;
4. **il n'y a pas de bouton « agrandir », « détourer » ni « vectoriser »** ;
5. **on ne peut pas importer de modèle 3D** ni de HDRI ;
6. **une skybox n'éclaire pas encore une scène 3D**.

Tout le reste est du confort.

---

[← Glossaire](17-glossaire.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Comment faire pour… →](19-recettes.md)
