import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import { initI18n } from '@/i18n'

// Components translate on first render: without init, `t()` would return raw keys and every
// assertion on a label would test the key rather than the text.
beforeAll(async () => {
  await initI18n('fr')
})

afterEach(cleanup)
