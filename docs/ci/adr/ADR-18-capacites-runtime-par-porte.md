# ADR-18 — Les capacités d'un runtime local se déclarent par porte d'accès

- **Statut** : Proposé
- **Date** : 2026-08-21

> **`Proposé` est un statut neuf dans ce dossier**, où les dix-sept ADR précédentes sont `Accepté`
> ou `Caduc`. Il est introduit ici délibérément : cette ADR et les deux suivantes portent des `[?]`
> explicites et des critères d'invalidation nommés. Les marquer `Accepté` dirait qu'elles ont été
> vérifiées, ce qui est faux, et effacerait la distinction que tout leur contenu sert à construire.

**Provenance.** Chaque affirmation porte un marqueur : `[M]` mesuré — lu dans le dépôt, avec
`fichier:ligne` · `[D]` documenté — source nommée · `[?]` aucune donnée, et c'est dit.

## Contexte

`[M]` Le studio pilote aujourd'hui **un** moteur local, la dictée, par **une** porte : un
`utilityProcess` ([ADR-17](ADR-17-moteur-de-dictee-hors-processus.md)) parlé à travers
`main/processClient.ts`. Il n'y a aucune négociation de capacités — le code sait ce que
sherpa-onnx sait faire parce qu'il a été écrit pour lui.

Avec plusieurs runtimes, un ordonnanceur ne peut plus savoir : il doit décider à partir de
déclarations. Deux façons de rater ça sont déjà identifiées.

**La première : indexer par runtime.** ✅ **Vérifié** — sur `/v1/chat/completions` d'Ollama,
`keep_alive` est **ignoré** et `num_ctx` n'y est pas réglable, il faut un Modelfile. `[D]` Son API
native `/api/chat` accepte `keep_alive` en paramètre de requête. **Le même runtime a deux profils
selon la porte.** `[?]` Le même cas est attendu d'un runtime à graphe — soumission HTTP,
progression WebSocket — mais rien ne l'a vérifié ici.

**La seconde : écrire des booléens.** `supportsKeepAlive: true` ne dit pas ce que l'ordonnanceur
fait de différent. `[M]` Le dépôt refuse déjà ce défaut ailleurs : `RowTone` a été supprimé pour
qu'un appelant ne puisse plus demander un second ton, et `incomplete` dans `IO_BY_KIND` porte **la
phrase du refus** plutôt qu'un drapeau.

## Décision

**La clé est `(runtime, porte d'accès)`, et chaque valeur d'énumération porte une conséquence
écrite sur l'ordonnanceur.**

```ts
// shared/domain/aiRuntime.ts

/**
 * `<runtime>/<porte>`, deux segments en kebab-case minuscule : `ollama/api-chat`,
 * `ollama/v1-chat`, `llamacpp/embedded`.
 *
 * Marqué plutôt que laissé `string`, et le format FAIT PARTIE du contrat : c'est la clé de
 * `runtimeBytes` dans ADR-19, et une clé mal formée dans un `Record` ne rougit nulle part — elle
 * compte zéro octet. `'ollama'` seul et `'Ollama/v1-chat'` sont refusés à la construction, ce qui
 * est la seule façon d'empêcher trois orthographes d'une même porte de coexister.
 */
export type RuntimeEndpointId = string & { readonly brand: unique symbol }

export function runtimeEndpointId(runtime: string, door: string): RuntimeEndpointId

export type RuntimeCapabilities = {
  residency: 'owned' | 'advisory' | 'opaque'
  memoryReporting: 'authoritative' | 'best-effort' | 'none'
  context: 'per-request' | 'per-install' | 'unknown'
  progress: 'push' | 'poll' | 'none'
  cancellation: 'cooperative' | 'process-only' | 'none'
  submission: 'params' | 'workflow-graph'
  occupancy: 'multi-job' | 'exclusive-process'
}
```

Une ligne par valeur d'énumération, et ce que l'ordonnanceur en fait :

