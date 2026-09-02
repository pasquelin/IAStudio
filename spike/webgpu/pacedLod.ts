import { InstancedMesh, Matrix4, Vector3, type Object3D, type PerspectiveCamera } from 'three'
import { laddersFor, screenRadius, SCREEN_STEPS, type Ladder } from './lodStrategies'
import type { ShapeLevel } from './engineScenes'

const round = (value: number): number => Math.round(value * 1000) / 1000

/**
 * Le LOD par corps rendu ÉVÉNEMENTIEL et AMORTI — la variante 4 du chantier C3.
 *
 * Deux changements par rapport au prototype de l'étape 2, qui coûtait 5,8 ms par frame :
 * le travail ne rouvre que lorsque la caméra a bougé assez pour changer une décision, et il est
 * découpé en tranches d'un budget de corps par frame.
 *
 * 🛑 Et un troisième, qui pesait plus que les deux autres : un corps qui change de niveau est
 * DÉPLACÉ d'une étagère à l'autre par échange avec la dernière, jamais par reconstruction. Le
 * prototype réécrivait les 50 000 matrices et recalculait chaque sphère englobante à chaque tour.
 */

/** Ce qu'un tour d'amortissement a coûté et changé. */
export type Pumped = {
  classifyMs: number
  applyMs: number
  /** Corps examinés dans ce tour. */
  touched: number
  /** Corps qui ont vraiment changé d'étagère. */
  changed: number
  /** Le balayage est-il allé au bout ? */
  done: boolean
}

/** Où part le temps de CONSTRUIRE le rig — ce que 2C mesure, phase par phase. */
export type BuiltIn = {
  /** Créer les géométries de chaque niveau. Zéro quand une échelle déjà bâtie est passée. */
  laddersMs: number
  /** Trouver les lots et allouer un `InstancedMesh` par niveau et par lot. */
  shelvesMs: number
  /** Les tables par corps : niveau porté, fente occupée, occupant de chaque fente. */
  tablesMs: number
}

export type PacedLod = {
  /** La caméra a-t-elle bougé assez pour rouvrir le travail ? Vrai si le balayage est reparti. */
  mark: (camera: PerspectiveCamera) => boolean
  /** Traite au plus `budget` corps. Un budget nul ou négatif prend tout ce qui reste. */
  pump: (camera: PerspectiveCamera, height: number, budget: number) => Pumped
  settled: () => boolean
  /** Combien de corps le rig tient, tous lots confondus. */
  bodies: () => number
  /** Ce que sa construction a coûté, par phase. */
  builtIn: () => BuiltIn
  /** Les étagères posées dans la scène, pour compter ce qu'une reconstruction réalloue. */
  shelves: () => number
  /** L'échelle de géométries, à repasser à un rig suivant pour ne pas les rebâtir. */
  ladders: () => Map<number, Ladder>
  /** Ce que le rig a détruit ou non : une échelle passée de l'extérieur ne lui appartient pas. */
  dispose: (keepLadders?: boolean) => void
}

/**
 * Ce qu'il faut avoir bougé pour qu'une décision de LOD puisse changer.
 *
 * Un mètre et deux degrés : à trente mètres, un mètre déplace le rayon projeté d'une sphère de
 * 0,6 unité de trois pour cent — bien en deçà de l'écart entre deux seuils, qui est d'un facteur
 * 2,6. La rotation ne change AUCUNE taille projetée ; elle ne compte que parce que le frustum
 * décide ce qui est à l'écran, ce que ce rig ne regarde pas encore.
 */
const MOVED_METRES = 1
const TURNED_DEGREES = 2

/**
 * La marge d'hystérésis, en part du seuil : un corps ne remonte d'un niveau qu'à 15 % au-dessus
 * du seuil qui l'a fait descendre. Sans elle, un corps posé sur un seuil bascule à chaque frame.
 */
const HYSTERESIS = 0.15

const AT = new Vector3()
const EYE = new Vector3()
const AIM = new Vector3()
const HELD = new Matrix4()

/**
 * Le niveau que cette taille écran demande, en tenant compte de celui qu'on porte déjà : monter
 * en qualité demande de dépasser le seuil d'une marge, en descendre demande d'être sous lui.
 */
function levelFor(pixels: number, worn: number, margin: number): number {
  for (const [at, step] of SCREEN_STEPS.entries()) {
    if (pixels >= (at < worn ? step * (1 + margin) : step)) return at
  }
  return SCREEN_STEPS.length
}

/** Un lot d'origine, ses étagères par niveau, et où chacun de ses corps est rangé. */
type Rack = {
  lot: InstancedMesh
  ladder: Ladder
  shelves: InstancedMesh[]
  /** Le niveau porté par chaque corps du lot, ou −1 tant qu'il n'a jamais été placé. */
  level: Int8Array
  /** L'étagère et la fente où il est rangé. */
  slot: Int32Array
  /** Qui occupe chaque fente de chaque étagère, pour l'échange avec la dernière. */
  occupant: Int32Array[]
}

