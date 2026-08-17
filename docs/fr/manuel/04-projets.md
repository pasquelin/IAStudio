# 4. Les projets

[← La fenêtre](03-la-fenetre.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Trouver un modèle →](05-modeles.md)

---

## Un projet est un dossier

Pas une base de données. Pas un espace en ligne. Pas un fichier unique qu’on ne peut ouvrir
qu’avec ce logiciel.

**Un dossier ordinaire, sur votre disque.** Vous pouvez l’ouvrir dans votre explorateur de
fichiers, regarder dedans, le copier sur une clé USB, le sauvegarder avec le reste de vos
documents, l’envoyer à quelqu’un. **Il porte le nom que vous lui avez donné, et rien d’autre** :
pas d’extension, pas de suffixe technique.

C’est une décision de conception, pas un hasard. Un projet qu’on ne peut ouvrir qu’avec le
logiciel qui l’a créé est un projet qu’on perd le jour où le logiciel ne s’ouvre plus.

---

## Créer, ouvrir, changer de projet

| Action | Raccourci | Menu |
|---|---|---|
| **Nouveau projet** | `⌘N` / `Ctrl+N` | Fichier ▸ Nouveau projet… |
| **Ouvrir un projet** | `⌘O` / `Ctrl+O` | Fichier ▸ Ouvrir un projet… |

**Les deux gestes sont aussi dans le panneau Explorateur**, quand aucun projet n’est ouvert : il
affiche alors **Ouvrir un projet** et **Créer un projet**, à sa place habituelle dans la colonne
de gauche. C’est là pour ne pas avoir à repasser par l’accueil depuis un espace de travail.

**Un seul projet est ouvert à la fois.** Ouvrir le second ferme le premier — sans rien perdre :
tout ce qui était enregistré l’est resté.

Le nom du projet ouvert s’affiche dans la ligne d’état, en bas à gauche.

### La liste des projets de l’accueil

**Chaque ligne porte le nom du projet et, dessous, le dossier où il se trouve.** C’est le dossier
qui distingue deux projets appelés pareil — et un studio finit toujours par en avoir deux, l’un
sous `Documents`, l’autre sur un disque de travail. **La date de dernière ouverture n’a pas
disparu** : elle est dans l’infobulle de la ligne, avec le chemin entier, qu’un panneau étroit
tronque.

**Chaque ligne a son menu**, au clic droit comme au bouton :

| Entrée | Ce qu’elle fait |
|---|---|
| **Afficher dans le dossier** | ouvre le gestionnaire de fichiers sur ce projet |
| **Retirer de la liste** | retire le projet de cette liste, **sans toucher au dossier ni à ce qu’il contient** |

**Retirer ne demande pas confirmation** : rien n’est perdu, et rouvrir le projet remet sa ligne.
C’est le geste qui nettoie une liste où traîne un dossier déplacé.

> **Un projet ne se « sauvegarde » pas.** Il n’y a pas de commande « Enregistrer le projet ».
> Chaque chose est écrite au moment où elle arrive : un asset généré à sa réception, un
> document quand vous faites `⌘S`, la disposition des panneaux quand vous la changez.

---

## Ce qu’il y a dedans

```
Mon projet/
│
├── Images/               SIX DOSSIERS POUR COMMENCER
├── Video/                  posés à la création, et ordinaires : renommez-les,
├── Audio/                  videz-les, jetez-les, rangez-les autrement
├── 3D/
├── Textures/
├── Sky/
│                           …et tout ce que vous créez à côté
│
├── .project.json         la carte d'identité — CACHÉ
│
├── .scenario/            UNE SAUVEGARDE DU CATALOGUE — CACHÉ
│   └── items.json          ce qu'un fichier ne peut pas dire de lui-même
│
└── .index/               LE CATALOGUE ET SES CACHES — À GARDER, CACHÉ
    ├── catalog.db          l'index qui rend la recherche instantanée
    ├── proxies/            des copies allégées des vidéos, pour naviguer sans à-coups
    ├── peaks/              le dessin des formes d'onde audio
    └── filmstrips/         créé d’avance, encore vide
```

