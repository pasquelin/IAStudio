# 13. Espace Skyboxes

[← Espace Textures](12-espace-textures.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Tous les réglages →](14-reglages.md)

L’espace où l’on fabrique et où l’on règle un **ciel à 360°**.

---

## Qu’est-ce qu’une skybox

Ce qu’on voit **tout autour de soi** dans une scène en 3D, quand on tourne la tête : le ciel, la
ligne d’horizon, le décor lointain.

Techniquement, c’est une image **équirectangulaire** — une image très large, deux fois plus large
que haute, qui contient toute la sphère aplatie, comme une carte du monde contient la Terre. Le
studio la replie autour de vous.

Une skybox sert à deux choses :

1. **on la voit** — c’est le décor derrière tout le reste ;
2. **elle éclaire** — chaque partie du ciel renvoie sa lumière et sa couleur sur les objets de la
   scène. C’est ce qu’on appelle l’*éclairage par image*, ou IBL.

C’est le deuxième point qui compte le plus. Un ciel de coucher de soleil ne fait pas que remplir
le fond : il pose une lumière orange rasante sur tout ce qui est devant.

> **Un ciel fabriqué ici éclaire vos scènes 3D.** Une fois enregistré dans le projet, il se
> choisit dans l’Inspecteur de l’espace 3D, section **Environnement** : la scène s’allume, et les
> matériaux le reflètent. C’est le vrai usage d’une skybox, au-delà du décor —
> voir [Espace 3D](09-espace-3d.md).

---

## Trois façons d’obtenir un ciel

**D’abord, ouvrez un document ciel** avec le bouton `+` du rail gauche. Les trois chemins qui
suivent remplissent un onglet ouvert ; aucun n’en crée un.

| Chemin | Comment |
|---|---|
| **Double-clic** | sur une image de l’étagère, l’onglet ciel étant devant |
| **Glisser-déposer** | depuis l’étagère vers l’aperçu, n’importe où dessus |
| **Générer** | choisissez un modèle de ciel et lancez une génération : elle se pose **toute seule** dans le document d’où elle est partie |

Tant qu’aucune image n’est posée, l’aperçu affiche : « Aucune skybox. Générez-en une ou déposez
un panorama équirectangulaire. »

> **Seul ce qui se regarde est accepté** : une image, une matière ou un autre ciel, à condition
> qu’il soit sur votre disque. Un son ou une vidéo posés là-dessus sont ignorés en silence —
> rien ne casse, rien ne change.
>
> En revanche, **n’importe quelle image passe**, pas seulement un vrai panorama. Une photo
> ordinaire posée en ciel donnera une déformation étrange : c’est normal, l’espace attend une
> image *équirectangulaire*, deux fois plus large que haute.

> **Les modèles de ciel se reconnaissent à une étiquette.** Ils répondent comme des modèles
> d’image ordinaires, et rien dans leurs capacités ne dit qu’ils font des panoramas : c’est
> l’étiquette `sc:skybox` qui les distingue. C’est pourquoi le panneau Modèles n’en montre que
> trois dans cet espace, et non six cents.

---

## Regarder le ciel

**Cliquez et glissez** dans l’aperçu : vous tournez la tête, sur place.

Ce n’est **pas** une caméra qui tourne autour de quelque chose — vous êtes au centre de la
sphère, et vous regardez autour de vous. Le glissement suit la main : tirer vers la droite fait
tourner la vue vers la gauche, comme si vous attrapiez le monde.

### Le panneau Vue

Dans la colonne de droite, sous le panneau Skybox. Deux sections.

**Projection**

| Contrôle | Ce qu’il fait |
|---|---|
| **360°** | la vue immersive — vous êtes dans le ciel |
| **Équirect** | l’image à plat, telle qu’elle est stockée — deux fois plus large que haute |
| **Croix** | les six faces dépliées en croix, sur une grille de 4 × 3 |
| **6 faces** | les mêmes six faces serrées en 3 × 2 — la croix dépense la moitié de ses cases en vide, celle-ci aucune, donc une face s’inspecte presque deux fois plus grande |
| **Angle de vue** | de 50° à 110°, 75° par défaut — **ne joue que sur la vue 360°** |

