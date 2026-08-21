import type { AssistantModel } from '@shared/domain/assistant'
import type { Job } from '@shared/domain/job'
import { log } from '@main/log'
import type { AssistantThought } from '@shared/domain/assistant'
import type { AssistantBrain } from './brainPort'
import { retriedAnswer, turnsWith, type BrainAttempt } from './brainRetry'
import { instructionFor } from './instruction'

/**
 * The assistant's thinking, run on Scenario's own catalogue model.
 *
 * Why this and not a second provider: `model_scenario-llm` is an ordinary model of the
 * catalogue, so it goes through the client, the rate limiter, the retries and the cost meter the
 * studio already has — and it needs no second account, no second key, and nothing new in the
 * settings the user has to fill in before the assistant works at all.
 *
 * What it does not have, and what this file therefore carries: no tool use, so the catalogue of
 * actions is described in the instruction and the answer is parsed back out of text; no
 * conversation, so history goes in `textInputs`, ten blocks at most; and no streaming, so the
 * answer arrives whole, after a job.
 */

export type BrainDeps = {
  /**
   * Runs the model without any of what surrounds a generation — see `JobManager.run`. Which
   * model and under what label is settled where this is wired, not here: this file knows how to
   * ask a question, not which catalogue entry answers it.
   */
  run: (body: Record<string, unknown>) => Promise<Job>
  /** The text an output asset holds. */
  readText: (assetId: string) => Promise<string>
  /** Which language model answers. Read on each turn: it is a setting, and settings change. */
  model: () => AssistantModel
}

function bodyFor(
  request: AssistantThought,
  model: AssistantModel,
  complaint?: string,
): {
  instruction: string
  model: AssistantModel
  numOutputs: number
  textInputs?: string[]
} {
  // The complaint rides with the history rather than in the instruction: the instruction already
  // states the format, and saying it a second time there displaced the sentence being answered.
  const inputs = turnsWith(request.history, complaint)

  return {
    instruction: instructionFor(request.utterance),
    model,
    numOutputs: 1,
    ...(inputs.length > 0 ? { textInputs: inputs } : {}),
  }
}

async function answerFrom(
  job: Job,
  readText: (assetId: string) => Promise<string>,
): Promise<string> {
  const assetId = job.assetIds[0]
  return assetId === undefined ? '' : await readText(assetId)
}

export function createProviderBrain({ run, readText, model }: BrainDeps): AssistantBrain {
  /** One round trip: run the model, read the asset it wrote, hand back text and what it cost. */
  const ask = async (
    request: AssistantThought,
    chosen: AssistantModel,
    complaint?: string,
  ): Promise<BrainAttempt> => {
    const job = await run(bodyFor(request, chosen, complaint))
    const cost = job.cost ?? 0

    if (job.status !== 'succeeded') {
      log.warn('assistant', `thinking failed: ${job.error ?? job.status}`)
      return { answer: '', cost }
    }

    return { answer: await answerFrom(job, readText), cost }
  }

  return {
    think: request => {
      // Read once, outside the retry: a setting changed between two attempts would have the model
      // complained to be a different one from the model that answered.
      const chosen = model()
      return retriedAnswer(complaint => ask(request, chosen, complaint))
    },
  }
}
