# Spike — Three.js `WebGLRenderer` contre `WebGPURenderer`

Mesuré le 2026-09-01 sur MacBook **Apple M2 Max**, Electron 43.4.0 / Chromium 150, three 0.185.1.
Fenêtre visible, 1600×900, `pixelRatio` 1, `backgroundThrottling` désactivé.
46 mesures, aucun échec. Chaque cas : 40 frames de chauffe, 200 frames chronométrées,
60 frames supplémentaires pour l'horloge GPU.

**Aucune ligne de `src/` n'a été modifiée.** Le banc vit dans `spike/webgpu/` et construit ses
propres scènes ; le second volet mesure le vrai `SceneRenderer` sans le monter.

## Comment lire ces chiffres

- L'écran est à **120 Hz**. Deux cas à 120,5 FPS ne se départagent pas par le FPS mais par
  `cpuRender` et `gpu` — c'est là que se trouve la marge.
- `cpuSync` est le même code JavaScript des deux côtés : il ne dépend d'aucun backend.
- Le temps GPU vient de `EXT_disjoint_timer_query_webgl2` d'un côté et de `timestamp-query` de
  l'autre, tous deux disponibles sur cette machine. Il se prend dans une passe SÉPARÉE parce que
  `resolveTimestampsAsync` doit être attendu frame par frame, ce qui fausserait le FPS.
- La mémoire est le **tas JS** (`performance.memory`), jamais la VRAM, qu'aucune API du web ne
  publie. Elle est dominée par le rythme du ramasse-miettes : à traiter comme un ordre de
  grandeur, pas comme une mesure.
- Reproductibilité vérifiée sur 8 cas rejoués : écart de 2 à 8 %, sauf `webgl/dynamic-mesh@10000`
  à −39 %. Les rapports structurels de 2,5× à 7× sont hors de ce bruit.

## Ce que le banc a mesuré

Le détail complet est dans `results.json` ; `node report.mjs` le remet en tableaux.
Les cas où le backend se voit — ceux qui tombent sous 115 FPS :

| scénario | objets | FPS GL | FPS WGPU | CPU rendu GL | CPU rendu WGPU | GPU GL | GPU WGPU |
|---|---:|---:|---:|---:|---:|---:|---:|
| static-mesh | 10 000 | 102,0 | 42,4 | 9,7 ms | 13,7 ms | 1,26 ms | 0,62 ms |
| static-mesh | 50 000 | 12,8 | 2,3 | 77,9 ms | 103,8 ms | 3,71 ms | 2,29 ms |
| dynamic-mesh | 10 000 | 63,7 | 26,0 | 13,7 ms | 34,3 ms | 0,93 ms | 0,59 ms |
| dynamic-mesh | 50 000 | 10,5 | 1,9 | 82,7 ms | **514,6 ms** | 2,97 ms | 1,84 ms |
| lights-shadows | 1 000 | 120,5 | 77,5 | 3,5 ms | 12,7 ms | 1,34 ms | 2,03 ms |
| lights-shadows | 10 000 | 28,6 | 6,0 | 34,1 ms | 163,4 ms | 3,79 ms | 2,59 ms |
| lights-shadows | 50 000 | 4,4 | 0,6 | 215,9 ms | **1547,1 ms** | 11,94 ms | 10,62 ms |
| raycast | 10 000 | 54,9 | 27,9 | 9,6 ms | 15,4 ms | 1,06 ms | 0,59 ms |
| raycast | 50 000 | 4,4 | 2,2 | 65,4 ms | 104,6 ms | 2,84 ms | 1,90 ms |

Tous les autres cas — instancing aux trois tailles, skinning aux trois tailles, la scène
représentative et le post-traitement — tiennent **120,5 FPS des deux côtés**.

## Le coût de synchronisation, hors GPU

`SceneRenderer.apply`, renderer non monté, médiane sur 12 passes :

| nœuds | 1er apply | rien ne change | 1 seul nœud bougé | tous bougent | recomposition du tableau |
|---:|---:|---:|---:|---:|---:|
| 1 000 | 24,5 ms | 0,24 ms | 0,38 ms | 0,66 ms | 0,01 ms |
| 10 000 | 132 ms | 1,58 ms | 1,64 ms | 11,4 ms | 0,10 ms |
| 50 000 | 641 ms | 9,74 ms | 11,58 ms | 87,0 ms | 0,48 ms |

Ventilation, un seul nœud bougé (instrumentée sur le prototype : les absolus sont gonflés d'un
facteur ≈ 2,2 par les enveloppes, les proportions tiennent) :

| sous-passe | 10 000 | 50 000 | appels par frame |
|---|---:|---:|---:|
| `hangFromParent` | 0,71 ms | 7,36 ms | N |
| `syncNode` | 0,78 ms | 4,13 ms | N |
| `tuneShadowsIfMoved` | 0,29 ms | 2,05 ms | 1 |
| tout le reste cumulé | 0,30 ms | 1,41 ms | 1 |

## Ce qu'il faut retenir

**Le GPU n'est jamais le goulot.** Sur le pire cas du banc — 50 000 objets et trois cartes
d'ombre, 200 698 draw calls — la carte passe **11,9 ms** pendant que le CPU en passe **215,9**.
Un facteur 18. Partout ailleurs le GPU reste sous 4 ms.

**WebGPU coûte plus cher côté CPU, de 1,2× à 7,2×.** Il économise du temps GPU au-delà de
10 000 objets (0,5× à 0,67×), mais c'est du temps dont personne ne manque.

**L'instancing efface la question.** 50 000 objets instanciés : 1 draw call, 120 FPS, CPU de
rendu à 0,1 ms — identique sur les deux backends.
