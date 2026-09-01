import i18next from 'i18next'
import { englishText } from '@shared/i18n'

/**
 * How a handler names screen text: the window's own language, falling back to English.
 *
 * `i18next` answers nothing before a window has initialised it — a test — and a channel opened
 * from outside must read like one the band's diamond opened, never `undefined` in a document.
 *
 * Here rather than in `shared/`, which carries no runtime dependency at all: `@shared/i18n` is
 * read by six modules of the main process, and an `i18next` import there would follow it in.
 */
export function speaksBundle(): (key: string) => string {
  return key => i18next.t(key) || englishText(key)
}
