# 3. La fenêtre, expliquée

[← Premiers pas](02-premiers-pas.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Les projets →](04-projets.md)

La fenêtre du studio ressemble à celle d’un logiciel de développement ou de montage, pas à une
page web. Ce chapitre en démonte chaque morceau.

---

## L’accueil, avant tout le reste

**Le studio ne s’ouvre pas sur une fenêtre vide.** Il s’ouvre sur un écran pleine largeur —
l’accueil — qui dit où vous en étiez, ce que vous avez produit, et ce que vous pouvez faire.

Il se ferme dès que vous entrez dans un espace de travail, et il n’a ni rail, ni panneau, ni
onglet : c’est une page, pas une disposition. La ligne d’état reste en bas, parce qu’une
génération lancée hier peut très bien finir pendant que vous le lisez.

### La bannière, en haut

Elle ne dit qu’une chose à la fois, celle qui compte à cet instant.

| Ce qu’elle affiche | Quand |
|---|---|
| **Reprendre où vous en étiez** | un document était ouvert la dernière fois |
| **_n_ générations en cours** | quelque chose tourne encore |
| **Connecter une clé API** | aucune clé n’est enregistrée |
| **Démarrer un projet** | aucun projet n’est ouvert |
| **Tout est prêt** | le projet est ouvert et ne contient encore rien |

**Elle attend de savoir avant de conclure.** Lire les projets et les documents prend un instant ;
la bannière ne s’affiche qu’une fois la réponse arrivée, plutôt que d’annoncer « démarrez un
projet » puis de se corriger.

### Les bandes

Sous la bannière, une bande par sujet, dans cet ordre :

| Bande | Ce qu’elle montre | Il faut |
|---|---|---|
| **Outils** | les sept espaces, et les gestes de projet | rien |
| **Vos projets** | les projets récents | rien |
| **Ce que vous avez produit** | vos générations, légendées du modèle qui les a faites | un projet ouvert |
| **Par type** | six compteurs — Image, Vidéo, Audio, Maillage, Texture, Skybox | un projet ouvert |
| **Vos recettes** | les réglages que vous avez épinglés | rien |
| **Votre bibliothèque** | ce qui vit en ligne, sur votre compte Scenario | une clé API |
| **Vos documents** | les documents du projet | un projet ouvert |
| **En cours** | les générations en route | une clé API |
| **Activité récente** | ce que le studio a fait et raté | un projet ouvert |
| **Dans la même veine** | des créations publiques qui ressemblent à votre dernier asset | une clé API |
| **Une idée pour commencer** | des départs de prompt écrits pour votre modèle d’image | une clé API |
| **Ce que vous avez consommé** | vos unités dépensées, en tout et par modèle | une clé API |
| **Explorer** | ce que tout le monde a publié, par type | une clé API |

**Une bande qui n’a pas ce qu’il lui faut n’est pas grisée : elle n’est pas là.** Sans clé API,
la bibliothèque n’existe pas sur cet écran.

### Les quatre bandes qui regardent au-delà de votre projet

**Explorer** est la seule qui ne parle pas de votre compte : c’est le fil de ce que **tout le
monde** a publié, une catégorie à la fois — les six types du studio, en onglets. Pas d’onglet
« tout » : une grille qui mêle des sons et des images est une grille de rectangles gris, et
l’API ne sait de toute façon pas les ordonner les uns contre les autres.

- **elle se charge en descendant** : le fil pagine tant que vous scrollez, il n’a pas de fin ;
- **elle reste en bas de page, et ne se déplace pas.** Ranger les bandes est une préférence ;
  enterrer une section sous un fil sans fin n’en est pas une, et le menu ne peut pas l’exprimer ;
- **les tuiles ne font rien.** Elles appartiennent à quelqu’un d’autre, et le studio n’a aucun
  moyen d’en rapatrier une — un bouton qui peut refuser vaut moins que pas de bouton.

**Dans la même veine** part de votre **dernier asset** — pas d’un choix, il n’y a rien à
sélectionner — et cherche des créations publiques qui lui ressemblent. La référence elle-même est
retirée des résultats, où elle arriverait en tête.

**Si la bibliothèque ne répond pas, cette bande ne s’efface pas** : elle le dit, et propose
**Réessayer**. C’est la seule du lot à faire la différence entre un refus et un compte qui n’a
rien de ressemblant — les deux arrivaient jusqu’ici comme une étagère vide, et seul le premier
vaut qu’on repropose d’essayer.

