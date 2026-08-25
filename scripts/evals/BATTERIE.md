# Batterie de tests — l'assistant face à l'application

La liste que l'assistant doit finir par passer, décidée par Alban le 2026-08-26. Elle vit ici
plutôt que dans `docs/` parce qu'elle est la **feuille de route du banc** (`pnpm evals`) : chaque
case cochée doit devenir un scénario mesurable, pas une impression.

## Lancer le banc

```bash
pnpm evals                 # trois passes par scénario
EVAL_RUNS=1 pnpm evals     # une seule, pour un aller-retour rapide
```

La clé se met **une fois** dans `secret/.env` — `EVAL_KEY=sk-…`. Le dossier entier est ignoré par
git et doit le rester : une clé commitée survit dans l'historique au commit qui la retire.

## Où en est le banc

La liste ci-dessous compte **192 demandes, et le banc en joue 192** — une par case, dans cet
ordre. `batterie.test.ts` tient les deux listes à la même longueur et dans le même ordre : une
demande ajoutée ici sans scénario fait rougir la porte, et un scénario écrit pour rien aussi.
C'est ce qui rend « on en est où ? » répondable.

**Aucune passe complète n'a encore été lancée.** Les scénarios sont écrits, pas mesurés — et une
case ne se coche que sur un chiffre.

Dernière mesure partielle — DeepSeek, 2026-08-25, cinq scénarios seulement, trois passes chacun :
**0/3** ouvre une image nommée dans une autre langue · **2/3** ouvre un document au nom quasi
exact · **3/3** demande lequel quand deux fichiers matchent · **0/3** pose une image sur un plan ·
**3/3** répond sans toucher au studio.

**Ce que les chaînes montrent, et qu'aucun pourcentage ne dit** : le modèle CHERCHE puis s'arrête.
`files.search`, `files.list → files.search`, `files.search → documents.list` — puis rien, alors que
la recherche a rendu le chemin. Ce n'est pas un problème de connaissance du projet.

🛑 **Un pourcentage global de ce banc ne se compare à rien tant qu'il tient sur quinze tirages.**
Le même code a rendu 33 %, 40 % et 53 % dans la même journée. Ce qui se lit est la ligne d'UN
scénario, et la seule comparaison qui vaut est celle qu'on peut expliquer : « ce scénario ne
pouvait pas passer, il passe ».

🛑 **Une action que le studio simulé modélise MAL ne se voit nulle part.** La ligne `not modelled`
du rapport nomme celles qu'il ignore, jamais celles qu'il lit de travers — et une action lue de
travers ressemble trait pour trait à un modèle qui choisit mal. `node.material` était lu comme un
`assetId` posé à côté du nœud, là où le registre déclare un enregistrement `textures` : le seul
appel correct revenait `badInput`, et trois passes ont bouclé dessus. Le studio simulé passe
désormais **toute** entrée par `validatesInput`, la porte que le vrai chemin tient
(`renderer/src/assistant/executor.ts`), plutôt que de relire les champs à la main action par
action.

🛑 **Une case cochée à la main ne vaut rien.** Toutes les erreurs de la session du 25/08 étaient
annoncées comme des succès par le modèle lui-même, et une passe unique a donné 60 % là où trois
passes donnaient 0 %. Ce qui compte est ce que le studio CONTIENT après coup — et c'est la seule
chose qu'un oracle lit ici.

## Trois unités que le banc a d'abord lues de travers

Elles sont écrites ici parce qu'aucune ne se devine et que chacune a rendu une section entière
fausse — un modèle qui répondait JUSTE échouait, et un qui répondait faux passait.

- **Le montage compte en MICROSECONDES**, pas en secondes (`sequenceActions.ts`, en-tête). Trois
  secondes s'écrivent `3_000_000`.
- **Un gain est en DÉCIBELS**, borné `GAIN_MIN`/`GAIN_MAX`, neutre à **0** — pas une fraction.
  « Mets le son à 50 % » vaut **−6 dB**, et un banc lisant `0.5` récompensait +0,5 dB.
- **La pile de calques a l'index 0 EN BAS** (`engines/canvas/commands.ts`), à l'inverse du
  réflexe. « Passe ce calque derrière » est donc `index: 0`.

## Comment un scénario est écrit

Un scénario porte **ce que la personne dit** (une phrase, ou plusieurs quand l'enchaînement EST le
sujet — sections 25 et 26), un **décor** posé par le banc lui-même, et un **oracle** qui lit l'état
du studio simulé.

Le décor n'est pas une facilité : « Dans la scène Test MCP » est une phrase de la batterie, pas une
demande. Le faire rejouer au modèle à chaque case scorerait quarante fois la même étape et ferait
tomber une section entière sur son premier échec.

