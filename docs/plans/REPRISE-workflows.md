# Reprise — chantier « workflows et node editor »

**À coller tel quel dans une nouvelle session.** Écrit le 8 août 2026, après trois étapes livrées.

---

## Le prompt

> Je reprends le chantier « workflows et node editor » de Scenario Studio, dans
> `/Users/pasquelin/Applications/scenario`. Tu travailles en autonomie, du début à la fin.
>
> **Mise en place, dans cet ordre, sans le raccourcir :**
>
> 1. Lis en entier, dans cet ordre : `CLAUDE.md` à la racine (il prime sur tout, y compris sur le
>    plan) ; `docs/REPRISE.md` — le § 4 est le chantier, le § 3.6 porte les dettes ; puis
>    `docs/plans/2026-08-08-workflows-node-editor.md`, ton plan en dix étapes. **Les étapes 1, 2 et
>    3 sont cochées et livrées** : lis leurs encadrés, ils disent où le plan s'est trompé.
> 2. Ton worktree existe déjà : `cd /Users/pasquelin/Applications/scenario/.claude/worktrees/workflows`.
>    S'il a disparu : `git worktree add .claude/worktrees/workflows feat/workflows` puis
>    `cp CLAUDE.md .claude/worktrees/workflows/` et `pnpm install && pnpm rebuild:native`.
> 3. `git log --oneline -8` puis `pnpm validate` — **doit être vert avant ta première ligne**.
>    Référence au moment d'écrire : **316 fichiers de tests, 3931 tests**. Aucune étape ne fait
>    baisser ce nombre.
> 4. **Préfixe chaque commande du chemin absolu du worktree.** Le shell retombe ailleurs entre deux
>    appels, et d'autres sessions travaillent dans ce dépôt.
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
> 4. Après chaque étape, avant d'ouvrir la suivante :
>    `git fetch origin develop && git rebase --autostash develop && pnpm validate`. C'est le
>    `develop` **local** qui fait foi.
> 5. **Fusionne dans `develop` au fil de l'eau** (`git merge --no-ff`, depuis le dépôt principal où
>    `develop` est sorti), pour ne pas laisser grossir la branche. Tu ne pousses rien, tu ne touches
>    jamais à `main`, tu ne poses jamais de tag.
> 6. `git add` par chemin explicite, jamais `git add -A` : l'index est partagé entre worktrees.
>    Même règle pour `git stash` — préfère un commit de travail, ou une copie dans le scratchpad.
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
> une étape se révèle plus grosse que le plan ne le dit, tu me le dis avec ce que tu as trouvé et ta
> recommandation — tu ne réduis pas le périmètre tout seul.
>
> **Entre deux étapes, une ligne :** l'étape livrée, ce que `validate` rend, ce que `/code-review` a
> trouvé et ce que tu en as retenu. Pas de récit.
>
> Commence par lire, puis reprends à l'étape 4. Ne me demande pas la permission de démarrer.

---

## L'état exact au moment d'écrire

**Trois étapes livrées, chacune avec `pnpm validate` vert, `/simplify` et `/code-review`** —
**21 défauts confirmés et corrigés** au total, puis **10 de plus** à la revue de cohérence de la
branche entière.

> **La revue de cohérence a été lue et appliquée.** Elle a rendu dix défauts confirmés, dont
> quatre sévères, tous corrigés — le détail est dans le journal du plan, entre l'étape 3 et
> l'étape 4. Les deux dettes que cette section donnait pour assumées sont **payées** : l'intervalle
> de poll se calcule sur la charge, et l'annulation passe par une file à priorité. Les deux
> décisions ont été prises par l'utilisateur le 8 août 2026.
>
> **`pnpm validate` était rouge sans que personne le sache.** Les 3931 tests passaient, mais trois
> budgets de couverture débordaient : le pipe `| tail` masquait le code de sortie. `develop` était
> vert, la branche non. Vérifier le code de sortie, pas la dernière ligne.

