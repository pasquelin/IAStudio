# ADR-21 — Le fournisseur se choisit par emploi, et le local est le défaut

- **Statut** : Proposé
- **Date** : 2026-08-21
- **Dépend de** : [ADR-18](ADR-18-capacites-runtime-par-porte.md) et
  [ADR-19](ADR-19-contrat-memoire-local.md) pour ce qu'une machine peut tenir,
  [ADR-20](ADR-20-surface-de-confiance-des-poids.md) pour ce qu'elle accepte de charger

**Provenance.** `[M]` **mesuré ici** — soit lu dans un dépôt avec `fichier:ligne`, soit obtenu en
exécutant, le protocole étant alors cité · `[D]` documenté — source nommée · `[?]` aucune donnée,
et c'est dit.

## Contexte

Les trois ADR précédentes disent ce qu'une machine **peut** faire tourner. Aucune ne dit **qui
fait quoi**, ni ce que la personne voit quand elle veut en décider. C'est ce qui manque pour qu'un
gestionnaire de modèles existe, et c'est cher à défaire une fois expédié.

`[M]` **Le studio sait déjà nommer un emploi, mais seulement pour le cloud.** Six espaces —
`image`, `video`, `3d`, `audio`, `textures`, `skyboxes` (`shared/domain/workspace.ts:8`) — dix
familles de modèles (`model.ts:73`) et des capacités par famille (`model.ts:246`) : `txt2img`,
`img2img`, `inpaint`, `outpaint`, `controlnet`, `reference` pour l'image, `txt2video`,
`img2video`, `video2video` pour la vidéo. **Deux emplois ne vivent dans aucun espace** :
l'assistant et la dictée.

`[M]` **Le studio sait déjà tenir plusieurs clés, mais globalement.** `AccountBook`
(`main/settings/accounts.ts:39`) porte une liste de comptes et **un** `activeId` ; un compte
`origin: 'environment'` vient de `secrets/.env` en lecture seule. Un switch de compte vit dans la
barre de titre. **Mais le projet ne sait rien** : `.project.json` ne porte que `version`, `name`,
`createdAt`, `updatedAt`.

`[M]` **Et sans clé, l'application ne fait rien.** Elle affiche « Non connecté » et s'arrête, alors
que la dictée — le seul modèle local du dépôt — fonctionne sans aucun compte.

## Décision

### A. L'unité est l'EMPLOI, jamais la section

Un espace n'a pas « une IA » : l'image en a six emplois, et `inpaint` n'est pas `txt2img`. Deux
emplois n'ont pas d'espace du tout.

> **Un emploi est un couple (famille, capacité), plus les deux emplois transverses — l'assistant
> et la dictée.** Le vocabulaire est celui que le catalogue Scenario utilise déjà ; le local s'y
> branche et n'en invente pas un second.

**Deux catalogues qui ne se parlent pas est le défaut à éviter** : la personne devrait alors savoir
d'avance où chercher, et le studio ne pourrait pas dire « cet emploi-ci tourne chez toi, celui-là
non ».

### B. Le fournisseur d'un emploi est `local` ou `scenario`, et le local est le DÉFAUT

> **Le défaut d'un emploi est le meilleur fournisseur réellement DISPONIBLE.** Sans compte, seul
> le local l'est.

- Emploi avec un modèle local que la machine tient → **local**, sans rien demander.
- Emploi sans modèle local → **il le dit à sa place**, avec ce qu'il faut pour l'activer. Le
  « Non connecté » global qui condamne toute l'application disparaît.
- **Une clé présente ne reprend pas la main** : elle ajoute un fournisseur au choix, elle ne
  devient pas le défaut.

`[M]` Le refus par emploi réutilise le canal existant — `usePlanRefusal` + `isBeyondPlan`,
consommés par `panels/models/Models/Models.tsx` et `panels/generator/Generator.tsx` — qui grise
déjà une carte **en expliquant pourquoi**. ADR-19 l'exigeait, « ou il y en aura deux ».

### C. Deux fournisseurs RÉELS, et aucune abstraction pour ceux qu'on n'a pas appelés

> 🛑 **Ce paragraphe est AMENDÉ — voir l'amendement du 21 août 2026 en fin de fichier.** Le cloud
> est devenu une liste, et `scenario` n'est plus une valeur de l'union.

