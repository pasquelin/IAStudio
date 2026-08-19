# 17. Glossaire

[← Quand ça coince](16-depannage.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Ce qui n’existe pas encore →](18-limites.md)

Tous les mots du studio, dans l’ordre alphabétique, expliqués sans en supposer d’autres.

Quand un mot en appelle un autre, il est écrit *en italique* : vous le trouverez à sa lettre.

---

## A

**A/B**
Un bouton qui fait entendre — ou voir — la version d’origine tant qu’on le maintient, pour la
comparer à la version modifiée. Il n’annule rien : il montre.

**Agrandissement** *(upscale)*
Refabriquer une image en plus grand, en inventant les détails qui manquent. Ce n’est pas un
étirement : un vrai agrandissement ajoute de la matière plausible là où il n’y avait qu’un pixel
étalé.

**Angle de vue** *(champ de vision, FOV)*
Ce qu’une caméra embrasse, mesuré en degrés. Petit angle : on voit peu, mais de près, et les
distances s’aplatissent. Grand angle : on voit beaucoup, mais les bords se déforment. Un œil
humain tourne autour de 60°.

**Annuler** *(⌘Z)*
Défaire la dernière action. Chaque *document* a sa propre *pile d’annulation* : `⌘Z` recule dans
l’onglet actif, pas dans le dernier geste fait dans le studio.

**Aplatir**
Fondre tous les *calques* visibles en une seule image, comme si on la photographiait. C’est ce que
fait l’export, et c’est ce qui part quand vous demandez au modèle de détourer ou d’agrandir : le
service reçoit une image, pas une pile.

Le document, lui, garde ses calques. Aplatir n’est pas destructif ici.

**Arêtes** *(canal de texture)*
Une image en noir et blanc qui dit où sont les bords d’une surface. Elle ne s’affiche pas
directement : elle sert à d’autres calculs.

**Asset**
Un fichier de matière première dans votre *projet* : une image, une vidéo, un son, un objet 3D,
une *texture*, un ciel. Le mot est anglais et n’a pas d’équivalent français court ; « ressource »
ou « média » s’en approchent. Retenez : **un asset est un fichier fini, réutilisable**.

Les assets vivent dans le panneau **Assets**, qu’on appelle familièrement *l’étagère*.

**Assistant**
La fenêtre où l’on dit ce que l’on veut faire, en une phrase ordinaire, plutôt que de le cliquer.
`⌘K`. Elle choisit elle-même les actions et les exécute, et demande votre accord avant tout ce qui
dépense ou téléverse. Voir [Piloter le studio depuis l’extérieur](20-piloter-de-l-exterieur.md).

**Azimut**
La direction d’une chose tout autour de vous, mesurée en tournant sur place. Pour le soleil d’une
*skybox* : est, sud, ouest, nord. Se combine avec l’*élévation*, qui dit sa hauteur.

---

## B

**Backoff** → voir *Temporisation exponentielle*.

**Badge** *(d’un asset)*
La petite marque sur une vignette de l’*étagère*, qui dit où en est ce fichier vis-à-vis de la
*bibliothèque* : local seulement, synchronisé, à envoyer, à rapatrier, modifié des deux côtés,
échec, ou appartenant à un autre projet. Il n’est pas stocké mais **recalculé** — il dépend du
compte actif. Voir [Les assets](07-assets.md).

**Bibliothèque** *(du compte)*
Le stock d’assets qui vit en ligne, du côté de votre compte Scenario — par opposition au
*projet*, qui est un dossier sur votre disque. Les deux sont séparés et rien ne circule entre eux
sans une action de votre part. Aujourd’hui, seul le sens **projet → bibliothèque** a un bouton
(**Envoyer**).

---

## C

**Calque**
Une couche transparente empilée sur les autres, dans l’espace Image. Comme des feuilles de calque
posées les unes sur les autres : on dessine sur celle du dessus sans abîmer celles du dessous. On
peut en masquer une, la remonter, la descendre, la supprimer.

C’est ce qui rend une image **modifiable** au lieu d’être un aplat définitif.

