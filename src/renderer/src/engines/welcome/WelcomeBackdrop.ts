import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three'
import { onPaletteChange, tokenAsHex } from '../core/palette'
import {
  approach,
  WELCOME_SWING_RATE,
  WELCOME_TURN_RATE,
  welcomeAzimuth,
  welcomeHeroTurn,
  welcomePose,
} from './welcomeMotion'

const FALLBACK_CHASSIS = 0x2b2d30
const FALLBACK_VIEWPORT = 0x33363b
const FALLBACK_VIEWPORT_LINE = 0x494d54
const FALLBACK_MESH = 0x868a91
const FALLBACK_ACCENT = 0x346ef2

/** Wide enough that its edge is far behind the fog: a floor whose end can be seen has no horizon. */
const FLOOR = 200

const GRID = 64

/** Lines fade a stride ahead of the camera, so the band the copy sits on is flat ground. */
const FOG_NEAR = 6
const FOG_FAR = 20

/** Motes in the air. Enough to say the room is alive, few enough that none lands on a word. */
const MOTES = 520

type Volume = Mesh<IcosahedronGeometry, MeshStandardMaterial>

function hexColor(element: Element, name: string, fallback: number): Color {
  return new Color(tokenAsHex(element, name, fallback))
}

function makeFloor(): Mesh<PlaneGeometry, MeshStandardMaterial> {
  const floor = new Mesh(
    new PlaneGeometry(FLOOR, FLOOR),
    new MeshStandardMaterial({ roughness: 0.92, metalness: 0, toneMapped: false }),
  )
  floor.rotation.x = -Math.PI / 2
  // Under the grid rather than level with it: coplanar, the two fight for every far pixel.
  floor.position.y = -0.004
  return floor
}

function makeGrid(): GridHelper {
  // White at both ends so the token lives in `material.color`: the helper bakes its colours into a
  // vertex attribute, and a theme change would otherwise mean rebuilding the geometry.
  const grid = new GridHelper(GRID, GRID, 0xffffff, 0xffffff)
  grid.material.toneMapped = false
  return grid
}

function makeVolume(radius: number): Volume {
  return new Mesh(
    new IcosahedronGeometry(radius, 0),
    new MeshStandardMaterial({ roughness: 0.45, metalness: 0.12, flatShading: true }),
  )
}

