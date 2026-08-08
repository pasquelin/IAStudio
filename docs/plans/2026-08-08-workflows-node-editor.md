# Plan — les workflows Scenario et le node editor

**Branche** `feat/workflows` · **Worktree** `.claude/worktrees/workflows` · **Base** `develop`

Ce plan couvre le **§ 4 de `docs/REPRISE.md`** en entier, plus les deux dettes d'API du § 3.6 qui le
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
3. **La Definition of Done de `CLAUDE.md` s'applique à CHAQUE étape**, dans l'ordre : tests
   colocalisés écrits *avec* le code → `pnpm validate` vert → `/simplify` → `/code-review` →
   corrections retenues appliquées → commit. Une étape annoncée sans ces cinq points est invalide.
   **Ne pas demander l'autorisation pour `/simplify` et `/code-review`** : ils font partie du
   travail.
4. **Rebaser sur `develop` LOCAL après chaque étape**, avant d'ouvrir la suivante :
   `git fetch origin develop && git rebase --autostash develop && pnpm validate`. Le `fetch`
   rapproche `develop` local du remote, il ne sert pas de base au rebase — rebaser sur
   `origin/develop` ferait disparaître des fusions locales non publiées.
5. **Rien n'est fusionné dans `develop`** avant le feu vert de l'utilisateur. **Rien n'est poussé.**
   **Jamais de merge dans `main`**, jamais de tag.
6. **`git add` par chemin explicite**, jamais `git add -A` : l'index est partagé entre worktrees.
   Même règle pour `git stash` : préférer un commit de travail.
7. **Cocher l'étape ici** (`- [x]`) dans le commit qui la livre, avec une ligne sur ce qui a
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

Si `pnpm start` répond `Error: Electron uninstall`, c'est que `pnpm install` n'a pas posé le
binaire : `node node_modules/electron/install.js` le télécharge.

## Où lire, et dans quel ordre

| Sujet | Source, dans cet ordre |
|---|---|
| Le chantier | **`docs/REPRISE.md` § 4** en entier, puis § 3.6 |
| L'API workflows | `docs/scenario-api/guides/get-started/documentation/workflows-and-apps.md` (1296 lignes), puis `docs/scenario-api/reference/workflows.*.md` (8 fichiers) — **avant le web** |
| Le SDK | `node_modules/@scenario-labs/sdk/lib/workflow_converter.d.ts` et `.js`, `workflow_validator.*`, `workflow_import_validator.*`. **Le type du SDK fait foi contre la page de doc** |
| React Flow 12 | Context7 (`@xyflow/react`), pas la mémoire — la v12 a renommé la moitié de son API |
| L'app en marche | MCP `electron`, après `pnpm start:debug`. ⚠️ le port 9222 est unique : si une autre session a lancé l'app, c'est son instance qu'on pilote |

## Dépendances

**Autorisée pour ce chantier, et elle seule : `@xyflow/react` (v12.x).** MIT, trois dépendances
(`@xyflow/system`, `classcat`, `zustand` — dont `zustand`, déjà dans le projet). L'import CSS est
obligatoire (`@xyflow/react/dist/base.css`).

**Déjà présent, aucune installation :** l'évaluateur CEL vit dans `@scenario-labs/sdk/tools/cel` et
repose sur `@marcbachmann/cel-js`, qui est une dépendance du SDK et est **dans le store pnpm**.

**Refusé sans un nouvel arbitrage de l'utilisateur :** `dagre`, `elkjs`, `zundo`, `immer`,
`react-hook-form`, `react-flow-smart-edge`. L'auto-layout et l'undo se font à la main — le projet a
déjà `engines/core/history.ts`, générique et partagé, et un `document-store` avec `beginGesture` /
`endGesture`. **Réutiliser, ne pas installer.**

---

## La décision d'architecture qui gouverne les étapes 6 à 8

Elle est prise ici, une fois, parce que tout en dépend.