**Ce qui commence par un point est à la machine ; tout le reste est à vous**, et c’est toute la
règle. Vos fichiers restent visibles et vous les rangez comme vous l’entendez — vous devez pouvoir
les regarder, les copier, les réparer. La carte d’identité, l’index et la sauvegarde, non : ce sont
les outils du studio, pas votre travail.

> **Les six dossiers de départ ne sont qu’un point de départ.** Ils sont posés à la création et
> jamais remis : si vous supprimez `Images/`, il ne revient pas — sauf le jour où une génération a
> besoin d’un endroit où atterrir, et le studio le recrée plutôt que de refuser de travailler.

> **Sur Windows, un point ne cache rien** — l’Explorateur lit un attribut de fichier, pas le nom.
> Le studio le pose lui-même sur les deux entrées. Si l’opération échoue, **le projet s’ouvre quand
> même** : un fichier de service qui reste visible est un défaut d’apparence, refuser d’ouvrir le
> projet pour cela en serait un vrai.

### Ce qui vous appartient

**Tout ce qui ne commence pas par un point.** C’est votre travail. Ce sont de vrais fichiers, dans
de vrais formats — un PNG est un PNG, un MP4 est un MP4. Vous pouvez les ouvrir avec n’importe
quel autre logiciel, et les ranger dans les dossiers que vous voulez.

**Ce qu’un fichier EST ne dépend pas de l’endroit où il est.** Une image reste une image dans
`Repérages/Ruelles/` comme dans `Images/` : le studio lit son extension, et la fiche du catalogue
corrige ce que l’extension ne peut pas deviner — un canal de normales et une couleur de base sont
deux PNG. Déplacez, renommez, réorganisez : le studio suit.

### `.index/` porte plus que des caches — ne le supprimez pas

**Deux de ses quatre entrées sont bien des caches** : `proxies/` et `peaks/` sont refabriqués à
l’import d’un média, et les jeter ne coûte qu’une réimportation. `filmstrips/` est créé d’avance
et reste vide — rien ne l’écrit encore.

**`catalog.db` n’en est pas un.** C’est lui qui garde le nom de chaque asset, ses tags, ses
dimensions, le modèle et le prompt qui l’ont produit, ce dont il dérive — et, pour un média
importé, **le chemin de votre fichier d’origine**, qui n’est écrit nulle part ailleurs. Le journal
d’activité vit dans la même base.

**Le studio ne sait pas le reconstruire à partir du dossier.** Le catalogue se remplit au fil des
générations et des imports ; la passe qui relit le dossier à l’ouverture RETROUVE les fichiers qui
ont bougé, elle ne redevine pas ce qu’ils sont. Supprimer `.index/` rend donc un projet dont les
fichiers sont tous là et dont plus rien ne dit ce qu’ils sont.

> **C’est à cela que sert `.scenario/items.json`.** Le studio y recopie, après chaque passe qui a
> changé quelque chose, ce qu’un fichier ne peut pas dire de lui-même : son nom, ses tags, le
> modèle et le prompt qui l’ont produit — rangés par empreinte du contenu, de sorte qu’un fichier
> retrouvé se reconnaisse. Ce n’est pas une source : le studio ne la lit jamais de lui-même. C’est
> ce qui reste à lire, à la main, le jour où l’index a disparu.

> **Si vous devez alléger un projet**, jetez `proxies/` et `peaks/` — c’est là qu’est le poids.
> Gardez `catalog.db`, qui pèse peu et sait tout.

### `.project.json`

Un petit fichier texte, lisible avec n’importe quel éditeur :

```json
{
  "version": 1,
  "name": "Mon projet",
  "createdAt": "2026-08-07T10:24:11.000Z",
  "updatedAt": "2026-08-07T18:03:52.000Z"
}
```

**C’est ce fichier qui fait d’un dossier un projet**, jamais son nom : le studio ouvre le dossier
que vous désignez et cherche ce fichier dedans.

