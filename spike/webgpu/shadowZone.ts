import { Group } from 'three'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { SceneRenderer, type PartitionMode } from '@/engines/scene/SceneRenderer'
import { directionalLight, meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type MeshNode, type SceneNode, type SceneState } from '@/engines/scene/sceneState'
import { WORTH_INSTANCING } from '@/engines/scene/grouping'
import { comparePixels, nextFrame, pixelsOf, round, sunOf } from './benchShared'

/**
 * C5-P1, contrôle des OMBRES : un corps haut juste hors du champ, dont l'ombre tombe dedans.
 *
 * 🛑 `WebGLShadowMap.renderObject` sort sur `object.visible === false` et teste `object.layers`
 * contre la caméra DE VUE. Ni l'un ni l'autre ne sépare la passe couleur de la passe d'ombre : ce
 * que le rejet par boîte cache au frustum de la caméra, il le cache aussi à la lumière. Ce banc
 * mesure si cela SE VOIT, plutôt que de le déduire.
 */

const WIDTH = 1200
const HEIGHT = 700
const QUERY = new URLSearchParams(location.search)

/** Assez pour que le regroupement s'enclenche : sous le plancher, rien n'est groupé et le flag ne
 * change rien du tout. C'est le premier piège de ce décor. */
const PILLARS = 2 * WORTH_INSTANCING

/** Le sol, en dalles : un plan unique resterait dessiné où que la caméra regarde. */
function ground(): MeshNode[] {
  const nodes: MeshNode[] = []
  for (let row = -3; row <= 3; row += 1) {
    for (let column = -3; column <= 3; column += 1) {
      const base = meshNode(`tile_${row}_${column}`)
      nodes.push({
        ...base,
        material: { ...base.material, color: '#6a6f65', roughness: 0.9, metalness: 0 },
        transform: {
          position: { x: column * 100, y: -0.5, z: row * 100 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 100, y: 1, z: 100 },
        },
      })
    }
  }
  return nodes
}

/**
 * Le décor : des piliers hauts groupés de CÔTÉ, et un soleil haut placé en +z qui jette leur
 * ombre vers -z, donc dans l'axe où la caméra regarde.
 */
function stage(): SceneState {
  const light = directionalLight('sun')
  const sun: SceneNode = {
    ...light,
    castShadow: true,
    transform: { ...light.transform, position: { x: 0, y: 110, z: 330 } },
  }

  const pillars: MeshNode[] = []
  for (let at = 0; at < PILLARS; at += 1) {
    const base = meshNode(`pillar${at}`)
    pillars.push({
      ...base,
      material: { ...base.material, color: '#b9b2a4', roughness: 0.8, metalness: 0 },
      // 🛑 Franchement de côté (78° hors de l'axe) et assez HAUT pour que l'ombre revienne à 30°,
      // dans le champ. Le placement est serré : la boîte d'un corps est grossie de son rayon de
      // sphère fois l'étirement, soit 76 unités pour ces piliers — un décor calé à un degré près
      // ne rejetait jamais rien, et le contrôle rendait « 0 différent » sans rien mesurer.
      transform: {
        position: { x: 50 + (at % 4) * 7, y: 43.5, z: 290 + Math.floor(at / 4) * 7 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 5, y: 87, z: 5 },
      },
    })
  }

  return { ...EMPTY_SCENE, nodes: [sun, ...ground(), ...pillars] }
}

function hostOf(): HTMLDivElement {
  const stageAt = document.querySelector('#stage')
  if (!stageAt) throw new Error('no #stage')
  stageAt.replaceChildren()
  const host = document.createElement('div')
  host.style.width = `${WIDTH}px`
  host.style.height = `${HEIGHT}px`
  stageAt.append(host)
  return host
}

/** Les caps balayés, en degrés : la caméra tourne sur place et les piliers sortent du champ. */
const HEADINGS = [0, 10, 20, 30, 40, 50, 60]

const lightState: Record<string, number | boolean | null>[] = []

type Shot = {
  heading: number
  pixels: ImageData
  hidden: number
  drawn: number
  pillarDrawn: boolean | null
}

