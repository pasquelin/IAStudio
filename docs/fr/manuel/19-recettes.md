# 19. Comment faire pour…

[← Ce qui n’existe pas encore](18-limites.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Piloter le studio depuis l’extérieur →](20-piloter-de-l-exterieur.md)

Les chapitres précédents expliquent **chaque morceau** du studio. Celui-ci fait l’inverse : il
part de ce que vous voulez obtenir, et donne le chemin complet, du premier clic au résultat.

Chaque recette tient sur elle-même. Vous n’avez rien à lire avant.

---

## Les trois choses à avoir avant toute recette

Elles reviennent partout, alors elles sont dites une fois ici.

| Il vous faut | Comment vérifier | Si ça manque |
|---|---|---|
| **Un compte branché** | la pastille est **verte** en haut à droite de la fenêtre | [Premiers pas ▸ étape 3](02-premiers-pas.md) |
| **Un projet ouvert** | son nom est écrit en bas à gauche, dans la ligne d’état | `⌘N` pour en créer un |
| **Le bon espace** | les sept onglets, en haut de la fenêtre | cliquez sur celui qu’il faut |

**Le troisième est celui qu’on oublie.** La moitié des « ça ne marche pas » du studio sont un
geste juste, fait dans le mauvais espace.

---

## Le geste qui déroute tout le monde

Avant les recettes, une règle qui les traverse toutes.

**Le double-clic sur un asset ouvre un onglet à lui**, dans l’espace qui édite son type, sans
jamais regarder celui que vous avez devant vous. Aucun document préalable n’est nécessaire, et
rouvrir le même asset revient à son onglet plutôt que d’en ouvrir un second. Quand l’ouverture ne
peut pas aboutir — l’asset n’est pas encore sur votre disque, ou aucun projet n’est ouvert — un
message le dit : « Cet asset n’a pas pu être ouvert ».

**Pour l’envoyer dans un document déjà ouvert, c’est l’autre geste** — et c’est là que tout le
monde se trompe :

```
ouvrir l'asset             → double-clic
l'ajouter à un document    → clic droit (il liste les destinations), ou glisser-déposer
```

Retenez ces deux lignes et vous ne serez bloqué nulle part.

---

# Fabriquer

## Faire une image à partir d’une phrase

**C’est le parcours de base**, détaillé dans [Premiers pas](02-premiers-pas.md). En résumé :

1. espace **Image** ;
2. panneau **Modèles**, à gauche : cliquez une vignette ;
3. cliquez l’icône **Génération** du rail gauche — choisir un modèle n’ouvre pas le panneau à
   votre place — puis écrivez votre phrase dans le **prompt** ;
4. **Générer**. La ligne d’état, en bas à droite, suit l’avancement ;
5. le résultat arrive dans le panneau **Assets**, et dans `Images/` sur votre disque.

**Le piège.** Sans projet ouvert, il n’y a **ni formulaire ni bouton** : le panneau affiche à la
place « Ouvrez un projet pour générer. » Ce n’est pas un bouton grisé, c’est le panneau entier qui
attend un dossier.

---

## Faire une variante d’une image que j’ai déjà

C’est ce qu’on appelle **image vers image** : vous donnez une image de départ, le modèle en rend
une autre, inspirée d’elle.

1. espace **Image** ;
2. dans le panneau **Modèles**, le filtre **Capacité** est visible sans rien déplier → cochez
   **Image vers image** ;
3. choisissez un modèle dans ce qui reste ;
4. dans le formulaire, un champ **image** apparaît : donnez-lui votre image de départ ;
5. écrivez ce que vous voulez obtenir, et réglez l’**Intensité** si le modèle la propose :
   **0 = presque inchangée, 1 = méconnaissable**. Commencez vers 0,5 ;
6. **Générer**.

**C’est le moyen de transformer une image par un modèle.** Pour la reprendre à la main —
pinceau, gomme, formes, texte — c’est l’autre chemin : un document image, et l’image glissée
dessus en calque (voir [Espace Image](08-espace-image.md)).