**Le moteur d'exécution est LOCAL. La délégation à Scenario est une fonction d'export.**

    graphExecutor  (local, par défaut)     →  un runModel par node, via le JobManager
    workflows.run  (Scenario, à l'export)  →  un job, metadata.flow, publication en App

**Pourquoi le local, et pas la délégation seule :**

- **Le cache par hash est ce qui rend un node editor supportable.** Changer le prompt du dernier
  node ne doit relancer que ce node. Déléguer l'interdit : un `workflows.run` réexécute tout.
- **Les nodes que Scenario n'a pas sont ceux qui donneraient sa valeur au studio** : un fichier
  local, un `ffmpegConcat`, un aperçu PBR sur le noyau GPU existant, un export Unity ou Godot.
  Ils n'existent que sous exécution locale.
- **50 nodes et 10 jobs concurrents** sont des plafonds subis en délégation, contournables en local.

**Et pourquoi la délégation quand même :** c'est la seule voie vers la publication en App, et
`metadata.flow` donne gratuitement le statut et les assets **par node** — donc un retour visuel sur
le graphe entier en un seul poll. L'export est donc une vraie fonctionnalité, pas une concession.

**Conséquence assumée :** un graphe qui emploie un node local n'est pas exportable, et l'export doit
le **dire** — pas échouer en silence. Même règle au-delà de 50 nodes.

## Le moteur ignore React, React le pilote (invariant 4)

`engines/graph/` ne contient **aucun import React**, comme `engines/canvas/` et `engines/scene/`.
Le tri topologique, le hachage, la résolution des références et l'ordonnancement sont du calcul pur
et se testent sans DOM. React Flow est de l'affichage : il lit l'état et appelle des méthodes.

Le graphe est un **document** (`kind: 'graph'`), donc il se recrée depuis son état sérialisé
(invariant 3) et il s'enregistre par un `DocumentIo` comme les autres. **Ne pas inventer un
mécanisme de persistance** : `IO_BY_KIND` dans `app/document-io.ts`, et `SCENE_IO` / `TEXTURE_IO`
comme modèles.

---

## Étape 1 — Les deux statuts qui feraient poller pour toujours

- [x] Livrée

> **Suivie, mais sa prémisse est fausse — et c'est le SDK qui le dit.** Les deux corrections
> ci-dessous étaient présentées comme des correctifs ; ce sont des **assurances**.
> `resources/workflows.d.ts` l. 4079-4091 donne à la réponse de `workflows.run` les **huit**
> statuts de la génération et une progression *« between 0 and 1 »* ; `jobs.retrieve`, le seul
> endpoint que le `JobManager` interroge, dit la même chose, et le filtre du serveur MCP officiel
> aussi. Seul le guide en prose annonce `succeeded`/`failed` et 0–100. Rien dans l'historique du
> compte ne permet d'observer un vrai job de workflow (`jobs_list type: workflow` est vide).
>
> Les deux lignes de `STATUS` et l'heuristique de progression sont donc **livrées quand même** :
> inertes si le SDK dit vrai, salvatrices si c'est le guide, et sans collision dans les deux cas.
> Le § 4.5 de `REPRISE.md` porte le détail. **Conséquence pour l'étape 5** : ne pas coder en dur
> l'un des deux vocabulaires — observer ce qu'un vrai job de workflow répond, et le consigner.
>
> **Le seuil de pourcentage est 2, pas 1** — et c'est `/code-review` qui l'a rattrapé. Le dépôt
> documente qu'une génération dépasse sa propre échelle : « *Clamped, because a job that reports
> 1.02 must not overflow its track* » (`design/ProgressBar.tsx`). Diviser dès 1 faisait donc
> retomber la fin de chaque génération à **1 %**, une régression sur le chemin vivant introduite
> pour un vocabulaire que personne n'a observé. Au-dessus de 2, aucune fraction ne peut vivre.
>
> Trois autres corrections de la même revue : `jobProgressOf` rend **0 sur une valeur non finie**
> (un NaN stocké était réémis à chaque poll, `NaN !== NaN` battant la garde qui n'émet que sur
> changement, et `JobsStatus` somme ces valeurs) ; `jobStatusOf` ne lit que les **clés propres** de
> sa table (un statut nommé comme un membre du prototype ne retombait pas sur `running`) ; et le
> test de bout en bout portait ses pourcentages sur un poll **final**, où `advance` sort avant de
> rien stocker — il ne prouvait rien, il les porte désormais sur un poll encore en cours.
>
> Deux ajouts hors plan, issus de `/simplify` : la progression est **bornée à `[0, 1]`** en plus
> d'être normalisée ; et le `sleep` du harness de test est **borné** — ces délais se résolvent sur
> la file de microtâches, donc une boucle de poll dont la condition de sortie régresse tournait à
> l'infini sans qu'aucun timer, celui de vitest compris, ne puisse tomber. La garde **relance hors
> de la chaîne de promesses** (`queueMicrotask`), parce que `execute` rattrape tout : avalée, elle
> réglait le job en échec et laissait passer au vert une boucle emballée. Vérifié en retirant
> `success` de la table : le run devient rouge en 233 ms au lieu de pendre.

**C'est la première étape, et rien du reste ne peut marcher avant.**

`STATUS` dans `src/main/scenario/job-manager.ts` connaît `success`, `failure`, `canceled` — les
valeurs de l'API de **génération**. Un job de **workflow** répond `succeeded`, `failed`, `canceled`
(`workflows-and-apps.md`, « Job Status Values »). Un statut inconnu est traité comme `running`,
délibérément et à raison : c'est ce qui protège d'un statut que Scenario ajouterait. Conséquence
ici : `succeeded` et `failed` ne seraient jamais reconnus, `isFinished` jamais vrai, la boucle ne
s'arrêterait jamais et le job resterait au compteur de concurrence jusqu'à la fermeture.

**À faire.** Deux entrées dans `STATUS` (`succeeded: 'succeeded'`, `failed: 'failed'`), et un test
qui passe les **huit** valeurs de la génération plus les **cinq** du workflow. Ne pas toucher au
repli `?? 'running'` — c'est un choix documenté.

**Et la progression, dans le même commit.** `advance` recopie `remote.progress` tel quel. La
génération le rend en 0–1, le workflow en 0–100 (`"progress": 100` dans la réponse d'exemple du
guide). Normaliser **à l'entrée**, `p > 1 ? p / 100 : p`, pas à l'affichage : la valeur est stockée
dans `Job.progress` et plusieurs surfaces la lisent.

**Fin d'étape** : les treize valeurs sous test, une progression de 100 devenue 1, `pnpm validate`
vert.

---

## Étape 2 — Le limiteur de débit, 100 requêtes par minute

- [x] Livrée

> **Pas dans `reducedBy` : dans le `fetch` du client SDK.** Le plan le donnait pour « le passage
> obligé de chaque appel » — il ne l'est pas. `reducedBy` enrobe deux familles de handlers IPC
> (`scenario` et `assets`, deux appels dans tout `src/`), et le `JobManager` poll droit à travers
> son runner sans le traverser : le plus gros consommateur de requêtes du studio serait passé à
> côté du limiteur. `ClientOptions.fetch` est injectable, et **tout** y passe — la pagination
> automatique et les réessais internes du SDK compris.
>
> Une **fenêtre glissante**, pas un seau à jetons : l'API compte par minute, et l'ouverture d'un
> projet dépense légitimement cent requêtes d'un coup qu'un seau étalerait pour rien. Les
> acquisitions sont **sérialisées** — sans quoi tous ceux que la même expiration réveille se
> disputent l'unique place libérée, et le plus ancien peut perdre indéfiniment. La fenêtre est
> nommée par un **digest de la clé** : elle appartient au compte de toute façon, et rien qui
> pourrait finir dans un dump n'a besoin de porter le secret pour dire lequel.
>
> L'attente est annulable, et le refus arrive **avant que la place soit prise**, pas seulement
> avant l'attente : un appelant qui a renoncé pendant qu'il faisait la queue ne doit pas dépenser
> une requête que l'API compte à tout le monde.
>
> **Le piège qu'ont trouvé `/simplify` puis `/code-review`, et qui aurait rendu le limiteur
> nuisible.** Le SDK arme le timeout d'une requête **avant** d'appeler le transport (`client.js`,
> `fetchWithTimeout`) : toute attente est prise sur le budget de l'aller-retour. La première
> réponse — allonger le timeout du client et lever une erreur au-delà d'un plafond — était fausse
> deux fois, et la revue l'a démontrée par simulation :
>
> 1. **une erreur levée depuis le transport n'arrive jamais telle quelle.** Le SDK rattrape ce qui
>    en sort, le réessaie deux fois, puis le remballe en `APIConnectionError` : la limite serait
>    arrivée à l'utilisateur en « échec réseau » sur une connexion saine, et la branche ajoutée à
>    `failureOf` était du code mort ;
> 2. **allonger le timeout du client le fait pour toutes les requêtes**, y compris l'immense
>    majorité qui n'attend pas : un réseau réellement mort mettait six minutes à se déclarer au
>    lieu de trois.
>
> La bonne réponse tient dans la langue que le SDK parle déjà : au-delà de **10 s** d'attente, le
> transport rend une **réponse 429 de synthèse portant `retry-after-ms`**. Le SDK l'attend au
> millimètre (`client.js` honore cet en-tête), la réessaie, et ce qui remonte s'il persiste est une
> `APIError` que `failureOf` lit déjà en `rate-limited`. Le timeout du client redevient son défaut.
>
> Trois autres corrections de la même revue : le **plafond d'attente est compté à l'arrivée** de
> l'appelant et non quand son tour vient (compté au tour, chaque attendant recevait un budget neuf
> et la file entière était tenue sans borne — 320 acquisitions simulées, zéro refus) ; l'horloge
> est **monotone**, une horloge murale qui recule laissant dans la fenêtre des instants futurs qui
> refusaient *tous* les appels ; et un appelant qui renonce **pendant qu'il fait la queue** est
> relâché tout de suite au lieu d'attendre son tour, sans quoi l'appel SDK derrière lui ne se
> règle jamais. La limite effective est **95** et non 100 : le studio compte au départ, l'API à
> l'arrivée, et la marge absorbe la dérive.
>
> **À arbitrer, hors périmètre de cette étape** : le polling seul dépense **90 requêtes/minute sur
> 100** à la concurrence par défaut (3 jobs, poll à 2 s), et 300 à la concurrence 10 des workflows.
> Le limiteur ne crée pas ce dépassement, il le rend net — mais il sera saturé en usage normal
> tant que la demande n'est pas réduite. Recommandation : allonger l'intervalle de poll, ou
> l'asservir au budget restant. C'est un changement de comportement, donc une décision.
>
> **Hors périmètre, assumé et écrit dans `REPRISE.md`** : `download()` va chercher une URL signée
> par `net.fetch`, et les envois multipart du SDK vont sur S3 avec le `fetch` global. Ni l'un ni
> l'autre n'est un appel d'API, ni compté.

