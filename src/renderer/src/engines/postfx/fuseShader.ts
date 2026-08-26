/**
 * Several per-pixel effects, compiled into ONE full-frame draw.
 *
 * This is where the performance of the whole system is decided. A chain of `ShaderPass` costs one
 * read and one write of the entire frame PER EFFECT, and the arithmetic each of them does is a
 * handful of instructions: a cinematic look — grade, vignette, grain — is three passes moving
 * three frames of bandwidth to spend perhaps thirty cycles. Fused, it is one.
 *
 * Two kinds of chunk fuse, and the distinction is not a taste:
 *
 * - a **`uv` chunk** moves the coordinate BEFORE the single fetch — a distortion, a pixel grid;
 * - a **`colour` chunk** works on the fetched colour — a grade, a grain, a vignette.
 *
 * Anything that needs to read the picture at more than one place (a blur, an edge, a fringe)
 * cannot fuse and keeps a pass of its own: fused, it would sample the pass INPUT rather than what
 * the effects before it produced, which is a different picture.
 *
 * Pure, and deliberately: it takes strings and gives strings, so what a stack compiles to is
 * read and asserted under vitest, where there is no WebGL at all.
 */
import type { IUniform } from 'three'
import { PRELUDE, QUAD_VERTEX } from './shaders/quadVertex'

export type FusableKind = 'uv' | 'colour'

/**
 * One effect, as something that can be merged into a shared shader.
 *
 * `body` is a run of statements, not a function: a `uv` chunk assigns to `uv`, a `colour` chunk
 * assigns to `colour`, and both may read either. Every identifier it declares — uniforms and
 * helpers alike — is rewritten with a per-instance prefix, so two graders in one stack do not
 * collide.
 */
export type FusableChunk = {
  kind: FusableKind
  uniforms: Readonly<Record<string, IUniform>>
  /** Functions the body calls. Their names are rewritten like the uniforms'. */
  helpers?: readonly string[]
  body: string
}

/** What one fused pass draws, and the uniforms it was built with — one entry per instance. */
export type FusedShader = {
  fragmentShader: string
  uniforms: Record<string, IUniform>
  /** For each fused instance, in order, the map from its own name to the name in the shader. */
  naming: readonly Readonly<Record<string, string>>[]
}

/** Every identifier a helper declares, so calls to it are rewritten with its declaration. */
const HELPER_NAME = /(?:^|\s)(?:float|vec2|vec3|vec4|mat2|mat3|mat4|void)\s+([A-Za-z_]\w*)\s*\(/gu

function helperNamesIn(source: string): string[] {
  return [...source.matchAll(HELPER_NAME)].flatMap(match => (match[1] ? [match[1]] : []))
}

/**
 * The same source with every listed identifier prefixed.
 *
 * Word-bounded and applied in ONE pass over the alternation rather than name by name: renaming
 * `gain` then `gamma` in sequence would rewrite the `gain` inside an already-renamed `u0_gain`.
 */
function renamed(source: string, names: readonly string[], prefix: string): string {
  if (names.length === 0) return source
  const pattern = new RegExp(`\\b(${names.map(escapeName).join('|')})\\b`, 'gu')
  return source.replace(pattern, matched => `${prefix}${matched}`)
}

function escapeName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

const GLSL_TYPES: Record<string, string> = {
  number: 'float',
  boolean: 'bool',
}

/** How a uniform's CURRENT value spells its type — the only description three gives us. */
function typeOf(uniform: IUniform): string {
  const value: unknown = uniform.value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return GLSL_TYPES[typeof value] ?? 'float'
  }
  if (isVectorLike(value, 'z')) return 'vec3'
  if (isVectorLike(value, 'y')) return 'vec2'
  // A colour carries r/g/b and rides as a vec3; anything else has no business being fused.
  if (isRecord(value) && 'r' in value) return 'vec3'
  return 'float'
}

function isVectorLike(value: unknown, last: string): boolean {
  return isRecord(value) && 'x' in value && last in value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * The fragment shader a run of fusable chunks compiles to, and the uniforms it reads.
 *
 * The order is the caller's, with one rule that the caller has already applied: every `uv` chunk
 * comes before every `colour` chunk, because there is exactly one fetch and it sits between them.
 * A run that would need a second fetch is split upstream — see `runsOf` in `postPlan`.
 */
export function fuseShader(chunks: readonly FusableChunk[]): FusedShader {
  const uniforms: Record<string, IUniform> = { tDiffuse: { value: null } }
  const declarations: string[] = []
  const helpers: string[] = []
  const beforeFetch: string[] = []
  const afterFetch: string[] = []
  const naming: Record<string, string>[] = []

  for (const [index, chunk] of chunks.entries()) {
    const prefix = `fx${index}_`
    const names = [...Object.keys(chunk.uniforms), ...(chunk.helpers ?? []).flatMap(helperNamesIn)]
    const map: Record<string, string> = {}

    for (const [name, uniform] of Object.entries(chunk.uniforms)) {
      map[name] = `${prefix}${name}`
      uniforms[map[name]] = uniform
      declarations.push(`uniform ${typeOf(uniform)} ${map[name]};`)
    }
    naming.push(map)

    for (const helper of chunk.helpers ?? []) helpers.push(renamed(helper, names, prefix))
    const body = renamed(chunk.body, names, prefix)
    ;(chunk.kind === 'uv' ? beforeFetch : afterFetch).push(`  {\n${body}\n  }`)
  }

  return {
    uniforms,
    naming,
    fragmentShader: `
uniform sampler2D tDiffuse;
${declarations.join('\n')}

varying vec2 vUv;

${PRELUDE}
${helpers.join('\n')}

void main() {
  vec2 uv = vUv;
  // What a coordinate chunk uses to say « nothing to read here » — a distortion pushing a corner
  // outside the source. A flag rather than an early return: there is one fetch for all of them.
  float mask = 1.0;
${beforeFetch.join('\n')}

  vec4 texel = texture2D(tDiffuse, clamp(uv, 0.0, 1.0));
  vec3 colour = texel.rgb * mask;
${afterFetch.join('\n')}

  gl_FragColor = vec4(max(colour, vec3(0.0)), texel.a);
}
`,
  }
}

export { QUAD_VERTEX }
