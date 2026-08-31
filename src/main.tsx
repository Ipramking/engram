import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import SetupPage from './pages/SetupPage.tsx'
import TokenPage from './pages/TokenPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/setup/token" element={<TokenPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
