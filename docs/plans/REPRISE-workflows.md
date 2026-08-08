# Reprise — chantier « workflows et node editor »

**À coller tel quel dans une nouvelle session.** Réécrit le 8 août 2026, après la fusion des
trois premières étapes et de la revue de cohérence dans `develop`.

---

## Le prompt

> Je reprends le chantier « workflows et node editor » de Scenario Studio, dans
> `/Users/pasquelin/Applications/scenario`. Tu travailles en autonomie, du début à la fin.
>
> **Mise en place, dans cet ordre, sans le raccourcir :**
>
> 1. Lis en entier, dans cet ordre : `CLAUDE.md` à la racine (il prime sur tout, y compris sur le
>    plan) ; **ce fichier** (`docs/plans/REPRISE-workflows.md`) ; `docs/REPRISE.md` — le § 4 est le
>    chantier, le § 3.6 porte les dettes ; puis `docs/plans/2026-08-08-workflows-node-editor.md`,
>    le plan en dix étapes. **Les étapes 1, 2 et 3 sont cochées, livrées et FUSIONNÉES** : lis
>    leurs encadrés et la section « Revue de cohérence de la branche », ils disent où le plan
>    s'est trompé et ce que la revue a coûté.
> 2. Ton worktree existe déjà : `cd /Users/pasquelin/Applications/scenario/.claude/worktrees/workflows`.
>    S'il a disparu : `git worktree add .claude/worktrees/workflows feat/workflows` puis
>    `cp CLAUDE.md .claude/worktrees/workflows/` et `pnpm install && pnpm rebuild:native`.
> 3. `git log --oneline -8` puis `pnpm validate` — **doit être vert avant ta première ligne**.
>    Référence au 8 août 2026 après fusion : **329 fichiers de tests, 4219 tests**. Aucune étape ne
>    fait baisser ce nombre.
>    **Vérifie le code de sortie, jamais la dernière ligne** : `pnpm validate | tail` masque
>    l'échec, et une session entière a cru la branche verte alors que trois budgets de couverture
>    débordaient. Fais `pnpm validate > /tmp/v.log 2>&1; echo "EXIT=$?"`.
> 4. **Préfixe chaque commande du chemin absolu du worktree.** Le shell retombe ailleurs entre deux
>    appels, et d'autres sessions travaillent dans ce dépôt — `develop` a pris **30 commits**
>    pendant la session précédente.
>
> **Ce que tu fais :** les étapes 4 à 10 du plan, dans l'ordre, sans en sauter ni en fusionner deux.
>
> **Les règles, qui ne se renégocient pas :**
>
> 1. `CLAUDE.md` prime. Tout ce qui vit dans `src/` est en **anglais** — identifiants, commentaires,
>    JSDoc, noms de fichiers, clés i18n, canaux IPC, descriptions de tests. Le français est réservé
>    à `src/shared/i18n/fr.json`, aux valeurs de test qui en viennent, à la documentation et aux
>    messages de commit.
> 2. Une étape = un commit. Jamais deux étapes ensemble, jamais une étape à moitié.
> 3. La Definition of Done s'applique à **chaque** étape, dans l'ordre : tests colocalisés écrits
>    AVEC le code, `pnpm validate` vert, `/simplify`, `/code-review`, corrections retenues
>    appliquées, puis commit. Tu ne demandes pas l'autorisation pour `/simplify` ni `/code-review`.
>    **Ces deux passes trouvent des défauts réels** : à l'étape précédente, `/simplify` a rattrapé
>    une note de job effacée à tort sur trois codes d'échec, et `/code-review` un double appel
>    d'annulation. Ne les traite pas comme une formalité.
> 4. Après chaque étape, avant d'ouvrir la suivante :
>    `git fetch origin develop && git rebase --autostash develop && pnpm validate`. C'est le
>    `develop` **local** qui fait foi. **Rebase vraiment à chaque étape** : la fois où ça a été
>    sauté, le rattrapage a coûté trois commits à rejouer et sept conflits.
> 5. **Fusionne dans `develop` au fil de l'eau** (`git merge --no-ff`, **depuis le dépôt principal**
>    `/Users/pasquelin/Applications/scenario`, où `develop` est sorti : git refuse de la sortir
>    deux fois). Puis `pnpm validate` sur `develop` **après** la fusion — une fusion sans conflit
>    n'est pas une fusion sans contradiction. Tu ne pousses rien, tu ne touches jamais à `main`,
>    tu ne poses jamais de tag.
> 6. `git add` par chemin explicite, jamais `git add -A` : l'index est partagé entre worktrees.
>    Même règle pour `git stash` — préfère un commit de travail.
> 7. **Ce qui doit survivre à la session est commité.** Le scratchpad est propre à la session.
>
> **Dépendances :** `@xyflow/react` (v12.x) est autorisée, et elle seule. L'évaluateur CEL est déjà
> là via les dépendances du SDK. `dagre`, `elkjs`, `zundo`, `immer`, `react-hook-form`,
> `react-flow-smart-edge` sont refusées — l'undo passe par `engines/core/history.ts` et
> `document-store.ts`, qui existent. Toute autre dépendance demande mon arbitrage.
>
> **Les sources, avant le web et avant ta mémoire :** `docs/scenario-api/` puis le MCP `scenario` ;
> pour le SDK, `node_modules/@scenario-labs/sdk/` — **le type du SDK fait foi contre la page de
> doc**, cela s'est vérifié trois fois (voir plus bas) ; React Flow 12 par Context7, jamais de
> mémoire ; l'app en marche par le MCP `electron` après `pnpm start:debug`.
>
> **Un jalon visuel validé uniquement par des tests unitaires n'est validé qu'à moitié.**
>
> **Deux choses sur lesquelles tu m'arrêtes :** à l'étape 10, le graphe devient-il un septième
> espace ou un type de document dans les six ? Pose-la-moi en arrivant à l'étape, pas avant. Et si
> une étape se révèle plus grosse **ou plus petite** que le plan ne le dit, tu me le dis avec ce
> que tu as trouvé et ta recommandation — tu ne changes pas le périmètre tout seul.
>
> **Entre deux étapes, une ligne :** l'étape livrée, ce que `validate` rend, ce que `/code-review` a
> trouvé et ce que tu en as retenu. Pas de récit.
>
> Commence par lire, puis reprends à l'étape 4. Ne me demande pas la permission de démarrer.

