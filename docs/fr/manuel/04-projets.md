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

> **Un projet ne se « sauvegarde » pas.** Il n’y a pas de commande « Enregistrer le projet ».
> Chaque chose est écrite au moment où elle arrive : un asset généré à sa réception, un
> document quand vous faites `⌘S`, la disposition des panneaux quand vous la changez.

---

## Ce qu’il y a dedans

```
Mon projet/
│
├── assets/               TOUT CE QUE VOUS FABRIQUEZ
│   ├── img/                les images
│   ├── vid/                les vidéos
│   ├── aud/                les sons
│   ├── 3d/                 les objets 3D
│   ├── tex/                les textures
│   └── sky/                les ciels
│
├── documents/            VOS TRAVAUX EN COURS
│                           un fichier par onglet enregistré
│
├── .project.json         la carte d'identité — CACHÉ
│
└── .index/               DES FICHIERS DE SERVICE — supprimables sans risque, CACHÉ
    ├── catalog.db          l'index qui rend la recherche instantanée
    ├── proxies/            des copies allégées des vidéos, pour naviguer sans à-coups
    ├── peaks/              le dessin des formes d'onde audio
    └── filmstrips/         les vignettes des vidéos
```

**Deux entrées sur quatre sont cachées, et la règle est simple** : ce qui est à vous se voit, ce
qui est à la machine se range. Vos assets et vos documents restent visibles — vous devez pouvoir
les regarder, les copier, les réparer. La carte d’identité et l’index, non : ce sont les outils du
studio, pas votre travail.

> **Sur Windows, un point ne cache rien** — l’Explorateur lit un attribut de fichier, pas le nom.
> Le studio le pose lui-même sur les deux entrées. Si l’opération échoue, **le projet s’ouvre quand
> même** : un fichier de service qui reste visible est un défaut d’apparence, refuser d’ouvrir le
> projet pour cela en serait un vrai.

### Ce qui vous appartient

**`assets/` et `documents/`.** C’est votre travail. Ce sont de vrais fichiers, dans de vrais
formats — un PNG est un PNG, un MP4 est un MP4. Vous pouvez les ouvrir avec n’importe quel autre
logiciel.

### Ce qui est reconstructible

**Tout ce qui est sous `.index/`.** Ce sont des fichiers que le studio fabrique pour aller plus
vite, et qu’il sait refabriquer.

Si ce dossier grossit trop, ou si quelque chose semble corrompu, **vous pouvez le supprimer**.
Le studio le reconstruira, ce qui prendra un moment sur un gros projet, et rien ne sera perdu.

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

Il est enregistré avec `⌘S` / `Ctrl+S`, dans `documents/`, sous une extension qui dit ce qu’il
est :

| Type de document | Extension | Espace |
|---|---|---|
| image en calques | `.img` | Image |
| scène 3D | `.scene` | 3D |
| séquence vidéo | `.seq` | Vidéo |
| son en cours d’édition | `.aud` | Audio |
| ciel | `.sky` | Skyboxes |
| matière | `.tex` | Textures |
| graphe | `.graph` | Graphe |

Cette extension est là pour que le dossier **se lise à l’œil**. `a3f1.scene` à côté de
`b204.tex` dit ce qu’est chacun ; `a3f1.json` à côté de `b204.json` ne dit rien.

> **Les sept types savent s’enregistrer**, et le panneau **Explorateur** montre le dossier du
> projet en arborescence — c’est par là qu’on rouvre un document fermé. Fermer un onglet dont le travail n’est
> pas écrit pose la question avant de le perdre.

### Parcourir le projet — le panneau Explorateur

Le panneau **Explorateur** montre **le dossier du projet**, en arborescence : `assets/`,
`documents/`, et tout ce que vous y avez déposé vous-même. Les dossiers se déplient, les fichiers
sont dedans, exactement comme dans l’explorateur de votre système.

**Il montre aussi ce que le studio ne sait pas ouvrir.** Un `.pdf`, un `.txt`, un dossier de notes :
c’est votre dossier, et c’est ce qui distingue un explorateur d’une liste de documents.

