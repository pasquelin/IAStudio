# 3. La fenêtre, expliquée

[← Premiers pas](02-premiers-pas.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Les projets →](04-projets.md)

La fenêtre du studio ressemble à celle d’un logiciel de développement ou de montage, pas à une
page web. Ce chapitre en démonte chaque morceau.

---

## Le plan d’ensemble

```
┌──────────────────────────────────────────────────────────────┐
│  BARRE DE TITRE — les six espaces de travail                 │
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

1. la **barre de titre**, tout en haut, qui porte les espaces de travail ;
2. les **rails**, collés aux bords gauche et droit : des bandes d’icônes ;
3. les **zones**, où vivent les panneaux ;
4. la **zone des documents**, au centre : c’est là que se trouve ce que vous fabriquez ;
5. la **ligne d’état**, tout en bas.

**Les couleurs ont un sens.** Le fond général — le *châssis* — est gris moyen. Les panneaux
posés dessus sont **plus sombres**, avec des coins arrondis. C’est l’inverse de l’habitude du
web, et c’est voulu : cela donne la lecture « des panneaux posés sur une table », comme dans un
logiciel de montage.

---

## La barre de titre

Elle ne porte pas le nom du fichier. Elle porte les **six espaces de travail** :

**Image** · **Vidéo** · **3D** · **Audio** · **Textures** · **Skyboxes**

Un clic change d’espace. L’espace actif est celui dont le bouton est plus clair que les autres.

Changer d’espace fait trois choses d’un coup :

- **les panneaux se réarrangent** — chaque espace montre les outils dont il a besoin et cache
  les autres ;
- **les onglets changent** — chaque espace a ses propres documents ouverts ;
- **le catalogue se filtre** — le panneau Modèles ne montre plus que les modèles capables de
  fabriquer ce type de contenu.

Sur macOS, les trois pastilles rouge / orange / verte restent à leur place habituelle, à gauche.

### Le sélecteur de compte

À droite de la barre de titre : un petit point de couleur, un nom, et un chevron.

| Ce que vous voyez | Ce que ça dit |
|---|---|
| Point **vert** | la clé du compte affiché fonctionne |
| Point **gris** | elle ne fonctionne pas, ou il n’y a pas de compte |
| **Le nom** | le compte en cours d’utilisation |
| **« Non connecté »** | aucun compte n’est enregistré |

**Un clic ouvre la liste** de vos comptes, celui en cours étant coché, plus une entrée
**Gérer les comptes…** qui mène aux réglages.

S’il n’y a **aucun compte enregistré**, le bouton n’ouvre pas de menu : il va directement aux
réglages. Un menu d’une seule ligne n’est pas un menu.

> **Changer de compte change la bibliothèque, pas votre travail.** Chaque clé API porte son propre
> projet Scenario — ses modèles, ses assets, son crédit. Votre projet local, lui, est sur votre
> disque et n’appartient à aucun compte : il ne bouge pas d’un pixel.

C’est un **sélecteur**, jamais un formulaire : les clés se tapent dans les réglages, et nulle part
ailleurs.

---

## Les rails

Les deux bandes verticales d’icônes, collées aux bords gauche et droit.

**Un rail ne disparaît jamais.** C’est leur intérêt : même quand vous avez tout fermé, chaque
panneau reste à un clic.

### Comment ils se lisent

Un clic sur une icône **ouvre** le panneau. Un second clic sur la même icône le **referme**.

Un **trait de séparation** en travers du rail indique la coupure d’une zone : les icônes
au-dessus du trait ouvrent dans la première moitié de la zone, celles en dessous dans la
seconde. Le rail est donc la légende de la colonne qu’il commande.

### Le rail de gauche

De haut en bas :

| Élément | Ce qu’il fait |
|---|---|
| **+** (bouton bleu) | crée un **nouveau document** dans l’espace actif |
| *séparateur* | |
| Les icônes de la **colonne de gauche** | Modèles, puis Génération — les mêmes dans les six espaces |
| Tout en bas : les icônes de la **bande basse** | Assets ou Timeline, selon l’espace |

Le bouton **+** est plein et bleu, quand tous les autres sont des glyphes gris. C’est parce
qu’il **agit** — il crée quelque chose — alors que les autres ne font que montrer ou cacher.

> Le bouton **+** est grisé quand aucun projet n’est ouvert : un document est un fichier dans un
> dossier de projet, et sans projet il n’y a nulle part où l’écrire.

### Le rail de droite

Les icônes de la **colonne de droite** : Skybox, Calques, Canaux, Assets, Explorateur, Scène,
Lumières, Mailles — celles que l’espace déclare, dans cet ordre — puis, sous le trait, Inspecteur.

### Le rail ne montre que ce que l’espace sait faire

Une icône n’apparaît que si l’espace où vous êtes a réellement ce panneau. Les Calques n’ont aucun
sens dans l’espace Audio : leur icône n’y est pas.

**Un cas particulier : la Génération.** Son icône disparaît tant qu’aucun modèle n’est choisi.
Ce n’est pas un bouton grisé, c’est une absence — générer sans modèle est impossible, et le rail
préfère montrer ce que l’espace **peut** faire plutôt que ce qu’il ne peut pas.

Dès que vous choisissez un modèle dans le panneau **Modèles**, l’icône apparaît. Elle reste si vous
avez fixé un modèle par défaut pour cette famille dans les réglages.

---

## Les zones et les panneaux

Il y a quatre zones : **gauche**, **droite**, **haute**, **basse**.

Chaque zone est **coupée en deux moitiés**, et chaque moitié montre **un panneau à la fois**.

Cela veut dire deux choses :

- deux panneaux de la **même moitié** se relaient : ouvrir le second referme le premier ;
- deux panneaux de moitiés **différentes** de la même zone s’affichent **ensemble** — l’un
  au-dessus de l’autre dans une colonne, l’un à côté de l’autre dans une bande.

> **La zone haute n’accueille aucun panneau pour l’instant.** Elle existe dans la structure et
> reste réservée. Rien n’y apparaîtra tant qu’un panneau n’y sera pas déclaré.

### Redimensionner

**Tirez sur l’espace entre deux panneaux.** Cet espace — la *gouttière* — est lui-même la
poignée : il n’y a pas de petite prise à viser au pixel près.

Le studio garde toujours **au moins 240 pixels** pour la zone des documents au centre, et au
moins 140 pixels pour chaque zone latérale. Vous ne pouvez donc pas écraser le centre par
accident en tirant trop loin.

Tailles de départ : colonne de gauche 320 px, colonne de droite 260 px, bande basse 240 px. La
gauche est la plus large des deux : elle porte le formulaire du modèle, et un formulaire à
260 px replie ses champs les uns sous les autres.

### Fermer, rouvrir, tout remettre en place

Un panneau **se ferme**, il ne se replie pas. Un panneau replié serait un troisième état qui ne
ressemble ni à ouvert ni à fermé — et le rail le rouvre déjà en un clic.

Trois façons de retrouver ce que vous avez fermé :

| Moyen | Effet |
|---|---|
| Cliquer son icône dans le rail | rouvre ce panneau-là |
| **Affichage ▸ Modules** | même chose, depuis le menu |
| **Affichage ▸ Réinitialiser la disposition** | remet **tous** les panneaux à leur place d’origine |

> **Réinitialiser la disposition ne touche pas votre travail.** Cela ne déplace que des
> panneaux.

### Quand un panneau devient étroit

Rétrécissez un panneau et sa ligne de titre cède du terrain progressivement : ses propres
contrôles — un filtre, un bouton de vue — partent les premiers. **Le bouton de fermeture, lui,
ne part jamais.** Un panneau dont on ne pourrait plus sortir serait pire qu’un panneau privé de
son filtre.

**Une exception : le nom du panneau ne se sacrifie pas en premier.** Dans une bande, l’étagère
loge toute sa barre sur la ligne de titre ; si la place manquait, c’est le nom qui serait rogné
jusqu’à disparaître. Le nom d’un panneau n’est pas ce qu’une ligne encombrée doit dépenser en
premier, donc il garde sa taille et c’est la barre qui se resserre.

---

## La liste complète des panneaux

| Panneau | Zone | Moitié | Visible dans | Ce que c’est |
|---|---|---|---|---|
| **Modèles** | gauche | 1re | partout | le catalogue Scenario, filtré sur l’espace actif |
| **Génération** | gauche | 1re | partout *(si un modèle est choisi)* | le formulaire du modèle choisi |
| **Skybox** | droite | 1re | Skyboxes | les réglages du ciel ouvert |
| **Calques** | droite | 1re | Image | la pile de calques de l’image ouverte |
| **Assets** | droite | 1re | Vidéo, Audio | l’étagère du projet, en colonne |
| **Explorateur** | droite | 1re | partout | les documents du projet, ouverts ou non |
| **Scène** | droite | 1re | 3D | l’arbre de la scène ouverte |
| **Lumières** | droite | 1re | 3D | les sources lumineuses de la scène |
| **Mailles** | droite | 1re | 3D | les objets de la scène, et le bouton qui en ajoute |
| **Inspecteur** | droite | 2de | partout | ce qui est sélectionné, réglable en direct |
| **Assets** | bas | 1re | Image, 3D, Textures, Skyboxes | la même étagère, en bande |
| **Timeline** | bas | 1re | Vidéo, Audio | la séquence en cours de montage |

**La colonne de gauche est la génération, et rien d’autre.** Deux panneaux seulement y ont le
droit — **Modèles** et **Génération** — et aucun des deux ne s’affiche ailleurs. Générer est la
seule chose que les six espaces font tous : elle a donc la même place dans les six, juste sous le
bouton **+** qui crée un document. Ce sont deux moments du même travail, choisir puis remplir,
donc ils se relaient dans la même moitié.

**La colonne de droite est celle du document ouvert** : ce qu’il contient, ce qui l’éclaire, ce
qui est sélectionné. Les panneaux y prennent leur tour dans la moitié haute — un espace ne
déclare jamais les six à la fois — et l’**Inspecteur** occupe l’autre moitié, toujours en bas.
On lit ce qui est sélectionné **pendant** qu’on choisit un modèle et qu’on écrit un prompt :
dans un éditeur, l’inspecteur n’est jamais le panneau qu’il faut quitter pour voir autre chose.

**Pourquoi l’étagère à assets change de place.** Dans la plupart des espaces, elle est en bas :
c’est une étagère, elle se lit en largeur, et la colonne latérale est réservée à ce qui agit sur le
document. Mais en **Vidéo** et en **Audio**, la bande basse appartient au montage, qui a besoin de
toute la largeur. L’étagère passe alors dans la **colonne de droite**, pour que le montage et elle
tiennent l’écran **ensemble** : glisser une prise sur une piste est le geste autour duquel ces
deux espaces sont bâtis.

### Une moitié montre ce que l’espace y met

Vous ouvrez la bande basse dans l’espace Image : c’est l’étagère. Vous passez en Vidéo : la même
bande devient le montage, sans que vous ayez rien à rouvrir.

**Ce que vous avez ouvert, c’est une zone** — et elle le reste. Une moitié qui contient un panneau
que cet espace range ailleurs, ou n’a pas du tout, affiche ce que l’espace y met à la place.
Fermer la moitié la vide partout : c’est la seule chose que le clic disait vraiment.

Deux conséquences pratiques :

- **rien n’est réécrit** : revenez dans l’espace d’origine, vous retrouvez ce que vous y aviez ;
- **une Génération sans modèle laisse la place aux Modèles** — le panneau qui permet justement d’en
  choisir un.

### Une moitié que vous n’avez pas choisie s’ouvre sur le premier panneau de l’espace

Tant que vous n’avez cliqué aucune icône d’une moitié, elle n’est attachée à **aucun** panneau :
elle affiche le premier que l’espace y déclare — celui du haut dans le tableau ci-dessus, et donc
le premier du rail.

C’est ce que vous voyez à la première ouverture, et ce que **Affichage ▸ Réinitialiser la
disposition** rétablit :

| Espace | La moitié haute de droite s’ouvre sur | La bande basse sur |
|---|---|---|
| **Image** | Calques | Assets |
| **Vidéo** | Assets | Timeline |
| **3D** | Explorateur | Assets |
| **Audio** | Assets | Timeline |
| **Textures** | Explorateur | Assets |
| **Skyboxes** | Skybox | Assets |

**Pourquoi ce n’est pas un panneau fixé une fois pour toutes.** Votre disposition est retenue une
seule fois pour les six espaces, alors que le panneau qui vient en premier diffère dans chacun.
En inscrire un dans la disposition par défaut reviendrait à imposer la réponse d’un espace aux
cinq autres.

Dès que vous cliquez une icône, cette moitié retient **votre** choix, et ne bouge plus jusqu’à ce
que vous en cliquiez une autre — ou que vous réinitialisiez la disposition.

**Pourquoi l’Explorateur est visible partout.** Il liste les documents du dossier de projet,
ouverts ou non, et c’est la même question dans les six espaces : un double-clic sur une ligne
ouvre le document, en changeant d’espace s’il appartient à un autre. Il a longtemps montré
l’arbre de la scène 3D — celui-ci a désormais son propre panneau, **Scène**.

---

## La zone des documents

Le centre. C’est là que se trouve ce que vous fabriquez.

**Elle ne prend que des documents.** Un fichier ouvert et sa barre d’outils, rien d’autre. Aucun
panneau ne peut y entrer.

### Les onglets

Chaque document ouvert a son onglet, en haut du centre. Un clic passe de l’un à l’autre.

Ils peuvent être **déplacés**, **réorganisés**, et **posés côte à côte** : faites glisser un
onglet vers un bord du centre, une zone de dépôt s’affiche, lâchez — vous obtenez deux documents
visibles en même temps.

### Le point à côté du nom

Un onglet dont le travail n’est pas encore écrit sur le disque porte **un point** (`•`) à côté
de son nom.

Le point disparaît à l’enregistrement (`⌘S` / `Ctrl+S`), et revient à la modification suivante.
Si vous annulez jusqu’au point exact où vous aviez enregistré, il disparaît aussi : ce que vous
voyez est alors bien ce que contient le fichier.

> **Les six types de documents savent s’enregistrer** — images, scènes 3D, textures, séquences,
> sons édités et ciels. Ce qui ne revient pas d’un enregistrement à l’autre, c’est l’historique
> d’annulation. Voir [Ce qui n’existe pas encore](18-limites.md).

### Fermer un onglet

La croix de l’onglet ferme le document. **S’il porte le point**, le studio demande d’abord quoi
faire de ce qui n’est pas écrit :

- **Enregistrer** écrit le document puis ferme — c’est ce que `⏎` choisit ;
- **Ne pas enregistrer** ferme et perd le travail fait depuis le dernier `⌘S` ;
- **Annuler** ne ferme rien — et c’est aussi ce que répond `⎋`, pour qu’une touche frappée sans
  lire ne puisse jamais jeter du travail.

Si l’écriture échoue, l’onglet reste ouvert et la raison part dans le journal d’activité : fermer
quand même perdrait exactement ce que la question venait de promettre de garder.

### Le menu d’un onglet

Un **clic droit** sur un onglet ouvre trois gestes :

| Ligne | Ce qu’elle fait |
|---|---|
| **Fermer l’onglet** | comme la croix, question comprise |
| **Fermer les autres onglets** | ferme un par un ; un *Annuler* arrête la série |
| **Supprimer le document…** | **retire le fichier du dossier du projet** |

**Supprimer est irréversible**, et c’est le seul geste du studio qui efface un fichier que vous
avez fait. Le studio demande confirmation, et cette fois-ci c’est *Annuler* qui est le bouton par
défaut. Un document supprimé ne propose pas d’être enregistré au passage : l’écrire et l’effacer
dans le même geste n’aurait aucun sens.

### Chaque espace a ses propres onglets

Passer de « Image » à « 3D » ne ferme rien : cela range les onglets d’Image et sort ceux de 3D.
Revenez à Image, vous retrouvez exactement ce que vous y aviez laissé.

---

## La ligne d’état

La bande fine, tout en bas.

À gauche, elle indique **où vous êtes** :

| Ce qui s’affiche | Situation |
|---|---|
| *Aucun projet ouvert* | rien n’est ouvert |
| `Mon projet` | un projet est ouvert, aucun document en avant |
| `Mon projet — Falaise` | un projet est ouvert, et le document « Falaise » est en avant |

### Les générations, à droite de la ligne d’état

C’est ici que vivent vos demandes en cours. **Il n’y a pas de panneau Tâches** : une génération est
plusieurs minutes d’attente que vous passez ailleurs, elle doit donc se lire depuis n’importe quel
espace — et un panneau ne peut être qu’à un endroit.

Ce que vous voyez, quand quelque chose travaille :

```
3 générations  ▓▓▓▓▓░░░░░  45 %  ⌃
```

| Élément | Ce qu’il dit |
|---|---|
| **« 3 générations »** | combien travaillent en ce moment |
| **La barre** | leur avancement moyen |
| **Le pourcentage** | le même chiffre, en clair |
| **Le chevron** | un clic ouvre la liste complète |

**Quand plus rien ne travaille, la zone disparaît.** Elle ne coûte aucune place au repos.

**Sauf s’il y a eu un échec** : « 2 échecs » reste affiché après la fin des tâches. Un échec qui
s’effacerait avec la dernière génération en cours est un échec que personne n’aurait lu.

**Le clic ouvre la liste**, dans une petite fenêtre au-dessus de la ligne d’état : une ligne par
tâche, son modèle, son état, sa barre, et le bouton qui l’annule. Sous la barre, ce que la
génération a coûté — ou, si elle a échoué, pourquoi. C’est le contenu de l’ancien panneau, à un
clic au lieu d’une place permanente.

### Le journal, à côté

Une seconde icône, sur la même ligne : c’est le **journal d’activité**. Il retient ce que le
studio a fait et ce qu’il a raté — une génération, un import, un envoi vers la bibliothèque, un
enregistrement de document.

**Il est toujours là**, contrairement aux générations qui s’effacent au repos. Un studio qui ne
montre rien tant que rien n’a cassé laisse l’utilisateur sans endroit où regarder **avant** que
ça casse.

| Ce que vous voyez | Situation |
|---|---|
| une petite horloge grise | tout va bien, le journal est consultable |
| une alerte et « 2 échecs » en rouge | deux choses ont échoué et n’ont pas encore été lues |

**Un clic ouvre la liste et marque tout comme lu** — l’ouvrir, c’est le lire. Deux filtres y
attendent : le **niveau** (information, avertissement, échec) et le **sujet** (génération,
import, bibliothèque, document). Un bouton **Tout afficher** les relâche.

### Les bulles qui ne s’effacent pas

Un échec fait apparaître une **bulle** dans le coin bas-droit, au-dessus de la ligne d’état.

Deux décisions y sont visibles, et toutes deux à contre-courant de l’habitude :

- **Seuls les échecs en font une.** Un asset importé avec succès a sa ligne dans le journal, pas
  de bulle : une bulle par événement heureux apprendrait à détourner le regard du coin où
  s’affichent les problèmes.
- **Elles ne disparaissent pas toutes seules.** Pas de fondu au bout de quatre secondes — une
  bulle évanouie est une bulle que quelqu’un qui regardait sa toile n’a jamais vue. Elle part
  quand vous la fermez, et c’est cette fermeture qui la marque lue.

---

## Le menu natif

Le menu du système — en haut de l’écran sur macOS, en haut de la fenêtre ailleurs.

| Menu | Ce qu’on y trouve |
|---|---|
| **Fichier** | Nouveau projet…, Ouvrir un projet…, Enregistrer, Réglages… |
| **Édition** | Annuler, Rétablir, et les commandes de texte du système |
| **Affichage** | Modules (rouvrir un panneau), Réinitialiser la disposition, Plein écran, et le zoom de l’image |
| **Objets** | Ajouter ▸ Maille, Ajouter ▸ Lumière — dans l’espace 3D |
| **Fenêtre** | les commandes de fenêtre du système |
| **Aide** | À propos de Scenario Studio, Consommation…, Licences |

### La fenêtre de consommation

**Aide ▸ Consommation…** ouvre une fenêtre à part, qui dit **ce que vos clés ont dépensé**.

En haut à droite, la période : **7, 31 ou 120 jours**, sur 31 par défaut. Quatre sections dans la
colonne de gauche :

| Section | Ce qu’elle montre |
|---|---|
| **Vue d’ensemble** | le total consommé sur la période, les remises, le nombre de générations, la dépense par jour et par compte |
| **Modèles** | quels modèles ont coûté, combien de générations chacun a servi, et la part passée par une clé API |
| **Activités** | ce qui a été fait, et les assets qui en sont sortis |
| **Journal** | chaque événement facturé, du plus récent au plus ancien, par pages |

Trois avertissements y sont affichés, et aucun n’est décoratif :

- **il n’y a pas de solde.** L’API Scenario n’expose que ce qui a été dépensé, jamais ce qui
  reste. Aucun chiffre de cette fenêtre ne vous dira combien vous pouvez encore générer ;
- **le montant en euros est indicatif.** Il est calculé sur la grille publique des packs
  prépayés, qui est par paliers et ne dit rien du tarif d’un abonnement. C’est un ordre de
  grandeur, pas une facture ;
- **le total mélange des comptes facturés séparément.** Si vous avez plusieurs clés, la somme
  affichée ne correspond à aucune facture réelle — la section Vue d’ensemble détaille par compte.

**Une clé qui ne répond pas ne fausse pas les chiffres en silence** : la fenêtre nomme les clés
restées muettes et précise que les totaux sont ceux des autres.

Sans aucune clé enregistrée, la fenêtre le dit et renvoie aux préférences.

### La fenêtre des licences

**Aide ▸ Licences** ouvre la liste des logiciels que Scenario Studio embarque : leur nom, leur
version, et le nom court de leur licence (`MIT`, `Apache-2.0`…).

Cliquez sur une ligne : le **texte entier** de la licence se déplie, et le lien vers ses sources
s’affiche quand la licence l’exige.

> **Le texte est dans l’application, pas derrière un lien.** Une notice qu’il faut être connecté
> pour lire n’est pas une notice — et plusieurs de ces licences exigent d’être reproduites en
> entier, pas résumées.

Rien à y faire, rien à y régler. C’est une obligation légale, tenue proprement.

**Cette fenêtre parle des autres, pas du studio.** Trois textes, trois portées, et il vaut mieux
ne pas les confondre :

| Ce dont on parle | Sous quelles conditions | Où le lire |
|---|---|---|
| **Le code source** du studio | PolyForm Noncommercial 1.0.0 — lisible, modifiable, réutilisable pour tout usage **non commercial** | `LICENSE`, dans le dépôt |
| **L’application** que vous avez installée | ses propres conditions d’utilisation | `EULA.md`, dans le dépôt |
| **Les composants tiers** que l’un et l’autre embarquent | chacun garde la sienne | cette fenêtre, et `THIRD-PARTY-NOTICES.md` |

**Le cas de ffmpeg est à part**, et sa ligne le dit : il n’est pas lié dans l’application, il est
lancé **à côté**, comme un programme séparé. Sa licence n’est donc pas la même selon la
plateforme — GPL sur macOS, LGPL ailleurs — et **ses sources correspondantes sont attachées à
chaque version publiée**, à côté des installeurs.

Les raccourcis affichés dans les menus sont **ceux que vous avez réglés**. Si vous changez un
raccourci dans les réglages, le menu suit.

**Affichage ▸ Modules ne liste que ce que l’espace peut ouvrir.** Comme le rail : pas de Calques
dans l’espace Audio, et pas de Génération tant qu’aucun modèle n’est choisi. Un menu qui proposerait
d’ouvrir un panneau qui n’apparaîtrait pas serait pire qu’un menu court.

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

[← Premiers pas](02-premiers-pas.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Les projets →](04-projets.md)
