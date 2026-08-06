import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Application } from '@/app/Application'
import { initI18n } from '@/i18n'
import './index.css'

const root = document.getElementById('racine')
if (!root) throw new Error('Élément racine introuvable dans index.html')

// L'UI traduit dès son premier rendu : monter avant l'init afficherait les clés brutes.
await initI18n()

createRoot(root).render(
  <StrictMode>
    <Application />
  </StrictMode>,
)