Dette du § 3.6. La limite est **100 requêtes/minute/projet**, écrite dans
`workflows-and-apps.md` § « Rate Limits ». `limits.ts` ne borne que la **taille des lots**, le
`JobManager` que la **concurrence** : trois grandeurs différentes. Dix jobs concurrents qui pollent
toutes les deux secondes font 300 requêtes/minute à eux seuls, et l'exécuteur de graphe va
multiplier les appels.

**Où.** `src/main/scenario/rate-limiter.ts`, un seau à jetons, traversé par **tout le monde** :
`reducedBy` (`client.ts`) est déjà le passage obligé de chaque appel — c'est le bon endroit, et
c'est ce qui garantit qu'aucun appelant ne peut l'oublier.

**Deux décisions.** Le compteur est **par compte actif**, pas global : la limite est par projet, et
une clé porte son projet (`owner-scope.ts`). Et l'attente est **annulable** — un job annulé pendant
qu'il attend un jeton ne doit pas consommer sa place.

**Ce qui existe déjà et qu'il ne faut pas dupliquer.** `createRetry` (`scenario/retry.ts`, sorti du
`JobManager` par `feat/prompt-assist`) réessaie les 429 en backoff exponentiel : le limiteur ne le
remplace pas, il évite d'y arriver. Et `assist-queue.ts` borne la concurrence de l'assistance de
fond — c'est une **troisième** borne de concurrence, à côté de celle du `JobManager` et des lots de
`limits.ts`, et sa JSDoc dit qu'elle ne décide que *quand* le travail tourne. Le limiteur se place
donc au-dessus des trois, dans `reducedBy`, et non à côté.

