import { cloudOfModelId } from './codeGeneration'
import { isTripoModelId, TRIPO_CLOUD } from './tripo'

/**
 * Which service owns a job target, read off the target ALONE — the question
 * `routedJobRunner.ts` asks to pick a runner, asked here so a window can ask it too.
 *
 * 🛑 A model of THIS MACHINE is indistinguishable from a Scenario one by its id: what tells
 * them apart is a lookup in the local catalogue, which no shared module can perform. Both
 * answer `scenario` here, and nothing yet asks a question that would tell them apart.
 */
export function serviceOfTarget(targetId: string): string {
  const cloud = cloudOfModelId(targetId)
  if (cloud !== null) return `cloud:${cloud}`

  return isTripoModelId(targetId) ? TRIPO_CLOUD : 'scenario'
}
