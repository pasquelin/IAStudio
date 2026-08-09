# 6. Générer

[← Trouver un modèle](05-modeles.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Les assets →](07-assets.md)

C’est le cœur du studio : vous décrivez, il fabrique.

---

## Le principe, en trois temps

**1. Vous remplissez un formulaire et vous appuyez sur Générer.**

**2. La demande part.** Elle ne revient pas tout de suite. Elle devient une **tâche**, visible
dans le panneau du même nom, avec une barre de progression.

**3. Le résultat arrive** dans le panneau Assets et sur votre disque.

Entre les deux, vous pouvez continuer à travailler, changer d’espace, ouvrir un autre document.
Rien ne bloque.

---

## Le formulaire

Choisissez un modèle dans le panneau **Modèles**, à gauche, puis ouvrez le panneau
**Génération** : son icône vient d’apparaître dans le rail, et le panneau prend la place des
Modèles dans la même moitié de colonne.

**Le formulaire n’est pas écrit à la main.** Il est construit à partir de ce que le modèle
choisi déclare savoir recevoir. Deux modèles n’ont donc pas le même formulaire, et un modèle
publié demain aura, lui aussi, le sien — sans mise à jour du studio.

> Si un modèle propose un réglage que le studio ne sait pas représenter, il apparaît quand même,
> en saisie libre. Un formulaire ne disparaît jamais parce qu’un champ est inconnu.

### Les types de champs que vous rencontrerez

| Ce que vous voyez | Ce que c’est | Ce qu’on y met |
|---|---|---|
| Une **grande zone de texte** | le *prompt* | votre description |
| Une **ligne de texte** | un texte court | un mot, un nom, une valeur |
| Un **nombre** | une quantité | souvent avec un minimum et un maximum |
| Une **case à cocher** | oui ou non | — |
| Un **menu déroulant** | une liste de choix imposés | un format, un style, une taille |
| Un **carré de couleur** | une couleur | un clic ouvre le sélecteur du système |
| Un **nombre avec un dé** 🎲 | la *graine* — voir plus bas | un nombre, ou un clic sur le dé |

Les champs sont **groupés** quand le modèle les groupe, et certains **n’apparaissent que si un
autre a la bonne valeur** — inutile de proposer la force d’un effet quand l’effet est désactivé.

Un champ obligatoire non rempli **empêche l’envoi** : le formulaire le signale plutôt que de
laisser partir une demande que le serveur refuserait.

---

## Le prompt

C’est le champ qui compte. Quelques principes, dans l’ordre d’importance.

### Écrivez en anglais si vous le pouvez

La grande majorité des modèles ont été entraînés sur des descriptions en anglais. Un prompt
français fonctionne parfois, mais moins bien. La grammaire compte peu, les mots comptent beaucoup.

**Vous n’avez pas besoin d’un traducteur ailleurs** : le bouton **Traduire en anglais**, au-dessus
du champ, s’en charge. Voir la section suivante.

### Décrivez ce qui est là

Les modèles comprennent mal la négation. « Sans voiture » a de bonnes chances de faire
apparaître une voiture. Décrivez plutôt la scène telle que vous la voulez : « une rue vide au
petit matin ».

### Allez du sujet au détail

Une structure qui marche presque toujours :

```
[le sujet], [ce qu'il fait ou comment il est], [le décor], [la lumière], [le style]
```

Par exemple :

```
a small red lighthouse, standing on a rocky cliff, calm grey sea behind,
soft morning light, photographic
```

### Soyez concret

| Mou | Précis |
|---|---|
| « quelque chose de joli » | « une clairière au coucher du soleil, brume basse » |
| « un personnage » | « une vieille femme en manteau de laine, de trois quarts » |
| « des couleurs chaudes » | « ocre, rouge brique, or pâle » |

### Un mot par idée, pas dix

Empiler quarante adjectifs ne rend pas l’image quarante fois meilleure. Au-delà d’une trentaine
de mots, la plupart des modèles diluent. Mieux vaut une phrase juste que trois phrases vagues.

---