---

## L'état exact au moment d'écrire

**Trois étapes livrées, revues, et FUSIONNÉES dans `develop`** — plus une revue de cohérence de la
branche entière. **31 défauts confirmés et corrigés** au total (21 par étape, 10 en transverse).

| Étape | Ce qu'elle a livré |
|---|---|
| 1 | Les deux statuts de workflow dans le `JobManager`, et la progression normalisée |
| 2 | Le limiteur de débit, sur le `fetch` du client SDK |
| 3 | Un job payé survit à la fermeture de l'application |
| — | La revue de cohérence : dix défauts, dont quatre qui perdaient du travail ou de l'argent |

`develop` après fusion : **329 fichiers de tests, 4219 tests, `pnpm validate` vert.**

### Ce que la revue de cohérence a changé, et qu'il ne faut pas défaire

- **`evt:jobs-changed`** porte la liste entière quand elle **gagne ou perd** une entrée. Il existe
  parce qu'un événement de progression nomme un job par son identifiant, et qu'une réplique ne sait
  que fusionner dans une ligne qu'elle détient déjà : un job repris, un job qui quitte la session,
  et une soumission vue depuis une **autre fenêtre** lui sont invisibles par construction.
- **`SETTLED_FOR_GOOD`** ne contient que `not-found`. C'est la seule réponse par laquelle l'API
  conclut sur l'existence du job. Tout le reste garde sa note : le coût des deux erreurs n'est pas
  le même — une note rejouée pour rien est du bruit, une note effacée est une génération payée
  perdue. **Ne pas dériver cette décision de `isRetryable`**, qui répond à une autre question.
