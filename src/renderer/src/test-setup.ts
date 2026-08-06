import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'
import { initialiserI18n } from '@/i18n'

// Les composants traduisent dès le premier rendu : sans init, `t()` rendrait les clés
// brutes et chaque assertion sur un libellé deviendrait un test de la clé, pas du texte.
beforeAll(async () => {
  await initialiserI18n('fr')
})

afterEach(cleanup)
