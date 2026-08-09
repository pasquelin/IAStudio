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

## À faire

### 1. Le menu horizontal du centre part dans un panneau à droite

Dans l'espace Skybox, la rangée `360° / Équirect / Croix / 6 faces / Champ de vision` est posée
en haut de la zone centrale. **Le centre ne doit porter que la barre d'outils et les règles** —
pas de menu horizontal. Ces contrôles appartiennent à un panneau de droite.

À vérifier avant de coder : les autres espaces ont-ils la même rangée ? Si oui, la règle vaut
pour tous, et c'est un seul chantier plutôt que six.

### 2. Une marge à droite pour la barre de défilement

Sur macOS la barre de défilement se superpose au contenu. Les panneaux qui défilent doivent
réserver la place, sinon elle passe par-dessus la dernière colonne — les valeurs des
inspecteurs, typiquement.

### 3. `gap-2` partout où il reste du `gap-1`

Fait pour les lignes de propriété (`FIELD_ROW`). **Reste à passer en revue** le reste des
surfaces : à `gap-1` les éléments se lisent comme un seul bloc.

> Non appliqué en aveugle à toute l'application : les barres d'outils tiennent une densité de
> 24 px en compact, et les écarter les casserait. À trancher surface par surface.

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

---

## Ce qui n'est pas un retour d'interface

Pour mémoire, ces chantiers-là vivent dans `docs/REPRISE.md` et pas ici :

- **La dureté du pinceau n'est pas implémentée.** `hardness` est déclaré et lu nulle part, et
  les modes crayon et pinceau rendent le même outil — alors que l'interface promet « bord net »
  contre « bord adouci ».
- **La garde sur le format des signatures du registre.** `defaultBinding` accepte n'importe
  quelle chaîne ; `'P'` au lieu de `'KeyP'` passe typecheck, lint et toute la suite de tests.
