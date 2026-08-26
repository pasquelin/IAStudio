import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { connectRemoteActions } from '@/assistant/remoteActions'
import { useAccountChange } from '@/hooks/useAccountChange'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { useMainLogs } from '@/hooks/useMainLogs'
import { useNativeMenu } from '@/hooks/useNativeMenu'
import { useDictationShortcut } from '@/hooks/useDictationShortcut'
import { useWindowFit } from '@/hooks/useWindowFit'
import { useAccounts } from '@/stores/accounts'
import { useAiModels } from '@/stores/aiModels'
import { useAssets } from '@/stores/assets'
import { useTasks } from '@/stores/tasks'
import { useJobs } from '@/stores/jobs'
import { useDictation } from '@/stores/dictation'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { useProjectContext } from '@/stores/projectContext'
import { useSettings } from '@/stores/settings'
import { useActivity } from '@/stores/activity'
import { useUpdates } from '@/stores/updates'
import { connectImageGeneration } from '@/stores/imageGeneration'
import { connectAudioGeneration } from '@/stores/audioGeneration'
import { connectModelGeneration } from '@/stores/modelGeneration'
import { connectSequenceGeneration } from '@/stores/sequenceGeneration'
import { connectMaterialGeneration } from '@/stores/materialGeneration'
import { connectPreparation } from '@/stores/preparation'
import { connectSubSelectionRelease } from '@/stores/subSelection'
import { connectSkyboxGeneration } from '@/stores/skyboxGeneration'
import { Shell } from './Shell/Shell'

export function Application() {
  useMainLogs()
  useNativeMenu()
  useWindowFit()

  const connectSettings = useSettings(state => state.connect)
  const connectAccounts = useAccounts(state => state.connect)
  const connectAiModels = useAiModels(state => state.connect)
  const connectProject = useProject(state => state.connect)
  const connectJobs = useJobs(state => state.connect)
  const connectMedia = useMedia(state => state.connect)
  const connectDictation = useDictation(state => state.connect)
  const connectUpdates = useUpdates(state => state.connect)
  const connectActivity = useActivity(state => state.connect)
  const connectAssets = useAssets(state => state.connect)
  const connectProjectContext = useProjectContext(state => state.connect)
  const connectTasks = useTasks(state => state.connect)

  useEffect(() => {
    const subscriptions = [
      connectSettings(),
      connectAccounts(),
      connectAiModels(),
      connectProject(),
      connectJobs(),
      connectMedia(),
      connectDictation(),
      connectUpdates(),
      connectActivity(),
      connectAssets(),
      connectProjectContext(),
    ]
    return () => {
      for (const subscription of subscriptions) void subscription.then(stop => stop())
    }
  }, [
    connectSettings,
    connectAccounts,
    connectAiModels,
    connectProject,
    connectJobs,
    connectMedia,
    connectDictation,
    connectUpdates,
    connectActivity,
    connectAssets,
    connectProjectContext,
  ])

  // Apart from the batch above, which awaits a promise each: this one hands back its unsubscribe
  // straight away — there is nothing to read before it can listen.
  useEffect(() => connectTasks(), [connectTasks])

  // Store to store rather than through the main process, so each subscribes on its own: what a
  // generation produced lands in the document that asked for it, whichever workspace that was.
  useEffect(() => connectSkyboxGeneration(), [])
  useEffect(() => connectImageGeneration(), [])
  useEffect(() => connectModelGeneration(), [])
  useEffect(() => connectSequenceGeneration(), [])
  useEffect(() => connectAudioGeneration(), [])
  useEffect(() => connectMaterialGeneration(), [])

  // Same reason, the other way round: what an edit asked the generator to open on belongs to the
  // space that asked, and has to close when the user leaves it.
  useEffect(() => connectPreparation(), [])

  // An action asked for from outside the application lands on the same gate the modal uses, so
  // a generation started from a terminal still asks on this screen before it spends.
  useEffect(() => connectRemoteActions(), [])

  // Same reason again: a scene selects from four doors — the outliner, the viewport, the node
  // panels and its own COMMANDS — and only the inspector needs to hear about all four.
  useEffect(() => connectSubSelectionRelease(), [])

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
