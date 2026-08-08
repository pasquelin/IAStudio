# 16. Quand ça coince

[← Tous les raccourcis](15-raccourcis.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Glossaire →](17-glossaire.md)

Chaque message que le studio peut afficher, ce qu'il veut dire, et quoi faire.

---

## D'abord : la plupart des messages ne sont pas des erreurs

Le studio écrit beaucoup de phrases dans des panneaux vides. **Ce ne sont pas des pannes** : ce
sont des panneaux qui vous disent ce qu'il leur manque pour se remplir.

| Ce que vous lisez | Ce que ça veut dire |
|---|---|
| « Aucun projet ouvert » | il faut créer ou ouvrir un projet (`⌘N` / `⌘O`) |
| « Aucun document ouvert. Générez ou ouvrez un asset pour commencer. » | le centre de la fenêtre attend un premier onglet |
| « Aucun asset. Générez quelque chose pour commencer. » | l'étagère du projet est encore vide |
| « Aucune tâche en cours. » | rien ne travaille en ce moment — la liste des générations est vide |
| « Ouvrez un projet pour générer. » | le formulaire attend un projet où déposer le résultat |
| « Ouvrez un projet pour voir ses assets. » | idem, pour l'étagère |
| « Ouvrez une scène pour voir son contenu. » | l'explorateur attend une scène 3D |
| « L'explorateur suit une scène 3D. Ouvrez l'espace 3D pour en voir le contenu. » | vous êtes dans un autre espace ; ce panneau ne sert qu'en 3D |
| « Aucun modèle choisi » / « Choisissez-en un dans la liste » | le panneau Génération attend qu'un modèle soit sélectionné |
| « Ce modèle n'attend aucun paramètre. » | c'est normal : certains modèles ne prennent qu'un prompt |
| « Aucun résultat pour ce filtre. » | votre recherche ne trouve rien ; élargissez-la |
| « Aucun réglage ne correspond à cette recherche. » | idem, dans la fenêtre des réglages |
| « Aucune action n'utilise cette touche : elle est libre. » | vous pouvez lui attribuer un raccourci |
| « Ce document n'est plus ouvert. » | l'onglet a été fermé entre-temps |
| « Aucun modèle dans cet espace. » | le catalogue est bien là, mais aucun modèle ne correspond à cet espace |
| « Ouvrez une image pour voir ses calques. » | le panneau Calques attend un document image |
| « Aucune maille. Ajoutez-en une pour commencer. » | la scène 3D est vide — le bouton **+** en pose une |
| « Ouvrez une scène pour voir ses mailles. » | le panneau Mailles attend une scène 3D |
| « Aucune lumière. La scène restera noire. » | il faut au moins une lumière pour voir quelque chose |
| « Ouvrez une scène pour voir ses lumières. » | idem, pour le panneau Lumières |
| « Ouvrez une scène pour inspecter ce qu'elle contient. » | l'Inspecteur attend une scène 3D |
| « Sélectionnez un objet pour voir ses propriétés. » | la scène est là, rien n'est sélectionné |
| « Sélectionnez un élément pour voir ses propriétés. » | la même chose, hors de la 3D |
| « Sélectionnez un clip pour le voir ici. » | le moniteur Source attend une sélection |
| « Aucune séquence ouverte. Créez-en une pour monter. » | la timeline attend un document séquence — bouton **+** |
| « Ouvrez une skybox pour la régler. » | le panneau Skybox attend un document ciel |

Aucune de ces phrases ne demande d'action de dépannage. Le reste du chapitre parle des vraies
pannes.

---

## Les messages de connexion

Ils apparaissent en rouge sous les champs de la section **Compte** des réglages, ou dans le
panneau **Modèles** quand il ne peut rien afficher.

### « Aucun identifiant enregistré. »

**Ce que ça veut dire.** Aucun compte n'est enregistré, ou celui qui l'est a été supprimé.