- **`updatedAt` bouge à chaque document enregistré.** C’est la dernière fois que ce projet a
  travaillé, pas la dernière fois qu’il a été ouvert.
- **Désigner un dossier qui n’en contient pas** vous vaut « Ce dossier n’est pas un projet
  Scenario », dans le journal et dans une bulle en bas à droite — pas un message système.
- **Un fichier tronqué ou modifié à la main** est signalé comme illisible, et le studio ne l’ouvre
  pas plutôt que d’en deviner le contenu.
- **Un projet créé par une version PLUS RÉCENTE du studio est refusé.** Il n’est pas ouvert « du
  mieux possible » : le studio ne connaît pas ce que cette version a ajouté, et le premier
  enregistrement l’effacerait sans rien dire. Mettez le studio à jour pour rouvrir ce projet ; le
  dossier, lui, n’a pas été touché.

> **Un projet créé par une version précédente s’ouvre tel quel.** Son dossier s’appelait
> « Mon projet.scenario » et sa carte d’identité `project.json`, sans point — le studio les
> reconnaît et écrit la nouvelle forme à côté. **L’ancien fichier est laissé où il est** : le
> dossier vous appartient, vous le synchronisez peut-être, et une version antérieure du studio sait
> encore le lire. Renommer le dossier pour lui retirer son extension est à vous de le faire, si
> vous y tenez ; le studio n’y touche pas.

---

## Les documents

Un document est un travail en cours : une image avec ses calques, une scène 3D avec ses objets,
un montage avec ses pistes.

Il est enregistré avec `⌘S` / `Ctrl+S` — dans `documents/` la première fois, faute de mieux, et
ensuite là où vous l’avez rangé — sous une extension qui dit ce qu’il est :

| Type de document | Extension | Espace |
|---|---|---|
| image en calques | `.img` | Image |
| scène 3D | `.scene` | 3D |
| séquence vidéo | `.seq` | Vidéo |
| son en cours d’édition | `.aud` | Audio |
| ciel | `.sky` | Skyboxes |
| matière | `.tex` | Textures |

Cette extension est là pour que le dossier **se lise à l’œil**. `a3f1.scene` à côté de
`b204.tex` dit ce qu’est chacun ; `a3f1.json` à côté de `b204.json` ne dit rien.

> **Les six types savent s’enregistrer**, et le panneau **Explorateur** montre le dossier du
> projet en arborescence — c’est par là qu’on rouvre un document fermé. Fermer un onglet dont le travail n’est
> pas écrit pose la question avant de le perdre.

### Parcourir le projet — le panneau Explorateur

Le panneau **Explorateur** montre **le dossier du projet**, en arborescence : les six dossiers de
départ, et tout ce que vous y avez créé ou déposé vous-même. Les dossiers se déplient, les fichiers
sont dedans, exactement comme dans l’explorateur de votre système.

**Il montre aussi ce que le studio ne sait pas ouvrir.** Un `.pdf`, un `.txt`, un dossier de notes :
c’est votre dossier, et c’est ce qui distingue un explorateur d’une liste de documents.

#### Deux lectures du même dossier

La tête du panneau porte trois boutons. Les deux premiers disent comment le dossier est LU, et
l’un des deux est toujours allumé :

| Lecture | Ce qu’elle montre |
|---|---|
| **Par dossier** | le projet tel qu’il est rangé sur le disque, en arborescence |
| **Par domaine** | tous les fichiers du projet groupés par ce qu’ils **sont**, où qu’ils soient rangés |

**Par domaine** ignore les dossiers. Il pose sept en-têtes au plus — les six types du studio, plus
**Autre** pour ce qui n’en relève d’aucun — chacun suivi du nombre de fichiers qu’il compte. **Un
domaine que rien ne remplit n’apparaît pas** : sept en-têtes vides sur un projet neuf ne diraient
rien.

Un en-tête nomme, il n’ouvre pas : on ne le sélectionne pas, on ne le renomme pas, et rien ne s’y
dépose.

