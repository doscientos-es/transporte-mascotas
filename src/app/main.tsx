import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import { registerPwaServiceWorker } from '@/shared/infrastructure/pwa-service-worker'

import App from './App.tsx'

registerPwaServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
