# Phase 10.5G — Audit des contrats métier

## Résultat

L'ajout de `reads`, `writes`, `effects` ou `requires` est justifié pour décrire plusieurs contrats
métier. Sans signal structuré correspondant, il ne peut pas fournir de bonus structurel lors de la
recherche initiale. Son indexation textuelle pourrait néanmoins améliorer les cas où la demande
recouvre les libellés canoniques ajoutés.

La campagne persistée permet de prouver 99 échecs hors top-12 et leur classification agrégée
(`Metadata` 35, `Domain collision` 43), mais elle ne persiste pas la catégorie causale de chaque
évaluation. Il n'est donc pas possible d'identifier avec certitude « chacun des 78 cas » à partir
des seuls artefacts actuels. Une nouvelle classification cas par cas serait nécessaire avant toute
annotation massive.

## Cause technique

Le `AssistantContextBuilder` construit la recherche à partir du texte de l'objectif, de la demande
et du step. Il transmet séparément les ressources déjà produites et le scope observé
(`src/main/mission/contextBuilder.ts`, lignes 157–168).

Le scope structuré ne contient aujourd'hui qu'une cible lorsque le nom d'un élément sélectionné est
présent dans la demande, ainsi que le document actif
(`src/main/actionIndex/actionSearchContext.ts`, lignes 5–19).

Les capacités canoniques exposent `intents`, `targets`, `documentKinds` et
`documentAffinity` (`src/shared/domain/actionCapabilities.ts`, lignes 4–24). Les seules ressources
de workflow canoniques sont `generationModelCandidates`, `preparedGeneration` et `settingsState`
(`src/shared/domain/actionResource.ts`, lignes 1–13).

Le classement combine la pertinence lexicale/sémantique/intention/RRF et l'applicabilité issue du
scope, puis applique les ressources de workflow (`src/main/actionIndex/actionIndex.ts`, lignes
342–375). Il ne reçoit aucun « objet métier recherché » ni « effet demandé » structuré.

Conséquence déduite de ce flux de données : une métadonnée telle que `writes: persistentMemory` peut enrichir le texte
indexé ou valider une continuité déjà connue. Elle ne peut pas produire un bonus structurel fiable
pour une demande initiale tant qu'aucun composant déterministe n'a établi que cette demande vise
`persistentMemory` plutôt que `projectContextCard`.

## Concepts métier démontrés

### Context et memory

Les handlers `context.*` lisent, créent, modifient ou suppriment des cartes du contexte projet
(`src/renderer/src/features/assistant/contextHandlers.ts`, lignes 29–69). Les handlers `memory.*`
recherchent sémantiquement, lisent, écrivent, oublient ou relient des souvenirs persistants du
projet (`src/renderer/src/features/assistant/memoryHandlers.ts`, lignes 64–158).

Contrats canoniques justifiables :

- ressources `projectContextCard` et `persistentMemory` ;
- effets `read`, `search`, `createOrUpdate`, `delete`, `link` ;
- préconditions `projectOpen`, `contextReadable` et référence connue uniquement pour les opérations
  dont le handler l'exige ; la lecture des cartes et le rappel mémoire sans projet restent permis.

Ces informations ne sont pas déductibles avec certitude du namespace seul.

### Timeline, montage et animation

Les actions de timeline manipulent des cues de scène et des listes d'événements, audio, vidéo ou
transitions. Les actions de montage manipulent des clips de séquence. Les actions d'animation
écrivent des clés ou réglages d'animation d'objet.

Contrats canoniques justifiables :

- ressources `sceneTimelineCue`, `sequenceClip`, `objectAnimationKey` ;
- effets `add`, `move`, `trim`, `setGain`, `setSpeed`, `writeKeys` ;
- préconditions liées à la scène montée, au document de séquence et aux références connues.

### Core et studio

Les actions généralistes regroupent des contrats différents : commandes Studio, découverte
d'actions, état global, documentation et batch atomique. Les options structurées de
`command.runStudioCommand` sont déjà indexées, mais sans les titres et aides métier du registre des
commandes ni pondération propre à ce champ.

`reads` et `writes` ne suffisent pas ici. Un type d'opération ou des effets structurés, et
l'indexation des options canoniques de commande, sont nécessaires pour les distinguer sans règle
par scénario.

### Autres groupes

Les collisions observées permettent de justifier des ressources plus précises pour :

- scène : `sceneNode.transform`, `sceneNode.material`, `sceneWorld`, `postStack` ;
- catalogue : `assetCatalogue`, `projectFile`, `cloudLibrary`, `mediaCapability` ;
- exécution : dépôt Git, remote Git, stash et tâche shell/job.

Les références peuvent souvent être dérivées des champs. Le sous-objet métier, l'effet exact et la
précondition ne le peuvent pas toujours.

## Dérivation sûre

Peuvent rester dérivés automatiquement :

- famille et namespace ;
- tokens du nom et verbe technique faible ;
- références explicites issues des champs ;
- CRUD approximatif lorsque le nom est non ambigu ;
- affinité documentaire déjà démontrée ;
- `requires`, `produces`, `inputs` et `returns` existants.

Nécessitent une métadonnée canonique lorsqu'ils sont utilisés :

- ressource métier précise ;
- effet métier exact ;
- précondition applicative ;
- portée d'une commande globale ;
- distinction entre carte de contexte et mémoire persistante ;
- distinction entre cue, clip de séquence et animation d'objet.

## Arbitrage requis

Trois voies respectent différemment les contraintes actuelles :

1. ajouter les contrats canoniques uniquement pour l'applicabilité et la continuité ; cette voie
   traite surtout les quatre cas `Workflow`, pas les 78 échecs initiaux dominants ;
