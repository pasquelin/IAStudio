# ADR-19 — La mémoire est un seul pot, et personne ne la déduit par soustraction

- **Statut** : Proposé
- **Date** : 2026-08-21
- **Dépend de** : [ADR-18](ADR-18-capacites-runtime-par-porte.md) — `residency` et
  `RuntimeEndpointId` y sont définis, et `reclaimable` ci-dessous en dérive

**Provenance.** `[M]` mesuré — lu dans le dépôt, avec `fichier:ligne` · `[D]` documenté — source
nommée · `[?]` aucune donnée, et c'est dit.

## Contexte

`[M]` Le dépôt ne contient aujourd'hui **aucun** `totalmem`, `freemem`, `statfs`, `getGPUInfo` ni
`nvidia-smi` — `grep` sur `src/` et `scripts/`, vide. Son unique budget de ressource est un compte
de cœurs : `main/services.ts:257`, `spareCores = max(1, availableParallelism() − 2)`.

Deux décisions doivent être prises **avant** qu'un runtime local soit expédié, parce qu'elles sont
chères à défaire ensuite.

**La première : un pot ou deux.** `[D]` Apple Silicon expose une mémoire unifiée entre le
processeur et le GPU ; `[?]` la fraction réellement allouable au GPU n'est mesurée nulle part ici.
Sur une telle machine, `{ ramBytes, vramBytes }` comme budgets **indépendants** est faux par
construction : ce sont deux vues d'un même pot, et les additionner surestime la place du double.

**La seconde : qui répond.** `[D]` `app.getGPUInfo()` rend les informations GPU de Chromium ; `[?]`
qu'un champ de VRAM y figure, et sur quelles plateformes, n'est vérifié par personne ici.

## Décision

### A. `MemorySnapshot` porte `domain`, et jamais deux budgets indépendants

```ts
// shared/domain/aiMemory.ts
export type MemoryDomain = 'unified' | 'split'

export type MemorySnapshot = {
  domain: MemoryDomain
  /** Qui a répondu. Jamais « calculé » : voir R2. */
  source: 'runtime' | 'probe' | 'none'
  at: number
  physicalBytes: number
  /** Ce que le studio s'autorise à prendre au total, runtimes compris. */
  appBudgetBytes: number
  /** Ce que la fenêtre occupe. Sur `unified`, sort du MÊME pot que les poids. */
  rendererReservedBytes: number
  runtimeBytes: Readonly<Record<RuntimeEndpointId, RuntimeOccupancy>>
  /** Jamais engagée : fragmentation, cache d'allocateur, ce que le système ne rend pas. */
  headroomBytes: number
  availableBytes: number
}

export type RuntimeOccupancy = {
  bytes: number
  /**
   * Ces octets peuvent-ils entrer dans un plan de libération, MAINTENANT.
   *
   * Dérivé de deux choses, jamais renseigné à la main, et **jamais de `residency` seul** :
   * `owned` répond toujours vrai ; `opaque` toujours faux ; **`advisory` répond faux jusqu'à
   * ce qu'une re-mesure ait confirmé qu'une libération demandée a bien eu lieu, puis vrai.**
   *
   * Sa valeur change donc dans le temps SANS que les capacités du runtime changent, et c'est
   * exactement pourquoi ce n'est pas une projection d'un champ. Écrit
   * `reclaimable = residency === 'owned'`, on perd le cas advisory confirmé — le seul où un
   * processus étranger nous a effectivement rendu de la place — et l'ordonnanceur planifie
   * comme si elle n'existait pas.
   */
  reclaimable: boolean
}
```

**Sur `domain: 'unified'`, il n'existe qu'un budget** : les besoins d'un modèle s'y expriment en
une grandeur, pas deux.

### B. Trois règles d'autorité

> **R1. Le runtime fait autorité sur son occupation ; la sonde ne fait autorité que sur le
> physique.** `source: 'probe'` sert à trier un catalogue avant qu'un runtime existe, et à dire
> pourquoi rien n'est proposé — **jamais à admettre un job**.

> **R2. Après une libération, l'ordonnanceur ne suppose rien : il redemande un `MemorySnapshot`.**
> Toute forme d'`available += taille_libérée` est interdite. Conséquence de signature : une
> libération rend un `Promise<MemorySnapshot>`, jamais `void`.

> **R3. Le pic d'un job n'est pas la somme des tailles déclarées.** Le manifeste donne une
> réservation *a priori* ; le pic réel inclut les activations, le cache d'allocateur, la
> fragmentation et la réserve du renderer. Une réservation démentie est une mesure à écrire, pas
> une erreur à ignorer.

### C. Un verdict de compatibilité fermé, `unknown` compris

```ts
export type Compatibility =
  | 'compatible' | 'slow' | 'experimental'
  | 'insufficient-memory' | 'incompatible'
  /** Aucune autorité n'a répondu. L'état par DÉFAUT, jamais un échec. */
  | 'unknown'
```

R1 rend `unknown` fréquent : sans relevé de runtime, c'est l'honnête réponse.

### D. `requested` / `constraint` / `effective` : deux champs, un sélecteur

