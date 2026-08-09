# Retours d’interface — le registre

**La liste des retours faits à l’écran et de ce qu’ils sont devenus.** Il existe parce que les
retours arrivent en rafale pendant les essais, plus vite qu’ils ne se traitent : sans un endroit
unique, le troisième fait oublier le premier.

Il est commité sur `develop`, donc un worktree neuf le contient — **il s’édite quand même dans le
dépôt principal**, `/Users/pasquelin/Applications/scenario/docs/INTERFACE.md`, sans quoi chaque
branche tient sa propre version des retours et elles divergent.

Son périmètre : **ce qui se juge en regardant l’application tourner**. Le reste est dans
`docs/REPRISE.md`. Un retour traité descend dans la table « Fait » avec son commit ; on n’en crée
jamais une copie ailleurs.

| Statut | Sens |
|---|---|
| **À faire** | Signalé, pas commencé. |
| **En cours** | Ouvert dans la branche courante. |
| **Bloqué** | Ne peut pas avancer sans quelque chose — dit quoi. |
| **Fait** | Livré, avec le commit qui le porte. Reste ici un temps, puis part. |

Une entrée dit **ce qui a été vu**, pas la solution : la cause se cherche au moment de la traiter,
et une cause devinée à la volée est une cause fausse une fois sur deux.

---

## Les règles de disposition — tranchées, ne pas les rouvrir

Ce ne sont pas des retours en attente : ce sont les réponses déjà données, et c’est à elles qu’un
nouveau retour se compare.

**La colonne de gauche est réservée à la génération**, dans les six espaces. La droite porte ce qui
parle du document, **inspecteur en moitié basse**. L’étagère à assets est en **bande du bas**
partout — sauf en Vidéo et en Audio, où la timeline occupe le bas et où c’est la colonne de droite
qui la porte (`TOOL_PLACEMENTS`, `shared/domain/tool.ts`).

> Avant, l’étagère était à droite dans tous les espaces, où elle mangeait la largeur du canvas.

**Une moitié vaut `null` quand personne ne l’a choisie**, et chaque espace y lit le premier panneau
qu’il déclare. **Ne pas remettre d’identifiant dans `DEFAULT_OPEN`** : nommer un panneau par moitié
imposait la réponse d’un espace aux cinq autres — l’Explorateur gagnait partout, y compris en Image
où les Calques viennent en premier.

**Le centre ne porte que la barre d’outils et les règles.** C’est la conséquence directe des deux
règles précédentes, et c’est pour ça qu’un menu horizontal posé en haut du centre est un défaut et
pas un choix.

---

## À faire

### 24. L’Explorateur et Apps passent au rail gauche, dans toute l’application

**Décidé le 9 août 2026**, dans la foulée de l’entrée 23 : les deux quittent le rail droit pour
le gauche, **partout**.

**L’Explorateur y est déjà à moitié, et le code l’avait déjà tranché dans ce sens.** Il porte
**deux** placements : `left/primary` pour l’accueil, `right/primary` pour les six espaces. Et le
commentaire de celui de l’accueil dit exactement ceci — « Same panel and same half as in the six
spaces, **one column over** ». Le déplacement ne fait donc pas qu’obéir : il **réunit les deux
entrées en une**, et supprime la seule raison qu’avait ce panneau d’exister en double.

**Ce que la droite garde**, une fois les deux partis — c’est le vrai enjeu, et il ne se voit pas
avant de l’écrire :

| Espace | Colonne droite, après |
|---|---|
| Image | `layers` **seul** |
| Vidéo | `assets` **seul** |
| Audio | `assets` **seul** |
| Textures | `channels` seul — deux avec le panneau Styles de l’entrée 7 |
| 3D | `scene`, `lights`, `meshes` |
| Skyboxes | `skybox`, `view` |

L’inspecteur ne bouge pas : il occupe l’autre moitié (`right/secondary`) et reste en bas à
droite dans les six espaces.

**Et la gauche passe à quatre panneaux qui prennent leur tour** — `models`, `generator`,
`explorer`, `apps` — **cinq en Textures** quand Styles arrivera. C’est la contrepartie, et elle
est à regarder à l’écran : quatre icônes empilées dans un rail, c’est le moment où une colonne
cesse d’être un endroit qu’on connaît pour devenir une pile qu’on fouille. L’ordre de
déclaration décide de ce qui s’ouvre par défaut.

> **Deux commentaires deviennent faux le jour où c’est fait** et doivent partir avec le code :
> « The left column is generation, **and only generation**, in every space » sur `models`, et
> celui d’`apps` qui explique pourquoi il n’est *pas* à gauche. Une raison écrite pour une
> décision qui n’est plus prise se lit comme la règle en vigueur.

### 19. « Apps » ne dit pas ce que le panneau contient

**Vu le 9 août 2026** — « c’est quoi App, le titre je ne le comprends pas ». Le panneau liste
seize entrées et ne dit nulle part ce qu’elles sont.

**Le mot vient de Scenario**, c’est le nom du produit côté plateforme, et il est **délibérément
non traduit** — `panels.apps` vaut « Apps » dans les deux bundles. Ce qui se défend : c’est ainsi
qu’ils s’appellent sur `scenario.com`. Mais un nom de produit tenu par une plateforme tierce ne
suffit pas à expliquer un panneau dans un dock, et rien d’autre ne l’explique ici.

Ce qu’une App est, en une phrase, et qui n’est écrit nulle part à l’écran : **un enchaînement de
plusieurs modèles derrière un seul formulaire, publié publiquement, qu’on lance tel quel.**
« 3D Model Pipeline (High-poly to Game-ready) » est un pipeline entier ; « Coloring Page Maker »
en est un aussi, plus court.

**Ce qui n’aide pas** : le panneau n’a d’explication qu’à vide (`apps.none` — « Aucune App
publiée pour l’instant »), c’est-à-dire dans le seul cas où l’utilisateur n’a rien sous les yeux
à comprendre. Rempli, il n’a que son titre.

Trois endroits possibles, à trancher : une ligne sous le titre du panneau, l’infobulle de son
icône dans le rail — qui ne dit aujourd’hui que « Apps » elle aussi —, ou le manuel seul en
acceptant que le panneau ne s’explique pas. Les deux premiers coûtent une clé i18n dans chaque
bundle.

**La phrase qui a fini par expliquer**, et qui vaut d’être reprise telle quelle : la Génération,
c’est **un modèle, une étape** ; une App, c’est **plusieurs modèles enchaînés, déjà montés par
quelqu’un** — un seul formulaire, la chaîne entière tourne. « Coloring Page Maker » prend une
photo et rend un coloriage ; derrière, plusieurs modèles se sont passé le relais.

#### Et il passe à gauche — 9 août 2026

**Une App produit des assets : c’est de la génération, donc la colonne de gauche.** C’est la
règle du studio, celle des six espaces, et elle prime.

**Le code portait la raison inverse, et elle est écrite noir sur blanc** dans `TOOL_PLACEMENTS` :
« In the right column and **not** in the left one, which is reserved for the two generation
panels: an App is a pipeline of its own, not a model the generator would fill a form for. »
L’argument était que la gauche appartient aux **deux** panneaux de génération — choisir un
modèle, remplir son formulaire — et qu’une App ne se choisit pas comme un modèle. Il est
recevable et il est écarté : ce que l’utilisateur cherche à gauche, c’est **de quoi produire**,
et une App en est.

**Ce que le déplacement change concrètement.** La gauche est un `slot: 'primary'` où les panneaux
**prennent leur tour** : `models` et `generator` s’y relaient déjà, `apps` ferait un troisième.
Trois onglets dans une colonne au lieu de deux, et l’ordre de déclaration décide de celui qui
s’ouvre par défaut — c’est `TOOL_PLACEMENTS` qui en décide, pas `DEFAULT_OPEN`. À vérifier à
l’écran : la colonne de gauche ne doit pas devenir la pile où l’on cherche.

**Et le commentaire part avec le panneau.** Une raison écrite pour une décision qui n’est plus
prise est un piège pour la session suivante : elle le lira comme la règle en vigueur. Le
remplacer par la nouvelle raison, en une ligne.

> À savoir avant d’écrire cette phrase : le panneau ne montre **que les workflows publics**
> (`privacy: 'public'`), délibérément. Un workflow privé appartient au compte qui l’a écrit, et
> le studio n’a pas encore d’éditeur pour ça — c’est le node editor, § 4 de `REPRISE`. La
> formulation ne doit donc pas promettre « vos workflows ».

### 21. Le volet du journal ne se ferme pas au clic à côté

**Vu le 9 août 2026, capture à l’appui.** Un clic en dehors du volet devrait le refermer. Il
reste ouvert, et la seule sortie est de recliquer sur « 1 échec » — ce que personne n’a le
réflexe de faire : c’est un indicateur d’état, pas un bouton de fermeture.

**`Flyout` ne ferme rien, par construction** : il place et il rend, la fermeture appartient à
l’appelant. Sur les cinq appelants, deux gèrent, deux ne gèrent pas :

| Appelant | Comment il ferme |
|---|---|
| `MenuButton`, `AccountSelect` | `useHoverFlyout` — le pointeur sort, ça ferme, avec période de grâce |
| **`ActivityStatus`, `JobsStatus`** | **un `useState` et le clic du bouton, rien d’autre** |

