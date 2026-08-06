import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Application } from '@/app/Application'
import { resolveLanguage } from '@shared/i18n'
import { initI18n } from '@/i18n'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found in index.html')

// Same locale as the native menu, which the main process resolves from `app.getLocale()`:
// an English menu above a French interface reads as a bug.
await initI18n(resolveLanguage(navigator.language))

createRoot(root).render(
  <StrictMode>
    <Application />
  </StrictMode>,
)
