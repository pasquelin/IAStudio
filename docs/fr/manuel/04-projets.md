# 4. Les projets

[← La fenêtre](03-la-fenetre.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Trouver un modèle →](05-modeles.md)

---

## Un projet est un dossier

Pas une base de données. Pas un espace en ligne. Pas un fichier unique qu’on ne peut ouvrir
qu’avec ce logiciel.

**Un dossier ordinaire, sur votre disque.** Vous pouvez l’ouvrir dans votre explorateur de
fichiers, regarder dedans, le copier sur une clé USB, le sauvegarder avec le reste de vos
documents, l’envoyer à quelqu’un. Il porte l’extension `.scenario`, mais reste un dossier.

C’est une décision de conception, pas un hasard. Un projet qu’on ne peut ouvrir qu’avec le
logiciel qui l’a créé est un projet qu’on perd le jour où le logiciel ne s’ouvre plus.

---

## Créer, ouvrir, changer de projet

| Action | Raccourci | Menu |
|---|---|---|
| **Nouveau projet** | `⌘N` / `Ctrl+N` | Fichier ▸ Nouveau projet… |
| **Ouvrir un projet** | `⌘O` / `Ctrl+O` | Fichier ▸ Ouvrir un projet… |

**Un seul projet est ouvert à la fois.** Ouvrir le second ferme le premier — sans rien perdre :
tout ce qui était enregistré l’est resté.

Le nom du projet ouvert s’affiche dans la ligne d’état, en bas à gauche.

> **Un projet ne se « sauvegarde » pas.** Il n’y a pas de commande « Enregistrer le projet ».
> Chaque chose est écrite au moment où elle arrive : un asset généré à sa réception, un
> document quand vous faites `⌘S`, la disposition des panneaux quand vous la changez.

---

## Ce qu’il y a dedans

```
mon-projet.scenario/
│
├── project.json          la carte d'identité
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
├── layouts/              la façon dont vous arrangez vos panneaux
│
└── .index/               DES FICHIERS DE SERVICE — supprimables sans risque
    ├── catalog.db          l'index qui rend la recherche instantanée
    ├── proxies/            des copies allégées des vidéos, pour naviguer sans à-coups
    ├── peaks/              le dessin des formes d'onde audio
    └── filmstrips/         les vignettes des vidéos
```

### Ce qui vous appartient

**`assets/` et `documents/`.** C’est votre travail. Ce sont de vrais fichiers, dans de vrais
formats — un PNG est un PNG, un MP4 est un MP4. Vous pouvez les ouvrir avec n’importe quel autre
logiciel.

### Ce qui est reconstructible

**Tout ce qui est sous `.index/`.** Ce sont des fichiers que le studio fabrique pour aller plus
vite, et qu’il sait refabriquer.

Si ce dossier grossit trop, ou si quelque chose semble corrompu, **vous pouvez le supprimer**.
Le studio le reconstruira, ce qui prendra un moment sur un gros projet, et rien ne sera perdu.

> Le dossier `.index` commence par un point : sur macOS et Linux, il est **caché** par défaut
> dans l’explorateur de fichiers. C’est normal.

### `project.json`

Un petit fichier texte, lisible avec n’importe quel éditeur :

```json
{
  "version": 1,
  "name": "Mon projet",
  "createdAt": "2026-08-07T10:24:11.000Z",
  "updatedAt": "2026-08-07T18:03:52.000Z"
}
```

C’est ce fichier qui fait d’un dossier un projet.

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

Cette extension est là pour que le dossier **se lise à l’œil**. `a3f1.scene` à côté de
`b204.tex` dit ce qu’est chacun ; `a3f1.json` à côté de `b204.json` ne dit rien.

> **Les six types savent s’enregistrer**, et le panneau **Explorateur** liste ce que le dossier
> contient — c’est par là qu’on rouvre un document fermé. Fermer un onglet dont le travail n’est
> pas écrit pose la question avant de le perdre.

### Rouvrir un document — le panneau Explorateur

La disposition retient les onglets ouverts, mais un document fermé alors qu’aucune disposition
ne le portait n’est plus atteignable par les onglets. C’est ce que le panneau **Explorateur**
sert à retrouver : il liste **tout ce que le dossier `documents/` contient**, ouvert ou non.

- un **double-clic** sur une ligne ouvre le document, en changeant d’espace s’il appartient à un
  autre — une séquence ouverte depuis l’espace Image bascule en Vidéo ;
- les lignes déjà à l’écran sont marquées **Ouvert** ;
- l’icône dit de quel espace le document relève, la même que dans le rail.

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
| **Le renommer** | renommez le dossier. Le nom affiché, lui, vient de `project.json` |
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
