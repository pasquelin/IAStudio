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

### 9. `role="option"` sans `listbox`, et `aria-selected` qui dit « ouvert »

**Même origine, même date.** Aucun `role="listbox"` n’existe nulle part dans `src/` : les cellules de
`Collection` portent `role="option"` en orphelines, sans « liste de N éléments » ni « 3 sur 12 »
annoncés, et sans `aria-multiselectable` alors que la sélection multiple existe. `Tree` fait la même
chose correctement à côté (`role="tree"` sur la liste, `role="treeitem"` sur les lignes).

L’entrée 5 a élargi le problème sans le créer : l’Explorateur rejoint les porteurs du rôle, et son
`aria-selected` y veut dire « ouvert » — un état que l’utilisateur ne peut ni poser ni retirer depuis
ce panneau, alors que la ligne le dit déjà en clair.

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
> **La vérification à l’écran reste due pour les entrées 6 et 8**, et pas faute d’avoir essayé :
> le MCP `electron` **n’atteint pas les cartes de l’étagère** — `electron_click_by_text` répond
> « cliqué » sans que le focus ni la sélection ne bougent, et aucun sélecteur ne distingue les
> cellules d’une collection de celles d’une autre (`data-cell` recommence à zéro dans chacune).
> Ce qui a été vu : les cellules de l’étagère portent bien `tabindex` et `aria-selected`, que le
> panneau n’avait pas avant. Ce qui reste à voir de ses yeux : le clic qui peint, la plage au
> shift, et la bascule d’espace au double-clic depuis un autre espace.

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
> **Ce qui reste dû : la vérification à l’écran.** Une autre session tenait l’application au moment
> de la fusion, et le verrou d’instance unique interdit d’en lancer une seconde. Les 4680 tests
> passent, mais personne n’a *vu* la bascule d’espace.

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