- **L'intervalle de poll est calculé**, pas fixe : `max(2 s, jobs × 60 s / POLL_REQUESTS_PER_MINUTE)`.
  La constante est **dérivée** de `ORDINARY_REQUESTS_PER_WINDOW` de `rate-limiter.ts`, pas écrite à
  la main — un chiffre en dur redeviendrait faux à la première retouche des trois autres.
- **L'annulation passe devant** : file à priorité **et** places réservées (`URGENT_RESERVE`).
  Passer devant ne suffit pas quand la fenêtre est pleine. La priorité voyage par
  `AsyncLocalStorage` (`asUrgent`) parce que le seul lecteur est le transport et que tout ce qui se
  trouve entre les deux est le SDK. **Réservé à l'annulation.**
- **`cancel` sort immédiatement si `entry.cancelled` est déjà vrai.** Tout le préfixe de `cancel`
  est synchrone : deux clics rapprochés envoyaient deux annulations pour le même job.

---

## Ce qui a changé sous les pieds du plan : l'étape 4 a rétréci

**`feat/usage-window` a été fusionnée dans `develop` pendant la session précédente**, et elle livre
le point 4 de l'étape 4. La consommation de chaque clé a désormais **sa propre fenêtre** —
`src/renderer/src/usage/UsageWindow.tsx`, alimentée par `main/scenario/usage.ts` et
`usage-aggregate.ts`, avec `usages.list`, `pricing.oscu.retrievePrices`, un journal paginé par
compte et une période dans la barre de titre.

**Donc : ne pas refaire « `usages.list` dans Réglages > Compte ».** C'est fait, mieux et ailleurs.
Le plan écrit encore le contraire à l'étape 4 — il a été écrit avant.

**Ce que l'étape 4 garde**, et qui n'existe nulle part (`grep -rn dryRun src/` → zéro) :

1. le canal `scenario:estimate-cost` (typé dans `shared/ipc.ts`, validé par zod côté main comme le
   fait `scenario/validation.ts`) ;
2. le badge de coût sur le bouton Générer, **débouncé** et **annulable** — un formulaire qu'on
   remplit ne doit pas lancer une estimation par frappe, et le limiteur de l'étape 2 rappelle que
   ces appels comptent ;
3. le coût réel dans la barre de jobs. **`creativeUnitsCost` n'est pas sur le job** mais sur la
   réponse de **soumission** (`GenerateRunModelResponse`), à côté de `job` — or `runnerOf` fait
   `(...).job` et jette le reste. C'est là qu'il faut le capter, c'est le seul instant où il existe.
   Noter que `usage-aggregate.ts` lit déjà ce champ **côté événements de facturation** : deux
   chemins différents vers la même grandeur, ne pas les confondre.

### Le code de l'étape 4 déjà écrit et testé

Il vivait dans le scratchpad d'une session morte. Le voici en entier, pour qu'il ne se reperde pas.

**`src/shared/domain/job.ts`** — deux ajouts :

```ts
  /**
   * What it actually cost, in creative units. Known at submission and never again: the API
   * carries it on the response that creates the job, not on the job it polls back.
   */
  cost?: number
```

```ts
/**
 * What a generation would cost, asked before it is run.
 *
 * `null` where the API declines to say — an estimate is a courtesy, and a button that refuses to
 * work because the price could not be fetched would be worse than a button with no price on it.
 */
export type CostEstimate = { creativeUnits: number } | null
```

**`src/main/scenario/cost.ts`** — écrit, non commité :

