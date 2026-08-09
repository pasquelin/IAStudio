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

### 7. Un panneau Styles dans l’espace Textures

**Demandé le 9 août 2026.** C’est une fonctionnalité, pas un défaut — elle est ici parce qu’elle se
joue entièrement à l’écran.

Un panneau qui liste des **styles de rendu prédéfinis** — effet métal, effet plastique, effet bois —
pour ne pas refaire les mêmes réglages à chaque texture. On en ajoute depuis l’inspecteur, par un
**petit bouton dans le header, en haut à droite**, comme le panneau Assets, qui enregistre les
réglages courants. Le nom est **généré automatiquement** et se change dans le panneau Styles par un
**clic droit → Renommer**, comme dans les applications JetBrains.

**Rien de tout cela n’existe** : aucune notion de preset ni de style de matériau dans `src/` (les
occurrences de `preset` sont ailleurs — `DynamicForm`, ffmpeg). En revanche, les quatre briques sont
déjà là et aucune n’est à écrire :

| Ce qu’il faut | Ce qui existe déjà |
|---|---|
| Ce qu’un style capture | `MaterialSettings` (`engines/texture/texture-state.ts`) — 16 champs, de `color` à `rotation`, plus `DEFAULT_TEXTURE_MATERIAL` gelé |
| Le bouton dans le header | `AssetBrowserActions.tsx`, `variant="header"` — le motif qu’il cite |
| Le clic droit → Renommer | `design/ContextMenu.tsx`, et `AssetMenu.tsx` comme exemple |
| Le renommage lui-même | `LayerRow.tsx` le fait déjà, double-clic sur le nom seul, clé i18n `layers.rename` |

Le panneau se déclare dans `TOOL_PLACEMENTS` (`shared/domain/tool.ts`), où `channels` occupe déjà
`zone: 'right', slot: 'primary'` pour l’espace Textures. **Il va dans la colonne de droite** : c’est
du rendu, pas de la génération.

**Les deux questions sont tranchées** — 9 août 2026.

**Les styles vivent dans `userData`**, pas dans le projet : ils suivent la machine et servent quel
que soit le projet ouvert.

**Un style ne porte que des valeurs, jamais de maps.** C’est le rangement dans `userData` qui
l’impose, pas une préférence : une map est un asset du **catalogue d’un projet**, désigné par un id
qui n’a pas de sens dans le projet suivant. Les copier plutôt que les référencer ne sauve rien — ce
sont des images 4K, hors catalogue, hors hash, et le style pèserait des centaines de mégaoctets. Le
fond de l’affaire est plus simple : **un style dit comment lire les maps de la texture courante, pas
lesquelles**. C’est ce qui lui permet de s’appliquer à n’importe quelle texture ; un style qui
apporte ses propres canaux ne s’applique plus, il remplace.

Conséquence à connaître, qui n’est pas un défaut : **une bonne moitié des 16 champs est inerte sans
la map correspondante** — `roughnessRange` et `metalnessRange` remappent une map, `normalScale` et
`invertNormalGreen` n’agissent que sur une normale, `heightScale`, `aoIntensity`, `edgeIntensity` de
même, et `tiling`/`offset`/`rotation` ne décalent rien s’il n’y a rien à décaler. **Ne pas les
filtrer à l’enregistrement** : un style amputé de ses valeurs inertes deviendrait faux dès que la
texture se complète.

Deux espaces les lisent, et ils ne lisent pas la même chose :

| Espace | Ce qu’un style y apporte |
|---|---|
| **Textures** | les 16 champs de `MaterialSettings` — c’est son domaine |
| **3D** | `color`, `roughness`, `metalness` seulement — `MaterialDescriptor` (`shared/domain/scene.ts`) n’a que ces trois scalaires, plus ses cinq slots de texture |

