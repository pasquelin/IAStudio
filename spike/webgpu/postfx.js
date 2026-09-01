/**
 * Le post-traitement, écrit DEUX FOIS parce qu'il n'existe pas de forme commune.
 *
 * 🛑 C'est le point d'incompatibilité central du sujet : `EffectComposer` + `ShaderPass` en GLSL
 * n'a aucun équivalent sous `WebGPURenderer`, qui compose par un graphe de nœuds (TSL). Les deux
 * chaînes ci-dessous font la MÊME chose à l'écran — un étalonnage, puis un vignettage — pour que
 * la comparaison porte sur le coût et non sur l'effet.
 */
import { Vector2 } from 'three'

const GRADE_FRAGMENT = `
  uniform sampler2D tDiffuse;
  uniform float uGain;
  uniform float uLift;
  varying vec2 vUv;
  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(clamp(texel.rgb * uGain + uLift, 0.0, 1.0), texel.a);
  }
`

const VIGNETTE_FRAGMENT = `
  uniform sampler2D tDiffuse;
  uniform float uAmount;
  varying vec2 vUv;
  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    float away = length(vUv - vec2(0.5));
    gl_FragColor = vec4(texel.rgb * clamp(1.0 - away * uAmount, 0.0, 1.0), texel.a);
  }
`

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export async function buildWebglPost(renderer, scene, camera, size) {
  const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js')
  const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js')
  const { ShaderPass } = await import('three/addons/postprocessing/ShaderPass.js')
  const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js')

  const composer = new EffectComposer(renderer)
  composer.setSize(size.width, size.height)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(
    new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uGain: { value: 1.08 }, uLift: { value: -0.02 } },
      vertexShader: VERTEX,
      fragmentShader: GRADE_FRAGMENT,
    }),
  )
  composer.addPass(
    new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uAmount: { value: 0.9 } },
      vertexShader: VERTEX,
      fragmentShader: VIGNETTE_FRAGMENT,
    }),
  )
  composer.addPass(new OutputPass())

  return {
    passes: 4,
    draw: () => composer.render(),
    dispose: () => composer.dispose(),
  }
}

export async function buildWebgpuPost(renderer, scene, camera) {
  const { PostProcessing } = await import('three/webgpu')
  const { pass, screenUV, vec4, float } = await import('three/tsl')

  const scenePass = pass(scene, camera)
  const graded = scenePass.rgb.mul(1.08).add(-0.02).clamp(0, 1)
  const away = screenUV.sub(new Vector2(0.5, 0.5)).length()
  const vignette = float(1).sub(away.mul(0.9)).clamp(0, 1)

  const post = new PostProcessing(renderer)
  post.outputNode = vec4(graded.mul(vignette), scenePass.a)

  return {
    passes: 4,
    draw: () => post.render(),
    disposeAsync: async () => post.dispose?.(),
    dispose: () => post.dispose?.(),
  }
}
