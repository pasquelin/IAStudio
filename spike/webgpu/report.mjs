/**
 * Met les mesures en tableaux. Aucune mesure ici : ce fichier ne fait que lire `results.json`
 * et le mettre en forme, pour qu'une relecture puisse refaire le calcul à la main.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] ?? 'results.json'
const { results, failures, at, chrome, electron } = JSON.parse(
  readFileSync(join(HERE, file), 'utf8'),
)

const key = row => `${row.case}@${row.count}`
const byKey = new Map()
for (const row of results) {
  const bag = byKey.get(key(row)) ?? {}
  bag[row.backend] = row
  byKey.set(key(row), bag)
}

const num = (value, digits = 2) =>
  value === null || value === undefined || Number.isNaN(value) ? '—' : value.toFixed(digits)

/** Le rapport WebGPU/WebGL : au-dessus de 1, WebGPU coûte PLUS cher. */
const ratio = (one, other) =>
  one > 0 && other > 0 ? `${(other / one).toFixed(2)}×` : '—'

console.log(`# Spike WebGL vs WebGPU — ${at}`)
console.log(`Electron ${electron}, Chromium ${chrome}\n`)

console.log('| scénario | objets | FPS GL | FPS GPU | CPU rendu GL (méd/p99) | CPU rendu WGPU (méd/p99) | GPU GL (méd/p99) | GPU WGPU (méd/p99) | CPU sync | draw calls GL/WGPU | triangles |')
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')

for (const [name, pair] of byKey) {
  const gl = pair.webgl
  const wg = pair.webgpu
  const [scenario, count] = name.split('@')
  const cell = (row, field) =>
    row?.[field] ? `${num(row[field].median)} / ${num(row[field].p99)}` : '—'
  console.log(
    `| ${scenario} | ${count} | ${num(gl?.fpsMedian, 1)} | ${num(wg?.fpsMedian, 1)} | ` +
      `${cell(gl, 'cpuRenderMs')} | ${cell(wg, 'cpuRenderMs')} | ` +
      `${cell(gl, 'gpuMs')} | ${cell(wg, 'gpuMs')} | ` +
      `${num(gl?.cpuSyncMs?.median)} | ${gl?.drawCalls ?? '—'} / ${wg?.drawCalls ?? '—'} | ` +
      `${(gl?.triangles ?? 0).toLocaleString('fr-FR')} |`,
  )
}

console.log('\n## Rapports WebGPU / WebGL (>1 = WebGPU plus lent)\n')
console.log('| scénario | objets | CPU rendu | GPU | mémoire tas après |')
console.log('|---|---:|---:|---:|---:|')
for (const [name, pair] of byKey) {
  const [scenario, count] = name.split('@')
  console.log(
    `| ${scenario} | ${count} | ${ratio(pair.webgl?.cpuRenderMs?.median, pair.webgpu?.cpuRenderMs?.median)} | ` +
      `${ratio(pair.webgl?.gpuMs?.median, pair.webgpu?.gpuMs?.median)} | ` +
      `${ratio(pair.webgl?.heapMbAfter, pair.webgpu?.heapMbAfter)} |`,
  )
}

console.log('\n## Construction de la scène et mémoire\n')
console.log('| scénario | objets | build GL (ms) | build WGPU (ms) | tas GL (Mo) | tas WGPU (Mo) |')
console.log('|---|---:|---:|---:|---:|---:|')
for (const [name, pair] of byKey) {
  const [scenario, count] = name.split('@')
  console.log(
    `| ${scenario} | ${count} | ${num(pair.webgl?.buildMs, 1)} | ${num(pair.webgpu?.buildMs, 1)} | ` +
      `${num(pair.webgl?.heapMbAfter, 1)} | ${num(pair.webgpu?.heapMbAfter, 1)} |`,
  )
}

if (failures?.length) {
  console.log('\n## Échecs\n')
  for (const one of failures) console.log(`- \`${one.backend}\` ${one.case}@${one.count} — ${one.error ?? one.fatal}`)
}