> **Les trois vues à plat ne sont pas des images fabriquées à côté** : chaque pixel du cadre pose
> la question à l’envers — quelle direction du ciel est-ce, et où tombe-t-elle dans la source. Le
> ciel qu’elles montrent est donc exactement celui de la vue immersive, à la même rotation.
>
> Elles **mettent leur image en boîte aux lettres** plutôt que de l’étirer, et pendant qu’elles
> sont devant, le fond et les objets de test s’éteignent : ils seraient derrière l’image, et le
> ciel immersif qui passerait dans les barres se lirait comme une partie de ce qu’on juge.

**Repères**

| Contrôle | Ce qu’il fait |
|---|---|
| **Objets de test** | affiche ou masque des sphères témoins |

> **Ces réglages sont dans un panneau, pas au-dessus de l’image.** Le centre ne porte que la
> barre d’outils et les règles : un menu posé sur l’aperçu couvrirait la seule chose que cet
> espace existe pour montrer.

**Deux touches évitent le panneau** : `V` fait défiler les quatre vues, `P` montre ou cache les
objets de test. `⌘Z` et `⇧⌘Z` annulent et rétablissent ici comme ailleurs — voir
[Tous les raccourcis](15-raccourcis.md).

**Les objets de test** sont des sphères posées au milieu du ciel : une mate, une brillante, une
métallique. Elles ne font pas partie du ciel — elles servent à **voir ce que le ciel éclaire**, et
sont visibles par défaut.

**L’angle de vue** est l’équivalent de l’objectif d’un appareil photo : petit angle =
téléobjectif, on voit peu mais de près ; grand angle = on voit beaucoup, mais les bords se
déforment.

---

## Le panneau Skybox

Dans la colonne de droite. Quatre sections.

> **Aucun de ces réglages ne réécrit votre image.** Ce sont des instructions appliquées à
> l’affichage. Le fichier d’origine reste intact, et vos réglages sont rejouables à l’infini.

### Soleil

| Réglage | Ce qu’il fait | Plage |
|---|---|---|
| **Élévation** | la hauteur du soleil au-dessus de l’horizon | de l’horizon bas au zénith |
| **Azimut** | sa direction, tout autour | un tour complet |
| **Intensité** | sa puissance | 0 à 10 |
| **Couleur** | sa teinte | — |

> **Le soleil s’attrape directement dans l’aperçu.** Cliquez dessus dans le ciel et faites-le
> glisser : l’élévation et l’azimut suivent. C’est plus rapide que deux curseurs, et l’on voit
> l’ombre bouger pendant qu’on le fait.

### Ajustements — l’étalonnage

C’est ici qu’on rattrape une image trop sombre, trop terne ou trop froide.

| Réglage | Ce qu’il fait | Neutre |
|---|---|---|
| **Exposition** | éclaircit ou assombrit, en diaphragmes | 0 |
| **Contraste** | en dessous aplatit, au-dessus durcit | 1 |
| **Saturation** | 0 = noir et blanc | 1 |
| **Température** | vers le froid (bleu) ou le chaud (orange) | 0 |
| **Teinte** | vers le vert ou vers le magenta | 0 |
| **Rotation de l’horizon** | fait tourner tout le ciel autour de vous | 0 |
| **Flou** | adoucit le ciel | 0 |

**La rotation de l’horizon** est le réglage le plus utile : elle permet de placer le soleil du
côté qui vous arrange sans regénérer quoi que ce soit.

**Le flou** ne sert pas qu’à l’esthétique : un ciel flou éclaire plus doucement, sans reflets
durs sur les surfaces brillantes.

### Environnement

