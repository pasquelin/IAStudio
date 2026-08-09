# Plan — les workflows Scenario et le node editor

**Branche** `feat/workflows` · **Worktree** `.claude/worktrees/workflows` · **Base** `develop`

Ce plan couvre le **§ 4 de `docs/REPRISE.md`** en entier, plus les deux dettes d’API du § 3.6 qui le
bloquent. Il est écrit pour être exécuté **sans supervision** : chaque étape porte sa décision, ses
fichiers, ses pièges et son critère de fin.

Le sujet est le plus gros manque fonctionnel du projet, et le seul qui ferait passer Scenario Studio
de « une interface devant une API » à « un outil ». Il est aussi celui où Scenario donne le plus :
**le SDK publie le compilateur de son propre éditeur visuel**.

## Les règles du chantier — elles ne se renégocient pas

1. **`CLAUDE.md` prime sur ce plan.** Tout ce qui vit dans `src/` est en **anglais** : identifiants,
   commentaires, JSDoc, noms de fichiers, clés i18n, canaux IPC, descriptions de tests. Ce
   fichier-ci est de la documentation : il est en français, comme les messages de commit.
2. **Une étape = un commit.** Jamais deux étapes dans le même commit, jamais une étape à moitié.
3. **La Definition of Done de `CLAUDE.md` s’applique à CHAQUE étape**, dans l’ordre : tests
   colocalisés écrits *avec* le code → `pnpm validate` vert → `/simplify` → `/code-review` →
   corrections retenues appliquées → commit. Une étape annoncée sans ces cinq points est invalide.
   **Ne pas demander l’autorisation pour `/simplify` et `/code-review`** : ils font partie du
   travail.
4. **Rebaser sur `develop` LOCAL après chaque étape**, avant d’ouvrir la suivante :
   `git fetch origin develop && git rebase --autostash develop && pnpm validate`. Le `fetch`
   rapproche `develop` local du remote, il ne sert pas de base au rebase — rebaser sur
   `origin/develop` ferait disparaître des fusions locales non publiées.
5. **Rien n’est fusionné dans `develop`** avant le feu vert de l’utilisateur. **Rien n’est poussé.**
   **Jamais de merge dans `main`**, jamais de tag.
6. **`git add` par chemin explicite**, jamais `git add -A` : l’index est partagé entre worktrees.
   Même règle pour `git stash` : préférer un commit de travail.
7. **Cocher l’étape ici** (`- [x]`) dans le commit qui la livre, avec une ligne sur ce qui a
   réellement été fait si cela diverge du plan. Ce fichier est le journal du chantier.
8. **Ce qui doit survivre à la session est commité.** `docs/specs/`, `docs/scenario-api/` et
   `docs/superpowers/` sont **ignorés par git** : ils sont absents du worktree, et ils ne sont pas
   perdus — ils vivent dans le dépôt principal, `/Users/pasquelin/Applications/scenario/docs/`.
   Ne jamais conclure « la doc a disparu », ne jamais la recréer.

## Installation du worktree

```bash
cd /Users/pasquelin/Applications/scenario
git worktree add .claude/worktrees/workflows -b feat/workflows develop
cp CLAUDE.md .claude/worktrees/workflows/
cd .claude/worktrees/workflows
pnpm install
pnpm rebuild:native          # obligatoire : better-sqlite3
pnpm validate                # DOIT être vert avant la première ligne — c'est la référence
```

**Préfixer chaque commande du chemin absolu du worktree.** Le shell retombe ailleurs entre deux
appels, et un build lancé au mauvais endroit écrase le `out/` du voisin.

Si `pnpm start` répond `Error: Electron uninstall`, c’est que `pnpm install` n’a pas posé le
binaire : `node node_modules/electron/install.js` le télécharge.

## Où lire, et dans quel ordre

| Sujet | Source, dans cet ordre |
|---|---|
| Le chantier | **`docs/REPRISE.md` § 4** en entier, puis § 3.6 |
| L’API workflows | `docs/scenario-api/guides/get-started/documentation/workflows-and-apps.md` (1296 lignes), puis `docs/scenario-api/reference/workflows.*.md` (8 fichiers) — **avant le web** |
| Le SDK | `node_modules/@scenario-labs/sdk/lib/workflow_converter.d.ts` et `.js`, `workflow_validator.*`, `workflow_import_validator.*`. **Le type du SDK fait foi contre la page de doc** |
| React Flow 12 | Context7 (`@xyflow/react`), pas la mémoire — la v12 a renommé la moitié de son API |
| L’app en marche | MCP `electron`, après `pnpm start:debug`. ⚠️ le port 9222 est unique : si une autre session a lancé l’app, c’est son instance qu’on pilote |

## Dépendances

**Autorisée pour ce chantier, et elle seule : `@xyflow/react` (v12.x).** MIT, trois dépendances
(`@xyflow/system`, `classcat`, `zustand` — dont `zustand`, déjà dans le projet). L’import CSS est
obligatoire (`@xyflow/react/dist/base.css`).

**Déjà présent, aucune installation :** l’évaluateur CEL vit dans `@scenario-labs/sdk/tools/cel` et
repose sur `@marcbachmann/cel-js`, qui est une dépendance du SDK et est **dans le store pnpm**.

**Refusé sans un nouvel arbitrage de l’utilisateur :** `dagre`, `elkjs`, `zundo`, `immer`,
`react-hook-form`, `react-flow-smart-edge`. L’auto-layout et l’undo se font à la main — le projet a
déjà `engines/core/history.ts`, générique et partagé, et un `document-store` avec `beginGesture` /
`endGesture`. **Réutiliser, ne pas installer.**

---

## La décision d’architecture qui gouverne les étapes 6 à 8

Elle est prise ici, une fois, parce que tout en dépend.

**Le moteur d’exécution est LOCAL. La délégation à Scenario est une fonction d’export.**

    graphExecutor  (local, par défaut)     →  un runModel par node, via le JobManager
    workflows.run  (Scenario, à l’export)  →  un job, metadata.flow, publication en App

**Pourquoi le local, et pas la délégation seule :**

- **Le cache par hash est ce qui rend un node editor supportable.** Changer le prompt du dernier
  node ne doit relancer que ce node. Déléguer l’interdit : un `workflows.run` réexécute tout.
- **Les nodes que Scenario n’a pas sont ceux qui donneraient sa valeur au studio** : un fichier
  local, un `ffmpegConcat`, un aperçu PBR sur le noyau GPU existant, un export Unity ou Godot.
  Ils n’existent que sous exécution locale.
- **50 nodes et 10 jobs concurrents** sont des plafonds subis en délégation, contournables en local.

**Et pourquoi la délégation quand même :** c’est la seule voie vers la publication en App, et
`metadata.flow` donne gratuitement le statut et les assets **par node** — donc un retour visuel sur
le graphe entier en un seul poll. L’export est donc une vraie fonctionnalité, pas une concession.

**Conséquence assumée :** un graphe qui emploie un node local n’est pas exportable, et l’export doit
le **dire** — pas échouer en silence. Même règle au-delà de 50 nodes.

## Le moteur ignore React, React le pilote (invariant 4)

`engines/graph/` ne contient **aucun import React**, comme `engines/canvas/` et `engines/scene/`.
Le tri topologique, le hachage, la résolution des références et l’ordonnancement sont du calcul pur
et se testent sans DOM. React Flow est de l’affichage : il lit l’état et appelle des méthodes.

Le graphe est un **document** (`kind: 'graph'`), donc il se recrée depuis son état sérialisé
(invariant 3) et il s’enregistre par un `DocumentIo` comme les autres. **Ne pas inventer un
mécanisme de persistance** : `IO_BY_KIND` dans `app/document-io.ts`, et `SCENE_IO` / `TEXTURE_IO`
comme modèles.

---

## Étape 1 — Les deux statuts qui feraient poller pour toujours

- [x] Livrée

> **Suivie, mais sa prémisse est fausse — et c’est le SDK qui le dit.** Les deux corrections
> ci-dessous étaient présentées comme des correctifs ; ce sont des **assurances**.
> `resources/workflows.d.ts` l. 4079-4091 donne à la réponse de `workflows.run` les **huit**
> statuts de la génération et une progression *« between 0 and 1 »* ; `jobs.retrieve`, le seul
> endpoint que le `JobManager` interroge, dit la même chose, et le filtre du serveur MCP officiel
> aussi. Seul le guide en prose annonce `succeeded`/`failed` et 0–100. Rien dans l’historique du
> compte ne permet d’observer un vrai job de workflow (`jobs_list type: workflow` est vide).
>
> Les deux lignes de `STATUS` et l’heuristique de progression sont donc **livrées quand même** :
> inertes si le SDK dit vrai, salvatrices si c’est le guide, et sans collision dans les deux cas.
> Le § 4.5 de `REPRISE.md` porte le détail. **Conséquence pour l’étape 5** : ne pas coder en dur
> l’un des deux vocabulaires — observer ce qu’un vrai job de workflow répond, et le consigner.
>
> **Le seuil de pourcentage est 2, pas 1** — et c’est `/code-review` qui l’a rattrapé. Le dépôt
> documente qu’une génération dépasse sa propre échelle : « *Clamped, because a job that reports
> 1.02 must not overflow its track* » (`design/ProgressBar.tsx`). Diviser dès 1 faisait donc
> retomber la fin de chaque génération à **1 %**, une régression sur le chemin vivant introduite
> pour un vocabulaire que personne n’a observé. Au-dessus de 2, aucune fraction ne peut vivre.
>
> Trois autres corrections de la même revue : `jobProgressOf` rend **0 sur une valeur non finie**
> (un NaN stocké était réémis à chaque poll, `NaN !== NaN` battant la garde qui n’émet que sur
> changement, et `JobsStatus` somme ces valeurs) ; `jobStatusOf` ne lit que les **clés propres** de
> sa table (un statut nommé comme un membre du prototype ne retombait pas sur `running`) ; et le
> test de bout en bout portait ses pourcentages sur un poll **final**, où `advance` sort avant de
> rien stocker — il ne prouvait rien, il les porte désormais sur un poll encore en cours.
>
> Deux ajouts hors plan, issus de `/simplify` : la progression est **bornée à `[0, 1]`** en plus
> d’être normalisée ; et le `sleep` du harness de test est **borné** — ces délais se résolvent sur
> la file de microtâches, donc une boucle de poll dont la condition de sortie régresse tournait à
> l’infini sans qu’aucun timer, celui de vitest compris, ne puisse tomber. La garde **relance hors
> de la chaîne de promesses** (`queueMicrotask`), parce que `execute` rattrape tout : avalée, elle
> réglait le job en échec et laissait passer au vert une boucle emballée. Vérifié en retirant
> `success` de la table : le run devient rouge en 233 ms au lieu de pendre.

