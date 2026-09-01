import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import type { Job } from '@shared/domain/job'
import type { FieldDescriptor } from '@shared/domain/model'
import { serviceOfTarget } from '@shared/domain/serviceOfTarget'
import { formatMoment } from '@/helpers/format'
import { useJobs } from '@/stores/jobs'

type Named = Job & { remoteId: string }

const NONE: readonly Named[] = []

/** Their id means something to the service that issued it, and to no other. */
const usable = (job: Job, service: string): job is Named =>
  job.status === 'succeeded' &&
  job.remoteId !== undefined &&
  serviceOfTarget(job.targetId) === service

/**
 * What a `task` field offers. 🛑 Filled here rather than in a catalogue: the window is the only
 * side that knows what has run, a runner seeing one job at a time.
 */
export function useTaskChoices(
  fields: readonly FieldDescriptor[] | undefined,
  modelId: string | null,
): readonly FieldDescriptor[] {
  const { i18n } = useTranslation()
  const service = modelId === null ? null : serviceOfTarget(modelId)
  const done = useJobs(
    useShallow(state =>
      service === null ? NONE : state.jobs.filter((job): job is Named => usable(job, service)),
    ),
  )

  const options = useMemo(
    () =>
      done.map(job => ({
        value: job.remoteId,
        label: job.finishedAt
          ? `${job.label} · ${formatMoment(job.finishedAt, i18n.language, 'local')}`
          : job.label,
      })),
    [done, i18n.language],
  )

  // 🛑 The SAME array back when nothing is enriched: react-query holds the descriptor's fields
  // referentially stable, and a fresh one every render disarms every memo the panel keys on it.
  return useMemo(() => {
    const all = fields ?? []
    return all.some(field => field.kind === 'task')
      ? all.map(field => (field.kind === 'task' ? { ...field, options } : field))
      : all
  }, [fields, options])
}