C’est donc **deux volets** de la ligne d’état, pas un : la barre de jobs a exactement le même
défaut, et il n’a pas encore été signalé parce qu’on l’ouvre moins.

**Le remède est déjà écrit, ailleurs.** `ContextMenu` fait le travail complet, avec ses raisons
en commentaire : `pointerdown` **en capture** — « a menu that survives until mouseup stays under
the pointer while the surface behind it has already reacted to the press » —, `Escape`,
`window.blur`, et la garde qui distingue un clic **dans** le menu (une ligne qu’on choisit) d’un
clic dehors. Il n’y a rien à concevoir : il y a à partager.

> **Le piège du remède rapide** : ne pas poser ce comportement dans `Flyout` d’office. Deux de
> ses appelants ouvrent au survol et ferment au survol, avec une période de grâce que le guide
> décrit — un `pointerdown` global ajouté sous eux se battrait avec. Une prop de rejet
> optionnelle, ou un hook que les deux volets appellent.

**Trois sorties valent mieux qu’une**, et elles vont ensemble : le clic à côté, `Échap`, et la
fenêtre qui perd le focus. La troisième compte plus qu’il n’y paraît dans un studio : on passe à
une autre application, on revient, et le volet est toujours là par-dessus le travail.

### 23. Une App n’appartient à aucun espace, et rien ne dit ce qu’elle produit

**Constaté le 9 août 2026** — « je le vois sur toutes les sections ». C’est exact, et c’est
entier : `TOOL_PLACEMENTS` déclare `apps` pour `WORKSPACE_IDS`, et `searchApps` ne filtre que
`privacy: 'public'`. **La même liste s’affiche dans les six espaces**, sans aucun tri.

**Une App n’est liée à aucun type**, et le domaine le confirme : `WorkflowSummary` porte `id`,
`name`, `description`, `status`, `privacy`, `tags`, `thumbnail`, `locked` — **aucune notion de
sortie**. Rien, avant de la lancer, ne dit si elle rend une image, un maillage ou les deux. Le
seul signal existant est `tags`, et il ne sert aujourd’hui que de sous-titre de secours quand la
description manque.

**Le multi-sorties, lui, fonctionne déjà — et bien.** Le collecteur traite chaque sortie
séparément : `assetTypeOfRemote` lit le type que l’API annonce **pour celle-là**, l’asset est
importé sous ce type et atterrit dans l’étagère correspondante. Quand il y en a plusieurs, elles
reçoivent un `groupId` commun — l’identifiant du job — et un `outputIndex`, si bien qu’elles
restent liées entre elles. Un type inconnu est ignoré plutôt que rangé de travers. Une App qui
rend une image de concept, un maillage et ses textures se range donc toute seule, dans trois
étagères, sans rien à configurer.

**La conséquence à l’écran est celle qu’on ne voit pas venir : le résultat n’apparaît pas
forcément là où on l’a lancé.** Une App lancée depuis la 3D peut déposer une image dans
l’étagère Image, et l’espace où l’on attendait quelque chose ne montre rien.

**Ce qui se défend, et ce qui manque.** Ne pas filtrer par espace est **correct** : filtrer
cacherait justement les Apps les plus utiles, celles qui traversent les types. Mais l’absence de
filtre n’exempte pas d’expliquer — deux manques, dans l’ordre :

1. **Dire ce qu’une App produit**, avant de la lancer. Il faut d’abord vérifier si l’API le dit :
   le descripteur ne le porte pas, ses `tags` peut-être. C’est à mesurer contre l’API réelle
   avant d’inventer quoi que ce soit.
2. **Dire où le résultat est parti**, après. La barre de jobs et le journal savent qu’il est
   arrivé ; ni l’un ni l’autre ne dit dans quelle étagère.

### 27. `develop` est rouge par intermittence, et jamais deux fois au même endroit

**Vu le 9 août 2026**, sur quatre exécutions de `pnpm validate` d’affilée. Ce n’est pas un retour
d’interface au sens strict, et il est ici parce qu’il **fait douter de chaque livraison** : un
`validate` rouge qu’il faut réexécuter pour croire est un filet qui ne tient plus.

| Fichier | Seul | En suite |
|---|---|---|
| `settings/ShortcutsSettings.test.tsx` | 15/15, 17 s | jusqu’à 60 s, 2 échecs |
| `panels/channels/Channels.test.tsx` | 24/24, 12 s | 25 s, 1 échec |
| `known-keys.i18n.test.ts` | 6/6 | 18 s, 2 échecs |

**Le message le dit lui-même** : « Test timed out in 15000ms ». Ce sont des dépassements de
délai, jamais des assertions fausses — et les fichiers en cause n’ont rien de commun entre eux
sinon d’être **lents seuls déjà** : dix-sept secondes pour quinze tests, c’est plus que le délai
accordé à un seul d’entre eux. Sous charge — quatre agents de revue en parallèle, une autre
session qui compile — ils débordent.

**Deux réponses possibles pour ceux-là** : relever le délai de ces fichiers, ou regarder pourquoi
un test de réglages met une seconde par assertion. La seconde est la bonne question ; la première
est ce qui rendra les livraisons lisibles en attendant.

> **Le pire des trois est traité par la seconde réponse** — `55ddf63` (feat/tests-lents), 9 août
> 2026. `ShortcutsSettings.test.tsx` passe de **26 s à 3 s**, et aucun de ses tests ne dépasse
> désormais 400 ms. Il ne débordera plus d’un délai de quinze secondes, même sous charge.
>
> **La cause n’était pas la lenteur du panneau, c’étaient deux requêtes.** Les deux seuls appels
> à `getByRole('button', { name })` du fichier coûtaient 5771 et 4419 ms — sur les 18 s de tests.
> Le panneau rend **171 boutons** (85 commandes × 2, plus la recherche par accord ; les
> commentaires du fichier disaient 115 depuis deux relectures, c’est corrigé), et `getByRole` avec
> un nom redérive le nom accessible de chacun. Repère utile pour les autres fichiers : **un rendu
> complet de ce panneau coûte 230 ms** — la requête était vingt-cinq fois plus chère que le rendu
> qu’elle interrogeait.
>
> **Ce qui a failli être troqué contre la vitesse** : la première version remplaçait les deux
> `getByRole` par `getByLabelText`, ce qui trouve un `<div>` aussi bien qu’un bouton. La revue l’a
> reproduit — le contrôle de restauration changé en `role="link"`, **les quinze tests passaient**.
> Les deux contrôles atteints par leur label déclarent maintenant leur rôle avec `toHaveRole`, qui
> lit l’élément déjà trouvé au lieu d’en parcourir cent soixante-dix autres.
>
> **Les deux autres fichiers ne relèvent pas de ce remède, mesuré plutôt que supposé** :
> `Channels.test.tsx` a une lenteur diffuse (487 ms au pire, 24 tests, aucun point chaud isolable)
> et `known-keys.i18n.test.ts` passe **3,6 s à importer** le graphe pour 0,5 s de tests. Pour ces
> deux-là, relever le délai reste la bonne réponse.
>
> **Une piste large a été mesurée puis écartée**, pour qu’on ne la reprenne pas :
> `configure({ defaultHidden: true })` dans `test-setup.ts` fait gagner **33 %** sur tout le
> dépôt, parce que le filtre de visibilité de `byRole` appelle `getComputedStyle` sur chaque
> candidat. Refusé : un bouton `aria-hidden` deviendrait trouvable par `getByRole` dans les
> quatre cents fichiers — un angle mort permanent, dans un dépôt qui vient de livrer l’entrée 9.
> Le gain ciblé est de toute façon dix fois meilleur.

**Et il y a pire, mesuré le 9 août à 17 h 25 sur `develop` fusionné.** Un second groupe échoue
pour une raison qui n’est pas le temps :

| Fichier | Ce qu’il dit en suite |
|---|---|
| `helpers/tool-registry.test.ts` | `Error: Unknown workspace: graph` |
| `app/document-io.test.ts` | idem, sur « carries a graph to disk and back » |
| `panels/models/model-filters.test.ts` | idem, deux tests |
| `eager-graph.test.ts` | idem |

**Les quatre passent seuls** — 33 tests verts en une seule commande, vérifié. Et `graph` est bien
déclaré des deux côtés : dans `WORKSPACE_IDS` (`shared/domain/workspace.ts`) et dans les `ICONS`
de `helpers/workspaces.ts`, que `WORKSPACES` mappe l’un sur l’autre.

Donc ce n’est **pas un délai dépassé et pas une déclaration manquante** : c’est un ordre de
chargement. `WORKSPACES` est calculé à l’évaluation du module, et quelque chose fait qu’il est
calculé trop tôt — ou qu’un autre fichier de test a déjà figé une version de ces modules. Le
suspect à regarder en premier est `eager-graph.test.ts` lui-même : il lit **741 sources** par
`import.meta.glob` et marche le graphe de modules, ce qu’aucun autre test ne fait.

> **Ce n’est pas un retour d’interface, et c’est la chose la plus urgente du registre.** Le
> septième espace vient d’être fusionné ; ces quatre fichiers parlent tous de lui. Un `develop`
> dont le `validate` échoue à des endroits différents à chaque exécution ne dit plus si une
> livraison est bonne — et c’est le seul filet, puisqu’aucun test ne s’exécute sur l’application
> lancée.

