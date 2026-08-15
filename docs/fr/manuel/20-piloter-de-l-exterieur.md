# 20. Piloter le studio depuis l’extérieur

[← Comment faire pour…](19-recettes.md) · [Sommaire](../guide-utilisateur.md)

---

Jusqu’ici, vous avez conduit le studio à la main : un clic, un raccourci, une entrée de menu. Ce
chapitre décrit l’autre façon — **dire ce que vous voulez, et laisser le studio le faire**.

Elle a deux portes, et **elles donnent sur la même pièce** :

| La porte | Où elle est | Qui parle |
|---|---|---|
| **L’assistant** | dans la fenêtre, sur `⌘K` | vous, en français ou en anglais |
| **Le point d’entrée** | fermé au départ, à ouvrir dans les réglages | un programme extérieur, comme Claude Code |

Les deux exécutent **exactement le même catalogue de dix actions**, décrit plus bas. Rien n’est
possible d’un côté qui ne le soit de l’autre, et **rien qui engage quelque chose ne part sans que
vous l’ayez vu à l’écran** — d’où que vienne la demande.

---

## L’assistant

**`⌘K`**, ou **Affichage ▸ Assistant** dans la barre de menus. Une fenêtre s’ouvre par-dessus le
studio, avec un champ, et c’est tout.

Vous y écrivez ce que vous voulez faire, en une phrase ordinaire :

> *Ouvre un nouveau fichier 3D*
> *Cherche un modèle de texture pour de la pierre*
> *Prépare une génération d’image en 1024 par 1024*

L’assistant lit la phrase, choisit une ou plusieurs actions dans le catalogue, et les exécute.
Chaque étape s’affiche dans le fil, avec ce qu’elle a donné.

### Ce que l’assistant peut lire

**Rien de ce que vous n’avez pas écrit.** Il reçoit votre phrase et **les dix derniers échanges**
de la conversation en cours, rendus en texte. Il ne voit ni vos images, ni vos projets, ni le
contenu de vos documents — il connaît le *catalogue* des actions et leurs paramètres, pas ce sur
quoi elles vont s’appliquer.

Une exception, et elle est explicite : **Décrire le style des références** lit les images de
référence déjà posées sur le formulaire du Générateur. C’est le seul endroit où l’assistant
regarde une image, et il faut l’avoir demandé.

### Choisir le modèle qui vous lit

Le sélecteur est **dans la fenêtre de l’assistant**, pas dans les réglages — le moment où l’on veut
un modèle plus solide, c’est au milieu d’une phrase qui n’a pas été comprise.

| Modèle | Ce qu’il vaut |
|---|---|
| **Haiku 4.5** *(départ)* | le plus rapide et le moins cher |
| **Sonnet 4.6** | l’équilibre |
| **Opus 4.8** | le plus fiable sur une demande en plusieurs étapes |
| **Gemini 3.5 Flash** | l’alternative rapide |

Le moins cher suffit pour ouvrir un espace ou chercher un modèle. Les autres tiennent mieux une
demande qui enchaîne trois ou quatre actions.

> **Il n’y a ni second compte, ni seconde clé à saisir.** L’assistant réfléchit sur un modèle du
> catalogue Scenario, avec la connexion que vous avez déjà. C’est aussi pour cette raison que
> **réfléchir se paie** — voir juste en dessous.

### Ce que ça coûte

**Réfléchir consomme des unités créatives.** Pas beaucoup, mais ce n’est pas gratuit, et c’est
distinct de ce que coûtera la génération que l’assistant prépare.

**La fenêtre affiche le cumul de la conversation en cours**, en bas.

**Fermer la fenêtre ne le remet pas à zéro**, et n’efface pas le fil : rouvrir l’assistant retrouve
les deux, là où vous les aviez laissés. Le compteur court **jusqu’à ce que vous quittiez le
studio**.

> **Ce cumul ne compte que la réflexion.** Ce qu’une génération coûte est rapporté ailleurs — la
> barre des tâches et le chapitre [Générer](06-generer.md) s’en chargent. Les deux ne se
> confondent pas, et l’assistant n’en lance aucune sans vous le demander.

### La dictée y fonctionne

