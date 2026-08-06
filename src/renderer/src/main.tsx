import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Application } from '@/app/Application'
import { initI18n } from '@/i18n'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found in index.html')

// The UI translates on its very first render: mounting before init would show raw keys.
await initI18n()

createRoot(root).render(
  <StrictMode>
    <Application />
  </StrictMode>,
)
