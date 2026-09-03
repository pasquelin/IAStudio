import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  COMPLEXITY_THRESHOLD,
  LIMITS,
  analyseTypeScript,
  violationsFor,
} from '../../scripts/check-sizes.mjs'

const temporary: string[] = []

afterEach(() => {
  for (const directory of temporary.splice(0)) rmSync(directory, { recursive: true })
})

const block = (header: string, footer: string, count: number): string =>
  [
    header,
    ...Array.from({ length: count - 2 }, (_, index) => `  const value${index} = ${index}`),
    footer,
  ].join('\n')

describe('size guard', () => {
  it('treats every limit as strict', () => {
    const source = `${block('class Large {', '}', LIMITS.class)}\n${'// filler\n'.repeat(LIMITS.file - LIMITS.class)}`
    const file = join(mkdtempSync(join(tmpdir(), 'sizes-')), 'fixture.ts')
    temporary.push(file.slice(0, file.lastIndexOf('/')))
    writeFileSync(file, source)
    const findings = violationsFor(file)
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'file', lines: LIMITS.file }),
        expect.objectContaining({ kind: 'class', lines: LIMITS.class }),
      ]),
    )
  })

  it('distinguishes functions, hooks and JSX components', () => {
    const source = [
      block('function ordinary() {', '}', LIMITS.function),
      block('function useLarge() {', '}', LIMITS.hook),
      block('function Panel() {', '  return <div />\n}', LIMITS.component - 1),
    ].join('\n')
    expect(analyseTypeScript(source)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'function', name: 'ordinary', lines: LIMITS.function }),
        expect.objectContaining({ kind: 'hook', name: 'useLarge', lines: LIMITS.hook }),
        expect.objectContaining({ kind: 'component', name: 'Panel', lines: LIMITS.component }),
      ]),
    )
  })

  it('applies the reduced limit at cyclomatic complexity 10', () => {
    const decisions = Array.from(
      { length: COMPLEXITY_THRESHOLD - 1 },
      (_, index) => `  if (values[${index}]) return ${index}`,
    ).join('\n')
    const filler = Array.from(
      { length: LIMITS.complex - COMPLEXITY_THRESHOLD - 2 },
      () => '  void values',
    ).join('\n')
    const source = `function decide(values: boolean[]) {\n${decisions}\n${filler}\n  return -1\n}`
    expect(analyseTypeScript(source)).toContainEqual(
      expect.objectContaining({
        kind: 'complex',
        complexity: COMPLEXITY_THRESHOLD,
        lines: LIMITS.complex,
      }),
    )
  })

  it('analyses Python classes and functions with the same strict bounds', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sizes-'))
    temporary.push(directory)
    const file = join(directory, 'fixture.py')
    writeFileSync(
      file,
      ['class Large:', ...Array.from({ length: LIMITS.class - 1 }, () => '    pass')].join('\n'),
    )
    expect(violationsFor(file)).toContainEqual(
      expect.objectContaining({ kind: 'class', lines: LIMITS.class }),
    )
  })
})