> `fournisseur = local(modèle) | scenario(compte)`. Rien d'autre.

`[?]` Aucun second cloud n'a été appelé depuis ce dépôt. Écrire une abstraction « cloud »
générique produirait des types **plausibles et faux**, et personne ne pourrait dire lesquels —
c'est le raisonnement d'ADR-18 sur les runtimes à graphe, appliqué ici. Le jour où un second
fournisseur arrive vraiment, il s'ajoute avec ses contraintes sous les yeux : une valeur d'union
de plus, pas une refonte.

### D. Le choix vit globalement, et un projet le SURCHARGE

> Les réglages d'application portent le défaut de chaque emploi et le compte actif. Un projet ne
> stocke **que ce qui diffère**.

`[M]` C'est le motif `Governed<T>` du lot 0, déjà écrit et gardé (`shared/domain/aiMemory.ts`) :
`requested` d'un côté, une borne de l'autre, composés par `effectiveOf` — jamais un champ dérivé
stocké deux fois. `.project.json` ne gagne qu'un champ **optionnel**, donc les projets existants
restent lisibles sans migration.

**Pourquoi pas uniquement par projet** : chaque nouveau projet demanderait de tout re-choisir, y
compris quand il n'y a qu'un compte — le cas le plus courant. **Pourquoi pas globalement seul** :
deux projets ne pourraient pas viser deux comptes Scenario différents, et il faudrait basculer le
switch à la main, avec le risque de générer sur la mauvaise clé sans s'en apercevoir.

## Alternatives écartées

- **Régler le fournisseur par ESPACE.** Six lignes au lieu d'une vingtaine, mais le tout-ou-rien
  là où la machine ne suit pas : un espace dont un seul emploi est trop lourd devient inutilisable
  en local.
- **Une bascule globale « préférer le local ».** Le studio ne pourrait jamais dire, emploi par
  emploi, ce qui tourne — ce qui est précisément l'information cherchée en ouvrant un gestionnaire.
- **Le local d'abord et Scenario en repli silencieux.** Deux personnes obtiennent des résultats
  différents sans comprendre pourquoi, et le coût d'un job devient imprévisible.
- **Un espace séparé pour les modèles locaux.** C'est la duplication du § A, écrite en dur.

## Ce que cette décision ne tranche pas

