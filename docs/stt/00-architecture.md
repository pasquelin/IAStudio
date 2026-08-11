# La dictée — architecture

Dicter un texte au lieu de le taper, entièrement sur la machine de l'utilisateur. Aucune clé,
aucun appel réseau une fois le modèle rapatrié, et rien de ce qui est dit ne quitte l'ordinateur.

Les quatre documents de ce dossier : celui-ci pour les processus et le flux,
[`01-ipc-contract.md`](01-ipc-contract.md) pour les canaux,
[`02-packaging.md`](02-packaging.md) pour ce qui casse en build signée,
[`03-model-management.md`](03-model-management.md) pour les 640 Mo.

---

## Les trois processus, et ce que chacun fait

```
┌─ renderer ──────────────────────────────────────────────────────────┐
│ dictation/capture.ts    getUserMedia(1 canal, EC + NS)              │
│                         AudioContext({ sampleRate: 16000 })          │
│                         AudioWorkletNode ──▶ Float32 par 100 ms      │
│                         rmsOf → le niveau, qui ne traverse rien      │
│                         toInt16 → 1600 échantillons de 16 bits       │
│                              │                                       │
│                              ▼ studio.dictation.push(buffer)         │
├─ processus principal — ORCHESTRATEUR, aucune inférence ─────────────┤
│ dictation/permissions.ts  demande le micro AVANT getUserMedia        │
│ dictation/model-store.ts  où le modèle est, ce qui manque            │
│ dictation/session.ts      la machine à états, 3 redémarrages max,    │
│                           le déchargement après inactivité           │
│ dictation/stt-process.ts  utilityProcess.fork(stt-worker.js)         │
│                              │                                       │
│                              ▼ postMessage                           │
├─ utilityProcess (stt-worker) ───────────────────────────────────────┤
│ Vad(Silero) + OfflineRecognizer(Parakeet TDT v3)                     │
│ serial.ts : un message à la fois                                     │
│ segmenter.ts : tampon borné à 30 s, pré-roll de 500 ms               │
│   toutes les ~700 ms → décodage du segment en cours → `partial`      │
│   le détecteur ferme la phrase → décodage → `final`                  │
│                              │                                       │
│                              ▲ résultats                             │
└─ le principal diffuse `evt:dictation` ──▶ store ──▶ hook ──▶ champ ─┘
```

Le moteur tourne là et nulle part ailleurs : voir
[`ADR-17`](../ci/adr/ADR-17-moteur-de-dictee-hors-processus.md) pour les emplacements envisagés
— le processus principal, un Web Worker du rendu, un `worker_threads` du principal — et pourquoi
chacun a été écarté. **Le décompte appartient à l'ADR, pas à cette note** : elle seule le tient.

---

## Ce que le modèle sait faire, et ce qu'il ne sait pas

**Parakeet TDT 0.6b v3, int8.** Vingt-cinq langues européennes avec détection automatique, et un
texte qui sort **déjà ponctué et capitalisé** — rien ici ne post-traite la ponctuation.

**Il n'est pas *streaming*.** C'est la contrainte qui gouverne tout le reste : sherpa-onnx ne rend
un texte qu'une fois un segment complet accepté. Un aperçu est donc un **décodage complet de tout
ce qui a été dit depuis le début de la phrase**, refait à cadence bornée. Le réglage
« Aperçu pendant que vous parlez » règle cette cadence, et `0` les supprime.

**Il ne dit pas quelle langue il a entendue.** Le champ `lang` du résultat revient vide, mesuré
et non supposé. Il n'y a donc rien à verrouiller et rien à signaler : le réglage « langue
attendue » a été écrit puis retiré, parce qu'un réglage sans effet vaut moins que pas de réglage.

---

## Le pré-roll, et pourquoi le texte définitif ne vient pas du détecteur

Silero a besoin de quelques trames pour être sûr que quelqu'un parle, et il **retire ces
trames** du segment qu'il rend. Fed son propre segment, « Un petit phare » revenait
« Petit phare » — le premier mot, à chaque fois.

Le worker garde donc son propre tampon (`segmenter.ts`), qui remonte 500 ms avant la détection,
et c'est **lui** qui est décodé. Le détecteur ne sert plus qu'à dire *quand* la phrase se termine.

Le tampon est borné à trente secondes : au-delà, l'audio le plus ancien est jeté et l'événement
journalisé. Une file qui ne fait que grandir transforme une machine lente en machine qui
transcrit ce qui a été dit une minute plus tôt.

---

## Deux pièges qui n'existent que dans Electron

Les deux marchaient parfaitement sous Node et cassaient dans le studio.

