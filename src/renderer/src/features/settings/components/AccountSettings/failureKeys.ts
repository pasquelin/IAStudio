import type { AccountSaveFailure } from '@/stores/accounts'

// A table rather than a template: a member added to the union stops the build here instead of
// rendering a missing key on screen. Same reason `failureMessageKey` gives.
export const FAILURE_KEYS: Record<AccountSaveFailure, string> = {
  empty: 'accounts.errors.empty',
  'too-long': 'accounts.errors.too-long',
  duplicate: 'accounts.errors.duplicate',
  'unknown-account': 'accounts.errors.unknown-account',
  'store-unreadable': 'accounts.errors.store-unreadable',
  unexpected: 'accounts.errors.unexpected',
}
