import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import LoginPage from './pages/LoginPage.tsx'
import RegisterPage from './pages/RegisterPage.tsx'
import { AuthProvider } from './context/AuthContext.tsx'

// Heavy pages load on demand so the landing page stays light.
const DocsPage = lazy(() => import('./pages/DocsPage.tsx'))
const SetupPage = lazy(() => import('./pages/SetupPage.tsx'))
const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx'))
const OAuthPage = lazy(() => import('./pages/OAuthPage.tsx'))
const SharePage = lazy(() => import('./pages/SharePage.tsx'))

// Installable app (needed for the Android share target). Network-first, caches nothing.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

const Loading = () => <div className="min-h-dvh bg-bg" aria-busy="true" />

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/setup" element={<DocsPage />} />
            <Route path="/setup/wizard" element={<SetupPage />} />
            {/* Anonymous space links were retired; keys live in the dashboard now. */}
            <Route path="/setup/token" element={<Navigate to="/dashboard?tab=keys" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/oauth/authorize" element={<OAuthPage />} />
            <Route path="/share" element={<SharePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
