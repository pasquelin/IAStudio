# La dictée — les canaux

Tout passe par `src/shared/ipc.ts`, comme les soixante autres canaux. Rien de spécifique à la
dictée n'a été inventé ici : la table de `main/ipc/handle.ts` réclame son entrée avant que le
premier handler compile, et le preload expose une ligne par méthode.

---

## Huit canaux, un événement

| Canal | Méthode du pont | Ce qu'il fait |
|---|---|---|
| `dictation:state` | `state()` | l'état tel qu'il est, pour une fenêtre arrivée après coup |
| `dictation:start` | `start()` | demande le micro, charge le moteur, ouvre la session |
| `dictation:stop` | `stop()` | ferme la phrase en cours — elle est transcrite |
| `dictation:cancel` | `cancel()` | jette la phrase en cours — elle ne l'est pas |
| `dictation:push` | `push(chunk)` | 100 ms d'audio, dix fois par seconde |
| `dictation:download-model` | `downloadModel()` | rapatrie les 640 Mo |
| `dictation:cancel-download` | `cancelDownload()` | arrête le téléchargement |
| `dictation:open-privacy` | `openPrivacySettings()` | ouvre l'écran système du micro |
| `evt:dictation` | `onEvent(cb)` | tout ce que la session a à dire |

**Push et pull ensemble**, comme la mise à jour : `state()` répond ce qui est vrai maintenant,
`onEvent` dit ce qui change. Une fenêtre ouverte pendant un téléchargement apprend les deux — il
n'y a pas d'événement suivant une fois le téléchargement fini.

---

## L'état d'une session

```ts
type SttState =
  | 'idle'                // rien ne tourne
  | 'permissionRequired'  // le système a dit non
  | 'modelMissing'        // le moteur est là, le modèle non
  | 'downloadingModel'
  | 'loadingEngine'       // 640 Mo à lire, quelques secondes
  | 'ready'               // le moteur est chargé et attend
  | 'listening'
  | 'error'
```

Des chaînes plates plutôt qu'une union discriminée : ce qu'une erreur ou un téléchargement
porte voyage dans `SttSnapshot` à côté, ce qui permet à `state()` de tout rendre en une lecture.

```ts
type SttSnapshot = {
  state: SttState
  download: { received: number; total: number } | null
  failure: { code: SttErrorCode; message: string } | null
}
```

Les six refus possibles : `permissionDenied`, `noInputDevice`, `modelDownloadFailed`,
`modelChecksumMismatch`, `engineCrashed`, `unsupportedPlatform`.

**L'interface montre le code traduit, jamais le message.** Le message nomme un chemin de fichier
ou un symbole ONNX : il part au journal du processus principal, où il est la seule chose qui
explique la panne. Le garde `bundles.test.ts` vérifie que les six codes ont leur phrase dans les
deux langues.

---

## Les événements

```ts
type SttEvent =
  | { type: 'state'; state: SttState }
  | { type: 'partial'; text: string }               // hypothèse, remplacée
  | { type: 'final'; text: string; latencyMs: number }  // phrase figée
  | { type: 'download'; progress: { received: number; total: number } }
  | { type: 'error'; failure: SttFailure }
```

**Le niveau d'entrée n'est pas un événement.** Il est mesuré dans le worklet, qui tient déjà les
échantillons : l'envoyer au processus principal pour qu'il le renvoie coûterait deux traversées
cent fois par minute pour apprendre à la fenêtre ce qu'elle savait la première.

`final` ne porte pas de langue : le modèle n'en rend aucune (voir
[`00-architecture.md`](00-architecture.md)).

---

## Le canal qui porte l'audio

C'est le seul du studio appelé dix fois par seconde, et le seul qu'une fenêtre compromise
pourrait inonder.

**Un `invoke` qui rend `Promise<void>`, pas un `send`.** Le projet n'expose aucun `send` : même
le fire-and-forget (`diagnostics.report`) passe par `invoke`, et on n'ouvre pas un second
mécanisme de frontière pour dix appels par seconde de 3,2 Ko.

**Ce qui arrive est vérifié** (`main/dictation/validation.ts`) : un `ArrayBuffer`, de longueur
paire, pas plus long que deux fois ce que la capture envoie. Ce n'est pas zod comme partout
ailleurs, et c'est écrit pourquoi — zod décrirait un `ArrayBuffer` comme `unknown` et le rendrait
tel quel.

**Un chunk refusé est abandonné en silence**, jamais levé : le canal est un « envoie et oublie »,
et une exception réglerait une promesse que personne n'attend pendant que le micro continue.

---

## Vers le worker

Un protocole à part (`stt-protocol.ts`), qui ne traverse pas la frontière renderer.

**Entrées** : `{ load, …chemins et réglages }`, `{ audio: Int16Array }`, `{ flush }`,
`{ cancel }`, `{ unload }`.
**Sorties** : `{ ready }` puis `{ partial }`, `{ final }`, `{ dropped }`, `{ failed }`.

Le worker reçoit des **chemins**, jamais des poids : le modèle fait 640 Mo sur le disque, et le
faire traverser une frontière coûterait plus cher que de le charger deux fois.

L'audio traverse en **16 bits** plutôt qu'en flottants : cela divise par deux ce qui est copié
cent fois par minute, et un micro n'a de toute façon pas seize bits de dynamique réelle.

`{ ready }` est une **poignée de main** : rien d'autre n'est accepté avant. Lire 640 Mo peut
échouer, et ça doit échouer à l'ouverture plutôt qu'à la première phrase — c'est ce que
`catalog-thread` attend déjà pour sa base.

---

## Le cycle de vie

```
premier start()      fork du utilityProcess, load, ready        ~3,5 s
sessions suivantes   le moteur est déjà là                      immédiat
10 min sans dicter   le moteur est relâché, ~700 Mo rendus       réglable, 0 = jamais
plantage             engineCrashed, 3 redémarrages au plus
quitter le studio    dispose(), sans être attendu
```

Le fork est **paresseux et oublié à sa mort**, comme le process des formes d'onde : une session
qui ne dicte jamais ne paie rien, et un moteur qui meurt coûte la phrase en cours, pas la session.
