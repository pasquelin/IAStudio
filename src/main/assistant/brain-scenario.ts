import type { AssistantModel } from '@shared/domain/assistant'
import type { Job } from '@shared/domain/job'
import { log } from '@main/log'
import type { AssistantThought } from '@shared/domain/assistant'
import type { AssistantBrain } from './brain-port'
import { instructionFor, recentHistory } from './instruction'
import { parseReply } from './reply'

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
  // Trimmed once, at the end: the history arrives already bounded by the channel, so trimming it
  // before adding the complaint could only ever drop the complaint's room and nothing else.
  const inputs = recentHistory(complaint ? [...request.history, complaint] : request.history)

  return {
    instruction: instructionFor(request.utterance),
    model,
    numOutputs: 1,
    ...(inputs.length > 0 ? { textInputs: inputs } : {}),
  }
}

/**
 * What the model was told it got wrong, on the one retry it is given.
 *
 * Quoting the answer back is the part that works: a model told only "that was not JSON" tends to
 * produce the same thing again. Bounded, because a model that answered an essay would otherwise
 * spend the whole history budget explaining itself.
 */
function complaintAbout(answer: string): string {
  return [
    'Your previous answer could not be read. It must be one JSON object with the keys "say" and',
    '"calls", and nothing else around it. This is what you sent:',
    answer.slice(0, 500),
  ].join('\n')
}

async function answerFrom(
  job: Job,
  readText: (assetId: string) => Promise<string>,
): Promise<string> {
  const assetId = job.assetIds[0]
  return assetId === undefined ? '' : await readText(assetId)
}

export function createScenarioBrain({ run, readText, model }: BrainDeps): AssistantBrain {
  /** One round trip: run the model, read the asset it wrote, hand back text and what it cost. */
  const ask = async (
    request: AssistantThought,
    chosen: AssistantModel,
    complaint?: string,
  ): Promise<{ answer: string; cost: number }> => {
    const job = await run(bodyFor(request, chosen, complaint))
    const cost = job.cost ?? 0

    if (job.status !== 'succeeded') {
      log.warn('assistant', `thinking failed: ${job.error ?? job.status}`)
      return { answer: '', cost }
    }

    return { answer: await answerFrom(job, readText), cost }
  }

  return {
    think: async request => {
      const chosen = model()
      const first = await ask(request, chosen)
      const reply = parseReply(first.answer)
      if (reply) return { ...reply, cost: first.cost }

      /**
       * One retry, and only one. A model that cannot answer the shape twice will not answer it
       * the third time either, and every attempt is a creative unit off the person's balance —
       * measured at 0.75 for the cheapest of them.
       */
      log.warn('assistant', 'unreadable answer, asking once more')
      const second = await ask(request, chosen, complaintAbout(first.answer))
      const retried = parseReply(second.answer)
      const cost = first.cost + second.cost

      // Said plainly rather than thrown: the caller has a person waiting, and "I did not
      // understand" is a better answer than a stack trace — and the cost was still incurred.
      return retried ? { ...retried, cost } : { say: '', calls: [], cost }
    },
  }
}