| Axe · valeur | Ce que l'ordonnanceur fait **différemment** |
|---|---|
| `residency: owned` | Nous décidons du chargement et de la libération. Ses octets sont **récupérables** : un plan de libération peut compter dessus. |
| `residency: advisory` | Un processus étranger garde **sa** politique. Nous pouvons demander ; il peut refuser pour des raisons invisibles d'ici. Les octets ne deviennent récupérables qu'**après** une re-mesure qui le confirme, et aucun plan ne les engage à l'avance. |
| `residency: opaque` | Nombre non fiable au budget, **jamais** récupérable. La seule libération garantie est l'arrêt du processus : un job qui a besoin de cette place est planifié comme si elle n'existait pas. |
| `memoryReporting: authoritative` | Alimente `MemorySnapshot.source = 'runtime'` et sert à l'admission (ADR-19). |
| `memoryReporting: best-effort` | Affichable, **jamais** décisif. L'admission retombe sur la réservation du manifeste. |
| `memoryReporting: none` | Aucune admission ne lit ce runtime : réservation du manifeste seule. **Ne change pas la topologie de processus.** |
| `context: per-request` | Nos bornes s'appliquent telles qu'elles sont écrites. |
| `context: per-install` | La fenêtre est fixée hors de notre contrôle. Nous la **découvrons** et **rabattons nos bornes dessus** ; un dépassement est une panne du runtime, pas un défaut de notre invite. |
| `context: unknown` | Rabattre sur la borne la plus basse que le manifeste connaisse ; tout dépassement est rapporté comme panne. |
| `progress: push` | Le gestionnaire **s'abonne**. Il ne boucle pas. |
| `progress: poll` | Boucle de sondage existante. |
| `progress: none` | État **indéterminé** à l'écran. Aucun pourcentage n'est composé. |
| `cancellation: cooperative` | La mémoire revient sans tuer. Le job peut cohabiter. |
| `cancellation: process-only` | Annuler = tuer le worker, donc **tuer tous ses jobs**. L'ordonnanceur ne co-localise jamais un tel job. |
| `cancellation: none` | Le bouton est **désactivé**, pas silencieux. |
| `submission: params` | `FieldDescriptor[]` s'applique directement. |
| `submission: workflow-graph` | L'unité soumise est un **graphe versionné**, pas un `generate(params)`. Voir la note ci-dessous. |
| `occupancy: multi-job` | Plusieurs jobs par processus. |
| `occupancy: exclusive-process` | Un job par processus : la topologie devient fonction du parallélisme voulu. **Irréversible une fois expédiée.** |

**`residency` et `memoryReporting` sont orthogonaux, et la combinaison qui le prouve est
`owned` + `none`** : nous décidons du chargement et du déchargement, mais nous n'interrogeons pas
l'allocateur. Un `llama.cpp` embarqué est ce cas. **La libération est demandable et son effet
n'est pas confirmable** : on décharge, on ne tue pas, et l'admission qui suit repart de la
réservation du manifeste plutôt que d'une soustraction. Coupler les deux axes produirait la
décision inverse — tuer un worker qu'on pouvait simplement décharger.

**Ce que `submission: 'workflow-graph'` impose au port provider, et rien de plus** : l'artefact
installable a version et intégrité propres ; `capabilities()` se dérive des **graphes** installés
et non des modèles ; les `FieldDescriptor[]` sont publiés depuis l'artefact. `[?]` Aucun runtime à
graphe n'a été lancé ici — les types de liaison ne sont pas écrits, ils seraient plausibles et
faux, et personne ne pourrait dire lesquels.

### Le tableau, par porte

| | llama.cpp *(embarqué)* | MLX | Ollama `/api/chat` | Ollama `/v1/chat/completions` | Runtime à graphe |
|---|---|---|---|---|---|
| `residency` | `owned` `[?]` | `owned` `[?]` | `advisory` — `keep_alive` accepté `[D]` | **`advisory`** — `keep_alive` **ignoré** ✅ | `opaque` `[?]` |
| `memoryReporting` | `[?]` | `[?]` | `[?]` | `[?]` | `[?]` |
| `context` | `[?]` | `[?]` | `[D]` `num_ctx` en `options`, **à confirmer** | **`per-install`** — non réglable ✅ | s.o. |
| `progress` | `[?]` | `[?]` | `[?]` | `[?]` | `push` `[D]` |
| `cancellation` | `[?]` | `[?]` | `[?]` | `[?]` | `[?]` |
| `submission` | `params` `[?]` | `params` `[?]` | `params` `[?]` | `params` `[?]` | **`workflow-graph`** `[D]` |
| `occupancy` | `[?]` | `[?]` | `[?]` | `[?]` | `[?]` |