**C’est la première étape, et rien du reste ne peut marcher avant.**

`STATUS` dans `src/main/scenario/job-manager.ts` connaît `success`, `failure`, `canceled` — les
valeurs de l’API de **génération**. Un job de **workflow** répond `succeeded`, `failed`, `canceled`
(`workflows-and-apps.md`, « Job Status Values »). Un statut inconnu est traité comme `running`,
délibérément et à raison : c’est ce qui protège d’un statut que Scenario ajouterait. Conséquence
ici : `succeeded` et `failed` ne seraient jamais reconnus, `isFinished` jamais vrai, la boucle ne
s’arrêterait jamais et le job resterait au compteur de concurrence jusqu’à la fermeture.

**À faire.** Deux entrées dans `STATUS` (`succeeded: 'succeeded'`, `failed: 'failed'`), et un test
qui passe les **huit** valeurs de la génération plus les **cinq** du workflow. Ne pas toucher au
repli `?? 'running'` — c’est un choix documenté.

**Et la progression, dans le même commit.** `advance` recopie `remote.progress` tel quel. La
génération le rend en 0–1, le workflow en 0–100 (`"progress": 100` dans la réponse d’exemple du
guide). Normaliser **à l’entrée**, `p > 1 ? p / 100 : p`, pas à l’affichage : la valeur est stockée
dans `Job.progress` et plusieurs surfaces la lisent.

**Fin d’étape** : les treize valeurs sous test, une progression de 100 devenue 1, `pnpm validate`
vert.

---

## Étape 2 — Le limiteur de débit, 100 requêtes par minute

- [x] Livrée

> **Pas dans `reducedBy` : dans le `fetch` du client SDK.** Le plan le donnait pour « le passage
> obligé de chaque appel » — il ne l’est pas. `reducedBy` enrobe deux familles de handlers IPC
> (`scenario` et `assets`, deux appels dans tout `src/`), et le `JobManager` poll droit à travers
> son runner sans le traverser : le plus gros consommateur de requêtes du studio serait passé à
> côté du limiteur. `ClientOptions.fetch` est injectable, et **tout** y passe — la pagination
> automatique et les réessais internes du SDK compris.
>
> Une **fenêtre glissante**, pas un seau à jetons : l’API compte par minute, et l’ouverture d’un
> projet dépense légitimement cent requêtes d’un coup qu’un seau étalerait pour rien. Les
> acquisitions sont **sérialisées** — sans quoi tous ceux que la même expiration réveille se
> disputent l’unique place libérée, et le plus ancien peut perdre indéfiniment. La fenêtre est
> nommée par un **digest de la clé** : elle appartient au compte de toute façon, et rien qui
> pourrait finir dans un dump n’a besoin de porter le secret pour dire lequel.
>
> L’attente est annulable, et le refus arrive **avant que la place soit prise**, pas seulement
> avant l’attente : un appelant qui a renoncé pendant qu’il faisait la queue ne doit pas dépenser
> une requête que l’API compte à tout le monde.
>
> **Le piège qu’ont trouvé `/simplify` puis `/code-review`, et qui aurait rendu le limiteur
> nuisible.** Le SDK arme le timeout d’une requête **avant** d’appeler le transport (`client.js`,
> `fetchWithTimeout`) : toute attente est prise sur le budget de l’aller-retour. La première
> réponse — allonger le timeout du client et lever une erreur au-delà d’un plafond — était fausse
> deux fois, et la revue l’a démontrée par simulation :
>
> 1. **une erreur levée depuis le transport n’arrive jamais telle quelle.** Le SDK rattrape ce qui
>    en sort, le réessaie deux fois, puis le remballe en `APIConnectionError` : la limite serait
>    arrivée à l’utilisateur en « échec réseau » sur une connexion saine, et la branche ajoutée à
>    `failureOf` était du code mort ;
> 2. **allonger le timeout du client le fait pour toutes les requêtes**, y compris l’immense
>    majorité qui n’attend pas : un réseau réellement mort mettait six minutes à se déclarer au
>    lieu de trois.
>
> La bonne réponse tient dans la langue que le SDK parle déjà : au-delà de **10 s** d’attente, le
> transport rend une **réponse 429 de synthèse portant `retry-after-ms`**. Le SDK l’attend au
> millimètre (`client.js` honore cet en-tête), la réessaie, et ce qui remonte s’il persiste est une
> `APIError` que `failureOf` lit déjà en `rate-limited`. Le timeout du client redevient son défaut.
>
> Trois autres corrections de la même revue : le **plafond d’attente est compté à l’arrivée** de
> l’appelant et non quand son tour vient (compté au tour, chaque attendant recevait un budget neuf
> et la file entière était tenue sans borne — 320 acquisitions simulées, zéro refus) ; l’horloge
> est **monotone**, une horloge murale qui recule laissant dans la fenêtre des instants futurs qui
> refusaient *tous* les appels ; et un appelant qui renonce **pendant qu’il fait la queue** est
> relâché tout de suite au lieu d’attendre son tour, sans quoi l’appel SDK derrière lui ne se
> règle jamais. La limite effective est **95** et non 100 : le studio compte au départ, l’API à
> l’arrivée, et la marge absorbe la dérive.
>
> **À arbitrer, hors périmètre de cette étape** : le polling seul dépense **90 requêtes/minute sur
> 100** à la concurrence par défaut (3 jobs, poll à 2 s), et 300 à la concurrence 10 des workflows.
> Le limiteur ne crée pas ce dépassement, il le rend net — mais il sera saturé en usage normal
> tant que la demande n’est pas réduite. Recommandation : allonger l’intervalle de poll, ou
> l’asservir au budget restant. C’est un changement de comportement, donc une décision.
>
> **Hors périmètre, assumé et écrit dans `REPRISE.md`** : `download()` va chercher une URL signée
> par `net.fetch`, et les envois multipart du SDK vont sur S3 avec le `fetch` global. Ni l’un ni
> l’autre n’est un appel d’API, ni compté.

Dette du § 3.6. La limite est **100 requêtes/minute/projet**, écrite dans
`workflows-and-apps.md` § « Rate Limits ». `limits.ts` ne borne que la **taille des lots**, le
`JobManager` que la **concurrence** : trois grandeurs différentes. Dix jobs concurrents qui pollent
toutes les deux secondes font 300 requêtes/minute à eux seuls, et l’exécuteur de graphe va
multiplier les appels.

**Où.** `src/main/scenario/rate-limiter.ts`, un seau à jetons, traversé par **tout le monde** :
`reducedBy` (`client.ts`) est déjà le passage obligé de chaque appel — c’est le bon endroit, et
c’est ce qui garantit qu’aucun appelant ne peut l’oublier.

**Deux décisions.** Le compteur est **par compte actif**, pas global : la limite est par projet, et
une clé porte son projet (`owner-scope.ts`). Et l’attente est **annulable** — un job annulé pendant
qu’il attend un jeton ne doit pas consommer sa place.

**Ce qui existe déjà et qu’il ne faut pas dupliquer.** `createRetry` (`scenario/retry.ts`, sorti du
`JobManager` par `feat/prompt-assist`) réessaie les 429 en backoff exponentiel : le limiteur ne le
remplace pas, il évite d’y arriver. Et `assist-queue.ts` borne la concurrence de l’assistance de
fond — c’est une **troisième** borne de concurrence, à côté de celle du `JobManager` et des lots de
`limits.ts`, et sa JSDoc dit qu’elle ne décide que *quand* le travail tourne. Le limiteur se place
donc au-dessus des trois, dans `reducedBy`, et non à côté.

**Fin d’étape** : test à horloge injectée (jamais `Date.now()` réel dans un test) — 100 appels
passent, le 101ᵉ attend, la fenêtre glisse, un appel annulé libère sa place.

---

## Étape 3 — Un job survit à la fermeture de l’application

- [x] Livrée

> **L’étape la plus grosse des trois premières, et de loin** — le détail est au § 3.6 de
> `REPRISE.md`. Elle a touché huit fichiers hors du `JobManager` : le carnet de comptes (une
> identité de compte qui survit à un ré-ajout), le magasin de réglages, le collecteur d’assets,
> le provider de client, la racine de composition et la fermeture de l’application.
>
> **Les trois pièges annoncés par le plan étaient les bons**, mais deux réponses du plan étaient
> insuffisantes. « Garder l’identifiant du compte » : l’id local ne suffit pas, un retrait suivi
> d’un ré-ajout de la même clé le renouvelle et le job repris est perdu en silence — c’est une
> **empreinte de la clé** qu’il faut, la même notion que celle qui nomme les fenêtres du limiteur.
> Et « ne pas ressusciter un job annulé » est le petit frère d’une règle bien plus large que le
> plan ne voyait pas : **une note ne part que si l’API a conclu**. La première version oubliait le
> job sur tout statut terminal, si bien qu’une coupure réseau de quinze secondes effaçait la note
> d’une génération vivante et payée.
>
> **Un quatrième piège, absent du plan** : le collecteur frappait un id local neuf par sortie, donc
> une note survivant à un job déjà collecté réimportait tout et refacturait le transfert. Un
> `localIdOf` sur la sortie — la fonction était déjà là, employée pour le parent seulement.
>
> **Et une décision que le plan ne posait pas** : la reprise se fait à l’ouverture du projet, pas au
> démarrage, parce que le collecteur écrit dans le catalogue du projet ouvert. La note porte donc
> son projet, et un job qui aboutit alors qu’un autre projet est ouvert **ne collecte pas** : il
> s’efface de la session et attend le retour du sien.