async function sweep(mode: PartitionMode, shadows = true): Promise<Shot[]> {
  const host = hostOf()
  const renderer = new SceneRenderer({
    onSelect: () => {},
    onTransform: () => {},
    partition: mode,
    loadModel: async () => new Group(),
  })
  renderer.prepareOffscreen({ alpha: false, pixelRatio: 1 })
  renderer.mount(host)
  renderer.configure({ ...DEFAULT_SETTINGS.three, showGrid: false, shadows })
  const canvas = host.querySelector('canvas')
  if (!canvas) throw new Error('the engine mounted no canvas')

  renderer.apply(stage())

  // Ce que la lumière EST après `apply`, plutôt que ce qu'on croit avoir demandé : une caméra
  // d'ombre de dix unités de large sur un décor de sept cents ne jette rien qu'on puisse voir.
  const sun = sunOf(renderer['viewport'].scene)
  const gl = renderer['viewport'].gl
  lightState.push({
    asked: shadows,
    castShadow: sun?.castShadow ?? null,
    shadowRight: sun?.shadow?.camera?.right ?? null,
    shadowFar: sun?.shadow?.camera?.far ?? null,
    mapSize: sun?.shadow?.mapSize?.width ?? null,
    shadowMapEnabled: gl?.shadowMap.enabled ?? null,
    shadowMapAuto: gl?.shadowMap.autoUpdate ?? null,
  })

  const shots: Shot[] = []
  for (const heading of HEADINGS) {
    const angle = (heading * Math.PI) / 180
    // 🛑 La cible à TRENTE unités, pas à une : à un mètre devant, une caméra posée à douze pique
    // de soixante-trois degrés et regarde le sol sous elle — rien du décor n'entre dans le champ,
    // et toutes les comparaisons rendent « 0 différent ».
    renderer.placeView({
      position: { x: 0, y: 12, z: 0 },
      target: { x: 30 * Math.cos(angle), y: 8, z: 30 * Math.sin(angle) },
    })
    // 🛑 Trois frames avant de lire : la première compile, la deuxième dessine les cartes d'ombre
    // pour la vue neuve, et c'est la troisième qui montre ce qu'un utilisateur verrait.
    for (let frame = 0; frame < 3; frame += 1) {
      renderer['redraw']()
      await nextFrame()
    }
    renderer['redraw']()
    const pixels = pixelsOf(canvas)
    // `as` : ce que la stratégie dessine est privé par construction, et c'est ce qu'on compte.
    const meshes = (
      renderer['instances'] as {
        drawn: () => readonly { visible: boolean; count?: number; parent: { visible: boolean } | null }[]
      }
    ).drawn()
    const pillar = meshes.find(mesh => mesh.count === PILLARS)
    shots.push({
      heading,
      pixels,
      hidden: meshes.filter(mesh => !mesh.visible || mesh.parent?.visible === false).length,
      drawn: meshes.length,
      // Le lot des piliers, nommé par son compte : c'est LUI que le décor existe pour cacher.
      pillarDrawn: pillar ? pillar.visible && pillar.parent?.visible !== false : null,
    })
  }
  renderer.dispose()
  return shots
}

export async function runShadowZone(
  onProgress?: (step: { phase: string }) => void,
): Promise<{ results: unknown[]; failures: unknown[] }> {
  const results: unknown[] = []
  const failures: unknown[] = []
  try {
    onProgress?.({ phase: 'off' })
    const off = await sweep('off')
    onProgress?.({ phase: 'témoin' })
    const witness = await sweep('off')
    onProgress?.({ phase: 'sans ombre' })
    const unlit = await sweep('off', false)
    onProgress?.({ phase: 'grid' })
    const grid = await sweep(QUERY.get('mode') === 'off' ? 'off' : 'grid')

    // 🛑 Le contrôle le plus bête : l'image bouge-t-elle seulement quand la caméra tourne ? Sans
    // lui, un banc qui ne redessine pas rend « 0 différent » à toutes les autres questions.
    const first = off[0]
    const last = off[off.length - 1]
    if (first && last) {
      results.push({
        lit: lightState,
        turns: comparePixels(first.pixels, last.pixels, 0).share,
        litVersusUnlit: unlit[0]
          ? comparePixels(first.pixels, unlit[0].pixels, 0).share
          : null,
      })
    }

    for (const [at, shot] of off.entries()) {
      const same = witness[at]
      const dark = unlit[at]
      const other = grid[at]
      if (!same || !dark || !other) continue
      const against = comparePixels(shot.pixels, other.pixels, 0)
      results.push({
        heading: shot.heading,
        // Le contrôle du contrôle : sans lui, un décor SANS ombre rendrait aussi « 0 différent ».
        shadowShare: comparePixels(shot.pixels, dark.pixels, 0).share,
        witness: comparePixels(shot.pixels, same.pixels, 0).share,
        grid: against.share,
        gridMeanGap: round(against.meanGap),
        gridHidden: other.hidden,
        gridDrawn: other.drawn,
        gridPillarDrawn: other.pillarDrawn,
        offPillarDrawn: shot.pillarDrawn,
      })
    }
  } catch (error) {
    // `as` : ce qu'un `throw` porte n'est typé par personne ; on lit `stack` s'il existe.
    failures.push({ error: String((error as { stack?: string }).stack ?? error) })
  }
  return { results, failures }
}
