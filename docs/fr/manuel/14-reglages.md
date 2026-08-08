# 14. Tous les réglages

[← Espace Skyboxes](13-espace-skyboxes.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Tous les raccourcis →](15-raccourcis.md)

Chaque réglage du studio, sa valeur de départ, ses limites, et à quoi il sert vraiment.

---

## Ouvrir les réglages

`⌘,` (macOS) ou `Ctrl+,` (Windows, Linux). Ou le menu **Réglages…**.

Les réglages s'ouvrent dans **une fenêtre à part**. Elle vit à côté de votre travail : vous
pouvez la laisser ouverte, changer une valeur, regarder l'effet dans la fenêtre principale,
recommencer.

À gauche, la liste des **sections**. Au-dessus, un champ **Rechercher un réglage** : tapez
« grille », « langue », « ffmpeg », et la fenêtre affiche les réglages qui correspondent, quelle
que soit leur section. Si rien ne correspond, elle le dit : « Aucun réglage ne correspond à cette
recherche. »

### Comment un changement est enregistré

Trois boutons en bas de la fenêtre.

| Bouton | Ce qu'il fait |
|---|---|
| **Appliquer** | enregistre les changements et laisse la fenêtre ouverte |
| **OK** | enregistre et ferme la fenêtre |
| **Annuler** | jette les changements non enregistrés |

Tant qu'un réglage est modifié sans être appliqué, une **pastille** apparaît à côté de lui, avec
l'infobulle « Modifié, pas encore appliqué ».

> **Fermer la fenêtre avec des changements en attente ne les perd pas en silence.** Le studio
> demande : « Vous avez changé des réglages sans les appliquer. Que voulez-vous faire ? » — vous
> choisissez **Appliquer** ou **Ne pas appliquer**.

### Revenir à la valeur d'origine

Chaque réglage porte, au survol, un petit bouton **Restaurer la valeur par défaut**. Il ne touche
que ce réglage-là. Pour tout remettre à zéro d'un coup, voir **Tout réinitialiser** dans la
section Avancé, plus bas.

### Un réglage grisé

Certains réglages dépendent d'un autre. **Taille de la grille** ne sert à rien si la grille n'est
pas affichée : il reste visible, mais grisé, avec la raison écrite en dessous — *« Sans effet tant
que "Afficher la grille" est désactivé. »*

Rien n'est jamais caché : un réglage qu'on ne peut pas changer maintenant reste à sa place, avec
son explication. Chercher un réglage disparu est plus pénible que lire pourquoi il est éteint.

---

## Général

*Langue de l'application et ce qu'elle fait en s'ouvrant.*

### Langue

**Choix. Départ : Système.**

La langue de tous les textes de l'application : menus, boutons, messages.

| Valeur | Effet |
|---|---|
| **Système** | reprend la langue de votre ordinateur |
| **Français** | français |
| **English** | anglais |

Chaque langue s'écrit dans sa propre langue — « Français » reste « Français » même sur un écran en
anglais. C'est volontaire : on reconnaît sa langue avant de savoir lire celle de l'écran.

Le changement est **immédiat**, il n'y a rien à relancer. Il ne touche ni vos projets, ni ce que
vous écrivez dedans : un prompt écrit en anglais reste en anglais.

### À l'ouverture

**Choix. Départ : Rouvrir le dernier projet.**

Ce que l'application fait quand vous la lancez.

| Valeur | Effet |
|---|---|
| **Rouvrir le dernier projet** | vous remet là où vous vous étiez arrêté |
| **Ne rien ouvrir** | démarre sur une fenêtre vide |

« Ne rien ouvrir » est plus rapide au démarrage, et plus reposant si vous jonglez entre beaucoup
de projets.

---

## Compte

*Identifiants API, chiffrés par le trousseau du système.*