| Étape | Commit | Ce qu'elle a livré |
|---|---|---|
| 1 | `eddbda0` | Les deux statuts de workflow dans le `JobManager`, et la progression normalisée |
| 2 | `f45857c` | Le limiteur de débit, sur le `fetch` du client SDK |
| 3 | `6421aa0` | Un job payé survit à la fermeture de l'application |
| — | ci-après | La revue de cohérence de branche, ses dix correctifs et les deux arbitrages |

**L'étape 4 est entamée, non commitée.** Ce qui est écrit et testé, mis de côté dans
`<scratchpad>/step4/` si le worktree a été nettoyé :

- `src/shared/domain/job.ts` — `Job.cost` et le type `CostEstimate` ;
- `src/main/scenario/cost.ts` — `costEstimatorOf`, qui lit l'estimation sur le **402** que rend un
  `?dryRun=true` ;
- `src/main/scenario/cost.test.ts` — cinq tests, verts.

Il reste, pour clore l'étape 4 : le canal `scenario:estimate-cost` (typé dans `shared/ipc.ts`,
validé par zod côté main comme le fait `scenario/validation.ts`), le badge débouncé et annulable
sur le bouton Générer, le coût réel dans la barre de jobs, et `usages.list` dans Réglages > Compte.

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
3. **`creativeUnitsCost` n'est pas sur le job** mais sur la réponse de **soumission**
   (`GenerateRunModelResponse`), à côté de `job`. Or `runnerOf` fait `(...).job` et jette le reste :
   le coût réel n'est lisible qu'à cet instant. C'est là qu'il faut le capter.

## Les pièges déjà payés — ne pas les repayer

- **Le SDK arme le timeout d'une requête AVANT d'appeler le transport.** Toute attente dans le
  `fetch` est prise sur le budget de l'aller-retour. Au-delà de dix secondes, le limiteur rend un
  **429 de synthèse portant `retry-after-ms`** — lever une erreur ne marche pas, le SDK la rattrape,
  la réessaie et la remballe en `APIConnectionError`, donc une limite de débit arriverait à l'écran
  en « échec réseau ».
- **Une note de job ne part que si l'API a conclu.** Un échec local — réseau, clé indisponible,
  disque — garde la note : le job est vivant et payé de l'autre côté.
- **La collecte est idempotente** depuis l'étape 3 (`localIdOf` sur la sortie). Ne pas la défaire.
- **`accountFingerprint`** (`settings/accounts.ts`) nomme un compte par un digest de sa clé, pas par
  l'id du carnet qu'un retrait/ré-ajout renouvelle. C'est la notion qu'emploient le limiteur **et**
  la persistance des jobs.
- **La convention d'arête de Scenario est inversée** — `{ source: consumer, target: provider }`,
  vérifié dans `lib/workflow_converter.js`. Relire le § 4.4 de `REPRISE.md` **avant la première
  arête** de l'étape 6.

## Ce qui attend ton arbitrage

**Le polling seul dépense 90 des 100 requêtes par minute** à la concurrence par défaut (3 jobs,
poll toutes les 2 s), et 300 à la concurrence 10 que les workflows demandent. Le limiteur ne crée
pas ce dépassement, il le rend net — mais il sera saturé en usage normal tant que la demande n'est
pas réduite. Recommandation : allonger l'intervalle de poll, ou l'asservir au budget restant de la
fenêtre. C'est un changement de comportement, donc une décision, pas un correctif.

## Deux dettes assumées, écrites pour ne pas être redécouvertes

- **L'annulation d'un job fait la queue comme le reste.** Sous saturation elle est tenue au plus dix
  secondes, puis reçoit un 429 que le SDK réessaie deux fois ; si les trois échouent, `runner.cancel`
  est appelé sous un `.catch(() => {})` et le studio marque le job annulé pendant que le job distant
  continue de consommer. Une file à priorité serait le vrai remède.
- **Deux clés d'un même projet Scenario ouvrent deux fenêtres de débit**, donc 200 requêtes par
  minute contre un quota de 100. Seul `owner-scope` sait qu'elles n'en font qu'une, et il répond
  `null` tant qu'aucune liste d'assets n'est revenue — c'est-à-dire pendant la rafale d'un démarrage
  à froid.