**Une idée pour commencer** est la seule bande qui n’appelle rien tant que vous ne le demandez
pas : elle a un bouton **Proposez-moi une idée**. C’est délibéré — un accueil qui déclencherait un
aller-retour à chaque lancement dépenserait la limite de débit du compte pour une bande que
personne n’a regardée. **C’est gratuit** : aucune unité créative n’est consommée. Prendre une idée
ouvre le générateur sur le prompt **et** sur les réglages qui vont avec. Sans modèle d’image
choisi, la bande ne s’affiche pas : la proposition est écrite pour un modèle, et sans lui elle
proposerait dans le vide.

**Ce que vous avez consommé** reprend la période de la fenêtre de consommation, pour que les deux
ne se contredisent jamais. C’est un résumé, pas la fenêtre : le détail est dans
**Aide ▸ Consommation…**.

**Vos recettes ne demandent rien**, et c’est voulu : une recette est gardée en dehors des
projets, elle vous suit d’un projet à l’autre. C’est la seule bande qui ait encore quelque chose
à montrer quand aucun dossier n’est ouvert.

### Cliquer une vignette l’ouvre

**C’est la règle de toute la page, et il n’y a qu’elle à retenir.** Un clic sur une image
l’ouvre dans son espace. Ce qui n’est pas « ouvrir » est une action **secondaire**, révélée au
survol dans le coin de la vignette, et chaque bouton dit son verbe.

**Refaire une image ne coûte aucun appel réseau.** Dans le coin de chaque création, « En refaire
une avec… » rouvre le formulaire déjà rempli : le modèle, le prompt et les réglages sont gardés
à côté de l’asset, dans le projet.

**Une exception, et une seule : un asset de la bibliothèque que vous n’avez pas encore
rapatrié.** Il n’est pas sur votre disque, donc il n’y a rien à ouvrir — le clic le **récupère**,
et le bouton le dit. Une fois descendu, la vignette rejoint la règle commune et s’ouvre. Rien
n’est jamais téléchargé sans que vous l’ayez demandé.

**C’est là, et nulle part ailleurs, qu’on rapatrie.** L’étagère, elle, sait envoyer et pas
reprendre : chaque sens a sa porte, et ce n’est pas la même — voir [Les assets](07-assets.md).
Sans projet ouvert, ou pendant qu’un transfert tourne, la vignette reste une image et ne répond
pas : il n’y aurait nulle part où écrire.

**Un compteur mène à ses assets.** Cliquer celui des images ouvre l’espace Image et pose le
filtre : vous arrivez sur les images, pas sur l’étagère entière. Un type à zéro reste sur la
rangée mais ne répond pas — il n’y a nulle part où aller. Si le projet est vide de bout en bout,
la bande ne s’affiche pas.

### Ranger la page

Chaque bande a son menu — **Personnaliser cette section**.

| Entrée | Effet |
|---|---|
| **Monter** / **Descendre** | change l’ordre, qui est retenu |
| **Masquer cette section** | la retire de la page |
| **Afficher _n_ éléments** | de 3 à 48 |

Les sections masquées sont comptées en bas de page — « 2 sections masquées » — avec un bouton
**Les réafficher**. Rien ne disparaît sans laisser de trace.

**Trois bandes ne se masquent pas** : la bannière, les Outils et Vos projets. C’est ce qui
garantit que l’accueil n’est jamais une page blanche, quoi qu’on décoche.

### La colonne de gauche

Un rail étroit portant l’**Explorateur** : le dossier du projet, en arborescence. Il est là
pour ce qu’on garde à l’œil pendant qu’on lit la page, au lieu de le lire à son tour.

> **L’accueil peut être coupé.** **Préférences ▸ Général ▸ Afficher l’accueil** : décoché, le
> studio va droit à l’espace que vous aviez quitté. L’ordre des bandes et celles que vous avez
> masquées se règlent sur l’accueil lui-même, pas dans les préférences.

---

## Le plan d’ensemble

