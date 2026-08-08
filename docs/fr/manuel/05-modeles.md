# 5. Trouver un modèle

[← Les projets](04-projets.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Générer →](06-generer.md)

---

## Qu'est-ce qu'un modèle

Le programme distant qui fabrique. Vous lui donnez une phrase, et parfois une image ; il rend
une image, une vidéo, un son ou un objet 3D.

Il y a **plusieurs centaines de modèles** dans le catalogue Scenario, et ils ne savent pas tous
faire la même chose. Certains sont excellents pour les personnages et médiocres pour les
paysages. Certains ne prennent que du texte, d'autres exigent une image de départ. Certains
rendent en dix secondes, d'autres en trois minutes.

**Choisir le bon modèle compte au moins autant que bien écrire son prompt.**

---

## Le panneau Modèles

Il est dans la colonne de gauche, au même endroit dans les six espaces. Il liste le catalogue
**pour l'espace où vous êtes** : dans
l'espace Image, les modèles d'image ; dans l'espace 3D, les modèles 3D.

Il n'y a pas d'onglets de type à choisir : la barre de titre dit déjà dans quel espace vous
êtes.

> **Le panneau est vide et parle d'identifiants ?** Votre clé API n'est pas enregistrée, ou elle
> a été refusée. Voir [Premiers pas, étape 3](02-premiers-pas.md#étape-3--brancher-votre-compte).

### Deux façons de regarder

En haut du panneau, deux boutons :

| Vue | Ce qu'elle montre | Quand la préférer |
|---|---|---|
| **Icônes** | une grille de vignettes | pour choisir à l'œil — c'est le cas normal |
| **Liste** | une liste dense, une ligne par modèle | pour retrouver un nom précis |

Le curseur à côté redimensionne les vignettes : **Réduire** pour en voir plus,
**Agrandir** pour mieux juger.

### La recherche

Le champ **Rechercher…** filtre à la frappe. Il attend une fraction de seconde après votre
dernière touche avant de lancer la recherche, pour ne pas repartir à chaque lettre.

Il cherche dans le **nom** du modèle.

### Le tri

| Tri | Ce qu'il met en premier |
|---|---|
| **Qualité : les meilleurs** | les modèles les plus utilisés et les mieux notés — le tri par défaut |
| **Création : les plus récents** | les derniers publiés |
| **Création : les plus anciens** | les plus vieux, souvent les plus éprouvés |

---

## Les filtres

Le bouton **Plus de filtres** ouvre les menus de tri par critère. Ils ne sont pas les mêmes
selon l'espace, parce qu'ils n'ont pas de sens partout.

### Origine — disponible partout

| Valeur | Ce que ça veut dire |
|---|---|
| **Officiel** | publié par Scenario |
| **Communauté** | publié par quelqu'un d'autre |

### Capacité — ce que le modèle sait recevoir et rendre

C'est le filtre le plus utile. Le vocabulaire est technique mais court :

**Dans l'espace Image**

| Capacité | En français clair |
|---|---|
| **Texte vers image** | vous écrivez une phrase, il dessine |
| **Image vers image** | vous donnez une image de départ, il la transforme |
| **Retouche interne** | vous effacez une zone, il la redessine (*inpainting*) |
| **Extension** | il prolonge l'image au-delà de ses bords (*outpainting*) |
| **Guidage** | il suit une structure que vous imposez — une pose, un contour (*controlnet*) |
| **Référence** | il s'inspire d'une image de style que vous fournissez |

**Dans l'espace Vidéo**

| Capacité | En français clair |
|---|---|
| **Texte vers vidéo** | une phrase devient un plan animé |
| **Image vers vidéo** | une image fixe se met à bouger |
| **Vidéo vers vidéo** | une vidéo est transformée en une autre |

**Dans l'espace 3D**

| Capacité | En français clair |
|---|---|
| **Texte vers 3D** | une phrase devient un objet en volume |
| **Image vers 3D** | une photo devient un objet en volume |
| **3D vers 3D** | un objet est transformé en un autre |

**Dans l'espace Audio**

| Capacité | En français clair |
|---|---|
| **Texte vers audio** | une phrase devient un son ou une musique |
| **Audio vers audio** | un son est transformé en un autre |
| **Vidéo vers audio** | une vidéo reçoit une bande son |

**Dans l'espace Textures**

| Capacité | En français clair |
|---|---|
| **Texte vers texture** | une phrase devient une matière |
| **Image vers texture** | une image est transformée en matière |
| **Guidage de texture** | il suit une structure que vous imposez |
| **Texture de référence** | il s'inspire d'une matière que vous fournissez |

### Tag — les mots-clés des publieurs

Des étiquettes posées par ceux qui publient les modèles. Elles ne sont pas traduites, parce
qu'elles sont écrites telles quelles dans le catalogue.

Quelques exemples, selon l'espace : `Flux.1 LoRA`, `characters`, `fantasy`, `cartoon` pour
l'image ; `T2V`, `I2V`, `First Frame` pour la vidéo ; `PBR`, `Multiview` pour la 3D ; `TTS`,
`Music` pour l'audio.

### Éditeur — qui a fabriqué le modèle

Les grands noms du domaine, différents selon l'espace :

| Espace | Éditeurs proposés |
|---|---|
| Image | Deacon, Black Forest Labs, Recraft, Ideogram, Google, Qwen, Alibaba |
| Vidéo | Kling, Vidu, Alibaba, Wan, Bytedance, Luma, Google, Grok |
| 3D | Tripo, Tencent, Meshy, Hunyuan, Rodin |
| Audio | ElevenLabs, Google, Bytedance |

### Date — depuis quand le modèle existe

**Dernières 24 h** · **7 derniers jours** · **30 derniers jours** · **3 derniers mois**.

Utile pour voir ce qui vient de sortir.

> **L'espace Skyboxes n'a ni capacités, ni tags, ni éditeurs à filtrer, et l'espace Textures n'a
> ni tags ni éditeurs.** Ce n'est pas un oubli : ces familles ne comptent que quelques modèles, et
> un menu qui réduit trois lignes ne sert à rien. La famille Texture a été détachée de la famille
> Image sur ses seules capacités — lui prêter les tags de l'image proposerait des étiquettes
> qu'aucun modèle de texture ne porte.

---

## Choisir

Un clic sur une carte choisit le modèle. Son nom s'affiche en haut du panneau, et c'est lui que
le panneau **Génération**, juste en dessous, fera travailler.

**Le choix est retenu par famille.** Vous choisissez un modèle d'image, vous passez en 3D, vous
revenez : votre modèle d'image est toujours là.

Vous pouvez aussi fixer un **modèle par défaut** pour chaque famille, une fois pour toutes :
**Réglages ▸ Génération ▸ Image** (ou Vidéo, 3D, Audio, Agrandissement). Laissez le réglage sur
« Demander à chaque fois » pour choisir à chaque génération.

---

## Deux détails à connaître

**Un modèle n'apparaît que dans un seul espace.** Le studio devine à quelle famille un modèle
appartient d'après ce qu'il sait recevoir et rendre : un modèle qui rend une vidéo est dans
l'espace Vidéo, un modèle qui rend un son dans l'espace Audio. Si vous cherchez un modèle et ne
le trouvez pas, la première question à se poser est **« suis-je dans le bon espace ? »**.

Un cas surprend souvent : **les agrandisseurs sont dans l'espace Image**, parce qu'ils reçoivent
une image et rendent une image. Cherchez `upscale`, ou filtrez sur le tag `image-upscale`. Il n'y
a pas d'espace « Agrandissement » — voir [Ce qui n'existe pas encore](18-limites.md).

