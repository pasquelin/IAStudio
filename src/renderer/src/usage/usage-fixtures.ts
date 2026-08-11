import type { UsageReport } from '@shared/domain/usage'

/**
 * A month of spend, as the main process answers it. Beside the window rather than inside one
 * suite: `UsageWindow` asserts what the tabs show, `UsageOverview` what one of them says, and a
 * second copy of these fourteen fields would drift the day the report gains a fifteenth.
 */
export function report(overrides: Partial<UsageReport> = {}): UsageReport {
  return {
    period: 31,
    from: '2026-07-09',
    to: '2026-08-08',
    units: 1240,
    discount: 0,
    jobs: 96,
    daily: [{ date: '2026-08-01', units: 1240 }],
    accounts: [{ accountId: 'acc-1', name: 'Demo app', units: 1240, discount: 0 }],
    models: [{ modelId: 'model_a', name: 'Flux Pro', units: 612, jobs: 48, apiKeyUnits: 100 }],
    actions: [{ label: 'images-generation', count: 48, units: 612 }],
    assets: [{ label: 'image', count: 48 }],
    silent: [],
    price: null,
    ...overrides,
  }
}