**Un tableau plausible coûterait plus qu'un tableau vide.** Chaque case se remplit par une
vérification nommée — charger, demander une libération, re-mesurer, annuler à mi-course, dépasser
le contexte — avant qu'on y écrive quoi que ce soit.

## Alternatives écartées

- **Indexer par runtime.** Faux, et c'est vérifié : les deux portes d'Ollama ne déclarent pas la
  même chose.
- **Des booléens (`supportsKeepAlive`).** Un drapeau ne dit pas ce que l'ordonnanceur fait ; c'est
  exactement le défaut que cette ADR existe pour interdire.
- **Déduire d'un numéro de version.** Ce n'est pas la version qui change le comportement ici,
  c'est l'endpoint.
- **Coupler `memoryReporting: none` à `residency: opaque`.** Produit une décision fausse — voir la
  note sur `owned` + `none`.
- **Laisser `RuntimeEndpointId` en `string`.** Trois orthographes d'une même porte coexisteraient
  dans un `Record`, et la clé morte compterait zéro octet sans que rien ne rougisse.

## Ce que cette décision ne tranche pas

Les valeurs réelles du tableau · comment un runtime déclare ses capacités — poignée de main,
manifeste d'adaptateur, ou les deux · la topologie de processus qui en découle · si les capacités
peuvent changer à chaud · le format d'un graphe.

## Ce qui l'invaliderait

| Vérification | Résultat qui casse la décision |
|---|---|
| **`advisory` contre `owned`** — chercher si un runtime **cède contractuellement** sa politique de résidence : un mode documenté qui la désactive, une API qui en transfère la propriété | **Seule une cession documentée fusionne l'axe.** Une série de demandes honorées ne le fusionne pas : dix succès sur dix ne donnent pas le contrôle, ils donnent dix succès. Un processus étranger applique sa politique pour des raisons invisibles d'ici — mise à jour, pression système, autre client. |
| Dépasser la fenêtre de contexte de la porte `/v1` avec le préambule complet | Si la troncature est silencieuse **et** sans effet observable sur les réponses, `context` cesse d'être un axe |
| Annuler à mi-inférence sur chaque pile | Si aucune n'annule autrement qu'en mourant, `cancellation` se réduit à un booléen |

## Conséquences

- `[M]` La chaîne `HISTORY_MAX = 10` (`shared/domain/assistantModel.ts:47`) est appliquée en quatre
  points sur trois couches : `main/assistant/validation.ts:20`, `main/assistant/instruction.ts:87`,
  `main/assistant/brainProvider.ts:50`, `renderer/src/stores/assistant.ts:144`. `[M]` Le préambule
  qui l'accompagne concatène **le catalogue complet des actions** (`instruction.ts:103-112`) sous un
  `INSTRUCTION_MAX` de 10 000. Sous `context: 'per-install'`, cette borne devient un **rabattement**
  contre une fenêtre découverte, et les cinq fichiers changent ensemble.
- `progress: 'push'` ajoute `subscribe?` à `JobRunner` — modification **additive** de
  `main/provider/jobManager.ts`, dont le plancher de sondage est aujourd'hui de deux secondes
  `[M]` (`jobManager.ts:139`).
- `cancellation` s'appuie sur l'existant : `main/processClient.ts` transforme déjà un `AbortSignal`
  en message `cancel`, et `main/dictation/session.ts` porte déjà le drapeau `discarding` qui
  empêche un résultat tardif d'atterrir `[M]`.
- **Dépendance de compilation** : `RuntimeOccupancy.reclaimable` d'ADR-19 est dérivé de `residency`
  déclaré ici, et `RuntimeEndpointId` y est la clé de `runtimeBytes`. **Cette ADR précède ADR-19 :
  son énumération et son type marqué doivent exister avant qu'ADR-19 compile.**

**Fichiers** : `shared/domain/aiRuntime.ts` *(neuf)* · `shared/domain/assistantModel.ts` ·
`shared/domain/job.ts` · `main/assistant/{validation.ts,instruction.ts,brainProvider.ts}` ·
`renderer/src/stores/assistant.ts` · `main/provider/jobManager.ts` · `main/processClient.ts` ·
`preload/index.ts` · `renderer/src/stores/jobs.ts`.