Dette du § 3.6, et **prérequis dur** de tout job long. Aujourd’hui `createJobManager` tient tout
dans une `Map`, et rien n’appelle `jobs.list` au démarrage : une génération vidéo de dix minutes,
l’application fermée entre-temps, et le job aboutit chez Scenario sans que le studio le collecte
jamais dans le projet. C’est du travail payé et perdu.

**À faire.** Persister les entrées — `id` local, `jobId` distant, `modelId`, `label`, compte
d’origine, `createdAt` — puis au démarrage réhydrater la file, relancer le polling des jobs non
terminés, et **collecter les sorties de ceux qui ont abouti pendant l’absence**.

**Trois pièges à traiter, pas à découvrir.**

- **Le compte.** Une entrée reprise doit retrouver **son** compte : un `jobId` interrogé sous une
  autre clé répond 404, et aucun retry ne répare un 404. C’est déjà la raison pour laquelle
  `JobAccount` est capturé à la soumission ; la persistance doit garder l’identifiant du compte,
  pas l’objet.
- **Où écrire.** Le catalogue du projet est un SQLite qui tourne sur son propre `worker_threads` ;
  `better-sqlite3` est **synchrone** et une requête lourde dans le main gèle toutes les fenêtres
  (invariant 6). Un job n’appartient pas à un projet — il appartient au compte — donc écrire dans
  `app.getPath('userData')`, en JSON atomique, sur le modèle de `main/project/documents.ts`
  (fichier de transit puis `rename`).
- **Ne pas ressusciter un job annulé.** Une entrée `cancelled` persistée puis relue relancerait un
  polling sur un job mort.

**Fin d’étape** : un test qui écrit l’état, reconstruit un manager, et vérifie qu’un job `running`
reprend son polling, qu’un job abouti pendant l’absence est collecté, et qu’un job annulé ne
repart pas.

---

## Revue de cohérence de la branche — entre l’étape 3 et l’étape 4

Les trois étapes avaient chacune eu son `/simplify` et son `/code-review`. Cette passe-ci cherchait
**ce qu’une revue par étape ne peut pas voir** : ce qu’une étape casse dans une autre, deux notions
du même concept, un document qui contredit le code. Elle a rendu **dix défauts confirmés**, tous
corrigés avant la fusion. Elle valait son prix : quatre des dix étaient sévères, et aucun n’était
visible depuis l’étape qui l’avait introduit.

**Les quatre qui perdaient du travail ou de l’argent.**

1. **Annuler un job repris ne prévenait pas l’API.** L’étape 3 a donné un `remoteId` aux entrées
   encore en file ; la branche « déjà en file » de `cancel` datait d’avant et disait « il n’a jamais
   atteint l’API ». Elle sortait donc le job de la file, `settle` libérait son compte — et la
   génération continuait d’être facturée sans que rien dans le studio ne puisse plus l’arrêter.
   Pire : la note repartait sur disque, donc le job annulé **réapparaissait** à l’ouverture suivante.
2. **Un job repris était invisible.** `resume` l’annonçait par un événement de progression, mais la
   réplique du renderer ne sait que fusionner dans une ligne qu’elle a déjà : un identifiant inconnu
   est ignoré en silence. Le commentaire du code affirmait exactement le contraire de ce qui se
   passait.
3. **Un job dont le projet a changé disparaissait sans le dire.** La seule sortie qui ne passait pas
   par `settle`, donc le seul cas sans événement terminal : la ligne tournait pour le reste de la
   session, avec un bouton Annuler que le main n’avait plus d’entrée pour servir.
4. **`entry.done` n’était jamais posé dans le `catch` d'`execute`.** Un job dont l’API a perdu la
   trace (404) rejouait son échec **à chaque ouverture de projet pendant sept jours**.

Les deux premiers ont la même réponse : un canal `evt:jobs-changed` qui porte la liste entière
quand elle **gagne ou perd** une entrée — ce qu’un événement de progression, qui nomme un job par
son identifiant, ne peut pas exprimer par construction.

**Les deux qui demandaient un arbitrage, tranchés par l’utilisateur** (voir § 3.6 de `REPRISE.md`
pour le détail) : l’intervalle de poll est désormais **calculé** sur le nombre de jobs suivis, et
l’annulation passe devant tout le monde grâce à une **file à priorité** doublée de places
réservées. Les deux « dettes assumées » de l’étape 2 sont donc payées, pas reportées.

**Les quatre derniers** : la garde de re-collecte de l’étape 3 était aveugle à la provenance et
adoptait un asset venu de la bibliothèque du compte — elle est maintenant portée par le `jobId` ;
`persist` avalait toute erreur d’écriture sous un `.catch(() => {})` muet, alors que c’est
précisément la garantie que l’étape 3 existe pour tenir ; `windowNameOf` dupliquait
`accountFingerprint` au caractère près, alors que les deux documents affirmaient qu’il n’y avait
qu’une notion ; et `REPRISE.md` donnait pour livrée la formule de progression que `/code-review`
avait rejetée à l’étape 1.

**Trois candidats ont été réfutés** par la vérification, dont deux sur le même point : `accounts.of`
ne casse pas le cache `bound`, et le § 3.6 ne se contredit pas sur le débit.

**Ce que `pnpm validate` cachait.** Les 3931 tests passaient, mais trois budgets de couverture
étaient dépassés — le pipe `| tail` masquait le code de sortie, et la session précédente a cru la
branche verte. `develop` l’était, la branche non. Le code non couvert était exactement celui que la
revue a relevé : la garde d’idempotence du collecteur et le rattrapage d’écriture du `job-store`,
tous deux non testés. **Un budget de couverture qui déborde nomme souvent le défaut avant la revue.**

---

## Étape 4 — `dryRun` et le coût visible

- [x] Livrée

> **Livrée le 9 août 2026, fusionnée.** Les points 1 à 3 sont faits ; le point 4 l’était déjà
> par ailleurs (voir ci-dessous).
>
> **Ce que les deux passes ont rattrapé, et qui vaut pour les étapes suivantes.** Un débounce seul
> n’a pas de plafond de débit, seulement une falaise : tapé plus lentement que son délai, chaque
> frappe part en requête. Le remède est un **plancher** entre deux envois — et il doit dériver de
> `INTERACTIVE_REQUESTS_PER_MINUTE`, désormais dans `shared/domain/job.ts` parce que les deux
> processus s’en servent : le principal dimensionne son polling sur ce qu’il en reste, le renderer
> y cale ses estimations. La première version calait le plancher à 1,5 s quand la part n’autorise
> qu’une requête toutes les 4 s : **le `JobManager` comptait sur une réserve que le hook dépensait
> presque trois fois.**
>
> Trois autres défauts, tous trouvés en revue : un échec réseau figeait la déduplication et
> laissait ce formulaire exact sans prix pour toujours ; le prix d’un modèle restait sur le bouton
> d’un autre ; et l’espacement du badge, posé sur `BUTTON_BASE`, écartait les icônes de **toutes**
> les barres d’outils du studio — un ajout à une base partagée pour un besoin d’un seul appelant.
>
> **Le port est une fonction, pas un objet à méthode `runModel`.** Le dry run est documenté sur
> `workflows.run` autant que sur la génération : l’étape 5 s’y branche par
> `costEstimatorOf((id, body) => client.workflows.run(id, { body, dryRun: true }))`, sans rien
> défaire.
>
> **Affirmation vérifiée depuis, et elle était fausse deux fois.** Le code lisait
> `creativeUnitsCost` sur la réponse de soumission, et le dry run n’était lu que sur un 402 : il
> répond **200**, donc aucun prix ne s’affichait. Et `billing.cuCost`, que les typages déclarent
> sur un job **interrogé**, existe bel et bien — un job repris affiche désormais son coût, parce
> qu’un poll le lui apporte. Les deux corrections sont datées du 9 août 2026, § 4.5 de
> `REPRISE.md`.

> **Le point 4 est déjà livré, par quelqu’un d’autre.** `feat/usage-window` a été fusionnée dans
> `develop` le 8 août 2026 et donne à la consommation de chaque clé **sa propre fenêtre**
> (`renderer/src/usage/`, `main/scenario/usage.ts`, `usage-aggregate.ts`) : `usages.list`,
> `pricing.oscu.retrievePrices`, un journal paginé par compte, une période dans la barre de titre.
> **Ne pas refaire « `usages.list` dans Réglages > Compte »** — c’est fait, mieux et ailleurs. Le
> texte ci-dessous a été écrit avant.
>
> Restent les points 1 à 3, dont rien n’existe : `grep -rn dryRun src/` ne rend toujours rien. Le
> code de `cost.ts` et de ses cinq tests est écrit et conservé dans `REPRISE-workflows.md`, avec
> l’avertissement qu’il n’a pas été revérifié depuis que `develop` a pris trente commits.
>
> **Un piège pour le point 3 :** `usage-aggregate.ts` lit déjà `creativeUnitsCost`, mais sur les
> **événements de facturation**. Le coût d’un job se capte ailleurs et à un seul instant — sur la
> réponse de soumission, que `runnerOf` jette aujourd’hui en ne gardant que `.job`. Deux chemins
> vers la même grandeur : ne pas les confondre.

**Le meilleur rapport valeur/effort du plan, et un prérequis d’ergonomie du node editor** : un
graphe sans coût par node est un graphe qu’on n’ose pas lancer.

`dryRun` est documenté sur `generate.run_model` (`reference/generate.run_model.md:21`), sur
`workflows.run` et sur `models.train.trigger`. **Aucun job créé, aucun crédit débité.** La réponse
est un `402` porteur d’un `estimatedCost` — donc **un 402 n’est pas une erreur ici**, et
`failureOf` le classe aujourd’hui dans `unexpected` : c’est le premier point à traiter.