**Ce qu'un oracle ne lit JAMAIS, ce sont les mots du modèle.** `said` ne sert qu'à deux choses :
vérifier qu'une question a bien été **renvoyée** à la personne (section 30), et qu'une demande de
lecture a reçu **une** réponse. Jamais comme preuve qu'une action a eu lieu.

🛑 **Le décor est neutralisé avant que la personne parle** (`studio.settle()`). Sans cela, un décor
qui construit quoi que ce soit marquait le document modifié et remplissait la pile d'annulation :
les dix-sept scénarios en lecture seule — toute la section 30 comprise — étaient **impassables**,
et rien ne le disait.

🛑 **Un décor ne doit jamais poser la conclusion.** `batterie.test.ts` vérifie qu'aucun de ses
appels n'est refusé — un décor refusé en silence laisse le scénario jouer sur un studio vide, et
l'échec est imputé au modèle. Ce qu'il ne peut PAS voir, en revanche, c'est un décor qui pose déjà
le résultat : ça se relit à la main, et sept l'avaient fait.

---

## 1. Compréhension du projet — lecture seule

- [ ] « Quel projet est actuellement ouvert et quels documents sont ouverts ? »
- [ ] « Liste-moi les fichiers présents dans mon projet, classés par type. »
- [ ] « Combien ai-je d'images, de vidéos, de fichiers audio, de modèles 3D, de textures et de skyboxes ? »
- [ ] « Quel document est actuellement actif ? »
- [ ] « Quels sont les éléments présents dans la scène 3D actuellement ouverte ? »
- [ ] « Quelles caméras et quelles lumières sont présentes dans ma scène ? »
- [ ] « Donne-moi les propriétés de la caméra de la scène. »
- [ ] « Quelle est la durée actuelle de ma timeline ? »
- [ ] « Quels éléments sont actuellement sélectionnés ? »

## 2. Navigation dans l'application

- [ ] « Ouvre mon image du bateau. »
- [ ] « Ouvre ma première vidéo. »
- [ ] « Ouvre mon premier fichier audio. »
- [ ] « Ouvre ma scène 3D. »
- [ ] « Ouvre la texture utilisée par mon premier modèle 3D. »
- [ ] « Ouvre ma première skybox. »
- [ ] « Reviens sur la scène 3D. »

## 3. Recherche intelligente d'assets

- [ ] « Trouve-moi l'image qui représente un bateau. »
- [ ] « Trouve-moi tous les modèles 3D de personnages. »
- [ ] « Trouve-moi les fichiers qui pourraient être utilisés comme environnement. »
- [ ] « Trouve-moi toutes les textures associées à mon modèle 3D actuel. »
- [ ] « Trouve-moi tous les fichiers audio utilisables dans un montage vidéo. »
- [ ] « Trouve-moi les assets générés par IA qui concernent une voiture. »

## 4. Gestion des fichiers et dossiers

- [ ] « Crée un dossier Tests Assistant dans mon projet. »
- [ ] « Dans Tests Assistant, crée un sous-dossier Images. »
- [ ] « Duplique l'image du bateau dans ce dossier. »
- [ ] « Renomme cette copie bateau-test.png. »
- [ ] « Déplace bateau-test.png dans le sous-dossier Images. »
- [ ] « Vérifie que le fichier existe bien à son nouvel emplacement. »
- [ ] « Supprime bateau-test.png. »
- [ ] « Supprime les dossiers de test que nous venons de créer. »

## 5. Création de documents

- [ ] « Crée une nouvelle scène 3D vide appelée Test MCP. »
- [ ] « Crée un nouveau montage vidéo appelé Test Video. »
- [ ] « Crée un nouveau montage audio appelé Test Audio. »
- [ ] « Ferme Test Audio sans supprimer le fichier. »
- [ ] « Rouvre Test MCP. »

## 6. Manipulation simple d'une scène 3D

Dans la scène Test MCP :

- [ ] « Ajoute un cube au centre de la scène. »
- [ ] « Renomme le cube Cube Test. »
- [ ] « Place Cube Test à X 2, Y 1, Z -3. »
- [ ] « Double sa taille. »
- [ ] « Fais-le pivoter de 45 degrés sur l'axe Y. »
- [ ] « Ajoute une sphère à droite du cube. »
- [ ] « Place la sphère exactement 2 mètres à droite du cube. »
- [ ] « Duplique la sphère et place la copie à gauche du cube. »
- [ ] « Renomme les deux sphères Sphere Droite et Sphere Gauche. »

