import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { registerUpdates } from './components/UpdateBanner'
import { installKeyboardHelpers } from './lib/keyboard'
import '@fontsource-variable/inter/opsz.css'
import './styles.css'
import './styles/pwa.css'

// New builds download in the background; UpdateBanner offers "Reload" (never on the workout screen).
registerUpdates()
// scrolling closes the keyboard; sheets sit above it
installKeyboardHelpers()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