**Cherché, et voici où ça bloque — 9 août, 18 h 10.** Le second groupe **ne se reproduit pas à
la demande** : une exécution complète du projet renderer, 286 fichiers et 3431 tests, ne rend
**aucune** occurrence de `Unknown workspace`. Et rien ne l’a corrigé entre-temps : aucun commit
postérieur à la fusion du septième espace ne touche `workspaces.ts`, `workspace.ts`,
`tool-registry.ts` ni `eager-graph.test.ts` — vérifié.

Ce qui distingue les deux exécutions n’est donc pas le code mais **les conditions** : le
`validate` lance les projets `node` et `renderer` **en parallèle**, et celui qui a échoué tournait
pendant que quatre agents de revue et d’autres sessions occupaient la machine. Celui qui passe
n’a lancé que `renderer`, à froid.

**Et c’est ce qui empêche de le corriger aujourd’hui.** La règle du dépôt est le test avant le
correctif ; sans reproduction, tout correctif serait une supposition — exactement ce que ce
registre reproche aux entrées qui devinent leur cause. Ce qu’il faudrait pour avancer : faire
échouer le `validate` **volontairement**, en le relançant sous charge jusqu’à ce qu’il tombe, et
capturer une trace fraîche. Deux ou trois exécutions de dix minutes, à faire quand la machine
n’est prise par personne d’autre.

> Une piste à ne pas perdre : la trace du 17 h 25 désignait `tool-registry.ts:97`, ligne qui est
> **un commentaire** dans le code d’une heure plus tard. Le fichier avait changé pendant que le
> `validate` tournait. Sur un dépôt où cinq commits tombent en quarante minutes, une trace se lit
> avec le `git log` de son heure, ou elle envoie chercher au mauvais endroit.

### 29. `Inter` est déclarée comme police de l’interface, et n’est chargée nulle part

**Vu le 9 août 2026.** `--font-sans` nomme `'Inter', system-ui, …` dans `index.css`, mais **aucun
`@font-face`, aucune dépendance dans `package.json`, aucun lien dans `index.html`** : la pile
retombe sur `system-ui`, c’est-à-dire une police différente sur chacune des trois plateformes que
le pipeline empaquette.

**Ce que ça ne casse pas, contrairement à ce qu’on croirait** : les hauteurs de ligne. Le préflight
Tailwind pose `line-height: 1.5` sur `html`, sans unité, donc calculé sur la taille de chaque
élément et non sur les métriques de la fonte — vérifié en soldant l’entrée 11. Les boîtes de ligne
sont identiques partout.

**Ce que ça change quand même** : la chasse et le dessin des lettres, donc la largeur d’un libellé,
donc le point où un `truncate` coupe. Deux issues, pas trois : embarquer Inter, ou cesser de la
nommer. La nommer sans la charger est la seule qui mente.

### 30. Une infobulle ne se laisse pas survoler, et c’est devenu gênant

**Vu le 9 août 2026**, en soldant l’entrée 22. `TooltipHost` ne pose pas `clickable`, donc la bulle
garde le `pointer-events: none` de la feuille de style du cœur, à `offset: 8` de son ancre : aller
vers elle quitte l’ancre et la referme. C’est l’exigence **« survolable » de WCAG SC 1.4.13 (AA)**.

**C’est préexistant et ça vaut pour toutes les infobulles de l’application** — ce n’est donc pas
un défaut de l’entrée 22. Il est ici parce que celle-ci **promeut l’infobulle de décoration à
unique porteuse visuelle d’un message** : quelqu’un qui zoome à 400 % doit balayer la bulle pour
lire soixante-cinq caractères, et il ne le peut pas.

**L’exigence « écartable » du même critère est réglée** (`globalCloseEvents={{ escape: true }}`,
livré avec l’entrée 22). Reste `clickable`, qui bascule `pointer-events` sur **toutes** les
infobulles : à regarder d’un bloc, avec ce que ça fait aux barres flottantes qui en portent.

### 20. En vue Icônes, une vignette sélectionnée ne se distingue en rien

**Vu le 9 août 2026**, en soldant la vérification à l’écran des entrées 6 et 8 : l’étagère
annonçait trois assets sélectionnés — l’inspecteur affichait « Éléments 3 » — et les trois carrés
étaient rigoureusement identiques aux autres. La sélection existe, elle ne se voit pas.

**Mesuré plutôt que supposé** : la cellule fait 114 × 114 et la `figure` de `MediaTile` en fait
**autant**, 114 × 114. Le fond que `rowSkin` peint sur la cellule sélectionnée — `bg-accent-soft`,
vérifié présent dans la classe — est intégralement recouvert par une tuile opaque (`bg-surface`,
plus sa bordure `border-border`, plus l’image en `object-cover`). Il n’en dépasse **aucun pixel**.
Le liseré d’un pixel qu’on croit voir au bord est la bordure de la tuile, la même sélectionnée ou
non.

**La même sélection se voit parfaitement en vue Liste**, où la ligne n’a pas de tuile par-dessus :
c’est la comparaison qui rend le défaut incontestable, et elle dit aussi que le tort n’est pas
dans `rowSkin`.

**Deux panneaux au moins, pas un.** Vu à l’écran dans l’**étagère à assets** et dans le panneau
**Modèles**, dont la cellule active porte bien `bg-accent-soft` sans que la carte « GPT Image 2 »
se distingue des sept autres. `MediaTile` a **quatre** appelants — `AssetCard`, `Models`,
`ChannelTile`, et `ShelfCard` sur l’accueil : à regarder d’un bloc plutôt qu’un panneau à la fois.

**Ce qui marche déjà, et qui montre la voie** : l’anneau de focus, lui, se voit — la cellule
atteinte au clavier porte un `ring-accent` net autour de la tuile. Le focus est dessiné **par
dessus**, la sélection **par dessous**. C’est toute la différence, et c’est probablement là que la
réponse se trouve.

> Ne pas confondre les deux états en les réglant : une cellule peut être focalisée sans être
> sélectionnée, et l’inverse. L’entrée 9 vient justement de séparer ce que ces cellules
> annoncent ; il s’agit ici de leur faire dire à l’œil ce qu’elles disent déjà au lecteur d’écran.

### 12. L’accueil ne dit pas ce que cliquer va faire — et ça n’ouvre jamais le fichier

**Vu le 9 août 2026, capture à l’appui.** « Je clique sur une vignette, il y a une activité, mais ça
n’ouvre pas le fichier, et je ne comprends pas ce qui se passe. »

**Le fichier ne s’ouvre pas parce qu’aucune étagère n’ouvre quoi que ce soit.** Trois étagères
dessinent le **même carré** — même `ShelfTile`, même taille, même survol — et font **trois choses
différentes**, dont aucune n’est « ouvrir » :

| Étagère | Ce que le clic fait |
|---|---|
| **Ce que vous avez produit** | `recreate(asset.type, generation)` — **relance une génération** avec les paramètres d’origine |
| **Votre bibliothèque** | `useCloud.pull([asset.id])` — **rapatrie** l’asset dans le projet, d’où les « 1 asset rapatrié » du journal |
| **Votre bibliothèque**, asset déjà rapatrié | **rien** : `fetchable` faux retire le `onClick`, et la vignette devient inerte sans le dire |

Sur la capture, la **même image** figure dans les deux étagères — donc deux carrés identiques, côte à
côte dans la même page, l’un qui régénère et l’autre qui télécharge.

**L’intention est écrite, mais nulle part visible.** Chaque vignette porte bien son verbe —
`home.creations.recreate`, `home.library.fetch` — mais dans un **`aria-label`** : un lecteur d’écran
l’entend, l’œil ne le voit jamais. Le `hint` est un `title` natif, donc une infobulle du système
après un temps d’arrêt. Ce qui reste à l’écran est un `hover:opacity-90`, identique pour les trois.

Ce n’est donc pas un défaut de compréhension mais **d’affordance** : le studio a trois verbes et les
dessine tous pareil. Ce qui manque est ce qui les distingue à l’œil — le verbe sur la carte ou au
survol, un état visible pour la vignette inerte, et une réponse à la question « et si je veux
seulement l’ouvrir ? », qu’aucune des trois étagères ne pose aujourd’hui.

> À trancher au moment de traiter : « ouvrir » est-il l’action attendue par défaut sur ces
> vignettes, les verbes actuels devenant secondaires ? La capture dit que c’est ce qu’on croit
> cliquer.

### 13. L’activité est affichée deux fois

**Même capture, même jour.** La bande « Activité récente » de l’accueil montre ce que le volet du
bas montre déjà, et ça n’a pas à être sur l’accueil.

C’est bien la **même source**, pas deux vues d’une même idée : `home/sections/Activity.tsx` lit
`useActivity(state => state.entries)`, exactement comme `ActivityList`, et sa JSDoc dit qu’elle
emprunte au volet ses glyphes, ses teintes et son message pour ne pas en diverger. Elle est donc
redondante par construction.

**Rien n’est perdu en la retirant** : `ActivityStatus` est dans la ligne d’état en permanence — son
icône `mdiHistory` s’affiche même sans échec — et le volet complet, filtres compris, est à un clic.
Ce qui manque à l’accueil ne manque nulle part.

