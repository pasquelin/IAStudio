import { Matrix4, PerspectiveCamera, WebGLRenderer } from 'three'
import { createGlTimer, type GlTimer } from './glTimer.js'
import { mean, median, nextFrame, round, since, tally, top } from './benchShared'
import { clockResolution } from './clockProbe'
import { comparePixels, pixelsOf } from './benchShared'
import { DEFAULT_PLAN, openWorld, spanFor, type WorldSpread } from './openWorld'
import { bodiesOf } from './worldBodies'
import { cellAt } from './spatialIndex'
import { cellKey, planCells, type CellKey, type CellPlan } from './cellInstancing'
import { batchedStrategy, cellStrategy, dynamicGridStrategy, regionStrategy, noLayers, type Layers, type Policy, type Strategy } from './partitionStrategies'
import { trajectoriesFor } from './trajectories'

/**
 * C5-B1 : le duel. Trois façons de peupler la même scène, les mêmes trajectoires, le même harnais.
 *
 * 🛑 Le banc mesure sa propre horloge avant tout : plusieurs critères de C5-B0 tombent sous les
 * 100 µs auxquels une page ordinaire est clampée. `run.mjs` sert la page en isolation
 * cross-origin ; la résolution obtenue est écrite dans chaque rapport et un GO/NO-GO sur la petite
 * scène ne veut rien dire sans elle.
 */

const WIDTH = 1600
const HEIGHT = 900
const QUERY = new URLSearchParams(location.search)
/** Dix frames suffisent à sortir du premier dessin ; trente ne changeaient que la durée. */
const WARMUP = 10

const percentile = (values: number[], share: number): number => {
  const sorted = [...values].sort((one, other) => one - other)
  return round(sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0)
}

type Numbers = Record<string, number | string | boolean | null>

type Frame = { layers: Layers; submitMs: number; gpu: number[]; calls: number; triangles: number; instances: number }

function drawOnce(
  renderer: WebGLRenderer,
  strategy: Strategy,
  camera: PerspectiveCamera,
  radius: number,
  timer: GlTimer | null,
): Frame {
  const layers = strategy.prepare(camera, radius)
  const before = tally()
  timer?.begin()
  const submitAt = performance.now()
  renderer.render(strategy.scene, camera)
  const submitMs = performance.now() - submitAt
  timer?.end()
  return { layers, submitMs, gpu: timer?.collect() ?? [], ...since(before) }
}

const totalOf = (frame: Frame): number =>
  frame.layers.spatialQuery + frame.layers.activeSetUpdate + frame.layers.visibility + frame.submitMs

/** Ce qu'une série de frames dit, sans jamais lisser un pic. */
function fold(prefix: string, frames: Frame[]): Numbers {
  const totals = frames.map(totalOf)
  const gpu = frames.flatMap(frame => frame.gpu)
  const pick = (read: (frame: Frame) => number): number[] => frames.map(read)
  return {
    [`${prefix}TotalMeanMs`]: round(mean(totals)),
    [`${prefix}TotalP95Ms`]: percentile(totals, 0.95),
    [`${prefix}TotalP99Ms`]: percentile(totals, 0.99),
    [`${prefix}TotalPeakMs`]: round(top(totals)),
    [`${prefix}QueryMeanMs`]: round(mean(pick(frame => frame.layers.spatialQuery))),
    [`${prefix}ActiveSetMeanMs`]: round(mean(pick(frame => frame.layers.activeSetUpdate))),
    [`${prefix}ActiveSetPeakMs`]: round(top(pick(frame => frame.layers.activeSetUpdate))),
    [`${prefix}VisibilityMeanMs`]: round(mean(pick(frame => frame.layers.visibility))),
    [`${prefix}SubmitMeanMs`]: round(mean(pick(frame => frame.submitMs))),
    [`${prefix}GpuMs`]: gpu.length > 0 ? round(median(gpu)) : null,
    [`${prefix}Calls`]: Math.round(median(pick(frame => frame.calls))),
    [`${prefix}Instances`]: Math.round(median(pick(frame => frame.instances))),
    [`${prefix}InstancesPeak`]: top(pick(frame => frame.instances)),
    [`${prefix}Triangles`]: Math.round(median(pick(frame => frame.triangles))),
    [`${prefix}NodesVisited`]: Math.round(median(pick(frame => frame.layers.nodesVisited))),
    [`${prefix}NodesPeak`]: top(pick(frame => frame.layers.nodesVisited)),
    [`${prefix}CellsActive`]: Math.round(median(pick(frame => frame.layers.cellsActive))),
    [`${prefix}CellsEnteredPeak`]: top(pick(frame => frame.layers.cellsEntered)),
    [`${prefix}MeshesBuiltPeak`]: top(pick(frame => frame.layers.meshesBuilt)),
  }
}