Le micro à côté du champ est le même que partout ailleurs, avec les mêmes réglages
([chapitre 14](14-reglages.md#dictée)). Parler à l’assistant plutôt que lui écrire ne change rien
à ce qu’il fait de la phrase.

---

## Le point d’entrée pour un programme extérieur

C’est la seconde porte : **un autre logiciel installé sur votre machine peut lancer les mêmes dix
actions**. Un assistant de programmation comme Claude Code, par exemple, ou tout client parlant le
protocole **MCP**.

**Cette porte est fermée au départ, et le reste tant que vous ne l’ouvrez pas.**

### Ce qui la garde

Quatre choses, et il faut les quatre pour qu’une demande passe :

| Le verrou | Ce qu’il empêche |
|---|---|
| **Fermée par défaut** | rien n’écoute sur une installation neuve |
| **Sur cette machine seule** | le point d’entrée n’écoute que `127.0.0.1` : rien du réseau ne l’atteint, ni le Wi-Fi de la maison, ni celui du bureau |
| **Un jeton neuf à chaque démarrage** | une demande sans le jeton du lancement en cours est refusée |
| **Aucune page web** | une demande venue d’un site ouvert dans votre navigateur est refusée sur ce seul motif |

> **Et par-dessus les quatre, le cinquième, qui est vous.** Tout ce qui dépense ou téléverse
> s’affiche à l’écran et attend votre accord, exactement comme si vous l’aviez demandé vous-même.
> Un programme extérieur ne peut pas se le donner à votre place.

### L’ouvrir

**Réglages ▸ Avancé ▸ Piloter le studio depuis l’extérieur.** Cochez la case ; le point d’entrée
démarre aussitôt. Décochez-la, il s’arrête et **plus rien n’écoute**.

---

## Brancher Claude Code

C’est le cas le plus courant, et il tient en trois gestes.

### 1. Ouvrir la porte

**Réglages ▸ Avancé**, cochez **Piloter le studio depuis l’extérieur**.

### 2. Copier la ligne de connexion

Juste en dessous, **Commande de connexion ▸ Copier**. Le studio met dans votre presse-papiers une
ligne de cette forme :

```
claude mcp add --transport http <nom> http://127.0.0.1:54321/mcp --header "Authorization: Bearer …"
```

Le nombre après `127.0.0.1:` et le jeton après `Bearer` **sont les vôtres, et ceux de ce
lancement-ci**. Ils ne sont pas dans ce manuel parce qu’ils ne peuvent pas y être : ils changent.

### 3. Coller dans un terminal

Ouvrez un terminal **dans le dossier du projet où vous travaillez avec Claude Code**, et collez la
ligne. C’est tout : Claude Code connaît désormais le studio, et voit ses dix outils.

Pour vérifier, demandez-lui la liste de ses serveurs MCP — le studio doit y figurer, connecté.

### Ce qu’il faut refaire à chaque lancement

**Le port et le jeton changent à chaque démarrage du studio.** La ligne copiée hier ne vaut plus
aujourd’hui : le client s’adresse à un port où plus rien n’écoute, ou présente un jeton périmé.

**Le geste est donc à refaire après chaque lancement** : recopier la commande, et la recoller. Un
client déjà enregistré sous le même nom se remplace ; il n’y a rien à supprimer avant.

> **C’est le prix des deux verrous du milieu**, et c’est délibéré. Un port fixe et un jeton
> permanent tiendraient tout seuls d’une session à l’autre — et tiendraient aussi pour n’importe
> quel programme ayant lu ce fichier une fois.

### Ce que vous pouvez lui demander

Une fois branché, Claude Code parle au studio comme vous parleriez à l’assistant, mais depuis
votre projet de code :

> *Ouvre l’espace 3D dans le studio et crée un document*
> *Cherche-moi un modèle de skybox nocturne*
> *Liste les générations en cours*
> *Prépare une génération d’image avec ce prompt, mais ne l’envoie pas*

**La dernière phrase mérite d’être lue deux fois.** Préparer et envoyer sont **deux actions
distinctes**, et seule la seconde dépense. Un client extérieur peut remplir le formulaire autant
qu’il veut : tant que **Lancer la génération préparée** n’a pas reçu votre accord à l’écran, rien
n’est parti.

---

## Les dix actions

Le même catalogue des deux côtés. La colonne de droite dit ce que l’action **engage** — c’est elle
qui décide si le studio vous demandera quelque chose.

| Action | Ce qu’elle fait | Ce qu’elle engage |
|---|---|---|
| **Lancer une commande** | déclenche une commande du studio par son identifiant, comme un raccourci le ferait | **rien**, sauf cinq exceptions ci-dessous |
| **Ouvrir un espace** | bascule vers un espace de travail, et y crée un document si on le demande | rien |
| **Chercher un modèle** | cherche un modèle de génération par mots-clés | rien |
| **Choisir un modèle** | arme un modèle pour une famille ; le formulaire se reconstruit dessus | rien |
| **Préparer une génération** | remplit le formulaire du Générateur et l’affiche | rien — **et surtout, n’envoie pas** |
| **Lancer la génération préparée** | envoie le formulaire tel qu’il est affiché | **des unités créatives** |
| **Lister les tâches** | rend les générations en cours et leur avancement | rien |
| **Proposer des variantes de prompt** | réécrit une phrase en plusieurs variantes taillées pour le modèle armé | rien |
| **Traduire un prompt en anglais** | porte un texte dans la langue sur laquelle les modèles sont entraînés | rien |
| **Décrire le style des références** | lit les images de référence du formulaire et en rend une description | rien |

### Les cinq commandes qui font exception

**Lancer une commande** n’engage rien — sauf quand la commande visée est l’une de ces cinq :

| Commande | Ce qu’elle fait de votre image |
|---|---|
| **Régénérer la zone** | l’aplatit et la téléverse |
| **Détourer** | idem |
| **Agrandir** | idem |
| **Vectoriser** | idem |
| **Étendre** | idem |

Toutes les cinq **téléversent l’image du canevas**, qui devient alors un asset permanent de votre
bibliothèque. Elles ne coûtent aucune unité créative — elles préparent seulement le formulaire —
mais elles laissent quelque chose derrière elles, et c’est ce qui leur vaut de vous être
demandées.

---

## Ce que le studio vous demande, et quand

Deux questions seulement, toutes deux à l’écran, dans la fenêtre au premier plan.

**Quand une action va dépenser :**

> *Cette action va dépenser 12 unités créatives.*

Le montant est **estimé avant** d’être engagé. Quand le studio ne parvient pas à l’estimer, il le
dit plutôt que d’inventer un chiffre :

> *Cette action va dépenser des unités créatives. Le studio n’a pas pu en estimer le montant, et
> n’en invente pas.*

**Quand une action va téléverser :**

> *Cette action va téléverser une image, qui restera dans votre bibliothèque. Elle ne coûte aucune
> unité créative.*

Dans les deux cas, deux boutons : **Autoriser** et **Refuser**. Refuser n’exécute rien, et
l’assistant en tient compte pour la suite de sa demande.

> **La question ne se contourne pas.** Ni `Échap`, ni un clic à côté ne la referment : une action
> attend la réponse, et la faire disparaître la laisserait attendre indéfiniment. Il faut
> répondre.

**Vous avez deux minutes.** Passé ce délai la demande est abandonnée, et le programme qui l’avait
formulée reçoit un refus plutôt que d’attendre. C’est le temps de lire « cela va dépenser 12
unités » et de décider — pas un délai réseau.

---

## Quand ça refuse

Une action refusée dit toujours pourquoi. Les motifs, et ce qu’ils veulent dire :

| Le message | Ce qui s’est passé |
|---|---|
| *Cette commande n’existe pas dans le studio.* | l’identifiant demandé ne correspond à rien |
| *Cette commande appartient au menu de l’application, qui la déclenche lui-même.* | certaines commandes ne sont pas à prendre par ce chemin |
| *Cette commande s’adresse à un document qui n’est pas au premier plan.* | mettez le bon onglet devant, et redemandez |
| *Le Générateur n’était pas ouvert. Il vient de l’être.* | rien n’a échoué : redemandez la même chose |
| *Le Générateur n’a aucun modèle armé pour l’instant.* | choisissez un modèle avant de préparer |
| *La génération n’est pas partie.* | l’envoi a échoué en aval — rien n’a été dépensé |
| *Les paramètres fournis ne conviennent pas à cette action.* | ce qui a été transmis ne correspond pas aux champs attendus |
| *Le studio ne répond pas.* | la fenêtre n’a pas pu être jointe |
| *Cette action demande un accord, et aucune fenêtre n’était là pour le donner.* | jamais un oui silencieux : sans écran, c’est non |
| *Vous avez refusé cette action.* | c’est vous |
| *Aucune fenêtre du studio n’était au premier plan pour exécuter cette action.* | le studio tourne sans fenêtre devant : ouvrez-en une |
| *La demande est restée à l’écran sans réponse, et a été abandonnée.* | les deux minutes sont passées |
| *Le formulaire ne porte aucune image de référence dont lire le style.* | posez une image sur le formulaire d’abord |
| *Le formulaire a changé depuis l’annonce du coût. Rien n’a été envoyé — redemandez pour obtenir un nouveau chiffre.* | ce qui a été chiffré est ce qui part, jamais autre chose |

Les quatre derniers motifs de fenêtre — *aucune fenêtre au premier plan*, *aucune fenêtre pour
donner l’accord* — **ne se rencontrent que depuis un programme extérieur**. L’assistant, lui, est
dans la fenêtre : il y a toujours quelqu’un pour être demandé.

---

## Ce que ce chemin ne fait pas

- **Il n’ouvre pas vos fichiers à qui que ce soit.** Les dix actions conduisent le studio ; aucune
  ne lit un dossier, n’envoie un document, ni ne rend le contenu d’un projet.
- **Il ne remplace pas votre clé API.** Ce qui part vers Scenario part comme d’habitude, avec vos
  identifiants, depuis votre machine.
- **Il ne dépense jamais de lui-même.** Une seule des dix actions dépense, et elle demande.
- **Il ne survit pas à la fermeture.** Le studio fermé, le point d’entrée n’existe plus, et le
  jeton du lancement avec lui.

---

## À côté de ce chapitre

- **[Générer](06-generer.md)** — ce que l’assistant prépare, et ce que coûte de l’envoyer.
- **[Tous les réglages](14-reglages.md)** — la case et le bouton, dans leur section.
- **[Tous les raccourcis](15-raccourcis.md)** — `⌘K` parmi les autres.
- **[Quand ça coince](16-depannage.md)** — quand la porte ne s’ouvre pas.

---

[← Comment faire pour…](19-recettes.md) · [Sommaire](../guide-utilisateur.md)