**À faire.**

1. Un canal `scenario:estimate-cost`, qui rend un coût ou l’absence de coût — jamais une erreur pour
   un 402.
2. Un badge sur le bouton Générer du `Generator`, réévalué quand le formulaire change. **Débouncé**,
   et **annulable** : un formulaire qu’on remplit ne doit pas lancer une estimation par frappe, et
   le limiteur de l’étape 2 est là pour rappeler que ces appels comptent.
3. Le coût réel, quand il revient : les réponses de job portent `creativeUnitsCost`. À poser sur
   l’entrée du `JobManager` et à afficher dans la barre de jobs, à côté de l’estimation.
4. La consommation : `usages.list` (unités consommées, par modèle, par période — 120 jours de
   fenêtre maximum) dans **Réglages > Compte**, à côté de l’état d’authentification.

**Fin d’étape** : un badge de coût sur les six espaces, un 402 qui ne s’affiche jamais comme un
échec, et la consommation du mois lisible dans les Réglages.

---

## Étape 5 — Exécuter les Apps de Scenario, sans éditeur

- [x] Livrée

> **Ce que le plan ne disait pas, et qu’il a fallu trancher : un job ne portait pas ce qu’il
> lance.** `Job.modelId` était lu par l’inspecteur pour offrir « Régénérer avec ces paramètres »,
> qui rouvre le générateur sur ce modèle. Un id de workflow y serait passé pour un id de modèle,
> et le panneau serait resté sur une erreur. `Job` porte donc `kind` (`model` | `workflow`) et
> `targetId` — les deux endpoints n’ont pas le même vocabulaire d’identifiant, et seul le premier
> veut dire quelque chose au générateur. `JobRunner.submit` prend la cible entière ; `follow`,
> `poll` et `cancel` ne changent pas, un job est suivi par l’API des jobs quel qu’il soit.
>
> **Les notes de jobs déjà sur disque nomment un `modelId`.** Une note qui ne parse pas est
> **jetée** (`storedJob` dans `validation.ts`), donc migrer le champ sans plus aurait abandonné,
> chez un utilisateur, une génération en cours et déjà payée. La lecture accepte les deux noms et
> retombe sur `kind: 'model'` ; un test le verrouille.
>
> **Les sorties d’un job de workflow ne sont pas là où le manager les cherchait**, comme annoncé —
> mais `metadata.assetIds` **existe aussi** sur un job de workflow, et la doc dit que seuls les
> derniers nœuds y contribuent. `remoteAssetIdsOf` lit donc `assetIds` **d’abord** et n’aplatit
> `flow[]` que s’il est vide : aplatir les deux importerait chaque image intermédiaire d’une
> chaîne comme si c’était un résultat. Dédupliqué, parce qu’un nœud de boucle se répète.
>
> **Pas de quatrième canal.** Le dry run est le même 402 sur l’autre endpoint, et `costEstimatorOf`
> prend une fonction : `scenario:estimate-cost` price désormais une **cible**, celle-là même qu’on
> soumet, et le renderer n’a plus à savoir quel endpoint tarife quoi. `useCostEstimate` prend le
> genre en premier argument, et **le plancher de débit est partagé par toutes les formes ouvertes**
> — le générateur et une App sont dans deux colonnes, donc tous deux à l’écran : un plancher par
> hook aurait laissé chacun dépenser la part interactive entière, et c’est la boucle de poll,
> dimensionnée une seule fois sur cette part, qui l’aurait payé.
>
> **Le champ `billing.cuCost` existe** : déclaré sur le job par `workflows.run` **et** par
> `jobs.retrieve` — le doute que le § 4.5 de `REPRISE.md` laissait ouvert. Lu après
> `creativeUnitsCost`, jamais devant. **Mais sur un job de workflow il vaut `0`**, et ce zéro-là
> n’est pas un prix : voir plus bas, l’observation du 9 août.
>
> **Le panneau est à DROITE**, en dernier de la moitié haute dans les six espaces. La colonne de
> gauche est réservée à `models` et `generator`, un test le verrouille dans les deux sens — et une
> App n’est pas un modèle que le générateur remplirait. Dernier de la liste pour ne rien déplacer :
> ce qu’un espace ouvre par défaut est ce qu’il déclare en premier.
>
> **Ce qui n’a PAS pu être observé depuis le MCP.** Le § 4.5 demandait de consigner ce
> qu’un vrai job de workflow répond. Impossible par le serveur MCP : il ne liste que les workflows
> **privés** du compte — `workflows_list` rend une liste vide — et n’expose aucun filtre
> `privacy: public`. Le studio, lui, demande bien `privacy: 'public'`.
>
> **Tranché le 9 août 2026, par un vrai lancement** (`wflow_coloring-page-maker`, deux nœuds,
> 12 CU) — le § 4.5 de `REPRISE.md` porte le relevé complet. Les trois inconnues, et deux
> défauts que l’observation seule pouvait trouver :
>
> - **les statuts sont ceux de la génération** : `queued` → `in-progress` → `success`. Le SDK
>   disait vrai, le guide en prose a tort. Les deux lignes de l’étape 1 restent inertes ;
> - **la progression est en 0–1**, et elle ne bouge pas : `0` du début à la fin, `1` à l’arrivée.
>   L’heuristique `p > 2 ? p / 100 : p` reste inerte elle aussi ;
> - **`metadata.assetIds` EST peuplé** sur un job de workflow, à côté de `flow[]` qui porte les
>   mêmes assets par nœud. `outputsOf` lit bien `assetIds` d’abord : aplatir les deux aurait
>   importé chaque image intermédiaire ;
> - **le dry run répond 200, pas 402** — sur les deux endpoints. `creativeUnitsCost` est dans le
>   corps, à côté d’un `job` vide. `cost.ts` ne lisait que le 402 documenté : **aucun badge de
>   prix n’a jamais rien affiché**, ni pour un modèle ni pour une App, depuis l’étape 4. Corrigé,
>   le 402 gardé en repli ;
> - **un job de workflow facture `cuCost: 0`** — la charge est sur ses sous-jobs, un par nœud
>   (le parent disait 0 là où le nœud qu’il a lancé disait 12). Afficher ce zéro aurait dit
>   « gratuit » d’une chaîne payée.
>
> **Deux faits de plus, pour l’étape 6 et pour l’export.** Une App publique porte
> `nodeGroups` dans son `editorInfo` — `{ [uuid]: { title, color } }`, et chaque nœud porte
> `data.group` : un **quatrième** champ, que ni le plan ni le § 4.4 ne nommaient. Et
> `wflow_H1bKz78jgpinWPKJfVCM5uAp` compte **62 nœuds** : le plafond de 50 n’est pas opposé aux
> workflows publiés, donc le refus d’export au-delà de 50 se vérifiera avant d’être écrit.

**Une étape qui vaut un produit à elle seule**, et qui vient avant le canvas : `workflows.list` en
`privacy: public` rend les **Apps** — des workflows publics, exécutables tels quels, filtrables par
tag. Ça met le « ready-made » de la webapp dans le studio sans écrire un seul graphe, et surtout ça
donne des **exemples réels d'`editorInfo`** pour vérifier le rendu du canvas de l’étape 6 contre des
données que Scenario a produites.

**À faire.**

- Le domaine dans `shared/domain/workflow.ts` : `WorkflowSummary`, `WorkflowStatus`,
  `WorkflowPrivacy`, et les trois plafonds (`MAX_WORKFLOW_NODES = 50`,
  `MAX_CONCURRENT_WORKFLOW_JOBS = 10`). **Aucune dépendance runtime dans `shared/`** — types et
  constantes seulement.
- `main/scenario/workflow-catalog.ts`, sur le modèle exact de `model-catalog.ts` : auto-pagination
  par curseur, filtres `privacy` / `status` / `tags`, cache.
- Les canaux : `workflows:search`, `workflows:describe`, `workflows:run`. Typés dans `shared/ipc.ts`,
  validés par `zod` côté main comme le fait déjà `main/assets/validation.ts`.
- Le formulaire : les `inputs` d’un workflow ont **la même forme que les inputs d’un modèle**
  (`name`, `type`, `kind`, `required: { always }`). Donc `translateSchema` s’applique tel quel et
  `DynamicForm` les rend. **Ne pas écrire un second traducteur** — si un champ résiste, c’est
  `translateSchema` qui s’étend, avec son test.
- Le suivi : `RemoteJob` gagne une variante `metadata.flow[]`, aplatie vers la liste d’ids d’assets
  distants. **`collector.ts` ne change pas** — il prend déjà une liste d’ids.

**Fin d’étape** : un panneau qui liste les Apps, en ouvre une, remplit son formulaire, la lance, et
voit son job aboutir dans la barre de jobs avec ses assets posés dans le projet.

---

## Étape 6 — Le canvas, et la convention d’arête

- [x] Livrée

