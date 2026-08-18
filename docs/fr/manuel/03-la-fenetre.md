# 3. La fenêtre, expliquée

[← Premiers pas](02-premiers-pas.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Les projets →](04-projets.md)

La fenêtre du studio ressemble à celle d’un logiciel de montage, pas à une page web. Ce chapitre
en démonte chaque morceau.

---

## L’accueil, avant tout le reste

Le studio s’ouvre sur l’accueil — un écran qui dit où vous en étiez, ce que le studio sait
commencer, et ce que les autres ont publié. Il se ferme dès que vous entrez dans un espace de
travail.

**Il a la même charpente qu’un espace** : les deux rails, les deux colonnes de panneaux, la ligne
d’état en bas. Ce qui change est le centre — une page qu’on déroule, au lieu d’onglets. **Il n’a
pas d’onglets**, parce qu’il n’ouvre aucun document : il mène à ceux des autres espaces.

### La bannière, en haut

Elle n’affiche qu’une chose à la fois :

| Ce qu’elle affiche | Quand |
|---|---|
| **Reprendre où vous en étiez** | un document était ouvert la dernière fois |
| **_n_ générations en cours** | quelque chose tourne encore |
| **Connecter une clé API** | aucune clé n’est enregistrée |
| **Tout est prêt** | aucun des cas ci-dessus |

Tant que le studio lit vos projets, elle reste muette plutôt que d’annoncer « Tout est prêt »
puis de se corriger.

### Les trois bandes

Le centre empile trois bandes, dans cet ordre :

| Bande | Ce qu’elle montre | Il faut |
|---|---|---|
| **Où vous en étiez** | la bannière : reprendre, connecter, ou créer | rien |
| **Outils** | ce que le studio sait commencer, et de quoi créer ou ouvrir un projet | rien |
| **Explorer** | ce que tout le monde a publié, par type | une clé API |

**Une bande qui n’a pas ce qu’il lui faut n’est pas grisée : elle n’est pas là.** Sans clé API,
**Explorer** n’existe pas sur cet écran.

**Outils** liste les espaces dans le même ordre que la barre des espaces, avec **Nouveau projet**,
**Ouvrir un projet** et **Réglages** à côté. C’est la bande qui parle encore sur une machine sans
clé, sans projet et sans historique.

Tout le reste de l’accueil est un panneau, logé dans les deux colonnes.

### Explorer, le fil sans fin

Le fil de ce que **tout le monde** a publié, une catégorie à la fois — les six types du studio,
en onglets. Pas d’onglet « tout ».

- **il se charge en descendant** : le fil pagine tant que vous scrollez ;
- **il reste en bas de page**, et ne se déplace pas ;
- **les tuiles ne font rien.** Elles appartiennent à quelqu’un d’autre.

C’est la seule bande qui puisse être masquée.

### Cliquer une vignette l’ouvre

**C’est la règle de toute la page.** Un clic sur une image l’ouvre dans son espace. Ce qui n’est
pas « ouvrir » est une action secondaire, révélée au survol dans le coin de la vignette.

**Refaire une image ne coûte aucun appel réseau.** « En refaire une avec… », dans le coin de
chaque création, rouvre le formulaire déjà rempli — modèle, prompt et réglages sont gardés à côté
de l’asset.

**Une exception : un asset de la bibliothèque que vous n’avez pas encore rapatrié.** Le clic le
**récupère**, et le bouton le dit ; une fois descendu, il s’ouvre comme les autres. Rien n’est
téléchargé sans que vous l’ayez demandé. Sans projet ouvert, ou pendant un transfert, la vignette
ne répond pas.

C’est là, et nulle part ailleurs, qu’on rapatrie ; l’étagère, elle, sait envoyer — voir
[Les assets](07-assets.md).

### Ranger la page

**Masquer cette section**, au survol d’un titre de bande. Les sections masquées sont comptées en
bas de page — « 1 section masquée » — avec un bouton **Les réafficher**.

Seul **Explorer** porte ce bouton : **Où vous en étiez** et **Outils** sont épinglées, et c’est ce
qui garantit que cet écran n’est jamais vide.

### La colonne de gauche

Coupée en deux, comme dans les espaces : en haut ce avec quoi on produit, en bas ce qu’on
parcourt. **L’accueil ne fabrique aucun document** — il mène à ceux des autres espaces — alors sa
moitié haute va à ce dans quoi on produit : les projets.

