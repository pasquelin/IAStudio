import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityList } from '@/features/shell/components/Activity/List/ActivityList'
import { WindowShell } from '@/components/WindowShell'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { useActivity } from '@/stores/activity'
import { useProject } from '@/stores/project'

/**
 * 🛑 The PROJECT as well as the journal: the journal lives in the open project's catalogue and
 * its ids restart at 1 for each, so a window hearing the lines without hearing the change would
 * stack two projects' accounts into one list.
 */
export function JournalWindow() {
  const { t } = useTranslation()
  const connectActivity = useActivity(state => state.connect)
  const connectProject = useProject(state => state.connect)
  useAppliedSettings()

  useEffect(() => {
    let gone = false
    const open: (() => void)[] = []

    // One at a time, and NOT through `useConnections`, which opens its batch all at once: journal
    // ids restart at 1 per project, so a window hearing the lines before the change would stack
    // two projects' accounts into one list.
    const subscribe = async (): Promise<void> => {
      for (const connect of [connectProject, connectActivity]) {
        const stop = await connect()
        if (gone) stop()
        else open.push(stop)
      }
    }
    void subscribe()

    return () => {
      gone = true
      for (const stop of open) stop()
    }
  }, [connectProject, connectActivity])

  return (
    <WindowShell title={t('activity.windowTitle')}>
      <ActivityList whole />
    </WindowShell>
  )
}