Les trois champs communs sont justement ceux qui font l’essentiel d’un « effet métal » ou d’un
« effet plastique » quand il n’y a pas de maps. Le précédent d’un partage entre les deux inspecteurs
existe déjà : `EnvironmentSection` leur est commun, et sa JSDoc dit pourquoi.

**Ce qu’il reste à trancher** : `MaterialSettings` ne vit aujourd’hui que dans `engines/texture/`. Un
style lisible par les deux espaces demande que la forme sérialisée descende dans `shared/domain/` —
sans quoi le main, qui écrira le fichier de `userData`, ne peut pas la typer.

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

### 22. L’avis « pas de ffmpeg » vole une deuxième ligne à l’étagère

**Vu le 9 août 2026, capture à l’appui.** « Préparation vidéo indisponible : ni copie allégée ni
forme d’onde. » s’écrit sous la barre de l’étagère et lui prend une ligne entière. **Il doit
tenir sur la ligne de la barre, pas en dessous.**

**Et la règle qu’il enfreint est déjà écrite, pour cette barre-là.** `AssetBrowserActions` porte
ceci : « The bar rides here in a band, where the row is wide and **a second one would cost
height the zone cannot spare**. » C’est exactement pour éviter une deuxième ligne que la barre a
été remontée dans la ligne de titre. L’avis, lui, la recrée.

**D’où il vient** : `ImportProgress` est une bande posée entre la barre et la grille, qui porte
deux choses — les lignes de progression des imports en cours, et cet avis. Le `<p>` de l’avis
est en `px-2 py-1`, sur toute la largeur.

**Ce qui interdit de le déplacer tel quel** : le message fait 65 caractères en français, et la
ligne porte déjà le titre, le compteur, l’import, la recherche et deux facettes. En texte, il ne
rentrera pas — ou il chassera les facettes, ce qui déplace le défaut sans le corriger. La forme
qui tient à toute largeur est **une icône d’alerte dans la ligne de titre, le message en
infobulle** ; `ToolButton variant="header"` et `TooltipHost` existent tous les deux.

**Deux choses à ne pas casser en le faisant :**

1. **L’avis doit rester tant que ffmpeg manque**, et le commentaire dit pourquoi : « The notice
   outlives the ingests: without ffmpeg one lasts a few hundred milliseconds, and the
   explanation would vanish just as the user wonders where the waveform went. » Ce n’est donc
   pas un toast, et ça ne se dissout pas avec l’import.
2. **La bande reste pour les imports en cours** — ce sont des lignes, au pluriel, qui ne
   remontent nulle part. La demande porte sur l’avis, pas sur la bande.

> **En colonne, c’est pire, et ça ne se voit pas sur la capture.** En Vidéo et en Audio,
> l’étagère est dans la colonne de droite : la barre y est rendue **hors** de la ligne de titre
> (`!lying && <CollectionBar/>`), sur sa propre ligne. L’avis y fait donc une **troisième**
> ligne avant la première vignette. Corriger la bande sans regarder ce cas ne corrige que la
> moitié visible.

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

### 10. Les filtres du journal reviennent à la ligne, et il leur manque « Tout »

**Vu le 9 août 2026, capture à l’appui.** Dans le volet du journal d’activité — celui qu’ouvre
« 1 échec » en bas à droite — les filtres passent sur deux lignes : `Information / Avertissement /
Échec | Génération` puis `Import / Bibliothèque / Document`. Et il manque un **premier bouton
« Tout »**, alias du « rien de sélectionné », pratique à l’usage.

**Le retour à la ligne ne fait pas qu’être laid : il détruit le groupement.** `ActivityList.tsx`
pose sept boutons dans un `flex-wrap`, avec un `Separator` vertical entre les trois niveaux et les
quatre sujets. Le `Flyout` fait `w-96` (384 px), les sept libellés français n’y tiennent pas, et la
coupure tombe **après** le séparateur — les trois sujets de la seconde ligne se retrouvent orphelins
du trait qui était censé les annoncer. Les deux familles deviennent illisibles comme familles.