**Les vignettes ne sont pas toutes les mêmes.** La plupart des modèles publics n'ont pas
d'image de présentation. Le studio affiche alors l'un de leurs exemples de génération à la
place. C'est représentatif de ce que le modèle sait faire, mais ce n'est pas une carte de visite
officielle.

**Les images ne sont chargées que pour ce que vous regardez.** Le studio ne télécharge les
vignettes que pour les cartes qui atteignent réellement l'écran, groupées à chaque pause de
défilement. Faites défiler vite, elles apparaissent en léger différé — c'est normal, et c'est ce
qui rend la liste fluide sur un catalogue de plusieurs centaines de modèles.

<!-- CAPTURE : le panneau Modèles en grille, filtres ouverts.
     Vers ../../images/models-grid.png -->

---

## Comment bien choisir, en pratique

**1. Partez du tri par qualité.** Les premiers de la liste sont les plus utilisés. Sur un sujet
ordinaire, ils suffisent.

**2. Filtrez par capacité avant de filtrer par nom.** Si vous voulez transformer une image
existante, le filtre **Image vers image** élimine d'un coup tous les modèles qui n'acceptent que
du texte.

**3. Lisez la description.** Elle est courte et dit souvent l'essentiel : le style, ce pour quoi
le modèle a été entraîné.

**4. Essayez, comparez, retenez.** Un modèle se juge sur trois générations, pas sur sa vignette.
Quand vous en trouvez un qui vous convient, mettez-le en modèle par défaut de sa famille.

---

[← Les projets](04-projets.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Générer →](06-generer.md)