**Le paquet s'importe par défaut, jamais par ses noms.** `sherpa-onnx-node` est CommonJS et
construit ses exports par accès de propriété (`OfflineRecognizer: non_streaming_asr.OfflineRecognizer`),
ce que l'analyseur CommonJS de Node ne traverse pas. `import { Vad }` compile parfaitement puis
lève `Named export 'Vad' not found` au premier lancement. L'export par défaut de la déclaration
de types (`shared/types/sherpa-onnx-node.d.ts`) porte donc les deux classes qu'on instancie —
`Vad` et `OfflineRecognizer` — et c'est par lui que le worker les atteint à l'exécution.

Les mêmes noms s'importent **en tant que types** par import nommé, ce qui est sans risque : un
`import { type Vad }` disparaît à la compilation et n'atteint jamais Node.

**Le détecteur rend un tampon externe, qu'Electron refuse.** `vad.front()` enveloppe par défaut
la mémoire de l'addon dans un `Float32Array` externe ; Electron lève « External buffers are not
allowed » là où Node l'accepte. `front(false)` demande une copie. Le symptôme n'apparaît qu'au
**premier segment fermé** — donc jamais pendant les aperçus, et jamais hors de l'application.

---

## Un décodage à la fois

`decodeAsync` rend la main pendant l'inférence, ce qui garde le worker réactif — et c'est
précisément ce qui a fait le premier plantage : le chunk suivant commençait à être traité alors
que le précédent était encore dans le moteur, et deux décodages se partageaient un recogniseur
qui n'est pas fait pour.

`serial.ts` enchaîne les messages. Un chunk qui arrive pendant un décodage ne coûte presque rien
quand son tour vient : il est donné au détecteur et gardé, et l'aperçu qui aurait coûté quelque
chose est sauté par son propre cadencement.

---

## Où le texte atterrit

C'est le cœur de « un composant, utilisable partout » : **aucun champ de saisie du studio n'a été
réécrit**.

`dictation/insert-at-caret.ts` écrit dans l'élément qui a le curseur, en passant par le setter
que React a posé sur l'élément, puis en émettant un `input` qui remonte. react-hook-form, les
champs contrôlés par un store et les `<input>` nus l'entendent tous, et aucun ne sait que la
dictée existe.

Le texte va au curseur, remplace la sélection s'il y en a une, laisse le curseur derrière lui et
s'espace du mot précédent. Quand le focus n'est sur aucun champ éditable, la fonction répond
« non » plutôt que de deviner.

**L'aperçu ne va jamais dans le champ.** L'écrire et le réécrire plusieurs fois par seconde
détruirait l'historique d'annulation du champ et ferait re-rendre le formulaire pendant qu'on
essaie de lire. Il s'affiche sous le champ, en atténué.

---

## Le raccourci

`app.dictate`, `⌥D` par défaut, déclaré dans `shared/domain/command.ts` comme les autres. **Un
seul champ** le distingue, `held`, et il porte trois conséquences à lui seul :

- Il **se maintient** au lieu de se déclencher : pressé et relâché, au lieu d'un seul coup.
- Il est entendu par la fenêtre **même en portée `global`**, et **n'a pas de rangée de menu** :
  un accélérateur natif ne rapporte aucun relâchement, donc le menu ne peut pas le servir.
- Il est entendu **alors que le focus est dans un champ**, là où tous les autres raccourcis sont
  coupés — une lettre nue doit atteindre le champ, mais dicter dans le champ où l'on est, c'est
  exactement l'usage. Une commande maintenue porte donc obligatoirement un modificateur.

Un second champ `whileTyping` disait cette dernière ligne séparément. Il valait `true` exactement
quand `held` valait `true`, et deux drapeaux qui ne peuvent pas diverger sont un drapeau.

`useHeldCommand` est monté **une seule fois**, par la coquille : cinq documents à l'écoute
rapporteraient une pression cinq fois.

---

## Les fichiers

| Où | Quoi |
|---|---|
| `shared/domain/dictation.ts` | l'état d'une session, ses refus, le manifeste du modèle, les conversions |
| `shared/types/sherpa-onnx-node.d.ts` | la surface du paquet réellement utilisée, et le piège de l'import |
| `main/dictation/permissions.ts` | demander le micro au système, avant le renderer |
| `main/window/permissions.ts` | le handler de permission de la session — il n'y en avait aucun |
| `main/dictation/model-download.ts` | reprise, empreinte, annulation — sans disque ni réseau, donc testé |
| `main/dictation/model-store.ts` | le disque et le réseau réels |
| `main/dictation/session.ts` | la machine à états et le cycle de vie du moteur |
| `main/dictation/stt-{protocol,client,process,worker}.ts` | le squelette `utilityProcess` |
| `main/dictation/{segmenter,serial}.ts` | le tampon et la file — la logique que le worker n'aurait pas pu tester |
| `renderer/src/dictation/capture.ts` | le micro, le worklet, les chunks |
| `renderer/src/dictation/insert-at-caret.ts` | ce qui fait marcher la dictée partout |
| `renderer/src/dictation/{useDictation,DictationButton,DictationField}` | le hook unique et les deux vues |
| `renderer/src/stores/dictation.ts` | la session vue par la fenêtre |
