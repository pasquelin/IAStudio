/**
 * The one place a composition is drawn — the viewport, every camera preview, the film and the
 * still all come through `draw`, so an effect cannot differ between the editor and the render.
 *
 * A chain is compiled on the SHAPE of a stack and never on its values: moving a slider reaches a
 * uniform, and nothing is rebuilt.
 */
import {
  HalfFloatType,
  LinearFilter,
  UnsignedByteType,
  Camera,
  Scene,
  Vector4,
  WebGLRenderTarget,
  type IUniform,
  type WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import {
  planStack,
  slotOf,
  stackShapeKey,
  type PostEffect,
  type PostStack,
} from '@shared/domain/postProcessing'
import type { ViewportQuality } from '@shared/domain/scene'
import { QUAD_VERTEX_SHADER } from '@/engines/gpu/passes/quad'
import { onePass, type EffectInstance, type ViewInfo } from './effectInstance'
import { fuseShader, type FusableChunk } from './fuseShader'
import { createLutCache, type LutCache, type LutSource } from './lutCache'
import { budgetFor, chainSize } from './postQuality'
import { heaviestCost, stepsOf, wantsFloat, type PostStep } from './postPlan'
import { fusableFor, fusableKind } from './shaders/fusableChunks'
import { standaloneFor, type BuildContext } from './standaloneEffects'

/** Where a composition is being drawn, and at what size. Pixels, never CSS units. */
export type PostRect = { x: number; y: number; width: number; height: number }

export type PostDrawJob = {
  scene: Scene
  camera: Camera
  stack: PostStack
  /** `null` draws on the canvas — into `rect` when one is given, over the whole of it when not. */
  target: WebGLRenderTarget | null
  rect?: PostRect
  /** The destination, in pixels. The chain may be built smaller — see `budgetFor`. */
  width: number
  height: number
  quality: ViewportQuality
  /** Whether the world asks for a tone curve. Decides the precision the chain carries. */
  toneMapped: boolean
  /** Seconds. What grain and tape jitter advance on — the playhead during a film. */
  time: number
}

export type PostComposerOptions = {
  loadLut?: LutSource
  /** What the asset is worth right now — `textureCache.versionOf`. See `lutCache`. */
  lutStamp?: (assetId: string) => string | undefined
  /** Asked for a frame once something that was loading has arrived. */
  onReady?: () => void
}

type Applier = EffectInstance['apply']

type Chain = {
  composer: EffectComposer
  /** The plain render at the head, absent when a supersampling pass draws the scene instead. */
  head: RenderPass | null
  appliers: readonly Applier[]
  instances: readonly EffectInstance[]
  width: number
  height: number
  usedAt: number
}

/**
 * How many compiled chains are held at once.
 *
 * A chain is two full-size buffers plus whatever its passes keep, so this is the memory ceiling
 * of the whole system. Six covers what a session actually alternates between — a viewport, a
 * preview, and a second look on a camera — and evicts the sizes a resize left behind.
 */
const CHAINS_HELD = 6

/** What the scratch view opens on before the first draw fills it. Never rendered. */
const SCRATCH_SCENE = new Scene()
const SCRATCH_CAMERA = new Camera()

export class PostComposer {
  private readonly chains = new Map<string, Chain>()
  private readonly luts: LutCache
  private readonly output = new OutputPass()
  /** Scratch, so a frame allocates nothing: `draw` runs once per surface, per image. */
  private readonly heldViewport = new Vector4()
  private readonly heldScissor = new Vector4()
  private heldTarget: WebGLRenderTarget | null = null
  private heldScissorTest = false
  private readonly view: ViewInfo = {
    scene: SCRATCH_SCENE,
    camera: SCRATCH_CAMERA,
    width: 1,
    height: 1,
    time: 0,
    budget: { divisor: 1, samples: 1 },
  }
  private clock = 0

  constructor(
    private readonly renderer: WebGLRenderer,
    options: PostComposerOptions = {},
  ) {
    this.luts = createLutCache({
      load: assetId => options.loadLut?.(assetId) ?? Promise.resolve(null),
      stampOf: options.lutStamp,
      onReady: options.onReady,
    })
  }

  /**
   * A stack that plans no pass draws straight — which is what the ON/OFF switch and the bypass
   * come down to: no target allocated, no chain compiled for a composition nobody asks to see.
   */
  draw(job: PostDrawJob): void {
    const plan = planStack(job.stack)
    if (plan.effects.length === 0 || job.width < 1 || job.height < 1) {
      this.drawStraight(job)
      return
    }

    const budget = budgetFor(heaviestCost(plan.effects), job.quality)
    const size = chainSize(job.width, job.height, budget)
    const float = wantsFloat(plan.effects, job.toneMapped)
    // 🛑 The SIZE is deliberately NOT in the key. A `ResizeObserver` fires per pixel of a splitter
    // drag, and a size-keyed cache compiled a fresh composer — two full-frame buffers and a GLSL
    // link per pass — on every tick, then evicted it. A resize resizes; it does not recompile.
    const key = `${plan.shapeKey}#${float ? 'f' : 'b'}`

    const view = this.view
    view.scene = job.scene
    view.camera = job.camera
    view.width = size.width
    view.height = size.height
    view.time = job.time
    view.budget = budget

    const chain = this.chains.get(key) ?? this.compile(key, plan.effects, view, float)
    this.clock += 1
    chain.usedAt = this.clock
    this.resize(chain, size.width, size.height)

    if (chain.head) {
      chain.head.scene = job.scene
      chain.head.camera = job.camera
    }
    // Walked by index: `entries()` allocates an iterator and a tuple per effect per frame.
    for (let at = 0; at < plan.effects.length; at += 1) {
      const effect = plan.effects[at]
      if (effect) chain.appliers[at]?.(effect, view)
    }

    this.hold()
    try {
      // Off for the whole chain: its buffers are the size of the CHAIN, and a scissor in canvas
      // coordinates would clip every one of them to a rectangle that means nothing there.
      this.renderer.setScissorTest(false)
      chain.composer.render(0)
      this.finish(job, chain.composer.readBuffer)
    } finally {
      this.restore()
    }
  }

  /** The chain, brought to the size being drawn — three resizes both buffers and every pass. */
  private resize(chain: Chain, width: number, height: number): void {
    if (chain.width === width && chain.height === height) return

    chain.composer.setSize(width, height)
    for (const instance of chain.instances) instance.setSize(width, height)
    chain.width = width
    chain.height = height
  }

  /**
   * Restored rather than reset: this runs INSIDE the pane loop, which has already turned the
   * scissor on and set a rectangle for the pane after this one.
   */
  private hold(): void {
    this.heldTarget = this.renderer.getRenderTarget()
    this.heldScissorTest = this.renderer.getScissorTest()
    this.renderer.getViewport(this.heldViewport)
    this.renderer.getScissor(this.heldScissor)
  }

  private restore(): void {
    this.renderer.setRenderTarget(this.heldTarget)
    this.renderer.setViewport(this.heldViewport)
    this.renderer.setScissor(this.heldScissor)
    this.renderer.setScissorTest(this.heldScissorTest)
  }

  /** Frees every chain no live stack asks for — a scene closed, a camera stopped overriding. */
  sweep(live: readonly PostStack[]): void {
    const wanted = new Set(live.map(stackShapeKey))
    for (const [key, chain] of this.chains) {
      // The shape is the head of the key — held as a field it was state nothing but this line
      // read, and `sweep` runs on a change of scene rather than per image.
      if (wanted.has(key.slice(0, key.indexOf('#')))) continue
      dropChain(chain)
      this.chains.delete(key)
    }
  }

  dispose(): void {
    for (const chain of this.chains.values()) dropChain(chain)
    this.chains.clear()
    this.luts.dispose()
    this.output.dispose()
  }

  /**
   * The output transform AND the blit, in one draw: the chain stays in the working space from end
   * to end, so no intermediate buffer has to lie about its colour space — and the copy a blit
   * would cost is the one the output pass was going to make anyway.
   */
  private finish(job: PostDrawJob, read: WebGLRenderTarget): void {
    const renderer = this.renderer
    const rect = job.rect

    if (rect) {
      renderer.setViewport(rect.x, rect.y, rect.width, rect.height)
      renderer.setScissor(rect.x, rect.y, rect.width, rect.height)
      renderer.setScissorTest(true)
    }

    this.output.renderToScreen = job.target === null
    // A target the caller keeps may hold the frame before: cleared, or a composition drawn over a
    // smaller rectangle would show the previous one around it.
    this.output.clear = job.target !== null
    this.output.render(renderer, job.target ?? read, read, 0, false)
  }

  /** No composition to draw: the scene, straight into wherever the job pointed. */
  private drawStraight(job: PostDrawJob): void {
    const renderer = this.renderer
    this.hold()
    try {
      renderer.setRenderTarget(job.target)
      if (job.rect) {
        renderer.setViewport(job.rect.x, job.rect.y, job.rect.width, job.rect.height)
        renderer.setScissor(job.rect.x, job.rect.y, job.rect.width, job.rect.height)
        renderer.setScissorTest(true)
      }
      renderer.render(job.scene, job.camera)
    } finally {
      this.restore()
    }
  }

  private compile(
    key: string,
    effects: readonly PostEffect[],
    view: ViewInfo,
    float: boolean,
  ): Chain {
    this.evict()

    const target = new WebGLRenderTarget(view.width, view.height, {
      // Half float only where something works above white — see `wantsFloat`. It is twice the
      // bandwidth on every buffer of every pass, so it is bought rather than taken.
      type: float ? HalfFloatType : UnsignedByteType,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: true,
    })
    const composer = new EffectComposer(this.renderer, target)
    // The sizes above are already in device pixels; left at the renderer's ratio the composer
    // would multiply them a second time.
    composer.setPixelRatio(1)
    composer.renderToScreen = false

    const context: BuildContext = {
      scene: view.scene,
      camera: view.camera,
      renderer: this.renderer,
      width: view.width,
      height: view.height,
      lutOf: assetId => this.luts.get(assetId),
    }

    const appliers: Applier[] = []
    const instances: EffectInstance[] = []
    const drawsScene = effects[0] !== undefined && slotOf(effects[0]) === 'render'
    const head = drawsScene ? null : new RenderPass(view.scene, view.camera)
    if (head) composer.addPass(head)

    for (const step of stepsOf(effects, fusableKind)) {
      this.addStep(step, composer, context, appliers, instances)
    }

    for (const pass of composer.passes) pass.setSize(view.width, view.height)

    const chain: Chain = {
      composer,
      head,
      appliers,
      instances,
      width: view.width,
      height: view.height,
      usedAt: this.clock,
    }
    this.chains.set(key, chain)
    return chain
  }

  private addStep(
    step: PostStep,
    composer: EffectComposer,
    context: BuildContext,
    appliers: Applier[],
    instances: EffectInstance[],
  ): void {
    if (step.kind === 'own') {
      const factory = standaloneFor(step.effect.effect)
      if (!factory) return
      const instance = factory(context)
      instances.push(instance)
      for (const pass of instance.passes) composer.addPass(pass)
      appliers.push(instance.apply)
      return
    }

    const merged = step.effects.flatMap((effect): FusableChunk[] => {
      const fusable = fusableFor(effect.effect)
      return fusable ? [{ ...fusable.make(), kind: fusable.kind }] : []
    })
    const fused = fuseShader(merged)
    const pass = new ShaderPass({
      name: 'FusedPostShader',
      uniforms: fused.uniforms,
      vertexShader: QUAD_VERTEX_SHADER,
      fragmentShader: fused.fragmentShader,
    })
    composer.addPass(pass)
    instances.push(onePass(pass, () => {}))

    for (const [index, effect] of step.effects.entries()) {
      const fusable = fusableFor(effect.effect)
      const naming = fused.naming[index]
      if (!fusable || !naming) continue
      // `ShaderPass` CLONES the uniforms it is given, so the objects the applier writes into are
      // the pass's own — read back here, under the effect's own names.
      const own: Record<string, IUniform> = {}
      for (const [name, renamed] of Object.entries(naming)) {
        const uniform = pass.uniforms[renamed]
        if (uniform) own[name] = uniform
      }
      appliers.push((effect, view) => fusable.apply(effect, view, own))
    }
  }

  /** The least recently drawn chain goes when the cache is full — never the one about to draw. */
  private evict(): void {
    if (this.chains.size < CHAINS_HELD) return

    let oldest: [string, Chain] | null = null
    for (const entry of this.chains) {
      if (!oldest || entry[1].usedAt < oldest[1].usedAt) oldest = entry
    }
    if (!oldest) return

    dropChain(oldest[1])
    this.chains.delete(oldest[0])
  }
}

function dropChain(chain: Chain): void {
  for (const instance of chain.instances) instance.dispose()
  chain.composer.dispose()
}
