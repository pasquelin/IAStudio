import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import runtime from '../../../engine/autorig-runtime.json'
import { shippedModel } from './catalogue'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const read = (path: string): string => readFileSync(join(ROOT, path), 'utf8')

describe('Auto Rig release runtime', () => {
  it('ships only the measured minimal Python dependency path', () => {
    expect(runtime.distributions.map(distribution => distribution.name)).toEqual([
      'einops',
      'filelock',
      'fsspec',
      'jinja2',
      'markupsafe',
      'mpmath',
      'networkx',
      'numpy',
      'pip',
      'setuptools',
      'sympy',
      'torch',
      'typing-extensions',
    ])
    expect(runtime.distributions.every(distribution => distribution.licence.length > 0)).toBe(true)
    expect(runtime.distributions.every(distribution => distribution.wheel.endsWith('.whl'))).toBe(
      true,
    )
    const project = read('engine/pyproject.toml')
    const autorig = /autorig\s*=\s*\[([\s\S]*?)\]/.exec(project)?.[1] ?? ''
    expect(autorig).not.toMatch(/torch-cluster|timm|torchvision|gradio|bpy/)
  })

  it('keeps the blocked runtime out of the public packaging hook', () => {
    const prepare = read('scripts/prepare-engine-runtime.mjs')
    const beforePack = read('scripts/before-pack.mjs')
    const fetchEngine = read('scripts/fetch-engine.mjs')
    const builder = read('electron-builder.yml')

    expect(prepare).toContain("'--locked'")
    expect(prepare).toContain("'--only-binary'")
    expect(prepare).toContain("'autorig'")
    expect(beforePack).not.toContain('prepareEngineRuntime')
    expect(fetchEngine).not.toContain('readFileSync(stamp')
    expect(builder).not.toContain('Contents/Resources/engine/python/lib/**/*.dylib')
    expect(builder).not.toContain('Contents/Resources/engine/python/lib/**/*.so')
  })

  it('keeps all checkpoint deserialisation behind digest verification and safe loading', () => {
    const model = shippedModel('make-it-animatable')
    const loader = read('engine/src/ia_studio_engine/vendor/make_it_animatable/model.py')

    expect(model?.licenceStatus).toBe('restricted')
    expect(model?.distributionStatus).toBe('blocked')
    expect(model?.files).toHaveLength(4)
    expect(model?.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true)
    expect(loader.match(/weights_only=True/g)).toHaveLength(2)
  })

  it('prevents Python imports from changing the signed application seal', () => {
    expect(read('src/main/ai/pythonProcess.ts')).toContain("PYTHONDONTWRITEBYTECODE: '1'")
  })
})
