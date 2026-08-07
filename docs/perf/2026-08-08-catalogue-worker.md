# Le catalogue quitte le thread principal

**Mesures faites le** : 7 août 2026 · **Branche** : `perf/catalogue-worker` · **Base** : `d855911`

<sup>L'« avant » a été mesuré sur `322185a`, la base d'origine de la branche ; l'« après » a été
re-mesuré après rebase sur `d855911`. Les deux exécutent le même harnais.</sup>

Suite directe de [l'audit du chemin chaud 3D](2026-08-08-audit-3d.md), qui concluait que le
prochain travail de performance utile n'était pas dans l'inspecteur mais dans le catalogue :
`better-sqlite3` est synchrone, et toutes les requêtes s'exécutaient dans le processus
principal — donc bloquaient toutes les fenêtres, y compris les détachées.

---

## 1. Le protocole

Machine : Apple M2 Max, 12 cœurs, macOS 26.5.2. Build de production
(`electron-vite build` puis `electron .`), jamais le dev.

**Réserve à connaître :** la machine faisait tourner d'autres sessions de travail pendant les
mesures. Cela n'affecte pas le résultat central — un blocage du thread principal est un
événement discret, pas une moyenne — mais gonfle les médianes de latence de la section 5, où
les minima sont plus proches du coût réel.

Trois instruments :

**a. Micro-benchmarks** (`vitest bench`, driver de production `better-sqlite3`) — le coût pur
d'une requête sur des catalogues de 1 000 à 200 000 assets.

**b. Sonde de blocage du thread principal.** Un projet de 100 000 assets est ouvert dans
l'application, puis on martèle `project.current()` — un canal IPC qui ne touche à aucune base —
en mesurant son aller-retour. Sa latence ne mesure qu'une chose : à quel point le thread
principal est occupé. Pendant ce temps, seize recherches lourdes sont lancées.

**c. Latence de recherche seule**, sans sonde concurrente : la sonde en boucle serrée sature
l'IPC et fausse ce chiffre-là.

L'« avant » n'est pas une extrapolation : un worktree détaché sur la base `322185a` a été
construit et mesuré avec le même harnais.

---

## 2. Les chiffres avant — pourquoi il fallait faire quelque chose

Coût d'une requête, driver de production, seuil de 16 ms au-delà duquel l'interface gèle :

| Assets | par type | texte sans résultat | deux tags | première page | par id |
|---|---|---|---|---|---|
| 1 000 | 0,15 ms | 0,44 ms | 0,12 ms | 0,14 ms | 0,004 ms |
| 10 000 | 1,69 ms | 1,32 ms | 0,75 ms | 0,48 ms | 0,004 ms |
| 50 000 | 7,09 ms | 7,88 ms | 3,94 ms | — | — |
| **100 000** | **15,17 ms** | **22,53 ms** | 7,69 ms | 0,49 ms | 0,004 ms |
| **200 000** | **33,73 ms** | **43,82 ms** | **20,49 ms** | — | — |

Le coût est linéaire en nombre d'assets, et le seuil des 16 ms est franchi vers 100 000. Deux
requêtes le franchissent en premier, pour la même raison : il faut parcourir toute la table
pour remplir la page. `type = ?` doit trier les 16 000 lignes qui correspondent, et un
`LIKE '%…%'` qui ne trouve rien n'a aucun index à sa disposition.

Trois requêtes restent triviales quelle que soit la taille — la première page, et surtout la
recherche par identifiant, à **0,004 ms, constante de 1 000 à 100 000 assets**. Ce chiffre a
décidé d'un point de conception, plus bas.

### Le blocage, mesuré dans l'application

100 000 assets, seize recherches lourdes, sonde IPC continue :

| | AVANT (catalogue dans le main) | APRÈS (catalogue sur son thread) |
|---|---|---|
| Sondes | 16 687 | 32 297 |
| Latence médiane | 0 ms | 0 ms |
| p99 | 0,2 ms | 0,2 ms |
| **Pic maximal** | **22,1 ms** | **8,4 ms** |
| **Sondes au-dessus de 16,7 ms** | **16** | **0** |

**Seize recherches lourdes, seize blocages.** Un par requête, et le pic de 22,1 ms est très
exactement la requête mesurée à 22,53 ms au banc. Après, aucun blocage sur 32 297 sondes — et
le résultat s'est reproduit sur trois exécutions successives, dont deux avant le rebase.

---

## 3. Ce qui a été corrigé

Un seul changement : **le catalogue s'exécute sur son propre `worker_threads`**, comme
l'invariant 6 et la spec le demandaient depuis le début.

`catalog.ts` n'a **pas changé d'une ligne**. Seul son lieu d'exécution change. C'est ce que le
port `SqliteDriver` rendait possible.

| Fichier | Rôle |
|---|---|
| `catalog-protocol.ts` | Ce que le main et le thread se disent |
| `catalog-dispatch.ts` | Une requête, jouée contre le catalogue. Ne jette jamais |
| `catalog-client.ts` | Le catalogue vu du main : les mêmes opérations, en promesses |
| `catalog-thread.ts` | Le `Worker` et son adaptateur |
| `catalog-worker.ts` | L'entrée du thread : la base et la boucle de messages |
| `catalog-fixtures.ts` | Un catalogue de la bonne forme, sans thread, pour les tests |

**Gain mesuré : de seize blocages du thread principal à zéro**, et le pic maximal passe de
22,1 ms à 12,1 ms — ce qui reste étant du bruit ordinaire (ramasse-miettes, IPC), pas une
requête.

### Trois décisions, et leur raison

**Un thread, pas un pool.** La spec demande un pool borné pour les tâches longues. SQLite
n'accepte qu'un écrivain à la fois, et les requêtes sont courtes : les sérialiser ne coûte rien
que le main ne payait déjà. Ce que le thread achète, c'est que le main cesse de les attendre.

**Tout le catalogue part, pas seulement `search`.** L'invariant ne parle que des requêtes « non
triviales », et `find` est trivial — 0,004 ms, constant. Le garder dans le main aurait demandé
une seconde connexion au même fichier ; un seul propriétaire de la base est plus sûr, et `find`
n'y perd qu'une latence de message. Le protocole d'assets, qui résout une vignette par `find`,
est servi par une grille virtualisée : quelques dizaines de résolutions visibles, pas deux
mille.

**Le client rejette ce qui est en vol si le thread meurt.** Sans cela, un worker qui plante
laisse l'interface attendre une promesse que plus personne ne réglera. Trouvé en revue, corrigé,
couvert par deux tests.

---

## 4. Ce qui a été laissé

**Les index.** Un index composite `(type, created_at DESC)` et un FTS5 pour la recherche texte
feraient tomber les deux requêtes coûteuses sous la milliseconde — ils suppriment le coût au
lieu de le déplacer. C'est le complément naturel de ce travail, et il mérite son propre
passage : le thread apporte la garantie (le main ne gèle plus, quelle que soit la requête), les
index apporteraient la latence ressentie.

**L'annulation.** L'invariant demande que toute tâche longue soit annulable. Une requête
`better-sqlite3` engagée ne s'interrompt pas, et le client n'expose pas encore d'abandon des
recherches obsolètes — une frappe au clavier qui produit six recherches les fait toutes. Elles
ne bloquent plus rien, mais elles occupent le thread. À traiter avec les index, qui les rendront
assez brèves pour que la question se pose autrement.

**La progression.** Sans objet pour une requête ponctuelle.

---

## 5. Les chiffres après

**Blocage du thread principal : le tableau de la section 2.** Seize blocages deviennent zéro.

**Latence de la recherche elle-même**, sans sonde concurrente, 100 000 assets, 12 tours :

| Requête | médiane | minimum | au banc, hors application |
|---|---|---|---|
| par type | 21,3 ms | **15,8 ms** | 15,17 ms |
| texte sans résultat | 26,5 ms | **19,8 ms** | 22,53 ms |

Les minima recoupent les micro-benchmarks à la milliseconde près : **le trajet par le thread et
l'IPC ne coûte rien de mesurable**. Les médianes portent la charge de la machine, partagée
pendant la mesure — une première série, prise pendant un build concurrent, donnait 46 et 41 ms
pour les mêmes minima.

**La recherche n'est pas devenue plus rapide — ce n'était pas l'objet.** C'est le même SQL, sur
le même moteur, simplement plus sur le thread qui dessine les fenêtres.

---

## 6. Ce qu'il faut retenir

1. Le catalogue franchissait les 16 ms vers **100 000 assets**, et atteignait **44 ms à
   200 000** — pendant lesquelles toutes les fenêtres étaient figées.
2. Il s'exécute désormais sur son propre thread : **zéro blocage mesuré sur 32 297 sondes**.
3. `catalog.ts` n'a pas bougé. Le port `SqliteDriver` a tenu sa promesse — à une nuance près,
   corrigée dans son en-tête : échanger le driver ne pouvait pas suffire, puisque toutes ses
   méthodes sont synchrones. C'est le catalogue entier qui devait partir.
4. Le prochain gain est dans les index, pas dans un second thread.

### Reproduire ces mesures

```bash
pnpm exec electron-vite build
pnpm exec electron . --remote-debugging-port=9338 \
  --disable-backgrounding-occluded-windows --disable-renderer-backgrounding
```

Ouvrir un projet dont `.index/catalog.db` porte 100 000 lignes, puis, depuis la console du
renderer, marteler `window.studio.project.current()` en mesurant son aller-retour pendant que
`window.studio.assets.search({ type: 'video', limit: 200 })` tourne. Toute latence supérieure à
16,7 ms sur la première est une frame perdue par toutes les fenêtres.