**Fin d'étape** : test à horloge injectée (jamais `Date.now()` réel dans un test) — 100 appels
passent, le 101ᵉ attend, la fenêtre glisse, un appel annulé libère sa place.

---

## Étape 3 — Un job survit à la fermeture de l'application

- [x] Livrée

> **L'étape la plus grosse des trois premières, et de loin** — le détail est au § 3.6 de
> `REPRISE.md`. Elle a touché huit fichiers hors du `JobManager` : le carnet de comptes (une
> identité de compte qui survit à un ré-ajout), le magasin de réglages, le collecteur d'assets,
> le provider de client, la racine de composition et la fermeture de l'application.
>
> **Les trois pièges annoncés par le plan étaient les bons**, mais deux réponses du plan étaient
> insuffisantes. « Garder l'identifiant du compte » : l'id local ne suffit pas, un retrait suivi
> d'un ré-ajout de la même clé le renouvelle et le job repris est perdu en silence — c'est une
> **empreinte de la clé** qu'il faut, la même notion que celle qui nomme les fenêtres du limiteur.
> Et « ne pas ressusciter un job annulé » est le petit frère d'une règle bien plus large que le
> plan ne voyait pas : **une note ne part que si l'API a conclu**. La première version oubliait le
> job sur tout statut terminal, si bien qu'une coupure réseau de quinze secondes effaçait la note
> d'une génération vivante et payée.
>
> **Un quatrième piège, absent du plan** : le collecteur frappait un id local neuf par sortie, donc
> une note survivant à un job déjà collecté réimportait tout et refacturait le transfert. Un
> `localIdOf` sur la sortie — la fonction était déjà là, employée pour le parent seulement.
>
> **Et une décision que le plan ne posait pas** : la reprise se fait à l'ouverture du projet, pas au
> démarrage, parce que le collecteur écrit dans le catalogue du projet ouvert. La note porte donc
> son projet, et un job qui aboutit alors qu'un autre projet est ouvert **ne collecte pas** : il
> s'efface de la session et attend le retour du sien.

Dette du § 3.6, et **prérequis dur** de tout job long. Aujourd'hui `createJobManager` tient tout
dans une `Map`, et rien n'appelle `jobs.list` au démarrage : une génération vidéo de dix minutes,
l'application fermée entre-temps, et le job aboutit chez Scenario sans que le studio le collecte
jamais dans le projet. C'est du travail payé et perdu.

**À faire.** Persister les entrées — `id` local, `jobId` distant, `modelId`, `label`, compte
d'origine, `createdAt` — puis au démarrage réhydrater la file, relancer le polling des jobs non
terminés, et **collecter les sorties de ceux qui ont abouti pendant l'absence**.

**Trois pièges à traiter, pas à découvrir.**

- **Le compte.** Une entrée reprise doit retrouver **son** compte : un `jobId` interrogé sous une
  autre clé répond 404, et aucun retry ne répare un 404. C'est déjà la raison pour laquelle
  `JobAccount` est capturé à la soumission ; la persistance doit garder l'identifiant du compte,
  pas l'objet.
- **Où écrire.** Le catalogue du projet est un SQLite qui tourne sur son propre `worker_threads` ;
  `better-sqlite3` est **synchrone** et une requête lourde dans le main gèle toutes les fenêtres
  (invariant 6). Un job n'appartient pas à un projet — il appartient au compte — donc écrire dans
  `app.getPath('userData')`, en JSON atomique, sur le modèle de `main/project/documents.ts`
  (fichier de transit puis `rename`).
- **Ne pas ressusciter un job annulé.** Une entrée `cancelled` persistée puis relue relancerait un
  polling sur un job mort.

**Fin d'étape** : un test qui écrit l'état, reconstruit un manager, et vérifie qu'un job `running`
reprend son polling, qu'un job abouti pendant l'absence est collecté, et qu'un job annulé ne
repart pas.

---

## Revue de cohérence de la branche — entre l'étape 3 et l'étape 4