```ts
import { APIError } from '@scenario-labs/sdk'
import type { CostEstimate } from '@shared/domain/job'
import { isRecord } from '@shared/guards'

/**
 * What a generation would cost, without running it.
 *
 * `?dryRun=true` creates no job and spends nothing. The catch is how it answers: **HTTP 402**,
 * carrying `estimatedCost` in its body (`workflows-and-apps.md`, "Dry Run Response"). So the one
 * call in the studio where a 4xx is the success path — reduced through `failureOf` like any
 * other, it would surface as an unexpected failure and the button would say nothing.
 */
export type CostEstimator = (modelId: string, body: Record<string, unknown>) => Promise<CostEstimate>

export type DryRunner = {
  runModel: (
    modelId: string,
    params: { body: Record<string, unknown>; dryRun: boolean },
  ) => Promise<unknown>
}

const estimatedCostOf = (error: unknown): number | null => {
  if (!(error instanceof APIError) || error.status !== 402) return null
  if (!isRecord(error.error)) return null

  const { estimatedCost } = error.error
  return typeof estimatedCost === 'number' && Number.isFinite(estimatedCost) ? estimatedCost : null
}

export function costEstimatorOf(client: DryRunner): CostEstimator {
  return async (modelId, body) => {
    try {
      await client.runModel(modelId, { body, dryRun: true })
      // No 402 means the API did not price this one. Nothing was generated either way — the
      // dry run flag is honoured whatever the answer — so there is simply no figure to show.
      return null
    } catch (error) {
      const creativeUnits = estimatedCostOf(error)
      return creativeUnits === null ? null : { creativeUnits }
    }
  }
}
```

**`src/main/scenario/cost.test.ts`** — cinq tests, verts au moment de l'écriture :

```ts
import { APIError } from '@scenario-labs/sdk'
import { describe, expect, it, vi } from 'vitest'
import { costEstimatorOf } from './cost'

const refusedWith = (status: number, body: object): unknown =>
  APIError.generate(status, body, undefined, new Headers())

const estimator = (answer: () => Promise<unknown>) => costEstimatorOf({ runModel: vi.fn(answer) })

describe('cost estimate', () => {
  /**
   * The one call in the studio where a 4xx is the success path: a dry run answers 402 and puts
   * the figure in the body. Read as an ordinary failure, the button would say nothing.
   */
  it('reads the estimate off the 402 the API answers with', async () => {
    const estimate = estimator(() =>
      Promise.reject(refusedWith(402, { message: 'Dry run completed', estimatedCost: 12 })),
    )

    await expect(estimate('model_flux', { prompt: 'a rock' })).resolves.toEqual({
      creativeUnits: 12,
    })
  })

  it('asks for a dry run, so nothing is generated and nothing is spent', async () => {
    const runModel = vi.fn(() => Promise.reject(refusedWith(402, { estimatedCost: 3 })))
    await costEstimatorOf({ runModel })('model_flux', { prompt: 'a rock' })

    expect(runModel).toHaveBeenCalledWith('model_flux', {
      body: { prompt: 'a rock' },
      dryRun: true,
    })
  })

  // A price is a courtesy: no figure means a button with no badge, never a button that refuses.
  it('answers with no figure rather than a failure when the API prices nothing', async () => {
    await expect(estimator(() => Promise.resolve({ job: {} }))('model_flux', {})).resolves.toBeNull()
  })

  it('answers with no figure on a refusal that is not a dry run', async () => {
    const estimate = estimator(() => Promise.reject(refusedWith(400, { message: 'bad body' })))

    await expect(estimate('model_flux', {})).resolves.toBeNull()
  })

  it('answers with no figure on a 402 that carries no number', async () => {
    const estimate = estimator(() => Promise.reject(refusedWith(402, { estimatedCost: 'twelve' })))

    await expect(estimate('model_flux', {})).resolves.toBeNull()
  })
})
```

⚠️ **Ce code n'a pas été revérifié depuis que `develop` a pris 30 commits.** `isRecord` vient de
`@shared/guards` et existe toujours ; `failureOf` classe encore le 402 dans `unexpected`
(`scenario/client.ts`), donc le premier point du plan tient. Relancer les tests avant d'y croire.