**Le mécanisme existe déjà** : les sections de l’accueil sont ordonnables et masquables
(`hiddenHomeSections`, le menu « … » visible en haut à droite d’une bande). C’est donc un
**changement de défaut**, pas une suppression — la section reste disponible pour qui la veut. Que
ce menu n’ait pas été trouvé est un retour en soi, et il rejoint l’entrée 12 : l’accueil ne montre
pas ce qu’il permet.

### 14. Réordonner les espaces au glisser, Accueil restant fixe

**Demandé le 9 août 2026.** Mettre Image avant 3D, ou l’ordre qu’on veut, en **glissant** les
entrées de la barre du haut. **Accueil ne bouge pas** : il reste en tête.

**Accueil est déjà hors de la liste, structurellement**, et il n’y a rien à protéger : `TitleBar`
rend son bouton **avant** la boucle, il n’appartient pas à `WORKSPACES`, et le commentaire dit
pourquoi — « the home covers the spaces rather than being one of them ». Il suffit de ne pas
l’ajouter à ce qui devient réordonnable.

**L’ordre est en dur** dans `WORKSPACE_IDS` (`shared/domain/workspace.ts`) ; `WORKSPACES`
(`helpers/workspaces.ts`) en dérive avec les icônes, et `TitleBar` le mappe tel quel.

**Le patron à suivre existe, et il est à côté.** L’accueil ordonne déjà ses sections : l’ordre vit
dans les réglages (`settings.home.sections`), et le déplacement est une **fonction pure du domaine
partagé** — `movedHomeSection`, `canMoveHomeSection` — dont l’interface n’est que le déclencheur.
La même découpe vaut ici : l’ordre dans les réglages, le déplacement dans
`shared/domain/workspace.ts`, testable sans rendre quoi que ce soit.

**Ce qui n’existe pas et qu’il faudra écrire : le glisser lui-même.** L’accueil réordonne par un
menu « Monter / Descendre », pas au glisser. Rien dans `src/` ne réordonne une liste à la souris —
les seuls glissers du studio déplacent des assets (`DraggableAsset`, `AssetDropTarget`) ou du temps
(`TimelineCanvas`).

**Deux surfaces montrent cet ordre, pas une.** `home/sections/Tools.tsx` mappe `WORKSPACES` lui
aussi : réordonner la barre sans réordonner l’accueil laisserait deux vérités à l’écran, dans la
même application. Le reste du code ne lit `WORKSPACE_IDS` que comme un **ensemble** (`includes`,
`find` — `tool.ts`, `document.ts`, `main/menu/index.ts`), donc l’ordre n’y casse rien.

> **Le piège est le lieu.** Le `header` de la barre de titre est en `WebkitAppRegion: 'drag'` — la
> zone par laquelle macOS déplace la fenêtre — et le `nav` repasse en `no-drag` pour rendre les
> boutons cliquables. Un glisser HTML5 qui part d’une barre de titre est un cas connu de conflit
> avec le déplacement de fenêtre. Ça peut marcher, ça ne se prouve pas au test unitaire : à
> vérifier à l’écran, port de debug, avant de considérer l’entrée traitée.

### 15. Un panneau ne déclare pas ce dont il a besoin — l’Explorateur sans projet

> Les entrées **15, 16 et 17** forment un seul chantier, décrit au **§ 3.7 de `docs/REPRISE.md`** :
> la couche projet, et le dossier qu’on donne à l’utilisateur.


**Demandé le 9 août 2026.** Sans projet ouvert, pas d’Explorateur : un projet est le dossier qui
tient les documents et les assets, et l’Explorateur n’a rien à explorer sans lui.

**Le panneau connaît déjà la règle, il l’applique juste autrement.** `Explorer.tsx:36` fait
`if (!projectPath) return <EmptyState message={t('explorer.noProject')} />` — il se dessine, vide,
en disant qu’il n’y a pas de projet. La demande est qu’il **ne soit pas là**.

**Et l’accueil, lui, tranche déjà dans ce sens.** `HOME_SECTIONS` donne à chaque bande un
`requires: ['project' | 'api']`, et la règle est écrite noir sur blanc dans `visibleHomeSections` :
« a section whose requirements are unmet is **dropped rather than drawn empty** ». La section
`explorer` de l’accueil porte `requires: ['project']`. Donc **la même question a déjà reçu sa
réponse à trois mètres de là**, et les panneaux du dock font l’inverse.

**Ce qui manque est donc une notion, pas un `if`.** `ToolPlacement` (`shared/domain/tool.ts`)
déclare `id`, `zone`, `slot`, `workspaces` — **jamais de prérequis**. Chaque panneau se débrouille
seul, et ils sont **cinq** à lire `useProject` chacun de son côté : `Explorer`, `Generator`,
`AssetBrowser`, `AssetBrowserActions`, `Apps`. Porter `requires` dans `TOOL_PLACEMENTS` réunit ces
cinq réponses en une règle, et la rend testable sans rendre quoi que ce soit — exactement la
découpe de l’accueil.

**Tranché le 9 août 2026 : le panneau reste, on lui donne sa sortie.** Plutôt que le retirer, lui
mettre le bouton qui ouvre ou crée un projet — **aujourd’hui il faut retourner sur l’accueil pour
ça**, et repasser par la page d’accueil pour sortir d’un panneau vide n’est pas un chemin.

Ce choix évite au passage le piège de l’autre : retirer un panneau touche le **layout persisté**
— Dockview est remonté par espace, et un panneau ajouté à l’API sortante est jeté par le `fromJSON`
du suivant (§ 3.1 de `REPRISE`). Un panneau qui disparaît et revient avec le projet risquait de
perdre sa place plutôt que de la retrouver. Le panneau qui reste et se rend utile ne pose pas la
question.

**Les deux gestes existent déjà, ils ne sont simplement offerts que sur l’accueil.** `openPicked()`
et `createPicked()` sont sur le store `useProject`, et leurs **quatre** appelants sont tous sur
l’accueil : `Projects.tsx`, `Tools.tsx` (les deux), `Spotlight.tsx`. Rien à écrire côté mécanique.

**Et `EmptyState` porte déjà une action** — `action?: { label, onClick }`, décrite comme « the way
out, for a panel whose emptiness the user can act on ». Celui de l’Explorateur n’en passe aucune,
alors que le composant l’attend. C’est **une prop à remplir**, pas un composant à écrire.

**Un point à trancher, un seul.** `EmptyState` n’accepte **qu’une** action, délibérément : « every
panel offers its way out the same way, and a node would let each one grow its own button ». Or il
en faut deux ici — ouvrir un projet existant, et en créer un. Deux réponses possibles :

- **une action secondaire dans `EmptyState`**, ajoutée une fois pour tous les panneaux — dans
  l’esprit du composant, qui existe justement pour que chaque panneau n’invente pas ses boutons ;
- **une seule action, « Ouvrir un projet… »**, la création restant sur l’accueil — mais c’est
  précisément la moitié qui manquait.

La première réponse est la bonne si la création doit être atteignable de là, et c’est ce qui a été
demandé.

**Reste à décider quels panneaux déclarent quoi.** L’Explorateur, l’étagère à assets et
l’inspecteur exigent un projet, sans doute. Le **Générateur** est la vraie question : générer sans
projet produit un job qui ne se collecte nulle part — « un job ne collecte que dans son propre
projet » (§ 3.6). Soit il exige un projet, soit il faut dire ce que devient ce qu’il produit.

### 16. Ouvrir un projet ne dit rien quand ça rate, et le manifeste n’est pas défendu

**Demandé le 9 août 2026**, à la suite de l’entrée 15 : c’est le même bouton qui va ouvrir ce
sélecteur. Le but énoncé — **un projet reste fiable même modifié de l’extérieur, et ce qui rate le
dit clairement**.

Le dossier d’un projet est **territoire de l’utilisateur** : le code le dit deux fois (« A project
folder is user territory: its manifest can be edited, truncated or replaced »). Il est édité,
déplacé, synchronisé, sauvegardé, ouvert dans un autre outil. Ce qui suit est ce qui arrive alors.

**Ce qui tient déjà, et qu’il ne faut pas défaire.** Le listing des documents est solide : le
dossier fait foi sur l’extension, un document illisible ne coûte pas le listing des autres, un
dossier absent rend `[]` plutôt que d’échouer, et la lecture est séquentielle pour ne pas épuiser
les descripteurs. `open()` **répare** en repassant `ensureFolders` : un `assets/vid` supprimé à la
main revient tout seul. Et le catalogue neuf est ouvert **avant** que l’ancien soit lâché, pour
qu’une base illisible ne laisse pas le studio sans projet alors que l’interface en montre un.

**Les quatre trous, du plus visible au plus sournois :**

| Ce qui arrive | Ce qui se passe aujourd’hui |
|---|---|
| On désigne un dossier qui n’est pas un projet | `readFile` échoue sur `project.json`, l’erreur remonte l’IPC telle quelle. Les appelants font `() => void openPicked()` : personne ne l’attrape. L’utilisateur lit un `ENOENT … project.json` au lieu de « Ce dossier n’est pas un projet Scenario » |
| Le manifeste est tronqué ou bricolé | Même chose : une `ZodError` brute, qui ne dit pas quel champ manque |
| Le projet vient d’une **version future** du studio | **Il s’ouvre**, et le studio écrit dedans avec son modèle à lui |
| Le projet est ouvert et refermé cent fois | `updatedAt` ne bouge jamais : il vaut `createdAt` à vie |

