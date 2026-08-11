# La dictée — l'empaquetage

Ce document existe pour une raison : **presque tout ce qui suit ne casse qu'en build signée**,
alors que le développement fonctionne parfaitement. C'est le premier endroit où regarder si la
dictée est muette sur une version installée.

---

## Les trois pièces macOS, indissociables

### `NSMicrophoneUsageDescription`

Dans `mac.extendInfo` de `electron-builder.yml`. Sans elle, macOS **tue le processus** au premier
accès au micro, au lieu d'afficher un refus. Ce n'est pas une permission : c'est ce que le
système exige pour seulement *demander*.

**Elle est localisée depuis le 11 août**, et le paragraphe qui suit disait l'inverse. Une chaîne
d'`Info.plist` a besoin d'un `InfoPlist.strings` par langue — electron-builder n'a pas de
fonctionnalité de localisation, mais il sait **placer** les fichiers : `mac.extraResources` copie
`build/lproj/` vers `Contents/Resources/`, et macOS lit le `.lproj` de la langue du lecteur.

« Il n'assemble pas » était vrai ; « donc ce n'est pas localisable » ne l'était pas.

La valeur de `mac.extendInfo` reste la phrase anglaise : c'est le repli pour toute langue sans
`.lproj`. Les deux doivent rester identiques mot pour mot, sinon la même phrase existe en deux
versions selon le chemin qui la sert.

**Ce qui est vérifié, et ce qui ne l'est pas.** Le placement dans le bundle se prouve par
`pnpm exec electron-builder --dir` puis `ls`. Que macOS affiche bien la phrase française **n'est
pas vérifié** : il faudrait une build signée et un déclenchement réel de la permission, et le
projet n'a pas de certificat Apple — voir `ADR-04`. Livré comme une assurance, pas comme un
correctif mesuré.

### `com.apple.security.device.audio-input`

Dans `build/entitlements.mac.plist`. **Ce n'est pas un entitlement d'App Sandbox** — le studio
n'en a pas — mais une clé de la famille *Resource Access* du **hardened runtime**, lequel est
bien activé. Sans elle, une build signée se voit refuser le micro par le runtime.

L'ADR-11 disait le contraire, et son amendement le corrige : voir
[`ADR-11`](../ci/adr/ADR-11-entitlements-macos.md).

Le même fichier sert d'`entitlements` **et** d'`entitlementsInherit`, donc les processus helper
en héritent. C'est nécessaire : celui qui ouvre la capture est le renderer.

### `asarUnpack`

```yaml
asarUnpack:
  - '**/*.node'
  - '**/sherpa-onnx-*/**'
```

La première règle existait pour `better-sqlite3`. Elle ne suffit pas : le moteur livre **quatre
bibliothèques dynamiques** à côté de son `.node` — `libonnxruntime.dylib`,
`libonnxruntime.1.27.0.dylib`, `libsherpa-onnx-c-api.dylib`, `libsherpa-onnx-cxx-api.dylib` — que
le chargeur va chercher par leur nom, sur le disque. Sorti seul, l'addon se charge puis échoue
en cherchant une bibliothèque restée scellée dans l'archive.

**Les `.dylib` ne sont pas listés dans `mac.binaries`.** `@electron/osx-sign` parcourt le bundle
et signe tous les Mach-O qu'il trouve, extension connue comprise ; `mac.binaries` sert aux
fichiers qu'il ne reconnaît pas comme binaires — ffmpeg, qui n'a pas d'extension. Les lister
imposerait d'écrire un chemin contenant la version pnpm du paquet, qui change à chaque montée.

**À vérifier sur la première build signée**, et c'est le seul endroit où ça se voit :

```bash
codesign -vvv --deep --strict "release/mac-arm64/Scenario Studio.app"
spctl -a -vvv "release/mac-arm64/Scenario Studio.app"
```

---

## Ce qui voyage avec l'application