**Elle n’a presque nulle part où déposer**, et c’est mécanique : ranger un fichier demande un
dossier où le porter, et il n’y a plus de dossier à l’écran. Une ligne se prend toujours, mais la
seule cible qui reste est le vide sous l’arbre — la racine du projet. **Pour ranger, revenez
Par dossier.**

C’est ce qui répond à « où sont passées mes vidéos ? » quand elles sont réparties dans cinq
dossiers que vous avez faits vous-même.

#### Chercher, et trier

Sous les boutons, une barre : un champ et un tri. **La recherche parle par-dessus les deux
lectures** — taper un mot est une question sur le projet, pas sur la façon dont il est affiché.

Elle parcourt le dossier **entier**, pas seulement ce qui est déplié, et ramène chaque
correspondance **avec la chaîne de dossiers qui y mène** : un fichier neuf replis plus bas
apparaît là où il est, pas hors sol. Elle attend que la frappe se pose avant de partir.

Le tri range par **Nom, de A à Z** ou **Nom, de Z à A**. Il vaut pour les deux lectures ; il ne
touche pas à l’ordre des domaines, qui est celui que le studio emploie partout ailleurs.

**Le panneau distingue quatre silences**, et c’est ce qui fait qu’il ne dit jamais « vide » quand
il veut dire « patientez » : un dossier illisible, une lecture encore en route, un projet sans
aucun fichier, et un mot auquel rien ne répond. **Une recherche sans résultat ne fait pas
disparaître le champ où elle a été tapée** — sinon il n’y aurait plus de chemin de retour.

#### Les gestes

| Geste | Effet |
|---|---|
| **Double-clic** sur un dossier | l’ouvre ou le referme |
| **Double-clic** sur un document du studio | l’ouvre, en changeant d’espace s’il appartient à un autre |
| **Double-clic** sur un asset | **l’ouvre dans le studio**, dans l’espace qui édite son type — où qu’il soit rangé |
| **Double-clic** sur tout autre fichier | le confie à votre système, qui l’ouvre avec l’application prévue |
| `→` `←` | déplie, replie |
| `↑` `↓` | la ligne précédente, la suivante |
| `Entrée` | ouvre la ligne |
| **⌘-clic** / `Ctrl`-clic | ajoute la ligne à la sélection, ou l’en retire |
| **⇧-clic** | prend tout ce qui va de la dernière ligne prise à celle-ci |
| **Glisser** une ligne sur un dossier | y déplace le fichier ou le dossier, sous le même nom |
| **Glisser** une ligne dans le vide sous l’arbre | la sort de son dossier, à la racine du projet |

**Tout ce qui suit vaut pour la sélection entière**, pas pour la seule ligne cliquée : glisser en
emporte plusieurs d’un coup, et le menu du clic droit s’applique à toutes. **Trois fichiers portés
vers un dossier que l’un d’eux contient n’allument pas ce dossier** — le refus est demandé pour le
lot, pas ligne à ligne.

**Le glisser déplace, le clic droit renomme** — et les deux ne se recouvrent pas : « Renommer »
change le nom **là où le fichier est déjà**, et ne peut pas le sortir de son dossier. Un dossier
qui n’accepterait pas le dépôt ne s’allume pas : vous voyez avant de lâcher, pas après. Un nom
déjà pris dans le dossier d’arrivée est refusé plutôt qu’écrasé, et le journal le dit.

#### Le clic droit : onze gestes, en quatre groupes

| Groupe | Geste | Ce qu’il fait |
|---|---|---|
| ouvrir | **Ouvrir** | ouvre le fichier dans son espace, ou déplie le dossier |
| | **Afficher dans le dossier** | ouvre le Finder ou l’Explorateur Windows, la ligne sélectionnée |
| presse-papiers | **Couper** · **Copier** | retiennent la sélection pour le prochain collage |
| | **Coller** | dépose dans le dossier affiché ce que le presse-papiers retient |
| fichiers | **Nouveau dossier** | crée un dossier vide dans le dossier affiché |
| | **Dupliquer** | pose une copie à côté de l’original, sous un nom libre |
| | **Renommer** | change le nom sur le disque, là où il est lu |
| | **Mettre à la corbeille** | envoie à la corbeille de votre système |
| revenir | **Annuler** · **Rétablir** | défont et refont le dernier lot de fichiers |

