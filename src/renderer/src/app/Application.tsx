import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { connectRemoteActions } from '@/assistant/remote-actions'
import { useAccountChange } from '@/hooks/useAccountChange'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { useMainLogs } from '@/hooks/useMainLogs'
import { useNativeMenu } from '@/hooks/useNativeMenu'
import { useHeldCommand } from '@/hooks/useShortcuts'
import { useWindowFit } from '@/hooks/useWindowFit'
import { useAccounts } from '@/stores/accounts'
import { useAssets } from '@/stores/assets'
import { useJobs } from '@/stores/jobs'
import { useDictation as useDictationStore } from '@/stores/dictation'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { useActivity } from '@/stores/activity'
import { useUpdates } from '@/stores/updates'
import { connectImageGeneration } from '@/stores/imageGeneration'
import { connectModelGeneration } from '@/stores/modelGeneration'
import { connectPreparation } from '@/stores/preparation'
import { connectSceneSelection } from '@/stores/sceneSelection'
import { connectSkyboxGeneration } from '@/stores/skyboxGeneration'
import { Shell } from './Shell/Shell'

export function Application() {
  useMainLogs()
  useNativeMenu()
  useWindowFit()

  const connectSettings = useSettings(state => state.connect)
  const connectAccounts = useAccounts(state => state.connect)
  const connectProject = useProject(state => state.connect)
  const connectJobs = useJobs(state => state.connect)
  const connectMedia = useMedia(state => state.connect)
  const connectDictation = useDictationStore(state => state.connect)
  const connectUpdates = useUpdates(state => state.connect)
  const connectActivity = useActivity(state => state.connect)
  const connectAssets = useAssets(state => state.connect)

  useEffect(() => {
    const subscriptions = [
      connectSettings(),
      connectAccounts(),
      connectProject(),
      connectJobs(),
      connectMedia(),
      connectDictation(),
      connectUpdates(),
      connectActivity(),
      connectAssets(),
    ]
    return () => {
      for (const subscription of subscriptions) void subscription.then(stop => stop())
    }
  }, [
    connectSettings,
    connectAccounts,
    connectProject,
    connectJobs,
    connectMedia,
    connectDictation,
    connectUpdates,
    connectActivity,
    connectAssets,
  ])

  // Store to store rather than through the main process, so each subscribes on its own: what a
  // generation produced lands in the document that asked for it, whichever workspace that was.
  useEffect(() => connectSkyboxGeneration(), [])
  useEffect(() => connectImageGeneration(), [])
  useEffect(() => connectModelGeneration(), [])

  // Same reason, the other way round: what an edit asked the generator to open on belongs to the
  // space that asked, and has to close when the user leaves it.
  useEffect(() => connectPreparation(), [])

  // An action asked for from outside the application lands on the same gate the modal uses, so
  // a generation started from a terminal still asks on this screen before it spends.
  useEffect(() => connectRemoteActions(), [])

  // Same reason again: a scene selects from four doors — the outliner, the viewport, the node
  // panels and its own COMMANDS — and only the inspector needs to hear about all four.
  useEffect(() => connectSceneSelection(), [])

  useAppliedSettings()
  useDictationShortcut()

  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  )

  /*
   * Everything cached from the API belongs to the account that was active when it was fetched,
   * and none of the query keys say which. Without this, switching accounts leaves the previous
   * one's models and their signed previews on screen — nothing refetches them, since the keys
   * did not change and `refetchOnWindowFocus` is off.
   */
  useAccountChange(() => client.clear())

  return (
    <QueryClientProvider client={client}>
      <Shell />
    </QueryClientProvider>
  )
}

/**
 * The push-to-talk key, heard once for the whole window.
 *
 * Here rather than in a panel: dictation writes wherever the caret is, so it belongs to the
 * shell and not to whichever surface happens to be open. What holding and releasing mean is
 * the store's business — see `setHeld`.
 */
function useDictationShortcut(): void {
  const enabled = useSettings(state => state.settings.dictation.enabled)
  const setHeld = useDictationStore(state => state.setHeld)

  useHeldCommand(
    'app.dictate',
    enabled,
    useCallback(held => void setHeld(held), [setHeld]),
  )
}