> **Le format est dans `shared/domain/graph.ts`, pas dans `engines/`.** Le plan disait « le format
> natif est `editorInfo` », et c’est fait — mais **écrit à la main plutôt qu’importé du SDK** : un
> graphe est un document qui traverse l’IPC, donc son type appartient à `shared/`, et `shared/`
> ne porte aucune dépendance runtime (invariant 2). Le renderer n’importe pas le SDK, et c’est
> le principal qui l’adaptera au convertisseur à l’étape 7 — une divergence de forme échouera
> alors au typecheck, pas à l’exécution.
>
> **`editorInfo` a un QUATRIÈME champ** : `nodeGroups`, `{ [uuid]: { title, color } }`, avec un
> `data.group` sur chaque nœud. Lu sur une App publiée ; ni le plan ni le § 4.4 ne le nommaient.
>
> **La convention d’arête est vérifiée sur données réelles**, et elle décide de quel côté va
> chaque `<Handle>` : une ENTRÉE est un handle React Flow de type `source` posé à GAUCHE, une
> SORTIE un handle de type `target` posé à DROITE. C’est écrit dans `NodePorts.tsx`, parce que
> c’est là que l’inversion se paierait.
>
> **Deux défauts trouvés en revue, et invisibles autrement :**
>
> - **la sélection ne remontait jamais.** Un canvas entièrement contrôlé ne garde aucune
>   sélection : ce qui ne lui est pas rendu n’est pas sélectionné, et la touche Suppr — qui agit
>   sur la sélection — ne trouvait donc jamais rien à supprimer. La sélection vit dans le canvas
>   (état de session, jamais sauvée) et redescend dans les nœuds **et dans les arêtes** — sans
>   quoi une arête ne se supprimerait pas non plus, ce que la revue n’avait vu que côté nœuds ;
> - **chaque rendu recréait tous les nœuds.** React Flow compare les nœuds par IDENTITÉ : un
>   objet neuf lui fait jeter la mesure du nœud et réabonner son `ResizeObserver`. Refaire la
>   liste entière faisait cela à **tous** les nœuds à **chaque frame** d’un déplacement, pour le
>   seul qui bougeait. Un cache par nœud (`WeakMap`, clé = le nœud immuable) rend les autres tels
>   quels.
>
> **Ce que l’étape 6 ne fait pas** : le canvas n’est monté nulle part. Le point de montage est la
> décision de l’étape 10, tranchée depuis — **le graphe est un septième espace** — et c’est le
> travail suivant. « Se sauve, se relit à l’identique » attend donc le `DocumentIo` de l’étape 10 ;
> la relecture, elle, est écrite et testée (`parseGraph`, sur un `editorInfo` réel).

**Lire le § 4.4 de `REPRISE.md` avant la première arête.** Le SDK porte la règle en commentaire
(`lib/workflow_converter.js:588`) : `{ source: consumer, target: provider }`. **`source` est
l’ENTRÉE (à gauche), `target` est la SORTIE (à droite).** La donnée va de gauche à droite à l’écran,
l’objet arête pointe de droite à gauche. Câbler dans le sens intuitif produit un flow retourné à
l’export, **sans erreur et sans avertissement**.

Nommage, que le convertisseur lit : handle `` `${nodeId}-${'source'|'target'}-${fieldName}` ``,
sorties de boucle `` `${nodeId}-output-${n}` ``, nom de sortie par défaut `output`.

**À faire.**

- `@xyflow/react` installé, CSS importé, `engines/graph/` créé — **aucun import React dedans**.
- Le format natif du node editor est **`editorInfo` de Scenario**, pas un format maison :
  `{ nodes, edges, inputKeys }`. C’est ce qui rend gratuits la compilation, la validation et
  l’aller-retour avec la webapp.
- Les **15** types de nodes d’éditeur (`VALID_EDITOR_NODE_TYPES`, `modelInput` compris — un rapport
  tiers qui en annonce 14 a été écrit avant). Commencer par quatre : `text`, `asset`, `model`,
  `stickyNote`. Les onze autres suivent à l’étape 8.
- Ports typés : `WorkflowEditorHandleInput.type` peut être un `string[]` — un port **polymorphe**.
  C’est la matière de `isValidConnection` et du code couleur. `subHandles` pour les sous-ports.
- Le chrome : **maison**, `design/` (le canvas vit dans un dock, donc rien de DaisyUI). Ni
  `<Controls>` ni `<MiniMap>` de React Flow — le studio a `design/Toolbar.tsx`. `<Background>` en
  points, `gap 20`, `size 0.5`, comme la webapp.
- Les jetons : **aucune valeur hexadécimale dans un composant**, aucun pixel là où une gauge `--sc-*`
  existe. React Flow se style par CSS custom properties : les surcharger depuis `index.css`.

**Trois pièges de la v12** : `node.measured.width/height` (plus `node.width`),
`screenToFlowPosition`, `nodeLookup` (plus `nodeInternals`). **Vérifier sur Context7**, pas de
mémoire.

**Fin d’étape** : un graphe de trois nodes se construit à la souris, se sauve, se relit à
l’identique, et les ports refusent une connexion de type incompatible.

---

## Étape 7 — Compiler, valider, exécuter en local

- [ ] Livrée

**Ne pas écrire de compilateur.** `convertWorkflowEditorToFlow({ nodes, edges, inputKeys, getModel })`
le fait ; `getModel` résout les presets de ratio et les indices de type depuis le `ModelRegistry`
déjà écrit, et rend `'unknown'` pour un modèle dont la définition manque. Le convertisseur rend
`type: string` là où l’API veut une union littérale : c’est **l’un des rares `as` justifiés du
dépôt**, avec son commentaire d’une ligne.

`validateWorkflowFlow(flow)` jette à la **première** violation, avec un message lisible. Il vérifie
les ids non vides et uniques, l’appartenance aux **10** types d’exécution, les champs requis par
type (`custom-model` → `modelId`, `workflow` → `workflowId`, `logic` → `logicType`, `for-each` →
`loopBodyNodeIds` non vide **ou** `count > 0`), et toutes les références croisées. **Le brancher en
direct dans l’éditeur** : un surlignage d’erreur pendant la frappe, pas un 400 à l’envoi.

**`"workflow"` est réservé dans `ref.node`** — il désigne les inputs du workflow parent, et n’est pas
vérifié contre les ids de nodes. **Ne jamais nommer un node `workflow`.**

**L’exécuteur local**, `engines/graph/executor.ts`, calcul pur et testable sans réseau :

1. tri topologique (Kahn) et **détection de cycle** — un cycle se dit, il ne boucle pas ;
2. `hash(nodeId + type + params résolus + hashes des parents)` → clé de cache ;
3. cache touché → l'`assetId` est réutilisé, le node est marqué `cached` ;
4. sinon `dryRun` pour le coût, puis `runModel` **via le `JobManager`** — jamais un appel direct au
   SDK, c’est un bug (`CLAUDE.md`) ;
5. un node abouti résout les références de ses enfants et les débloque ;
6. exécution par vagues, sous le sémaphore du `JobManager` et le limiteur de l’étape 2.

**Le cache est le point du plan à ne pas rater** : c’est lui qui rend l’outil agréable. Il vit à
côté du document, il est immuable, et il se purge à la main.

**Fin d’étape** : un graphe de cinq nodes s’exécute, le prompt du dernier change, **seul le dernier
se relance**, et un cycle est refusé avec un message qui nomme les nodes en cause.

### Le lot C1 — le plan d’exécution, pur et sans réseau

Livré le 10 août 2026. `engines/graph/plan.ts` : tri topologique de Kahn, nœuds du cycle nommés,
entrées résolues depuis les arêtes, et la clé de cache de chaque nœud. **Aucun appelant encore** —
c’est le lot C2 qui le branche, et le dire vaut mieux que de le laisser découvrir.

- **Kahn se lit sur la convention inversée** : ce qui alimente un nœud est `edges.filter(e =>
  e.source === id)`. Câblé dans le sens intuitif, le tri **termine quand même** et l’ordre a l’air
  juste — il exécute simplement le graphe à l’envers. Le test qui mord là-dessus est celui qui pose
  le générateur AVANT le nœud texte dans la liste des nœuds.
- **Une arête dont un bout manque n’est pas une dépendance.** Comptée, le degré entrant de son
  consommateur ne retombe jamais à zéro et un graphe parfaitement acyclique **se déclare en
  cycle**. `removeNode` les nettoie, un fichier relu ne le fait pas.
- **Kahn ne laisse pas le cycle : il laisse tout ce que le cycle BLOQUE.** Nommer un nœud en aval
  enverrait l’utilisateur sur un nœud qui n’a rien. D’où un second pelage, par l’aval, qui finit
  sur les boucles elles-mêmes.
- **Le `nodeId` est dans le hash, délibérément** : la génération est stochastique, donc deux nœuds
  « même modèle, même prompt » demandent deux images. Ce qui n’y entre pas, ce sont **exactement
  les champs de `GraphNodeData`** — `Record<keyof GraphNodeData, true>`, donc complet par
  construction : un champ ajouté au socle ne compile plus tant qu’il n’est pas rangé d’un côté ou
  de l’autre, et tout ce qu’un type de nœud ajoute de son cru est haché sans avoir à être listé.
  C’est le défaut sûr — un paramètre neuf compte tant que personne n’a dit le contraire.
- **`Object.hasOwn`, pas `in`** : `parseGraph` ne valide pas `data`, donc un fichier peut y écrire
  une clé nommée comme un membre de `Object.prototype`. Lue avec `in`, elle passait pour exclue et
  sortait de la clé de cache sans un mot. Même piège qu’à l’étape 1 sur `jobStatusOf`.
- **`stableKey` avant `digest`** : `JSON.stringify` écrit les clés dans l’ordre d’insertion, donc
  un formulaire rempli dans un autre ordre se lisait comme un autre formulaire et relançait un
  nœud pour rien.

**Ce que les revues ont changé, et qui ne se voyait pas autrement :**

1. **`waitingOn` était un compteur tenu à la main à côté d’`incoming`**, dont il recopiait
   exactement la longueur. Deux vérités pour une grandeur.
2. **`inputHandleOf` était appelé PAR ARÊTE**, et il ré-aplatit tout l’arbre des sous-ports à
   chaque appel : un nœud à dix fils sur trente ports le payait dix fois. Aplati une seule fois.
3. **`hash.ts` est parti dans `src/shared/`.** Rien dedans ne sait ce qu’il hache, et c’est le seul
   terrain commun aux deux processus — `src/shared/{numeric,text,guards}.ts` sont le gabarit exact.
   Vérifié que le budget serré de `src/shared/**` (−6 / −20) **n’est pas entamé** : le fichier est
   couvert à 100 %, mesuré avant et après.
4. **Un commentaire citait une mesure que personne ne pouvait rejouer** — le défaut exact que le
   dépôt a déjà payé. Il est devenu `engines/graph/plan.bench.ts` : 62 nœuds, deux poids de
   formulaire, plus le cas où tout est pris dans une boucle. **1,4 ms** en formulaires réalistes,
   **3,2 ms** en lourds, **0,02 ms** pour le cycle. La JSDoc renvoie au banc au lieu d’annoncer un
   chiffre.

