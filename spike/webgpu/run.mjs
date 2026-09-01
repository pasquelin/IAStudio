/**
 * Lance le banc : un serveur Vite sur ce dossier, une vraie fenêtre Electron dessus, et le
 * rapport écrit sur le disque.
 *
 * La fenêtre est VISIBLE et `backgroundThrottling` désactivé : une fenêtre cachée ou reléguée
 * en arrière-plan se fait brider par Chromium, et le banc mesurerait le bridage.
 */
import { app, BrowserWindow } from 'electron'
import { createServer } from 'vite'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const PATIENCE_MS = 30 * 60 * 1000

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

async function main() {
  const server = await createServer({
    root: HERE,
    configFile: false,
    // Port LIBRE, jamais fixe : une fenetre du banc restee ouverte tenait le port, et le
    // lancement suivant mourait au demarrage en laissant croire a un plantage du banc.
    server: { port: 0, strictPort: false, fs: { allow: [ROOT] } },
    logLevel: 'warn',
    // Le banc du chantier C importe le VRAI moteur : les alias du dépôt, et ses deux constantes.
    resolve: {
      alias: {
        '@shared': resolve(ROOT, 'src/shared'),
        '@main': resolve(ROOT, 'src/main'),
        '@game': resolve(ROOT, 'src/game'),
        '@': resolve(ROOT, 'src/renderer/src'),
      },
    },
    define: { __DEV__: 'true', __COMMIT_HASH__: JSON.stringify('spike') },
  })
  await server.listen()
  const port = server.httpServer.address().port

  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: true,
    webPreferences: { backgroundThrottling: false, offscreen: false },
  })
  win.webContents.on('console-message', event => {
    const text = event.message ?? ''
    if (!text.includes('Security Warning')) console.log('PAGE:', text)
  })
  // Le filtre passe par l'environnement : Electron mange ses propres arguments.
  const query = process.env.SPIKE_QUERY ? `?${process.env.SPIKE_QUERY}` : ''
  const page = process.env.SPIKE_PAGE ?? 'index.html'
  await win.loadURL(`http://localhost:${port}/${page}${query}`)

  let crashed = null
  win.webContents.on('render-process-gone', (_event, details) => {
    crashed = details
    console.log('\nFENÊTRE PERDUE:', JSON.stringify(details))
  })

  const where = join(HERE, process.env.SPIKE_OUT ?? 'results.json')
  const save = payload =>
    writeFileSync(
      where,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          platform: process.platform,
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          crashed,
          ...payload,
        },
        null,
        2,
      ),
    )

  const startedAt = Date.now()
  let report = null
  // Une SÉRIE plutôt qu'un relevé final : la mémoire du processus ne dit rien si on ne sait pas
  // quelle phase du banc tournait quand elle a été prise.
  const memory = []
  while (Date.now() - startedAt < PATIENCE_MS) {
    await wait(2000)
    if (crashed) break
    const done = await win.webContents.executeJavaScript('window.__done === true')
    if (done) {
      report = await win.webContents.executeJavaScript('window.__report')
      // La mémoire du PROCESSUS de la fenêtre, que la page ne peut pas lire elle-même.
      const metrics = app.getAppMetrics().find(one => one.pid === win.webContents.getOSProcessId())
      if (report && metrics) {
        memory.push({ at: Date.now() - startedAt, phase: 'fin', workingSetKb: metrics.memory.workingSetSize })
        report.rendererMemory = memory
      }
      break
    }
    const line = await win.webContents.executeJavaScript(
      'document.querySelector("#log")?.textContent ?? ""',
    )
    console.log(line)
    const metrics = app.getAppMetrics().find(one => one.pid === win.webContents.getOSProcessId())
    if (metrics) memory.push({ at: Date.now() - startedAt, phase: line, workingSetKb: metrics.memory.workingSetSize })
    // Le partiel sur le disque à chaque sondage : ce qui est mesuré est acquis.
    const partial = await win.webContents.executeJavaScript('window.__partial ?? null')
    if (partial) save(partial)
  }
  if (report) save(report)
  console.log(`écrit : ${where}`)
  await server.close()
  app.quit()
}

app.whenReady().then(main)
