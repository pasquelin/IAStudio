type SplashApi = {
  onStep: (callback: (label: string, index: number, total: number) => void) => void
}

function isSplashApi(value: unknown): value is SplashApi {
  return typeof value === 'object' && value !== null && 'onStep' in value
}

const step = document.getElementById('step')
const fill = document.getElementById('fill')
const version = document.getElementById('version')

// Carried by the fragment rather than a second IPC message: the main process already picks
// the URL, and the value never changes while the splash is up.
if (version) version.textContent = decodeURIComponent(window.location.hash.slice(1))

const api: unknown = Reflect.get(window, 'splash')

if (isSplashApi(api) && step && fill) {
  api.onStep((label, index, total) => {
    step.textContent = label
    fill.style.width = `${Math.round((index / total) * 100)}%`
  })
}