/** Combien de frames il a fallu pour que le coût retombe sous deux fois le régime de repos. */
const convergedAt = (frames: Frame[], restMs: number): number => {
  for (const [at, frame] of frames.entries()) {
    if (totalOf(frame) <= restMs * 2) return at + 1
  }
  return frames.length
}

async function runOne(
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  strategy: Strategy,
  plan: CellPlan | null,
  radius: number,
  span: number,
  seed: number,
  dynamicShare: number,
): Promise<Numbers> {
  const canvas = renderer.domElement
  const gl = canvas.getContext('webgl2')
  const timer = gl ? createGlTimer(gl as WebGL2RenderingContext) : null

  const paths = trajectoriesFor({ span, far: radius, seed, boundaryAt: 347.851 })
  const aim = (pose: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }): void => {
    camera.position.set(pose.position.x, pose.position.y, pose.position.z)
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
    camera.updateMatrixWorld()
  }

  aim(paths[0]?.poseAt(0) ?? { position: { x: 0, y: 2, z: 0 }, target: { x: 1, y: 2, z: 0 } })
  for (let frame = 0; frame < WARMUP; frame += 1) {
    drawOnce(renderer, strategy, camera, radius, null)
    await nextFrame()
  }

  const out: Numbers = { strategy: strategy.name, ...strategy.facts() }
  let restMs = 0
  for (const path of paths) {
    if (path.warmFrom) {
      aim(path.warmFrom.pose)
      for (let frame = 0; frame < path.warmFrom.frames; frame += 1) {
        drawOnce(renderer, strategy, camera, radius, null)
        await nextFrame()
      }
    }
    const frames: Frame[] = []
    for (let at = 0; at < path.frames; at += 1) {
      aim(path.poseAt(at))
      frames.push(drawOnce(renderer, strategy, camera, radius, timer))
      await nextFrame()
    }
    Object.assign(out, fold(path.name, frames))
    if (path.name === 'rest') restMs = mean(frames.map(totalOf))
    if (path.name === 'teleport') out['teleportConvergedFrames'] = convergedAt(frames, restMs)
  }

  // ── le scénario dynamique : 1 % des corps bougent chaque frame, assez pour changer de cellule
  if (plan && dynamicShare > 0) {
    const many = Math.round(plan.bodies.count * dynamicShare)
    const moving = Array.from({ length: many }, (_unused, at) => Math.floor((at * 7919) % plan.bodies.count))
    aim(paths[0]?.poseAt(0) ?? { position: { x: 0, y: 2, z: 0 }, target: { x: 1, y: 2, z: 0 } })
    const updates: number[] = []
    const changes: number[] = []
    const rebuilds: number[] = []
    const frames: Frame[] = []
    for (let at = 0; at < 120; at += 1) {
      const fromKeys: CellKey[] = []
      for (const slot of moving) {
        const before = cellAt(plan, plan.bodies.at[slot * 3] ?? 0, plan.bodies.at[slot * 3 + 2] ?? 0)
        fromKeys.push(cellKey(before.cx, before.cz))
        // Un pas de la vitesse « course » de C5-B0 : 1 m par frame, donc une cellule de 128 se
        // traverse en 128 frames et les changements arrivent en régime permanent.
        plan.bodies.at[slot * 3] = (plan.bodies.at[slot * 3] ?? 0) + 1
      }
      const movedAt = performance.now()
      const moved = strategy.moveBodies(moving, fromKeys)
      updates.push(performance.now() - movedAt)
      changes.push(moved.changed)
      rebuilds.push(moved.rebuilt)
      frames.push(drawOnce(renderer, strategy, camera, radius, timer))
      await nextFrame()
    }
    // ── spawn : 200 mobiles créés et 200 détruits par frame, ce qu'un jeu fait vraiment
    if (strategy.dynamics) {
      const layer = strategy.dynamics
      const spawnCost: number[] = []
      const spawnFrames: Frame[] = []
      const alive: { lot: number; id: number }[] = []
      const pose = new Matrix4()
      for (let at = 0; at < 120; at += 1) {
        const spawnAt = performance.now()
        for (let made = 0; made < 200; made += 1) {
          const lot = made % layer.meshes.length
          pose.makeTranslation(((made * 37) % 200) - 100, 1, ((made * 53) % 200) - 100)
          const id = layer.add(lot, pose)
          if (id >= 0) alive.push({ lot, id })
        }
        for (let gone = 0; gone < 200 && alive.length > 0; gone += 1) {
          const last = alive.pop()
          if (last) layer.remove(last.lot, last.id)
        }
        layer.flush()
        spawnCost.push(performance.now() - spawnAt)
        spawnFrames.push(drawOnce(renderer, strategy, camera, radius, timer))
        await nextFrame()
      }
      Object.assign(out, fold('spawn', spawnFrames), {
        spawnPerFrame: 200,
        spawnCostMeanMs: round(mean(spawnCost)),
        spawnCostP99Ms: percentile(spawnCost, 0.99),
        spawnCostPeakMs: round(top(spawnCost)),
      })
    }

    Object.assign(out, fold('dynamic', frames), {
      dynamicBodies: many,
      dynamicUpdateMeanMs: round(mean(updates)),
      dynamicUpdateP99Ms: percentile(updates, 0.99),
      dynamicUpdatePeakMs: round(top(updates)),
      dynamicCellChangesMean: Math.round(mean(changes)),
      dynamicRebuiltMeshesMean: Math.round(mean(rebuilds)),
      dynamicRebuiltMeshesPeak: top(rebuilds),
    })
  }

  timer?.dispose()
  return out
}

