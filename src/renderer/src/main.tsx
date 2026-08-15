import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { isLicencesRoute } from '@shared/domain/licence'
import { isManualRoute } from '@shared/domain/manual'
import { isMirrorRoute } from '@shared/domain/mirror'
import { isSettingsRoute } from '@shared/domain/settings'
import { isUsageRoute } from '@shared/domain/usage'
import { UNKNOWN_SYSTEM_LANGUAGE } from '@shared/i18n'
import { Application } from '@/app/Application'
import { getBridge } from '@/services/bridge'
import { ROOT_ERROR_REPORTING } from '@/app/root-errors'
import { ErrorBoundary } from '@/design/ErrorBoundary'
import { Failure } from '@/design/Failure'
import { initI18n } from '@/i18n'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found in index.html')

// Asked, never worked out here — see `StudioBridge['window']['language']`. Falling back rather
// than letting it throw: this runs during module evaluation, which the boundary below cannot
// catch, and a rejected read would leave a permanently empty window. The fallback is the one
// for a machine whose language we do not know, which is exactly what an unanswered read leaves.
const language = await getBridge()
  ?.window.language()
  .catch(() => UNKNOWN_SYSTEM_LANGUAGE)
await initI18n(language ?? UNKNOWN_SYSTEM_LANGUAGE)

/** Same reason as the licences below, for another window's folder: registry, sections, draft. */
const SettingsWindow = lazy(async () => ({
  default: (await import('@/settings/SettingsWindow')).SettingsWindow,
}))

/**
 * The whole notice — every shipped licence, in full — is fifty kilobytes nobody reads in a
 * usual session, and a static import puts it in the chunk the splash waits for.
 */
const LicencesWindow = lazy(async () => ({
  default: (await import('@/licences/LicencesWindow')).LicencesWindow,
}))

/** Lazy for a harder reason than size: the charting library must stay out of the first frame. */
/** Split like its neighbours: the return is opened on purpose, and rarely. */
const MirrorWindow = lazy(async () => ({
  default: (await import('@/spaces/video/MirrorWindow')).MirrorWindow,
}))

const UsageWindow = lazy(async () => ({
  default: (await import('@/usage/UsageWindow')).UsageWindow,
}))

/**
 * Lazy for the plainest reason of the four: `manual.json` is twenty chapters in two languages,
 * and the markdown renderer comes with it. None of it belongs in the chunk the splash waits for.
 */
const ManualWindow = lazy(async () => ({
  default: (await import('@/manual/ManualWindow')).ManualWindow,
}))

/**
 * Every application window loads the same bundle and reads the route from the fragment: the
 * i18n bootstrap, the tokens and the bridge are shared, and navigation is locked, so the
 * fragment is only ever what the main process loaded. The splash is the one exception — it
 * has its own entry precisely so it never pulls this bundle in.
 */
function Route({ hash }: { hash: string }) {
  if (isSettingsRoute(hash)) {
    return (
      <Suspense fallback={null}>
        <SettingsWindow />
      </Suspense>
    )
  }
  if (isLicencesRoute(hash)) {
    return (
      <Suspense fallback={null}>
        <LicencesWindow />
      </Suspense>
    )
  }
  if (isUsageRoute(hash)) {
    return (
      <Suspense fallback={null}>
        <UsageWindow />
      </Suspense>
    )
  }
  if (isMirrorRoute(hash)) {
    return (
      <Suspense fallback={null}>
        <MirrorWindow />
      </Suspense>
    )
  }
  if (isManualRoute(hash)) {
    return (
      <Suspense fallback={null}>
        <ManualWindow />
      </Suspense>
    )
  }
  return <Application />
}

createRoot(root, ROOT_ERROR_REPORTING).render(
  <StrictMode>
    {/* Above the routes: the per-panel boundaries cover the docks, not the shell holding them.
        Renders only, and not this module's own evaluation — a throw there predates the
        boundary and leaves the empty window no React can catch. Event handlers and rejected
        promises are outside too. Retry cannot mend a rejected `lazy()` either: React caches
        the rejection, so the licences route in particular offers a button that cannot win. */}
    <ErrorBoundary fallback={retry => <Failure scope="window" onRetry={retry} />}>
      <Route hash={window.location.hash} />
    </ErrorBoundary>
  </StrictMode>,
)
