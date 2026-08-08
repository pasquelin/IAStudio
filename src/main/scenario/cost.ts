import { APIError } from '@scenario-labs/sdk'
import type { CostEstimate } from '@shared/domain/job'
import { isRecord } from '@shared/guards'

/** What a run would cost, without running it. `null` where the API declines to price it. */
export type CostEstimator = (id: string, body: Record<string, unknown>) => Promise<CostEstimate>

/**
 * Fires the call an estimate rides on, whatever it is a dry run of.
 *
 * A function rather than a named method, because the same 402 answers `generate.runModel` and
 * `workflows.run` — the endpoint the "Dry Run Response" of `workflows-and-apps.md` documents.
 */
export type DryRun = (id: string, body: Record<string, unknown>) => Promise<unknown>

/** The figure a dry run puts in its 402, or `null` when there is no readable number in it. */
function pricedAt(error: APIError): CostEstimate {
  if (!isRecord(error.error)) return null

  const { estimatedCost } = error.error
  return typeof estimatedCost === 'number' && Number.isFinite(estimatedCost)
    ? { creativeUnits: estimatedCost }
    : null
}

/**
 * What a run would cost, without running it.
 *
 * `?dryRun=true` creates no job and spends nothing. The catch is how it answers: **HTTP 402**,
 * carrying `estimatedCost` in its body (`workflows-and-apps.md`, "Dry Run Response"). So this is
 * the one call in the studio where a 4xx is the success path.
 *
 * Only that 402 is swallowed. Anything else — a 500, a dead network, a key that expired — is
 * thrown on, so it reaches the log and the journal like every other failure. The button shows no
 * figure either way; the difference is whether the studio can say why.
 */
export function costEstimatorOf(run: DryRun): CostEstimator {
  return async (id, body) => {
    try {
      await run(id, body)
      // No 402 means the API priced nothing. Nothing was generated either way — the dry run flag
      // is honoured whatever the answer — so there is simply no figure to show.
      return null
    } catch (error) {
      if (error instanceof APIError && error.status === 402) return pricedAt(error)
      throw error
    }
  }
}
