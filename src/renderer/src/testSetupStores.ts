import { beforeEach } from 'vitest'
import { resetDocumentStoresForTests } from '@/stores/documentStore'

/**
 * The desktop every renderer case is written for. Pinned rather than inherited: jsdom builds its
 * user agent from the machine, so `IS_MAC` — and with it the modifier every ⌘ chord is signed
 * with — answered `true` here and `false` on the Linux runner. What a keyboard does off macOS is
 * covered where it belongs, on the pure functions of `shared/domain/shortcut.ts`.
 */
const MAC_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'

Object.defineProperty(globalThis.navigator, 'userAgent', { value: MAC_USER_AGENT })

/**
 * A case must not inherit a document a previous one closed. Each document store keeps the ids it
 * was told to forget outside its zustand state, where a suite's own `setState` merges past them —
 * so a case that closed a document silenced the commands of every case after it, as a write that
 * did nothing.
 *
 * Its own file rather than a line of `testSetup.ts`, and this is measured rather than tidy: the
 * renderer tests that never touch a browser run under a project with NO setup at all, because
 * jsdom and the full setup cost them more than they run (`vitest.config.ts`, `renderer-node`).
 * Left in the DOM setup, this rule held for `*.test.tsx` and quietly skipped every `*.test.ts` of
 * the renderer. What it costs those suites is one import and a walk over a registry that stays
 * empty unless they loaded a store.
 *
 * BEFORE the case, not after: `afterEach` hooks run last-registered first, so emptying the stores
 * there would happen while the previous case's tree is still mounted, and a panel re-rendering on
 * a document that just vanished throws.
 *
 * `useDocuments` is NOT reset with them: the tabs and descriptors of the previous case stay. The
 * five `install<X>` put their descriptor back on every call, so nothing is out of step through
 * them — a suite that writes `useDocuments` by hand can leave a tab in front of a document whose
 * state this just took away, and it reads as a panel rendering an empty document.
 */
beforeEach(resetDocumentStoresForTests)