## 7. Manipulation relative — important

- [ ] « Déplace Cube Test d'un mètre vers le haut. »
- [ ] « Déplace Sphere Droite de 50 cm vers la droite. »
- [ ] « Fais tourner Cube Test de 20 degrés supplémentaires sur Y. »
- [ ] « Réduis Sphere Gauche de moitié. »
- [ ] « Place Sphere Gauche exactement au-dessus de Cube Test. »

L'assistant doit lire les valeurs **actuelles** avant d'appliquer une transformation relative.

## 8. Lumières

- [ ] « Ajoute une lumière directionnelle à la scène. »
- [ ] « Renomme-la Soleil Test. »
- [ ] « Augmente son intensité de 25 %. »
- [ ] « Ajoute une lumière ponctuelle au-dessus du cube. »
- [ ] « Réduis son intensité de moitié. »
- [ ] « Désactive Soleil Test. »
- [ ] « Réactive Soleil Test. »

## 9. Caméras

- [ ] « Ajoute une nouvelle caméra appelée Camera Test. »
- [ ] « Place Camera Test face au cube. »
- [ ] « Oriente Camera Test pour qu'elle regarde Cube Test. »
- [ ] « Éloigne Camera Test de 2 mètres sans changer la cible qu'elle regarde. »
- [ ] « Fais de Camera Test la caméra active. »
- [ ] « Donne-moi maintenant sa position et sa rotation. »

## 10. Environnement 3D

- [ ] « Active la grille de la scène. »
- [ ] « Change l'environnement pour utiliser ma première skybox. »
- [ ] « Réduis l'intensité de l'environnement à 0,7. »
- [ ] « Active les ombres. »
- [ ] « Mets la qualité des ombres au niveau le plus élevé disponible. »
- [ ] « Change l'arrière-plan sans changer l'éclairage de la scène. »

## 11. Import d'assets dans une scène

- [ ] « Ajoute mon premier modèle 3D dans Test MCP. »
- [ ] « Place-le au centre de la scène. »
- [ ] « Adapte automatiquement sa taille pour qu'il soit visible correctement. »
- [ ] « Place Camera Test pour cadrer entièrement ce modèle. »
- [ ] « Ajoute une deuxième instance du même modèle à sa droite. »

## 12. Textures et matériaux

- [ ] « Sélectionne le modèle 3D que nous venons d'ajouter et donne-moi ses matériaux. »
- [ ] « Change la couleur de base de son premier matériau en rouge. »
- [ ] « Mets sa rugosité à 0,25. »
- [ ] « Mets son métal à 0,8. »
- [ ] « Assigne une texture de mon projet à sa couleur de base. »
- [ ] « Ajoute une normal map si une texture compatible existe dans le projet. »
- [ ] « Remets le matériau dans son état précédent. »

## 13. Timeline 3D

- [ ] « Mets la durée de la scène à 10 secondes. »
- [ ] « Anime Cube Test pour qu'il parte de sa position actuelle à 0 seconde et arrive 5 mètres plus haut à 5 secondes. »
- [ ] « À 10 secondes, fais-le revenir à sa position initiale. »
- [ ] « Ajoute une rotation complète du cube entre 0 et 10 secondes. »
- [ ] « Fais commencer l'animation de Sphere Droite à 2 secondes. »
- [ ] « Supprime uniquement l'animation de rotation du cube sans supprimer son animation de position. »

## 14. Animation de caméra

- [ ] « Anime Camera Test pour qu'elle se rapproche progressivement du cube entre 0 et 5 secondes. »
- [ ] « Pendant son déplacement, garde la caméra orientée vers Cube Test. »
- [ ] « Entre 5 et 10 secondes, fais tourner la caméra autour du cube. »
- [ ] « Vérifie qu'à aucun moment la caméra ne perd Cube Test de vue. »

## 15. Montage vidéo

Dans Test Video :

- [ ] « Ajoute ma première vidéo sur la piste V1 au début de la timeline. »
- [ ] « Ajoute une deuxième vidéo juste après la première. »
- [ ] « Coupe les deux premières secondes du premier clip. »
- [ ] « Déplace le deuxième clip pour qu'il commence immédiatement après le premier. »
- [ ] « Ajoute mon image du bateau pendant 3 secondes après les vidéos. »
- [ ] « Mets l'image du bateau à l'échelle pour remplir le cadre sans la déformer. »

## 16. Audio dans le montage vidéo

- [ ] « Ajoute mon premier fichier audio sur A1 au début du montage. »
- [ ] « Réduis son volume à 50 %. »
- [ ] « Fais un fondu d'entrée d'une seconde. »
- [ ] « Fais un fondu de sortie de deux secondes. »
- [ ] « Coupe l'audio exactement à la durée du montage vidéo. »