| Réglage | Ce qu’il fait | Plage |
|---|---|---|
| **Intensité IBL** | la force de l’éclairage que le ciel projette | 0 à 4 |
| **Afficher le fond** | montre le ciel, ou l’utilise **seulement** pour éclairer | — |

**Décocher « Afficher le fond »** est un geste courant : on garde la lumière du ciel, mais on
affiche autre chose derrière — un fond uni, une transparence.

### Génération

**Entièrement en lecture seule**, et repliée par défaut. Elle rappelle **ce qui a produit ce ciel** :
le modèle, le prompt, la graine.

Elle sert à la traçabilité : six mois plus tard, vous savez encore comment ce ciel a été obtenu, et
vous pouvez recopier ces valeurs dans le panneau **Génération** pour repartir de là.

> **Il n’y a pas de bouton dans cette section.** Ni « Régénérer », ni « Réinitialiser » : la copie
> se fait à la main. Voir [Ce qui n’existe pas encore](18-limites.md).

---

## Le rôle de la graine, ici particulièrement

Un ciel se cherche. Vous générez, l’ambiance est presque la bonne mais le soleil est au mauvais
endroit. Deux façons de continuer :

- **la rotation de l’horizon** — instantanée, gratuite, et souvent suffisante ;
- **régénérer avec la même graine** et un prompt légèrement différent — vous restez dans la même
  famille d’images au lieu de repartir de zéro.

---

## Sortir le ciel : les six faces

**Fichier › Exporter le ciel**, et une taille : 512, 1024 ou 2048 pixels de côté. Le studio
demande un dossier, y crée un sous-dossier au nom du document, et y écrit six PNG :

| Fichier | Face |
|---|---|
| `<titre>_Rt.png` | à droite |
| `<titre>_Lf.png` | à gauche |
| `<titre>_Up.png` | au-dessus |
| `<titre>_Dn.png` | au-dessous |
| `<titre>_Ft.png` | devant |
| `<titre>_Bk.png` | derrière |

Ces deux lettres sont celles que les moteurs attendent — Unity, Unreal et Roblox les lisent tous,
Roblox en les préfixant de `Skybox`. Les faces suivent la convention des cube maps OpenGL, donc
elles entrent à l’endroit sans avoir à en retourner une.

Trois choses valent d’être sues :

- **vos réglages partent avec les pixels.** Exposition, contraste, saturation, température et
  rotation de l’horizon sont cuits dans les six fichiers. Ce que vous avez jugé est ce qui sort ;
- **l’export lit la source, pas l’aperçu.** Le viewport travaille sur une copie réduite pour
  rester fluide ; l’export repart de l’image d’origine à sa taille, quelle que soit celle des
  faces demandées ;
- **le fichier peut sembler plus contrasté que l’écran.** Le viewport applique une courbe de
  rendu pour montrer une image très lumineuse sur un écran qui ne l’est pas ; le fichier porte
  les valeurs, pas cette courbe. C’est voulu : votre moteur appliquera la sienne, et la cuire ici
  la ferait appliquer deux fois.

Un ciel sans image ne s’exporte pas : le studio le dit dans le journal plutôt que d’ouvrir un
sélecteur de dossier pour six fichiers vides.

---

## Ce qui manque encore

- **les boutons Régénérer et Réinitialiser** — le panneau ne les pose pas ;
- **l’export en HDRI** — les six faces sortent en PNG, donc en 8 bits par canal : ce qui dépasse
  le blanc est écrêté. Pour un éclairage à forte dynamique, il n’y a pas encore de sortie ;
- **l’import d’un `.hdr`** — le studio n’importe que les images ordinaires. Un `.exr` importé est
  catalogué comme image, pas comme ciel. Il fonctionne quand même comme source, mais il faut
  aller le chercher dans les images.

Le détail est dans [Ce qui n’existe pas encore](18-limites.md).

---

[← Espace Textures](12-espace-textures.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Tous les réglages →](14-reglages.md)
