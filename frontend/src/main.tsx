import '@fontsource-variable/figtree'
import '@fontsource-variable/roboto-slab'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import { ToastProvider } from './components/ui/ToastProvider'
import './styles/tokens.css'
import './styles/base.css'
import './styles/motion.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/pages.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
