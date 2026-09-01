import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import type { Job } from '@shared/domain/job'
import type { FieldDescriptor } from '@shared/domain/model'
import { formatMoment } from '@/helpers/format'
import { useJobs } from '@/stores/jobs'

const NONE: readonly Job[] = []

/** What a target id is served BY — the word before its first colon, and nothing for Scenario's. */
function runtimeOf(targetId: string): string {
  const cut = targetId.indexOf(':')
  return cut === -1 ? '' : targetId.slice(0, cut)
}

/** Their id means something to the service that issued it, and to no other. */
function usable(job: Job, modelId: string): boolean {
  return (
    job.status === 'succeeded' &&
    job.remoteId !== undefined &&
    runtimeOf(job.targetId) === runtimeOf(modelId)
  )
}

/**
 * What a `task` field offers: the runs of THIS service that finished with something to work on.
 *
 * 🛑 The window is the only side that knows what has run — a runner sees one job at a time — so
 * the list is filled here rather than declared in a catalogue.
 */
export function useTaskChoices(
  fields: readonly FieldDescriptor[] | undefined,
  modelId: string | null,
): FieldDescriptor[] {
  const { i18n } = useTranslation()
  const asked = modelId !== null && (fields ?? []).some(field => field.kind === 'task')
  const done = useJobs(
    useShallow(state => (asked ? state.jobs.filter(job => usable(job, modelId ?? '')) : NONE)),
  )

  const options = done.map(job => ({
    value: job.remoteId ?? '',
    label: job.finishedAt
      ? `${job.label} · ${formatMoment(job.finishedAt, i18n.language, 'local')}`
      : job.label,
  }))

  return (fields ?? []).map(field => (field.kind === 'task' ? { ...field, options } : field))
}
