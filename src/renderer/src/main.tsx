import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Application } from '@/app/Application'
import { initialiserI18n } from '@/i18n'
import './index.css'

const racine = document.getElementById('racine')
if (!racine) throw new Error('Élément racine introuvable dans index.html')

// L'UI traduit dès son premier rendu : monter avant l'init afficherait les clés brutes.
await initialiserI18n()

createRoot(racine).render(
  <StrictMode>
    <Application />
  </StrictMode>,
)