**Huit de ces onze lignes portent le raccourci auquel elles répondent**, et c’est celui qui est
*en vigueur* : si vous l’avez remappé dans les réglages, c’est le vôtre qui s’affiche ici. Les
trois autres — **Ouvrir**, **Afficher dans le dossier**, **Renommer** — n’en portent aucun, et
c’est exact : elles ne sont pas des commandes du registre. `Entrée` ouvre bien la ligne, mais
c’est l’arbre qui écoute cette touche, et elle ne se change pas.

**Aucun geste ne disparaît du menu ; ceux qui ne s’appliquent pas sont grisés.** Un menu dont la
longueur change selon la ligne cliquée est un menu qu’on ne peut pas apprendre.

**`⌘Z` ne défait les fichiers que si le focus est dans ce panneau.** Ailleurs il appartient au
document ouvert : annuler dans le canevas ne doit pas atteindre votre disque.

> **Rien n’est effacé ici.** « Mettre à la corbeille » est la corbeille du système : le fichier
> s’y récupère.
>
> **C’est le seul geste que `⌘Z` ne reprend pas.** Déplacer, dupliquer, créer, renommer se défont
> d’une frappe ; la corbeille du système n’a pas de retour portable, et l’historique du studio
> s’arrête là. **C’est aussi pour cela qu’un lot demande confirmation** : au-delà d’un fichier, le
> studio annonce combien partent et attend votre accord. **Un seul fichier part sans question** —
> il est nommé sur la ligne que vous venez de cliquer, et le système offre de le remettre.
>
> **Une porte supprime pour de bon**, et elle le dit : **Supprimer le document…**, dans le menu
> d’un onglet, retire le fichier du dossier sans passer par la corbeille. Son dialogue annonce
> « Cette action est irréversible », et c’est exact.

**Un refus, et il est grisé plutôt que caché.** Ce que le studio garde pour lui — tout ce qui
commence par un point : `.index/`, `.scenario/`, `.project.json` — ne se renomme ni ne se jette, et
ne reçoit rien non plus. Ce sont ses outils ; renommer l’un d’eux casserait le projet pour un nom
que personne ne lit. **Le même refus vaut des deux côtés du glisser** : vous voyez avant de lâcher.

**Un document écrit comme un dossier ne reçoit rien non plus.** Une planche `.img` est un vrai
répertoire, mais ce qu’il contient est l’écriture du studio : un fichier qu’on y déposerait
serait effacé par la prochaine sauvegarde, qui reconstruit ce dossier. Le document lui-même se
déplace comme n’importe quel fichier — c’est son intérieur qui ne s’ouvre pas.

**Tout le reste vous obéit**, les six dossiers de départ compris : renommez-les, videz-les,
jetez-les, sortez-en un asset pour le ranger ailleurs, coupez, copiez, dupliquez. Le studio suit —
c’est ce que la passe de réconciliation fait à l’ouverture et au retour dans la fenêtre.

**Le renommage, lui, passe par le geste de la chose.** Un asset et un document ont chacun le leur, et
l’Explorateur y mène : le nom change, et le fichier suit dans le même mouvement. Un document
renommé ici garde son onglet ouvert, qui prend le nouveau nom. Un asset renommé ici change de nom
partout à la fois — l’Explorateur, l’étagère, l’Inspecteur, l’onglet qui l’édite — parce qu’il
n’y a **qu’un seul nom** : celui de sa ligne d’index EST celui de son fichier.

> **Une image que vous avez déposée vous-même se renomme aussi**, même si le studio n’en a
> aucune fiche : c’est alors un fichier ordinaire, renommé comme tel. Ce qui change selon les
> cas, c’est ce qui SUIT le nom — une fiche d’index, l’onglet d’un document, ou rien.