Les trois étapes avaient chacune eu son `/simplify` et son `/code-review`. Cette passe-ci cherchait
**ce qu'une revue par étape ne peut pas voir** : ce qu'une étape casse dans une autre, deux notions
du même concept, un document qui contredit le code. Elle a rendu **dix défauts confirmés**, tous
corrigés avant la fusion. Elle valait son prix : quatre des dix étaient sévères, et aucun n'était
visible depuis l'étape qui l'avait introduit.

**Les quatre qui perdaient du travail ou de l'argent.**

1. **Annuler un job repris ne prévenait pas l'API.** L'étape 3 a donné un `remoteId` aux entrées
   encore en file ; la branche « déjà en file » de `cancel` datait d'avant et disait « il n'a jamais
   atteint l'API ». Elle sortait donc le job de la file, `settle` libérait son compte — et la
   génération continuait d'être facturée sans que rien dans le studio ne puisse plus l'arrêter.
   Pire : la note repartait sur disque, donc le job annulé **réapparaissait** à l'ouverture suivante.
2. **Un job repris était invisible.** `resume` l'annonçait par un événement de progression, mais la
   réplique du renderer ne sait que fusionner dans une ligne qu'elle a déjà : un identifiant inconnu
   est ignoré en silence. Le commentaire du code affirmait exactement le contraire de ce qui se
   passait.
3. **Un job dont le projet a changé disparaissait sans le dire.** La seule sortie qui ne passait pas
   par `settle`, donc le seul cas sans événement terminal : la ligne tournait pour le reste de la
   session, avec un bouton Annuler que le main n'avait plus d'entrée pour servir.
4. **`entry.done` n'était jamais posé dans le `catch` d'`execute`.** Un job dont l'API a perdu la
   trace (404) rejouait son échec **à chaque ouverture de projet pendant sept jours**.

Les deux premiers ont la même réponse : un canal `evt:jobs-changed` qui porte la liste entière
quand elle **gagne ou perd** une entrée — ce qu'un événement de progression, qui nomme un job par
son identifiant, ne peut pas exprimer par construction.

**Les deux qui demandaient un arbitrage, tranchés par l'utilisateur** (voir § 3.6 de `REPRISE.md`
pour le détail) : l'intervalle de poll est désormais **calculé** sur le nombre de jobs suivis, et
l'annulation passe devant tout le monde grâce à une **file à priorité** doublée de places
réservées. Les deux « dettes assumées » de l'étape 2 sont donc payées, pas reportées.

**Les quatre derniers** : la garde de re-collecte de l'étape 3 était aveugle à la provenance et
adoptait un asset venu de la bibliothèque du compte — elle est maintenant portée par le `jobId` ;
`persist` avalait toute erreur d'écriture sous un `.catch(() => {})` muet, alors que c'est
précisément la garantie que l'étape 3 existe pour tenir ; `windowNameOf` dupliquait
`accountFingerprint` au caractère près, alors que les deux documents affirmaient qu'il n'y avait
qu'une notion ; et `REPRISE.md` donnait pour livrée la formule de progression que `/code-review`
avait rejetée à l'étape 1.

**Trois candidats ont été réfutés** par la vérification, dont deux sur le même point : `accounts.of`
ne casse pas le cache `bound`, et le § 3.6 ne se contredit pas sur le débit.

**Ce que `pnpm validate` cachait.** Les 3931 tests passaient, mais trois budgets de couverture
étaient dépassés — le pipe `| tail` masquait le code de sortie, et la session précédente a cru la
branche verte. `develop` l'était, la branche non. Le code non couvert était exactement celui que la
revue a relevé : la garde d'idempotence du collecteur et le rattrapage d'écriture du `job-store`,
tous deux non testés. **Un budget de couverture qui déborde nomme souvent le défaut avant la revue.**

---

## Étape 4 — `dryRun` et le coût visible

- [ ] Livrée

> **Le point 4 est déjà livré, par quelqu'un d'autre.** `feat/usage-window` a été fusionnée dans
> `develop` le 8 août 2026 et donne à la consommation de chaque clé **sa propre fenêtre**
> (`renderer/src/usage/`, `main/scenario/usage.ts`, `usage-aggregate.ts`) : `usages.list`,
> `pricing.oscu.retrievePrices`, un journal paginé par compte, une période dans la barre de titre.
> **Ne pas refaire « `usages.list` dans Réglages > Compte »** — c'est fait, mieux et ailleurs. Le
> texte ci-dessous a été écrit avant.
>
> Restent les points 1 à 3, dont rien n'existe : `grep -rn dryRun src/` ne rend toujours rien. Le
> code de `cost.ts` et de ses cinq tests est écrit et conservé dans `REPRISE-workflows.md`, avec
> l'avertissement qu'il n'a pas été revérifié depuis que `develop` a pris trente commits.
>
> **Un piège pour le point 3 :** `usage-aggregate.ts` lit déjà `creativeUnitsCost`, mais sur les
> **événements de facturation**. Le coût d'un job se capte ailleurs et à un seul instant — sur la
> réponse de soumission, que `runnerOf` jette aujourd'hui en ne gardant que `.job`. Deux chemins
> vers la même grandeur : ne pas les confondre.

