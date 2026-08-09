# Retours d'interface — le registre

**Ce fichier est la liste des retours faits à l'écran et de ce qu'ils sont devenus.** Il existe
parce que les retours arrivent en rafale pendant les essais, plus vite qu'ils ne se traitent :
sans un endroit unique, le troisième fait oublier le premier.

Il vit dans le **dépôt principal**, sur `develop` — jamais dans un worktree, sinon il se
duplique et chaque branche tient sa propre version des retours. `docs/REPRISE.md` reste le
document de reprise du projet ; celui-ci ne parle que de l'interface, et seulement de ce qui a
été signalé en regardant l'application tourner.

## Comment le lire

| Statut | Sens |
|---|---|
| **À faire** | Signalé, pas commencé. |
| **En cours** | Ouvert dans la branche courante. |
| **Bloqué** | Ne peut pas avancer sans quelque chose — dit quoi. |
| **Fait** | Livré, avec le commit qui le porte. Reste ici un temps, puis part. |

Une entrée dit **ce qui a été vu**, pas la solution : la cause se cherche au moment de la
traiter, et une cause devinée à la volée est une cause fausse une fois sur deux.

---

## Les règles de disposition — tranchées, ne pas les rouvrir

Elles viennent de `docs/REPRISE.md`, où elles figuraient sous « Corrigé — ne pas le
re-signaler ». Elles ne sont pas des retours en attente : ce sont les réponses déjà données, et
c'est à elles qu'un nouveau retour se compare.

**La colonne de gauche est réservée à la génération**, dans les six espaces. La droite porte ce
qui parle du document, **inspecteur en moitié basse**. L'étagère à assets est en **bande du
bas** partout — sauf en Vidéo et en Audio, où la timeline occupe le bas et où c'est la colonne
de droite qui la porte (`TOOL_PLACEMENTS`, `shared/domain/tool.ts`).

> Avant, l'étagère était à droite dans tous les espaces, où elle mangeait la largeur du canvas.

**Une moitié vaut `null` quand personne ne l'a choisie**, et chaque espace y lit le premier
panneau qu'il déclare. **Ne pas remettre d'identifiant dans `DEFAULT_OPEN`** : nommer un panneau
par moitié imposait la réponse d'un espace aux cinq autres — l'Explorateur gagnait partout, y
compris en Image où les Calques viennent en premier.

**Le centre ne porte que la barre d'outils et les règles.** C'est la règle que l'entrée 1
applique ; elle est la conséquence directe des deux précédentes, et c'est pour ça qu'un menu
horizontal posé en haut du centre est un défaut et pas un choix.

---

## À faire

### 3. `gap-2` partout où il reste du `gap-1`

Fait pour les lignes de propriété (`FIELD_ROW`). **Reste à passer en revue** le reste des
surfaces : à `gap-1` les éléments se lisent comme un seul bloc.

> Non appliqué en aveugle à toute l'application : les barres d'outils tiennent une densité de
> 24 px en compact, et les écarter les casserait. À trancher surface par surface.

### 5. Les lignes de l'Explorateur n'ont pas d'accès clavier

Ce sont **les seules du studio** dans ce cas. L'Explorateur détourne `selectedIds` de
`Collection` pour dire « ouvert », et `Collection` place l'ancre et le tab stop sur la dernière
ligne sélectionnée — les deux usages se disputent la même donnée.

Ce qui manque est « activer une ligne » (double-clic, Entrée) dans `Collection` ;
`DraggableAsset` a déjà le même `onDoubleClick` fait à la main, donc le geste existe deux fois
sans être offert par le composant.

*(Relevé en revue de `feat/documents-erreurs`, 8 août 2026, non traité.)*

### 6. Le double-clic répond deux choses différentes selon d'où il part

Depuis l'Explorateur, il ouvre le document **en changeant d'espace si besoin**. Depuis un asset,
il ne traverse pas les espaces : `helpers/asset-intents.ts` exige un onglet déjà ouvert et
**refuse en silence** sinon.

Deux réponses à la même question, et l'une des deux ne dit pas qu'elle a refusé. À trancher —
c'est le comportement de l'Explorateur qui semble le bon.

*(Même revue, même date.)*

### 7. Un panneau Styles dans l'espace Textures

**Demandé le 9 août 2026.** C'est une fonctionnalité, pas un défaut — elle est ici parce
qu'elle se joue entièrement à l'écran.

Un panneau qui liste des **styles de rendu prédéfinis** — effet métal, effet plastique, effet
bois — pour ne pas refaire les mêmes réglages à chaque texture. On en ajoute depuis
l'inspecteur, par un **petit bouton dans le header, en haut à droite**, comme le panneau Assets,
qui enregistre les réglages courants. Le nom est **généré automatiquement** et se change
directement dans le panneau Styles, par un **clic droit → Renommer**, comme dans les
applications JetBrains.