function rackOf(scene: Object3D, lot: InstancedMesh, ladder: Ladder): Rack {
  const shelves = ladder.levels.map(geometry => {
    const shelf = new InstancedMesh(geometry, lot.material, lot.count)
    shelf.castShadow = lot.castShadow
    shelf.receiveShadow = lot.receiveShadow
    // La sphère du LOT, copiée une fois : une étagère n'en tient qu'un sous-ensemble, donc celle
    // du lot les englobe tous. Conservatrice, jamais trop petite, et O(1) — recalculer la vraie
    // sphère de chaque étagère à chaque tour est ce qui coûtait 3 ms au prototype.
    if (lot.boundingSphere) shelf.boundingSphere = lot.boundingSphere.clone()
    shelf.count = 0
    shelf.visible = false
    scene.add(shelf)
    return shelf
  })
  lot.visible = false
  return { lot, ladder, shelves, level: EMPTY_LEVEL, slot: EMPTY_SLOT, occupant: [] }
}

/** Les tables par corps, allouées à part : c'est la moitié de ce qu'une reconstruction réalloue. */
function tablesOf(rack: Rack): void {
  rack.level = new Int8Array(rack.lot.count).fill(-1)
  rack.slot = new Int32Array(rack.lot.count).fill(-1)
  rack.occupant = rack.shelves.map(() => new Int32Array(rack.lot.count).fill(-1))
}

const EMPTY_LEVEL = new Int8Array(0)
const EMPTY_SLOT = new Int32Array(0)

/** La fente qui vient de bouger, et elle seule : marquer le tampon entier le ré-uploade en entier. */
function touched(shelf: InstancedMesh, slot: number): void {
  shelf.instanceMatrix.addUpdateRange(slot * 16, 16)
  shelf.instanceMatrix.needsUpdate = true
}

/** Sort un corps de son étagère en y ramenant le dernier, pour que la fente reste compacte. */
function unshelve(rack: Rack, body: number): void {
  const level = rack.level[body] ?? -1
  if (level < 0) return
  const shelf = rack.shelves[level]
  const occupant = rack.occupant[level]
  if (!shelf || !occupant) return

  const slot = rack.slot[body] ?? -1
  const last = shelf.count - 1
  if (slot < 0 || last < 0) return
  if (slot !== last) {
    const moved = occupant[last] ?? -1
    shelf.getMatrixAt(last, HELD)
    shelf.setMatrixAt(slot, HELD)
    touched(shelf, slot)
    occupant[slot] = moved
    if (moved >= 0) rack.slot[moved] = slot
  }
  shelf.count = last
  shelf.visible = last > 0
  rack.level[body] = -1
  rack.slot[body] = -1
}

/** Range un corps sur l'étagère d'un niveau, à la suite de ce qu'elle tient déjà. */
function shelve(rack: Rack, body: number, level: number): void {
  const shelf = rack.shelves[level]
  const occupant = rack.occupant[level]
  if (!shelf || !occupant) return

  rack.lot.getMatrixAt(body, HELD)
  const slot = shelf.count
  shelf.setMatrixAt(slot, HELD)
  touched(shelf, slot)
  occupant[slot] = body
  shelf.count = slot + 1
  shelf.visible = true
  rack.level[body] = level
  rack.slot[body] = slot
}

/**
 * `held` est l'échelle de géométries d'un rig précédent : la passer est le cas TIÈDE, celui d'une
 * scène déjà ouverte qu'on modifie. Sans elle, chaque reconstruction rebâtit les neuf géométries.
 */
