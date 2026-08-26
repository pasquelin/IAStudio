/**
 * The one place a composition is drawn, whoever is asking.
 *
 * The viewport, each camera preview, the film and the still all come through `draw`, so an effect
 * cannot differ between the editor and the render — § 26 is not a convention here, it is the only
 * code path there is.
 *
 * **What it costs is decided by three things, in this order of importance.** A chain is compiled
 * on the SHAPE of a stack and never on its values, so moving a slider reaches a uniform and
 * nothing is rebuilt. Neighbouring per-pixel effects are merged into one draw (`fuseShader`).
 * And the output transform — tone mapping, colour space — is the same draw as the blit into the
 * destination, so a composition never pays a copy just to arrive somewhere.
 */
import {
  HalfFloatType,
  LinearFilter,
  UnsignedByteType,
  Vector4,
  WebGLRenderTarget,
  type Camera,
  type Data3DTexture,
  type IUniform,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import type { Pass } from 'three/addons/postprocessing/Pass.js'
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
import type { EffectInstance, EffectParams, ViewInfo } from './effectInstance'
import { fuseShader, QUAD_VERTEX, type FusableChunk } from './fuseShader'
import { budgetFor, chainSize } from './postQuality'
import { heaviestCost, stepsOf, wantsFloat, type PostStep } from './postPlan'
import { FUSABLE_EFFECTS } from './shaders/fusableChunks'
import { STANDALONE_EFFECTS, type BuildContext } from './standaloneEffects'

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

/** Reads a LUT asset into the 3D texture the grade samples. */
export type LutSource = (assetId: string) => Promise<Data3DTexture | null>

export type PostComposerOptions = {
  loadLut?: LutSource
  /** Asked for a frame once something that was loading has arrived. */
  onReady?: () => void
}

type Applier = (params: EffectParams, view: ViewInfo) => void

type Chain = {
  composer: EffectComposer
  /** The plain render at the head, absent when a supersampling pass draws the scene instead. */
  head: RenderPass | null
  appliers: readonly Applier[]
  instances: readonly EffectInstance[]
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

export class PostComposer {
  private readonly chains = new Map<string, Chain>()
  private readonly luts = new Map<string, Data3DTexture | null>()
  private readonly loading = new Set<string>()
  private readonly output = new OutputPass()
  /** Scratch, so holding the renderer's state costs no allocation on the frame path. */
  private readonly heldViewport = new Vector4()
  private readonly heldScissor = new Vector4()
  private clock = 0

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly options: PostComposerOptions = {},
  ) {}

  /**
   * Draws the scene through the composition, into whatever the job names.
   *
   * A stack that plans no pass draws straight, which is what the ON/OFF switch and the bypass both
   * come down to: no target is allocated and no chain is compiled for a composition nobody is
   * asking to see.
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
    const key = `${stackShapeKey(job.stack)}#${size.width}x${size.height}#${float ? 'f' : 'b'}`

    const view: ViewInfo = {
      scene: job.scene,
      camera: job.camera,
      width: size.width,
      height: size.height,
      time: job.time,
      budget,
    }

    const chain = this.chains.get(key) ?? this.compile(key, plan.effects, view, float)
    this.clock += 1
    chain.usedAt = this.clock

    if (chain.head) {
      chain.head.scene = job.scene
      chain.head.camera = job.camera
    }
    for (const [index, effect] of plan.effects.entries())
      chain.appliers[index]?.(effect.params, view)

    const restore = this.hold()
    try {
      // Off for the whole chain: its buffers are the size of the CHAIN, and a scissor in canvas
      // coordinates would clip every one of them to a rectangle that means nothing there.
      this.renderer.setScissorTest(false)
      chain.composer.render(0)
      this.finish(job, chain.composer.readBuffer)
    } finally {
      restore()
    }
  }

  /**
   * The renderer's target, viewport and scissor as they stand, and the call that puts them back.
   *
   * Restored rather than reset: this runs INSIDE the pane loop, which has already turned the
   * scissor on and set a rectangle for the pane after this one. Forcing either off would clip —
   * or fail to clip — every pane drawn after the first composed one.
   */
  private hold(): () => void {
    const renderer = this.renderer
    const target = renderer.getRenderTarget()
    const scissorTest = renderer.getScissorTest()
    renderer.getViewport(this.heldViewport)
    renderer.getScissor(this.heldScissor)

    return () => {
      renderer.setRenderTarget(target)
      renderer.setViewport(this.heldViewport)
      renderer.setScissor(this.heldScissor)
      renderer.setScissorTest(scissorTest)
    }
  }

  /** Frees every chain no live stack asks for — a scene closed, a camera stopped overriding. */
  sweep(live: readonly PostStack[]): void {
    const wanted = new Set(live.map(stackShapeKey))
    for (const [key, chain] of this.chains) {
      if (wanted.has(shapeOf(key))) continue
      dropChain(chain)
      this.chains.delete(key)
    }
  }

  dispose(): void {
    for (const chain of this.chains.values()) dropChain(chain)
    this.chains.clear()
    for (const lut of this.luts.values()) lut?.dispose()
    this.luts.clear()
    this.output.dispose()
  }

  /**
   * The output transform AND the blit, in one draw.
   *
   * Two reasons rather than one. The chain stays in the working space from end to end, so no
   * intermediate buffer has to lie about its colour space — the defect that makes a preview come
   * back doubly tone-mapped. And the copy a blit would have cost is the copy the output pass was
   * going to make anyway.
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
    const restore = this.hold()
    try {
      renderer.setRenderTarget(job.target)
      if (job.rect) {
        renderer.setViewport(job.rect.x, job.rect.y, job.rect.width, job.rect.height)
        renderer.setScissor(job.rect.x, job.rect.y, job.rect.width, job.rect.height)
        renderer.setScissorTest(true)
      }
      renderer.render(job.scene, job.camera)
    } finally {
      restore()
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
      lutOf: assetId => this.lutOf(assetId),
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

    const chain: Chain = { composer, head, appliers, instances, usedAt: this.clock }
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
      const factory = STANDALONE_EFFECTS[step.effect.effect]
      if (!factory) return
      const instance = factory(context)
      instances.push(instance)
      for (const pass of instance.passes) composer.addPass(pass)
      appliers.push(instance.apply)
      return
    }

    const merged = step.effects.flatMap((effect): FusableChunk[] => {
      const fusable = FUSABLE_EFFECTS[effect.effect]
      return fusable ? [{ ...fusable.make(), kind: fusable.kind }] : []
    })
    const fused = fuseShader(merged)
    const pass = new ShaderPass({
      name: 'FusedPostShader',
      uniforms: fused.uniforms,
      vertexShader: QUAD_VERTEX,
      fragmentShader: fused.fragmentShader,
    })
    composer.addPass(pass)
    instances.push(passInstance(pass))

    for (const [index, effect] of step.effects.entries()) {
      const fusable = FUSABLE_EFFECTS[effect.effect]
      const naming = fused.naming[index]
      if (!fusable || !naming) continue
      // `ShaderPass` CLONES the uniforms it is given, so the objects the applier writes into are
      // the pass's own — read back here, under the effect's own names.
      const own: Record<string, IUniform> = {}
      for (const [name, renamed] of Object.entries(naming)) {
        const uniform = pass.uniforms[renamed]
        if (uniform) own[name] = uniform
      }
      appliers.push((params, view) => fusable.apply(params, view, own))
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

  /** The LUT for an asset if it is here; asks for it and answers nothing while it is not. */
  private lutOf(assetId: string): Data3DTexture | null {
    const held = this.luts.get(assetId)
    if (held !== undefined) return held
    if (!this.loading.has(assetId) && this.options.loadLut) {
      this.loading.add(assetId)
      void this.fetchLut(assetId)
    }
    return null
  }

  /**
   * A named method rather than a `.then` on the call above: the rule is `await` everywhere, and
   * what cannot be awaited is extracted so its body can be.
   */
  private async fetchLut(assetId: string): Promise<void> {
    try {
      this.luts.set(assetId, (await this.options.loadLut?.(assetId)) ?? null)
    } catch {
      // Remembered as absent rather than retried: a file that failed to parse fails every time,
      // and asking again would do it once per frame.
      this.luts.set(assetId, null)
    } finally {
      this.loading.delete(assetId)
      this.options.onReady?.()
    }
  }
}

/** A pass nothing writes into — the fused one, whose appliers are registered beside it. */
function passInstance(pass: Pass): EffectInstance {
  return {
    passes: [pass],
    apply: () => {},
    setSize: (width, height) => pass.setSize(width, height),
    dispose: () => pass.dispose(),
  }
}

function dropChain(chain: Chain): void {
  for (const instance of chain.instances) instance.dispose()
  chain.composer.dispose()
}

/** The shape half of a cache key — the part `sweep` compares against the live stacks. */
function shapeOf(key: string): string {
  return key.slice(0, key.indexOf('#'))
}

function fusableKind(effect: PostEffect): 'uv' | 'colour' | null {
  return FUSABLE_EFFECTS[effect.effect]?.kind ?? null
}