> Un nom que votre système de fichiers n’accepterait pas est refusé plutôt que corrigé en
> silence — une barre oblique, par exemple. Un nom que le dossier tient déjà l’est aussi, plutôt
> que d’écraser le fichier de quelqu’un d’autre. Le champ s’est refermé quand la réponse arrive :
> c’est le journal d’activité qui le dit.

- les documents déjà à l’écran sont marqués **Ouvert** ;
- l’icône d’un document dit de quel espace il relève, la même que dans le rail.

#### Les éléments cachés

**Rien de ce dont le nom commence par un point ne s’affiche par défaut** — `.project.json` et
`.index/`, donc, mais aussi un dossier à vous que vous auriez nommé en commençant par un point.

**Le troisième bouton en tête du panneau les montre**, sous l’œil que tous les explorateurs de
fichiers emploient pour cela. Ce qu’il révèle reste **en lecture seule** : ces lignes refusent
tous les gestes, des deux côtés — ni renommer, ni corbeille, ni glisser, ni recevoir un dépôt.
C’est ce que le studio tient pour lui, et le voir n’est pas y toucher.

**Un dossier n’est lu qu’au moment où vous l’ouvrez.** `Images/` peut contenir des milliers de
fichiers dans un projet ordinaire, et les lire pour les compter coûterait une attente à chaque
ouverture de projet.

**L’arbre suit le disque.** Copiez un fichier dans le dossier depuis votre système : il apparaît,
sans rien à cliquer. Il se relit aussi quand vous revenez sur la fenêtre — un projet posé sur un
volume réseau n’émet parfois aucun événement, et ce second filet le rattrape.

#### Ce qui se passe quand vous rangez le dossier sans le studio

L’arbre, lui, ne fait que montrer. **Ce qui suit vraiment vos fichiers est une passe** qui remet
le catalogue et le disque d’accord, et elle se déclenche à deux moments : **à l’ouverture d’un
projet** — ce qui a bougé pendant que le studio était fermé — et **quand la fenêtre revient au
premier plan** — ce qui a bougé pendant qu’il était ouvert. Le Finder est l’autre moitié de tout
dossier de projet ; ni l’un ni l’autre moment ne suffit seul.

**Elle reconnaît un fichier à son contenu, pas à son chemin.** Déplacez une image d’un dossier à
l’autre, renommez-la, faites les deux : la fiche la retrouve et la suit. Les identifiants ne
changent pas, donc **une scène 3D continue de pointer sur sa texture** après que vous l’avez
rangée ailleurs.

**Elle n’efface jamais une fiche.** Un fichier introuvable est **daté comme absent**, et sa fiche
reste : le prompt, la graine et la filiation ne sont écrits sur aucun disque, et les perdre parce
qu’un fichier est sur une clé USB débranchée serait perdre plus que le fichier. Rebranchez la clé,
la passe suivante remet la fiche en service.

**Le plus souvent, vous ne la verrez pas.** Une barre s’affiche en tête du panneau **tant qu’une
passe tourne** — mais une passe ordinaire lit le dossier, trouve tout là où le catalogue l’annonce
et se termine avant d’avoir pu être peinte. Ce qui la rend visible est un projet où quelque chose
a bougé : c’est le cas où la passe doit lire des fichiers, donc le seul où l’attente dure assez
pour mériter une explication.

| Ce que la barre montre | |
|---|---|
| **Le studio retrouve les fichiers déplacés hors du projet** | et l’avancement, dès qu’il sait combien de fichiers il va lire |
| **Arrêter** | interrompt la recherche ; **ce qui a déjà été retrouvé reste retrouvé** |

**Le journal ne parle que si quelque chose a changé** : *n fichiers déplacés hors du studio ont
été retrouvés et suivis*, et — en avertissement — *n fichiers du catalogue sont introuvables dans
le projet, leurs fiches sont conservées*. Une passe sur un projet où rien n’a bougé n’écrit rien
du tout, et c’est ce qui la rend supportable à chaque retour dans la fenêtre.