**Le troisième est le plus grave, et la règle qui manque est déjà écrite dix lignes plus bas.**
`documentEnvelope` plafonne sa version — `z.number().int().min(1).max(DOCUMENT_VERSION)` — avec ce
commentaire : « **Capped, not merely floored**: a file written by a later build must be refused
rather than read as if it were this one and silently flattened by the next save. » Le manifeste,
dans le même fichier, ne porte que `min(1)`. Le raisonnement est identique et l’enjeu plus grand :
un document aplati, c’est un fichier ; un projet aplati, c’est le dossier entier.

**Le quatrième est un champ qui ment.** `updatedAt` est écrit une fois, à la création
(`store.ts:98`), et **aucune autre écriture du manifeste n’existe**. Deux réponses possibles, et
il faut en choisir une : l’écrire à chaque fermeture de projet, ou le retirer du manifeste. Un
champ qu’on affiche un jour en croyant qu’il dit quelque chose est pire que pas de champ.

**Et le sélecteur ne filtre rien** : `pickPath('folder')` est un `openDirectory` générique, donc
n’importe quel dossier est désignable. C’est cohérent — le manifeste est la vérité, pas
l’extension — mais ça met tout le poids sur le message d’échec, qui est justement ce qui manque.

**Ce que ça demande :** un type d’erreur nommé plutôt qu’une exception brute (`NoProjectError`
existe déjà et donne le patron), ses clés dans les deux bundles i18n, la version du manifeste
plafonnée comme celle des documents, et une décision sur `updatedAt`. Deux des quatre points sont
dans le main — c’est un chantier, il se traite d’un bloc.

### 17. Le dossier d’un projet perd son extension, et sa mécanique passe sous le tapis

**Décidé le 9 août 2026.** Un projet est un dossier : lui coller `.scenario` n’a pas de sens. Et
`project.json` ne regarde pas l’utilisateur — il doit être masqué, comme **tout ce qui n’est pas
fait pour lui**.

**L’extension ne sert à rien, vérifié plutôt que supposé.** `PROJECT_EXTENSION` n’a **qu’un seul
usage** dans tout `src/` — `store.ts:90`, pour fabriquer le nom du dossier à la création. Elle
n’est **déclarée nulle part au système** : aucune `fileAssociations`, aucun type de document dans
la configuration de build. Elle n’ouvre donc rien au double-clic, macOS ne la traite pas comme un
paquet, et la reconnaissance ne s’en sert pas — c’est le manifeste qui dit qu’un dossier est un
projet, jamais son nom. **Une extension sans association est une décoration.**

> L’extension aurait pu servir à une chose, non faite : déclarer `.scenario` comme paquet macOS,
> ce qui aurait montré le projet comme **un seul fichier** double-cliquable. C’est l’inverse de ce
> qui est décidé ici, et c’est écrit pour que la décision soit prise en connaissance de cause,
> pas pour la rouvrir.

**Et la retirer ne casse aucun projet existant** : `open(path)` reçoit un chemin absolu et ne teste
jamais l’extension. Les dossiers déjà nommés `X.scenario` continueront de s’ouvrir tels quels.

**Le manifeste caché, lui, demande une migration** — les projets existants portent `project.json`,
et un studio qui ne cherche que `.project.json` ne les ouvrirait plus. Lire les deux et écrire le
nouveau, le temps que le parc tourne.

> **Un point de plateforme à ne pas découvrir en recette** : le point initial masque sur macOS et
> Linux, **pas sur Windows**, qui a besoin de l’attribut `FILE_ATTRIBUTE_HIDDEN` — que Node
> n’expose pas. Un dossier technique nommé `.index` a le même problème, et il existe déjà. Le
> pipeline empaquette les trois plateformes : la décision doit valoir sur les trois, ou dire
> laquelle elle laisse de côté.

**Inventaire de ce qui vit dans un projet**, puisque la règle est « masquer ce qui n’est pas pour
l’utilisateur » :

| Dossier | Pour qui | Aujourd’hui |
|---|---|---|
| `assets/` et ses six sous-dossiers | **l’utilisateur** — ce sont ses fichiers | visible, et ça doit le rester |
| `documents/` | **l’utilisateur** — son travail | visible, et ça doit le rester |
| `.index/` (catalogue, proxies, peaks, filmstrips) | la machine — cache reconstructible | déjà masqué |
| `layouts/` | la machine — arrangement des panneaux | **visible, et créé dans chaque projet sans que rien n’y écrive jamais** |
| `project.json` | la machine | visible — c’est l’objet de cette entrée |

**`layouts/` est le cas le plus net** : il est dans `PROJECT_FOLDERS`, donc créé à chaque
ouverture, et c’est sa **seule** occurrence dans tout `src/`. Les arrangements sont persistés dans
le `localStorage` du renderer (`scenario-studio:layouts`), pas là. C’est un dossier vide posé chez
l’utilisateur. Deux issues, pas trois : ou il servira un jour et il passe sous `.index/`, ou il ne
sert pas et il ne doit pas être créé.

**La limite à ne pas franchir.** « A project is a folder, not a binary file — versionable,
inspectable, repairable by hand » : c’est la raison d’être du format. Masquer la mécanique ne doit
pas rendre le projet opaque — les assets et les documents restent où l’utilisateur peut les voir,
les copier et les réparer. La règle est « cacher ce qui n’est pas à lui », pas « cacher ».

### 4. Aucun sélecteur de couleur ne s’ouvre

Les **quatre** `input type="color"` de l’application sont muets — pinceau, inspecteur, formulaire de
génération, réglages. Ce n’est donc pas un défaut de la barre d’outils : la cause est sous le
renderer.

Ce qui a déjà été écarté : aucun `preventDefault` sur le chemin du clic, aucun
`appendSwitch`/`--disable-features` dans le main, ni `alwaysOnTop` ni fenêtre transparente — les deux
configurations connues pour garder le panneau caché sur macOS. La littérature Electron ne documente
rien qui corresponde.

**Bloqué sur deux mesures**, qui exigent l’application avec le port de debug :

1. `input.showPicker()` dans un `try/catch` — ce qu’il lève, ou son silence.
2. `document.hasFocus()` juste après le clic — un panneau natif vole le focus ; s’il reste `true`,
   rien ne s’est ouvert du tout.

Si Electron n’expose aucun `ColorChooser`, la décision inscrite dans `BrushControls` — « un input
natif, délibérément, parce que macOS ouvre le sélecteur système » — tombe, et il faut un sélecteur
maison dans `design/`, partagé par les quatre appelants. C’est une décision de conception, pas une
correction.

---

## Fait

| Ce qui était signalé | Commit |
|---|---|
| Le champ de recherche des réglages changeait de largeur | idem |
| Fermer la dernière fenêtre laissait l’application ouverte sans interface | `bcc3f69` (feat/pinceau) |
| Les barres n’avaient pas toutes la même longueur | idem |
| Un scroll horizontal apparaissait à cause d’une valeur à seize décimales | idem |
| Le bleu du focus n’était pas celui du projet | idem |
| **(1)** Le menu horizontal du centre — parti dans un panneau « Vue » | `3ac739d` (feat/pinceau) |
| **(2)** La marge que la barre de défilement de macOS mangeait | idem |
| **(3)** `gap-1` partout où il traînait — 45 occurrences, 27 fichiers | `6ef915e` (feat/pinceau) |
| **(5)** Les lignes de l’Explorateur n’avaient aucun accès clavier | `776e85b` (feat/explorateur-clavier) |
| **(6)** Le double-clic sur un asset ne traversait pas les espaces, et se taisait | `33d31f3` (feat/double-clic) |
| **(8)** L’étagère à assets n’avait aucun accès clavier, ni sélection multiple | `a98357e` (feat/etagere-clavier) |
| **(9)** `role="option"` sans `listbox`, et `aria-selected` qui disait « ouvert » | `ea08ce0` (feat/aria-listbox) |
| **(25)** La croix des onglets passait sous le titre — la règle visait le mauvais nœud | *à commiter* |
| **(18)** Le formulaire de génération parlait anglais dans une application en français | `e0a07b2` (feat/i18n-schema-api) |
| **(7)** Aucun moyen de garder un réglage de matière pour la texture suivante | `c3ec714` (feat/styles-textures) |
| **(10)** Les filtres du journal revenaient à la ligne, orphelinant une famille | `71f3140` (feat/journal-filtres) |
| **(22)** L’avis « pas de ffmpeg » volait une ligne à l’étagère, trois en colonne | `8bb53b2` (feat/ffmpeg-notice) |
| **(28)** Les trois boutons de la ligne d’état offraient une cible de 12 × 12 | `53e1b34` (feat/cible-journal) |
| **(26)** Le focus tombait hors de la liste après un renommage en place | `42c1e50` (feat/focus-renommage) |
| **(31)** La Lame annonçait une coupe à la tête de lecture ; elle coupe au pointeur | `e5a75b4` (feat/lame-infobulle) |
| **(11)** La ligne d’état était collée au bord et alignée sur rien | `d66b811` (feat/ligne-etat) |