**Le meilleur rapport valeur/effort du plan, et un prérequis d'ergonomie du node editor** : un
graphe sans coût par node est un graphe qu'on n'ose pas lancer.

`dryRun` est documenté sur `generate.run_model` (`reference/generate.run_model.md:21`), sur
`workflows.run` et sur `models.train.trigger`. **Aucun job créé, aucun crédit débité.** La réponse
est un `402` porteur d'un `estimatedCost` — donc **un 402 n'est pas une erreur ici**, et
`failureOf` le classe aujourd'hui dans `unexpected` : c'est le premier point à traiter.

**À faire.**

1. Un canal `scenario:estimate-cost`, qui rend un coût ou l'absence de coût — jamais une erreur pour
   un 402.
2. Un badge sur le bouton Générer du `Generator`, réévalué quand le formulaire change. **Débouncé**,
   et **annulable** : un formulaire qu'on remplit ne doit pas lancer une estimation par frappe, et
   le limiteur de l'étape 2 est là pour rappeler que ces appels comptent.
3. Le coût réel, quand il revient : les réponses de job portent `creativeUnitsCost`. À poser sur
   l'entrée du `JobManager` et à afficher dans la barre de jobs, à côté de l'estimation.
4. La consommation : `usages.list` (unités consommées, par modèle, par période — 120 jours de
   fenêtre maximum) dans **Réglages > Compte**, à côté de l'état d'authentification.

**Fin d'étape** : un badge de coût sur les six espaces, un 402 qui ne s'affiche jamais comme un
échec, et la consommation du mois lisible dans les Réglages.

---

## Étape 5 — Exécuter les Apps de Scenario, sans éditeur

- [ ] Livrée

**Une étape qui vaut un produit à elle seule**, et qui vient avant le canvas : `workflows.list` en
`privacy: public` rend les **Apps** — des workflows publics, exécutables tels quels, filtrables par
tag. Ça met le « ready-made » de la webapp dans le studio sans écrire un seul graphe, et surtout ça
donne des **exemples réels d'`editorInfo`** pour vérifier le rendu du canvas de l'étape 6 contre des
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
- Le formulaire : les `inputs` d'un workflow ont **la même forme que les inputs d'un modèle**
  (`name`, `type`, `kind`, `required: { always }`). Donc `translateSchema` s'applique tel quel et
  `DynamicForm` les rend. **Ne pas écrire un second traducteur** — si un champ résiste, c'est
  `translateSchema` qui s'étend, avec son test.
- Le suivi : `RemoteJob` gagne une variante `metadata.flow[]`, aplatie vers la liste d'ids d'assets
  distants. **`collector.ts` ne change pas** — il prend déjà une liste d'ids.

**Fin d'étape** : un panneau qui liste les Apps, en ouvre une, remplit son formulaire, la lance, et
voit son job aboutir dans la barre de jobs avec ses assets posés dans le projet.

---

## Étape 6 — Le canvas, et la convention d'arête

- [ ] Livrée

**Lire le § 4.4 de `REPRISE.md` avant la première arête.** Le SDK porte la règle en commentaire
(`lib/workflow_converter.js:588`) : `{ source: consumer, target: provider }`. **`source` est
l'ENTRÉE (à gauche), `target` est la SORTIE (à droite).** La donnée va de gauche à droite à l'écran,
l'objet arête pointe de droite à gauche. Câbler dans le sens intuitif produit un flow retourné à
l'export, **sans erreur et sans avertissement**.

Nommage, que le convertisseur lit : handle `` `${nodeId}-${'source'|'target'}-${fieldName}` ``,
sorties de boucle `` `${nodeId}-output-${n}` ``, nom de sortie par défaut `output`.

**À faire.**

- `@xyflow/react` installé, CSS importé, `engines/graph/` créé — **aucun import React dedans**.
- Le format natif du node editor est **`editorInfo` de Scenario**, pas un format maison :
  `{ nodes, edges, inputKeys }`. C'est ce qui rend gratuits la compilation, la validation et
  l'aller-retour avec la webapp.
- Les **15** types de nodes d'éditeur (`VALID_EDITOR_NODE_TYPES`, `modelInput` compris — un rapport
  tiers qui en annonce 14 a été écrit avant). Commencer par quatre : `text`, `asset`, `model`,
  `stickyNote`. Les onze autres suivent à l'étape 8.
- Ports typés : `WorkflowEditorHandleInput.type` peut être un `string[]` — un port **polymorphe**.
  C'est la matière de `isValidConnection` et du code couleur. `subHandles` pour les sous-ports.
- Le chrome : **maison**, `design/` (le canvas vit dans un dock, donc rien de DaisyUI). Ni
  `<Controls>` ni `<MiniMap>` de React Flow — le studio a `design/Toolbar.tsx`. `<Background>` en
  points, `gap 20`, `size 0.5`, comme la webapp.
- Les jetons : **aucune valeur hexadécimale dans un composant**, aucun pixel là où une gauge `--sc-*`
  existe. React Flow se style par CSS custom properties : les surcharger depuis `index.css`.

**Trois pièges de la v12** : `node.measured.width/height` (plus `node.width`),
`screenToFlowPosition`, `nodeLookup` (plus `nodeInternals`). **Vérifier sur Context7**, pas de
mémoire.

