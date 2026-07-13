import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Apply time-of-day class to <body> immediately so CSS tints load with no flash
function applyTod() {
  const h = new Date().getHours()
  const tod = h >= 6 && h < 12 ? 'morning'
            : h >= 12 && h < 17 ? 'afternoon'
            : h >= 17 && h < 21 ? 'evening'
            : 'night'
  document.body.className = document.body.className
    .replace(/\btod-\w+\b/g, '')
    .trim()
  document.body.classList.add(`tod-${tod}`)
}

applyTod()
// Refresh every minute
setInterval(applyTod, 60_000)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