## Se faire aider pour écrire le prompt

Trois boutons se tiennent au-dessus du champ. Ils ne sont pas là sur tous les formulaires :
**c’est le modèle qui désigne le champ à assister**, et le studio suit. Un modèle qui ne le
signale pas n’affiche pas ces boutons — le studio n’essaie pas de deviner lequel de ses champs
est un prompt.

| Bouton | Ce qu’il fait |
|---|---|
| **Proposer des variantes** | fait réécrire votre brouillon par le modèle qui va le lire |
| **Traduire en anglais** | réécrit votre texte dans la langue sur laquelle les modèles ont appris |
| **Décrire le style des références** | lit les images déjà posées sur le formulaire et écrit ce qu’elles ont en commun |

Pendant le travail, « Rédaction des variantes… » s’affiche et les trois boutons sont inactifs.

### Ce qu’une variante propose, et comment on la prend

Chaque variante apparaît dans son propre encadré, avec jusqu’à trois choses :

- **le texte réécrit**, celui que vous adopterez ;
- **la raison** de la réécriture, en italique, quand le modèle en donne une ;
- **les réglages** qu’elle suggère en plus du texte — un ratio, un nombre d’étapes — listés en
  clair sous la proposition.

Deux boutons, et la différence entre eux compte :

| Bouton | Effet |
|---|---|
| **Utiliser le texte** | remplace le prompt, **et rien d’autre** |
| **Texte + réglages** | remplace le prompt **et** applique les réglages proposés |

**Le second n’apparaît que s’il y a des réglages à appliquer.** Séparer les deux gestes est
délibéré : écraser un ratio que vous venez de choisir n’est pas une décision qu’une suggestion
prend toute seule.

> Les réglages proposés sont **filtrés contre ce que le modèle déclare accepter** avant d’être
> appliqués. Une valeur hors bornes est écartée, jamais ramenée de force dans l’intervalle.

### Les deux refus que vous verrez

| Message | Ce qu’il veut dire |
|---|---|
| « Ce texte est déjà en anglais. » | la traduction n’a rien à faire — le studio vérifie la langue avant d’appeler |
| « Déposez une image de référence pour en décrire le style. » | le formulaire ne porte aucune image à lire |

Ces deux-là ne sont pas des pannes, et rien n’est dépensé quand ils s’affichent.

> **Ces demandes-là sont immédiates**, contrairement à une génération : elles n’entrent pas dans
> la file, ne s’affichent pas dans la ligne d’état, et il n’y a rien à annuler. **Proposer des
> variantes ne coûte aucune unité créative** — c’est mesuré, pas supposé. Pour la traduction et la
> lecture de style, le studio ne mesure rien : traitez-les comme des appels ordinaires.

---

## Les réglages qu’on retrouve souvent

Ils ne sont pas les mêmes partout, mais ces noms reviennent :

| Nom courant | Ce que ça fait | Conseil |
|---|---|---|
| **prompt** | votre description | voir ci-dessus |
| **negative prompt** | ce que vous voulez éviter | court : « blurry, text, watermark » |
| **seed** (*graine*) | le point de départ du hasard | voir ci-dessous |
| **steps** | le nombre d’étapes de calcul | plus haut = plus long, pas forcément mieux |
| **guidance** / **cfg** | à quel point le modèle obéit au prompt | trop haut, l’image devient dure et saturée |
| **width** / **height** | les dimensions | souvent contraintes à des multiples de 8 ou 64 |
| **num images** | combien d’images d’un coup | chacune consomme du crédit |
| **strength** | à quel point une image de départ est transformée | 0 = inchangée, 1 = méconnaissable |

### La graine (*seed*)

Un nombre qui fixe le hasard.

**Deux générations avec le même prompt, le même modèle et la même graine donnent la même
image.** Changez la graine, vous obtenez une variante.

C’est ce qui rend une image **reproductible**. Vous avez obtenu quelque chose de presque bien ?
Gardez la graine, ajustez le prompt : vous explorez autour du même résultat au lieu de repartir
de zéro.