**Calque de réglage**
Un *calque* qui ne contient aucun pixel : il **modifie ce qui est en dessous de lui**. Luminosité,
contraste, saturation, teinte. Le déplacer dans la pile change ce qu’il touche ; l’éteindre rend
tout comme avant.

Sa force est là : il n’écrit jamais dans les pixels des autres calques. Vous pouvez le régler
cent fois, ou le supprimer, sans avoir rien abîmé.

**Canal** *(d’une texture)*
Une des images qui composent une matière. Une *texture* n’est pas une image mais un jeu d’images
superposées, chacune répondant à une question différente : quelle couleur ? quel relief ? mat ou
brillant ? Le studio en connaît huit — voir [Espace Textures](12-espace-textures.md).

**Canvas**
La surface de dessin, au centre de l’espace Image. C’est là qu’on peint, qu’on gomme, qu’on
recadre.

**Capacité**
Ce qu’un *modèle* sait faire, écrit en abrégé. Le catalogue les affiche comme filtres.

| Abrégé | En clair |
|---|---|
| txt2img | texte vers image |
| img2img | image vers image |
| inpaint | retouche à l’intérieur d’une image |
| outpaint | extension au-delà des bords |
| controlnet | *guidage* par une image de structure |
| reference | image de référence pour le style |
| txt2video | texte vers vidéo |
| img2video | image vers vidéo |
| txt23d / img23d | texte ou image vers objet 3D |
| txt2audio | texte vers son |

**Catalogue**
La liste des *modèles* disponibles sur Scenario. Plusieurs centaines. Le panneau **Modèles** ne
vous montre à chaque fois que ceux qui savent fabriquer ce que l’*espace de travail* en cours
fabrique.

