import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { LanguageProvider } from './context/LanguageContext'
import { StationProvider } from './context/StationContext'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import EnergyPage from './pages/EnergyPage'
import LogisticsPage from './pages/LogisticsPage'
import EnvironmentPage from './pages/EnvironmentPage'
import InfrastructurePage from './pages/InfrastructurePage'
import AnalyticsPage from './pages/AnalyticsPage'
import ReportsPage from './pages/ReportsPage'
import LiveTelemetryPage from './pages/LiveTelemetryPage'
import BlackBoxPage from './pages/BlackBoxPage'
import BlackBoxModal from './components/blackbox/BlackBoxModal'
import { ChatBot } from './components/ui/ChatBot'
import MobileBottomNav from './components/layout/MobileBottomNav'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <StationProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/blackbox" element={<ProtectedRoute><BlackBoxPage /></ProtectedRoute>} />
            <Route path="/telemetry" element={<ProtectedRoute><LiveTelemetryPage /></ProtectedRoute>} />
            <Route path="/stations" element={<Navigate to="/" replace />} />
            <Route path="/energy" element={<ProtectedRoute><EnergyPage /></ProtectedRoute>} />
            <Route path="/logistics" element={<ProtectedRoute><LogisticsPage /></ProtectedRoute>} />
            <Route path="/environment" element={<ProtectedRoute><EnvironmentPage /></ProtectedRoute>} />
            <Route path="/infrastructure" element={<ProtectedRoute><InfrastructurePage /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
            <Route path="/*" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          </Routes>
          <ChatBot />
          <BlackBoxModal />
          <MobileBottomNav />
        </StationProvider>
      </AuthProvider>
    </LanguageProvider>
  )
}