| Panneau | Moitié | Ce qu’il montre | Il faut |
|---|---|---|---|
| **Vos projets** | 1re | ceux que vous avez ouverts récemment, avec leur dossier, à rouvrir d’un clic — [son menu par ligne](04-projets.md#la-liste-des-projets-de-laccueil) | rien |
| **Explorateur** | 2de | le projet ouvert, lu comme un dossier | un projet ouvert |
| **Git** | 2de | ce qui a changé dans ce dossier depuis la dernière version enregistrée | un projet ouvert |

**C’est le même Explorateur que dans les espaces**, à la même place — voir
[Les projets](04-projets.md#parcourir-le-projet--le-panneau-explorateur). Il montre le dossier
entier : vos documents, vos assets, et tout ce que vous y avez déposé vous-même.

**Sans projet ouvert, ces deux-là ne sont pas là du tout** — les seuls panneaux de l’accueil dans
ce cas. Ailleurs, un panneau reste et dit ce qui lui manque ; ici ils diraient « aucun projet
ouvert » juste à côté du panneau dont le métier est d’en ouvrir un.

Le panneau **Git** lit le même dossier que l’Explorateur, sous un autre angle : non pas ce qu’il
contient, mais ce qui y a changé depuis la dernière fois que vous avez enregistré un état. Les
deux se relaient dans la même moitié — leurs icônes sont côte à côte dans le rail. Son mode
d’emploi est au chapitre
[Les projets](04-projets.md#enregistrer-des-versions--le-panneau-git).

### La colonne de droite

| Panneau | Moitié | Ce qu’il montre | Il faut |
|---|---|---|---|
| **Votre bibliothèque** | 1re | ce que votre compte détient en ligne | une clé API |

**« Il faut » ne veut pas dire la même chose que pour les bandes.** Une bande à qui il manque
quelque chose disparaît ; **un panneau reste et dit ce qui lui manque**. Sans clé, *Votre
bibliothèque* dit qu’elle est vide **ou** qu’aucune clé n’est renseignée, sans trancher — et si
le serveur refuse, elle offre de **réessayer**.

**Rien n’y est gardé.** La bibliothèque est relue à chaque visite, et les vignettes sont des
adresses signées qui expirent ; les retenir ferait un panneau d’images cassées quinze jours plus
tard, sans rien pour l’expliquer. Changer de clé la relit aussi : une autre clé est une autre
bibliothèque.

> **L’accueil peut être coupé.** **Réglages ▸ Général ▸ Afficher l’accueil** : décoché, le
> studio va droit à l’espace que vous aviez quitté. Ce que vous masquez se règle sur l’accueil
> lui-même.

---

## Le plan d’ensemble

```
┌──────────────────────────────────────────────────────────────┐
│  BARRE DE TITRE — l'accueil et les six espaces de travail    │
├──┬────────────────────────────────────────────────────────┬──┤
│  │                    zone haute                          │  │
│ R├────────────────────────────────────────────────────────┤ R│
│ A│         │                                    │         │ A│
│ I│  zone   │       ZONE DES DOCUMENTS           │  zone   │ I│
│ L│ gauche  │      (les onglets vivent ici)      │ droite  │ L│
│  │         │                                    │         │  │
│ g├────────────────────────────────────────────────────────┤ d│
│  │                    zone basse                          │  │
├──┴────────────────────────────────────────────────────────┴──┤
│  LIGNE D'ÉTAT — projet — document                            │
└──────────────────────────────────────────────────────────────┘
```

Cinq éléments, dans l’ordre où on les rencontre :

1. la **barre de titre**, qui porte les espaces de travail ;
2. les **rails**, collés aux bords gauche et droit : des bandes d’icônes ;
3. les **zones**, où vivent les panneaux ;
4. la **zone des documents**, au centre ;
5. la **ligne d’état**, tout en bas.

**Les couleurs ont un sens.** Le fond général — le *châssis* — est gris moyen ; les panneaux posés
dessus sont **plus sombres**, avec des coins arrondis.

---

## La barre de titre

Elle ne porte pas le nom du fichier, mais les **six espaces de travail** :

**Image** · **Vidéo** · **3D** · **Audio** · **Textures** · **Skyboxes**

Un clic change d’espace ; l’espace actif est plus clair que les autres. Changer d’espace fait
trois choses :

- **les panneaux se réarrangent** — chaque espace montre les outils dont il a besoin ;
- **les onglets changent** — chaque espace a ses propres documents ouverts ;
- **le catalogue se filtre** — Modèles ne montre que les modèles capables de ce type de contenu.

Sur macOS, les trois pastilles restent à leur place habituelle, à gauche.

### Ranger les espaces dans l’ordre qui vous arrange

| Geste | Comment |
|---|---|
| **Glisser** | attrapez un espace et lâchez-le sur un autre |
| **Clavier** | `⌥←` / `⌥→` sur l’espace focalisé — les flèches nues parcourent la barre |
| **Clic droit** | **Déplacer à gauche** / **Déplacer à droite** |

Les deux touches se remappent sous le contexte *Dans la barre des espaces* de
l’[écran des raccourcis](15-raccourcis.md).

**L’Accueil ne bouge pas** et reste en tête. L’ordre est le même dans la section **Outils** de
l’accueil, et il est retenu d’une session à l’autre.

> **Un espace ajouté par une mise à jour n’atterrit pas au bout de votre barre.** Il se pose là où
> le studio le range d’origine, après le dernier de ses voisins que vous avez gardés.

### Le sélecteur de compte

À droite de la barre de titre : un point de couleur, un nom, un chevron.

| Ce que vous voyez | Ce que ça dit |
|---|---|
| Point **vert** | la clé du compte affiché fonctionne |
| Point **gris** | elle ne fonctionne pas, ou il n’y a pas de compte |
| **Le nom** | le compte en cours d’utilisation |
| **« Non connecté »** | aucun compte n’est enregistré |

Un clic ouvre la liste de vos comptes, celui en cours étant coché, plus **Gérer les comptes…** qui
mène aux réglages. Sans aucun compte enregistré, le bouton va directement aux réglages.

> **Changer de compte change la bibliothèque, pas votre travail.** Chaque clé API porte son propre
> projet Scenario — ses modèles, ses assets, son crédit. Votre projet local est sur votre disque et
> n’appartient à aucun compte.

Les clés se tapent dans les réglages, et nulle part ailleurs.

---

## Les rails

Les deux bandes verticales d’icônes, collées aux bords. **Un rail ne disparaît jamais** : même
quand vous avez tout fermé, chaque panneau reste à un clic.

Un clic sur une icône **ouvre** le panneau ; un second le **referme**. Un **trait de séparation**
indique la coupure d’une zone : les icônes au-dessus ouvrent dans la première moitié, celles en
dessous dans la seconde.

### Le rail de gauche

| Élément | Ce qu’il fait |
|---|---|
| **+** (bouton bleu) | crée un **nouveau document** dans l’espace actif — à l’accueil, un **nouveau projet** |
| *séparateur* | |
| Icônes de la **moitié haute** | Modèles, Génération, puis Assets — ce que Scenario propose ; l’accueil y met **Vos projets** |
| *séparateur* | |
| Icônes de la **moitié basse** | l’Explorateur puis Git, à l’accueil comme dans les espaces |
| Tout en bas | Timeline puis Historique, selon l’espace ; à l’accueil, l’Historique seul |

> **Le bouton + fait ce que l’écran sait faire.** Dans un espace, il est grisé tant qu’aucun
> projet n’est ouvert : un document est un fichier dans un dossier de projet. **À l’accueil il
> n’est jamais grisé** — il crée le projet, et créer un projet n’en demande pas un.

### Le rail de droite

Les icônes de la colonne de droite — Skybox, Vue, Calques, Canaux, Styles, Scène, Lumières,
Mailles, celles que l’espace déclare, dans cet ordre — puis, sous le trait, Inspecteur.

En **Vidéo** et en **Audio**, la moitié haute de cette colonne est vide : ces deux espaces n’y
déclarent rien, et le rail ne porte alors que l’Inspecteur.

À l’accueil, il n’en porte qu’une : **Votre bibliothèque**, et rien sous le trait.

### Le rail ne montre que ce que l’espace sait faire

Une icône n’apparaît que si l’espace a réellement ce panneau : les Calques n’existent pas dans
l’espace Audio.

**La Génération est un cas particulier** : son icône est absente tant qu’aucun modèle n’est
choisi. Elle apparaît dès que vous en choisissez un dans **Modèles**, et reste si vous avez fixé
un modèle par défaut pour cette famille.

---

## Les zones et les panneaux

Quatre zones — **gauche**, **droite**, **haute**, **basse** — chacune coupée en deux moitiés, et
chaque moitié montre **un panneau à la fois** :

- deux panneaux de la **même moitié** se relaient : ouvrir le second referme le premier ;
- deux panneaux de moitiés **différentes** de la même zone s’affichent **ensemble**.

> **La zone haute n’accueille aucun panneau pour l’instant.** Elle existe dans la structure et
> reste réservée.

### Redimensionner

**Tirez sur l’espace entre deux panneaux** — la *gouttière* est elle-même la poignée.

Le studio garde toujours **au moins 240 pixels** pour la zone des documents et **au moins 140**
pour chaque zone latérale : vous ne pouvez pas écraser le centre par accident.

Tailles de départ : colonne de gauche 320 px, colonne de droite 260 px, bande basse 240 px.

### Fermer, rouvrir, tout remettre en place

Un panneau se ferme, il ne se replie pas. Trois façons de retrouver ce que vous avez fermé :

| Moyen | Effet |
|---|---|
| Cliquer son icône dans le rail | rouvre ce panneau-là |
| **Affichage ▸ Modules** | même chose, depuis le menu |
| **Affichage ▸ Réinitialiser la disposition** | remet **tous** les panneaux à leur place d’origine |

> **Réinitialiser la disposition ne touche pas votre travail.** Cela ne déplace que des panneaux.

### Quand un panneau devient étroit

Sa ligne de titre cède du terrain progressivement : ses propres contrôles — un filtre, un bouton
de vue — partent les premiers. **Le bouton de fermeture ne part jamais**, et le nom du panneau
garde sa taille.

---

## La liste complète des panneaux des espaces

| Panneau | Zone | Moitié | Visible dans | Ce que c’est |
|---|---|---|---|---|
| **Modèles** | gauche | 1re | partout | le catalogue Scenario, filtré sur l’espace actif |
| **Génération** | gauche | 1re | partout *(si un modèle est choisi)* | le formulaire du modèle choisi |
| **Assets** | gauche | 1re | partout | l’étagère : ce que le projet tient, ce que votre clé possède, ce qui est en train d’être produit |
| **Skybox** | droite | 1re | Skyboxes | les réglages du ciel ouvert |
| **Vue** | droite | 1re | Skyboxes | la projection, l’angle de vue et les objets de test |
| **Calques** | droite | 1re | Image | la pile de calques de l’image ouverte |
| **Canaux** | droite | 1re | Textures | les huit canaux de la matière ouverte |
| **Styles** | droite | 1re | Textures | les réglages de matière enregistrés, à rejouer sur n’importe quelle matière |
| **Scène** | droite | 1re | 3D | l’arbre de la scène ouverte |
| **Lumières** | droite | 1re | 3D | les sources lumineuses de la scène |
| **Mailles** | droite | 1re | 3D | les objets de la scène, et le bouton qui en ajoute |
| **Explorateur** | gauche | 2de | partout | le dossier du projet, dossiers et fichiers |
| **Git** | gauche | 2de | partout *(si un projet est ouvert)* | ce qui a changé dans le dossier du projet depuis la dernière version enregistrée |
| **Inspecteur** | droite | 2de | partout | ce qui est sélectionné, réglable en direct |
| **Timeline** | bas | 1re | Vidéo, Audio, 3D | la séquence en cours de montage, ou l’animation |
| **Historique** | bas | 1re | partout *(si un projet est ouvert)* | les versions enregistrées du projet, et ce que chacune a changé |

> **« Partout » veut dire les espaces de travail, pas l’accueil.** L’accueil a ses propres
> panneaux — cinq — que ce tableau ne liste pas. **Trois sont communs aux deux** : l’Explorateur
> et Git dans la colonne de gauche, l’Historique dans une bande basse que l’accueil n’avait pas
> avant. Tous trois ne s’affichent qu’avec un projet ouvert : sans projet, l’accueil est celui
> qu’il a toujours été, deux colonnes et rien en bas.

**La colonne de gauche se lit en deux temps : ce que Scenario propose, puis ce qui est déjà à
vous.** En haut, **Modèles**, **Génération** et **Assets**, qui se relaient — un modèle à choisir,
son formulaire, et l’étagère de ce qu’il produit. En bas, l’**Explorateur** et **Git**, qui se
relaient aussi : le dossier de votre projet, et ce qui y a changé.

La coupure entre les deux moitiés est ce qui rend le geste possible : l’étagère et l’Explorateur
tiennent l’écran **ensemble**, et rien n’entre dans le projet sans passer de l’une à l’autre.

**La colonne de droite est celle du document ouvert** : ce qu’il contient, ce qui l’éclaire, ce
qui est sélectionné. Les panneaux prennent leur tour dans la moitié haute, l’**Inspecteur**
occupe toujours la moitié basse.

### Une moitié montre ce que l’espace y met

Ouvrez la bande basse en Vidéo : c’est le montage. Passez en Image : la même bande devient
l’Historique, sans rien rouvrir.

**Ce que vous avez ouvert, c’est une zone**, et elle le reste. Fermer la moitié la vide partout.

- **rien n’est réécrit** : revenez dans l’espace d’origine, vous retrouvez ce que vous y aviez ;
- **une Génération sans modèle laisse la place aux Modèles.**

### Une moitié que vous n’avez pas choisie s’ouvre sur le premier panneau de l’espace

Tant que vous n’avez cliqué aucune icône d’une moitié, elle affiche le premier panneau que
l’espace y déclare. C’est ce que vous voyez à la première ouverture, et ce que **Affichage ▸
Réinitialiser la disposition** rétablit.

La moitié haute de gauche s’ouvre sur les **Modèles** dans tous les espaces — choisir un modèle
est ce par quoi tout commence, et l’étagère se demande. La moitié basse s’ouvre sur
l’**Explorateur**, partout aussi.

| Espace | La moitié haute de droite s’ouvre sur | La bande basse sur |
|---|---|---|
| **Image** | Calques | Historique |
| **Vidéo** | *rien* | Timeline |
| **3D** | Scène | Timeline |
| **Audio** | *rien* | Timeline |
| **Textures** | Canaux | Historique |
| **Skyboxes** | Skybox | Historique |

> **L’Historique demande un projet ouvert.** Sans projet, la bande basse de ces trois espaces
> n’affiche rien — la zone est là, elle est vide.

Dès que vous cliquez une icône, cette moitié retient **votre** choix et ne bouge plus, jusqu’à ce
que vous en cliquiez une autre ou que vous réinitialisiez la disposition.

**L’Explorateur est visible partout.** Un double-clic sur un document l’ouvre, en changeant
d’espace s’il appartient à un autre ; sur un fichier d’`assets/`, il l’ouvre dans l’espace qui
édite son type ; sur tout le reste, il le confie au système.

---

## La zone des documents

Le centre, où se trouve ce que vous fabriquez. **Elle ne prend que des documents** : un fichier
ouvert et sa barre d’outils. Aucun panneau ne peut y entrer.

### Les onglets

Chaque document ouvert a son onglet, en haut du centre ; un clic passe de l’un à l’autre. Ils
peuvent être **déplacés**,
**réorganisés** et **posés côte à côte** : faites glisser un onglet vers un bord du centre, une
zone de dépôt s’affiche, lâchez.

### Le point à côté du nom

Un onglet dont le travail n’est pas écrit sur le disque porte **un point** (`•`). Il disparaît à
l’enregistrement (`⌘S` / `Ctrl+S`) et revient à la modification suivante. Si vous annulez jusqu’au
point exact où vous aviez enregistré, il disparaît aussi.

> **Les six types de documents savent s’enregistrer** — images en calques, scènes 3D, matières,
> séquences, sons édités et ciels. Ce qui ne revient pas d’un enregistrement à l’autre, c’est
> l’historique d’annulation. Voir [Ce qui n’existe pas encore](18-limites.md).

### Fermer un onglet

La croix ferme le document. **S’il porte le point**, le studio demande d’abord :

- **Enregistrer** écrit puis ferme — c’est ce que `⏎` choisit ;
- **Ne pas enregistrer** ferme et perd le travail fait depuis le dernier `⌘S` ;
- **Annuler** ne ferme rien — c’est aussi ce que répond `⎋`.

Si l’écriture échoue, l’onglet reste ouvert et la raison part dans le journal d’activité.

### Le menu d’un onglet

Un **clic droit** ouvre quatre gestes :

| Ligne | Ce qu’elle fait |
|---|---|
| **Renommer** | ouvre le nom dans l’onglet ; un double-clic fait la même chose |
| **Fermer l’onglet** | comme la croix, question comprise |
| **Fermer les autres onglets** | ferme un par un ; un *Annuler* arrête la série |
| **Supprimer le document…** | **retire le fichier du dossier du projet** |

Renommer change le nom **partout à la fois** — l’onglet, l’Explorateur, la liste des documents,
la barre de statut — et le fichier sur le disque avec, puisque c’est le même nom.

**Supprimer est irréversible**, et c’est le seul geste du studio qui efface un fichier que vous
avez fait. Le studio demande confirmation, et cette fois *Annuler* est le bouton par défaut.

### Chaque espace a ses propres onglets

Passer de « Image » à « 3D » ne ferme rien : cela range les onglets d’Image et sort ceux de 3D.

---

## La ligne d’état

La bande fine, tout en bas. À gauche, elle indique **où vous êtes** :

| Ce qui s’affiche | Situation |
|---|---|
| *Aucun projet ouvert* | rien n’est ouvert |
| `Mon projet` | un projet est ouvert, aucun document en avant |
| `Mon projet — Falaise` | le document « Falaise » est en avant |

### Les générations, à droite de la ligne d’état

Vos demandes en cours. **Il n’y a pas de panneau Tâches** : une génération se lit depuis
n’importe quel espace. Ce que vous voyez, quand quelque chose travaille :

```
3 générations  ▓▓▓▓▓░░░░░  45 %  ⌃
```

| Élément | Ce qu’il dit |
|---|---|
| **« 3 générations »** | combien travaillent en ce moment |
| **La barre** | leur avancement moyen |
| **Le pourcentage** | le même chiffre, en clair |
| **Le chevron** | un clic ouvre la liste complète |

**Quand plus rien ne travaille, la zone disparaît** — **sauf s’il y a eu un échec** : « 2 échecs »
reste affiché après la fin des tâches.

**Le clic ouvre la liste**, dans une petite fenêtre au-dessus de la ligne d’état : une ligne par
tâche, son modèle, son état, sa barre, et le bouton qui l’annule. Sous la barre, ce que la
génération a coûté — ou, si elle a échoué, pourquoi.

### Le journal, à côté

Une seconde icône, sur la même ligne : le **journal d’activité**. Il retient ce que le studio a
fait et ce qu’il a raté — une génération, un import, un envoi vers la bibliothèque, un
enregistrement. **Il est toujours là**, contrairement aux générations qui s’effacent au repos.

| Ce que vous voyez | Situation |
|---|---|
| une petite horloge grise | tout va bien, le journal est consultable |
| une alerte et « 2 échecs » en rouge | deux choses ont échoué et n’ont pas été lues |

**Un clic ouvre la liste et marque tout comme lu.** Deux filtres y attendent : le **niveau**
(information, avertissement, échec) et le **sujet** (génération, import, bibliothèque, document,
projet, interface). **Chacun est un menu** : le bouton dit ce qu’il retient — « Niveau : Échec »,
ou « Niveau : Tout » — et l’ouvrir donne les cases à cocher. La ligne **Tout**, en tête du menu,
relâche le filtre entier.

**Interface, c’est le studio lui-même** plutôt que ce qu’il contient : un panneau qui n’a pas pu
se dessiner, un agencement enregistré devenu illisible — [voir le chapitre 16](16-depannage.md).

**Pour refermer** : un clic à côté, `Échap`, le passage à une autre application, ou recliquer
l’icône. C’est vrai de tout ce qui flotte au-dessus de la fenêtre.

### Les bulles qui ne s’effacent pas

Un échec fait apparaître une **bulle** dans le coin bas-droit, au-dessus de la ligne d’état.

- **Seuls les échecs en font une.** Un asset importé avec succès a sa ligne dans le journal.
- **Elles ne disparaissent pas toutes seules.** Elle part quand vous la fermez, et cette
  fermeture la marque lue.

---

## Le menu natif

Le menu du système — en haut de l’écran sur macOS, en haut de la fenêtre ailleurs.

| Menu | Ce qu’on y trouve |
|---|---|
| **Fichier** | Nouveau projet…, Ouvrir un projet…, Enregistrer, Réglages… |
| **Édition** | Annuler, Rétablir, et les commandes de texte du système |
| **Affichage** | Modules, Réinitialiser la disposition, Plein écran, zoom de l’image |
| **Objets** | **Ajouter ▸ Maille**, **Ajouter ▸ Lumière** — dans l’espace Modélisation |
| **Fenêtre** | les commandes de fenêtre du système |
| **Aide** | À propos de Scenario Studio, Consommation…, Licences |

Les raccourcis affichés dans les menus sont **ceux que vous avez réglés**.

**Affichage ▸ Modules** ne liste que ce que l’espace peut ouvrir, comme le rail.

### La fenêtre de consommation

**Aide ▸ Consommation…** dit **ce que vos clés ont dépensé**. En haut à droite, la période :
**7, 31 ou 120 jours**, sur 31 par défaut.

| Section | Ce qu’elle montre |
|---|---|
| **Vue d’ensemble** | le total sur la période, les remises, le nombre de générations, la dépense par jour et par compte |
| **Modèles** | quels modèles ont coûté, combien de générations chacun a servi, et la part passée par une clé API |
| **Activités** | ce qui a été fait, et les assets qui en sont sortis |
| **Journal** | chaque événement facturé, du plus récent au plus ancien, par pages |

Activités et Journal nomment leurs lignes dans la langue de la fenêtre : vous lisez « Génération
d’images », pas `images-generation`. Un type d’événement que le studio ne connaît pas encore
affiche le nom brut de l’API.

Trois avertissements y sont affichés :

- **il n’y a pas de solde.** L’API Scenario n’expose que ce qui a été dépensé, jamais ce qui
  reste. Aucun chiffre ne dira combien vous pouvez encore générer ;
- **le montant en euros est indicatif.** Calculé sur la grille publique des packs prépayés : un
  ordre de grandeur, pas une facture ;
- **le total mélange des comptes facturés séparément.** Avec plusieurs clés, la somme affichée ne
  correspond à aucune facture réelle — la Vue d’ensemble détaille par compte.

**Une clé qui ne répond pas ne fausse pas les chiffres en silence** : la fenêtre nomme les clés
restées muettes et précise que les totaux sont ceux des autres. Sans aucune clé enregistrée, elle
le dit et renvoie aux réglages.

### La fenêtre des licences

**Aide ▸ Licences** liste les logiciels que Scenario Studio embarque : nom, version, et nom court
de la licence (`MIT`, `Apache-2.0`…). Cliquez une ligne : le **texte entier** se déplie, et le
lien vers les sources s’affiche quand la licence l’exige.

Trois textes, trois portées :

| Ce dont on parle | Sous quelles conditions | Où le lire |
|---|---|---|
| **Le code source** du studio | PolyForm Noncommercial 1.0.0 — réutilisable pour tout usage **non commercial** | `LICENSE`, dans le dépôt |
| **L’application** installée | ses propres conditions d’utilisation | `EULA.md`, dans le dépôt |
| **Les composants tiers** | chacun garde la sienne | cette fenêtre, et `THIRD-PARTY-NOTICES.md` |

**Le cas de ffmpeg est à part** : il n’est pas lié dans l’application, il est lancé **à côté**,
comme un programme séparé. Sa licence diffère selon la plateforme — GPL sur macOS, LGPL ailleurs —
et **ses sources correspondantes sont attachées à chaque version publiée**.

---

## Ce que le studio retient tout seul

Vous n’avez rien à enregistrer pour cela :

- **la disposition de vos panneaux**, par espace de travail et par projet ;
- **la taille de chaque zone** ;
- **les onglets ouverts**, par espace ;
- **le dernier projet ouvert**, rouvert au lancement suivant — réglable, voir
  [Tous les réglages](14-reglages.md) ;
- **le modèle choisi**, par famille.

---

## Fermer la dernière fenêtre quitte le studio

Sur macOS, l’habitude veut qu’une application survive à ses fenêtres. **Ce n’est pas ce que fait
le studio** : fermer la dernière fenêtre le quitte, sur les trois systèmes.

> Vos documents ne partent pas avec elle : ce qui n’est pas enregistré est **demandé avant** que
> la fenêtre se ferme.

---

[← Premiers pas](02-premiers-pas.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Les projets →](04-projets.md)