> **L’entrée 31 est la seule du lot dont les trois repères étaient justes** — cause, lieu, et
> remède. Elle est notée ici pour ce qu’elle a révélé à côté.
>
> **Le texte suit désormais la gomme plutôt que le manuel.** « Cut a clip where you click » aurait
> été la traduction fidèle du manuel, mais c’aurait été le **seul** des cinquante libellés `*Hint`
> à tutoyer l’utilisateur : la famille est impersonnelle, et `eraserPointHint` — « Effacer au
> passage du pointeur » — répond déjà à la même question pour un geste jumeau. D’où « Couper un
> clip sous le pointeur », miroir exact dans les deux langues.
>
> **Le test qui existait ne verrouillait rien.** `splits a clip under the blade` comptait les clips
> — deux après la coupe — ce qui est vrai d’une coupe au pointeur comme d’une coupe à la tête de
> lecture. La phrase que la barre affiche n’était donc protégée par personne. Le test ajouté gare
> la tête de lecture ailleurs et clique **à côté d’une frontière d’image** : la revue a montré que
> la première version passait par coïncidence, l’instant choisi tombant pile sur une frontière et
> le clip commençant à zéro — deux hasards qui rendaient l’égalité vraie sans que le calcul le
> soit.
>
> **Une incohérence trouvée en chemin, qui n’est pas de cette entrée** : la Lame n’a **aucun
> magnétisme**, là où `trim` et `move` aimantent aux bords des clips *et à la tête de lecture*,
> à huit pixels près (`snapCandidates`, `SNAP_THRESHOLD`). Mesuré : tête de lecture à un tiers de
> pixel du clic, la coupe l’ignore. La Lame arrondit seulement à l’image (`snapToFrame`, dans
> `splitClip`). Ce n’est pas un défaut de l’infobulle — qui dit maintenant vrai — mais c’est un
> geste de la timeline qui se comporte autrement que ses voisins.

> **L’entrée 26 avait le bon défaut et le mauvais remède**, et les trois repères qu’elle donnait
> sont faux — vérifiés un par un.
>
> Elle annonçait **trois surfaces** : `InlineRename` n’a que **deux** appelants, `LayerRow` et
> `StyleRow`. Les en-têtes de piste, qu’elle citait, ont leur **propre** `<input autoFocus>`
> (`TrackHeaders.tsx`) — et la JSDoc du composant se trompe de la même façon, elle se dit écrite
> « pour la pile de calques et les en-têtes de piste ».
>
> Elle demandait d’**ouvrir `focusCell`** : inutile. `CollectionCell` pose `tabIndex` sur **toute**
> cellule montée, `0` ou `-1` selon qu’elle est le point d’entrée clavier — un `-1` se focalise
> très bien par script. Le champ retrouve donc sa ligne par un `closest('[tabindex]')`, sans que
> `Collection` expose quoi que ce soit.
>
> **Le remède est allé là où le focus est emprunté**, pas là où il devrait atterrir : c’est
> `autoFocus` qui le prend, c’est au champ de le rendre. Trois lignes, aucune interface élargie.
>
> **Un second chemin, que seule la revue a vu.** Quand une ligne est ajoutée pendant la frappe —
> ce qu’une génération qui aboutit fait tout le temps — les lignes se remontent à d’autres index
> et celle qu’on éditait n’existe plus : `isConnected` est faux et le défaut revenait entier. La
> liste, elle, tient toujours son point d’entrée clavier (`[tabindex="0"]`), et c’est lui qui sert
> de repli. On ne revient pas sur sa ligne, mais on ne quitte pas la liste. Le test qui existait
> pour ce cas ne jugeait que le **nom** conservé, jamais le focus.
>
> **Ce qui reste ouvert, et qui n’est pas une négligence** : les en-têtes de piste ont le même
> défaut et ne sont atteints ni par ce correctif ni par celui que l’entrée proposait. Les
> réparer demande soit de rendre leur `<span>` focalisable — ce qui change le parcours clavier de
> la timeline —, soit de les faire passer par `InlineRename`, ce qui change leur habillage. C’est
> une décision de conception, pas une correction : elle revient à l’humain.

> **L’entrée 28 en cachait un troisième.** Elle nommait le journal et les générations ; la mise à
> jour (`UpdateStatus`) a la même forme, le même défaut, et n’était nommée nulle part. Le gabarit
> vit donc dans `styles.ts` sous `STATUS_BUTTON`, à côté de `chipSkin`, dont le commentaire décrit
> exactement ce qui serait arrivé sinon — trois surfaces, la troisième qui dérive.
>
> **Le remède que l’entrée proposait aurait défait l’entrée 11.** `--sc-control` sur le bouton est
> juste, mais seul il emporte la ligne : le pied n’ayant plus de hauteur propre, un bouton de 28 px
> la fait passer de **29 px à 40** — mesuré à l’écran, puis remesuré en retirant le correctif, pas
> déduit. Une marge négative d’une gouttière rend au flux ce que la cible prend : le bouton compte
> alors 16 px, sous les 17 px du fil d’Ariane, qui continue donc de dicter la hauteur.
>
> **Le critère est satisfait par la taille, sans exception** : 28 × 28 en confort, 24 × 24 en
> compact, mesurés. L’exception d’espacement qui les sauvait tenait au hasard de l’écart entre
> deux voisins.
>
> **Un effet de bord vu, mesuré et gardé** : au repos, l’icône du journal n’est plus collée au bord
> — 14 px au lieu de 6, puisqu’elle se centre dans une cible de 28. C’est le motif du rail, où le
> bouton s’aligne sur la marge et l’icône se centre dedans. La recoller demanderait de décentrer la
> cible, donc de cliquer à côté de ce qu’on voit.
>
> **Deux choses qui ne sont pas de cette entrée et restent ouvertes** : ces trois boutons n’ont
> jamais porté `FOCUS_RING` — ils gardent l’anneau natif du système, seule surface du studio dans
> ce cas ; et la mesure à l’écran s’est faite sur une instance à soi, port 9224 et `--user-data-dir`
> dédié, ce qui **contourne le verrou d’instance unique** et permet à plusieurs sessions de piloter
> chacune la sienne. Le MCP `electron` ne parlant qu’au 9222, la mesure est passée par CDP direct
> (`WebSocket` natif de Node, aucune dépendance) — le script est réutilisable.

> **L’entrée 11 se trompait sur ses DEUX prémisses, et les deux se mesurent.** Elle affirmait que
> « tout ce qui est au-dessus est posé à `--sc-gutter` du bord » : cette jauge n’est un retrait
> horizontal de bord de fenêtre **nulle part** dans l’application — ses usages sont l’épaisseur
> d’une poignée, deux paddings verticaux, une indentation. Les rails sont collés à 0. Ce qui tombe
> à 6 px, c’est le **bord du bouton** du rail, par l’arithmétique `(48 − 36)/2` — égal à la
> gouttière en confort, et pas en compact, où il vaut 5 contre 4. D’où **`--sc-rail-inset`**,
> dérivée de ses deux termes : ceux-ci étant redéclarés en compact, le `calc()` se réévalue seul.
>
> Elle affirmait aussi que « le `h-6` ne réserve rien : la ligne s’arrête au pixel du bas ». Il
> réservait `(24 − 16,5)/2 = 3,75 px` : le préflight Tailwind pose `line-height: 1.5` sur `html`,
> sans unité, et le CSS compilé montre que `text-[11px]` ne pose **que** `font-size`. L’air passe
> à 6 px en confort ; **en compact il reste à 4, délibérément** — c’est l’écart de tout le châssis
> à cette densité. Un plancher `min-h-(--sc-control)`, essayé sur recommandation d’une revue, a
> été retiré : contenu plus padding vaut 28,5 contre 28, et 24,5 contre 24, il ne mord jamais.
>
> Deux revues adverses se sont **contredites** sur la hauteur de boîte de ligne (13 px contre
> 16,5). C’est le CSS compilé qui a tranché, pas l’arbitrage.

> **L’entrée 22 a été corrigée quatre fois après `/simplify`, qui n’avait rien vu.** L’avis
> devient un triangle d’alerte dans la ligne de titre — `AssetBrowserActions` étant le `children`
> de `PanelHeader`, le même geste couvre la bande **et** la colonne, `ToolWindow` montant les
> actions inconditionnellement. Au passage, **le registre situait mal le `!lying`** : il est dans
> `AssetBrowser.tsx`, pas dans `AssetBrowserActions`, qui fait `lying &&`.
>
> Ce que les deux agents ont trouvé : l’infobulle s’ouvrait **vers le haut**, donc hors du panneau,
> alors que tous les en-têtes du dépôt utilisent `TIP_BOTTOM` ; le glyphe faisait 16 px au milieu
> de voisins à 14 (`ToolButton variant="header"` rend `iconSize ?? 14`) ; l’icône était peinte en
> `muted`, qui est ici le ton des états **réglés** (`AssetBadge`, `ProgressRow`) ; et le message
> n’avait **aucun canal hors pointeur** alors qu’il était permanent avant — WCAG 2.1.1.
> `react-tooltip` écoute déjà le focus, l’ancre ne le recevait jamais. `TooltipHost` ferme
> désormais sur Échap.
>
> **Les deux manuels décrivaient un bandeau disparu**, dans les deux langues, et le dépannage
> prenait la phrase pour un titre de section. Aucun test ne garde ce lien : `validate` serait
> resté vert sur une documentation devenue fausse.