Quels modèles composent le catalogue livré · si un catalogue servi en ligne existera (rang 2
d'ADR-20) et qui le sert · comment un emploi sans fournisseur disponible se présente exactement à
l'écran · si un projet peut surcharger le modèle **et** le compte ou seulement l'un des deux · le
sort d'un projet ouvert dont le modèle surchargé a été désinstallé.

## Ce qui l'invaliderait

| Vérification | Résultat qui casse la décision |
|---|---|
| Recenser les modèles locaux réellement installables par emploi | Si **aucun** emploi de génération n'a de modèle local que les machines visées tiennent, « le local est le défaut » ne vaut que pour l'assistant et la dictée, et le § B se réduit à ces deux-là |
| Mesurer ce qu'un emploi de génération coûte en mémoire contre ce que la sonde rapporte | Si le verdict est presque toujours `insufficient-memory`, le gestionnaire affiche surtout des refus, et c'est un problème de produit avant d'être un problème de code |
| Ouvrir un projet surchargé sur une machine qui n'a pas le modèle | S'il n'existe aucune retombée lisible, la surcharge par projet est un piège plutôt qu'un confort |

## Conséquences

- `[M]` **La dictée devient le premier emploi du gestionnaire, au lieu d'en être l'exception.**
  `STT_MODEL_FILES` (`shared/domain/dictation.ts`) est un manifeste de rang 1 écrit à la main, et
  `main/dictation/modelDownload.ts` (186 l.) un installateur qu'un seul site appelle
  (`main/services.ts:1035`, dans un fichier de **1 463 lignes**). Les deux sortent de `dictation/`
  vers `main/ai/` : ce sont des outils de gestion de modèle logés dans un emploi.
- **C'est le meilleur test du contrat** : un gestionnaire incapable de décrire un modèle qui marche
  déjà en production est faux.
- `[M]` Le collecteur de licences écrit **une entrée à la main par modèle**
  (`scripts/collect-licences.mjs`, entrée Parakeet) : il devra lire les manifestes, ce qu'ADR-20 § E
  exigeait déjà.
- Le switch de compte de la barre de titre gagne une portée : il dit désormais **pour quel projet**
  il vaut.

**Fichiers** : `shared/domain/aiRole.ts` *(neuf)* · `shared/domain/localModel.ts` *(neuf)* ·
`shared/domain/{project.ts,settings.ts,settingsRegistry.ts,dictation.ts}` ·
`main/ai/{modelInstall.ts,modelStore.ts,catalogue.ts,compatibility.ts}` *(les deux premiers
déplacés depuis `main/dictation/`)* · `main/settings/accounts.ts` · `main/services.ts` ·
`renderer/src/hooks/usePlanRefusal.ts` · `renderer/src/panels/{models,generator}` ·
`shared/i18n/{fr,en}/`.

## Amendement du 21 août 2026 — le cloud est une LISTE, et `scenario` n'est plus un membre de l'union

**Le § C est amendé par décision d'Alban.** Il écrivait
`fournisseur = local(modèle) | scenario(compte)`, « rien d'autre », et refusait toute abstraction
cloud au motif qu'aucun second cloud n'avait été appelé depuis ce dépôt. L'arbitrage retenu est
l'inverse : **Scenario appartient à une liste de fournisseurs cloud dont il est le seul membre
aujourd'hui, et aucun cas particulier ne se code sur son nom.**

> `fournisseur = local(modèle) | cloud(identifiant)`. Ce qu'un cloud SERT est une **donnée** qu'il
> déclare dans le registre, jamais une condition écrite ailleurs.

`shared/domain/aiCloud.ts` porte `CLOUD_PROVIDERS`, et une entrée y déclare les familles de
génération qu'elle publie et les emplois transverses qu'elle sert. `cloudsServing(role)` lit cette
déclaration ; rien ne branche sur un nom. Le mot `scenario` n'apparaît plus qu'à **deux** endroits :
l'`id` de son entrée, et la clé de la table de `services.ts` qui possède ses identifiants
(`readyCloudsOf`). Les libellés suivent le même chemin — `aiClouds.<id>` et `aiClouds.<id>Hint`,
listés dans `DYNAMIC_KEYS` **depuis le registre**, donc un second cloud arrive sans toucher la garde.

**Ce que l'amendement CORRIGE, et qui était visible à l'écran.** Le premier jet lisait un booléen
global « un compte est-il détenu ? » et l'offrait à tous les emplois : le gestionnaire proposait
donc **Scenario pour la dictée**, alors que rien dans ce dépôt ne transforme la parole en texte
ailleurs que sur cette machine. Sa première correction fut un `scenarioServes(role)` avec un
`role !== DICTATION_ROLE` — exactement le cas par cas que cet amendement interdit. La forme
retenue le supprime : la dictée n'est listée par aucune entrée, donc aucun cloud ne lui est offert,
et **aucune condition n'est écrite à son sujet.**

**Ce que le § C gardait de vrai reste vrai** : on n'écrit pas d'adaptateur pour un cloud qu'on n'a
jamais appelé. Le registre ne décrit pas *comment* parler à un fournisseur — il ne dit que ce qu'il
sert et sous quel identifiant. Le jour où un second arrive, il apporte son adaptateur ET sa ligne
de disponibilité ; ce qui a été retiré, c'est l'obligation de rouvrir chaque fichier qui nommait
`scenario`.

`[?]` **Un angle mort, écrit plutôt que caché** : rien ne vérifie que tout cloud enregistré possède
une ligne dans la table de disponibilité de `services.ts`. Un cloud sans ligne n'est jamais prêt —
la réponse honnête tant que rien ne sait lui parler. `main/ai/cloudReadiness.ts` porte cette phrase.

`[M]` **Aucune migration n'est due** : la branche `ai` des réglages est née dans ce même chantier et
n'a jamais été publiée, donc aucun `{ kind: 'scenario' }` n'existe sur disque chez qui que ce soit.
Un tel objet serait de toute façon **retiré en silence** par zod, le piège que `settings/validation.ts`
écrit déjà en tête.
