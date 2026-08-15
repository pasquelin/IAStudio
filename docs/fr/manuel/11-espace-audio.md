# 11. Espace Audio

[← Espace Vidéo](10-espace-video.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Textures →](12-espace-textures.md)

L’espace où l’on met un son en forme — le raccourcir, le faire monter en douceur, égaliser son
volume — puis où on le pose à côté des autres.

---

## Comment l’espace est disposé

Comme en Vidéo, la **bande basse appartient au montage** et l’étagère à assets prend la moitié
haute de la **colonne de droite**, pour qu’une prise se glisse de l’une vers l’autre sans avoir à
changer de panneau. La colonne de gauche porte les Modèles et la Génération, comme partout
ailleurs.

Au centre, **deux moniteurs empilés** — là où la Vidéo pose les siens côte à côte. Ils prennent
toute la largeur, l’un sous l’autre :

| Moniteur | Ce qu’il montre |
|---|---|
| **Le montage**, en haut | toutes les pistes réunies, du début à la fin |
| **La prise**, en bas | le son que vous éditez, avec ses outils |

Une **poignée** les sépare : tirez-la pour donner plus de place à l’un ou à l’autre. Sous chacun,
une ligne rappelle lequel des deux on regarde.

> **L’onglet audio porte deux moitiés, et elles s’enregistrent ensemble.** En bas,
> l’**éditeur d’une prise** : la forme d’onde et ses outils. En haut et dans la bande basse, le
> **montage**, où l’on pose des prises les unes à côté des autres — décrit
> [plus bas](#le-montage). Un seul onglet, un seul `⌘S`, un seul fichier.

---

## Ouvrir un son

**Trois gestes, et ils ne mènent pas au même endroit :**

| Geste | Où la prise atterrit |
|---|---|
| **Double-clic** sur un asset audio de l’étagère | dans un **onglet à lui**, ouvert pour l’occasion |
| **Déposer** la prise sur le moniteur du bas | dans l’onglet **que vous avez devant vous** |
| **Clic droit ▸ Ouvrir dans l’éditeur audio** | idem |

**Le double-clic ne regarde jamais l’onglet en avant.** C’est la règle de tout le studio, décrite
dans [Les assets](07-assets.md) : il ouvre l’asset dans l’espace de son type, quoi qu’il y ait à
l’écran. Il n’a donc besoin d’aucun onglet préalable — et **rouvrir la même prise revient à son
onglet**, il n’en naît pas un second.

**Le bouton `+` du rail gauche** ouvre un onglet audio vide. Ce n’est pas un préalable au
double-clic : il sert quand vous voulez le montage avant d’avoir une prise à y poser.

Tant qu’aucun clip n’est sélectionné, le moniteur du bas affiche : « Sélectionnez un clip du
montage pour l’éditer ici, ou déposez une prise. »

> **C’est ce geste qui décide si vos prises se retrouvent ensemble.** Deux double-clics sur deux
> sons différents ouvrent **deux onglets**, chacun avec son propre montage. Pour les monter côte à
> côte, il faut les faire entrer dans le **même** onglet : dépôt sur le moniteur du bas, ou clic
> droit.

### Le montage commande, l’éditeur suit

C’est la règle qui explique tout le reste de ce chapitre, et elle tient en une phrase :
**l’éditeur du bas montre le clip que le montage a sélectionné.** Exactement comme le moniteur
Source de l’[espace Vidéo](10-espace-video.md) montre le clip choisi.

**Une prise ouverte est donc posée sur le montage, puis sélectionnée** — à la tête de lecture,
sur une piste son que le studio choisit. C’est ce qui la fait apparaître dans l’éditeur : elle
n’y entre pas directement, elle y arrive parce qu’elle vient d’être sélectionnée.

**Cliquez sur un autre clip de la bande basse, et c’est lui que l’éditeur montre.** Aucun geste
d’ouverture n’est nécessaire ; la sélection suffit.

### Chaque clip garde ses propres réglages

**Les prises s’accumulent, elles ne se remplacent pas.** Ouvrez-en une seconde : elle se pose à
côté de la première, sélectionnée, et **la première reste sur le montage avec tout ce que vous
lui aviez fait**. Rognage, fondus, normalisation — la chaîne d’outils appartient au **clip**, pas
à l’onglet. Revenez dessus en le sélectionnant, et vous retrouvez son état.

C’est ce qui relie les deux moitiés : le clip de la bande basse **est** la prise du moniteur du
bas, et il suit ce que vous lui faites — un rognage le raccourcit, un fondu se voit sur ses
bords, une normalisation change son gain. Deux choses lui restent propres, parce qu’elles
appartiennent au montage et non à la prise : **où il commence** et **à quelle vitesse il joue**.

**Et l’éditeur ne travaille que sur la tranche du clip.** Si vous avez raccourci un clip en tirant
son bord sur la bande, les outils agissent sur ce qui reste, jamais sur le fichier entier.

> **Rouvrir la prise déjà sous l’éditeur ne fait rien**, et c’est voulu : un second clip sur les
> mêmes sons laisserait la chaîne du premier sans rien pour la rappeler.

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

**La barre de l’éditeur dit toujours où vous en êtes** : les deux bornes de la sélection quand il
y en a une, et « Glissez sur l’onde pour sélectionner » quand il n’y en a pas. Une zone que
personne ne sait tracer ne s’explique pas par une infobulle qui n’apparaît qu’au survol.

**La lecture, elle, ignore la sélection** : elle joue la prise entière depuis la position du
curseur, et ne reboucle pas sur la zone. Pour juger un passage, replacez le curseur avant lui.

Sans sélection, les outils qui en ont besoin travaillent sur des valeurs par défaut — un fondu
d’une seconde, par exemple.

---

## Les outils

| Outil | Ce qu’il fait |
|---|---|
| **Rogner** | ramène le clip à la sélection, sur le montage |
| **Fondu d’entrée** | fait monter le son depuis le silence, sur la sélection |
| **Fondu de sortie** | fait descendre le son vers le silence, sur la sélection |
| **Normaliser** | ramène le niveau général à −14 LUFS |
| **Couper les silences** | resserre le clip sur ce qui n’est pas silence, aux deux bouts |
| **A/B** | fait entendre la source d’origine, sans rien annuler |

### Ce que « normaliser » veut dire

Rendre le son **ni trop faible, ni trop fort**, à un niveau standard.

**−14 LUFS** est la cible retenue par la plupart des plateformes de diffusion — YouTube, Spotify,
et les autres. Un son normalisé à cette valeur sonnera à peu près au même volume que ce qui
l’entoure, au lieu de faire sursauter ou d’obliger à monter le son.

Le « LUFS » est l’unité du volume **perçu**, celle qui tient compte de la façon dont l’oreille
humaine entend — bien plus utile que la simple recherche du pic le plus fort.

> **Le studio en calcule une approximation, et il vaut mieux le savoir.** La mesure normalisée
> (ITU-R BS.1770) applique un filtre de pondération et écarte les passages silencieux ; le studio
> se contente d’une **moyenne quadratique** sur toute la prise. Sur un son **généré** — une seule
> texture, pas de dialogue, pas de silences à écarter — les deux valeurs tombent très près l’une
> de l’autre. Sur une prise de voix avec des blancs, elles s’écartent : **ne comparez pas ce
> chiffre à celui d’un mesureur LUFS professionnel.**

### À quoi sert le bouton A/B

À **entendre ce que vous avez changé**.

Un clic, et le studio joue le son d’origine, tel qu’il était avant vos retouches. Un second clic,
et il rejoue votre version. Rien n’est annulé : c’est une comparaison, pas un retour en arrière.

C’est le geste le plus utile de tout l’espace. On croit souvent avoir amélioré un son, et l’A/B
dit la vérité en trois secondes.

---

## Rien n’est écrit tant que vous ne le dites pas

C’est le point important de cet espace.

Vos outils **n’écrivent pas dans le fichier**. Ils empilent une liste d’instructions — « fondu
d’une seconde », « normaliser » — qui est rejouée par-dessus le son d’origine à chaque fois.

Deux conséquences très pratiques :

- **annuler ne coûte rien**, quel que soit le nombre d’étapes ;
- **l’A/B est instantané**, parce que la source est toujours là, intacte.

**Rogner** et **Couper les silences** font exception, et pour une bonne raison : ils ne changent
pas le son, ils changent **les bornes du clip** sur le montage — exactement comme si vous aviez
tiré son bord à la souris. Là aussi rien n’est écrit dans le fichier.

> **`⌘Z` les défait, mais pas forcément en premier.** Ce sont des gestes de **montage**, et la
> touche remonte toujours les **outils** d’abord : après un fondu puis un rognage, la première
> pression défait le fondu, pas le rognage. Rien n’est perdu, l’ordre surprend — la règle
> complète est [plus bas](#annuler-et-rétablir).

Ce n’est qu’au moment où vous le demandez explicitement qu’un fichier est écrit :

| Bouton | Ce qu’il fait |
|---|---|
| **Appliquer** | crée un **nouvel asset** contenant la tranche telle que vous l’entendez, et **le clip du montage pointe désormais dessus**. L’original n’est jamais touché |
| **Enregistrer comme nouveau** | crée le même asset, mais **laisse le montage où il est**. À prendre quand vous voulez la version éditée à l’étagère, sans changer ce que joue le montage |

Les deux nomment le nouvel asset « *(édité)* ».

**Après « Appliquer », la chaîne de ce clip est vide et `⌘Z` ne la remonte plus.** C’est voulu, et
c’est la contrepartie du bouton : le nouveau fichier **porte** vos réglages, les rejouer
par-dessus les poserait une seconde fois — un fondu deux fois plus long, un gain deux fois plus
fort. La forme d’onde qui revient est celle de ce nouveau fichier.

> **C’est tout l’historique de l’éditeur qui part, pas seulement celui du clip.** Les autres clips
> gardent leurs chaînes — leurs fondus et leurs niveaux sont intacts —, mais plus aucune étape ne
> se défait par `⌘Z`, sur aucun d’eux. L’historique est celui du document, et il ne peut pas se
> rembobiner pour un seul bloc.
>
> **Ce que `⌘Z` défait encore, c’est le montage** : le clip repointé sur le nouvel asset, un
> rognage antérieur. Le son écrit sur le disque, lui, reste — et la chaîne qui l’a produit ne
> revient pas. Autrement dit, revenir en arrière après « Appliquer » vous rend le clip d’avant,
> pas les réglages d’avant.

> **Un même son peut servir à plusieurs clips**, ici comme dans d’autres onglets. C’est pourquoi
> « Appliquer » écrit à côté plutôt que par-dessus : réécrire l’original changerait tous ces
> clips d’un coup, sans rien dire.

---

## Le montage

La bande basse tient le **même montage que l’espace Vidéo**, à une chose près : il n’y a **pas de
piste image**. Un onglet audio neuf s’ouvre sur **quatre pistes son vides**, `A1` à `A4`.

C’est ce qui fait de l’Audio un espace de montage et non un simple éditeur de prise : une musique
se construit en posant des sons les uns à côté des autres.

**Les gestes sont exactement ceux du chapitre précédent** — glisser une prise depuis l’étagère,
tailler un clip par ses bords, la lame, les fondus, le gain, l’inspecteur, les en-têtes de piste
avec leur muet, leur solo et leur verrou. Tout est décrit dans
[Espace Vidéo](10-espace-video.md), et rien n’en change ici.

La barre du panneau porte en plus un bouton **Ajouter une piste audio** — un seul, là où la Vidéo
en a deux : il n’y a pas de piste image à ajouter.

Une seule différence avec la Vidéo, et elle vient de ce qu’un montage sonore n’a pas d’image :
**le moniteur du haut dessine une forme d’onde** — celle de toutes les pistes réunies, telle
qu’elle sera exportée. Le montage entier y tient en largeur, du début à la fin : c’est une vue
qu’on lit d’un coup d’œil, pas une qu’on fait défiler.

- **Cliquez dedans pour déplacer la tête de lecture.** Ce n’est pas une modification : rien
  n’entre dans l’historique.
- **Le transport est sous ce moniteur** : lecture/pause, retour au début, et le code temporel.
  `Espace` lit et met en pause, comme partout. La barre de titre de la bande basse porte les
  mêmes boutons, et ils commandent la même lecture.

> **Deux lectures, jamais en même temps.** Le moniteur du bas fait entendre la **chaîne
> d’outils** appliquée à la prise ouverte ; celui du haut fait entendre les **clips posés sur
> les pistes**. Lancer l’une arrête l’autre : le studio n’a qu’un seul lecteur.

---

## Annuler et rétablir

`⌘Z` / `Ctrl+Z` défait la dernière étape de la chaîne. `⇧⌘Z` la refait.

**Une seule touche pour les deux moitiés, et elle choisit toujours les outils d’abord.** Tant
qu’une étape d’outil reste à défaire, `⌘Z` la défait ; c’est seulement quand il n’en reste plus
que la touche s’adresse au montage. Pour défaire un geste de montage, il faut donc avoir remonté
tous les outils — ou n’en avoir posé aucun.

> **L’historique est celui de l’ONGLET, pas celui du clip affiché.** Les chaînes sont propres à
> chaque clip, mais leurs étapes sont empilées ensemble : `⌘Z` défait la dernière que vous avez
> posée, **même si c’était sur un autre clip que celui sous l’éditeur**. La sélection ne suit pas
> — c’est à vous de regarder ce qui a bougé.

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

Le détail est dans [Ce qui n’existe pas encore](18-limites.md).

> **Deux gestes différents, et il faut les distinguer.** `⌘S` enregistre le **document** — vos
> coupes, vos fondus, vos réglages, **et le montage de la bande basse** — dans un fichier `.aud`
> du projet, qui se rouvre tel quel. Une seule touche pour les deux moitiés : un montage bâti
> sur une prise qu’on n’a pas touchée est du travail, et il est enregistré comme tel.
> **Appliquer** et **Enregistrer comme nouveau** écrivent un **asset audio**, c’est-à-dire un son
> utilisable ailleurs, avec les réglages fondus dedans.
>
> Autrement dit : `⌘S` garde votre travail modifiable, Appliquer en sort le résultat. Une seule
> chose ne revient pas d’un document rouvert : l’écoute A/B, qui repart toujours sur la chaîne.

---

[← Espace Vidéo](10-espace-video.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Espace Textures →](12-espace-textures.md)