**Clé API**
Votre identifiant auprès de Scenario, l’équivalent d’un nom d’utilisateur. Elle va toujours avec
un *secret API*. Toutes deux se prennent sur [app.scenario.com](https://app.scenario.com), et se
collent dans Réglages → **Compte**.

**Clip**
Un morceau de vidéo ou de son posé sur une *piste* du montage. Le même *asset* peut donner
plusieurs clips ; couper un clip ne touche jamais le fichier d’origine.

**Compte**
Une clé API enregistrée, sous un nom que vous choisissez. Le studio en tient **plusieurs**, et le
sélecteur de la barre de titre passe de l’un à l’autre.

Chaque clé porte **son propre projet Scenario** — ses modèles, ses assets, son crédit. Changer de
compte change donc la bibliothèque distante que vous parcourez, **jamais** les fichiers de votre
projet local, qui sont sur votre disque et n’appartiennent à aucun compte.

Une *tâche* déjà lancée finit sur le compte qui l’a lancée : basculer n’interrompt rien.

**Contexte** *(d’un raccourci)*
La surface où une touche a un sens. Le studio en connaît quatre : partout dans l’application, dans
la vue 3D, dans le montage, dans l’image. C’est ce qui permet à `S` de couper un clip **et** de
redimensionner un objet, sans ambiguïté : une seule surface écoute à la fois.

**Contraste**
L’écart entre les zones sombres et les zones claires. En dessous de 1, l’image s’aplatit et
devient grise ; au-dessus, elle durcit et perd du détail dans les extrêmes.

**Couleur d’accent**
La couleur qui signale ce qui est sélectionné ou en cours dans l’interface : le contour du panneau
actif, la *tête de lecture*, le cadre d’une sélection. Réglable dans Réglages → **Apparence**.

**Couleur de base** *(canal de texture)*
La couleur d’une matière, telle qu’elle serait sous un éclairage parfaitement neutre : sans ombre,
sans reflet, sans relief. L’aspect « peinture » de la surface.

---

## D

**Densité**
La taille des contrôles de l’interface. **Confort** laisse de l’air (28 px de haut) ; **Compact**
resserre (24 px) pour faire tenir plus de choses à l’écran.

**Dérivé** *(canal)*
Un *canal* de texture que le studio a calculé à partir d’un autre, plutôt que reçu d’un *modèle*.
Le calcul se relance depuis le menu de sa vignette, autant de fois qu’on veut.

**Détourage** *(background removal)*
Retirer le fond d’une image pour ne garder que le sujet, sur du transparent. La commande
**Détourer** est dans le menu Image ; son modèle se règle dans
**Réglages ▸ Génération ▸ Détourage**.

**Dictée**
Écrire un texte en le disant plutôt qu'en le tapant. La reconnaissance tourne **sur cet
ordinateur**, sans clé ni connexion : rien de ce qui est dit ne part ailleurs.

Elle a besoin d'un *modèle* de reconnaissance, téléchargé une seule fois (640 Mo), et fonctionne
dans tous les champs de texte du studio — le texte se pose à l'endroit du curseur. Voir
[Générer](06-generer.md#dicter-au-lieu-de-taper).

**Dock**
Une zone de la fenêtre où des *panneaux* peuvent se poser : les colonnes de gauche et de droite,
la bande du bas. Voir [La fenêtre](03-la-fenetre.md).

**Document**
Un travail en cours, ouvert dans un onglet au centre de la fenêtre.

La différence avec un *asset* est celle qui sépare la matière de l’ouvrage : une image générée est
un asset ; l’image que vous êtes en train de peindre, avec ses *calques* et son historique, est un
document.

Six sortes, une par *espace de travail*, chacune sous l’extension du format ouvert auquel elle
appartient : `.ora` (image), `.gltf` (scène 3D et ciel), `.otio` (séquence et audio), `.mtlx`
(matière).

**Les six s’ouvrent aujourd’hui dans un autre logiciel** : l’extension annonce le contenu, et non
plus une destination. Ce que le standard ne sait pas dire voyage à l’endroit que chaque format
réserve aux applications — un autre logiciel ne le perd pas, il ne le voit pas. Voir
[Ce que le studio ne fait pas](18-limites.md).

---

## E

**Éclairage par image** → voir *IBL*.

**Élévation**
La hauteur d’une chose au-dessus de l’horizon, en degrés. Pour le soleil d’une *skybox* : 0° au
ras de l’horizon, 90° à la verticale. Se combine avec l’*azimut*.

**Émission** *(canal de texture)*
Ce qui brille par soi-même dans une matière : une enseigne au néon, des braises, un écran allumé.
Une zone émissive reste visible même sans lumière autour.

**Empreinte** *(d’un fichier)*
Une signature calculée à partir du contenu d’un fichier. Deux fichiers identiques ont la même
empreinte, même s’ils portent des noms différents. C’est ainsi que le studio reconnaît un doublon
à l’import.

**Environnement** *(d’une scène 3D)*
Ce qui éclaire une scène en dehors de ses lampes. Deux valeurs : **Studio**, un éclairage neutre
calculé, ou **une *skybox* du projet**, qui pose sa lumière et ses reflets sur tout. Se choisit
dans l’**Inspecteur** de l’espace Modélisation, section **Environnement**.

**Équirectangulaire**
Le format d’une image qui contient toute une sphère, aplatie : deux fois plus large que haute,
comme une carte du monde contient la Terre. C’est sous cette forme qu’une *skybox* est stockée
avant d’être repliée autour de vous.

**Espace de travail**
Un des six arrangements du studio : **Image**, **Vidéo**, **3D**, **Audio**, **Textures**,
**Skyboxes**. Changer d’espace réorganise les *panneaux* et refiltre le *catalogue*.

Ce n’est pas six logiciels : c’est un logiciel qui se réarrange.

**Étagère**
Le surnom du panneau **Assets**. On y range ce qu’on a fabriqué et importé ; on y pioche pour
travailler.

**Étalonnage**
Le réglage général des couleurs et des lumières d’une image, après coup : *exposition*,
*contraste*, *saturation*, *température*, *teinte*. Le mot vient du cinéma.

**Exposition**
L’éclaircissement ou l’assombrissement global d’une image, compté en **diaphragmes** : +1 double
la quantité de lumière, −1 la divise par deux. La correction la plus utile sur une image trop
sombre.

---

## F

**Famille** *(de modèles)*
Le grand type de ce qu’un *modèle* fabrique : image, vidéo, 3D, audio, texture, ciel,
agrandissement, détourage, vectorisation. Sept d’entre elles ont leur *modèle par défaut* dans les
réglages ; Texture et Ciel ne l’ont pas encore. Les trois dernières — agrandissement, détourage,
vectorisation — n’ont pas d’espace de travail : ce sont les éditions du menu Image qui les
emploient.

**ffmpeg**
Un petit programme extérieur au studio, qui sait lire et convertir à peu près tous les formats
vidéo et audio existants. Le studio s’en sert à l’import pour fabriquer les *proxies* et les
*waveforms*. Facultatif : sans lui, l’import marche quand même, en moins confortable.

**File d’attente**
La queue des *tâches* en cours. Le nombre qui travaillent en même temps est réglable (3 par
défaut). Tout passe par cette file — c’est ce qui empêche une rafale de demandes de se faire
refuser en bloc.

**Fondu** *(fade)*
Une montée depuis le silence (fondu d’entrée) ou une descente vers lui (fondu de sortie). Évite le
« clac » d’un son qui démarre ou s’arrête net.

**Forme d’onde** → voir *Waveform*.

---

## G

**Générer**
Demander à un *modèle* de fabriquer quelque chose. La demande part chez Scenario, revient sous
forme de *tâche*, et le résultat atterrit dans vos *assets*.

**Gizmo**
Les *poignées* de couleur qui apparaissent sur un objet 3D sélectionné, et par lesquelles on le
transforme : les **flèches** le déplacent, les **cercles** le font pivoter, les poignées de
redimensionnement l’agrandissent. C’est l’outil armé qui décide desquelles s’affichent. Leur
orientation suit le *repère local / repère monde*.

**Gouttière**
L’espace entre deux *panneaux*. C’est lui-même la poignée qui les redimensionne : il n’y a pas de
petite prise à viser.

**Graine** *(seed)*
Le point de départ du hasard d’une génération. C’est un nombre.

Deux générations avec **la même graine, le même modèle et les mêmes réglages** donnent la même
image. Changez la graine, vous obtenez une autre image de la même famille. Laissez-la sur
« Aléatoire », vous explorez ; fixez-la, vous affinez.

C’est le réglage le plus utile du formulaire, et le plus souvent ignoré.

**Groupe**
Plusieurs objets rangés sous un même parent. Dans l’espace Modélisation (`⌘G`) comme dans la pile de
calques : déplacer le groupe déplace tout ce qui pend dessous, et le replier rend une scène
chargée lisible.

**Guidage** *(ControlNet, cfg)*
Deux sens, hélas :

1. **ControlNet** — fournir une image de structure (un contour, une pose, une profondeur) que le
   modèle doit suivre ;
2. **guidance / cfg** — à quel point le modèle obéit au *prompt*. Trop haut, l’image devient dure
   et saturée ; trop bas, le modèle part ailleurs.

---

## H

**Hauteur** *(canal de texture)*
Une image en niveaux de gris qui dit le relief réel d’une surface : le blanc est en haut, le noir
en bas. Plus fort que les *normales*, parce qu’il déplace vraiment la géométrie au lieu de
simuler.

**HDRI**
Une image à grande plage dynamique : une image qui garde l’écart réel entre le soleil et l’ombre,
là où une image ordinaire écrase tout entre noir et blanc. C’est le format naturel d’une *skybox*
qui sert à éclairer. Extensions `.hdr` et `.exr`.

---

## I

**IBL** *(éclairage par image, image-based lighting)*
Éclairer une scène 3D **avec une image** plutôt qu’avec des lampes. Chaque partie du ciel renvoie
sa couleur et sa lumière sur les objets. C’est ce qui rend un objet crédible : il reçoit la
lumière orange d’un coucher de soleil, pas une lampe blanche générique.

**Import**
Faire entrer dans le projet un fichier venu d’ailleurs. Le studio le *lie* : il note où il est,
calcule son *empreinte*, et prépare son *proxy* et sa *waveform*. Le fichier d’origine reste où il
est.

**Inpainting** *(retouche interne)*
Refabriquer une zone à l’intérieur d’une image, en gardant le reste intact. On efface une voiture
d’une rue, on change un vêtement.

---

## J

**Job** → voir *Tâche*.

**Journal d’activité**
La liste de ce que le studio a fait et raté, ouverte depuis la **ligne d’état**. Six sujets —
génération, import, bibliothèque, document, projet, interface — et trois niveaux : information,
avertissement, échec. Un échec y ajoute une **bulle** dans le coin de la fenêtre, qui ne
disparaît que si on la ferme. Voir [Quand ça coince](16-depannage.md).

---

## L

**LUFS**
L’unité qui mesure le **volume perçu** d’un son, par opposition à sa crête technique. Deux sons au
même niveau maximal peuvent sonner très différemment ; deux sons au même LUFS sonnent aussi fort.
−14 LUFS est la convention des plateformes de diffusion, et ce que vise le bouton **Normaliser**.

---

## M

**Magnétisme** *(snap)*
Faire coller ce qu’on déplace aux *repères*, aux bords et au centre, à quelques pixels près. Évite
les alignements ratés d’un cheveu.

**Maille** *(mesh)*
Un objet 3D, décrit par ses points et les triangles qui les relient. C’est la forme, sans la
matière ni la lumière. Le mot *maillage* désigne son pavage — la finesse du filet de triangles —
et non l’objet : c’est ce que montre le mode **Filaire**.

**Masque**
Ce qui décide **où** un calque se voit. Un masque de fusion cache une partie d’un calque sans
l’effacer : les pixels sont toujours là, ils ne s’affichent pas. On le peint, on le règle, on le
retire — l’image d’origine n’a jamais bougé.

Un masque se fabrique aussi à partir d’une *sélection*, en une commande.

**Matière** *(material)*
Ce dont une surface est faite : sa couleur, son grain, ce qu’elle renvoie de la lumière. C’est ce
que l’espace **Textures** fabrique, et ce que la section **Matière** de l’**Inspecteur** règle sur un
objet 3D. Le studio ne dit jamais *matériau* : un seul mot pour une seule chose.

**MCP** *(Model Context Protocol)*
La langue commune que parlent les assistants de programmation et les outils qu’ils pilotent. Le
studio peut se présenter comme l’un de ces outils : un client comme Claude Code lance alors les
mêmes actions que l’*assistant*. Fermé au départ, à ouvrir dans Réglages → **Avancé**. Voir
[Piloter le studio depuis l’extérieur](20-piloter-de-l-exterieur.md).

**Métallicité** *(canal de texture)*
Zone par zone : cette partie est-elle du métal, ou non ? Ce n’est pas un curseur d’aspect mais un
interrupteur physique, parce que le métal et le non-métal réfléchissent la lumière de deux façons
différentes. Les valeurs intermédiaires n’existent quasiment pas dans la nature — elles servent à
adoucir la frontière entre deux zones.

**Mode de fusion**
La façon dont un calque se mélange à ce qui est en dessous. **Normal** le pose simplement par
dessus ; **Produit** assombrit ; **Superposition** éclaircit ; il y en a seize en tout.

C’est le réglage qui transforme un empilement d’images en une composition.

**Modèle**
Le programme distant qui fabrique. Il y en a plusieurs centaines, et ils ne savent pas tous faire
la même chose. **Choisir le bon modèle compte autant que bien écrire son prompt.**

**Modèle par défaut**
Celui que le panneau **Génération** présélectionne à l’ouverture d’un *espace de travail*.
Réglable par *famille*, dans Réglages → **Génération**.

---

## N

**Nœud** *(node)*
Un élément de l’arbre d’une *scène* 3D : une *maille*, une lumière, un sprite, un groupe. C’est ce
que l’**Outliner** liste et ce que l’**Inspecteur** décrit.

**Normales** *(canal de texture)*
Une image aux couleurs étranges — des bleus, des violets — qui encode les **micro-reliefs** d’une
surface : les bosses et les creux qui accrochent la lumière, sans ajouter un seul triangle à
l’objet. C’est ce qui donne son grain à une pierre ou son tissage à une étoffe.

**Normaliser** *(audio)*
Ramener le volume perçu d’un son à un niveau de référence, ici −14 *LUFS*. Sert à ce que deux sons
enchaînés ne se donnent pas un coup de volume l’un à l’autre.

---

## O

**Occlusion ambiante** *(AO, canal de texture)*
Une image en niveaux de gris qui marque les endroits où la lumière ambiante entre mal : les creux,
les coins, les jointures. Elle ajoute de la profondeur à une matière qui semblait plate.

**Ombre** *(projetée, reçue)*
Deux réglages distincts, sur chaque objet d’une scène 3D. **Projette une ombre** : l’objet bloque
la lumière. **Reçoit les ombres** : celles des autres se dessinent sur lui. Un sol reçoit sans
projeter ; un décor lointain peut ne faire ni l’un ni l’autre sans que cela se voie.

**Onglet**
Un *document* ouvert, au centre de la fenêtre. Un onglet dont le travail n’est pas encore écrit sur
le disque porte un point (`•`) à côté de son nom.

**Outpainting** *(extension)*
Prolonger une image **au-delà de ses bords**, en inventant la suite. On transforme un portrait
serré en plan large.

---

## P

**Panneau**
Une petite fenêtre à l’intérieur de la grande. Chaque panneau fait une chose : lister les modèles,
montrer les calques, régler ce qui est sélectionné. On les ouvre et on les ferme d’un clic sur les
*rails*.

Le rail ne montre que les panneaux que l’espace **peut** ouvrir : pas de Calques en Audio, et pas
de Génération tant qu’aucun modèle n’est choisi.

**Pile d’annulation**
L’historique des actions d’un *document*, dans lequel `⌘Z` recule et `⇧⌘Z` avance. **Chaque
document a la sienne** — c’est pour cela qu’annuler dans un onglet ne touche pas les autres.

**Piste**
Une ligne du montage, sur laquelle des *clips* sont posés bout à bout. Une piste vidéo, une piste
audio, plusieurs de chaque si besoin.

**Poignée**
Un point qu’on attrape pour agir. Le studio en emploie trois sortes, et elles n’ont rien à voir :
les **poignées de manipulation** d’un objet 3D — les flèches et les cercles du *gizmo* ; la
**poignée d’un clip**, à son bord, qui le *rogne* ; et la **poignée à suivre** d’une articulation,
un point posé dans la scène que l’os cherche à atteindre, et que les deux os au-dessus de lui
suivent au plus.

Les deux premières se tirent ; la troisième se pose et reste là.

**Projection**
La façon dont la caméra 3D met le volume à plat. En **perspective**, ce qui est loin est plus
petit — c’est ce que voit un œil. En **orthographique**, les tailles ne changent pas avec la
distance : c’est la vue d’un plan d’architecte, et c’est ce qu’on veut pour aligner des objets.

**Projet**
Un dossier sur votre disque, et tout ce qu’il contient : les *assets*, les *documents*, le
catalogue qui les indexe. **Le studio n’en ouvre qu’un à la fois** — toutes ses fenêtres travaillent
sur le même. C’est lui qui fournit la première des trois sources de l’*étagère*, les deux autres
étant votre bibliothèque en ligne et les générations en cours.

**Prompt**
Votre phrase de commande : le texte qui décrit ce que vous voulez. Le champ le plus important du
formulaire.

Trois principes : **écrivez en anglais** si vous le pouvez, **décrivez ce qui est là** plutôt que
ce qui n’y est pas, et **soyez concret**.

**Prompt négatif** *(negative prompt)*
Ce que vous voulez éviter. Court, en mots-clés : `blurry, text, watermark`. Ce n’est pas l’endroit
où décrire une scène à l’envers.

**Proxy**
Une copie allégée d’une vidéo, fabriquée à l’import, qui permet de naviguer dans le montage sans
à-coups. On travaille sur le proxy, on exporte depuis l’original. Sa fabrication demande *ffmpeg*.

---

## Q

**QWERTY / AZERTY**
Les deux dispositions de clavier courantes. Le studio écoute la **position** des touches, pas la
lettre imprimée dessus : les touches de vol forment toujours le même carré en haut à gauche —
`WASD` sur un clavier américain, `ZQSD` sur un français. Rien à régler.

---

## R

**Rail**
Une des deux bandes d’icônes collées aux bords gauche et droit de la fenêtre. Un clic sur une
icône ouvre ou ferme le *panneau* correspondant.

**Régénérer**
Relancer une génération avec les réglages qui ont produit un résultat donné — même *modèle*, même
*prompt*, même *graine*. Le point de départ de toute variation maîtrisée.

**Règle**
Une des deux bandes graduées, en haut et à gauche du *canvas*. C’est d’elles qu’on tire les
*repères*.

**Repère** *(guide)*
Une ligne fine, horizontale ou verticale, posée sur l’image pour aligner ce qu’on y met. Elle ne
fait pas partie de l’image et ne s’exporte pas. Masquer les repères ne les efface pas.

**Repère local / repère monde**
L’orientation des poignées de manipulation, dans l’espace Modélisation. En repère **monde**, la flèche rouge
pointe toujours dans la même direction. En repère **local**, elle suit l’orientation de l’objet :
c’est ce qu’il faut pour faire avancer une voiture dans le sens où elle roule. La touche `L`
bascule de l’un à l’autre.

**Reprise automatique**
Ce que le studio fait quand une *tâche* échoue pour une raison qu’un nouvel essai peut réparer :
réseau coupé, service occupé, trop de requêtes. Voir *Temporisation exponentielle*.

**Rogner** *(audio)*
Ne garder que la portion sélectionnée d’un son, et jeter le reste.

**Rogner** *(montage)*
Raccourcir ou allonger un *clip* par l’un de ses bouts, en tirant sur la poignée qui s’y trouve.
Une vidéo s’arrête là où sa source s’arrête ; une image fixe n’a aucune source à dépasser, et ses
deux bouts l’allongent.

**Rotation de l’horizon**
Faire tourner toute une *skybox* autour de vous. Le réglage le plus utile d’un ciel : il place le
soleil du côté qui vous arrange, instantanément, sans rien regénérer.

**Rugosité** *(canal de texture)*
Mat ou brillant, zone par zone. Une surface rugueuse éparpille la lumière et n’a pas de reflet
net ; une surface lisse la renvoie et miroite. C’est ce qui distingue un asphalte sec d’une flaque
d’eau — la couleur est presque la même.

---

## S

**Saturation**
L’intensité des couleurs. À 0, l’image est en noir et blanc ; au-dessus de 1, les couleurs
crient.

**Scène**
Ce que l’espace Modélisation compose : un arbre de *nœuds* — objets, lumières, caméras — avec leurs
places, leurs *matières* et leur animation. C’est le *document* de cet espace, et il s’écrit en
`.gltf`.

**Secret API**
La seconde moitié de vos identifiants Scenario, l’équivalent d’un mot de passe. Il va toujours
avec une *clé API*, et ne s’affiche jamais en clair une fois enregistré.

**Sélection** *(dans une image)*
Une région tracée sur l’image — rectangle, ellipse ou lasso — qui **borne les outils**. Tant
qu’elle existe, le pinceau, la gomme et le pot n’agissent qu’à l’intérieur. `⌘D` l’abandonne.

Elle sert aussi à fabriquer un *masque*, et à dire au modèle quelle zone repeindre.

**Séquence**
Un montage : des *clips* posés sur des *pistes*, dans le temps. C’est le *document* de l’espace
Vidéo.

**Skybox**
Ce qu’on voit tout autour de soi dans une scène 3D quand on tourne la tête : le ciel, l’horizon,
le décor lointain. Stockée en *équirectangulaire*.

Elle sert à deux choses : **on la voit** (c’est le décor), et **elle éclaire** (voir *IBL*). Le
second point compte davantage.

**Sous-piste**
Une ligne de la bande d’animation, dans l’espace Modélisation, sur laquelle les blocs d’animation
d’un objet se posent. Elles s’appellent **Anim. 1**, **Anim. 2**, et se groupent **sous** les lignes
de clés de l’objet.

Ce n’est pas une *piste* du montage : une piste porte des *clips* et appartient à une séquence, une
sous-piste porte des blocs et appartient à un objet de la scène. Deux mouvements sur deux
sous-pistes jouent en même temps, mais **ils se partagent encore les mêmes os** : c’est **Pilote**,
dans l’**Inspecteur**, qui donne à chacun sa moitié du corps.

**Sprite**
Une image posée dans une scène 3D et qui **fait toujours face à la caméra**, quelle que soit la
direction d’où on la regarde. Utile pour un feuillage, une étincelle, un personnage plat. Il n’est
ni éclairé ni concerné par les ombres : sa couleur est celle qu’on lui donne.

---

## T

**Tâche** *(job)*
Une demande de fabrication en cours. Elle vit dans la **ligne d’état**, en bas à droite de la
fenêtre, avec une barre de progression, et passe par cinq états : **En file** → **En cours** →
**Terminée**, ou bien **Échouée**, ou **Annulée**.

Vous pouvez continuer à travailler pendant qu’une tâche tourne.

**Teinte** *(tint)*
Le décalage d’une image vers le vert ou vers le magenta. Sert à rattraper une dominante que la
*température* ne corrige pas.

**Température**
Le décalage d’une image vers le froid (bleu) ou vers le chaud (orange). C’est le réglage qui fait
qu’une photo prise sous une ampoule ne semble plus jaune.

**Temporisation exponentielle** *(backoff)*
La façon dont le studio réessaie après un échec : il attend, puis double l’attente à chaque
nouvel essai — 1 seconde, 2, 4, 8. Réessayer tout de suite et en boucle aggraverait
l’encombrement au lieu de le résoudre.

**Tête de lecture**
La ligne verticale qui marque l’instant en cours dans le montage. On la déplace pour se situer, et
c’est à son endroit qu’un *clip* se coupe.

**Texture**
Une matière destinée à habiller un objet 3D : du bois, du métal rouillé, du tissu. **Ce n’est pas
une image**, mais un jeu de *canaux* superposés, chacun répondant à une question différente.

**Thème**
Le jeu de couleurs de l’interface : **Sombre**, **Clair**, ou **Système** (qui suit votre
ordinateur et bascule tout seul). Le fond reste toujours opaque — dans un studio, un fond
translucide fausserait le jugement des couleurs.

**Trousseau** *(keychain)*
Le coffre-fort de votre système d’exploitation, celui qui garde vos mots de passe. C’est lui qui
chiffre votre *clé API* et votre *secret API*. Ils n’en sortent jamais en clair, et l’écran que
vous regardez n’y a pas accès : il sait seulement si la connexion fonctionne.

---

## U

**Unité créative** *(UC)*
Ce qu’une génération dépense sur votre compte Scenario. C’est le service qui fixe le tarif,
jamais le studio : une vidéo ne coûte pas ce que coûte une image, et deux modèles d’images ne
coûtent pas la même chose non plus.

Vous la croisez à trois endroits : le bouton **Générer** en annonce une estimation — `~12 UC` —
avant que vous appuyiez ; la ligne de la génération montre le montant réel une fois qu’elle est
partie ; **Aide ▸ Consommation…** fait le total sur une période. Demander l’estimation ne
dépense rien et ne génère rien.

---

## V

**Vectorisation**
Convertir une image en tracés — des lignes et des courbes, qui s’agrandissent sans jamais devenir
floues. La commande **Vectoriser** est dans le menu Image ; son modèle se règle dans
**Réglages ▸ Génération ▸ Vectorisation**.

**Vignette** *(thumbnail)*
La petite image qui représente un *asset* dans l’étagère ou un *modèle* dans le catalogue.

---

## W

**Waveform** *(forme d’onde)*
Le dessin d’un son : ces vagues qui montrent où c’est fort et où c’est silencieux. C’est ce qui
permet de repérer une phrase ou un coup sans écouter. Sa fabrication demande *ffmpeg*.

---

## Z

**Zoom, taille réelle, ajuster**
Trois façons de regarder une image :

| Commande | Ce qu’elle fait |
|---|---|
| **Zoom avant / arrière** (`⌘=` / `⌘−`) | change l’échelle d’un cran |
| **Ajuster à la fenêtre** (`⌘0`) | cadre l’image entière, sans jamais l’agrandir au-delà du réel |
| **Taille réelle** (`⌘1`) | un pixel de l’image pour un pixel d’écran |

**La taille réelle est la seule échelle où l’on juge la netteté.** Partout ailleurs, ce que vous
voyez est un calcul.

---

[← Quand ça coince](16-depannage.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Ce qui n’existe pas encore →](18-limites.md)
