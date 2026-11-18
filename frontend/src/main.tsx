import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensureBareShellCleanState } from './gemstoneStorage.ts'

document.title = 'Shreeji Gems | Gemstones CRM & Multi-Company Vault'

// Guarantee clean bare-shell empty database for client delivery
ensureBareShellCleanState()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