---

## Ce que le plan dit de faux, vérifié dans le code

**Le type du SDK fait foi contre la page de doc. Trois fois plutôt qu'une :**

1. **Les statuts d'un job de workflow.** Le guide annonce `succeeded`/`failed` et une progression
   0–100 ; `resources/workflows.d.ts` l. 4079-4091 donne à la réponse de `workflows.run` les
   **huit** statuts de la génération et une progression « between 0 and 1 ». `jobs.retrieve` dit
   pareil, le serveur MCP officiel aussi. L'étape 1 a livré les deux lignes **comme une assurance**.
   **À l'étape 5, observe ce qu'un vrai job de workflow répond, et consigne-le.**
2. **`reducedBy` n'est pas le passage obligé de chaque appel** — il enrobe deux familles de
   handlers IPC, et le `JobManager` poll sans le traverser. Le limiteur est sur
   `ClientOptions.fetch`.
3. **`creativeUnitsCost` n'est pas sur le job** mais sur la réponse de **soumission**. Cf. ci-dessus.

Et un quatrième, découvert à la fusion : **le plan croit `usages.list` à faire, il est livré.**

---

## Les pièges déjà payés — ne pas les repayer

- **Le SDK arme le timeout d'une requête AVANT d'appeler le transport.** Toute attente dans le
  `fetch` est prise sur le budget de l'aller-retour. Au-delà de dix secondes, le limiteur rend un
  **429 de synthèse portant `retry-after-ms`** — lever une erreur ne marche pas, le SDK la rattrape,
  la réessaie et la remballe en `APIConnectionError`, donc une limite de débit arriverait à l'écran
  en « échec réseau ».
- **Une note de job ne part que si l'API a conclu.** Un échec local — réseau, clé indisponible,
  disque — garde la note : le job est vivant et payé de l'autre côté.
- **La collecte est idempotente, et scopée au job** (`held?.jobId === job.id`). Sans le scope, un
  asset tiré de la bibliothèque du compte était adopté comme sortie, sans prompt ni groupe.
- **`accountFingerprint`** (`settings/accounts.ts`) nomme un compte par un digest de sa clé. C'est
  la notion qu'emploient le limiteur, la persistance des jobs **et** le lecteur de conso.
- **Tout client passe par `clientFor(credentials, transport)`.** Trois appelants en ont besoin hors
  du cache : le compte actif, un job repris, et le lecteur de conso. Un `new Scenario` direct
  échapperait au limiteur — la fenêtre de conso l'a fait pendant une journée.
- **La convention d'arête de Scenario est inversée** — `{ source: consumer, target: provider }`,
  vérifié dans `lib/workflow_converter.js`. Relire le § 4.4 de `REPRISE.md` **avant la première
  arête** de l'étape 6.
- **Le LSP de la session indexe parfois un autre worktree** et invente des erreurs sur des fichiers
  qui n'existent pas ici. `pnpm typecheck` fait foi.

## Deux dettes, écrites pour ne pas être redécouvertes

- **L'écriture atomique existe en double** entre `scenario/job-store.ts` et `project/documents.ts`,
  commentaire identique compris, et `isMissing` avec. Un correctif a été appliqué au premier
  (le `rm` de nettoyage ne doit pas masquer l'erreur d'origine) et **pas au second**. Le § 3.6 de
  `REPRISE.md` porte le détail et la marche à suivre : le nom de la copie de transit doit rester un
  paramètre, les deux politiques diffèrent délibérément.
- **`accounts.of` reconstruit un client par job repris**, chacun coûtant un déchiffrement keychain,
  un hachage par compte du carnet, et en dev une remontée de `.env` en lecture synchrone. Sur le
  chemin de démarrage. Pré-existant, sous la milliseconde pour une poignée de jobs — une remarque
  de forme, pas un incendie. `credentialsByFingerprint` prend déjà un carnet en argument : la
  couture existe pour le résoudre une fois hors de la boucle.