2. exploiter la « famille d'actions probable » déjà prévue par la spécification ; ce signal est plus
   étroit, mais sa dérivation déterministe porte le même risque de moteur de règles lexical ;
3. étendre le Context Router avec un signal déterministe de ressource/effet demandé, puis comparer ce
   signal aux contrats canoniques ; c'est la voie structurée la plus précise pour reranker la
   requête initiale, mais elle change le contrat du routeur et doit éviter de devenir un dictionnaire
   de formulations ;
4. utiliser plus tard un signal sémantique local ; cette voie est explicitement hors périmètre sans
   nouvel arbitrage.

Recommandation : choisir explicitement si le Context Router doit produire un besoin structuré
`resource/effect`. Sans cette décision, annoter progressivement `reads/writes/effects` créerait une
sémantique canonique peu exploitée et ne répondrait pas à la cause dominante mesurée.

## Reclassification reproductible des échecs

La relecture cas par cas des 99 rangs hors top-12 invalide la classification agrégée antérieure.
Les totaux ci-dessous sont issus des catégories attribuées à chaque ligne ; les rangs et composantes
de score viennent de l'artefact, tandis que la catégorie reste une interprétation auditée.

| Cause | Ancien total | Total relu |
|---|---:|---:|
| Metadata | 35 | 15 |
| Paraphrase | 16 | 17 |
| Domain collision | 43 | 38 |
| Scope/target | 0 | 2 |
| Workflow | 4 | 16 |
| Benchmark | 1 | 11 |

La cause de cet écart est vérifiable dans le harnais : `expectedMissionActions` dérive son attendu
de `COVERAGE`, alors que le commentaire canonique de `COVERAGE` précise explicitement qu'il s'agit
d'une intention de couverture et non d'une prescription d'appels
(`scripts/banc/coverage.ts`, lignes 3–18). Le benchmark retient pourtant les scénarios associés à
une seule action, concatène toute la demande, fournit zéro ressource précédente et juge cette action
comme l'attendu du premier retrieval (`scripts/banc/actionIndexOffline.mission-banc.ts`, lignes
154–173).

Cela pénalise notamment :

- les actions finales exigeant une ressource, telles que `generator.submit`, quand
  `generator.prepare` est correctement proposé avant elles ;
- les étapes finales de demandes multi-actions, sans résultats précédents ni références résolues ;
- les actions de relecture devenues inutiles lorsque le Context Builder possède déjà l'état frais ;
- des attentes historiques dont le contrat actuel ne réalise pas l'effet demandé.

Le chiffre R@12 reste une mesure de compatibilité avec la couverture historique. Il ne prouve pas à
lui seul la qualité du retrieval au round réellement applicable. Il ne faut donc plus optimiser les
99 cas comme s'ils étaient tous des faux négatifs ActionIndex.

La prochaine gate justifiée est le mini-banc Mission Runtime, qui mesure l'état final réel et les
workflows. Le benchmark offline doit rester inchangé comme métrique historique jusqu'à la création
d'un oracle complémentaire, step-aware, dérivé de ressources réellement présentes plutôt que d'une
nouvelle table manuelle.

## Gates produit mesurées

Le mini-banc de référence reste à 27/27. Par rapport à la Phase 10.3, il baisse de 361 942 à
340 545 tokens, de 19 à 10 actions inutiles et de 95 à 89 rounds.

Le Palier B passe de 43/91 en Phase 10.4 à 53/91, avec 1 311 894 tokens, 317 rounds, 341 appels
provider, 216 actions et 118 actions inutiles. La classification causale des 38 échecs est :

| Cause | Échecs |
|---|---:|
| Retrieval | 22 |
| Context | 6 |
| Planning | 3 |
| Model | 3 |
| Benchmark | 4 |

Le contexte explique deux défauts génériques démontrés : les jobs actifs non reliés à la mission
étaient absents, et la représentation textuelle préfixée d'un état volumineux pouvait retirer une
petite structure nécessaire située après une grande collection. La correction conserve désormais
les petits sous-arbres structurés dans le budget, expose les documents ouverts et inclut les jobs
actifs seulement lorsque le snapshot appartient au projet de la mission. Les jobs explicitement
liés restent prioritaires dans le quota.

Sur les cas ciblés, l'exposition du job actif fait réussir 44.3. La compaction structurée fait
réussir 62.3 dès sa première action, avec l'identifiant réel de transition. Les 19 réflexions qui
suivent cette mutation réussie démontrent un défaut séparé de clôture du step de vérification ; elles
ne sont pas attribuables au Context Builder et doivent être traitées dans un lot runtime distinct.

Ce lot runtime a confirmé le mécanisme : chaque refus réparable insérait un nouveau raisonnement
avant le verify existant, puis ce raisonnement ajoutait encore un verify. Le Scheduler rebranchait
l'ancien verify en aval du nouveau sans le supprimer, ce qui empilait les vérifications. Le runtime
réutilise désormais un verify aval déjà planifié lorsque l'action ne demande pas une continuation de
workflow. Sur un nouveau run 62.3 réussi, les rounds passent de 20 à 4, les appels provider de 25 à
4, les actions de 10 à 2 et les actions inutiles de 9 à 1.

La revue adverse a trouvé le même chemin d'empilement lors de la reprise d'une action après conflit
de révision ; il réutilise désormais lui aussi le verify aval et possède un test déterministe. Elle
a également relevé deux dettes antérieures, distinctes du correctif : une réponse contenant beaucoup
d'actions peut dépasser la limite de 48 steps avant le prochain contrôle, et l'extraction récursive
des références peut accepter des identifiants imbriqués qui ne représentent pas la ressource
annoncée. Ces deux points deviennent des lots séparés avant une nouvelle campagne large.
