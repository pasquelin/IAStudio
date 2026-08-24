# ADR-24 — Ce qui appartient à la machine, ce qui appartient au projet

**Statut** : accepté, 24 août 2026.
**Contexte** : ADR-21 § D et son amendement du 21 août 2026.

## Le problème

L'amendement du 21/08 à l'[ADR-21](ADR-21-le-fournisseur-se-choisit-par-emploi.md) a tranché que la
surcharge par projet du fournisseur IA vit **dans les réglages d'application, indexée par dossier**,
et que `.project.json` ne gagne aucun champ. Il a donné deux raisons, mais **n'a pas nommé le
critère** — de sorte que la question s'est reposée entière au chantier suivant.

Ce chantier est le **contexte de projet** : des fiches de texte libre décrivant l'univers, le style
et les contraintes d'un projet, ajoutées à toute génération et au briefing de l'assistant. Où vit-il ?

## La décision

> Une **préférence de machine** vit dans les réglages d'application, indexée par chemin.
> Une **propriété créative du projet** vit dans le dossier du projet.

Le critère qui sépare les deux — et qui était déjà celui de l'amendement du 21/08, sans y être écrit :

**Ce qui ne désigne rien ailleurs ne voyage pas.** Un identifiant de compte est frappé localement
(`main/settings/accounts.ts` : « removing a key and adding it back mints a fresh one »), un
`modelId` local nomme un poids installé sur cette machine. Écrits dans un dossier partagé, ils ne
désigneraient rien. Un contexte créatif est du **texte** : il désigne la même chose partout.

**Ce que l'auteur a écrit doit suivre son travail.** Un choix de fournisseur imposé à quelqu'un
d'autre est un défaut — l'ADR-21 le dit. Un univers imposé à quelqu'un qui reçoit le projet est
**exactement le but** : partager un projet sans ce qui a fait ses images, c'est partager la moitié
du travail.

## Ce qui en découle

`[M]` **Un fichier dédié, jamais le manifeste.** `.project-context.json` à la racine du projet.
`.project.json` reste `version`, `name`, `createdAt`, `updatedAt` — l'ADR-21 n'est pas amendée sur ce
point, elle est appliquée. Sous un point pour une raison qui n'est pas cosmétique : la passe de
réconciliation exclut tout ce qui est sous un point (`main/project/projectDisk.ts`), et un fichier
visible à la racine serait parcouru à chaque ouverture et proposé au classement.

`[M]` **Le fichier refuse d'être écrasé** quand il est illisible ou d'une version trop récente —
l'inverse de `main/provider/jobStore.ts`, dont le commentaire dit « unparseable is not unreadable:
writing over it is the only way out ». Ici le contenu est **celui de l'utilisateur** : l'écraser
détruirait une heure de description d'univers. `ContextTrouble` distingue les deux cas, parce qu'ils
demandent des choses opposées — réparer le fichier, ou mettre le studio à jour.

`[M]` **Le catalogue garde le prompt ÉCRIT, jamais le prompt ENVOYÉ.** `generatedAssetName` taille
le nom d'un asset dans les soixante premiers caractères de son prompt, et **le nom du rang EST le
nom du fichier**. L'API renvoyant ce qu'elle a reçu, un projet à contexte aurait nommé tous ses
assets d'après son univers. `AuthoredPrompt` voyage donc du handler jusqu'au collecteur, et
`AssetGeneration` **ne gagne aucun champ** : `withAuthoredPrompt` remet le prompt écrit dans
`params` par identité de chaîne, ce qui fait qu'un « regenerate » rouvre sur ce qui a été tapé — sans
quoi le contexte se cumulerait à chaque rejeu.

`[M]` **Un seul budget, six cents caractères** (`CONTEXT_COMPOSED_MAX`). Le plafond n'est ni
`PROMPT_INPUT_MAX` ni `INSTRUCTION_MAX` : c'est **l'encodeur de texte du modèle**. Un CLIP lit
77 jetons, environ trois cents caractères, et laisse tomber le reste sans un mot. Un seul chiffre
pour les deux lecteurs, de sorte que l'aperçu montré à l'écran soit ce que l'assistant reçoit aussi.

`[M]` **Le plancher réservé à la phrase de l'utilisateur passe de 4 000 à 2 000 caractères.**
Mesuré le 25/08 : `preambleLength([])` vaut **5 915** (5 110 le 15/08), donc l'ancien plancher
laissait **quatre-vingt-cinq caractères libres**, quand un contexte plein en coûte 619 — il
n'aurait pas pu entrer du tout, et le test `brain.test.ts` allait rougir seul à la prochaine
action. Deux mille caractères sont quelque
trois cents mots, toujours bien au-delà de ce que quiconque dit à un assistant, et la garantie ne
change pas : un collage long est coupé, les instructions arrivent entières.

`[M]` **Le contexte n'est pas un réglage.** Il n'apparaît nulle part dans les préférences. Il vit
dans un panneau, moitié basse de la colonne gauche, avec l'Explorateur et Git : les trois lisent le
projet — son arbre, son histoire, son intention.

`[?]` **Deux angles morts, écrits plutôt que cachés.** Deux fenêtres ouvertes sur un même projet
écrivent la liste ENTIÈRE ; la dernière gagne, et une fiche ajoutée dans l'autre fenêtre entre son
chargement et son écriture disparaît sans un mot — même propriété que `main/styles/store.ts`. Et un
job **repris après un redémarrage** retrouve son prompt écrit uniquement parce que `PersistedJob` le
garde ; le corps, lui, n'est pas persisté.

## Ce qui reste vrai de l'ADR-21

`settings.ai.projectRoles[chemin]` et `storage.projectAccounts` restent dans les réglages
d'application, indexés par dossier. Cette ADR n'amende pas l'ADR-21 : elle nomme le critère qu'elle
appliquait sans le dire, et l'étend à un cas de l'autre bord.