export function pacedLod(
  scene: Object3D,
  level: ShapeLevel,
  hysteresis = HYSTERESIS,
  held?: Map<number, Ladder>,
): PacedLod {
  const laddersFrom = performance.now()
  const ladders = held ?? laddersFor(level)
  const laddersMs = performance.now() - laddersFrom

  const shelvesFrom = performance.now()
  const racks: Rack[] = []
  scene.traverse(object => {
    if (!(object instanceof InstancedMesh)) return
    const ladder = ladders.get(
      (object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0) / 3,
    )
    if (ladder) racks.push(rackOf(scene, object, ladder))
  })
  const shelvesMs = performance.now() - shelvesFrom

  const tablesFrom = performance.now()
  for (const rack of racks) tablesOf(rack)
  const tablesMs = performance.now() - tablesFrom

  const total = racks.reduce((sum, rack) => sum + rack.lot.count, 0)
  /**
   * Où le balayage en est. Il TOURNE EN ROND et n'est jamais remis à zéro : une caméra qui bouge
   * à chaque frame rouvrirait sinon le travail au même endroit, et seuls les premiers corps de la
   * liste seraient jamais classés.
   */
  let cursor = 0
  /** Corps balayés depuis le dernier mouvement : un tour complet veut dire convergé. */
  let swept = 0
  const seenAt = new Vector3(Infinity, Infinity, Infinity)
  const seenAim = new Vector3()
  /** Ce que la classification a décidé pour la tranche en cours, avant de l'appliquer. */
  const wanted = new Int8Array(total)

  /** Où chaque lot commence dans le balayage global — cherché une fois par LOT, jamais par corps. */
  const starts: number[] = []
  let seen = 0
  for (const rack of racks) {
    starts.push(seen)
    seen += rack.lot.count
  }

  /** Le lot qui tient le corps `at`, par bissection sur `starts`. */
  const rackFor = (at: number): number => {
    let low = 0
    let high = racks.length - 1
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      if ((starts[middle] ?? 0) > at) high = middle - 1
      else low = middle
    }
    return low
  }

  /**
   * `slice` corps à partir de `from`, visités lot par lot : trouver le lot d'un corps par un
   * balayage de la liste coûtait 168 comparaisons par corps, soit huit millions par tour — un
   * coût du BANC, qui se serait lu comme un coût du LOD.
   */
  const walk = (
    from: number,
    slice: number,
    visit: (rack: Rack, body: number, at: number) => void,
  ): void => {
    let at = from
    let left = slice
    let index = rackFor(at)
    while (left > 0 && index < racks.length) {
      const rack = racks[index]
      const start = starts[index]
      if (!rack || start === undefined) break
      const body = at - start
      const take = Math.min(left, rack.lot.count - body)
      for (let step = 0; step < take; step += 1) visit(rack, body + step, at + step)
      at += take
      left -= take
      index += 1
    }
  }

  return {
    mark: camera => {
      camera.getWorldPosition(EYE)
      camera.getWorldDirection(AIM)
      const moved = EYE.distanceTo(seenAt) > MOVED_METRES
      const turned = AIM.angleTo(seenAim) > (TURNED_DEGREES * Math.PI) / 180
      if (!moved && !turned && swept >= total) return false
      if (moved || turned) {
        seenAt.copy(EYE)
        seenAim.copy(AIM)
        swept = 0
      }
      return true
    },

    pump: (camera, height, budget) => {
      if (swept >= total) return { classifyMs: 0, applyMs: 0, touched: 0, changed: 0, done: true }

      const slice = Math.min(budget > 0 ? budget : total, total - swept)
      camera.getWorldPosition(EYE)

      /** La tranche coupée au bout de la liste, puisque le balayage reboucle. */
      const runs: [number, number][] =
        cursor + slice <= total
          ? [[cursor, slice]]
          : [
              [cursor, total - cursor],
              [0, slice - (total - cursor)],
            ]

      const classifyFrom = performance.now()
      for (const [from, take] of runs)
        walk(from, take, (rack, body, at) => {
          rack.lot.getMatrixAt(body, HELD)
          AT.setFromMatrixPosition(HELD)
          // Borné à ce que l'échelle PORTE : un cube n'a qu'un niveau, douze triangles ne se
          // réduisant pas. Sans ce plafond, un cube classé plus bas n'était rangé sur aucune
          // étagère et DISPARAISSAIT — les triangles tombaient, et c'était des corps en moins.
          wanted[at] = Math.min(
            levelFor(
              screenRadius(rack.ladder.radius, AT.distanceTo(EYE), camera, height),
              rack.level[body] ?? SCREEN_STEPS.length,
              hysteresis,
            ),
            rack.ladder.levels.length - 1,
          )
        })
      const classifyMs = performance.now() - classifyFrom

      const applyFrom = performance.now()
      let changed = 0
      for (const [from, take] of runs)
        walk(from, take, (rack, body, at) => {
          const asked = wanted[at] ?? 0
          if (rack.level[body] === asked) return
          unshelve(rack, body)
          shelve(rack, body, asked)
          changed += 1
        })
      const applyMs = performance.now() - applyFrom

      cursor = (cursor + slice) % total
      swept += slice
      return { classifyMs, applyMs, touched: slice, changed, done: swept >= total }
    },

    settled: () => swept >= total,

    bodies: () => total,

    builtIn: () => ({
      laddersMs: round(laddersMs),
      shelvesMs: round(shelvesMs),
      tablesMs: round(tablesMs),
    }),

    shelves: () => racks.reduce((sum, rack) => sum + rack.shelves.length, 0),

    /** L'échelle, pour qu'une reconstruction ne rebâtisse pas neuf géométries déjà en main. */
    ladders: () => ladders,

    dispose: keepLadders => {
      for (const rack of racks) {
        rack.lot.visible = true
        for (const shelf of rack.shelves) {
          shelf.removeFromParent()
          shelf.dispose()
        }
      }
      if (keepLadders) return
      for (const { levels } of ladders.values()) for (const geometry of levels) geometry.dispose()
    },
  }
}
