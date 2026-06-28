import { Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicRoute } from '@/routes/PublicRoute'
import { AppShell } from '@/components/layout/AppShell'
import { PageFallback } from '@/components/layout/PageFallback'

const Login = lazy(() => import('@/pages/auth/Login'))
const Signup = lazy(() => import('@/pages/auth/Signup'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const Hoje = lazy(() => import('@/pages/Hoje'))
const Remedios = lazy(() => import('@/pages/Remedios'))
const Historico = lazy(() => import('@/pages/Historico'))
const Configuracoes = lazy(() => import('@/pages/Configuracoes'))
const MedicationFormPage = lazy(() => import('@/pages/MedicationFormPage'))

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/entrar" element={<Login />} />
          <Route path="/cadastrar" element={<Signup />} />
          <Route path="/esqueci-senha" element={<ForgotPassword />} />
        </Route>
        <Route path="/redefinir-senha" element={<ResetPassword />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<Hoje />} />
            <Route path="/remedios" element={<Remedios />} />
            <Route path="/remedios/novo" element={<MedicationFormPage />} />
            <Route path="/remedios/:id/editar" element={<MedicationFormPage />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}