> **L’entrée 10 avait raison sur la cause, et c’est assez rare ici pour le dire.** Le calcul la
> confirme : 376 px utiles dans le volet, ≈600 px de puces, et le cumul atteint 351 px juste
> **après** `Génération` — exactement la coupure décrite. Rien à rechercher.
>
> **Ce qu’elle ne disait pas, et qui change la portée du correctif** : le `Separator` est
> `aria-hidden` — « Decorative, hence hidden from assistive tech ». Le groupement que le retour à
> la ligne venait de détruire à l’œil **n’avait jamais existé** pour un lecteur d’écran. Les deux
> rangées sont donc des `role="group"` **nommés**, ce qui n’était pas demandé et qui coûte deux
> clés de plus : sans nom, les deux boutons « Tout » seraient rigoureusement indistinguables dans
> l’arbre d’accessibilité, même libellé et même rôle.
>
> **`flex-wrap` est conservé À L’INTÉRIEUR de chaque rangée, délibérément.** La largeur des puces
> suit la langue — « Échec » n’est pas « Failure » — donc aucune largeur de volet ne garantit une
> ligne. Ce qui est garanti, c’est qu’un débordement reste désormais **dans** sa famille au lieu
> de la couper en deux. C’est pour ça qu’élargir `w-96` n’aurait pas été le correctif, et pas
> seulement parce que ça n’aurait réglé « que la première moitié ».
>
> **Un cas de bord tranché, à ne pas rouvrir comme un défaut** : cocher les trois niveaux un par
> un laisse « Tout » éteint, alors que `matchesActivity` ne filtre alors plus rien. C’est voulu.
> « Tout » ne dit pas « rien n’est caché », il dit « aucun filtre n’est posé » — et trois filtres
> dont l’union couvre tout restent trois filtres. Les allumer ensemble donnerait quatre boutons
> actifs pour un seul état.
>
> **Et une trouvaille hors périmètre, qui sert l’entrée 21** : `Flyout` pose `role="menu"` sur son
> conteneur alors qu’il héberge des `role="group"` et des `<ul>`, et il n’implémente ni `Échap`,
> ni piège de focus, ni navigation aux flèches. L’entrée 21 ne parle que de la fermeture au clic à
> côté ; le rôle est à corriger dans le même geste, sous peine de laisser un menu qui n’en est pas
> un.

> **L’entrée 7 s’est faite dans le sens qu’elle demandait, mais pas avec la carte qu’elle
> donnait.** Trois de ses repères étaient faux, et chacun a coûté un détour.
>
> `MaterialSettings` a **quinze** champs, pas seize — l’entrée le disait trois fois. Le renommage
> n’était pas « ce que fait `LayerRow` » mais un composant déjà partagé, `InlineRename`. Et
> surtout, **l’inspecteur n’est pas le panneau Assets qu’elle citait en exemple** : Assets a un
> contenu, l’inspecteur en a huit — un calque, un clip, une piste, un asset, une scène, une
> texture. Un bouton posé sans condition dans son en-tête aurait proposé d’enregistrer un
> matériau pendant qu’un clip vidéo remplissait le panneau au-dessous. « Quelle face est
> dessinée » devient `inspectedTextureId`, que `Face` lit aussi : deux réponses à cette question
> auraient fini par se contredire.
>
> **Les deux décisions du 9 août tiennent telles quelles.** Les styles vivent dans `userData`, et
> un style ne porte que des valeurs. Rien n’est filtré à l’enregistrement, y compris ce qui est
> inerte sans la map correspondante — vérifié sur le fichier écrit : quinze champs, aucune map.
>
> **Ce que la revue a trouvé et que `/simplify` avait manqué**, une fois de plus. Le nom généré
> pouvait être un doublon : le bouton vit dans l’inspecteur, que le panneau n’a pas besoin d’avoir
> été ouvert pour, si bien que « Style 1 » repartait par-dessus un fichier qui en tenait déjà un —
> la collision même que `nextStyleName` disait éviter, qu’il évitait dans la liste qu’on lui
> donnait, et qu’on lui donnait vide. Une lecture en vol écrasait une écriture plus récente. Et
> **renommer ou supprimer étaient cent pour cent souris** : un `contextmenu` déclenché par
> Shift+F10 cible la cellule focalisée, jamais le `div` qui écoute à l’intérieur d’elle — un
> événement ne descend pas dans ses propres descendants. La ligne porte désormais un bouton de
> menu, comme celle d’un calque.
>
> **Deux corrections ont débordé sur du code partagé, et c’est tant mieux.** `InlineRename`
> commitait deux fois sur Entrée — le renommage étant asynchrone, le nom à l’écran est encore
> l’ancien quand le champ est démonté, donc la garde « abandonné en cours de frappe » répondait
> vrai ; les calques faisaient deux écritures depuis toujours. Et le fichier de transit renommé à
> sa place était écrit **trois fois** — notes de jobs, favoris, styles — le code le disant
> lui-même deux fois au lieu de l’enlever.
>
> **Reste à faire, et c’est un lot à part** : la 3D, où un style n’apporte que `color`,
> `roughness` et `metalness` — les trois scalaires de `MaterialDescriptor`.

> **L’entrée 18 s’est réglée autrement que les trois pistes qu’elle proposait.** Aucune n’a été
> prise : le dictionnaire (`src/shared/i18n/model-text.fr.json`) s’indexe sur **le texte anglais**
> et non sur la `key` du champ, parce que la moitié de ce que le panneau montre est une phrase
> écrite par le modèle, pas un nom de champ — indexer sur la clé aurait traduit « Max splat
> points » en laissant sa description anglaise juste dessous. La contrepartie est assumée : un
> libellé changé côté Scenario retombe en anglais au lieu d’échouer.
>
> **Et la question de fond a été tranchée par une vérification, pas par un arbitrage** : l’API
> Scenario ne connaît aucune langue — ni `Accept-Language`, ni paramètre de locale dans
> `models.retrieve`, rien dans le SDK, vérifié sur les 210 pages de `docs/scenario-api/`. Ce texte
> est donc traduit dans le studio ou nulle part. C’est le premier bundle du dépôt dont les clés
> sont de l’anglais, et `CLAUDE.md` nomme désormais l’exception.

> **L’entrée 8 cachait un défaut plus gênant que le clavier.** La ligne s’était approprié les deux
> gestes — `DraggableAsset` sélectionnait au `pointerdown`, ouvrait au double-clic — d’où des
> cellules inertes, mais surtout : **la sélection au `pointerdown` déplaçait l’ancre avant que le
> clic de la cellule ne la lise**, si bien qu’un shift-clic ne pouvait jamais étendre une plage.
> Dans le seul panneau dont les actions sont plurielles. Le panneau reprend les deux gestes ; la
> ligne ne garde que le glisser et son menu.
>
> **Trois défauts de plus, trouvés en revue et corrigés avec.** Le `mode` de `pickFrom` était jeté,
> donc un ⌘-clic remplaçait la sélection au lieu de l’enrichir ; un glisser ou un clic droit
> écrasait une sélection multiple, y compris un glisser lâché dans le vide ; et la dérivation
> « quels assets sont sélectionnés », écrite deux fois, faisait repeindre l’étagère à chaque calque
> choisi ailleurs — elle descend dans le store, en `selectedAssetIds`.
>
> **Vérifié à l’écran le 9 août 2026** (projet réel, `pnpm start:debug`), après un premier essai
> resté en panne d’outil. Ce qui débloque le MCP `electron` : l’étagère se nomme depuis l’entrée 9
> — `[role="listbox"][aria-label="Assets"] [data-cell="N"]` distingue enfin ses cellules de celles
> des cinq autres collections, là où `electron_click_by_text` répondait « cliqué » sans que rien
> ne bouge. Le shift-clic seul n’a pas d’outil : aucun clic du MCP ne porte de modificateur, il a
> fallu dispatcher le `MouseEvent`, ce que le correctif rend fidèle puisque la sélection est
> repassée sur `click` et n’écoute plus `pointerdown`.
>
> Ce qui a été vu : le clic peint la cellule et lui donne le focus (`aria-selected` passe à
> `true`) ; le shift-clic depuis cette ancre étend la plage aux trois images, et l’inspecteur
> compte « Éléments 3 » ; Entrée pose le calque de la cellule focalisée. Et le geste de l’entrée
> 6, depuis l’espace **3D**, document Image ouvert derrière : le double-clic bascule sur Image,
> ramène l’onglet au premier plan et pose l’image en calque, d’un seul geste. Aucune erreur en
> console.

