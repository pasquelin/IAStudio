# Scenario Studio — guide de l'utilisateur

Tout ce qu'il faut pour se servir du studio, du premier lancement à une séquence terminée.
Vous cherchez plutôt comment il est bâti ? Voir [architecture.md](architecture.md).

> 🇬🇧 This guide is also available [in English](../en/user-guide.md).

---

## Sommaire

1. [Premier lancement](#premier-lancement)
2. [La fenêtre, expliquée](#la-fenêtre-expliquée)
3. [Les espaces de travail](#les-espaces-de-travail)
4. [Les projets](#les-projets)
5. [Trouver un modèle](#trouver-un-modèle)
6. [Générer](#générer)
7. [L'étagère à assets](#létagère-à-assets)
8. [Éditer une image](#éditer-une-image)
9. [Travailler en 3D](#travailler-en-3d)
10. [Monter une vidéo](#monter-une-vidéo)
11. [Les réglages](#les-réglages)
12. [Aide-mémoire clavier](#aide-mémoire-clavier)
13. [Quand quelque chose cloche](#quand-quelque-chose-cloche)

---

## Premier lancement

Il vous faut une **clé** et un **secret** d'API Scenario, créés depuis votre compte sur
[app.scenario.com](https://app.scenario.com).

1. Ouvrez les **Réglages** — `⌘,` sur macOS, `Ctrl+,` ailleurs.
2. Allez dans la section **Compte** et collez votre clé et votre secret.
3. Le studio les vérifie immédiatement et vous dit s'il est authentifié.

Vos identifiants sont chiffrés par le trousseau de votre système et détenus par le seul
processus principal de l'application. L'interface ne les reçoit jamais : elle demande
« suis-je authentifié ? », jamais « quelle est ma clé ? ».

Tant que vous n'êtes pas authentifié, les panneaux de modèles et de génération restent vides et
disent pourquoi.

<!-- CAPTURE : la fenêtre de Réglages, section Compte, état authentifié visible.
     Enregistrer dans ../images/settings-account.png -->

---

## La fenêtre, expliquée

Le studio est disposé comme un IDE, pas comme une page web : un **châssis** gris moyen sur lequel
reposent des **panneaux** plus sombres, aux angles arrondis.

```
┌──────────────────────────────────────────────────────────────┐
│  barre de titre — espaces de travail, nom du projet          │
├──┬────────────────────────────────────────────────────────┬──┤
│  │                    zone haute                          │  │
│  ├────────────────────────────────────────────────────────┤  │
│ r│         │                                    │         │r │
│ a│  zone   │        espace des documents        │  zone   │a │
│ i│ gauche  │      (les onglets vivent ici)      │ droite  │i │
│ l│         │                                    │         │l │
│  ├────────────────────────────────────────────────────────┤  │
│  │                    zone basse                          │  │
├──┴────────────────────────────────────────────────────────┴──┤
│  ligne d'état                                                │
└──────────────────────────────────────────────────────────────┘
```

**Les rails** — les bandes d'icônes collées aux bords gauche et droit. Un clic ouvre l'outil, un
second le referme. Un séparateur en travers du rail marque la coupe d'une zone : les icônes
au-dessus ouvrent dans sa première moitié, celles en dessous dans la seconde.

**Les zones** — quatre (gauche, droite, haut, bas). Chacune est coupée en deux moitiés, et chaque
moitié montre un outil à la fois. Deux outils dans des moitiés *différentes* d'une même zone
s'affichent ensemble — empilés dans une colonne, côte à côte dans une bande.

**L'espace des documents** — le centre. Il ne prend **que des documents** : un fichier ouvert et
sa barre d'outils. Les onglets vivent ici et nulle part ailleurs, parce qu'un document a un nom.
Aucune fenêtre d'outil n'y entre.

**Redimensionner** — tirez la gouttière entre deux surfaces. L'espace entre elles *est* la
poignée ; il n'y a pas de prise séparée à viser.

Un panneau se ferme, il ne se replie pas. Un panneau replié est un troisième état qui ne
ressemble ni à ouvert ni à fermé, et le rail rouvre un outil en un clic.

### Les outils

| Outil | Où | Visible dans | Ce que c'est |
|---|---|---|---|
| **Calques** | gauche, 1re moitié | Image | la pile de calques de l'image ouverte |
| **Maillages** | gauche, 1re moitié | 3D | les maillages de la scène, et le bouton qui en ajoute |
| **Lumières** | gauche, 1re moitié | 3D | les lumières de la scène |
| **Explorateur** | gauche, 2de moitié | partout | l'arbre de scène en 3D. L'arborescence de projet n'est pas encore écrite, et le panneau le dit dans les autres espaces |
| **Modèles** | droite, 1re moitié | partout | le catalogue Scenario, filtré sur l'espace actif |
| **Génération** | droite, 1re moitié | partout | le formulaire du modèle choisi |
| **Inspecteur** | droite, 2de moitié | 3D | tout ce qui définit le nœud sélectionné, réglable en direct |
| **Timeline** | bas | Vidéo | la séquence en cours de montage |
| **Assets** | bas | partout | tout ce que le projet contient |
| **Jobs** | bas | partout | ce qui est en train de générer |

**Affichage → Outils** rouvre ce que vous avez fermé, **Affichage → Réinitialiser la disposition**
remet chaque panneau à sa place d'origine.

---

## Les espaces de travail

Six espaces, changés depuis la barre de titre. Chacun réarrange les panneaux et la barre d'outils
autour d'un type de travail, et filtre le catalogue sur la famille correspondante.

| Espace | Famille de modèles | Panneaux qu'il amène |
|---|---|---|
| **Image** | image | Calques |
| **Vidéo** | video | Timeline |
| **3D** | 3d | Maillages, Lumières, Inspecteur, et l'arbre de scène dans l'Explorateur |
| **Audio** | audio | — |
| **Textures** | image | — |
| **Skyboxes** | image | — |

Une disposition arrangée dans un espace y reste. Ce qui est ouvert est retenu par zone, et un
espace laisse simplement de côté les outils dont il n'a pas l'usage.

---

## Les projets

Un projet est **un dossier sur votre disque** — pas une base de données, pas un espace en ligne.
`⌘N` / `Ctrl+N` en crée un, `⌘O` / `Ctrl+O` en ouvre un.

Le studio y crée cette structure :

```
mon-projet/
├── project.json          le manifeste : nom, version, dates
├── assets/
│   ├── img/  vid/  aud/  3d/  tex/  sky/
├── documents/            vos images, scènes et séquences
├── layouts/              les dispositions enregistrées
└── .index/               cache reconstructible — suppression sans risque
    ├── catalog.db          l'index des assets
    ├── proxies/            médias allégés pour le scrubbing
    ├── peaks/              formes d'onde audio
    └── filmstrips/         vignettes vidéo
```

Tout ce qui est sous `.index/` est dérivé et se régénère. Tout le reste vous appartient.

Sans projet ouvert, un asset généré n'a nulle part où atterrir : la génération attend et le dit.

---

## Trouver un modèle

Le panneau **Modèles** liste le catalogue Scenario pour la famille de l'espace actif — l'espace
Image montre les modèles d'image, l'espace 3D les modèles 3D. Pas d'onglets de type : la barre de
titre dit déjà quel espace est actif.

- **La recherche** filtre à la frappe, avec une courte pause pour ne pas partir à chaque touche.
- **Les facettes** trient par capacité (texte-vers-image, inpaint, controlnet, image-vers-3D…) et
  par période.
- **Le tri** se fait par pertinence, du plus récent ou du plus ancien.
- **Deux vues** — une grille de vignettes ou une liste dense. Le curseur redimensionne les
  vignettes.

Un clic choisit le modèle. Le choix est retenu par famille, et rappelé en haut du panneau : c'est
lui que la génération, en dessous, fera tourner.

La plupart des modèles publics n'ont pas de vignette propre et sont illustrés par l'un de leurs
assets d'exemple. Ces images ne sont demandées que pour les cartes qui atteignent réellement
l'écran, rassemblées en une requête par pause de défilement.

<!-- CAPTURE : le panneau Modèles en grille, facettes ouvertes. Vers ../images/models-grid.png -->

---

## Générer

Choisissez un modèle, puis ouvrez **Génération**. Le formulaire affiché est **construit depuis le
schéma du modèle lui-même**, récupéré auprès de l'API — ce n'est pas un formulaire écrit à la
main, et c'est pourquoi il est juste pour tous les modèles, y compris ceux publiés après cette
version.

Remplissez-le et appuyez sur **Générer**. La requête revient immédiatement avec un job.

### Le panneau Jobs

Chaque génération y apparaît avec son état — en file, en cours, réussi, échoué, annulé — et une
barre de progression tant qu'elle tourne. **Annuler** arrête ce qui n'est pas terminé.

Les jobs passent par une file bornée : trois à la fois par défaut, réglable dans les Réglages.
Quand l'API répond 429 ou 5xx, la file recule exponentiellement et réessaie, au lieu d'insister.

Un job réussi écrit son résultat dans le projet, et le nouvel asset paraît dans l'étagère.

<!-- CAPTURE : le panneau Génération avec le formulaire d'un modèle, et la bande Jobs en dessous
     avec un job en cours. Vers ../images/generate.png -->

---

## L'étagère à assets

Le panneau **Assets** est le navigateur de contenu du projet. Ses contrôles siègent sur la ligne
de titre plutôt qu'en dessous : l'étagère est là pour montrer des assets, pas des boutons.

- **Recherche** et **filtre de type** (image, vidéo, audio, maillage, texture, skybox).
- **Grille ou liste**, toutes deux virtualisées : un projet de plusieurs milliers d'assets défile
  sans à-coups, parce que seul ce qui est à l'écran est rendu.
- **Glissez un asset** hors de l'étagère et déposez-le — sur la timeline, par exemple, pour en
  faire un clip.

Le filtrage est local : le catalogue du projet est déjà indexé en mémoire.

### Importer vos propres médias

Le bouton **importer**, sur la ligne de titre de l'étagère, fait entrer des fichiers depuis votre
disque. Chacun passe par un court pipeline, et un bandeau au-dessus du navigateur dit où il en
est : **analyse** (lire ce que le fichier est réellement), **empreinte**, **proxy** (une copie
allégée, pour que le scrubbing reste fluide), **waveform** (pour que l'audio se dessine).
Chacune est interruptible — le proxy d'un rush de vingt minutes n'a pas à être attendu.

Si ffmpeg est introuvable, le bandeau le dit : l'import fonctionne quand même, vous n'avez
simplement ni proxy ni waveform. Indiquez le chemin de votre ffmpeg dans les réglages pour les
retrouver.

---

## Éditer une image

Ouvrez un document image et la barre d'outils devient celle de l'image. Les outils sont groupés
comme Figma groupe les siens : **survolez un groupe pour en ouvrir le reste** ; cliquer le bouton
lui-même arme le mode qu'il montre.

| Groupe | Outils |
|---|---|
| **Pointeur** | pointeur, déplacer, main, échelle |
| **Cadre** | cadre, recadrer, section, tranche |
| **Sélection** | rectangle, ellipse, lasso |
| **Forme** | rectangle, ligne, flèche, ellipse, polygone, étoile, image |
| **Peinture** | brosse, crayon |
| **Gomme** | gomme, gomme ponctuelle, gomme de sélection |
| **Autres** | plume, texte, texte sur chemin, remplissage, pipette, commentaire, région |

Le panneau **Calques**, à gauche, tient la pile : réordonner, masquer d'un œil, et voir d'un coup
d'œil ce qui est caché — un calque masqué est estompé et barré.

Annuler et rétablir sont dans la barre d'outils et sur `⌘Z` / `⇧⌘Z`. L'historique appartient au
document : l'onglet visé doit être l'onglet actif pour que son annulation s'applique.

<!-- CAPTURE : un document image, le volet du groupe Forme ouvert, la pile de calques visible.
     Vers ../images/image-tools.png -->

---

## Travailler en 3D

L'espace 3D ouvre une vraie vue three.js.

**Naviguer** — maintenez et volez :

| Touche | Mouvement |
|---|---|
| `W` `A` `S` `D` | avant, gauche, arrière, droite |
| `E` / `Q` | monter / descendre |
| `Shift` | accélérer |

Les touches sont lues à leur **position physique** : WASD en QWERTY et ZQSD en AZERTY sont les
mêmes quatre touches. Rien à reconfigurer.

**Manipuler** — une touche par outil :

| Touche | Outil |
|---|---|
| `V` | sélection |
| `G` | déplacer |
| `R` | tourner |
| `S` | mettre à l'échelle |
| `F` | cadrer la sélection |
| `Suppr` | supprimer |

**Ajouter** — depuis la barre d'outils, depuis les panneaux Maillages et Lumières, ou depuis le
menu natif sous **Objets → Ajouter**. Maillages : boîte, sphère, capsule, cercle, cylindre,
dodécaèdre, icosaèdre, octaèdre, tétraèdre, plan, anneau, tore, nœud de tore, tube, révolution,
sprite, texte. Lumières : ambiante, directionnelle, hémisphérique, ponctuelle, spot.

L'**Explorateur** montre la scène en arbre. Seules les lignes visibles sont rendues, de sorte
qu'une scène lourde défile quand même sans peine, et les flèches la parcourent.

<!-- CAPTURE : la vue 3D avec un maillage sélectionné, l'arbre de scène et le panneau Maillages.
     Vers ../images/scene-3d.png -->

---

## Monter une vidéo

L'espace Vidéo place la **Timeline** en travers de la bande basse — une séquence se lit sur toute
la largeur, donc la timeline et l'étagère à assets y prennent leur tour plutôt que de la
partager.

| Outil | Ce qu'il fait |
|---|---|
| **Sélection** | déplacer et rogner les clips |
| **Lame** | couper un clip là où vous cliquez |
| **Main** | faire défiler la timeline |

Les contrôles de transport lisent, mettent en pause et rembobinent. Un seul lecteur est actif à
la fois, ce qui garde le scrubbing fluide au lieu de le faire lutter contre un second décodeur.

Déposez un asset de l'étagère sur la timeline pour en faire un clip.

<!-- CAPTURE : l'espace vidéo, timeline avec plusieurs clips et le moniteur au-dessus.
     Vers ../images/timeline.png -->

---

## Les réglages

`⌘,` / `Ctrl+,` ouvre la fenêtre de réglages.

### Compte

Votre **clé** et votre **secret** d'API Scenario. Ils sont vérifiés dès l'enregistrement, et la
fenêtre vous dit s'ils fonctionnent.

Ils sont chiffrés par le trousseau de votre système et détenus par le seul processus principal.
Si votre système n'offre aucun chiffrement, le studio **refuse de les stocker** plutôt que de les
écrire en clair.

### Apparence

| Réglage | Valeurs | Défaut |
|---|---|---|
| **Thème** | sombre, clair | sombre |
| **Densité** | confort (contrôles à 28 px), compact (24 px) | confort |

La densité atteint tous les contrôles d'un coup — rails, en-têtes, lignes, gouttières — parce
qu'ils sont tous dimensionnés sur les mêmes gauges plutôt que sur leurs propres pixels.

Le fond reste opaque, délibérément, et aucun réglage ne permet d'en changer : dans un studio on
juge des couleurs, et un fond translucide fausse tout ce qui est affiché au-dessus.

### Génération

| Réglage | Ce qu'il fait | Défaut |
|---|---|---|
| **Jobs simultanés** | combien de générations tournent à la fois | 3 |
| **Tentatives maximales** | combien de fois une requête limitée ou échouée est réessayée, avec recul exponentiel | 4 |

Augmenter la concurrence n'accélère pas l'API ; cela rend seulement la limitation de débit plus
probable. La file existe pour étaler une rafale plutôt que de la faire rejeter.

### Familles de modèles

Le modèle que la génération présélectionne pour chaque famille — image, vidéo, 3D, audio. Laissez
une famille vide pour qu'elle demande à chaque fois.

### Stockage

| Réglage | Ce qu'il fait |
|---|---|
| **Dossier de projets** | l'endroit où s'ouvre la boîte de dialogue de nouveau projet |
| **Emplacement** | un asset généré est-il téléchargé dans le projet (**local**) ou laissé chez Scenario (**cloud**) |

Le studio retient aussi le dernier projet ouvert, et le rouvre au lancement.

### Médias

**Chemin de ffmpeg** — un binaire ffmpeg à utiliser à la place de celui trouvé automatiquement.
Le laisser vide est le cas normal.

Le studio cherche dans cet ordre : **le binaire embarqué**, puis **votre chemin configuré**, puis
**ce qui se trouve sur votre `PATH`**. Si aucun ne répond, l'import fonctionne quand même — vous
perdez le proxy et la forme d'onde, et l'étagère le dit précisément au lieu d'échouer en silence.

### Où tout cela est rangé

Un fichier `settings.json` dans votre dossier de configuration utilisateur, écrit par
`electron-store` :

| Système | Chemin |
|---|---|
| macOS | `~/Library/Application Support/scenario-studio/settings.json` |
| Windows | `%APPDATA%\scenario-studio\settings.json` |
| Linux | `~/.config/scenario-studio/settings.json` |

Tout y est lisible sauf les identifiants, qui sont chiffrés. Supprimer le fichier remet le studio
à ses valeurs par défaut ; vos projets n'y sont pour rien, ils vivent dans leurs propres dossiers.

---

## Aide-mémoire clavier

### Partout

| Raccourci | Action |
|---|---|
| `⌘N` / `Ctrl+N` | nouveau projet |
| `⌘O` / `Ctrl+O` | ouvrir un projet |
| `⌘,` / `Ctrl+,` | réglages |
| `⌃⌘F` / `F11` | plein écran |
| `⌘Z` / `⇧⌘Z` | annuler / rétablir, dans le document actif |

### Vue 3D

| Raccourci | Action |
|---|---|
| `V` `G` `R` `S` | sélection, déplacer, tourner, échelle |
| `F` | cadrer la sélection |
| `Suppr` | supprimer la sélection |
| `W` `A` `S` `D` `Q` `E` | voler |
| `Shift` | accélérer en vol |

Les raccourcis sont retenus comme des positions physiques de touche, et sont réassignables.

---

## Quand quelque chose cloche

| Ce que vous voyez | Ce que ça veut dire |
|---|---|
| Le panneau des modèles dit qu'il n'y a pas d'identifiants | Réglages → Compte. La clé ou le secret manque, ou est refusé |
| La génération demande d'ouvrir un projet | Un asset généré doit atterrir quelque part — créez ou ouvrez-en un |
| Un job échoue et reste en échec | Le message en nomme la cause. Une limite de débit recule et réessaie seule ; une entrée invalide, non |
| L'étagère est vide dans un projet ouvert | Rien n'a encore été généré ni importé — le panneau distingue ces deux cas |
| `⌘Z` semble ne rien faire | L'annulation appartient à l'onglet actif. Activez le document visé |
| Un panneau a disparu | Affichage → Outils le rouvre ; Affichage → Réinitialiser la disposition remet tout en place |

Rien de votre travail ne quitte votre machine, hormis les requêtes de génération elles-mêmes.