function makeMotes(): Points<BufferGeometry, PointsMaterial> {
  const positions = new Float32Array(MOTES * 3)
  for (let index = 0; index < MOTES; index += 1) {
    const at = index * 3
    positions[at] = (Math.random() - 0.5) * 34
    // Never on the floor and never above the horizon: motes belong to the air the fog fills.
    positions[at + 1] = 0.3 + Math.random() * 5.2
    // Reaching PAST the camera, which stands at z 8.6: a cloud that stops short of it has no mote
    // near enough to read as one, `sizeAttenuation` giving the far ones a pixel each.
    positions[at + 2] = -12 + Math.random() * 26
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  return new Points(
    geometry,
    new PointsMaterial({ size: 0.075, transparent: true, opacity: 0.75, depthWrite: false }),
  )
}

export type WelcomeBackdropOptions = {
  reduceMotion: boolean
  slide: number
}

/**
 * 🛑 Floor and grid are `toneMapped: false`: they ARE `--color-viewport` and
 * `--color-viewport-line`, so they must leave the pipeline at the value the stylesheet declares.
 */
export class WelcomeBackdrop {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(34, 1, 0.1, 400)
  private readonly clock = new Clock()
  private readonly ground = new Color(FALLBACK_VIEWPORT)
  /**
   * Deliberately NOT the floor's colour: painted alike, a light theme loses its horizon entirely.
   * The chassis falls the right side of the floor in both themes.
   */
  private readonly wall = new Color(FALLBACK_CHASSIS)
  private readonly floor = makeFloor()
  private readonly grid = makeGrid()
  private readonly hero = makeVolume(1.2)
  private readonly satellite = makeVolume(0.5)
  private readonly motes = makeMotes()
  private readonly sky = new HemisphereLight(0xffffff, 0xffffff, 1.15)
  /** WHITE in both themes: a light is not an ink, and only the SURFACES read tokens here. */
  private readonly key = new DirectionalLight(0xffffff, 2)
  /**
   * From UNDER the volumes: placed with the key it reached nothing new, and every facet the heroes
   * turn downward stayed a black wedge.
   */
  private readonly fill = new DirectionalLight(0xffffff, 0.85)
  private readonly lamp = new PointLight(FALLBACK_ACCENT, 42, 16, 2)
  /** Dropped on dispose. The studio publishes the theme, THEN calls the listeners: reading the
   * tokens off a `theme` effect of our own handed back the palette being left. */
  private readonly dropPalette = onPaletteChange(() => this.syncPalette())
  private azimuth = 0
  private wantedAzimuth = 0
  private heroTurn = 0
  private wantedTurn = 0
  private frame: number | null = null
  private lastDrawn = 0
  private disposed = false
  private reduceMotion: boolean
  private frozenTime = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: WelcomeBackdropOptions,
  ) {
    this.reduceMotion = options.reduceMotion
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.toneMapping = ACESFilmicToneMapping

    // Resting ON the floor — an icosahedron's lowest vertex sits a radius below its centre — and
    // off to the right, where the reader is not reading.
    this.hero.position.set(3.3, 1.2, 0.2)
    this.hero.rotation.x = 0.35
    this.satellite.position.set(-3.6, 0.5, -1.8)
    this.satellite.rotation.x = 0.9
    this.key.position.set(-5, 7, 5)
    this.fill.position.set(2, -3, 5)
    // A lamp and not a second sun: the accent is a light in this room, and a directional one would
    // paint the whole floor blue — the wash the ground token exists to refuse.
    this.lamp.position.set(4.8, 2.1, -1.4)

    this.scene.add(this.floor, this.grid, this.hero, this.satellite, this.motes)
    this.scene.add(this.sky, this.key, this.fill, this.lamp)
    this.scene.fog = new Fog(this.wall, FOG_NEAR, FOG_FAR)
    this.syncPalette()
    this.setSlide(options.slide)
    this.heroTurn = this.wantedTurn
    this.azimuth = this.wantedAzimuth
    this.resize()
    this.start()
  }

  setReduceMotion(value: boolean): void {
    if (this.reduceMotion === value) return
    this.reduceMotion = value
    if (value) this.frozenTime = this.clock.getElapsedTime()
    this.start()
  }

  setSlide(index: number): void {
    this.wantedAzimuth = welcomeAzimuth(index)
    this.wantedTurn = welcomeHeroTurn(index)
    this.start()
  }

  syncPalette(): void {
    this.ground.copy(hexColor(this.canvas, '--color-viewport', FALLBACK_VIEWPORT))
    this.wall.copy(hexColor(this.canvas, '--color-chassis', FALLBACK_CHASSIS))
    const line = hexColor(this.canvas, '--color-viewport-line', FALLBACK_VIEWPORT_LINE)
    const mesh = hexColor(this.canvas, '--color-mesh', FALLBACK_MESH)

    this.scene.background = this.wall
    if (this.scene.fog instanceof Fog) this.scene.fog.color.copy(this.wall)
    this.renderer.setClearColor(this.wall, 1)
    this.floor.material.color.copy(this.ground)
    this.grid.material.color.copy(line)
    this.hero.material.color.copy(mesh)
    this.satellite.material.color.copy(mesh)
    this.motes.material.color.copy(mesh)
    this.sky.color.copy(line)
    // The LINE and not the ground: a hemisphere's lower half is the bounce off the floor, and the
    // floor here is LIT. Handed the raw ground token it returned nothing, and every facet of the
    // hero that pointed down came back as a black wedge.
    this.sky.groundColor.copy(line)
    this.lamp.color.copy(hexColor(this.canvas, '--color-accent', FALLBACK_ACCENT))
    this.start()
  }

  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth)
    const height = Math.max(1, this.canvas.clientHeight)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(width, height, false)
    this.start()
  }

  dispose(): void {
    this.disposed = true
    this.dropPalette()
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
    for (const object of [this.floor, this.grid, this.hero, this.satellite, this.motes]) {
      object.geometry.dispose()
      object.material.dispose()
    }
    this.renderer.dispose()
  }

  /**
   * Asks for the next frame, or draws the single one a still needs. Reduced motion used to keep
   * the loop turning on a frozen clock, which is a GPU paid for a picture that never changes.
   */
  private start(): void {
    if (this.disposed) return
    if (!this.reduceMotion) {
      if (this.frame === null) this.frame = requestAnimationFrame(this.tick)
      return
    }
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
    this.heroTurn = this.wantedTurn
    this.azimuth = this.wantedAzimuth
    this.draw()
  }

  private draw(): void {
    const elapsed = this.reduceMotion ? this.frozenTime : this.clock.getElapsedTime()
    const { eye, target } = welcomePose(elapsed, this.azimuth)
    this.camera.position.set(eye.x, eye.y, eye.z)
    this.camera.lookAt(target.x, target.y, target.z)
    const idle = this.reduceMotion ? 0 : elapsed
    this.hero.rotation.y = this.heroTurn + idle * 0.05
    this.satellite.rotation.y = -this.heroTurn * 1.4 - idle * 0.08
    this.motes.rotation.y = idle * 0.02
    this.renderer.render(this.scene, this.camera)
  }

  private tick = (): void => {
    if (this.disposed) return
    this.frame = null
    const now = this.clock.getElapsedTime()
    const seconds = this.lastDrawn === 0 ? 0 : now - this.lastDrawn
    this.lastDrawn = now
    this.heroTurn = approach(this.heroTurn, this.wantedTurn, seconds, WELCOME_TURN_RATE)
    this.azimuth = approach(this.azimuth, this.wantedAzimuth, seconds, WELCOME_SWING_RATE)
    this.draw()
    this.start()
  }
}
