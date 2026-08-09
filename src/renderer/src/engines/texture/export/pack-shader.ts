import { ShaderMaterial, type Texture } from 'three'
import {
  assetsOf,
  type ResolvedComponent,
  type ResolvedPicture,
} from '@shared/domain/texture-export'
import { QUAD_VERTEX_SHADER } from '../../gpu/passes/quad'
import { PIXEL_PREAMBLE } from '../derive/glsl'
import type { OffscreenPass } from '../derive/offscreen'

/**
 * One shader that writes one exported picture.
 *
 * Every target's recipe is the same operation with different wiring — copy a channel, pack
 * three into one, invert a green — so there is one pass rather than one per engine, and it is
 * built from the recipe the domain already resolved. In one pass on the GPU, per invariant 6:
 * a 4K ORM is 16 million pixels, and three of them read per pixel.
 *
 * The sources are sampled in uv rather than in texels, so channels of different sizes pack
 * together and land on the frame the caller sized — which is also how a target with a ceiling
 * on its maps gets one for free.
 */

/**
 * A number GLSL will read as a float. `1` is an int there, and `vec4(1, ...)` fails to compile
 * on a driver that does not implicitly convert — which is the driver somebody else is on.
 */
function glslFloat(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`
}

/** What one component of the output reads, as an expression. */
function expressionFor(component: ResolvedComponent, indexOf: (assetId: string) => number): string {
  if ('constant' in component) return glslFloat(component.constant)

  const sample = `texture2D(uSource${indexOf(component.assetId)}, vUv).${component.from}`
  return component.invert ? `(1.0 - ${sample})` : sample
}

type PackUniforms = Record<string, { value: Texture }>

/**
 * The pass that writes one picture, aimed at the channels it reads.
 *
 * Throws for an asset the caller did not decode: a sampler left unbound reads black on every
 * driver, and an ORM whose roughness came out black is a texture that ships fully polished
 * with nothing on the way to say why.
 */
export function createPackPass(
  picture: ResolvedPicture,
  textureFor: (assetId: string) => Texture | undefined,
): OffscreenPass {
  const assets = assetsOf(picture)

  const uniforms: PackUniforms = {}
  const declarations: string[] = []

  assets.forEach((assetId, index) => {
    const texture = textureFor(assetId)
    if (!texture) throw new Error(`${picture.name} reads ${assetId}, which was not decoded`)

    uniforms[`uSource${index}`] = { value: texture }
    declarations.push(`uniform sampler2D uSource${index};`)
  })

  const indexOf = (assetId: string): number => assets.indexOf(assetId)

  const fragmentShader = /* glsl */ `
${PIXEL_PREAMBLE}
${declarations.join('\n')}

void main() {
  gl_FragColor = vec4(
    ${expressionFor(picture.red, indexOf)},
    ${expressionFor(picture.green, indexOf)},
    ${expressionFor(picture.blue, indexOf)},
    ${expressionFor(picture.alpha, indexOf)}
  );
}
`

  return {
    material: new ShaderMaterial({ vertexShader: QUAD_VERTEX_SHADER, fragmentShader, uniforms }),
  }
}
