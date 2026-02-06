import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

function Fallback({ error }) {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 600 }}>
      <h1 style={{ color: '#b91c1c' }}>Something went wrong</h1>
      <pre style={{ background: '#fef2f2', padding: 16, overflow: 'auto' }}>{error?.message || String(error)}</pre>
    </div>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root'))
try {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} catch (err) {
  root.render(<Fallback error={err} />)
}