**Fin d'étape** : un graphe de trois nodes se construit à la souris, se sauve, se relit à
l'identique, et les ports refusent une connexion de type incompatible.

---

## Étape 7 — Compiler, valider, exécuter en local

- [ ] Livrée

**Ne pas écrire de compilateur.** `convertWorkflowEditorToFlow({ nodes, edges, inputKeys, getModel })`
le fait ; `getModel` résout les presets de ratio et les indices de type depuis le `ModelRegistry`
déjà écrit, et rend `'unknown'` pour un modèle dont la définition manque. Le convertisseur rend
`type: string` là où l'API veut une union littérale : c'est **l'un des rares `as` justifiés du
dépôt**, avec son commentaire d'une ligne.

`validateWorkflowFlow(flow)` jette à la **première** violation, avec un message lisible. Il vérifie
les ids non vides et uniques, l'appartenance aux **10** types d'exécution, les champs requis par
type (`custom-model` → `modelId`, `workflow` → `workflowId`, `logic` → `logicType`, `for-each` →
`loopBodyNodeIds` non vide **ou** `count > 0`), et toutes les références croisées. **Le brancher en
direct dans l'éditeur** : un surlignage d'erreur pendant la frappe, pas un 400 à l'envoi.

**`"workflow"` est réservé dans `ref.node`** — il désigne les inputs du workflow parent, et n'est pas
vérifié contre les ids de nodes. **Ne jamais nommer un node `workflow`.**

**L'exécuteur local**, `engines/graph/executor.ts`, calcul pur et testable sans réseau :

1. tri topologique (Kahn) et **détection de cycle** — un cycle se dit, il ne boucle pas ;
2. `hash(nodeId + type + params résolus + hashes des parents)` → clé de cache ;
3. cache touché → l'`assetId` est réutilisé, le node est marqué `cached` ;
4. sinon `dryRun` pour le coût, puis `runModel` **via le `JobManager`** — jamais un appel direct au
   SDK, c'est un bug (`CLAUDE.md`) ;
5. un node abouti résout les références de ses enfants et les débloque ;
6. exécution par vagues, sous le sémaphore du `JobManager` et le limiteur de l'étape 2.

**Le cache est le point du plan à ne pas rater** : c'est lui qui rend l'outil agréable. Il vit à
côté du document, il est immuable, et il se purge à la main.

**Fin d'étape** : un graphe de cinq nodes s'exécute, le prompt du dernier change, **seul le dernier
se relance**, et un cycle est refusé avec un message qui nomme les nodes en cause.

---

## Étape 8 — Logique, boucles, transforms, approbation

- [ ] Livrée

Les onze types de nodes restants, et les trois mécanismes qui les portent.

- **`ifElse`** — le format existe : `WorkflowEditorConditionBlock` est
  `{ conditions: { field?, operator, value? }[], logic: 'and' | 'or' }`. L'UI est un **query
  builder** de groupes ET/OU. **Ne pas l'inventer.** Le merge après branchement se fait par
  `ref.conditional` : « le premier de ces nodes dont le statut vaut `success` ».
- **`transform`** — expressions **CEL**. `@scenario-labs/sdk/tools/cel` (`createCelEnvironment`,
  `evaluateCel`) est **déjà installé**, via les dépendances du SDK. Donc **l'aperçu du résultat
  pendant la frappe, en local, sans un appel réseau** : c'est le gain d'ergonomie le moins cher de
  tout le chantier.
- **`forEach` / `forEachEnd`** — une **paire visuelle** côté éditeur, qui se compile en **un seul**
  node `for-each` portant `loopBodyNodeIds`. Ne pas chercher un mapping 1:1 entre les deux
  vocabulaires : il n'existe pas. `sliceAssets` (`from`, `count`) et `groupItems` complètent.
- **`approval` / `user-approval`** — un job de workflow peut **se suspendre**. `JobStatus` n'a rien
  entre `running` et fini : ajouter `awaiting-approval`, et se rappeler que **cela change
  `isFinished`** — donc c'est solidaire de l'étape 1. `workflows.userApproval(id, { nodeId, status })`
  débloque, et la barre de jobs porte les deux boutons.
- **`llm`, `transformText`, `splitText`, `aspectRatio`, `modelInput`** — le reste de la liste.
  `aspectRatio` est le bon moment pour brancher les helpers du SDK :
  `ASPECT_RATIO_PRESETS`, `normalizeAspectRatio`, `getAspectRatioBounds`,
  `getDimensionsFromAspectRatio`, plus `uiConfig.resolutionComponent` du modèle. **Scenario a publié
  les primitives de son propre composant de résolution : les réutiliser, pas les réécrire.**

**Fin d'étape** : un graphe qui branche, boucle, transforme et attend une approbation s'exécute de
bout en bout.

---

## Étape 9 — Import, export, publication

- [ ] Livrée