---

## Agrandir une image

Le menu **Image ▸ Agrandir** aplatit le document, l’envoie, et ouvre le formulaire de
l’agrandisseur avec votre image déjà dedans. C’est vous qui appuyez sur **Générer**.

Une fois, avant la première : **Réglages ▸ Génération ▸ Agrandissement**, choisissez un modèle.
Sans lui, la commande n’envoie rien et ouvre cet écran — le panneau **Modèles** ne peut pas servir
ici, il ne montre que la famille de l’espace ouvert.

**Détourer** et **Vectoriser** marchent exactement pareil, avec leur propre sous-section de
réglages : **Détourage** et **Vectorisation**.

**Ne le cherchez pas dans le panneau Modèles de l’espace Image** : ce panneau ne liste que la
famille de son espace, et un agrandisseur n’en fait pas partie — vous pourriez chercher longtemps.
C’est le menu **Image ▸ Agrandir** qui y mène.

---

## Faire un ciel à 360°

Un *ciel* — ou *skybox* — est une image qui vous entoure complètement. Elle sert de décor **et**
de lumière.

1. espace **Skyboxes** ;
2. bouton **+** du rail gauche : un document ciel s’ouvre, vide ;
3. panneau **Modèles** : il n’en montre que **trois**, et c’est normal — ce sont les seuls qui
   font des panoramas ;
4. écrivez votre prompt, **Générer** ;
5. **la génération se pose toute seule** dans le document d’où elle est partie. Vous n’avez rien
   à faire.

Ensuite, **cliquez et glissez** dans l’aperçu pour tourner la tête, et servez-vous du panneau
**Skybox**, à droite, pour régler l’exposition et la rotation.

**Pour vérifier ce que vous livrez**, passez par les trois autres vues — équirectangulaire, croix,
6 faces. Elles montrent le même ciel, à la même rotation, mais à plat : une couture au dos ou un
pôle écrasé s’y voient d’un coup d’œil, alors que la vue 360 demande de tourner la tête pour
tomber dessus.