C'est ici qu'on branche le studio à [Scenario](https://www.scenario.com). Sans cette étape, tout
ce qui touche à la génération reste inerte : le catalogue de modèles est vide, le bouton
**Générer** ne répond pas.

### Le studio tient plusieurs comptes

Pas un seul. Vous pouvez enregistrer autant de clés API que vous voulez, chacune sous un nom que
vous choisissez — « Studio », « Client X », « Perso ».

**Pourquoi c'est utile.** Une clé API **porte son propre projet Scenario** : ses modèles, ses
assets, son crédit. Changer de compte change **la bibliothèque distante** que vous parcourez.

> **Cela ne touche jamais votre projet local.** Vos dossiers, vos images, vos montages sont sur
> votre disque et n'appartiennent à aucun compte. Changer de compte change ce que vous pouvez
> **aller chercher**, jamais ce que vous avez **déjà**.

### Ajouter un compte

Le formulaire, sous la liste. Trois champs :

| Champ | Ce que c'est |
|---|---|
| **Nom** | ce que vous voulez, pour vous y retrouver — « Studio, Client X… » |
| **Clé API** | votre identifiant, visible pendant que vous le tapez |
| **Secret API** | votre mot de passe, masqué par des points |

Prenez la clé et le secret sur [app.scenario.com](https://app.scenario.com), dans les réglages de
votre compte. Puis **Ajouter un compte** — le bouton affiche « Ajout… » le temps de l'écriture.

**Le bouton reste éteint** tant que les trois champs ne sont pas valides. Inutile de deviner
pourquoi : il s'allume quand tout y est.

Le nom obéit à trois règles, et le studio dit laquelle a été enfreinte :

| Règle | Message si elle est enfreinte |
|---|---|
| Un nom est obligatoire | « Un nom est obligatoire. » |
| 60 caractères au maximum | « Ce nom est trop long. » |
| Deux comptes ne peuvent pas porter le même nom | « Un autre compte porte déjà ce nom. » |

L'unicité est vérifiée **sans tenir compte de la casse** : « Studio » et « studio » sont le même
nom. C'est voulu — le sélecteur n'affiche que le nom, et deux entrées qui se lisent pareil vous
feraient choisir à l'aveugle.

**Deux autres messages peuvent apparaître ici**, plus rares, et ils ne se règlent pas de la même
façon :

| Message | Ce qui s'est passé | Quoi faire |
|---|---|---|
| « Ce compte n'existe plus. » | vous agissez sur un compte supprimé entre-temps — par une autre fenêtre du studio, le plus souvent | fermez les réglages et rouvrez-les : la liste se relit |
| « Le compte n'a pas pu être enregistré. » | l'écriture a échoué sans que le studio sache dire pourquoi | réessayez une fois ; si cela recommence, voir [Quand ça coince](16-depannage.md) |

Le premier n'est jamais votre faute et ne perd rien. Le second est le seul message de cette
section qui mérite un deuxième essai.

> **Les champs sont vidés même en cas de succès.** Ce n'est pas un bug. L'écran que vous regardez
> n'a jamais le droit de connaître votre clé : il sait seulement si elle marche. Une fois envoyée,
> elle est chiffrée par le trousseau du système d'exploitation — le même coffre-fort que celui qui
> garde vos mots de passe — et rangée hors de portée de l'affichage.
>
> C'est pourquoi il n'y a **pas de bouton « voir ma clé »** : ce bouton ne peut pas exister.

### La liste des comptes

Une ligne par compte. Sur celle du compte **en cours d'utilisation**, une pastille :

| Pastille | Ce qu'elle dit |
|---|---|
| **Utilisé**, en vert | c'est ce compte qui travaille, et sa clé fonctionne |
| **Non connecté**, en rouge | c'est ce compte qui travaille, mais sa clé est refusée |

Les autres lignes n'en portent pas : seul le compte actif peut dire si sa clé marche, puisque
c'est le seul qu'on interroge.

Trois boutons par ligne :

| Bouton | Effet |
|---|---|
| **Utiliser ce compte** | bascule dessus. Absent sur la ligne déjà active |
| **Renommer** | remplace la ligne par un champ de saisie, avec **Enregistrer** et **Annuler** |
| **Supprimer** | retire le compte et sa clé |

### Le compte venu d'un fichier

Si vous avez lancé le studio depuis son code source avec un fichier `secrets/.env`, ces
identifiants apparaissent **comme un compte ordinaire** dans la liste, avec une étiquette grise
`secrets/.env`.

Il s'utilise comme les autres — le bouton **Utiliser ce compte** fonctionne — mais il n'a **ni
Renommer ni Supprimer** : ces deux boutons sont absents, pas grisés.

**C'est plus honnête qu'un bouton qui refuse.** Ce compte se modifie en éditant le fichier, et un
bouton qui ne pourrait que dire non vaut moins que pas de bouton du tout. Si vous en croisez un par
un autre chemin, le studio le dit : « Ce compte vient de `secrets/.env` : modifiez ce fichier pour
le renommer ou le retirer. »

### Quand la liste est vide

> « Aucun compte pour l'instant. Ajoutez une clé API pour accéder à la bibliothèque Scenario. »

Rien n'est enregistré, et rien ne fonctionne : ni catalogue, ni génération.

### Si le trousseau est verrouillé

> « Le trousseau n'a pas rendu vos comptes. Réessayez après l'avoir déverrouillé — rien n'a été
> modifié. »

**La dernière moitié de la phrase est la plus importante.** Le studio a refusé d'écrire plutôt que
d'écrire à moitié : sans pouvoir relire la liste existante, enregistrer un compte l'aurait
remplacée par lui seul. Déverrouillez votre trousseau, réessayez, tout est encore là.

---

## Apparence

*Thème et densité des contrôles.*

### Thème

**Choix. Départ : Sombre.**

| Valeur | Effet |
|---|---|
| **Sombre** | fond gris très foncé — repose les yeux dans une pièce peu éclairée |
| **Clair** | fond clair — se lit mieux en plein jour |
| **Système** | suit le réglage de votre ordinateur, et bascule tout seul le soir venu |

> **Le fond reste opaque, quel que soit le thème.** Pas de transparence, pas de flou derrière la
> fenêtre. Dans un studio on juge des couleurs, et un fond translucide fausse la perception de
> tout ce qui est affiché au-dessus. C'est une décision de métier, pas un oubli.

### Densité

**Choix. Départ : Confort.**

Règle la taille des boutons et la hauteur des lignes.

| Valeur | Hauteur des contrôles | Pour qui |
|---|---|---|
| **Confort** | 28 px | plus d'air, plus faciles à viser à la souris |
| **Compact** | 24 px | plus de choses à l'écran, sur un petit écran ou avec beaucoup de panneaux |

### Couleur d'accent

**Couleur. Départ : celle du thème (bleu).**

La couleur qui signale **ce qui est sélectionné ou en cours** : le contour du panneau actif, la
tête de lecture de la timeline, le cadre d'une sélection.

Elle ne change rien à ce que vous fabriquez — seulement à la façon dont l'application vous montre
où vous en êtes. Laissez-la telle quelle pour garder celle du thème.

### Taille du texte

**Curseur. De 0,85 à 1,40, par pas de 0,05. Départ : 1.**

Agrandit ou réduit **tous les textes** de l'application d'un seul coup.

- **1** est la taille d'origine, celle à laquelle l'interface a été dessinée ;
- **au-dessus**, les mots deviennent plus gros et il en tient moins à l'écran ;
- **en dessous**, c'est l'inverse.

Les **boutons gardent leur taille** : c'est la densité qui s'en occupe. Les deux réglages sont
séparés exprès — on peut vouloir de gros textes sur des contrôles serrés, ou l'inverse.

### Limiter les animations

**Case à cocher. Départ : décochée.**

Coupe les petits mouvements de l'interface : les panneaux apparaissent d'un coup au lieu de
glisser.

Utile dans deux cas : si les animations vous fatiguent ou vous donnent mal au cœur, et sur une
machine un peu lente où elles saccadent au lieu de fluidifier.

---

## Génération

*File de génération et modèles par défaut, par famille.*

### Générations simultanées

**Nombre entier. De 1 à 16. Départ : 3.**

Combien de créations travaillent **en même temps**.

Plus ce nombre est grand, plus vous en lancez d'un coup — mais chacune peut mettre plus longtemps
à revenir, et le service peut refuser celles qui arrivent en trop (voir
[Trop de requêtes](16-depannage.md)). **Trois est un bon équilibre.**

> **Ce réglage est la seule vanne.** Toutes les générations passent par la même file, quel que
> soit l'espace de travail d'où elles partent. Il n'y a pas de moyen de la contourner, et c'est
> voulu : c'est ce qui empêche une rafale de demandes de se faire refuser en bloc.

### Tentatives maximum

**Nombre entier. De 0 à 10. Départ : 4.**

Quand une génération échoue à cause d'une **coupure réseau** ou d'un **serveur occupé**,
l'application réessaie toute seule. Ce nombre dit combien de fois avant d'abandonner.

À **0**, elle n'essaie jamais deux fois.

> **Une clé API invalide n'est jamais réessayée**, quel que soit ce réglage. Réessayer ne la
> corrigerait pas — cela ne ferait que retarder le message qui vous dit quoi faire.

### Modèle par défaut, par famille

Cinq sous-sections : **Image**, **Vidéo**, **3D**, **Audio**, **Agrandissement**.

> **La famille Texture n'a pas encore la sienne.** Elle existe pourtant comme famille de modèles
> depuis peu. Conséquence concrète : dans l'espace Textures, il faut choisir un modèle à la main à
> chaque session — voir [Ce qui n'existe pas encore](18-limites.md).

Chacune tient un seul réglage : le modèle que le panneau **Génération** présélectionne quand vous
arrivez dans cet espace.

| Valeur | Effet |
|---|---|
| **Demander à chaque fois** *(départ)* | aucun modèle présélectionné, vous choisissez |
| *un modèle* | ce modèle est déjà en place à l'ouverture de l'espace |

Réglez-le une fois que vous avez trouvé le modèle avec lequel vous travaillez le plus : cela
enlève un clic à chaque session.

> **La sous-section Agrandissement est vide, et ce n'est pas une panne.** Sa liste ne propose que
> « Demander à chaque fois ». Aucun modèle n'est rangé dans la famille *agrandissement* — un
> agrandisseur reçoit une image et rend une image, il est donc classé avec les modèles d'image, où
> vous pouvez l'utiliser normalement. Le réglage est en avance sur l'espace qui l'utilisera — voir
> [Ce qui n'existe pas encore](18-limites.md).

---

## Espaces de travail

*Ce qui n'a de sens que dans un espace précis : la vue 3D, le montage, l'image.*

Une seule sous-section pour l'instant : **3D**.

### Afficher la grille

**Case à cocher. Départ : cochée.**

Le quadrillage posé au sol de la vue 3D.

Il **ne fait pas partie de ce que vous fabriquez** : c'est un repère, pour savoir où sont les
choses et à quelle hauteur. On le cache pour juger une image sans rien autour.

### Taille de la grille

**Nombre entier. De 2 à 500 mètres. Départ : 20.** *(grisé si la grille est masquée)*

Jusqu'où le quadrillage s'étend, et donc combien de carreaux il compte — **un carreau vaut
toujours un mètre**.

Agrandissez-le pour une scène vaste ; réduisez-le pour un petit objet posé près de la caméra.

### Vitesse de déplacement

**Curseur. De 0,5 à 20 m/s, par pas de 0,5. Départ : 4.**

À quelle vitesse la caméra avance quand vous **volez** dans la vue 3D.

Trop lent, on met dix secondes à traverser la scène. Trop rapide, on la dépasse sans la voir.
4 m/s est à peu près l'allure d'un homme qui court.

### Accélération

**Curseur. De 1 à 10, par pas de 0,5. Départ : 3.**

Par combien la vitesse est multipliée **tant que vous maintenez la touche d'accélération**
(`⇧` gauche, par défaut).

À 3, vous allez trois fois plus vite : de quoi traverser une grande scène sans avoir à toucher au
réglage du dessus.

### Angle de vue

**Curseur. De 30° à 100°, par pas de 5. Départ : 60.**

Ce que la caméra embrasse.

| Angle | Effet |
|---|---|
| **petit** (30–45°) | rapproche et aplatit, comme un téléobjectif |
| **60°** | proche de ce que voit un œil |
| **grand** (85–100°) | montre beaucoup plus, mais déforme les bords |

### Les trois pas du magnétisme

Le magnétisme s'allume dans la **barre d'outils de la scène** (touche `M`) ; ces trois réglages
disent seulement **de combien** il avance à chaque cran.

| Réglage | Bornes | Départ | Ce qu'il fait |
|---|---|---|---|
| **Pas de déplacement** | 0,1 à 10 m, par 0,1 | **0,5 m** | de combien un objet avance d'un cran |
| **Pas de rotation** | 1° à 90°, par 1 | **15°** | l'angle d'un cran de rotation |
| **Pas d'échelle** | 0,05 à 1, par 0,05 | **0,1** | de combien l'échelle avance d'un cran |

**15° est la valeur classique** : vingt-quatre positions sur un tour, dont tous les angles ronds —
30, 45, 90. La rotation compte ses crans **depuis l'endroit où elle a commencé**, pas depuis zéro.

### Douceur des ombres

**Choix. Départ : Douce.**

Le grain du bord d'une ombre.

| Valeur | Effet |
|---|---|
| **Dure** | un bord net, découpé au couteau — c'est le moins coûteux |
| **Douce** | un bord adouci, plus proche de la réalité |

**Ce réglage dit à quoi ressemble une ombre, pas qui en projette une.** Cela se décide objet par
objet, dans l'Inspecteur — voir [Espace 3D](09-espace-3d.md).

### Finesse des ombres

**Choix : 512, 1024, 2048 ou 4096. Départ : 2048.**

La taille, en pixels de côté, de la carte que chaque lumière calcule pour savoir ce qu'elle
éclaire.

Plus le nombre est grand, plus le bord de l'ombre est précis — et **plus il coûte cher** :
doubler ce nombre **quadruple** la mémoire utilisée. 2048 est le bon compromis ; descendez à 1024
si une scène chargée commence à ramer, montez à 4096 pour une image finale.

---

## Raccourcis

*Les touches qui déclenchent chaque action. Cliquez sur une touche pour la remplacer.*

Cette section a son chapitre : [Tous les raccourcis](15-raccourcis.md).

---

## Médias

*Préparation des fichiers importés : proxies et waveforms.*

### Chemin de ffmpeg

**Chemin de fichier. Départ : vide.**

**ffmpeg** est le programme qui sait lire et convertir à peu près tous les formats vidéo et audio
du monde. Le studio s'en sert pour deux choses, à l'import :

1. **le proxy** — une copie allégée de la vidéo, qui permet de naviguer dans la timeline sans
   à-coups ;
2. **la waveform** — le dessin de la bande son, ces vagues qui permettent de voir où quelqu'un
   parle.

> **Le studio porte le sien**, sur macOS, Windows et Linux. Vous n'avez rien à installer, et ce
> réglage ne sert que si vous tenez à en utiliser un autre.

**Laissez donc ce champ vide**, sauf raison précise. Le studio essaie les trois dans cet ordre :

1. le ffmpeg **livré avec l'application** ;
2. celui que vous indiquez ici ;
3. celui qui se trouve sur le `PATH` de votre système.

Sous le champ, le studio dit ce qu'il a retenu :

| Message | Ce qu'il veut dire |
|---|---|
| « ffmpeg est disponible : proxies et waveforms seront préparés. » | tout va bien — le cas normal |
| « ffmpeg reste introuvable. L'import fonctionne, sans proxy ni waveform. » | même celui de l'application manque : voir plus bas |

**Le second message est devenu rare.** Il n'arrive plus guère qu'à qui lance le studio depuis son
code source sans avoir exécuté `pnpm ffmpeg:fetch`, qui télécharge les binaires.

> **Même là, l'import fonctionne.** Vos fichiers entrent dans le projet, se lisent et se montent.
> C'est simplement moins confortable. Le studio ne vous bloque jamais sur l'absence d'un outil
> facultatif.

Le bouton **Parcourir…** ouvre le sélecteur de fichiers de votre système.

---

## Stockage

*Où vos projets sont rangés sur le disque.*

### Dossier des projets

**Chemin de dossier. Départ : vide.**

Le dossier que l'application **vous propose** quand vous créez ou ouvrez un projet.

Cela ne déplace **rien** : les projets déjà créés restent exactement où ils sont. C'est une
suggestion de départ pour le sélecteur de fichiers, pas un déménagement.

Laissez vide pour repartir à chaque fois du dernier endroit visité.

---

## Avancé

*Ce dont on n'a besoin que pour comprendre un problème, ou pour repartir de zéro.*

### Détail du journal

**Choix. Départ : Tout.**

Combien l'application raconte ce qu'elle fait, dans son journal.

| Valeur | Ce qui est écrit |
|---|---|
| **Rien** | plus rien du tout |
| **Erreurs seulement** | ce qui a échoué |
| **Erreurs et avertissements** | et ce qui a failli échouer |
| **Tout** *(départ)* | chaque étape |

« Tout » est utile pour comprendre un problème, et bavard le reste du temps. Ce réglage ne change
rien à ce que fait le logiciel — seulement à ce qu'il en dit.

### Fichier de réglages

**Bouton : Montrer.**

Ouvre votre gestionnaire de fichiers sur l'endroit où vos réglages sont enregistrés, un fichier
nommé `settings.json`.

| Système | Où |
|---|---|
| macOS | `~/Library/Application Support/Scenario Studio/settings.json` |
| Windows | `%APPDATA%\Scenario Studio\settings.json` |
| Linux | `~/.config/Scenario Studio/settings.json` |

Utile pour en faire une copie avant de changer de machine, ou pour l'envoyer à quelqu'un qui vous
aide à comprendre un problème.

> **Vos identifiants API sont dans ce fichier, mais chiffrés.** Ils y figurent sous forme d'un
> bloc illisible, que seul le trousseau de **votre** session peut déchiffrer. Copier ce fichier
> sur une autre machine y recopie vos réglages, mais **pas** votre connexion : il faudra retaper
> la clé et le secret.

### Outils de développement

**Bouton : Ouvrir.**

Ouvre la console technique du navigateur intégré : les messages du journal, les erreurs, l'état
interne de l'affichage.

Réservé au dépannage. **Rien de ce qui s'y trouve n'est nécessaire pour se servir du logiciel** —
et rien de ce qu'on y tape n'est prévu pour l'être.

### Tout réinitialiser

**Bouton : Réinitialiser.** *(avec confirmation)*

Remet **TOUS** les réglages dans l'état d'une installation neuve : thème, langue, raccourcis,
modèles par défaut, tout.

Le studio demande d'abord confirmation :

> *Remettre tous les réglages à zéro ? Vos projets ne sont pas touchés, mais ce retour en arrière
> est définitif.*

**Vos projets, vos images et vos montages ne sont pas touchés.** Seuls les réglages le sont.

> **C'est sans retour.** Ce bouton ne passe pas par le tampon d'édition : il n'y a pas d'**Annuler**
> qui le rattrape. C'est pour cette raison qu'il demande confirmation, contrairement aux autres
> réglages.

---

## Tableau de bord : toutes les valeurs de départ

Ce que vous avez sur une installation neuve, d'un coup d'œil.

| Section | Réglage | Départ | Limites |
|---|---|---|---|
| Général | Langue | Système | Système, Français, English |
| Général | À l'ouverture | Rouvrir le dernier projet | — |
| Apparence | Thème | Sombre | Sombre, Clair, Système |
| Apparence | Densité | Confort | Confort, Compact |
| Apparence | Couleur d'accent | celle du thème | — |
| Apparence | Taille du texte | 1 | 0,85 à 1,40 |
| Apparence | Limiter les animations | décochée | — |
| Génération | Générations simultanées | 3 | 1 à 16 |
| Génération | Tentatives maximum | 4 | 0 à 10 |
| Génération | Modèle par défaut ×5 | Demander à chaque fois | — |
| 3D | Afficher la grille | cochée | — |
| 3D | Taille de la grille | 20 m | 2 à 500 |
| 3D | Vitesse de déplacement | 4 m/s | 0,5 à 20 |
| 3D | Accélération | 3× | 1 à 10 |
| 3D | Angle de vue | 60° | 30 à 100 |
| 3D | Pas de déplacement | 0,5 m | 0,1 à 10 |
| 3D | Pas de rotation | 15° | 1 à 90 |
| 3D | Pas d'échelle | 0,1 | 0,05 à 1 |
| 3D | Douceur des ombres | Douce | Dure ou Douce |
| 3D | Finesse des ombres | 2048 | 512, 1024, 2048, 4096 |
| Médias | Chemin de ffmpeg | vide | — |
| Stockage | Dossier des projets | vide | — |
| Avancé | Détail du journal | Tout | Rien → Tout |

---

## Deux réglages qui n'existent pas encore

Deux valeurs vivent dans le fichier de réglages sans qu'aucun contrôle ne les édite :

- **le dernier projet ouvert** — écrit tout seul à chaque ouverture. C'est de la mémoire de
  session, pas une préférence : rien à régler ;
- **l'emplacement des assets** — un choix entre « sur votre disque » et « dans le nuage ». Le
  second n'existe pas encore, et offrir un choix qui ne mène nulle part serait une promesse que le
  logiciel ne peut pas tenir. Voir [Ce qui n'existe pas encore](18-limites.md).

---

[← Espace Skyboxes](13-espace-skyboxes.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Tous les raccourcis →](15-raccourcis.md)
