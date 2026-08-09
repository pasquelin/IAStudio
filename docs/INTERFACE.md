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

### 5. Les lignes de l’Explorateur n’ont pas d’accès clavier

Ce sont **les seules du studio** dans ce cas. L’Explorateur détourne `selectedIds` de `Collection`
pour dire « ouvert », et `Collection` place l’ancre et le tab stop sur la dernière ligne
sélectionnée — les deux usages se disputent la même donnée.

Ce qui manque est « activer une ligne » (double-clic, Entrée) dans `Collection` ; `DraggableAsset` a
déjà le même `onDoubleClick` fait à la main, donc le geste existe deux fois sans être offert par le
composant.

*(Relevé en revue de `feat/documents-erreurs`, 8 août 2026, non traité.)*

### 6. Le double-clic répond deux choses différentes selon d’où il part

Depuis l’Explorateur, il ouvre le document **en changeant d’espace si besoin**. Depuis un asset, il
ne traverse pas les espaces : `helpers/asset-intents.ts` exige un onglet déjà ouvert et **refuse en
silence** sinon.

Deux réponses à la même question, et l’une des deux ne dit pas qu’elle a refusé. À trancher — c’est
le comportement de l’Explorateur qui semble le bon.

*(Même revue, même date.)*

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

---

## Bloqué

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

- **La dureté du pinceau n’est pas implémentée**, et crayon et pinceau rendent le même outil — § 3.2.
- **La garde manquante sur le format des signatures du registre** (`'P'` au lieu de `'KeyP'`) — § 3.2.
- **⌘Z se fragmente quand une génération aboutit pendant un glissement** — § 3.6. La ligne fautive
  sert les six espaces : ce n’est pas un rustinage local.
- **Les trois vues mortes de l’espace Skybox** — § 3.5. Manque fonctionnel ; l’entrée 1 le croise.
- **La croix de fermeture d’onglet** — § 3.1. Celle de Dockview est masquée **délibérément** (elle
  retire un panneau, ce qui n’est pas fermer un document). Ne pas « réparer » ce masquage.
- **`app/**` et `panels/**` ne sont sous aucun budget de couverture** — § 3.1.