Le **bouton dé** 🎲 à côté du champ tire une nouvelle graine au hasard.

---

## Générer

Le bouton **Générer**, en bas du formulaire.

> **Le bouton ne répond pas ?** Il est inactif tant qu’aucun projet n’est ouvert — le message
> « Ouvrez un projet pour générer. » s’affiche au-dessus du formulaire. Un résultat doit
> atterrir quelque part.

### Le prix, avant de payer

Le bouton porte une estimation : **`~12 UC`**, à côté du mot Générer. C’est ce que la génération
coûterait si vous appuyiez maintenant.

Le chiffre suit le formulaire. Changez la taille, le nombre d’images, le modèle : il se remet à
jour tout seul, une fois que vous avez cessé de taper. Il ne se demande pas tant qu’un champ
obligatoire est vide — sans quoi il n’y aurait aucun prix à donner.

> **Demander le prix ne coûte rien et ne génère rien.** Le studio envoie une demande *à blanc* :
> l’API la chiffre et s’arrête là. Aucune unité créative n’est dépensée, aucun asset n’apparaît.

**Pas de chiffre sur le bouton ?** Trois cas se ressemblent à l’écran, et aucun n’est un
problème : rien n’a encore été demandé, l’API n’a pas voulu chiffrer ce modèle, ou la demande
n’est pas passée. Un prix est une courtoisie ; son absence n’empêche jamais de générer.

> **C’est une estimation, pas une facture.** Ce que vous avez réellement dépensé se lit après
> coup, sur la ligne de la génération, et dans **Aide ▸ Consommation…**.

---

## Suivre ses générations

Elles vivent **dans la ligne d’état**, en bas à droite de la fenêtre — pas dans un panneau.

C’est délibéré. Une génération est plusieurs minutes d’attente que vous passez ailleurs : elle doit
se lire depuis n’importe quel espace de travail, et un panneau ne peut être qu’à un endroit. Là,
elle ne coûte aucune place.

### Le résumé

```
3 générations  ▓▓▓▓▓░░░░░  45 %  ⌃
```

| Élément | Ce qu’il dit |
|---|---|
| **« 3 générations »** | combien travaillent en ce moment |
| **La barre** | leur avancement moyen |
| **Le pourcentage** | le même chiffre, en clair |
| **Le chevron** | un clic ouvre le détail |

**Quand plus rien ne travaille, le résumé disparaît.** Sauf s’il y a eu un échec : « 2 échecs »
reste affiché, parce qu’un échec qui s’effacerait avec la dernière tâche en cours est un échec que
personne n’aurait lu.

### Le détail

Un clic ouvre la liste au-dessus de la ligne d’état. Une ligne par génération, avec le nom du
modèle et son état.

| État | Ce qui se passe |
|---|---|
| **En file** | la demande attend son tour |
| **En cours** | le modèle travaille — la barre avance |
| **Terminée** | c’est fini, le résultat est arrivé dans vos assets |
| **Échouée** | quelque chose n’a pas marché — la ligne dit quoi |
| **Annulée** | vous l’avez arrêtée |

Le bouton **Annuler la tâche** arrête ce qui n’est pas encore terminé.

**Sous la barre, la ligne dit ce que la génération a coûté** — `3 UC` — ou, si elle a échoué,
pourquoi. Jamais les deux : une génération ratée n’a pas de prix à annoncer.

> **Une génération reprise affiche son prix dès que le studio redemande où elle en est** — le
> chiffre voyage avec la tâche, pas seulement avec la demande. Tant qu’il n’est pas revenu, la
> ligne ne dit rien : mieux vaut se taire qu’annoncer un chiffre faux.

> **Une App n’affiche pas de prix une fois lancée.** Une chaîne ne facture rien pour elle-même :
> ce sont ses étapes qui sont facturées, chacune de son côté. Le prix que vous avez lu sur le
> bouton avant de lancer reste donc le seul chiffre — et il vaut pour la chaîne entière.

### La file d’attente

Le studio ne lance pas tout d’un coup. Il en fait tourner **trois à la fois** par défaut, et met
le reste en file.