| Geste | Effet |
|---|---|
| **Double-clic** sur un dossier | l’ouvre ou le referme |
| **Double-clic** sur un document du studio | l’ouvre, en changeant d’espace s’il appartient à un autre |
| **Double-clic** sur tout autre fichier | le confie à votre système, qui l’ouvre avec l’application prévue |
| `→` `←` | déplie, replie |
| `↑` `↓` | la ligne précédente, la suivante |
| `Entrée` | ouvre la ligne |

**Le clic droit sur une ligne** offre trois gestes :

| Geste | Ce qu’il fait |
|---|---|
| **Révéler dans le dossier** | ouvre le dossier dans le Finder ou l’Explorateur Windows, la ligne sélectionnée |
| **Renommer** | change le nom sur le disque, là où il est lu |
| **Mettre à la corbeille** | envoie le fichier à la corbeille de votre système |

> **Rien n’est effacé.** « Mettre à la corbeille » est la corbeille du système : le fichier s’y
> récupère. Le studio ne supprime définitivement rien dans un dossier qui vous appartient.

**Deux refus, et ils sont grisés plutôt que cachés.** `assets/`, `documents/` et leurs
sous-dossiers ne se renomment ni ne se jettent : l’index range chaque asset par son chemin sous
`assets/`, et déplacer ce dossier laisserait des lignes que plus rien ne retrouve. Et **un
document qu’un onglet tient ouvert ne se renomme pas** : le nom de son fichier est son
identifiant, l’onglet perdrait le lien, et le prochain `⌘S` réécrirait l’ancien nom à côté du
nouveau. Fermez l’onglet d’abord.

- les documents déjà à l’écran sont marqués **Ouvert** ;
- l’icône d’un document dit de quel espace il relève, la même que dans le rail ;
- `.project.json` et `.index/` ne s’affichent pas : ce sont les fichiers de service du studio.

**Un dossier n’est lu qu’au moment où vous l’ouvrez.** `assets/img` peut contenir des milliers de
fichiers dans un projet ordinaire, et les lire pour les compter coûterait une attente à chaque
ouverture de projet.

**L’arbre suit le disque.** Copiez un fichier dans le dossier depuis votre système : il apparaît,
sans rien à cliquer. Il se relit aussi quand vous revenez sur la fenêtre — un projet posé sur un
volume réseau n’émet parfois aucun événement, et ce second filet le rattrape.

> **C’est toujours par là qu’on rouvre un document fermé.** La disposition retient les onglets
> ouverts, mais un document fermé alors qu’aucune disposition ne le portait n’est plus atteignable
> par les onglets ; il est dans `documents/`, un repli plus bas.

> **Un document jamais enregistré ne revient pas au redémarrage**, et son onglet ne revient pas
> non plus : il est retiré de la disposition plutôt que rouvert sur « Ce document n’est plus
> ouvert. » La disposition est écrite sur votre disque, le contenu des documents non — c’est le
> dossier `documents/` qui en tient lieu, et ce qui n’y a jamais été écrit n’a rien à rouvrir.

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
| **L’alléger avant de le copier** | supprimez `.index/` — il se reconstruira |
| **Le déplacer ailleurs** | déplacez le dossier, puis rouvrez-le depuis le studio |
| **Le renommer** | renommez le dossier. Le nom affiché, lui, vient de `.project.json` |
| **Le partager** | envoyez le dossier compressé. Celui qui le reçoit devra avoir sa propre clé API |

Rien ne casse : les chemins écrits à l’intérieur du projet sont **relatifs**, ce qui veut dire
qu’ils décrivent une position à l’intérieur du dossier, pas un emplacement sur votre disque.

> **Une exception : les médias importés.** Quand vous importez une vidéo ou un son de votre
> disque, le studio **ne le copie pas** — il crée un lien vers l’endroit où il se trouve. Si
> vous déplacez le projet sans emporter ces fichiers-là, les liens se cassent. L’inspecteur
> affiche alors « Fichier introuvable ». Voir [Les assets](07-assets.md).

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