> **L’entrée 9 est la seule du registre qui ne se juge pas à l’œil**, et c’est pourquoi elle y a
> vécu si longtemps. Le rôle du conteneur et celui de la cellule sont devenus **une seule
> décision** (`rolesFor`) : `listbox`/`option` quand les lignes se sélectionnent, `list`/`listitem`
> quand elles ne peuvent qu’être ouvertes, rien quand elles ne répondent à rien. `aria-selected` ne
> se pose plus que sur un `option`, ce qui règle du même coup le « ouvert » de l’Explorateur.
>
> **Trois défauts introduits par ce déplacement, trouvés par axe-core avant la fusion** : un
> `listbox` sans nom est une violation WCAG 2.0 A (4.1.2) et aucun appelant n’en fournissait — le
> `label` est désormais requis ; le compte annoncé était celui de la **fenêtre virtualisée**, donc
> « 1 sur 35 » sur un catalogue de 2000 modèles, d’où `aria-posinset`/`aria-setsize` ; et
> `aria-multiselectable` est **déclaré par l’appelant, jamais déduit** — `pickFrom` offre shift et
> ⌘ à tous, mais trois panneaux sur six n’en gardent qu’un et annonceraient une plage qu’ils ne
> construisent pas.

> **L’entrée 6 est tranchée dans le sens qu’elle proposait** : c’est le comportement de
> l’Explorateur qui était le bon. Une destination est prête dès qu’un document de son genre est
> ouvert **où qu’il soit** (`documentOfKind`, posé à côté d’`activeIdOfKind` qu’il complète), la
> poser amène cet onglet au premier plan, et l’onglet qu’on regarde garde la priorité sur l’ordre de
> la cascade — celle-ci ne tranche qu’entre les destinations qu’on ne regarde pas. Un double-clic
> qui ne peut rien faire le dit, sous la portée `assets.open`, rangée dans les gestes : deux refus
> parlent deux fois.
>
> **Trois défauts trouvés en revue, corrigés avant la fusion.** Le premier valait la revue à lui
> seul : **écrire dans un onglet jamais monté détruisait son fichier** — il ne tient aucun état,
> donc `restoreDocument` le prenait pour déjà chargé, son fichier n’était jamais lu, et le ⌘S
> suivant écrivait par-dessus. La pose attend désormais la lecture. Ensuite : le **montage**
> acceptait puis refusait en silence, en changeant d’espace pour ne rien faire ; et
> `addAssetToSequence` lisait lui-même l’onglet du premier plan, seule destination sur six à le
> faire.
>
> **La bascule d’espace a été vue** — le 9 août 2026, une fois l’application libre : depuis
> l’espace **3D**, un document Image ouvert derrière, le double-clic sur une image de l’étagère
> bascule sur Image, ramène l’onglet au premier plan et pose le calque. Le détail de la manœuvre
> est avec l’entrée 8, avec laquelle elle a été menée.

> **L’entrée 5 n’avait pas la cause qu’elle croyait.** Le détournement de `selectedIds` était réel,
> mais ce qui privait les lignes du clavier était ailleurs : dans `Collection`, le rôle, le tab stop
> et les touches n’étaient posés **que si l’appelant fournissait `onSelect`**. L’Explorateur n’en
> fournit pas — sa notion de sélection est « ce qui est ouvert » — donc ses lignes tombaient dans la
> branche inerte du composant. Le geste manquant, « activer », est désormais une prop du composant
> (`onActivate`) : Entrée ouvre, Espace laisse défiler la liste, et le double-clic n’est plus câblé
> par l’appelant.
>
> **Deux défauts du tab stop, trouvés en revue et corrigés avec.** Il était un index dans la liste
> entière alors que la virtualisation n’en monte qu’une fenêtre : un document ouvert hors de cette
> fenêtre sortait le panneau entier de l’ordre de tabulation — le défaut même que l’entrée ferme. Et
> il était dérivé de `selectedIds` sans qu’une sélection existe, de sorte que la tabulation
> atterrissait sur une ligne que personne n’avait désignée.
>
> **Vérifié à l’écran** (projet réel, `pnpm start:debug`) : le clic focalise la ligne, les flèches
> déplacent le focus, Entrée ouvre le document dans son espace, Espace n’ouvre rien. **Ce que ce lot
> laisse ouvert est aux entrées 8 et 9.**

> **L’entrée 1 est livrée, le manque qu’elle croisait ne l’est pas.** Les réglages passent par
> `stores/skybox-views`, le panneau « Vue » les offre, et le centre ne porte plus que la barre
> d’outils et les règles. Un seul espace était concerné — vérifié : Vidéo et Audio ont bien une
> rangée horizontale, mais c’est une barre de transport, un outil et non un menu. **Les trois vues
> mortes du skybox restaient mortes** au moment de ce lot — le déplacement ne les avait ni réparées
> ni aggravées ; elles ont été branchées depuis, par `feat/skybox-vues` (§ 3.5 de `REPRISE`).

> **L’entrée 3 est close et verrouillée.** Les `gap-1.5` sont laissés tels quels, délibérément : ils
> sont déjà plus larges qu’un, et quelques rangées denses reposent sur ce demi-cran. Un test
> (`design/spacing.test.ts`) refuse désormais tout `gap-1` nu dans le renderer — vérifié dans les
> deux sens. La crainte notée à l’époque (« les barres d’outils tiennent 24 px en compact ») ne s’est
> pas matérialisée : `--sc-control` fixe la hauteur des contrôles, l’écart ne fait que les séparer.

---

## Vérifier à l’écran ce qui se voit

**Un jalon visuel validé uniquement par des tests unitaires n’est validé qu’à moitié.** Règles,
repères, zoom, compositing, pointillés, viewport éclairé : rien de tout cela ne se prouve dans
vitest. L’espace Textures en porte la trace — un viewport noir venait de l’environnement studio
manquant, ce qu’aucun test n’aurait dit.

Le MCP `electron` pilote la fenêtre après `pnpm start:debug`. **Le port 9222 est unique** : si une
autre session a déjà lancé l’application, c’est son instance qu’on pilote, et on croit mesurer sa
propre branche. Il faut aussi un projet ouvert, donc `secrets/.env` copié dans le worktree — une
session s’est déjà vu refuser cette copie par la politique de permissions, le prévoir.

C’est aussi la raison d’être de ce fichier. **Aucun test ne s’exécute sur l’application lancée** :
les 357 fichiers de test sont unitaires, `find src -name '*.e2e.*'` ne rend rien. Ouverture,
parcours des six espaces, détachement d’un panneau, fermeture propre, consoles main et renderer sans
erreur : vérifié à la main, à chaque fois, par qui livre. Playwright a été **reporté le 8 août 2026,
pas abandonné** (suivi `L7` dans `.claude/loop/BACKLOG.md`) ; d’ici là, ce registre est le seul filet.

---

## Les captures d’écran attendues

Le `README.md` racine et les deux guides utilisateur référencent des images qui **n’existent pas
encore**. Tant qu’un fichier manque, son emplacement reste visible dans le markdown sous forme de
commentaire HTML — rien ne casse.

| Fichier | Sujet |
|---|---|
| `docs/images/studio-3d.png` | Le studio dans l’espace 3D : rails aux deux bords, vue de scène au centre, arbre de scène et maillages à gauche, modèles à droite, étagère à assets en bas |
| `docs/images/studio-image.png` | L’espace Image : pile de calques, volet d’un groupe d’outils ouvert |
| `docs/images/settings-account.png` | La fenêtre de Réglages, section Compte, état authentifié visible |
| `docs/images/models-grid.png` | Le panneau Modèles en grille, facettes ouvertes |
| `docs/images/generate.png` | Le panneau Génération avec le formulaire d’un modèle, et la bande Jobs avec un job en cours |
| `docs/images/image-tools.png` | Un document image, volet du groupe Forme ouvert, pile de calques visible |
| `docs/images/scene-3d.png` | La vue 3D avec un maillage sélectionné, l’arbre de scène et le panneau Maillages |
| `docs/images/timeline.png` | L’espace Vidéo : timeline avec plusieurs clips, moniteur au-dessus |

**Conventions.** PNG, thème sombre, densité confort. **2560 × 1600** pour les vues plein écran,
recadrées au panneau pour les vues de détail. Fenêtre sans ombre portée du système — elle se voit mal
sur le fond clair de GitHub. **Un projet réel ouvert, avec de vrais assets** : une fenêtre vide ne
montre rien de ce que le logiciel sait faire. **Aucun identifiant, aucun jeton, aucun chemin
personnel lisible** ; la section Compte se capture avec des champs remplis mais masqués.

`pnpm start:debug` ouvre le port 9222, ce qui permet de déclencher les captures depuis l’extérieur
plutôt qu’à la main.

---

## Se voit à l’écran, se traite ailleurs

Ces chantiers **se voient**, mais leur cause n’est pas la mise en page. Ils vivent dans
`docs/REPRISE.md`, au § indiqué — **ici, une ligne et rien de plus**, pour qu’on ne les cherche pas
deux fois et qu’aucune des deux versions ne devienne fausse.

- **La dureté du pinceau n’est pas implémentée**, et crayon et pinceau rendent le même outil — § 3.2.
- **La garde manquante sur le format des signatures du registre** (`'P'` au lieu de `'KeyP'`) — § 3.2.
- **⌘Z se fragmente quand une génération aboutit pendant un glissement** — § 3.6. La ligne fautive
  sert les six espaces : ce n’est pas un rustinage local.
- **La croix de fermeture d’onglet** — § 3.1. Celle de Dockview est masquée **délibérément** (elle
  retire un panneau, ce qui n’est pas fermer un document). Ne pas « réparer » ce masquage.
- **`app/**` et `panels/**` ne sont sous aucun budget de couverture** — § 3.1.
