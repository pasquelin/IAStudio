import type { UsageReport } from '@shared/domain/usage'

/**
 * A month of spend, as the main process answers it.
 *
 * Beside the window rather than inside one suite: three of them need it — `UsageWindow` asserts
 * what the tabs show, `UsageOverview` what one of them says, `UsageActivities` what an empty
 * month looks like — and the three copies had already drifted, in field order and in values,
 * before this file existed. A fourth lives at `panels/usage/Usage.test.tsx`, on the other side
 * of the window/panel boundary; it is noted, not moved.
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