**Quoi faire.** Réglages (`⌘,`) → **Compte** → donnez un nom, collez votre clé et votre secret →
**Ajouter un compte**. Ils se prennent sur [app.scenario.com](https://app.scenario.com).

### « Le trousseau n'a pas rendu vos comptes. Réessayez après l'avoir déverrouillé — rien n'a été modifié. »

**Ce que ça veut dire.** Le coffre-fort de votre système est verrouillé, et le studio n'a pas pu
relire la liste de vos comptes.

**Ce qui compte le plus dans cette phrase, c'est la fin.** Le studio a **refusé d'écrire** plutôt
que d'écrire à moitié : sans pouvoir relire la liste existante, enregistrer un compte l'aurait
remplacée par lui seul. Vos autres comptes sont intacts.

**Quoi faire.** Déverrouillez votre trousseau — sur macOS, ouvrez « Trousseaux d'accès » et
authentifiez-vous ; sur Linux, déverrouillez le trousseau du bureau — puis recommencez.

### « Renseignez vos identifiants API pour voir vos modèles. »

La même chose, dite par le panneau **Modèles**. Le catalogue vient du service : sans compte
branché, il n'y a rien à lister.

### « Clé ou secret API invalide. »

**Ce que ça veut dire.** Le service a répondu que ce couple ne lui dit rien.

**Quoi faire, dans l'ordre :**

1. **vérifiez qu'il n'y a pas d'espace** collé au début ou à la fin de ce que vous avez copié.
   C'est de très loin la cause la plus fréquente ;
2. **vérifiez que vous n'avez pas inversé** la clé et le secret ;
3. **regénérez le couple** sur [app.scenario.com](https://app.scenario.com) et recollez-le.

> **Ce message ne se répare pas tout seul.** Le studio ne réessaie **jamais** une clé invalide,
> quel que soit le réglage « Tentatives maximum » : réessayer ne la corrigerait pas, cela ne ferait
> que retarder ce message.

### « Cette clé API n'a pas les droits requis. »

**Ce que ça veut dire.** La clé est valide, mais elle n'a pas le droit de faire ce que vous venez
de demander — ou votre plan ne le couvre pas.

**Quoi faire.** Vérifiez sur [app.scenario.com](https://app.scenario.com) les permissions de la
clé et l'état de votre abonnement. Une clé restreinte à la lecture, par exemple, peut lister des
modèles sans pouvoir lancer une génération.

### « Impossible de joindre Scenario. Vérifiez votre connexion. »

**Ce que ça veut dire.** La demande n'est jamais arrivée. Ce n'est pas un refus du service, c'est
le trajet qui a échoué.

**Quoi faire :**

1. vérifiez que vous avez bien Internet ;
2. si vous êtes derrière un pare-feu d'entreprise ou un VPN, essayez sans ;
3. réessayez : le studio le fait déjà tout seul (voir plus bas), mais une coupure longue épuise
   ses tentatives.

### « Le service Scenario est momentanément indisponible. »

**Ce que ça veut dire.** Le service a répondu, mais pour dire qu'il a un problème de son côté.
Cela ne vient pas de vous.

**Quoi faire.** Attendre. Le studio réessaie tout seul, en espaçant ses tentatives. Si cela dure,
allez voir [status.scenario.com](https://status.scenario.com) ou le support de Scenario.

### « Ressource introuvable. »

**Ce que ça veut dire.** Le studio a demandé quelque chose de précis — un modèle, un asset — qui
n'existe plus, ou qui n'est pas accessible à votre compte.

**Quoi faire.** Le cas courant est un modèle retiré du catalogue depuis que vous l'aviez choisi.
Rafraîchissez le panneau **Modèles** et prenez-en un autre.

### « Une erreur inattendue est survenue. »

**Ce que ça veut dire.** Quelque chose a échoué d'une façon que le studio n'a pas su nommer.

**Quoi faire.** Réessayez une fois. Si cela recommence, passez le **Détail du journal** sur
« Tout » (Réglages → Avancé), refaites le geste, et ouvrez les **Outils de développement** pour
lire ce qui est écrit. C'est la seule situation où ce bouton sert à quelque chose.

> **Aucun message d'erreur du service ne vous est montré tel quel.** Le studio les traduit tous en
> une de ces phrases. Ce n'est pas de la paresse : un message d'erreur brut contient la requête qui
> l'a produite, donc l'en-tête d'authentification, donc **votre clé API**. Elle ne doit jamais
> arriver jusqu'à l'écran, où elle finirait dans une capture d'écran envoyée à un forum.

---

## Les messages de génération

Ils apparaissent sur la ligne de la tâche, dans la liste qu'ouvre le résumé des générations, en bas
à droite de la fenêtre.

### « Trop de requêtes. Nouvelle tentative en cours… »

**Ce que ça veut dire.** Vous en avez demandé plus que ce que le service accepte sur un court
laps de temps.

**Ce que le studio fait tout seul.** Il attend, puis réessaie — en doublant l'attente à chaque
fois : 1 seconde, puis 2, puis 4, puis 8. C'est ce qu'on appelle une **temporisation
exponentielle**, et c'est la bonne façon de se comporter : réessayer tout de suite, en boucle,
aggrave l'encombrement au lieu de le résoudre.

**Ce que vous pouvez faire.** Si cela revient souvent, baissez **Générations simultanées** dans
les réglages. Trois est la valeur de départ ; deux suffit largement pour travailler
confortablement.

### « La génération a échoué. »

**Ce que ça veut dire.** Le service a bien reçu la demande, l'a traitée, et a rendu un échec. Ce
n'est ni un problème de réseau, ni un problème de compte.

**Les causes ordinaires :**

- **un paramètre refusé** — une dimension que ce modèle n'accepte pas, une valeur hors de ses
  bornes ;
- **un prompt refusé** — le service applique ses propres règles de contenu ;
- **une image d'entrée inutilisable** — trop grande, trop petite, dans un format que le modèle ne
  prend pas.

**Quoi faire.** Repartez du formulaire : remettez les paramètres à leurs valeurs par défaut (le
petit bouton de restauration à côté de chacun), et relancez. Si cela passe, réintroduisez vos
valeurs une par une pour trouver celle qui bloquait.

> **Ce message n'est jamais réessayé automatiquement.** Une demande refusée le sera à l'identique
> la fois d'après : seul un changement de votre part peut la faire passer.

### « Impossible d'enregistrer le résultat sur le disque. »

**Ce que ça veut dire.** La génération a **réussi** — l'image existe — mais le studio n'a pas pu
l'écrire dans votre projet.

**Les causes ordinaires :**

- **le disque est plein** ;
- **le dossier du projet a été déplacé, renommé ou supprimé** pendant que la tâche travaillait ;
- **le dossier est en lecture seule**, ou sur un disque réseau qui s'est démonté ;
- **le projet est dans un dossier synchronisé** (iCloud, Dropbox, OneDrive) qui a repris la main
  sur le fichier au mauvais moment.

**Quoi faire.** Libérez de la place, vérifiez que le dossier du projet est bien là où il était, et
relancez la génération.

> **Un projet dans un dossier synchronisé est une source d'ennuis.** Ces services déplacent et
> ré-écrivent les fichiers pendant que vous travaillez. Préférez un dossier local, et sauvegardez
> autrement.

### Quelles erreurs sont réessayées, et lesquelles ne le sont pas

Le studio ne réessaie que **ce qu'un nouvel essai peut réparer**.

| Message | Réessayé ? |
|---|---|
| Trop de requêtes | **oui** |
| Service indisponible | **oui** |
| Impossible de joindre Scenario | **oui** |
| Clé ou secret invalide | non |
| Droits insuffisants | non |
| Ressource introuvable | non |
| La génération a échoué | non |
| Enregistrement impossible | non |
| Erreur inattendue | non |

Le nombre de tentatives est réglable : Réglages → **Génération** → **Tentatives maximum**
(4 par défaut, 0 à 10).

---

## Les messages d'import

Ils apparaissent pendant qu'un fichier que vous avez glissé dans le projet est préparé.

### Les étapes normales

| Ce que vous lisez | Ce qui se passe |
|---|---|
| **En attente…** | le fichier fait la queue |
| **Analyse…** | le studio lit sa durée, sa taille, son format |
| **Empreinte…** | il calcule sa signature, pour reconnaître un doublon |
| **Proxy…** | il fabrique la copie allégée qui rend la navigation fluide |
| **Waveform…** | il dessine la bande son |
| **Prêt** | c'est fini, le fichier est utilisable |

Le bouton **Interrompre la préparation** arrête le travail en cours. **Retirer de la liste**
enlève la ligne une fois qu'elle est finie.

### « Préparation vidéo indisponible : ni copie allégée ni forme d'onde. »

**Ce que ça veut dire.** Aucun ffmpeg utilisable n'a été trouvé — pas même celui que
l'application transporte.

**Ce qui marche quand même.** L'import lui-même. Votre fichier est dans le projet, il se lit, il
se monte.

**Ce qui manque.** La navigation dans la timeline saccade sur les gros fichiers (pas de copie
allégée), et les pistes audio n'affichent pas leurs vagues.

**Quoi faire.** Le studio livre son propre ffmpeg sur les trois systèmes, donc ce message ne
devrait pas apparaître sur une application installée normalement. S'il apparaît quand même :

1. **vous avez lancé le studio depuis son code source** — exécutez `pnpm ffmpeg:fetch`, qui
   télécharge les binaires manquants ;
2. **vous avez indiqué un chemin à vous** dans Réglages → **Médias** → **Chemin de ffmpeg**, et il
   ne répond pas — videz le champ pour revenir à celui de l'application ;
3. **sinon**, s'en passer reste parfaitement viable sur des fichiers courts ou légers.

#### Le cas déroutant : ffmpeg est là, et le studio dit qu'il n'y est pas

Vous tapez `which ffmpeg` dans un terminal, il répond un chemin. Le fichier existe. Et le studio
continue d'afficher que la préparation vidéo est indisponible.

**Ce n'est pas une contradiction.** Le studio ne se contente pas de *trouver* le programme : il le
**lance**, avec `ffmpeg -version`, et n'accepte que celui qui répond. Un ffmpeg installé par
Homebrew dont une bibliothèque a disparu — après une mise à jour de macOS, ou un
`brew cleanup` un peu large — existe toujours en tant que fichier, mais ne démarre plus.

Un programme qu'on trouve sans pouvoir l'exécuter serait pire qu'un programme absent : le studio
promettrait des proxies qu'il ne saurait pas fabriquer.

**Pour le vérifier vous-même**, dans un terminal :

```bash
ffmpeg -version
```

Si cette commande affiche un numéro de version, ffmpeg va bien. Si elle se plaint d'une
bibliothèque manquante, c'est le diagnostic.

**Pour le réparer**, sur macOS :

```bash
brew reinstall ffmpeg
```

### « Déjà dans le projet »

**Ce que ça veut dire.** Ce fichier a la même empreinte qu'un asset déjà présent. Le studio
refuse d'en garder deux copies.

**Ce n'est pas une erreur.** Cherchez-le dans le panneau **Assets** : il y est déjà.

### « Fichier illisible »

**Ce que ça veut dire.** Le studio n'arrive pas à ouvrir ce fichier.

**Les causes ordinaires :** un fichier tronqué (téléchargement interrompu), une extension qui ment
sur le contenu, un format exotique, ou un fichier protégé par des droits numériques.

**Quoi faire.** Ouvrez-le dans un autre lecteur pour vérifier qu'il est sain. S'il l'est,
convertissez-le dans un format courant (`.mp4`, `.wav`, `.png`).

### « Échec » / « Interrompu »

**Échec** : la préparation s'est arrêtée sur un problème. **Interrompu** : vous l'avez arrêtée
vous-même. Dans les deux cas, le fichier peut être réimporté.

---

## Les ennuis qui n'affichent aucun message

Ceux-là sont les plus déroutants : rien ne s'écrit, mais quelque chose ne va pas.

### « Je double-clique sur un asset et rien ne se passe »

**C'est de loin le plus fréquent.** Et ce n'est ni un bug, ni un fichier abîmé.

**La cause.** Le double-clic **n'ouvre jamais d'onglet** : il envoie l'asset dans l'onglet déjà
en avant. S'il n'y a aucun onglet ouvert, ou si l'onglet en avant ne sait pas quoi faire de ce
que vous lui envoyez, il ne se passe rien — et rien ne le dit.

| Vous double-cliquez… | Il faut, devant vous… |
|---|---|
| une image, pour en faire un ciel | un onglet **ciel** ouvert (espace Skyboxes) |
| un son, pour l'éditer | un onglet **son** ouvert (espace Audio) |
| un média, pour le monter | un onglet **séquence** ouvert (espace Vidéo) |
| une image, pour la retoucher | **rien à faire, ce n'est pas possible** — voir plus bas |

**Quoi faire.**

1. Vérifiez l'espace en haut de la fenêtre : êtes-vous dans le bon ?
2. Vérifiez qu'un onglet est bien ouvert — sinon, le bouton `+` du rail gauche en crée un.
3. Alors seulement, double-cliquez.

> **Le cas de l'image est différent.** Aucune image ne peut être ouverte dans l'espace Image :
> cette fonction n'existe pas encore, quel que soit l'onglet devant vous. Voir
> [Ce qui n'existe pas encore](18-limites.md).

### « ⌘Z ne fait rien »

**La cause, presque toujours.** L'action que vous voulez défaire appartient à **un autre onglet**.

Chaque document a sa propre pile d'annulation. `⌘Z` recule dans l'onglet **actif**, pas dans le
dernier geste que vous avez fait dans le studio.

**Quoi faire.** Activez l'onglet concerné, puis annulez.

### « Le canvas est tout noir après avoir détaché un panneau »

**La cause.** Une vue 3D ne survit pas au déplacement d'une fenêtre à l'autre : la carte graphique
lui reprend son contexte de dessin.

**Quoi faire.** Fermez l'onglet et rouvrez-le. La vue se reconstruit à partir de la scène — vous
ne perdez pas votre travail, seulement l'affichage.

### « L'interface se fige quelques secondes pendant une recherche »

**La cause.** Une recherche dans un très gros catalogue.

**Quoi faire.** Attendez ; cela se débloque. Pour l'éviter, tapez plus de lettres avant de lancer
la recherche, ou restreignez avec les filtres.

### « La lecture saccade sans raison »

**Deux causes possibles :**

1. **il n'y a pas de proxy** — voir le message ffmpeg plus haut. C'est le cas le plus fréquent sur
   une vidéo lourde ;
2. **la machine est chargée** — une génération en cours consomme le réseau, et une scène 3D
   ouverte dans un autre onglet consomme la carte graphique.

**Quoi faire.** Fermez les onglets dont vous ne vous servez pas, et vérifiez que ffmpeg est
disponible.

### « Les animations de l'interface saccadent »

Réglages → **Apparence** → cochez **Limiter les animations**. Les panneaux apparaissent d'un coup
au lieu de glisser, ce qui est bien plus agréable qu'un glissement haché.

### « J'ai perdu mon travail en fermant un onglet »

**La cause.** Tous les documents ne savent pas encore s'enregistrer.

Aujourd'hui, seules les **scènes 3D** (`.scene`) et les **matières** (`.tex`) s'écrivent sur le
disque. Une image en cours de retouche, un montage vidéo, un son édité, un ciel réglé : tout cela
vit dans la fenêtre et **disparaît avec l'onglet**.

**Quoi faire.** En attendant que ce soit corrigé : ne fermez pas l'onglet tant que le travail
compte, et notez vos réglages importants (la graine, le prompt) ailleurs. La liste complète est
dans [Ce qui n'existe pas encore](18-limites.md).

### « Les panneaux sont dans tous les sens et je ne m'y retrouve plus »

Menu **Affichage** → **Réinitialiser la disposition**. Les panneaux reprennent leur place
d'origine. **Votre travail n'est pas touché** — seul l'agencement de la fenêtre l'est.

### « Le studio ne se souvient pas de mes réglages »

**La cause probable.** Vous avez fermé la fenêtre des réglages sans **Appliquer**, et choisi
« Ne pas appliquer » à la question posée.

**Quoi faire.** Recommencez, et terminez par **Appliquer** ou **OK**.

### « Rien ne se passe quand je clique sur Générer »

Trois vérifications, dans cet ordre :

1. **un projet est-il ouvert ?** Sinon le formulaire affiche « Ouvrez un projet pour générer. » ;
2. **un modèle est-il choisi ?** Sinon le panneau affiche « Aucun modèle choisi » ;
3. **êtes-vous connecté ?** Le point du sélecteur de compte, en haut à droite, doit être vert.

---

## Aller plus loin

### Le journal

Réglages → **Avancé** → **Détail du journal**. Passez-le sur « Tout », refaites le geste qui
échoue, puis ouvrez les **Outils de développement** (même section) : les messages s'y affichent.

C'est ce qu'il faut joindre quand vous demandez de l'aide.

### Le fichier de réglages

Réglages → **Avancé** → **Fichier de réglages** → **Montrer**. Il s'ouvre dans votre gestionnaire
de fichiers.

**Vous pouvez le partager sans crainte pour vos identifiants** : ils y sont chiffrés par le
trousseau de votre session, et illisibles ailleurs. Mais vous pouvez aussi préférer ne pas
l'envoyer du tout — il contient tous vos réglages, dont les chemins de vos dossiers.

### Repartir de zéro

Réglages → **Avancé** → **Tout réinitialiser**. Remet tous les réglages dans l'état d'une
installation neuve.

**Vos projets ne sont pas touchés.** Mais l'opération est définitive : il n'y a pas d'annulation.

---

## Le tableau de survie

| Symptôme | Première chose à essayer |
|---|---|
| Le catalogue de modèles est vide | Réglages → Compte → se connecter |
| « Clé ou secret invalide » | chercher un espace en trop dans ce qui a été collé |
| « Trop de requêtes » à répétition | baisser **Générations simultanées** à 2 |
| « La génération a échoué » | remettre les paramètres du modèle par défaut, relancer |
| « Enregistrement impossible » | vérifier la place disque et que le dossier du projet existe |
| Timeline qui saccade | vérifier que la préparation vidéo est disponible, ou raccourcir la vidéo |
| Pas de vagues sur la piste audio | idem |
| « Préparation vidéo indisponible » alors que `which ffmpeg` en trouve un | `ffmpeg -version` : le binaire existe mais ne démarre plus |
| « Le trousseau n'a pas rendu vos comptes » | déverrouiller le trousseau, puis recommencer — rien n'a été perdu |
| Double-clic sur un asset sans effet | ouvrir d'abord un onglet, avec le `+` du rail gauche |
| Double-clic sur un asset sans effet | ouvrir d'abord un onglet, avec le `+` du rail gauche |
| `⌘Z` sans effet | activer le bon onglet |
| Canvas 3D noir | fermer et rouvrir l'onglet |
| Panneaux en désordre | Affichage → Réinitialiser la disposition |
| Travail perdu à la fermeture d'un onglet | seuls `.scene` et `.tex` s'enregistrent — [voir les limites](18-limites.md) |

---

[← Tous les raccourcis](15-raccourcis.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Glossaire →](17-glossaire.md)