**Ce que la revue d’efficacité annonçait et que la mesure a démenti** : elle donnait 3 à 12 ms au
seul `digest` en BigInt, et recommandait de le remplacer par deux lanes 32 bits. Ses clés d’essai
incluaient les **ports**, que `paramsOf` exclut précisément. Mesuré de bout en bout, un `planGraph`
entier coûte 1,4 ms. **BigInt reste**, et la piste des deux lanes est écrite dans la JSDoc pour le
jour où le banc dira le contraire.

**Le budget de couverture est posé** : `'src/renderer/src/engines/graph/**': { statements: -18,
branches: -24 }`, calé sur la mesure de la suite **complète** — une mesure sur le seul dossier
ment, `commands.ts` étant couvert depuis `GraphDocument.test.tsx`. Presque tout ce qui reste est
le bras de repli d’un `Map.get` qu’un ordre topologique rend inatteignable et que
`noUncheckedIndexedAccess` impose d’écrire.

**Seize mutations sur seize mordent** — et le harnais a menti une troisième fois, d’une façon
neuve : `git checkout --` **ne restaure pas un fichier non suivi**, et les seize mutations se sont
empilées les unes sur les autres pendant que git répondait « pathspec did not match ». Les gardes
existantes ont refusé les verdicts, mais la restauration passe désormais par une **copie de
référence**, et la vérification d’application par `cmp` plutôt que par `git diff`. À retenir pour
tout lot dont les fichiers sont neufs.

**Deux constats laissés ouverts, écrits pour ne pas être redécouverts :**

1. **`inputs` est indexé par nom de port, donc deux arêtes sur un même nom s’écrasent** — le
   dernier gagne. Le hash, lui, est bâti sur les **arêtes**, donc rien ne lui échappe. Si un jour
   il faut le dire à l’utilisateur plutôt que de le réduire en silence, c’est `inputs` qui doit
   changer de forme, pas le hash.
2. **`isRecord` accepte un tableau** (`src/shared/guards.ts`), donc `parseGraph` laisse passer
   `data: ["a", "b"]` comme `GraphNodeData`. Le plan ne s’en trouve pas faussé — `paramsOf` hache
   les indices, `inputHandlesOf` retombe sur `[]` — mais c’est un trou de contrat de `serialize.ts`,
   pas du plan.

---

## Étape 8 — Logique, boucles, transforms, approbation

- [ ] Livrée

Les onze types de nodes restants, et les trois mécanismes qui les portent.

- **`ifElse`** — le format existe : `WorkflowEditorConditionBlock` est
  `{ conditions: { field?, operator, value? }[], logic: 'and' | 'or' }`. L’UI est un **query
  builder** de groupes ET/OU. **Ne pas l’inventer.** Le merge après branchement se fait par
  `ref.conditional` : « le premier de ces nodes dont le statut vaut `success` ».
- **`transform`** — expressions **CEL**. `@scenario-labs/sdk/tools/cel` (`createCelEnvironment`,
  `evaluateCel`) est **déjà installé**, via les dépendances du SDK. Donc **l’aperçu du résultat
  pendant la frappe, en local, sans un appel réseau** : c’est le gain d’ergonomie le moins cher de
  tout le chantier.
- **`forEach` / `forEachEnd`** — une **paire visuelle** côté éditeur, qui se compile en **un seul**
  node `for-each` portant `loopBodyNodeIds`. Ne pas chercher un mapping 1:1 entre les deux
  vocabulaires : il n’existe pas. `sliceAssets` (`from`, `count`) et `groupItems` complètent.
- **`approval` / `user-approval`** — un job de workflow peut **se suspendre**. `JobStatus` n’a rien
  entre `running` et fini : ajouter `awaiting-approval`, et se rappeler que **cela change
  `isFinished`** — donc c’est solidaire de l’étape 1. `workflows.userApproval(id, { nodeId, status })`
  débloque, et la barre de jobs porte les deux boutons.
- **`llm`, `transformText`, `splitText`, `aspectRatio`, `modelInput`** — le reste de la liste.
  `aspectRatio` est le bon moment pour brancher les helpers du SDK :
  `ASPECT_RATIO_PRESETS`, `normalizeAspectRatio`, `getAspectRatioBounds`,
  `getDimensionsFromAspectRatio`, plus `uiConfig.resolutionComponent` du modèle. **Scenario a publié
  les primitives de son propre composant de résolution : les réutiliser, pas les réécrire.**

**Fin d’étape** : un graphe qui branche, boucle, transforme et attend une approbation s’exécute de
bout en bout.

---

## Étape 9 — Import, export, publication

- [ ] Livrée

- **Fichier** : `validateEditorInfo(raw)` accepte la **version `'1.0'`** et jette un
  `WorkflowImportError` (`err.name === 'WorkflowImportError'`). Payload :
  `{ version, name, description, editorInfo{nodes,edges,inputKeys}, inputs, tagSet, uiConfig?,
  exportedAt, exportedBy }`. **Adopter ce format pour les `.workflow.json` du studio** :
  l’interopérabilité avec la webapp est gratuite. Un fichier sur disque est une **entrée non
  fiable** — la validation à la relecture n’est pas facultative.
- **Vers Scenario** : `create` puis `update({ flow, status: 'ready' })`. `create`/`update` laissent
  le workflow en **`draft`, non exécutable**. Un endpoint de publication côté serveur existe en MCP
  (`workflow_publish`) mais **dans aucune des 209 pages REST locales** : la compilation locale est
  donc le seul chemin documenté, et c’est aussi le meilleur — la validation devient un retour
  instantané au lieu d’un 400.
- **Les deux refus qui doivent parler** : au-delà de **50 nodes**, et dès qu’un node local
  (`localFile`, `ffmpeg`, `pbrPreview`) est dans le graphe. Un export qui échoue le **dit** — le
  § 3.3 de `REPRISE.md` porte déjà ce défaut corrigé sur l’export 3D, ne pas le refaire.
- **`isLocked`** : un workflow verrouillé ne se modifie ni ne se supprime, sauf par son auteur.
  À respecter dans l’UI plutôt qu’à découvrir par un 403.

**Fin d’étape** : un graphe fait dans le studio s’ouvre dans la webapp, un graphe de la webapp
s’ouvre dans le studio, et un graphe non exportable dit pourquoi.

---

## Étape 10 — L’espace, le document, la place dans le shell

- [x] Livrée — **prise AVANT les étapes 7 à 9**, et c’était le bon ordre

> **Faite en premier, contre le plan.** Le plan la mettait en dernier ; l’étape 6 a livré un
> canvas que rien ne montait, donc rien de ce qui a suivi n’aurait été regardable. Monter
> d’abord a rendu visibles **cinq défauts qu’aucun test unitaire ne pouvait voir**, dont trois
> venus de l’étape 6.
>
> **Un espace peut n’appartenir à aucune famille de modèles.** `Workspace.family` est
> `ModelFamily | null`, et un catalogue sans famille montre tout — `ModelQuery.family` était
> déjà optionnel, et `model-registry.ts` ne narrowait déjà que si la clé est là. Le champ
> `scope` (`ModelScope = ModelFamily | 'all'`) est **dérivé sur le record**, pas recomposé chez
> les lecteurs : il l’était à quatre endroits, et le cinquième a été oublié — ce qui a coûté au
> graphe son générateur, voir plus bas.
>
> **Ce que l’écran a rendu, et que rien d’autre n’aurait rendu :**
>
> - **le fond à points était invisible.** `size={0.5}` est un rayon d’un quart de pixel : lisible
>   sur le canvas clair de la webapp, deux gris l’un sur l’autre sur notre `panel`. Le centre
>   était simplement noir ;
> - **`fitView` sautait à 200 %** au premier nœud posé — il se rejoue quand les nœuds arrivent,
>   pas seulement au montage. Le nœud suivant atterrissait dans un repère que la main n’avait pas
>   choisi. `fitViewOptions={{ maxZoom: 1 }}` ;
> - **on ne pouvait créer aucun nœud.** Le canvas de l’étape 6 n’avait ni palette ni menu :
>   l’espace s’ouvrait sur un vide sans issue.
>
> **`SCOPE_BY_WORKSPACE` est un `Partial`, donc le compilateur n’a rien demandé — et `⌘Z` ne
> faisait rien.** Un espace absent de cette table garde l’undo **natif**, qui enregistre
> l’accélérateur auprès de l’OS et l’avale avant la fenêtre. L’historique du graphe existait,
> était testé, et aucun geste ne l’atteignait. **Skyboxes avait déjà payé exactement ça**, son
> commentaire le dit. `CommandScope` gagne `'graph'`.
>
> **Quatre erreurs corrigées par un APPEL, pas par la doc** (`workflow_get` sur
> `wflow_coloring-page-maker`, 9 août) :
>
> | Ce qui était écrit | Ce que l’API répond |
> |---|---|
> | port texte `-target-text` | `-target-prompt`, de type `text` — le champ n’est pas le type |
> | une note porte `value` | elle porte **`content`** : toute note importée s’affichait **vide** |
> | pas de port conditionnel | **tout** nœud en porte un, la note comprise |
> | aucun endpoint de publication | **`workflow_publish` existe** en MCP et compile `editor_info` **côté serveur** — une seconde voie pour l’étape 9 |
>
> **Il n’y a AUCUNE API de palette.** Les 10 outils `workflows.*` ne listent aucun type de nœud,
> et le SDK ne publie que les 15 types techniques. La palette de la webapp — Input / Generators /
> Composers / Utilities — est une couche produit : **un « Image Generator » est un nœud `model`
> narrowé à une famille**, et les cinq entrées « Input » sont des `text`/`asset` qui ne diffèrent
> que par `data.type`. Elle est donc écrite chez nous (`spaces/graph/palette.ts`), branchée sur
> les familles que le studio connaît déjà.
>
> **Ce qui n’est PAS fait, et qui appartenait à cette étape :** l’inspecteur d’un nœud. Un nœud
> se pose, se déplace, se relie, se supprime — mais **rien ne permet d’éditer ce qu’il contient**
> (le texte d’un nœud texte, le modèle d’un générateur). C’est une face de plus dans
> `panels/inspector/`, et c’est le premier geste à écrire après.
>
> **Livré à moitié par le lot B1** (9 août, section plus bas) : le texte, la note, le titre et la
> source d’un asset s’éditent ; le **modèle d’un générateur est affiché, pas encore choisi**, et
> son formulaire non plus — c’est le lot B2.