Ce nombre se règle : **Réglages ▸ Génération ▸ Générations simultanées**, de 1 à 16.

> **Augmenter ce nombre n’accélère pas le service.** Cela rend seulement plus probable que
> Scenario refuse vos demandes en trop. La file existe justement pour étaler une rafale plutôt
> que de la faire rejeter. Trois est un bon équilibre.

### Les reprises automatiques

Quand une demande échoue à cause d’une coupure réseau ou d’un serveur occupé, le studio
**réessaie tout seul**, en attendant un peu plus longtemps à chaque tentative.

Le nombre de tentatives se règle : **Réglages ▸ Génération ▸ Tentatives maximum**, de 0 à 10.
Quatre par défaut.

> **Une clé API invalide n’est jamais réessayée.** Réessayer ne la corrigerait pas. Le studio
> distingue ce qui vaut la peine d’être retenté de ce qui ne le vaut pas.

### Fermer le studio n’annule pas une génération

**Une génération lancée continue chez Scenario, que le studio soit ouvert ou non.** Ce qui manquait
jusqu’ici, c’est qu’il sache la retrouver au retour : c’est fait. En quittant, il note les
demandes encore en cours ; au lancement suivant, il les reprend là où elles en sont et leur
résultat rejoint vos assets comme si de rien n’était.

Trois précisions qui décident de ce que vous verrez :

- **la reprise est par projet.** Rouvrez le projet d’où partait la demande, et elle réapparaît
  dans la ligne d’état. Un autre projet ne montre pas les tâches du premier, et ne les perd pas
  non plus ;
- **la reprise est par compte.** Une demande est réinterrogée avec la clé qui l’a lancée — une
  autre clé recevrait une fin de non-recevoir, et aucune reprise ne répare cela ;
- **au-delà d’une semaine, une demande oubliée est balayée.** C’est assez long pour l’entraînement
  d’un modèle, qui dure des heures, et assez court pour qu’un projet abandonné en pleine
  génération ne traîne pas ses notes indéfiniment.

**Une annulation, elle, arrête vraiment la demande** — chez Scenario, pas seulement dans
l’affichage.

### Changer de compte n’interrompt pas une génération en cours

**Une tâche finit sur le compte qui l’a lancée.** Elle retient sa clé au moment où vous appuyez sur
Générer, et la garde jusqu’au bout — y compris pour déposer le résultat dans vos assets.

Vous pouvez donc lancer une vidéo de dix minutes, basculer sur un autre compte pour aller chercher
un modèle, et la première continue tranquillement.

> Ce qui change, en revanche, c’est **le catalogue** : passer d’un compte à l’autre vide les
> modèles et les assets distants du précédent. C’est voulu — ce sont deux bibliothèques
> différentes, et les mélanger vous ferait choisir un modèle auquel votre clé n’a pas accès.

---

## Quand le résultat arrive

La ligne passe à **Terminée**, et l’asset apparaît :

- dans le panneau **Assets** — l’étagère du projet ;
- sur votre disque, dans `assets/img/`, `assets/vid/`, `assets/aud/`… selon son type.

**Ce que vous pouvez en faire ensuite dépend de son type**, et c’est là que le studio surprend le
plus souvent :

| Le résultat est… | Ce qui est possible aujourd’hui |
|---|---|
| une **image** | la peindre dans un document **image**, la reprendre comme départ d’une autre génération, ou s’en servir comme **ciel** ou comme **couleur de base** d’une matière |
| une **vidéo** ou un **son** | le poser sur une **timeline** (espace Vidéo), ou l’éditer (espace Audio) |
| un **panorama** | le poser dans un document **ciel** (espace Skyboxes) |
| un **objet 3D** | rien d’utile — le studio ne sait pas encore ouvrir un maillage |

**Rappel du geste**, parce qu’il déroute : le double-clic **n’ouvre pas d’onglet**, il envoie
l’asset dans l’onglet déjà en avant. Ouvrez d’abord le document qui doit le recevoir, avec le
bouton `+` du rail gauche. Voir [Les assets](07-assets.md).