```
┌──────────────────────────────────────────────────────────────┐
│  BARRE DE TITRE — les sept espaces de travail                │
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

Elle ne porte pas le nom du fichier. Elle porte les **sept espaces de travail** :

**Image** · **Vidéo** · **3D** · **Audio** · **Textures** · **Skyboxes** · **Graphe**

> **Le Graphe est en construction.** Il s’ouvre, on y pose des nœuds, on les relie, on les
> enregistre, et **sélectionner un nœud l’ouvre dans l’Inspecteur** — son identifiant, son genre,
> et un titre qui se tape. Un nœud de texte y montre son prompt, une note son texte. Un **nœud de
> modèle** va plus loin : le modèle **se choisit** dans une liste, et le formulaire du modèle
> choisi s’ouvre dessous, exactement celui du panneau Génération. Ce qu’on y tape passe par le
> même ⌘Z que le nœud qu’on déplace.
>
> **Changer le modèle d’un nœud refait ses ports**, et les liens dont le port a disparu s’en vont
> avec eux — en un seul geste, donc annulable d’un seul `⌘Z`.
>
> **Il s’exécute.** Le premier bouton de sa barre lance le graphe : chaque nœud part quand ce
> qu’il lit est prêt, les branches indépendantes partent ensemble, et les générations passent par
> la même file que le reste du studio — elles s’affichent dans la barre des tâches et se comptent
> dans le même budget. Le bouton devient **Arrêter** pendant ce temps : plus rien n’est soumis, et
> ce qui est en vol est annulé.
>
> **Chaque nœud dit où il en est**, dans le coin de son en-tête : *en cours*, *terminé*,
> *inchangé* — c’est-à-dire réutilisé tel quel parce que rien de ce dont il dépend n’a bougé —,
> ou la raison pour laquelle il n’a rien produit : *boucle*, *sans modèle*, *non exécutable*,
> *échec*, *expression invalide*, et **amont en échec** — celui-là ne veut pas dire « ça arrive »,
> mais « ça n’arrivera
> pas » : ce dont il dépend a échoué, donc il ne partira jamais de cette exécution. Relancer après
> avoir changé le prompt du dernier nœud ne relance **que** lui.
>
> **Un nœud d’approbation arrête l’exécution pour demander votre avis.** On le pose comme les
> autres, on le relie au nœud dont il doit faire valider le résultat, et l’Inspecteur donne la
> **question posée** — laissée vide, le nœud demande simplement « Approuver ce résultat ? ».
> À l’exécution, le nœud qu’il garde produit d’abord, puis le graphe s’arrête : le nœud affiche
> *à approuver* et ses deux boutons, **Approuver** et **Rejeter**. Approuver laisse repartir tout
> ce qui lit le nœud gardé ; rejeter les arrête — le nœud dit *rejeté*, et ceux qui le lisent
> disent *amont en échec*. **La question est reposée à chaque exécution**, même quand rien n’a
> changé et que tout le reste est réutilisé : une approbation est un geste, pas un résultat
> qu’on garde. Arrêter l’exécution pendant qu’une question est posée n’est pas un refus : le
> nœud redevient simplement inactif.
>
> **Un nœud de transformation réécrit du texte.** On le pose comme les autres, on relie à son
> entrée le nœud dont il doit reprendre le résultat, et l’Inspecteur donne son **expression** —
> une expression CEL, le petit langage que Scenario emploie dans ses propres workflows. Ce que
> les fils apportent s’y lit sous le nom que Scenario donne au fil : `<identifiant du nœud>_` suivi
> du nom de sa sortie, `output` la plupart du temps. Écrire `'photo de ' + text1_output` fabrique
> donc un prompt à partir de ce qu’un nœud Texte porte. **C’est l’évaluateur de Scenario qui
> calcule**, le même que sur son site : ce qui marche ici marche à l’identique une fois l’App
> publiée. Une expression laissée vide ne produit rien et n’écrase donc pas ce que le formulaire
> du nœud suivant contient déjà ; une expression fautive — parenthèse manquante, variable qu’aucun
> fil n’apporte, résultat qui n’est pas du texte — fait dire au nœud *expression invalide*, et
> ceux qui le lisent disent *amont en échec*.
>
> Ce qu’il ne sait **pas encore** : les nœuds de logique et de boucle, et l’import/export d’un
> workflow Scenario. Son chapitre viendra quand il les saura.

Un clic change d’espace. L’espace actif est celui dont le bouton est plus clair que les autres.

Changer d’espace fait trois choses d’un coup :

- **les panneaux se réarrangent** — chaque espace montre les outils dont il a besoin et cache
  les autres ;
- **les onglets changent** — chaque espace a ses propres documents ouverts ;
- **le catalogue se filtre** — le panneau Modèles ne montre plus que les modèles capables de
  fabriquer ce type de contenu.

Sur macOS, les trois pastilles rouge / orange / verte restent à leur place habituelle, à gauche.

### Ranger les espaces dans l’ordre qui vous arrange

L’ordre de la barre n’est pas imposé. Trois façons de le changer, au choix :

| Geste | Comment |
|---|---|
| **Glisser** | attrapez un espace et lâchez-le sur un autre |
| **Clavier** | `⌥←` / `⌥→` sur l’espace focalisé — les flèches nues, elles, servent à parcourir la barre |
| **Clic droit** | **Déplacer à gauche** / **Déplacer à droite** |

Les deux touches **se remappent comme les autres**, sous le contexte *Dans la barre des espaces*
de l’[écran des raccourcis](15-raccourcis.md).

**L’Accueil ne bouge pas** : il n’est pas un espace parmi les autres, il les couvre tous, et il
reste en tête.

**L’ordre suit partout.** La bande **Outils** de l’accueil montre les mêmes espaces : réordonner
l’un sans l’autre laisserait deux vérités sur le même écran. Il est retenu d’une session à
l’autre, avec vos réglages.

> **Un espace ajouté par une mise à jour n’atterrit pas au bout de votre barre.** Il se pose là où
> le studio le range d’origine — après le dernier de ses voisins que vous avez gardés. Un ordre
> enregistré est la photo des espaces d’un jour donné : le Graphe a été le septième et ne sera pas
> le dernier.

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
| Les icônes de la **moitié haute** de la colonne de gauche | Modèles, puis Génération — les mêmes dans tous les espaces |
| *séparateur* | |
| Les icônes de la **moitié basse** | Explorateur, puis Apps — les mêmes partout, accueil compris pour l’Explorateur |
| Tout en bas : les icônes de la **bande basse** | Assets ou Timeline, selon l’espace |

**Un séparateur par coupure de la colonne, jamais un de plus.** Le rail est la légende de la
colonne : il la découpe comme elle est découpée, et une moitié vide ne l’atteint pas.

Le bouton **+** est plein et bleu, quand tous les autres sont des glyphes gris. C’est parce
qu’il **agit** — il crée quelque chose — alors que les autres ne font que montrer ou cacher.

> Le bouton **+** est grisé quand aucun projet n’est ouvert : un document est un fichier dans un
> dossier de projet, et sans projet il n’y a nulle part où l’écrire.

### Le rail de droite

Les icônes de la **colonne de droite** : Skybox, Vue, Calques, Canaux, Styles, Assets, Scène,
Lumières, Mailles — celles que l’espace déclare, dans cet ordre — puis, sous le trait,
Inspecteur.

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
| **Vue** | droite | 1re | Skyboxes | la projection, le champ de vision et les objets de test |
| **Calques** | droite | 1re | Image | la pile de calques de l’image ouverte |
| **Canaux** | droite | 1re | Textures | les huit canaux de la matière ouverte, et ce que chacun porte |
| **Styles** | droite | 1re | Textures | les réglages de matière enregistrés, à rejouer sur n’importe quelle matière |
| **Assets** | droite | 1re | Vidéo, Audio | l’étagère du projet, en colonne |
| **Explorateur** | gauche | 2de | partout, accueil compris | le dossier du projet, dossiers et fichiers |
| **Apps** | gauche | 2de | partout | les chaînes toutes faites de Scenario, à lancer telles quelles |
| **Scène** | droite | 1re | 3D | l’arbre de la scène ouverte |
| **Lumières** | droite | 1re | 3D | les sources lumineuses de la scène |
| **Mailles** | droite | 1re | 3D | les objets de la scène, et le bouton qui en ajoute |
| **Inspecteur** | droite | 2de | partout | ce qui est sélectionné, réglable en direct |
| **Assets** | bas | 1re | Image, 3D, Textures, Skyboxes, Graphe | la même étagère, en bande |
| **Timeline** | bas | 1re | Vidéo, Audio | la séquence en cours de montage |

> **« Partout » veut dire les espaces de travail, pas l’accueil**, sauf mention contraire. Un
> espace est un endroit qui ouvre des documents d’une sorte à lui ; l’accueil n’en ouvre aucun —
> il ouvre ceux des autres. Il n’a qu’une colonne de gauche, et il y met l’**Explorateur**, à la
> même place et sous la même icône que les espaces : en moitié basse. N’ayant pas de génération
> à mettre au-dessus, le panneau y occupe toute la colonne.

**La colonne de gauche est celle de ce qui produit**, et elle est coupée en deux.

**En haut, la génération, et rien d’autre.** Deux panneaux seulement y ont le droit —
**Modèles** et **Génération** — et aucun des deux ne s’affiche ailleurs. Générer est la seule
chose que tous les espaces font : elle a donc la même place dans chacun, juste sous le bouton
**+** qui crée un document. Ce sont deux moments du même travail, choisir puis remplir, donc ils
se relaient dans la même moitié.

**En bas, l’Explorateur et les Apps**, qui se relaient de la même façon. Une App produit des
assets : c’est de la génération, donc la colonne de gauche. Et une moitié plutôt que deux tours
de plus en haut, parce que quatre icônes empilées dans un rail, c’est le moment où une colonne
cesse d’être un endroit qu’on connaît pour devenir une pile qu’on fouille — tandis que deux
moitiés de deux gardent la génération visible **pendant** qu’on lit l’Explorateur.

**La colonne de droite est celle du document ouvert** : ce qu’il contient, ce qui l’éclaire, ce
qui est sélectionné. Les panneaux y prennent leur tour dans la moitié haute — un espace ne
déclare jamais tous à la fois — et l’**Inspecteur** occupe l’autre moitié, toujours en bas.
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

La moitié basse de gauche s’ouvre partout sur l’**Explorateur**, les Apps derrière lui.

| Espace | La moitié haute de droite s’ouvre sur | La bande basse sur |
|---|---|---|
| **Image** | Calques | Assets |
| **Vidéo** | Assets | Timeline |
| **3D** | Scène | Assets |
| **Audio** | Assets | Timeline |
| **Textures** | Canaux | Assets |
| **Skyboxes** | Skybox | Assets |
| **Graphe** | *rien — il n’y déclare aucun panneau* | Assets |

**Pourquoi ce n’est pas un panneau fixé une fois pour toutes.** Votre disposition est retenue une
seule fois pour tous les espaces, alors que le panneau qui vient en premier diffère dans chacun.
En inscrire un dans la disposition par défaut reviendrait à imposer la réponse d’un espace aux
six autres.

Dès que vous cliquez une icône, cette moitié retient **votre** choix, et ne bouge plus jusqu’à ce
que vous en cliquiez une autre — ou que vous réinitialisiez la disposition.

**Pourquoi l’Explorateur est visible partout.** Il montre le dossier du projet en arborescence, et
c’est la même question dans tous les espaces : un double-clic sur un document l’ouvre, en changeant
d’espace s’il appartient à un autre, et un double-clic sur autre chose le confie au système. Il a longtemps montré
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

> **Les sept types de documents savent s’enregistrer** — images, scènes 3D, textures, séquences,
> sons édités, ciels et graphes. Ce qui ne revient pas d’un enregistrement à l’autre, c’est l’historique
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
import, bibliothèque, document, projet). Un bouton **Tout afficher** les relâche.

**Pour refermer** : un clic à côté, `Échap`, ou le passage à une autre application — recliquer
l’icône marche aussi. C’est vrai des deux volets de la ligne d’état, et de tout ce qui flotte
au-dessus de la fenêtre.

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

**Activités et Journal nomment leurs lignes dans la langue de la fenêtre**, pas dans celle de
l’API : vous lisez « Génération d’images », pas `images-generation`. Si Scenario ajoute un type
d’événement que le studio ne connaît pas encore, sa ligne affiche le nom brut de l’API — c’est le
seul cas où l’anglais technique reparaît, et il vaut mieux qu’une ligne vide.

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

## Fermer la dernière fenêtre quitte le studio

Sur macOS, l’habitude veut qu’une application survive à ses fenêtres et qu’on en rouvre une
depuis le Dock. **Ce n’est pas ce que fait le studio** : fermer la dernière fenêtre le quitte,
sur les trois systèmes.

C’est assumé. Un éditeur de documents n’a plus rien à offrir une fois ses fenêtres fermées, et
la convention laissait tourner une application qu’aucun geste ne permettait de revoir.

> Vos documents ne partent pas avec elle : ce qui n’est pas enregistré est **demandé avant** que
> la fenêtre se ferme, comme partout ailleurs.

---

[← Premiers pas](02-premiers-pas.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Les projets →](04-projets.md)
