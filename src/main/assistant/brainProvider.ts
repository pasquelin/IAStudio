import type { AssistantModel } from '@shared/domain/assistant'
import type { Job } from '@shared/domain/job'
import { log } from '@main/log'
import type { AssistantThought } from '@shared/domain/assistant'
import type { AssistantBrain, NotReady } from './brainPort'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import { answeredTurn, notesFor, turnsWith, TurnStopped, type BrainAttempt } from './brainTurn'
import { briefingFor, instructionFor, type Briefing } from './instruction'

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

/**
 * What THIS door refuses beyond, measured from the model's own schema: `instruction` is a field
 * of the generation endpoint, and the assistant reaches a language model through it.
 *
 * 🛑 It belongs to this file and to no other. Shared, it was applied to seven chat clouds that
 * take dozens of times more — an image generator's form deciding how much a conversation may say.
 */
export const INSTRUCTION_MAX = 10_000

/**
 * What the sentence is guaranteed, whatever the catalogue grows to. The briefing gets the rest,
 * and at eight thousand characters the whole registry does not fit — so this door is shown the
 * short list and asks for the rest when it needs it.
 *
 * 🛑 A FLOOR, not a share: `instructionFor` cuts against `INSTRUCTION_MAX`, so the sentence really
 * gets ten thousand minus the briefing — 2 595 today. `[M]` At 2 000 the EXPANSION was left 595,
 * and « switch to main » found `git.checkout` without room to be shown it.
 */
export const UTTERANCE_ROOM = 1_500
export const BRIEFING_ROOM = INSTRUCTION_MAX - UTTERANCE_ROOM

export type BrainDeps = {
  /**
   * Runs the model without any of what surrounds a generation — see `JobManager.run`. Which
   * model and under what label is settled where this is wired, not here: this file knows how to
   * ask a question, not which catalogue entry answers it.
   */
  run: (body: Record<string, unknown>, signal?: AbortSignal) => Promise<Job>
  /** The text an output asset holds. */
  readText: (assetId: string) => Promise<string>
  /** Which language model answers. Read on each turn: it is a setting, and settings change. */
  model: () => AssistantModel
  notReady?: NotReady
}

function bodyFor(
  request: AssistantThought,
  model: AssistantModel,
  briefing: string,
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
    instruction: instructionFor(briefing, request.utterance, INSTRUCTION_MAX),
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

export function createProviderBrain({ run, readText, model, notReady }: BrainDeps): AssistantBrain {
  /** One round trip: run the model, read the asset it wrote, hand back text and what it cost. */
  const ask = async (
    request: AssistantThought,
    chosen: AssistantModel,
    briefing: Briefing,
    complaint?: string,
    signal?: AbortSignal,
  ): Promise<BrainAttempt> => {
    const job = await run(bodyFor(request, chosen, briefing.text, complaint), signal)
    const cost = job.cost ?? 0

    // 🛑 Raised and never answered empty: read as an unreadable answer, a stopped turn asked the
    // door a SECOND time — a second billed job — and the window then called it lost, not stopped.
    if (job.status === 'cancelled') throw new TurnStopped()

    if (job.status !== 'succeeded') {
      log.warn('assistant', `thinking failed: ${job.error ?? job.status}`)
      return { answer: '', cost }
    }

    return { answer: await answerFrom(job, readText), cost }
  }

  return {
    // 🛑 No words at the wheel: this door answers through a JOB, so the text exists only once the
    // asset is written. What a stop reaches is the job, which is billed and outlives the ask.
    think: async (request, watch = {}) => {
      // Read once, outside the retry: a setting changed between two attempts would have the model
      // complained to be a different one from the model that answered.
      const chosen = model()
      const briefing = await briefingFor(request, BRIEFING_ROOM, notReady)

      return await answeredTurn(
        briefing,
        (shown, complaint) => ask(request, chosen, shown, complaint, watch.signal),
        undefined,
        notesFor(SCENARIO_CLOUD, chosen, watch),
      )
    },
  }
}