/**
 * Le repos seul, mesuré en ALTERNANCE entre stratégies.
 *
 * 🛑 Trois passes séparées ont donné 0,318 · 0,105 · 0,188 ms pour le MÊME natif — un facteur 3.
 * À ces durées la dérive entre passes (fréquence, ordonnancement, thermique) dépasse l'écart qu'on
 * cherche à lire, et la stratégie mesurée en premier porte tout le démarrage. Alterner dans un
 * seul processus est la seule façon de comparer : chaque cycle rejoue les trois, dans l'ordre, et
 * c'est la médiane des cycles qui parle.
 */
async function restOnly(
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  strategy: Strategy,
  radius: number,
  span: number,
  frames: number,
): Promise<{ total: number; instances: number; calls: number; gpu: number; nodes: number }> {
  const gl = renderer.domElement.getContext('webgl2')
  const timer = gl ? createGlTimer(gl as WebGL2RenderingContext) : null
  const pose = trajectoriesFor({ span, far: radius, seed: DEFAULT_PLAN.seed, boundaryAt: 347.851 })[0]?.poseAt(0)
  if (pose) {
    camera.position.set(pose.position.x, pose.position.y, pose.position.z)
    camera.lookAt(pose.target.x, pose.target.y, pose.target.z)
    camera.updateMatrixWorld()
  }
  for (let frame = 0; frame < WARMUP; frame += 1) {
    drawOnce(renderer, strategy, camera, radius, null)
    await nextFrame()
  }
  const taken: Frame[] = []
  for (let frame = 0; frame < frames; frame += 1) {
    taken.push(drawOnce(renderer, strategy, camera, radius, timer))
    await nextFrame()
  }
  timer?.dispose()
  const gpu = taken.flatMap(one => one.gpu)
  return {
    total: round(mean(taken.map(totalOf))),
    instances: Math.round(median(taken.map(one => one.instances))),
    calls: Math.round(median(taken.map(one => one.calls))),
    gpu: gpu.length > 0 ? round(median(gpu)) : 0,
    nodes: Math.round(median(taken.map(one => one.layers.nodesVisited))),
  }
}

