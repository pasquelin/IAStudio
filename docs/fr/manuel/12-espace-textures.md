# 12. Espace Textures

[← Espace Audio](11-espace-audio.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Skyboxes →](13-espace-skyboxes.md)

L'espace où l'on juge une **matière** : du bois, du métal rouillé, du tissu, de la pierre.

---

## Une texture n'est pas une image

C'est le point de départ, et il change tout.

Une image se regarde à plat. Une **matière** ne se juge pas à plat : elle a du relief, elle
renvoie la lumière d'une certaine façon, elle brille ou elle est mate. Posée sur un plan, sous
un éclairage neutre, une belle matière et une matière ratée se ressemblent.

C'est pourquoi cet espace ne montre pas votre image dans un cadre. Il la **pose sur un objet en
volume, sous une vraie lumière**, et le fait tourner.

---

## Créer une texture

1. Passez dans l'espace **Textures**.
2. Cliquez le bouton **+** du rail gauche. Un document neuf s'ouvre.
3. **Glissez une image du projet sur l'aperçu.** Elle devient la **couleur de base**.

Tant qu'aucune image n'est posée, l'aperçu affiche : « Glissez une image du projet pour la poser
en couleur de base ».

Un cadre bleu apparaît autour de l'aperçu quand vous survolez avec une image : c'est le signe que
le dépôt sera accepté.

---

## Les réglages de l'aperçu

En haut à gauche de l'aperçu, une petite barre.

### La forme

Cinq formes, et chacune montre quelque chose de différent :

| Forme | Ce qu'elle révèle |
|---|---|
| **Sphère** | comment la matière reçoit la lumière — la meilleure pour juger le brillant |
| **Cube** | comment elle se comporte sur des faces plates et des arêtes vives |
| **Cylindre** | la répétition sur une surface courbe |
| **Plan** | la **répétition** — c'est là qu'on voit les raccords qui se voient |
| **Nœud** | ce qui se passe là où la surface se replie sur elle-même |

**En pratique** : commencez par la **sphère** pour juger la matière, puis passez au **plan** pour
vérifier qu'elle se répète sans couture visible.

### Les trois autres contrôles

| Contrôle | Ce qu'il fait |
|---|---|
| **Afficher le fond** | montre l'environnement derrière l'objet, ou l'utilise seulement pour éclairer |
| **Rotation automatique** | fait tourner l'objet lentement, pour lire le relief |
| **Éclairage** | l'intensité de la lumière d'ambiance, de 0 à 3 |

**La rotation automatique est plus utile qu'elle n'en a l'air.** Un relief ne se voit pas sur une
image fixe : c'est le déplacement de la lumière sur la surface qui le révèle.

En bas à droite de l'aperçu, une petite vignette rappelle **quelle image** sert de couleur de
base.

---

## L'éclairage par défaut

Un **studio neutre** — un éclairage doux, sans couleur dominante, comme dans un studio photo.

Aucun fichier à télécharger, et une matière lisible dès le premier document. C'est
volontairement neutre : un éclairage coloré ferait paraître belle une matière qui ne l'est pas.

> Le jour où votre projet contiendra des skyboxes, elles pourront servir de lumière à leur tour —
> ce qui permettra de juger une matière sous l'éclairage réel de la scène où elle finira.

---

## Les huit canaux d'une matière

Une matière complète n'est pas une image, mais **jusqu'à huit**, qui décrivent chacune un aspect
différent de la surface.

| Canal | Ce qu'il décrit | Ce que ça donne |
|---|---|---|
| **Couleur de base** | la couleur, sans ombre ni reflet | l'aspect « peinture » de la surface |
| **Normales** | les micro-reliefs | des bosses et des creux qui accrochent la lumière, sans ajouter de géométrie |
| **Rugosité** | mat ou brillant, zone par zone | une flaque brillante sur un asphalte mat |
| **Métallicité** | métal ou non-métal, zone par zone | des rivets métalliques sur un bois |
| **Occlusion ambiante** | les coins où la lumière entre mal | de la profondeur dans les creux |
| **Hauteur** | le relief réel | un déplacement de la surface, plus fort que les normales |
| **Émission** | ce qui brille par soi-même | une enseigne au néon, des braises |
| **Arêtes** | où sont les bords | sert à d'autres calculs |

Chaque canal a une **origine** :

| Origine | Ce que ça veut dire |
|---|---|
| **Généré** | produit par un modèle Scenario — il est figé |
| **Dérivé** | calculé par le studio depuis un autre canal — il se recalcule si sa source change |
| **Importé** | une image que vous avez posée vous-même |

> **Aujourd'hui, seule la couleur de base se pose.** La bande des huit canaux, les dérivations
> automatiques et le panneau des réglages de matière sont en cours. Voir
> [Ce qui n'existe pas encore](18-limites.md).

---

## Rugosité et métallicité, expliquées

Ce sont les deux mots qu'il faut comprendre pour lire une matière.

**Rugosité** — à quel point la surface est mate.

| Valeur | Aspect |
|---|---|
| 0 | miroir parfait |
| 0,3 | métal poli, plastique brillant |
| 0,6 | bois verni, cuir |
| 1 | craie, velours, béton brut |

Certains logiciels appellent cela « brillance » (*glossiness* ou *smoothness*), qui est
exactement l'inverse : brillance 0,9 = rugosité 0,1.

**Métallicité** — est-ce du métal, oui ou non.

Ce réglage est presque toujours **0 ou 1**, rarement entre les deux. Un métal renvoie la lumière
d'une façon complètement différente d'un non-métal ; il n'y a pas grand-chose entre les deux,
sauf sur un métal peint ou rouillé, où la valeur varie **zone par zone** grâce à une carte.

---

## Enregistrer

Tout est enregistré **automatiquement**, quelques instants après votre dernier geste, dans un
fichier `.tex` du dossier `documents/` de votre projet.

**Rien n'est cuit dans les pixels.** Rouvrez le document dans six mois : chaque réglage est
encore là, et se règle encore. Ce qui est écrit, ce sont vos décisions, pas leur résultat.

**Les six types de documents s'enregistrent désormais**, mais la matière garde une particularité :
elle est la seule à s'écrire **toute seule**. Ailleurs, c'est `⌘S` qui décide du moment, et la
puce sur l'onglet dit ce qui attend encore d'être écrit.

---

## Ce qui manque encore

- le **panneau de matière** — rugosité, métal, relief, répétition, émission, réglables en direct ;
- la **bande des huit canaux**, avec leurs vignettes et leur import ;
- les **dérivations automatiques** — fabriquer les normales depuis la hauteur, par exemple ;
- l'**aperçu de répétition** en 1×, 2×, 4×, et la détection des coutures ;
- l'**export** vers glTF, Unity, Unreal, Roblox.

Le détail est dans [Ce qui n'existe pas encore](18-limites.md).

---

[← Espace Audio](11-espace-audio.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Skyboxes →](13-espace-skyboxes.md)
