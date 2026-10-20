import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import './styles.css'
import { registerSW } from 'virtual:pwa-register'

// Install updates, but never in the middle of a workout: wait until you leave the workout screen.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const apply = () => {
      if (location.hash.startsWith('#/session')) return false
      void updateSW(true)
      return true
    }
    if (!apply()) {
      const onHash = () => {
        if (apply()) window.removeEventListener('hashchange', onHash)
      }
      window.addEventListener('hashchange', onHash)
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