**Rien de tout cela n'existe** : aucune notion de preset ni de style de matériau dans `src/`
(les occurrences de `preset` sont ailleurs — `DynamicForm`, ffmpeg). En revanche, les quatre
briques sont déjà là et aucune n'est à écrire :

| Ce qu'il faut | Ce qui existe déjà |
|---|---|
| Ce qu'un style capture | `MaterialSettings` (`engines/texture/texture-state.ts`) — 16 champs, de `color` à `rotation`, plus `DEFAULT_TEXTURE_MATERIAL` gelé |
| Le bouton dans le header | `AssetBrowserActions.tsx`, `variant="header"` — le motif qu'il cite |
| Le clic droit → Renommer | `design/ContextMenu.tsx`, et `AssetMenu.tsx` comme exemple |
| Le renommage lui-même | `LayerRow.tsx` le fait déjà, double-clic sur le nom seul, clé i18n `layers.rename` |

Le panneau se déclare dans `TOOL_PLACEMENTS` (`shared/domain/tool.ts`), où `channels` occupe
déjà `zone: 'right', slot: 'primary'` pour l'espace Textures.

**Deux questions à trancher avant de coder** — elles changent le travail, pas la mise en page :

1. **Où vivent les styles ?** « Ne pas recommencer à chaque texture » se lit au-delà du projet :
   rangés dans le projet, changer de projet les perd. Rangés dans `userData`, ils suivent la
   machine mais ne se partagent pas.
2. **Un style capture-t-il les maps, ou seulement les réglages ?** « Effet bois » comme *rendu*
   se fait avec les 16 valeurs de `MaterialSettings` ; s'il devait embarquer ses canaux, ce
   n'est plus un style mais un matériau complet, et il ne s'appliquerait plus à n'importe quelle
   texture.

---

## Bloqué

### 4. Aucun sélecteur de couleur ne s'ouvre

Les **quatre** `input type="color"` de l'application sont muets — pinceau, inspecteur,
formulaire de génération, réglages. Ce n'est donc pas un défaut de la barre d'outils : la cause
est sous le renderer.

Ce qui a déjà été écarté : aucun `preventDefault` sur le chemin du clic, aucun
`appendSwitch`/`--disable-features` dans le main, ni `alwaysOnTop` ni fenêtre transparente — les
deux configurations connues pour garder le panneau caché sur macOS. La littérature Electron ne
documente rien qui corresponde.

**Bloqué sur deux mesures**, qui exigent l'application avec le port de debug :

1. `input.showPicker()` dans un `try/catch` — ce qu'il lève, ou son silence.
2. `document.hasFocus()` juste après le clic — un panneau natif vole le focus ; s'il reste
   `true`, rien ne s'est ouvert du tout.

Si Electron n'expose aucun `ColorChooser`, la décision inscrite dans `BrushControls` — « un
input natif, délibérément, parce que macOS ouvre le sélecteur système » — tombe, et il faut un
sélecteur maison dans `design/`, partagé par les quatre appelants. C'est une décision de
conception, pas une correction.

---

## Fait

| Ce qui était signalé | Commit |
|---|---|
| La croix de fermeture passait **sous** le titre dans les onglets | `La croix est à droite du titre…` |
| Le champ de recherche des réglages changeait de largeur | idem |
| Fermer la dernière fenêtre laissait l'application ouverte sans interface | `bcc3f69` (feat/pinceau) |
| Les barres n'avaient pas toutes la même longueur | idem |
| Un scroll horizontal apparaissait à cause d'une valeur à seize décimales | idem |
| Le bleu du focus n'était pas celui du projet | idem |
| **(1)** Le menu horizontal du centre — parti dans un panneau « Vue » | `3ac739d` (feat/pinceau) |
| **(2)** La marge que la barre de défilement de macOS mangeait | idem |

> **L'entrée 1 est livrée, le manque qu'elle croisait ne l'est pas.** Le déplacement est fait :
> les réglages passent par `stores/skybox-views`, le panneau « Vue » les offre, et le centre ne
> porte plus que la barre d'outils et les règles. Un seul espace était concerné — vérifié :
> Vidéo et Audio ont bien une rangée horizontale, mais c'est une barre de transport, un outil et
> non un menu.
>
> **Les trois vues mortes restent mortes**, et le déplacement ne les a ni réparées ni aggravées :
> `SkyboxRenderer` n'expose toujours aucun `setView`. Le champ de vision et les objets de test
> fonctionnent. Reste l'arbitrage — implémenter les projections (§ 3.5 de `REPRISE`) ou retirer
> le contrôle, un bouton qui ment valant moins qu'un bouton absent.

---

## Vérifier à l'écran ce qui se voit