> **Une image générée se retouche dans l’espace Image** : ouvrez un document avec le `+`, puis
> glissez l’image sur la toile — elle y devient un calque. Ce document, en revanche, ne
> s’enregistre pas ; `⇧⌘E` en sort un PNG. Voir [Espace Image](08-espace-image.md).

<!-- CAPTURE : le panneau Génération avec le formulaire d’un modèle, et la ligne d’état en
     dessous avec une tâche en cours. Vers ../../images/generate.png -->

---

## Régénérer avec les mêmes réglages

Sélectionnez un asset dans l’étagère, et regardez l’**Inspecteur**, à droite. S’il connaît la
génération qui l’a produit, il affiche son modèle, son prompt et sa graine — et propose
**Régénérer**.

Un clic remplit le formulaire de génération avec ces valeurs. À vous d’en changer une seule et
de relancer, ce qui est la façon la plus rapide d’explorer une piste.

> Les valeurs restent dans le formulaire jusqu’à ce qu’un autre « Régénérer » les remplace. Cela
> se lit comme « les derniers réglages utilisés ».

---

## Les Apps : des chaînes toutes faites

Le panneau **Apps**, dans la colonne de droite, liste les *workflows publics* de Scenario. Une App
est une chaîne de traitements — plusieurs modèles enchaînés, parfois une découpe, un détourage et
un agrandissement à la suite — publiée par Scenario ou par la communauté, et exécutable telle
quelle. Vous n’avez rien à construire : elle a déjà ses étapes et ses réglages.

**Le geste est le même que pour un modèle**, en trois temps :

1. cliquez une App dans la liste — sa description dit ce qu’elle fait ;
2. remplissez le formulaire qui s’ouvre. Il est bâti sur ce que l’App déclare attendre, exactement
   comme le formulaire d’un modèle : ni le studio ni vous n’avez à deviner ses champs ;
3. **Lancer**. La tâche part dans la barre des générations, avec les autres, et ses sorties
   arrivent dans le projet ouvert.

**Le prix s’affiche sur le bouton** dès que le formulaire est complet, comme pour une génération.

**Retour à la liste** par la flèche, en haut du panneau.

> Une App marquée **brouillon** n’est pas exécutable — c’est l’API qui le décide, pas le studio.
> Le panneau le dit et le bouton reste inactif plutôt que de vous laisser essayer.

> Une génération lancée par une App n’a **pas** de bouton « Régénérer » dans l’inspecteur : la
> chaîne qui l’a produite n’est pas un modèle, et le formulaire de génération ne saurait pas quoi
> en faire. Relancez-la depuis le panneau Apps.

---

## Les erreurs, et ce qu’elles veulent dire

| Message | Cause | Quoi faire |
|---|---|---|
| **Aucun identifiant enregistré.** | aucune clé API | Réglages ▸ Compte |
| **Clé ou secret API invalide.** | une des deux chaînes est fausse | vérifier, souvent un espace en trop |
| **Cette clé API n’a pas les droits requis.** | la clé existe mais ne peut pas faire cela | vérifier votre plan sur app.scenario.com |
| **Trop de requêtes. Nouvelle tentative en cours…** | vous avez dépassé le débit autorisé | rien, le studio réessaie tout seul |
| **Le service Scenario est momentanément indisponible.** | panne côté serveur | réessayer plus tard |
| **Impossible de joindre Scenario.** | votre connexion internet | vérifier le réseau |
| **La génération a échoué.** | le modèle a refusé la demande | souvent un paramètre hors limites, ou un prompt refusé |
| **Impossible d’enregistrer le résultat sur le disque.** | le dossier du projet n’est plus accessible | disque plein, projet déplacé, droits en écriture |
| **Valeur invalide.** | un champ du formulaire | le champ concerné est signalé |

Le chapitre [Quand ça coince](16-depannage.md) reprend ces cas en détail.

---

[← Trouver un modèle](05-modeles.md) · [Sommaire](../guide-utilisateur.md) · [Chapitre suivant : Les assets →](07-assets.md)
