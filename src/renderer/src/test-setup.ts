import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import { initI18n } from '@/i18n'

/**
 * jsdom renders `<dialog>` but implements none of its modal API. Chromium does, and it is
 * what gives the account dialog its focus trap and its Escape handling — so the gap is
 * filled here rather than avoided in the component.
 */
function polyfillDialog(): void {
  const dialog = HTMLDialogElement.prototype
  if (typeof dialog.showModal !== 'function') {
    dialog.showModal = function showModal(this: HTMLDialogElement): void {
      this.open = true
    }
  }
  if (typeof dialog.close !== 'function') {
    dialog.close = function close(this: HTMLDialogElement): void {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
}

// Components translate on first render: without init, `t()` would return raw keys and every
// assertion on a label would test the key rather than the text.
beforeAll(async () => {
  polyfillDialog()
  await initI18n('fr')
})

afterEach(cleanup)