- **Fichier** : `validateEditorInfo(raw)` accepte la **version `'1.0'`** et jette un
  `WorkflowImportError` (`err.name === 'WorkflowImportError'`). Payload :
  `{ version, name, description, editorInfo{nodes,edges,inputKeys}, inputs, tagSet, uiConfig?,
  exportedAt, exportedBy }`. **Adopter ce format pour les `.workflow.json` du studio** :
  l'interopérabilité avec la webapp est gratuite. Un fichier sur disque est une **entrée non
  fiable** — la validation à la relecture n'est pas facultative.
- **Vers Scenario** : `create` puis `update({ flow, status: 'ready' })`. `create`/`update` laissent
  le workflow en **`draft`, non exécutable**. Un endpoint de publication côté serveur existe en MCP
  (`workflow_publish`) mais **dans aucune des 209 pages REST locales** : la compilation locale est
  donc le seul chemin documenté, et c'est aussi le meilleur — la validation devient un retour
  instantané au lieu d'un 400.
- **Les deux refus qui doivent parler** : au-delà de **50 nodes**, et dès qu'un node local
  (`localFile`, `ffmpeg`, `pbrPreview`) est dans le graphe. Un export qui échoue le **dit** — le
  § 3.3 de `REPRISE.md` porte déjà ce défaut corrigé sur l'export 3D, ne pas le refaire.
- **`isLocked`** : un workflow verrouillé ne se modifie ni ne se supprime, sauf par son auteur.
  À respecter dans l'UI plutôt qu'à découvrir par un 403.

**Fin d'étape** : un graphe fait dans le studio s'ouvre dans la webapp, un graphe de la webapp
s'ouvre dans le studio, et un graphe non exportable dit pourquoi.

---

## Étape 10 — L'espace, le document, la place dans le shell

- [ ] Livrée

À faire en dernier, quand le contenu existe — mais **à concevoir dès l'étape 6**, parce que ça
détermine où le canvas est monté.

- Un **septième espace** (`WORKSPACE_IDS`) ou un type de document dans les six ? **À trancher avec
  l'utilisateur.** Le graphe n'est pas la sortie d'un espace, il les traverse tous : c'est
  l'argument pour un espace à lui.
- `TOOL_PLACEMENTS` : **la colonne de gauche est réservée à la génération dans les six espaces**
  (`models` et `generator`, et rien d'autre — un test le verrouille dans les deux sens). Une
  bibliothèque de nodes ne peut donc **pas** y aller. La droite porte ce qui parle du document,
  inspecteur en moitié basse.
- L'inspecteur d'un node passe par le **même** `Inspector` que tout le studio : `main` a posé la
  règle d'un inspecteur unique. Une face de plus dans `panels/inspector/`, pas un panneau à part.
- Le document : `kind: 'graph'`, une entrée dans `IO_BY_KIND`, `DocumentIo.capture` **asynchrone**
  et la marque lue **avant le premier `await`** — c'est la propriété à ne pas casser.
- L'undo : `engines/core/history.ts` et `document-store.ts`, avec `beginGesture` / `endGesture` pour
  qu'un déplacement de node soit **une** entrée. **Ne pas installer `zundo`.**
- **Un piège connu, déjà payé ailleurs** : `document-store.ts` réécrit l'identifiant de coalescence
  à chaque `runCommand` dès qu'un geste est ouvert, y compris pour une commande venue d'ailleurs
  (§ 3.6). Un graphe est **le plus gros producteur d'écritures asynchrones** du studio : chaque node
  qui aboutit écrit pendant qu'une souris tient peut-être un node. Si le défaut se manifeste ici,
  **le corriger à la source** — il sert les six espaces — et le dire dans le journal du plan.

**Fin d'étape** : l'espace s'ouvre, un graphe se crée, s'enregistre, se rouvre à l'identique, et
`⌘Z` défait une arête.

---

## Ce que ce plan ne couvre pas, délibérément

- **Train et Compose de LoRA.** L'étape 3 en est le prérequis, pas le contraire. À rouvrir après.
- **L'auto-layout** (`dagre` / `elkjs`) : une dépendance de plus, et un graphe fait à la main n'en a
  pas besoin tant qu'il n'est pas importé.
- **Les nodes locaux** (`localFile`, `ffmpegConcat`, `pbrPreview`, exports moteur). L'exécuteur de
  l'étape 7 les rend **possibles** ; les écrire est un chantier à part, et c'est là qu'est la vraie
  différenciation du studio. À rouvrir avec l'utilisateur.
- **Le mode « Live »** : aucun endpoint dans les 209 pages locales. Ce n'est pas un manque du
  studio, c'est une fonctionnalité que l'API n'expose pas. **Ne pas la chercher à nouveau.**
- **Le serveur MCP de Scenario** est en BETA et n'a pas à devenir une dépendance produit.
  `recommend` et `plan_generation` seraient un bonus ; le panneau Modèles à facettes mesurées est
  déjà la réponse déterministe au même besoin.

## Au réveil

1. `cd /Users/pasquelin/Applications/scenario/.claude/worktrees/workflows`
2. `git log --oneline -15` puis `pnpm validate` — partir d'une base verte
3. Relire ce fichier : les cases cochées disent où on en est, et les lignes ajoutées sous chaque
   étape disent où le plan a été suivi de biais
4. `docs/REPRISE.md` § 4 pour le pourquoi, § 3.6 pour les deux dettes
5. Reprendre à la première étape non cochée
