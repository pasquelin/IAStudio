/**
 * The one file that knows three.js has passes.
 *
 * Everything above it speaks of stacks, plans and parameters; everything below is `Pass`. Keeping
 * that line sharp is what would let the pass library be replaced — by pmndrs' `postprocessing`,
 * by a WebGPU chain — without a line changing anywhere else.
 */
import {
  Color,
  Vector2,
  type Camera,
  type Data3DTexture,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js'
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { HalftonePass } from 'three/addons/postprocessing/HalftonePass.js'
import { LUTPass } from 'three/addons/postprocessing/LUTPass.js'
import type { Pass } from 'three/addons/postprocessing/Pass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { SSAARenderPass } from 'three/addons/postprocessing/SSAARenderPass.js'
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js'
import { HALFTONE_SHAPES, type PostEffectId } from '@shared/domain/postProcessing'
import type { EffectInstance, EffectParams, ViewInfo } from './effectInstance'
import { samplesOf } from './postQuality'
import {
  blurAxisShader,
  chromaticAberrationShader,
  crtShader,
  outlineShader,
  sharpenShader,
  vhsShader,
} from './shaders/standaloneShaders'

/** What a pass is built with. The camera is the one of the FIRST draw; `apply` moves it after. */
export type BuildContext = {
  scene: Scene
  camera: Camera
  renderer: WebGLRenderer
  width: number
  height: number
  /** The LUT for an asset if it is loaded, `null` while it is not — see `PostComposer`. */
  lutOf: (assetId: string) => Data3DTexture | null
}

export type EffectFactory = (context: BuildContext) => EffectInstance

/** A pass's uniform bag. `ShaderPass` types its values as `any`, which nothing here reads back. */
type Uniforms = Record<string, { value: unknown }>

const uniformsOf = (pass: Pass): Uniforms =>
  // `as`: every pass built here carries `uniforms`; the addon types spell it `object` on three of
  // them, which is the only reason this cannot be read off the declaration.
  (pass as unknown as { uniforms: Uniforms }).uniforms

const num = (params: EffectParams, key: string, fallback: number): number => {
  const value = params[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const flag = (params: EffectParams, key: string, fallback: boolean): boolean =>
  typeof params[key] === 'boolean' ? params[key] : fallback

const text = (params: EffectParams, key: string): string =>
  typeof params[key] === 'string' ? params[key] : ''

const setVector = (uniforms: Uniforms, name: string, x: number, y: number): void => {
  const held = uniforms[name]?.value
  if (held instanceof Vector2) held.set(x, y)
}

const setColour = (uniforms: Uniforms, name: string, css: string): void => {
  const held = uniforms[name]?.value
  // `setStyle` decodes sRGB into the working space, which is what the chain is in.
  if (held instanceof Color && css !== '') held.setStyle(css)
}

/** One `ShaderPass`, its uniforms written by the caller. The shape most effects here take. */
function shaderEffect(
  shader: object,
  apply: (uniforms: Uniforms, params: EffectParams, view: ViewInfo) => void,
): EffectFactory {
  return () => {
    const pass = new ShaderPass(shader)
    return {
      passes: [pass],
      apply: (params, view) => apply(pass.uniforms, params, view),
      setSize: (width, height) => pass.setSize(width, height),
      dispose: () => pass.dispose(),
    }
  }
}

/** One pixel of the chain, in UV — what every neighbourhood shader steps by. */
const texelOf = (view: ViewInfo): [number, number] => [1 / view.width, 1 / view.height]

const gtao: EffectFactory = context => {
  const pass = new GTAOPass(context.scene, context.camera, context.width, context.height)
  return {
    passes: [pass],
    apply: (params, view) => {
      pass.scene = view.scene
      pass.camera = view.camera
      pass.blendIntensity = num(params, 'blend', 1)
      pass.updateGtaoMaterial({
        radius: num(params, 'radius', 0.25),
        distanceExponent: num(params, 'distanceExponent', 1),
        thickness: num(params, 'thickness', 1),
        scale: num(params, 'scale', 1),
        samples: samplesOf(num(params, 'samples', 16), view.budget),
      })
    },
    setSize: (width, height) => pass.setSize(width, height),
    dispose: () => pass.dispose(),
  }
}

const ssao: EffectFactory = context => {
  const pass = new SSAOPass(context.scene, context.camera, context.width, context.height)
  return {
    passes: [pass],
    apply: (params, view) => {
      pass.scene = view.scene
      pass.camera = view.camera
      pass.kernelRadius = num(params, 'radius', 8)
      pass.minDistance = num(params, 'minDistance', 0.005)
      pass.maxDistance = num(params, 'maxDistance', 0.1)
    },
    setSize: (width, height) => pass.setSize(width, height),
    dispose: () => pass.dispose(),
  }
}

const ssaa: EffectFactory = context => {
  const pass = new SSAARenderPass(context.scene, context.camera)
  return {
    passes: [pass],
    apply: (params, view) => {
      pass.scene = view.scene
      pass.camera = view.camera
      // Each level DOUBLES the renders of the scene, so the budget cuts it before anything else.
      pass.sampleLevel = Math.max(1, Math.round(num(params, 'level', 2) * view.budget.samples))
    },
    setSize: (width, height) => pass.setSize(width, height),
    dispose: () => pass.dispose(),
  }
}

const bloom: EffectFactory = context => {
  const pass = new UnrealBloomPass(new Vector2(context.width, context.height), 0.6, 0.4, 0.85)
  return {
    passes: [pass],
    apply: params => {
      pass.strength = num(params, 'strength', 0.6)
      pass.radius = num(params, 'radius', 0.4)
      pass.threshold = num(params, 'threshold', 0.85)
    },
    setSize: (width, height) => pass.setSize(width, height),
    dispose: () => pass.dispose(),
  }
}

const dof: EffectFactory = context => {
  const pass = new BokehPass(context.scene, context.camera, {})
  return {
    passes: [pass],
    apply: (params, view) => {
      pass.scene = view.scene
      pass.camera = view.camera
      const uniforms = uniformsOf(pass)
      uniforms.focus = { value: num(params, 'focusDistance', 10) }
      uniforms.aperture = { value: num(params, 'aperture', 0.005) }
      uniforms.maxblur = { value: num(params, 'maxBlur', 0.01) }
      uniforms.aspect = { value: view.height === 0 ? 1 : view.width / view.height }
    },
    setSize: (width, height) => pass.setSize(width, height),
    dispose: () => pass.dispose(),
  }
}

const lut: EffectFactory = context => {
  const pass = new LUTPass({ intensity: 1 })
  return {
    passes: [pass],
    apply: params => {
      const picked = text(params, 'texture')
      const table = picked === '' ? null : context.lutOf(picked)
      pass.lut = table ?? undefined
      // No table means no grade, whatever the slider says — a LUT still loading must not show as
      // « intensity 1 over nothing », which three draws as the identity anyway but at full cost.
      pass.enabled = table !== null
      pass.intensity = num(params, 'intensity', 1)
    },
    setSize: (width, height) => pass.setSize(width, height),
    dispose: () => pass.dispose(),
  }
}

const blur: EffectFactory = () => {
  const across = new ShaderPass(blurAxisShader)
  const down = new ShaderPass(blurAxisShader)
  setVector(down.uniforms, 'direction', 0, 1)

  return {
    passes: [across, down],
    apply: (params, view) => {
      const radius = num(params, 'radius', 2)
      const boxed = params.kind === 'box' ? 1 : 0
      const [x, y] = texelOf(view)
      for (const pass of [across, down]) {
        pass.uniforms.radius = { value: radius }
        pass.uniforms.boxed = { value: boxed }
        setVector(pass.uniforms, 'texel', x, y)
      }
      setVector(across.uniforms, 'direction', 1, 0)
      setVector(down.uniforms, 'direction', 0, 1)
    },
    setSize: (width, height) => {
      across.setSize(width, height)
      down.setSize(width, height)
    },
    dispose: () => {
      across.dispose()
      down.dispose()
    },
  }
}

const halftone: EffectFactory = () => {
  const pass = new HalftonePass({})
  return {
    passes: [pass],
    apply: (params, view) => {
      // The shapes are named on the panel and numbered in the shader, one-based.
      const shape = HALFTONE_SHAPES.indexOf(text(params, 'shape'))
      pass.uniforms.shape.value = shape < 0 ? 1 : shape + 1
      pass.uniforms.radius.value = num(params, 'radius', 4)
      pass.uniforms.scatter.value = num(params, 'scatter', 0)
      pass.uniforms.blending.value = num(params, 'blending', 1)
      pass.uniforms.width.value = view.width
      pass.uniforms.height.value = view.height
    },
    setSize: (width, height) => pass.setSize(width, height),
    dispose: () => pass.dispose(),
  }
}

const glitch: EffectFactory = () => {
  const pass = new GlitchPass()
  return {
    passes: [pass],
    apply: params => {
      pass.goWild = flag(params, 'wild', false)
    },
    setSize: (width, height) => pass.setSize(width, height),
    dispose: () => pass.dispose(),
  }
}

const passOnly =
  (make: () => Pass): EffectFactory =>
  () => {
    const pass = make()
    return {
      passes: [pass],
      apply: () => {},
      setSize: (width, height) => pass.setSize(width, height),
      dispose: () => pass.dispose(),
    }
  }

/**
 * Every effect that keeps a pass of its own. Anything NOT here is fused — see `FUSABLE_EFFECTS`,
 * and `postFactories.test.ts`, which holds the two tables to covering the catalogue exactly once.
 */
export const STANDALONE_EFFECTS: Readonly<Partial<Record<PostEffectId, EffectFactory>>> = {
  gtao,
  ssao,
  ssaa,
  bloom,
  dof,
  lut,
  blur,
  halftone,
  glitch,
  fxaa: passOnly(() => new FXAAPass()),
  smaa: passOnly(() => new SMAAPass()),

  chromaticAberration: shaderEffect(chromaticAberrationShader, (uniforms, params) => {
    uniforms.amount = { value: num(params, 'amount', 0.003) }
    uniforms.radial = { value: flag(params, 'radial', true) ? 1 : 0 }
  }),

  sharpen: shaderEffect(sharpenShader, (uniforms, params, view) => {
    uniforms.amount = { value: num(params, 'amount', 0.5) }
    const [x, y] = texelOf(view)
    setVector(uniforms, 'texel', x, y)
  }),

  outline: shaderEffect(outlineShader, (uniforms, params, view) => {
    uniforms.thickness = { value: num(params, 'thickness', 1) }
    uniforms.threshold = { value: num(params, 'threshold', 0.1) }
    uniforms.opacity = { value: num(params, 'opacity', 1) }
    setColour(uniforms, 'lineColour', text(params, 'colour'))
    const [x, y] = texelOf(view)
    setVector(uniforms, 'texel', x, y)
  }),

  rgbShift: shaderEffect(RGBShiftShader, (uniforms, params) => {
    uniforms.amount = { value: num(params, 'amount', 0.0015) }
    uniforms.angle = { value: num(params, 'angle', 0) }
  }),

  crt: shaderEffect(crtShader, (uniforms, params, view) => {
    uniforms.curvature = { value: num(params, 'curvature', 0.25) }
    uniforms.scanline = { value: num(params, 'scanline', 0.3) }
    uniforms.aberration = { value: num(params, 'aberration', 0.002) }
    uniforms.edgeFall = { value: num(params, 'vignette', 0.4) }
    setVector(uniforms, 'resolution', view.width, view.height)
  }),

  vhs: shaderEffect(vhsShader, (uniforms, params, view) => {
    uniforms.bleed = { value: num(params, 'bleed', 0.006) }
    uniforms.jitter = { value: num(params, 'jitter', 0.004) }
    uniforms.noise = { value: num(params, 'noise', 0.15) }
    uniforms.bands = { value: num(params, 'bands', 0.3) }
    uniforms.seed = { value: view.time }
  }),
}