| Quoi | Où | Poids |
|---|---|---|
| Le moteur natif | `node_modules`, sorti de l'asar | 59 Mo (arm64), 65 (x64), 22 (Windows), 31 (Linux) |
| Le détecteur de voix | `extraResources: resources/stt` | 640 Ko |
| **Le modèle de reconnaissance** | **rien : téléchargé à la demande** | 640 Mo |

Le détecteur voyage parce qu'il est petit, et surtout parce qu'il permet d'ouvrir le micro et
d'afficher un niveau **avant** que le gros modèle soit là. Il est rapatrié par `pnpm stt:fetch`,
appelé par `before-pack.mjs` avant chaque cible, sur le modèle exact de `fetch-ffmpeg.mjs` : URL
épinglée, empreinte vérifiée hors du dossier que le moteur lit, et rien de non vérifié n'y arrive.

Le moteur natif **ne peut pas** être téléchargé à l'exécution : la signature et le hardened
runtime exigent qu'il soit signé avec l'application.

---

## Aucun `electron-rebuild`

`sherpa-onnx-node` utilise `node-addon-api`, donc l'ABI N-API, qui est stable d'une version de
Node à l'autre. `pnpm rebuild:native` reste sur `better-sqlite3` seul, et il ne faut **pas** y
ajouter la dictée : ce serait recompiler pour rien un binaire qui n'en a pas besoin.

Le binaire arrive par les `optionalDependencies` du paquet, une par plateforme. Sur une machine
qui installe pour une autre cible, electron-builder embarque celle de la cible.

---

## L'entrée Rollup

```ts
input: {
  index: resolve('src/main/index.ts'),
  'catalog-worker': …,
  'peaks-worker': …,
  'stt-worker': resolve('src/main/dictation/stt-worker.ts'),
}
```

Sans elle, `new URL('./stt-worker.js', import.meta.url)` ne résout rien : le worker est un point
d'entrée à part, posé à côté du main compilé. Le chemin passe par `import.meta.url` et **jamais**
par `__dirname`, qui n'est dans le bundle qu'un shim injecté par Vite pour une dépendance inlinée.

---

## Les licences

Trois entrées que npm ne décrit pas, fabriquées par `collect-licences.mjs` :

- **ONNX Runtime** (MIT, Microsoft) — quatre bibliothèques à l'intérieur des paquets de
  plateforme. Une notice qui ne nommerait que sherpa-onnx attribuerait leur travail à d'autres.
- **Silero VAD** (MIT) — expédié dans `resources/stt/`.
- **Parakeet TDT 0.6b v3** (CC-BY-4.0, NVIDIA) — **pas** expédié, téléchargé par l'utilisateur.
  Listé quand même : CC-BY demande l'attribution partout où l'œuvre est utilisée.

`sherpa-onnx-node` lui-même est collecté comme n'importe quel paquet. Aucun des quatre n'est
copyleft, donc aucune offre de sources n'est due.

**Les quatre sont tenus, et par plusieurs verrous.** `licences.test.ts` exige que chaque entrée de
`licences.json` soit reprise dans la notice, nom, version et licence compris : en retirer une de
`THIRD-PARTY-NOTICES.md` fait échouer la build. `licence.test.ts` en ajoute deux qui valent pour
toutes les entrées — un texte de licence d'au moins vingt caractères, et pas de `spdx` inconnu. Un
seul de ses tests part de `package.json`, et celui-là ne voit en effet que `sherpa-onnx-node`.

**Ce que rien ne tient, c'est l'amont.** Les trois ressources téléchargées ne sont pas des paquets
npm : leurs entrées sont **écrites en dur dans `scripts/collect-licences.mjs`**. Les en retirer
retirerait aussi la ligne de la notice, et les deux tests seraient d'accord — sur une notice
incomplète.

---

## Ce qui reste à vérifier une fois seulement

La dictée a été éprouvée en développement : moteur chargé dans son processus, aperçus pendant la
parole, texte posé au curseur. **Elle n'a pas encore tourné dans une build signée et notarisée**,
faute de certificat sur ce dépôt (ADR-04). C'est le seul point de rupture connu qui reste ouvert,
et les trois pièces macOS ci-dessus sont exactement ce qu'il faut regarder ce jour-là.