### Le correctif du 9 août — trois des quatre générateurs de la palette étaient inertes

Vu à l’écran, et le journal le disait en clair : « Un nœud n’a pas pu être créé — video / 3d /
audio : no model chosen ». Le défaut n’était pas dans le graphe, il était dans **la chaîne du
choix de modèle, écrite trois fois et une fois de travers**.

- **Le graphe classe son choix sous `'all'`**, puisqu’il n’appartient à aucune famille — et un
  nœud générateur demande le modèle d’**une** famille. `GraphDocument` lisait `selected[family]`
  seul : toute famille jamais visitée ailleurs répondait « rien », et le studio empilait un
  `reportFailure` au lieu d’indiquer quoi faire.
- **`chosenModelOf(scope)`** (`helpers/chosen-model.ts`) réunit « choix de session, puis
  préférence ». Elle vivait en trois exemplaires — le rail (`hasModelFor`), les édits d’image
  (`prepareEdit`), et le graphe qui n’en gardait que la première moitié. C’est exactement la
  forme du défaut : trois copies, l’une d’elles incomplète.
- **Quand il n’y a toujours rien, le panneau Modèles s’ouvre narrowé sur la famille**
  (`revealModelsOfFamily`), sur le modèle de `revealAssetsOfKind`. **Arbitré avec l’utilisateur** :
  un message d’échec dit ce qui ne va pas, jamais quoi faire.
- **Deux ajouts sans lesquels cette ouverture ne débloquerait rien**, et c’est le point à ne pas
  redécouvrir : une **facette famille** dans le panneau Modèles, offerte *uniquement* là où la
  surface n’a pas de famille propre (ailleurs la barre de titre la nomme déjà) ; et
  `select()` qui **classe le modèle sous SA famille en plus du scope parcouru** — sans quoi
  choisir un modèle vidéo depuis le graphe l’écrivait sous `'all'`, invisible au nœud même qui
  avait envoyé l’utilisateur le choisir.
- **Le garde du chunk de démarrage a mordu**, et il avait raison : `reveal-panel.ts` est atteint
  au démarrage, donc importer `model-filters.ts` pour une seule constante y tirait tout le
  vocabulaire des modèles. D’où `panels/models/family-facet.ts`, une constante seule dans son
  fichier — **exactement ce que `panels/assets/type-facet.ts` est déjà**, et pour la même raison.
- **Un défaut du harnais de test, payé ici** : React Flow relit le zoom du viewport dans un
  `DOMMatrixReadOnly` que jsdom n’a pas. Un nœud posé **au montage** ne le déclenchait pas ; un
  nœud qui arrive **après** — ce que fait un générateur, dont le schéma est asynchrone — levait
  une exception non rattrapée. Polyfill identité dans `test-setup.ts`.

#### Ce que la revue a rendu, et qui vaut au-delà de ce correctif

Six agents, deux revues adverses et les quatre passes de `/simplify`. Ils ont convergé — trois
d’entre eux sur les mêmes points.

- **La chaîne vivait en SIX exemplaires, pas trois.** Les trois autres étaient des versions
  *abonnées* : `useHasModel`, `Generator.tsx`, et `Models.tsx` — ce dernier **divergent**, lisant
  le choix de session **sans** la préférence. Défaut visible à l’écran, indépendant du graphe :
  avec un modèle par défaut réglé et aucun choix à la main, le rail dessine le générateur, le
  générateur rend le bon formulaire, et **le panneau Modèles affiche « Aucun modèle choisi »**
  sans surligner de ligne. Le panneau qui sert à choisir était le seul à prétendre qu’il n’y a
  rien. `modelForScope` / `useModelForScope` réunit les six.
- **Deux réponses concurrentes à « où choisit-on un modèle de cette famille ? »** —
  `offerToChooseOne` (vers les préférences) et le nouveau helper (vers le panneau). Fusionnées en
  une seule, `offerModelsOfFamily`. **Et le garde du chunk a mordu une seconde fois** : la
  fonction fusionnée atteint `settings-registry`, que le démarrage ne doit pas voir. D’où
  `helpers/offer-model.ts`, à part de `reveal-panel.ts` — ses deux appelants sont des espaces,
  chargés à la demande. La règle générale : **une fonction qui peut mener aux préférences ne peut
  pas vivre dans un module que le démarrage atteint.**
- **La facette famille était persistée.** Un nœud posé sans modèle l’écrivait, et le
  redémarrage rouvrait le catalogue rétréci sur une famille que personne n’avait tapée —
  exactement ce que le commentaire de `partialize` refuse pour le texte de recherche. Exclue de
  la persistance, avec son test sur ce qui atterrit vraiment dans `localStorage`.
- **`isFiltered` accusait un filtre invisible.** Une facette qu’une surface n’offre pas ne peut
  pas être relâchée : le panneau vide disait « aucun résultat pour ce filtre » là où il fallait
  dire « aucun modèle dans cet espace ». `isFiltered` prend désormais les facettes offertes.
- **`facetsFor` n’était pas mémoïsé** — mesuré à **+125 à +285 µs par rendu** sur la seule surface
  graphe, le panneau se rendant à chaque frappe dans sa recherche. Le commentaire « No memo »
  d’à côté visait `queryFrom`, gratuit, et se lisait comme s’il couvrait les deux.
- **La ligne charnière n’était couverte par rien.** Remplacer `model.family` par le littéral
  `'image'` dans `Models.tsx` laissait **toute la suite verte** et ramenait le bug d’origine. Un
  test rend maintenant le panneau dans l’espace Graphe — le seul où `scope !== family`.
- **Dix mutations, dix tests qui rougissent**, vérifiées une par une.

#### Ce qui reste ouvert, et qui est le jumeau exact de ce correctif

**`prepare()` n’a pas appris la famille, `select()` si.** Dans le graphe, « Régénérer avec ces
paramètres » (inspecteur) et les recettes de l’accueil passent par `openGeneratorOn(scope, …)`
avec le scope de l’espace, donc `'all'` : le générateur s’arme sur un modèle vidéo, et poser un
nœud « Vidéo » ne le trouve pas — le panneau Modèles s’ouvre par-dessus le générateur qui
l’affichait.

Non corrigé **délibérément** : deux des trois appelants n’ont qu’un `modelId` et pas la famille,
donc le correctif demande une décision (aller la chercher, ou classer autrement), pas un patch.
À trancher avec l’utilisateur — et l’inspecteur d’un nœud, le lot suivant, passe par ce chemin.

### Le lot B1 — la sélection remonte, et l’inspecteur édite un nœud

La face existe : `panels/inspector/GraphNodeInspector.tsx`, branchée par un `case ‘node’` du
`switch` de `Inspector.tsx`. Ce qu’il faut en retenir.

- **La sélection d’un nœud vit dans `GraphDocument`, pas dans le store global — et pas dans le
  canvas non plus.** Les trois emplacements ont été essayés dans cet ordre, et les deux premiers
  sont faux : dans le canvas, elle ne survit pas à un démontage du panneau ; dans
  `stores/selection.ts`, elle est **écrasée par le panneau voisin**, parce que `Selection` ne
  porte **qu’un seul genre à la fois** — et l’étagère d’assets partage l’écran du graphe. Cliquer
  une vignette désélectionnait le nœud, donc **`Suppr` ne trouvait plus rien à supprimer**,
  exactement le piège que `adapter.ts` documente. Le store reçoit une **publication**, jamais la
  vérité. Le jour où une arête gagne une face d’inspecteur, c’est `Selection` qui doit apprendre
  à porter plusieurs genres, pas `GraphCanvas` qui doit changer.
- **Un id de nœud disparu empoisonnait la sélection pour la session entière.** React Flow ne
  rapporte la désélection que d’un nœud qu’il a **monté** : un nœud sorti du graphe pendant que le
  panneau était démonté — un ajout annulé, un onglet rouvert — n’est plus jamais nommé, et son id
  restait dans l’ensemble. Chaque clic suivant se lisait alors comme **deux** nœuds, et la garde
  « un seul à la fois » rendait l’inspecteur vide définitivement. `GraphDocument` filtre donc la
  sélection sur les nœuds que le graphe tient encore.
- **`parseGraph` ne valide pas `data`** — il valide le nœud. La face est le premier code à
  déréférencer ces champs, et deux valeurs qu’un fichier peut porter la faisaient tomber dans son
  `ErrorBoundary` : `"value": null` rendait `typeof … === ‘object’` vrai puis `.length` levait, et
  un objet sous `type` partait à React comme enfant. `Array.isArray` et un test de chaîne, avec
  leurs tests.
- **La relation « type de nœud → clé i18n » vivait en trois exemplaires** — la palette la
  composait, le canvas écrivait quatre littéraux, l’inspecteur les réécrivait — et **aucune
  garde ne couvrait ces quatre clés**. `spaces/graph/node-labels.ts` les réunit en un `Record`
  **complet** sur les quinze types (un seizième est une erreur de compilation, comme pour
  `GRAPH_NODE_TYPES`), et `dynamic-keys.i18n.test.ts` les vérifie désormais dans les deux langues.
- **`Face` ne s’abonne pas au graphe.** Le faire re-rendait **toutes** les faces à chaque frame
  d’un déplacement de nœud — y compris l’inspecteur 3D d’un onglet qui n’est pas au premier plan,
  puisque `activeIdOfKind` retombe sur n’importe quel document du genre. Le fichier portait déjà
  la règle en commentaire, écrite pour le catalogue d’assets ; `NodeSelection` la suit.