## 17. Montage audio

Dans Test Audio :

- [ ] « Ajoute mes deux fichiers audio sur deux pistes différentes. »
- [ ] « Fais commencer le deuxième à 3 secondes. »
- [ ] « Mets le premier à 70 % de volume. »
- [ ] « Mets le deuxième à 40 %. »
- [ ] « Fais un fondu entre les deux morceaux. »

## 18. Édition d'image

Sur une copie de l'image du bateau :

- [ ] « Duplique cette image avant de la modifier. »
- [ ] « Renomme la copie bateau-edition-test. »
- [ ] « Réduis son opacité à 70 %. »
- [ ] « Déplace-la de 100 pixels vers la droite. »
- [ ] « Augmente sa taille de 20 %. »
- [ ] « Fais-la pivoter de 15 degrés. »
- [ ] « Remets uniquement la rotation à zéro. »

## 19. Calques image

- [ ] « Ajoute une deuxième image comme nouveau calque au-dessus du bateau. »
- [ ] « Renomme ce calque Overlay Test. »
- [ ] « Mets Overlay Test à 50 % d'opacité. »
- [ ] « Passe Overlay Test derrière le bateau. »
- [ ] « Masque Overlay Test. »
- [ ] « Réaffiche Overlay Test. »
- [ ] « Supprime uniquement Overlay Test. »

## 20. Génération IA simple

- [ ] « Génère une image photoréaliste d'une voiture rouge dans une rue de Paris. »
- [ ] « Enregistre le résultat dans Images. »
- [ ] « Génère une deuxième variante à partir de cette image. »
- [ ] « Utilise l'image générée comme référence et transforme la voiture rouge en voiture bleue. »
- [ ] « Conserve les deux versions dans le projet. »

## 21. Génération IA avec contexte du projet

- [ ] « Utilise l'image du bateau de mon projet comme référence et génère une variante de nuit. »
- [ ] « Utilise cette nouvelle image comme référence pour créer une version sous une tempête. »
- [ ] « Génère une texture inspirée des couleurs du bateau actuellement ouvert. »
- [ ] « Génère un environnement cohérent avec l'image du bateau. »

## 22. Génération 3D

- [ ] « Génère un modèle 3D d'un coffre en bois. »
- [ ] « Ajoute le résultat dans mon projet. »
- [ ] « Ouvre le modèle généré. »
- [ ] « Ajoute-le à Test MCP. »
- [ ] « Place-le devant Cube Test. »
- [ ] « Adapte sa taille pour qu'il fasse environ un mètre de large. »

## 23. Raisonnement multi-documents

- [ ] « Prends l'image du bateau, ajoute-la au montage vidéo Test Video pendant 5 secondes et ajoute un de mes fichiers audio en fond sonore. »
- [ ] « Utilise ma skybox actuelle comme environnement de Test MCP puis place mon modèle 3D principal dans la scène. »
- [ ] « Trouve une texture compatible avec le modèle actuellement sélectionné et applique-la sans modifier les autres matériaux. »

## 24. Commandes naturelles volontairement imprécises

Ne rien donner de plus au modèle.

- [ ] « Mets le bateau dans ma vidéo. »
- [ ] « Mets la voiture dans la scène. »
- [ ] « Fais le cube un peu plus gros. »
- [ ] « Éclaire mieux mon modèle. »
- [ ] « Cadre correctement le personnage. »
- [ ] « Fais durer ça deux secondes de plus. »
- [ ] « Mets le son moins fort. »
- [ ] « Fais regarder la caméra vers le personnage. »
- [ ] « Utilise cette image comme texture. »
- [ ] « Fais une variante de ça. »

On vérifie qu'il exploite le contexte, et qu'il ne demande une précision que lorsque
l'ambiguïté empêche réellement d'agir.

## 25. Références conversationnelles

À la suite, sans repartir de zéro :

- [ ] « Ajoute un cube. »
- [ ] « Mets-le à droite. »
- [ ] « Duplique-le. »
- [ ] « Mets la copie à gauche. »
- [ ] « Agrandis-la. »
- [ ] « Fais-les tourner de 45 degrés. »
- [ ] « Supprime le premier. »
- [ ] « Centre celui qui reste. »

`le`, `la`, `les`, `celui qui reste` doivent garder la bonne référence d'un tour à l'autre.

## 26. Modification après interrogation

- [ ] « Quelle est la position de Cube Test ? »
- [ ] « Ajoute 2 à sa valeur Y. »
- [ ] « Quelle est maintenant sa position ? »

