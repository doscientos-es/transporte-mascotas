import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import { registerPwaServiceWorker } from '@/shared/infrastructure/pwa-service-worker'

import App from './App.tsx'

registerPwaServiceWorker()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root was not found.')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