> **C’est toujours par là qu’on rouvre un document fermé.** La disposition retient les onglets
> ouverts, mais un document fermé alors qu’aucune disposition ne le portait n’est plus atteignable
> par les onglets ; il est dans le dossier où vous l’avez rangé, un repli plus bas.

> **Un document jamais enregistré ne revient pas au redémarrage**, et son onglet ne revient pas
> non plus : il est retiré de la disposition plutôt que rouvert sur « Ce document n’est plus
> ouvert. » La disposition est écrite sur votre disque, le contenu des documents non — ce sont les
> fichiers du projet qui en tiennent lieu, et ce qui n’a jamais été écrit n’a rien à rouvrir.

Il n’y a pas de dialogue « Ouvrir un fichier », et il n’en est pas prévu : le studio n’ouvre que
ce qui est dans le projet.

### Comment un document est écrit

Le studio écrit d’abord dans un fichier de transit, puis le renomme par-dessus l’ancien. Cela
veut dire que si l’ordinateur s’éteint **pendant** l’écriture, vous gardez l’ancienne version
intacte au lieu d’un fichier à moitié écrit.

> Une coupure de courant à la seconde exacte de l’écriture peut malgré tout perdre la dernière
> sauvegarde. C’est le compromis assumé : l’alternative coûterait une attente à chaque `⌘S`.

---

## Déplacer, copier, sauvegarder un projet

| Vous voulez… | Faites |
|---|---|
| **Le sauvegarder** | copiez le dossier. C’est tout |
| **L’alléger avant de le copier** | supprimez `.index/proxies` et `.index/peaks` — **gardez `catalog.db`** |
| **Le déplacer ailleurs** | déplacez le dossier, puis rouvrez-le depuis le studio |
| **Le renommer** | renommez le dossier. Le nom affiché, lui, vient de `.project.json` |
| **Le partager** | envoyez le dossier compressé. Celui qui le reçoit devra avoir sa propre clé API |

Rien ne casse : les chemins écrits à l’intérieur du projet sont **relatifs**, ce qui veut dire
qu’ils décrivent une position à l’intérieur du dossier, pas un emplacement sur votre disque.

> **Une exception : les médias importés.** Quand vous importez un fichier de votre disque —
> **vidéo, son, image ou objet 3D**, les quatre s’importent —, le studio **ne le copie pas** : il
> crée un lien vers l’endroit où il se trouve. Si vous déplacez le projet sans emporter ces
> fichiers-là, les liens se cassent.
>
> **Rien ne vous le dira tant que vous n’aurez pas cliqué.** L’inspecteur ne montre pas « Fichier
> introuvable » de lui-même : il propose le bouton **Afficher dans le dossier**, et
> c’est le clic qui, ne trouvant rien, fait apparaître le message. Voir
> [Les assets](07-assets.md).

---

## Rouvrir un projet au démarrage

Par défaut, le studio **rouvre le dernier projet** quand vous le lancez. Vous retrouvez vos
onglets et vos panneaux là où vous les aviez laissés.

Ce comportement se règle : **Réglages ▸ Général ▸ À l’ouverture**, avec deux choix — « Rouvrir
le dernier projet » ou « Ne rien ouvrir ».

Vous pouvez aussi choisir **où le studio vous propose de créer vos projets** :
**Réglages ▸ Stockage ▸ Dossier des projets**. Cela ne déplace rien ; cela ne fait que
présélectionner un endroit dans la boîte de dialogue.

---

## Sans projet ouvert

Le studio fonctionne, mais plusieurs choses sont indisponibles, et le disent :

| Ce que vous voyez | Pourquoi |
|---|---|
| « Ouvrez un projet pour générer. » | une image fabriquée doit atterrir quelque part |
| « Ouvrez un projet pour voir ses assets. » | l’étagère montre le contenu d’un projet |
| Le bouton **+** du rail est grisé | un document est un fichier dans un dossier de projet |

---

[← La fenêtre](03-la-fenetre.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Trouver un modèle →](05-modeles.md)