Puis :

- [ ] « Quelle est l'intensité de Soleil Test ? »
- [ ] « Multiplie-la par deux. »
- [ ] « Vérifie la nouvelle valeur. »

Lecture → calcul → écriture → relecture.

## 27. Actions conditionnelles

- [ ] « Si Test MCP contient déjà une caméra appelée Camera Test, ne la recrée pas ; sinon crée-la. »
- [ ] « Si le cube existe, mets-le à Y = 0 ; sinon crée un cube à Y = 0. »
- [ ] « Si une skybox est déjà utilisée, donne-moi son nom avant de la remplacer par ma deuxième skybox. »
- [ ] « Ajoute une lumière seulement s'il n'y a actuellement aucune lumière directionnelle. »

## 28. Actions en masse

- [ ] « Sélectionne tous les objets 3D sauf les caméras et les lumières. »
- [ ] « Déplace tous ces objets d'un mètre vers le haut. »
- [ ] « Réduis tous les fichiers audio du montage à 60 % de volume. »
- [ ] « Masque tous les calques image sauf celui du bateau. »
- [ ] « Donne-moi la liste des éléments que tu viens de modifier. »

## 29. Undo / sécurité

- [ ] « Déplace Cube Test à X = 50. »
- [ ] « Annule ma dernière modification. »
- [ ] « Vérifie que Cube Test est revenu à sa position précédente. »
- [ ] « Supprime Sphere Droite. »
- [ ] « Annule la suppression. »
- [ ] « Vérifie que Sphere Droite existe de nouveau. »

## 30. Protection contre les mauvaises interprétations

- [ ] « Supprime le bateau. » — asset, calque, instance, document ou fichier : il doit distinguer.
- [ ] « Supprime tout. » — une destruction globale de portée ambiguë ne s'exécute pas à l'aveugle.
- [ ] « Remplace toutes mes textures. » — il doit savoir par quoi avant de toucher à quoi que ce soit.

## 31. Planification complexe

En une seule phrase :

- [ ] « Crée une scène 3D vide appelée Demo Assistant, ajoute mon modèle 3D principal au centre, ajoute une caméra qui le cadre entièrement, utilise ma première skybox comme environnement, ajoute une lumière directionnelle, règle la durée à 10 secondes et fais faire un tour complet au modèle pendant ces 10 secondes. »

## 32. Cross-media complexe

En une seule phrase :

- [ ] « Crée un montage vidéo de test avec mon image du bateau pendant 5 secondes, ajoute ensuite ma première vidéo, ajoute un fond sonore depuis mes fichiers audio, règle le son à 40 %, ajoute un fondu au début et assure-toi que le montage se termine exactement à la fin du dernier clip vidéo. »

## 33. IA + projet + édition

En une seule phrase :

- [ ] « Utilise mon image du bateau comme référence pour générer une version de nuit, ajoute le résultat dans mon projet, crée un nouveau montage vidéo, affiche l'image originale pendant 3 secondes puis la version de nuit pendant 3 secondes et ajoute un de mes fichiers audio en fond. »

## 34. Compréhension autonome d'une scène

- [ ] « Analyse la scène 3D actuelle et dis-moi ce qui pourrait poser problème avant de modifier quoi que ce soit. »
- [ ] « Corrige automatiquement les problèmes simples que tu peux résoudre sans changer l'intention de la scène. »
- [ ] « Dis-moi précisément ce que tu as changé. »

## 35. Vérification après action

- [ ] « Vérifie que toutes les actions que je t'ai demandé d'effectuer sur Test MCP ont réellement été appliquées. »
- [ ] « Compare l'état actuel de la scène avec ce que je t'ai demandé. »
- [ ] « Liste uniquement les actions qui n'ont pas produit le résultat attendu. »

## 36. Final — « directeur de studio »

Dans une scène neuve :

- [ ] « Je veux une petite scène avec mon personnage principal au centre, un éclairage de studio, une caméra qui le cadre entièrement et un environnement adapté. Fais la scène toi-même en utilisant ce qui existe déjà dans mon projet. Ajoute ensuite une animation de caméra de 5 secondes qui se rapproche doucement du personnage tout en continuant à le regarder. Ne génère aucun nouvel asset si ce n'est pas nécessaire. »

Puis, sans autre contexte :

- [ ] « Transforme maintenant cette scène en un montage vidéo de 10 secondes, ajoute une musique de mon projet adaptée et prépare le montage pour l'export. »

Enfin :

- [ ] « Vérifie tout ce que tu viens de faire et indique-moi les éventuelles erreurs ou incohérences restantes. »
