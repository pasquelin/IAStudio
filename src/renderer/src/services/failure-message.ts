import type { JobFailure } from '@shared/domain/failure'

/**
 * One message per failure code, for both authentication and generation. The main process
 * never sends text — an SDK error message embeds the request that produced it, and that
 * request carries the API key.
 */
const MESSAGE_KEY: Record<JobFailure, string> = {
  missing: 'errors.missingCredentials',
  'invalid-credentials': 'errors.invalidCredentials',
  forbidden: 'errors.forbidden',
  'rate-limited': 'errors.rateLimited',
  server: 'errors.server',
  network: 'errors.network',
  rejected: 'errors.rejected',
  storage: 'errors.storage',
  unexpected: 'errors.unexpected',
}

export function failureMessageKey(failure: JobFailure): string {
  return MESSAGE_KEY[failure]
}