```ts
export type Governed<T> = {
  /** Ce que la personne a réglé. Le SEUL des trois qui soit persisté. */
  requested: T
  /** Une BORNE, jamais une valeur. Temporaire, révocable, jamais écrite au disque. */
  constraint?: { bound: T; by: ConstraintSource }
}

/** Dérivé, jamais stocké — composé par la règle que le réglage utilise déjà. */
export function effectiveOf<T>(governed: Governed<T>, compose: (a: T, b: T) => T): T
```

`effective` n'est pas un champ : stocker une valeur dérivable ferait deux sources de vérité,
exactement ce que R2 interdit un cran plus bas.

`[M]` La forme existe déjà dans le dépôt, entre deux préférences :
`engines/scene/viewportQuality.ts`, où `shadowMapSizeFor(quality, preferred)` est **un plafond et
non une valeur** — « les deux réglages composent au lieu de s'écraser : quelqu'un qui a choisi
1024 garde 1024 ». Une contrainte système est une troisième origine, non persistée, composée par
la même règle.

## Alternatives écartées

- **`{ ramBytes, vramBytes }` indépendants.** Le retrofit est le point entier de cette ADR.
  Expédier deux budgets puis découvrir la mémoire unifiée oblige à changer **ensemble** :
  l'ordonnanceur, les champs `vramMinBytes` / `ramMinBytes` du manifeste — `[M]` dont l'ancêtre
  `SttModelFile` (`shared/domain/dictation.ts:155`) est **dans le binaire**, donc tout manifeste
  expédié est réécrit et tout manifeste fourni par la personne exige une migration de
  `schemaVersion` —, la règle d'admission, et le verdict `Compatibility`. Et jusqu'à la **phrase de
  refus** : « 24 Go de VRAM requis » est faux sur une machine unifiée, ce qui touche
  `shared/i18n/{fr,en}/models.json`, `renderer/src/hooks/usePlanRefusal.ts` et les gardes qui
  exigent une clé par valeur d'union (`renderer/src/dynamic-keys.i18n.test.ts`,
  `shared/i18n/bundles.test.ts`). Trois couches, un seul changement.
- **Un champ `trusted` sur `RuntimeOccupancy`.** Supprimé : il n'avait aucune conséquence propre.
  La fiabilité d'un relevé est `memoryReporting` (ADR-18), une propriété du runtime et non de
  chaque relevé.
- **Faire migrer `generation.concurrentJobs` vers un budget en octets.** Écarté, et il faut le
  dire : un budget mémoire local et un compte de jobs distants **peuvent coexister**. On ajoute un
  réglage, on n'en migre pas un — le retrofit est bon marché, donc ce n'est pas un contrat.

## Ce que cette décision ne tranche pas

Les seuils de `appBudgetBytes` et `headroomBytes` · les niveaux de pression et toute politique de
réduction de qualité · qui choisit `appBudgetBytes` · le comportement quand `source: 'none'` et
qu'un job est demandé quand même · si `rendererReservedBytes` est mesurable autrement que par
convention `[?]` · la fréquence de rafraîchissement d'un relevé.

## Ce qui l'invaliderait

| Mesure | Résultat qui casse la décision |
|---|---|
| Relevé du runtime contre occupation système réelle, sur macOS unifié et sur CUDA | Un relevé faux de façon systématique ⇒ `source: 'runtime'` n'est plus une autorité, R1 tombe |
| Libération puis re-mesure immédiate, sur chaque pile | Si la mémoire revient exactement et immédiatement **partout**, R2 devient une précaution inutile |
| Occupation GPU du viewport, scène ouverte contre scène fermée | Si elle est négligeable, `rendererReservedBytes` sort du relevé |

## Conséquences

- `[M]` **Trois libérations existantes contredisent R2** et doivent être alignées :
  `main/dictation/session.ts:126` (inactivité), `:149` (panne), `:290` (arrêt) ferment le moteur, et
  la JSDoc de la première annonce « returning around 700 MB » — une soustraction, pas une mesure.
- `[M]` **Un défaut de la section D est déjà en place dans le code** :
  `renderer/src/hooks/useViewportSetting.ts:45` retient une écriture et la compare **par
  identité** — `pending?.against === stored`. Une contrainte poussée par le processus principal
  remplace `stored`, l'identité change, et le réglage que la personne était en train de bouger
  disparaît sans un mot.
- Le refus local passe par le canal de refus existant — `usePlanRefusal` + `isBeyondPlan`,
  consommé par `panels/models/Models/Models.tsx:141` et `panels/generator/Generator.tsx:117`
  `[M]` — ou il y en aura deux.

**Fichiers** : `shared/domain/aiMemory.ts` *(neuf)* ·
`shared/domain/{settings.ts,settingsRegistry.ts,model.ts}` ·
`shared/i18n/{fr,en}/{settings,models}.json` ·
`renderer/src/hooks/{useViewportSetting.ts,usePlanRefusal.ts}` ·
`renderer/src/spaces/three/SceneDocument.tsx:202` ·
`renderer/src/engines/scene/{SceneRenderer.ts:2136,viewportQuality.ts}` ·
`renderer/src/panels/{models/Models/Models.tsx,generator/Generator.tsx}` ·
`main/dictation/session.ts` *(R2)*.