**Pour l’emporter dans un moteur** : **Fichier ▸ Exporter ▸ Ciel**, et une taille. Six PNG sortent
dans un dossier, nommés `_Rt`, `_Lf`, `_Up`, `_Dn`, `_Ft`, `_Bk` — les deux lettres qu’Unity,
Unreal et Roblox attendent. **Réglez avant d’exporter** : l’exposition, la rotation de l’horizon et
tout le reste sont cuits dans les fichiers. Voir [Espace Skyboxes](13-espace-skyboxes.md#sortir-le-ciel--les-six-faces).

---

## Faire une matière pour un objet 3D

Une *matière* (ou *texture*) n’est pas une image : c’est une surface qu’on juge **sur un objet
éclairé**, pas à plat.

1. espace **Textures** ;
2. bouton **+** du rail gauche ;
3. **glissez une image du projet sur l’aperçu** — un cadre bleu confirme que le dépôt sera pris.
   Elle devient la **couleur de base** ;
4. **Inspecteur** → section **Aperçu** : choisissez la forme — **sphère**, cube, cylindre, plan ou
   nœud de tore. La **sphère** montre le mieux la lumière, le **plan** montre le mieux la
   répétition du motif ;
5. **Inspecteur** : la section **Matière** règle la rugosité et le métal ; **Relief** et
   **Émission** sont deux sections voisines, pas son contenu. Si la matière paraît uniformément
   moyenne, ce sont les **plages** — « Plage de rugosité », « Plage de métal » — qu’il faut
   reprendre ; elles sont dans la section Matière, sous les deux réglages ;
6. section **Canaux** : déposez une image sur la ligne de chaque canal que vous voulez remplir —
   et pour la **hauteur**, la **normale**, l’**occlusion** et la **rugosité**, le clic droit sur la
   ligne les calcule depuis un autre canal, sans rien dépenser ;
7. `⌘S` **enregistre**.

**Le piège.** Une image déposée sur l’**aperçu** va toujours dans la couleur de base — c’est
voulu. Pour viser les normales ou la rugosité, déposez sur **leur ligne** dans la section Canaux.

---

## Faire bouger une image fixe

1. espace **Vidéo** ;
2. panneau **Modèles** → filtre **Capacité**, visible sans rien déplier → **Image vers vidéo** ;
3. choisissez un modèle, donnez-lui votre image, décrivez le mouvement voulu ;
4. **Générer** — comptez plus longtemps que pour une image : quelques minutes est normal ;
5. le clip arrive dans les **Assets**.

**Pour le voir en grand** : **double-cliquez** le clip dans l’étagère. Un montage s’ouvre pour lui,
avec le clip déjà posé — le `+` du rail gauche n’est pas un préalable.

---

## Faire une musique ou un bruitage

1. espace **Audio** ;
2. panneau **Modèles** : les éditeurs proposés sont ElevenLabs, Google, Bytedance ;
3. décrivez le son voulu, **Générer** ;
4. le son arrive dans les **Assets**.

**Pour l’écouter et le retoucher :** **double-cliquez** votre son dans l’étagère. Un onglet
s’ouvre pour lui, et la forme d’onde apparaît — le `+` du rail gauche n’est pas un préalable.

---

## Composer une petite scène 3D

1. espace **3D** ;
2. bouton **+** du rail gauche : une scène neuve, avec sa grille au sol ;
3. **elle est noire, et c’est normal** — il n’y a pas de lumière. Le panneau Lumières le dit ;
4. panneau **Lumières** → **+** → **Directionnelle**. La scène s’éclaire ;
5. ajoutez une **Ambiante** faible pour que les ombres ne soient pas complètement noires. C’est
   la recette classique ;
6. panneau **Mailles** → **+** → une **Sphère**, par exemple ;
7. `G` pour la déplacer, `R` pour la tourner, `S` pour la redimensionner, `F` pour la cadrer ;
8. `⌘S` **enregistre**.

**Pour voler dans la scène :** maintenez un **bouton de la souris** et servez-vous de `W` `A` `S` `D`
(`Z` `Q` `S` `D` sur un clavier français — le studio écoute la position de la touche, pas la
lettre) ou des quatre **flèches**, qui font la même chose. `E` monte, `Q` descend, `⇧` gauche
accélère.

---

# Assembler

## Monter deux plans bout à bout

1. espace **Vidéo** ;
2. bouton **+** du rail gauche : une séquence neuve ;
3. **glissez** votre premier clip depuis l’étagère — en Vidéo elle est dans la **colonne de
   droite**, la bande basse étant prise par la timeline — sur une piste image ;
4. glissez le second **juste après** : il se cale sur l’image la plus proche, mais **il ne colle
   pas au bord du premier**. Lâchez-le trop tôt et il recouvre son voisin ; l’aimantation aux bords
   ne joue que lorsqu’on déplace un clip déjà posé ;
5. `Espace` pour lire, `Début` pour revenir au commencement.

**Pour couper :** placez la tête de lecture, appuyez sur `S`. Pour supprimer un clip :
sélectionnez-le, `Suppr`.

**Pour garder le montage :** `⌘S`. La séquence s’écrit en `.otio` — un format que Resolve et
Premiere lisent déjà — dans le projet, et se rouvre telle quelle : pistes, clips, fondus et
gains. Ce qui ne revient pas, c’est l’historique d’annulation.

**Ce qui manque toujours :** l’**export**. Le studio ne peut pas encore écrire un fichier vidéo
final.

---

## Rogner un son et le faire monter en douceur

1. **double-cliquez** votre son dans l’étagère — l’espace Audio s’ouvre avec lui ;
2. tirez les bords de la région pour **rogner** ;
3. posez un **fondu d’entrée** et un **fondu de sortie** ;
4. l’outil **A/B** compare avec l’original, avant vos retouches — c’est un outil à lui seul, pas
   le bouton de lecture.

**Le piège.** Rien n’est écrit tant que vous ne le demandez pas, et **changer de prise efface vos
réglages** : les coupes se mesurent sur la prise qui les a reçues.

---

## Poser un asset là où il faut

Le tableau des dépôts les plus courants — le chapitre [Les assets](07-assets.md) porte la liste
entière, ce qui l’accepte et ce qui le refuse en silence. Le double-clic, lui, n’entre dans
aucune surface : il ouvre l’asset dans un onglet à lui.

| Vous voulez… | Le geste | Il faut, devant vous |
|---|---|---|
| un clip sur un montage | glisser sur la **timeline** | un onglet séquence |
| une image en calque | glisser sur la **toile** | un onglet image |
| une image en couleur de base | glisser sur l’**aperçu de la matière** | un onglet texture |
| une image en ciel | glisser sur l’**aperçu du ciel** | un onglet ciel |
| un objet 3D dans une scène | glisser sur la **vue 3D** | un onglet scène |

Une texture se double-clique comme les autres : une **matière à elle** s’ouvre, dont elle remplit
la couleur de base. Pour la poser dans la matière que vous avez devant vous, c’est le
glisser-déposer ou le clic droit ▸ **Utiliser comme couleur de base**.

---

# Ranger, retrouver, emporter

## Faire entrer mes propres fichiers

1. panneau **Assets** → bouton **Importer un média**, sur sa ligne de titre ;
2. choisissez vos fichiers. Formats acceptés : vidéo (`mp4` `mov` `mkv` `webm` `avi` `mxf`
   `m4v`), audio (`wav` `mp3` `aac` `flac` `m4a` `ogg`), image (`png` `jpg` `jpeg` `webp` `tif`
   `tiff` `exr`), 3D (`glb`) ;
3. un bandeau suit chaque fichier : Analyse, Empreinte, Proxy, Forme d’onde, Prêt.

**Ce qu’il faut savoir, et qui a des conséquences réelles : à l’import, le fichier n’est pas
copié.** Le studio crée un **lien** vers l’endroit où il se trouve. Déplacer, renommer ou
supprimer l’original **casse le lien**. L’éditer, lui, le fait entrer dans le projet, sans toucher
votre fichier.

**Côté 3D, seul le `.glb` entre.** Un `.gltf` séparé — celui qui traîne ses fichiers `.bin` et
ses textures à côté — ainsi que `.obj`, `.fbx` et les HDRI (`.hdr`) sont refusés.

---

## Refaire une image que j’avais réussie

1. cliquez l’image dans le panneau **Assets** ;
2. regardez l’**Inspecteur**, à droite : s’il connaît la génération, il affiche le **modèle**, le
   **prompt** et la **graine** ;
3. bouton **Régénérer** : le modèle et ses paramètres reviennent dans le panneau Génération, prêts
   à repartir.

**Le principe à retenir.** Même modèle + même prompt + **même graine** = même image. Changez la
graine, vous obtenez une variante ; gardez-la et changez le prompt, vous explorez autour du même
résultat.

---

## Emporter mon projet sur une autre machine

Un projet est **un dossier ordinaire**. Copiez-le, c’est tout.

1. repérez son emplacement — bouton **Afficher dans le dossier** de l’inspecteur
   d’un asset ;
2. copiez le dossier entier : clé USB, disque, service de synchronisation, peu importe ;
3. sur l’autre machine, `⌘O` et ouvrez-le.

**Le piège.** Les médias **importés** ne sont pas dans le dossier : ce sont des liens. Copiez-les
séparément, ou — mieux — copiez-les dans le dossier du projet **avant** de les importer.

**Vos réglages, eux, ne suivent pas**, et vos clés API encore moins : elles sont chiffrées par le
trousseau de **votre** session et illisibles ailleurs. Sur la nouvelle machine, il faudra
rebrancher le compte.

---

## Travailler avec deux comptes

Chaque clé API porte **son propre** projet distant : ses modèles, ses assets, son crédit.

1. **Réglages ▸ Modèles d’IA ▸ Clés API** : ajoutez-en un second, avec son nom à lui ;
2. **Utiliser ce compte** bascule ;
3. plus rapide au quotidien : le nom du compte, en haut à droite de la fenêtre, ouvre la liste
   d’un clic.

**Ce qui change** : le catalogue de modèles et les assets **distants**. **Ce qui ne change pas** :
les fichiers de votre projet local, qui sont sur votre disque et n’appartiennent à aucun compte.

**Bonne nouvelle** : une génération lancée **finit sur le compte qui l’a lancée**. Vous pouvez
lancer une vidéo de dix minutes, basculer pour aller chercher un modèle ailleurs, la première
continue tranquillement.

---

## Remettre la fenêtre d’aplomb

Menu **Affichage ▸ Réinitialiser la disposition**. Les panneaux reprennent leur place de départ,
espace par espace.

Cette commande n’a **volontairement aucun raccourci** : on s’en sert deux fois par an, et lui
réserver une touche serait du gâchis. Vous pouvez lui en attribuer un dans
**Réglages ▸ Raccourcis**.

---

# Ce qu’il ne faut pas essayer

Cinq impasses connues. Elles ne sont pas des pannes : ce sont des fonctions qui n’existent pas
encore, et rien à l’écran ne le dit sur le moment.

| Vous essayez de… | Ce qui se passe | Pourquoi |
|---|---|---|
| **retrouver l’historique** d’un document rouvert | la pile d’annulation est vide | seul l’état est enregistré, pas les gestes qui y ont mené |
| **importer un `.hdr`**, un `.obj` ou un `.fbx` | il est refusé | seul le `.glb` entre, côté 3D |
| **détourer ou vectoriser** une image | les **Réglages ▸ Génération** s’ouvrent sur la section voulue | le modèle se choisit là, une fois pour toutes |
| **exporter une vidéo** | aucun bouton | l’export vidéo n’est pas écrit — l’image, elle, sort par `⇧⌘E` |
| **annuler un recadrage** | la taille revient, les pixels rognés non | l’historique ne garde pas l’image d’avant en entier |

Tout est détaillé, sans rien cacher, dans
[Ce qui n’existe pas encore](18-limites.md).

---

## Le récapitulatif, sur une page

| Je veux… | Espace | Le chemin |
|---|---|---|
| une image depuis une phrase | Image | Modèles → prompt → Générer |
| une variante d’une image | Image | filtre *Image vers image* → donner l’image |
| une image plus grande | Image | menu **Image ▸ Agrandir**, après avoir réglé son modèle |
| un ciel à 360° | Skyboxes | `+` → Générer, ça se pose tout seul |
| une matière | Textures | `+` → glisser une image sur l’aperçu → `⌘S` |
| un plan animé | Vidéo | filtre *Image vers vidéo* → Générer |
| un son | Audio | Modèles → Générer, puis double-clic sur le son |
| une scène 3D | 3D | `+` → une lumière **d’abord**, puis les objets → `⌘S` |
| éclairer une scène d’un ciel | 3D | Inspecteur → Environnement → choisir la skybox |
| poser un modèle 3D dans la scène ouverte | 3D | glisser la maille sur la vue, ou clic droit |
| monter deux plans | Vidéo | `+` → glisser les clips sur la timeline |
| importer mes fichiers | partout | Assets → Importer un média |
| refaire la même image | partout | Inspecteur → Régénérer |
| emporter mon projet | — | copier le dossier |

---

[← Ce qui n’existe pas encore](18-limites.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Piloter le studio depuis l’extérieur →](20-piloter-de-l-exterieur.md)
