import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Application } from '@/app/Application'
import './index.css'

const racine = document.getElementById('racine')
if (!racine) throw new Error('Élément racine introuvable dans index.html')

createRoot(racine).render(
  <StrictMode>
    <Application />
  </StrictMode>,
)
