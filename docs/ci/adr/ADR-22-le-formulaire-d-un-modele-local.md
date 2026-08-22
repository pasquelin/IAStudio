# ADR-22 — Le formulaire d'un modèle local se dérive de sa modalité

- **Statut** : Proposé
- **Date** : 2026-08-21
- **Dépend de** : [ADR-20](ADR-20-surface-de-confiance-des-poids.md) pour ce que le studio accepte
  de charger, [ADR-21](ADR-21-le-fournisseur-se-choisit-par-emploi.md) pour qui sert quel emploi

**Provenance.** `[M]` mesuré — lu dans le dépôt, avec `fichier:ligne` · `[D]` documenté — source
nommée · `[?]` aucune donnée, et c'est dit.

## Contexte

L'invariant 5 de `CLAUDE.md` est catégorique : **aucun formulaire de génération ne s'écrit à la
main**. Il tient parce qu'un modèle Scenario **publie ses propres entrées** — `GET /models/{id}`
répond un schéma, `ModelRegistry` le traduit en `FieldDescriptor[]`, `<DynamicForm/>` le rend.

Un modèle qui tourne sur cette machine n'a aucun serveur à qui demander. Rien ne décrit ses
entrées, et c'est exactement la situation dans laquelle l'invariant se viole : on écrit vingt
champs par entrée de catalogue, on les recopie à la suivante, et six mois plus tard le formulaire
d'un modèle contredit celui de son voisin sans que rien ne rougisse.

## Décision

### A. Les boutons viennent de la MODALITÉ, jamais du modèle

> Tous les modèles de texte offrent les mêmes réglages. Tous les modèles de diffusion aussi. Ce
> qui change d'un modèle à l'autre n'est pas la liste des boutons, c'est leurs bornes.

`[M]` `shared/domain/localFields.ts` tient une table `Record<LocalModality, LocalFieldTemplate[]>`
et rien d'autre. Deux modalités aujourd'hui — `text` et `image` — et le manifeste d'un modèle ne
porte **pas** de champs : il porte `modality`.

Une modalité neuve est une ligne de cette table. Un modèle neuf n'est rien du tout.

### B. Un manifeste ne déclare que ses DÉSACCORDS, et seulement des bornes

`[M]` `LocalFieldOverrides` est un `Record<string, Partial<Pick<FieldDescriptor, 'default' | 'min'
| 'max' | 'step'>>>`, et cette signature est la décision : un modèle peut dire « chez moi la
température va jusqu'à 1,5 » ; il **ne peut pas** ajouter un bouton.

La raison n'est pas de l'hygiène. Un bouton qu'un modèle ajouterait serait un bouton que son
runtime devrait honorer, et un runtime qui honore un paramètre de plus **est un second runtime** —
qui se déclare alors dans `LocalRuntime`, pas dans un manifeste.

### C. Les libellés voyagent en CLÉS, et la traduction est passée

`[M]` `LocalFieldTemplate` est un `Omit<FieldDescriptor, 'label' | 'help'>` augmenté de `labelKey`
et `helpKey`. Un `label` écrit dans cette table serait du texte d'écran dans `shared/`, et
`no-hardcoded-text.test.ts` a raison de le refuser.

`localFieldsOf(modality, overrides, translate)` reçoit donc de quoi traduire, **passé et jamais
importé** : la fonction tourne dans le processus principal, où la langue est un service et non une
lecture au chargement du module. `textAt(TRANSLATIONS[language()], clé)` est ce que la composition
lui donne.

`[M]` `localFieldKeys()` publie les clés que la table nomme, pour que la garde des bundles les lise
sur les gabarits plutôt que sur une copie.

### D. Le rendu est celui de tout le monde

`describe(modelId)` répond un `ModelDescriptor` **de la même forme** qu'un modèle du cloud :
`ModelSummary` plus `fields`. `<DynamicForm/>` ne sait pas d'où vient le descripteur, et c'est le
but — un composant de plus pour le local serait deux formulaires à tenir en phase.

`[M]` C'est `main/provider/modelRegistry.ts` qui décide, et il répond par `describedLocally` avant
d'aller au réseau : un modèle de cette machine ne coûte aucun aller-retour.

**Une modalité absente retombe sur `text`.** Un formulaire qui disparaît est le défaut que
l'invariant 5 nomme explicitement ; un bouton de trop ne l'est pas.

## Ce que cette décision ne tranche pas

Quelles bornes sont les bonnes — les valeurs de la table sont celles des runtimes usuels, `[?]`
aucune n'est mesurée contre llama.cpp · si une modalité `audio` ou `3d` arrivera, et sous quels
boutons · comment un modèle local **de génération** dépose ce qu'il produit dans un projet : le
`JobRunner` local existe, `main/ai/localJobRunner.ts` écrit en clair qu'aucun collecteur ne file
son texte, et aucun modèle expédié ne déclare de `family` à ce jour.

## Ce qui l'invaliderait

| Vérification | Résultat qui casse la décision |
|---|---|
| Deux modèles de la même modalité dont les runtimes n'acceptent pas le même jeu de paramètres | La table par modalité devient un mensonge, et la clé redevient le couple (modalité, runtime) |
| Un modèle qui a besoin d'un bouton qu'aucun autre n'a | Alors c'est un runtime de plus, pas un `override` de plus — et le refuser est le point du § B |

## Conséquences

- `[M]` `shared/domain/localFields.ts` est la table, et `localModel.ts` ne porte que `modality` et
  `fieldOverrides`.
- `[M]` `main/provider/modelRegistry.ts` répond pour les deux catalogues, et c'est le seul endroit
  où ils se rencontrent.
- Une garde des bundles lit `localFieldKeys()` : une clé ajoutée à la table sans traduction ne
  passe pas.

**Fichiers** : `shared/domain/localFields.ts` · `shared/domain/localModel.ts` ·
`main/provider/modelRegistry.ts` · `shared/i18n/{fr,en}/ai.json`.
