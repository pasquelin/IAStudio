import type { JobProgress } from '@shared/domain/job'
import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { log } from '@main/log'
import { createStudioEventBus } from './eventBus'
import { createMissionJournal } from './journal'
import { createMissionManager, type MissionManager } from './manager'
import type { MissionRuntime } from './runtime'
import { createMissionStore } from './store'

async function resumeMissionsForJob(
  missions: MissionManager,
  runtime: MissionRuntime | null,
  jobId: string,
): Promise<void> {
  try {
    for (const mission of await missions.list({})) {
      if (mission.waits.some(wait => wait.kind === 'job' && wait.jobId === jobId)) {
        await runtime?.scheduler.resumeJob(mission.id, jobId)
      }
    }
  } catch (error) {
    log.warn('assistant', `could not resume missions for job ${jobId}: ${String(error)}`)
  }
}

export function createMissionServices(now: () => string) {
  const journal = createMissionJournal(() => app.getPath('userData'), now)
  const events = createStudioEventBus((error, event) =>
    log.warn('assistant', `studio event ${event.id} listener failed: ${String(error)}`),
  )
  const store = createMissionStore(journal, (error, mission) =>
    log.warn('assistant', `mission ${mission.id} listener failed: ${String(error)}`),
  )
  const clock = { now, newId: randomUUID }
  const missions = createMissionManager(store, events, clock)
  let runtime: MissionRuntime | null = null
  return {
    missions,
    studioEvents: events,
    missionClock: clock,
    connectMissionRuntime: (connected: MissionRuntime): void => {
      runtime = connected
      const start = async (): Promise<void> => {
        try {
          await connected.start()
        } catch (error) {
          log.warn('assistant', `could not resume missions: ${String(error)}`)
        }
      }
      void start()
    },
    onJobProgress: (progress: JobProgress): void => {
      if (progress.status !== 'queued' && progress.status !== 'running') {
        void resumeMissionsForJob(missions, runtime, progress.id)
      }
    },
  }
}