- **Vérifié à l’écran** : le nœud se sélectionne, l’inspecteur l’édite, le canvas suit la frappe,
  et `⌘Z` défait la frappe sans défaire le nœud.
- **Douze mutations sur treize rougissent.** La treizième visait une garde que jsdom ne peut pas
  atteindre — React Flow n’émet **aucun** changement quand un clic ne modifie rien — et le test
  qui prétendait la couvrir a été **retiré** plutôt que gardé.

**Ce que B1 ne faisait pas, et que le lot B2 a livré** : voir la section suivante.

### Le lot B2 — le modèle d’un nœud se choisit, et son formulaire se remplit

**Tranché avec l’utilisateur : un menu déroulant dans l’inspecteur**, pas un bouton vers le
panneau Modèles ni un glisser-déposer. `panels/inspector/ModelNodeFields.tsx`.

- **Changer de modèle est UNE commande.** Les ports d’un générateur viennent du schéma du modèle
  (invariant 5) : changer le modèle change les ports, et une arête visant un port disparu nomme un
  handle qu’aucun nœud ne porte — ce que `validateWorkflowFlow` rejette **à l’export**, loin du
  geste. `replaceNodePorts` (`engines/graph/mutations.ts`) échange les deux et coupe ces arêtes,
  comme `removeNode` le fait déjà pour un nœud. Un seul `⌘Z` rend le modèle, les ports et l’arête.
- **`modelDataOf` est écrit une fois pour deux gestes** — poser le nœud, et changer son modèle.
  Bâti deux fois, le second aurait dérivé du premier et les ports d’un nœud auraient dépendu de la
  façon dont il a été fait.
- **Ce qui est tapé survit au changement de modèle**, sous chaque clé que le nouveau modèle
  déclare encore : `defaultValues` prend un preset exactement pour ça. Sans lui, essayer un autre
  modèle coûtait quarante mots de prompt sans avertissement.

**Cinq défauts que les deux revues adverses ont rendus, et qu’aucun test ne voyait :**

1. **Chaque frappe du formulaire était une entrée d’undo.** `DynamicForm` rapporte par frappe et
   n’a ni focus ni blur où accrocher un geste, contrairement aux `TextField` du même panneau.
   Mesuré : `hello` → 5 entrées. `HISTORY_LIMIT` vaut 100, donc **un prompt de 120 caractères
   évinçait les nœuds et les fils qu’il décrit**. Un geste ouvert à la première écriture, fermé au
   démontage du formulaire.
2. **L’inspecteur embarquait `zod` et `react-hook-form` en statique** — 220 kB, et l’inspecteur est
   placé dans **tous** les espaces (`TOOL_PLACEMENTS`), donc une session 3D payait un formulaire
   qu’elle ne rendra jamais. `lazy()` + `Suspense`, comme le générateur et le panneau Apps.
3. **Le catalogue partait avant le schéma**, donc offrait **toutes** les familles pendant le
   chargement — et un modèle d’une autre famille choisi là renomme le port de sortie, ce qui coupe
   en silence chaque arête lisant ce nœud. La requête attend que le schéma ait nommé la famille.
4. **Un nœud sans `modelId` nommait un modèle qu’il ne fait pas tourner**, et ce modèle était le
   seul impossible à choisir (la valeur du DOM ne changeait pas). Une ligne « Aucun » le ferme.
5. **`swap()` n’avait pas de `catch`** : hors ligne, le menu revenait tout seul à l’ancienne valeur
   et rien nulle part ne disait pourquoi.

**Et un test qui ne pouvait pas rougir** : le faux `searchModels` ignorait son argument, si bien
que supprimer le filtre de famille ET diviser la limite par douze laissait les sept tests verts.
Il enregistre désormais la requête.

**Ce qui reste ouvert, et qui est écrit pour ne pas être redécouvert :**

- **Le menu tient en une page de 60** et ne suit pas le curseur. Le filtre de famille est appliqué
  **côté main, à la main** (`model-registry.ts`), donc l’API ne narrowe rien pour image, vidéo, 3D
  et audio : sur 642 modèles publics, le modèle cherché peut être sur une page que personne ne
  demande. Une entrée « Parcourir les modèles… » ouvrant `offerModelsOfFamily` rendrait le geste
  riche du panneau Modèles.
- **Ni identifiants manquants, ni erreur, ni chargement** ne sont dits : sans clé API le menu ne
  contient que l’identifiant brut. `MissingCredentials` et `failureKeyOf` existent déjà.
- **Une valeur invalide s’écrit quand même** dans le nœud : `watch` rapporte sans filtre de
  validité, là où le générateur la bloque au `submit`.
- **Le canvas dessine `modelId` brut, l’inspecteur le nom du modèle.** Les deux coïncidaient avant
  ce lot. Les réconcilier demande le nom dans le nœud — un champ que le format de Scenario ne
  porte pas, donc à ne pas ajouter à la légère.

**Deux constats laissés ouverts délibérément**, tranchés avec l’utilisateur le 9 août :

1. **`prepare()` n’apprend toujours pas la famille.** Non corrigé **à dessein** : le nœud portera
   son propre sélecteur de modèle (lot B2), donc il cesse de dépendre du choix de session, et la
   question de la famille cesse d’être structurante. Une correction du plan au passage — sur les
   trois appelants d’`openGeneratorOn`, **un seul** est touché, pas deux : `home/recreate.ts`
   passe par `workspaceOfType(type)`, une table qui ne rend jamais `graph`, et `Spark.tsx` code
   `’image’` en dur. Seul `AssetInspector.tsx` lit l’espace actif.
2. **Dans l’espace Vidéo, « Régénérer » sur un asset image arme le générateur vidéo d’un modèle
   d’image** (`USED_BY_WORKSPACE.video = ASSET_TYPES`, donc l’étagère y montre tout). Hors
   périmètre, noté ici pour ne pas être redécouvert.

À faire en dernier, quand le contenu existe — mais **à concevoir dès l’étape 6**, parce que ça
détermine où le canvas est monté.

- **Tranché le 9 août 2026 : un septième espace.** Le graphe n’est pas la sortie d’un espace, il
  les traverse tous — et le code disait la même chose : `DocumentKind` et `WorkspaceId` sont en
  correspondance **1:1** (`KIND_BY_WORKSPACE`, `workspaceForKind`), donc un `kind: 'graph'` sans
  espace aurait été le premier à casser cette règle, et il aurait fallu désigner un espace
  d’accueil — question sans bonne réponse. Ce qui bouge : `WORKSPACE_IDS`, `KIND_BY_WORKSPACE`,
  `TOOL_PLACEMENTS`, la barre de titre, le rail, et les tests qui verrouillent « six ».
- `TOOL_PLACEMENTS` : **la colonne de gauche est réservée à la génération dans les six espaces**
  (`models` et `generator`, et rien d’autre — un test le verrouille dans les deux sens). Une
  bibliothèque de nodes ne peut donc **pas** y aller. La droite porte ce qui parle du document,
  inspecteur en moitié basse.
- L’inspecteur d’un node passe par le **même** `Inspector` que tout le studio : `main` a posé la
  règle d’un inspecteur unique. Une face de plus dans `panels/inspector/`, pas un panneau à part.
- Le document : `kind: 'graph'`, une entrée dans `IO_BY_KIND`, `DocumentIo.capture` **asynchrone**
  et la marque lue **avant le premier `await`** — c’est la propriété à ne pas casser.
- L’undo : `engines/core/history.ts` et `document-store.ts`, avec `beginGesture` / `endGesture` pour
  qu’un déplacement de node soit **une** entrée. **Ne pas installer `zundo`.**
- **Un piège connu, déjà payé ailleurs** : `document-store.ts` réécrit l’identifiant de coalescence
  à chaque `runCommand` dès qu’un geste est ouvert, y compris pour une commande venue d’ailleurs
  (§ 3.6). Un graphe est **le plus gros producteur d’écritures asynchrones** du studio : chaque node
  qui aboutit écrit pendant qu’une souris tient peut-être un node. Si le défaut se manifeste ici,
  **le corriger à la source** — il sert les six espaces — et le dire dans le journal du plan.

**Fin d’étape** : l’espace s’ouvre, un graphe se crée, s’enregistre, se rouvre à l’identique, et
`⌘Z` défait une arête.

---

## Ce que ce plan ne couvre pas, délibérément

- **Train et Compose de LoRA.** L’étape 3 en est le prérequis, pas le contraire. À rouvrir après.
- **L’auto-layout** (`dagre` / `elkjs`) : une dépendance de plus, et un graphe fait à la main n’en a
  pas besoin tant qu’il n’est pas importé.
- **Les nodes locaux** (`localFile`, `ffmpegConcat`, `pbrPreview`, exports moteur). L’exécuteur de
  l’étape 7 les rend **possibles** ; les écrire est un chantier à part, et c’est là qu’est la vraie
  différenciation du studio. À rouvrir avec l’utilisateur.
- **Le mode « Live »** : aucun endpoint dans les 209 pages locales. Ce n’est pas un manque du
  studio, c’est une fonctionnalité que l’API n’expose pas. **Ne pas la chercher à nouveau.**
- **Le serveur MCP de Scenario** est en BETA et n’a pas à devenir une dépendance produit.
  `recommend` et `plan_generation` seraient un bonus ; le panneau Modèles à facettes mesurées est
  déjà la réponse déterministe au même besoin.

## Au réveil

1. `cd /Users/pasquelin/Applications/scenario/.claude/worktrees/workflows`
2. `git log --oneline -15` puis `pnpm validate` — partir d’une base verte
3. Relire ce fichier : les cases cochées disent où on en est, et les lignes ajoutées sous chaque
   étape disent où le plan a été suivi de biais
4. `docs/REPRISE.md` § 4 pour le pourquoi, § 3.6 pour les deux dettes
5. Reprendre à la première étape non cochée