export type Step = { phase: string }

export async function runPartitionBench(
  onProgress?: (step: Step) => void,
): Promise<{ results: unknown[]; failures: unknown[] }> {
  const counts = (QUERY.get('counts') ?? '500000').split(',').map(Number)
  const spreads = (QUERY.get('spreads') ?? 'uniform').split(',') as WorldSpread[]
  const radius = Number(QUERY.get('far') ?? 500)
  const cellSizes = (QUERY.get('cells') ?? '128').split(',').map(Number)
  const kinds = (QUERY.get('kinds') ?? 'regions,grid,quadtree').split(',')
  const policies = (QUERY.get('policies') ?? 'prebuild').split(',') as Policy[]
  const macroSize = Number(QUERY.get('macro') ?? 512)
  const looseness = Number(QUERY.get('loose') ?? 1)
  const dynamicShare = Number(QUERY.get('dynamic') ?? 0)

  const cycles = Number(QUERY.get('cycles') ?? 0)

  const stage = document.querySelector('#stage')
  if (!stage) throw new Error('no #stage')
  const host = document.createElement('div')
  host.style.width = `${WIDTH}px`
  host.style.height = `${HEIGHT}px`
  stage.append(host)

  const renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(1)
  renderer.setSize(WIDTH, HEIGHT, false)
  host.append(renderer.domElement)
  const camera = new PerspectiveCamera(60, WIDTH / HEIGHT, 0.1, radius)

  const clock = clockResolution()
  const results: Numbers[] = []
  const failures: unknown[] = []

  try {
    if (cycles > 0) {
      // 🛑 Les stratégies sont construites UNE fois et gardées. Les détruire entre deux mesures
      // rendait 6 075 `InstancedMesh` au ramasse-miettes à chaque tour, dont le passage tombait
      // DANS la fenêtre suivante : six cycles donnaient alors des plages qui se recouvraient
      // toutes (natif 0,121–0,382, grille 0,315–0,895) et ne décidaient rien.
      const held: { label: string; count: number; span: number; strategy: Strategy }[] = []
      const builtIn = new Map<string, number>()
      const shots = new Map<string, ImageData>()
      const pngs = new Map<string, string>()
      for (const count of counts) {
        const state = openWorld({ ...DEFAULT_PLAN, count, spread: spreads[0] ?? 'uniform' })
        const { bodies, lots } = bodiesOf(state)
        const span = spanFor(count)
        for (const kind of kinds) {
          onProgress?.({ phase: `construction ${count} ${kind}…` })
          const madeAt = performance.now()
          // 🛑 Un plan PAR stratégie. Partagé, les deux candidats tiennent les mêmes `Group`, et
          // un `Group` n'appartient qu'à une scène : le second construit VOLAIT les cellules du
          // premier, qui dessinait alors zéro instance en 0,043 ms — un résultat qui se lisait
          // comme une victoire écrasante.
          const made = {
            label: `${count}:${kind}`,
            count,
            span,
            strategy:
              kind === 'regions'
                ? regionStrategy(bodies, lots)
                : kind === 'batched' || kind === 'batchedCulled'
                ? batchedStrategy(planCells(bodies, lots, cellSizes[0] ?? 256), lots, macroSize, kind === 'batchedCulled')
                : cellStrategy(
                    planCells(bodies, lots, cellSizes[0] ?? 256),
                    kind === 'grid' ? 'grid' : 'quadtree',
                    policies[0] ?? 'prebuild',
                    macroSize,
                    looseness,
                  ),
          }
          made.strategy.facts()
          builtIn.set(made.label, round(performance.now() - madeAt))
          held.push(made)
        }
      }
      try {
        for (let cycle = 0; cycle < cycles; cycle += 1) {
          for (const one of held) {
            onProgress?.({ phase: `cycle ${cycle + 1}/${cycles} · ${one.label}` })
            const seen = await restOnly(renderer, camera, one.strategy, radius, one.span, 60)
            // 🛑 L'image, prise DANS LA FOULÉE du dessin. Trois défauts majeurs de ce chantier
            // n'ont été vus que par les pixels ; le compteur muet de `BatchedMesh` en est le
            // quatrième, et une capture l'aurait montré avant les chiffres.
            if (cycle === 0) {
              renderer.render(one.strategy.scene, camera)
              shots.set(one.label, pixelsOf(renderer.domElement))
              pngs.set(one.label, renderer.domElement.toDataURL('image/png'))
            }
            results.push({
              cycle: cycle + 1,
              count: one.count,
              kind: one.strategy.name.split(':')[0] ?? one.strategy.name,
              cellSize: cellSizes[0] ?? 256,
              far: radius,
              clockIsolated: clock.isolated,
              clockStepMs: round(clock.smallestStepMs),
              ...one.strategy.facts(),
              strategyBuildMs: builtIn.get(one.label) ?? 0,
              restTotalMeanMs: seen.total,
              restInstances: seen.instances,
              restCalls: seen.calls,
              restGpuMs: seen.gpu,
              restNodesVisited: seen.nodes,
            })
            ;(globalThis as unknown as { __partial: unknown }).__partial = { results, failures }
          }
        }
      } finally {
        for (const one of held) one.strategy.dispose()
      }
      // Chaque variante comparée au TÉMOIN de son monde : une partition qui dessine autre chose
      // que ce que le moteur actuel dessine n'a pas gagné, elle a perdu des objets.
      const images: Record<string, unknown>[] = []
      for (const [label, pixels] of shots) {
        const witness = shots.get(`${label.split(':')[0]}:regions`)
        images.push({
          label,
          againstWitness: witness && witness !== pixels ? comparePixels(pixels, witness, 12) : null,
          png: pngs.get(label) ?? null,
        })
      }
      return { results: [...results, { images }], failures }
    }

    for (const count of counts) {
      for (const spread of spreads) {
        onProgress?.({ phase: `monde ${count} ${spread}` })
        const state = openWorld({ ...DEFAULT_PLAN, count, spread })
        const { bodies, lots } = bodiesOf(state)
        const span = spanFor(count)

        for (const cellSize of cellSizes) {
          const planAt = performance.now()
          const plan = planCells(bodies, lots, cellSize)
          const planMs = performance.now() - planAt

          for (const kind of kinds) {
            for (const policy of kind === 'regions' ? ['prebuild' as Policy] : policies) {
              onProgress?.({ phase: `${count} ${spread} · cell ${cellSize} · ${kind}:${policy}` })
              let strategy: Strategy | null = null
              try {
                const madeAt = performance.now()
                const movingSlots =
                  dynamicShare > 0
                    ? Array.from({ length: Math.round(bodies.count * dynamicShare) }, (_unused, at) =>
                        Math.floor((at * 7919) % bodies.count),
                      )
                    : []
                strategy =
                  kind === 'gridDynamic'
                    ? dynamicGridStrategy(plan, lots, macroSize, movingSlots)
                    : kind === 'regions'
                    ? regionStrategy(bodies, lots)
                    : kind === 'batched'
                      ? batchedStrategy(plan, lots, macroSize)
                      : cellStrategy(plan, kind === 'grid' ? 'grid' : 'quadtree', policy, macroSize, looseness)
                const buildMs = performance.now() - madeAt
                const row = await runOne(renderer, camera, strategy, kind === 'regions' ? null : plan, radius, span, DEFAULT_PLAN.seed, kind === 'regions' ? 0 : dynamicShare)
                results.push({
                  count,
                  spread,
                  cellSize,
                  kind,
                  policy,
                  far: radius,
                  macroSize,
                  looseness,
                  bodies: bodies.count,
                  span: Math.round(span),
                  planMs: round(planMs),
                  buildMs: round(buildMs),
                  clockIsolated: clock.isolated,
                  clockStepMs: round(clock.smallestStepMs),
                  ...row,
                })
              } catch (error) {
                failures.push({ count, spread, cellSize, kind, policy, error: String(error), stack: String((error as Error)?.stack ?? '') })
              } finally {
                strategy?.dispose()
              }
              ;(globalThis as unknown as { __partial: unknown }).__partial = { results, failures }
            }
          }
        }
      }
    }
  } finally {
    renderer.dispose()
    host.remove()
  }
  return { results, failures }
}