Deux rangées **explicites**, une par famille, règlent la mise en forme et la place du « Tout » d’un
seul geste : le séparateur disparaît au profit de ce qu’il essayait de dire, et chaque rangée reçoit
son propre « Tout » en tête, sans l’ambiguïté qu’aurait un « Tout » unique posé devant deux familles
qui se filtrent séparément. Élargir le flyout ne réglerait que la première moitié.

**« Tout » est bien un alias, et l’alias existe déjà** — `ActivityList.tsx:85` : « Nothing selected
is "everything" ». Le bouton n’ajoute donc aucun état : il vide la sélection de sa famille et
s’affiche actif quand elle est vide. Le geste existe aussi déjà, mais **seulement quand la liste est
vide** — `EmptyState` propose `activity.clearFilters`, qui appelle exactement
`setFilters({ levels: [], topics: [] })`. Aujourd’hui, un filtre trop étroit se défait en le
défaisant chip par chip, ou en attendant que la liste soit vide pour qu’on vous offre le bouton.

Trois choses qui suivent : `chipSkin` (`design/styles.ts`) porte déjà les deux états et **trois
surfaces le partagent** — ne pas en dériver une variante locale ; une clé i18n neuve est à poser
dans les deux bundles ; et `ActivityList.test.tsx` existe.

### 11. La ligne d’état est collée au bord et désalignée du reste

**Même capture.** En bas de fenêtre, `Verif4` à gauche et `1 échec` à droite touchent presque le
bord — il manque de l’air sous le texte, et la ligne ne s’aligne sur rien.

Ce n’est pas qu’une impression : `Footer.tsx` est en **`h-6 px-3`**, c’est-à-dire 12 px de marge
horizontale écrits en dur, quand tout ce qui est au-dessus est posé à `--sc-gutter` du bord — **6 px
en confort, 4 px en compact** (`index.css`). Le fil d’Ariane est donc décalé de 6 px vers l’intérieur
par rapport à la surface qui le surplombe, et l’écart double en densité compacte. Verticalement, le
`h-6` ne réserve rien : la ligne s’arrête au pixel du bas de la fenêtre.

C’est le cas d’école de la règle du guide — **pas de pixel en dur là où une gauge existe**. Reprendre
`--sc-gutter` remet le footer dans le même appareil de mesure que les rails et les panneaux, et le
suit quand la densité change.

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
| La croix de fermeture passait **sous** le titre dans les onglets | `La croix est à droite du titre…` |
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
| **(18)** Le formulaire de génération parlait anglais dans une application en français | `e0a07b2` (feat/i18n-schema-api) |

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
> mortes du skybox restent mortes** (§ 3.5 de `REPRISE`) : le déplacement ne les a ni réparées ni
> aggravées.

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

- **Deux onglets rouverts sur « Ce document n’est plus ouvert »** au rechargement — **§ 2, en tête
  du plus urgent.** Le layout est persisté, les documents ne le sont pas, et l’intersection qui les
  réconcilie ne corrige jamais le layout.
- **La dureté du pinceau n’est pas implémentée**, et crayon et pinceau rendent le même outil — § 3.2.
- **La garde manquante sur le format des signatures du registre** (`'P'` au lieu de `'KeyP'`) — § 3.2.
- **⌘Z se fragmente quand une génération aboutit pendant un glissement** — § 3.6. La ligne fautive
  sert les six espaces : ce n’est pas un rustinage local.
- **Les trois vues mortes de l’espace Skybox** — § 3.5. Manque fonctionnel ; l’entrée 1 le croise.
- **La croix de fermeture d’onglet** — § 3.1. Celle de Dockview est masquée **délibérément** (elle
  retire un panneau, ce qui n’est pas fermer un document). Ne pas « réparer » ce masquage.
- **`app/**` et `panels/**` ne sont sous aucun budget de couverture** — § 3.1.