**Un jalon visuel validé uniquement par des tests unitaires n'est validé qu'à moitié.** Règles,
repères, zoom, compositing, pointillés, viewport éclairé : rien de tout cela ne se prouve dans
vitest. L'espace Textures en porte la trace — un viewport noir venait de l'environnement studio
manquant, ce qu'aucun test n'aurait dit.

Le MCP `electron` pilote la fenêtre après `pnpm start:debug`. **Le port 9222 est unique** : si
une autre session a déjà lancé l'application, c'est son instance qu'on pilote, et on croit
mesurer sa propre branche.

C'est aussi la raison d'être de ce fichier. **Aucun test ne s'exécute sur l'application
lancée** — les 250 fichiers de test sont unitaires, `find src -name '*.e2e.*'` ne rend rien.
Ouverture, parcours des six espaces, détachement d'un panneau, fermeture propre : vérifié à la
main, à chaque fois, par qui livre. Playwright a été **reporté le 8 août 2026, pas abandonné**
(suivi `L7` dans `.claude/loop/BACKLOG.md`) ; d'ici là, ce registre est le seul filet.

---

## Les captures d'écran attendues

Le `README.md` racine et les deux guides utilisateur référencent des images qui **n'existent pas
encore**. Tant qu'un fichier manque, son emplacement reste visible dans le markdown sous forme
de commentaire HTML — rien ne casse.

| Fichier | Sujet |
|---|---|
| `docs/images/studio-3d.png` | Le studio dans l'espace 3D : rails aux deux bords, vue de scène au centre, arbre de scène et maillages à gauche, modèles à droite, étagère à assets en bas |
| `docs/images/studio-image.png` | L'espace Image : pile de calques, volet d'un groupe d'outils ouvert |
| `docs/images/settings-account.png` | La fenêtre de Réglages, section Compte, état authentifié visible |
| `docs/images/models-grid.png` | Le panneau Modèles en grille, facettes ouvertes |
| `docs/images/generate.png` | Le panneau Génération avec le formulaire d'un modèle, et la bande Jobs avec un job en cours |
| `docs/images/image-tools.png` | Un document image, volet du groupe Forme ouvert, pile de calques visible |
| `docs/images/scene-3d.png` | La vue 3D avec un maillage sélectionné, l'arbre de scène et le panneau Maillages |
| `docs/images/timeline.png` | L'espace Vidéo : timeline avec plusieurs clips, moniteur au-dessus |

**Conventions.** PNG, thème sombre, densité confort. **2560 × 1600** pour les vues plein écran,
recadrées au panneau pour les vues de détail. Fenêtre sans ombre portée du système — elle se
voit mal sur le fond clair de GitHub. **Un projet réel ouvert, avec de vrais assets** : une
fenêtre vide ne montre rien de ce que le logiciel sait faire. **Aucun identifiant, aucun jeton,
aucun chemin personnel lisible** ; la section Compte se capture avec des champs remplis mais
masqués.

`pnpm start:debug` ouvre le port 9222, ce qui permet de déclencher les captures depuis
l'extérieur plutôt qu'à la main.

---

## Ce qui n'est pas un retour d'interface

Ces chantiers **se voient** à l'écran, mais leur cause est ailleurs et leur traitement touche
autre chose que la mise en page. Ils restent dans `docs/REPRISE.md` ; ils sont listés ici pour
qu'on ne les y cherche pas deux fois.

- **La dureté du pinceau n'est pas implémentée.** `hardness` est déclaré et lu nulle part, et
  les modes crayon et pinceau rendent le même outil — alors que l'interface promet « bord net »
  contre « bord adouci ».
- **La garde sur le format des signatures du registre.** `defaultBinding` accepte n'importe
  quelle chaîne ; `'P'` au lieu de `'KeyP'` passe typecheck, lint et toute la suite de tests.
- **⌘Z se fragmente quand une génération aboutit pendant un glissement** — § 3.6 de `REPRISE`.
  `document-store.ts` réécrit l'identifiant de coalescence à chaque `runCommand` : le geste
  cesse de fusionner, l'annulation se casse en trois, et un ⌘Z fait disparaître l'image au lieu
  de défaire le réglage. La ligne fautive **sert les six espaces** — ce n'est pas un rustinage
  local.
- **Les trois vues mortes de l'espace Skybox** — § 3.5. Manque fonctionnel, pas défaut de mise
  en page, mais l'entrée 1 le croise.
- **La croix de fermeture d'onglet** — § 3.1. Celle de Dockview est masquée **délibérément**
  (elle retire un panneau, ce qui n'est pas fermer un document) ; celle qui la remplace passe
  par `closeDocument`, et la question est posée par l'OS. Ne pas « réparer » ce masquage.
- **`app/**` et `panels/**` ne sont sous aucun budget de couverture** — c'est ce qui a laissé
  cinq fichiers neufs y atterrir sans qu'aucun seuil ne bouge.
