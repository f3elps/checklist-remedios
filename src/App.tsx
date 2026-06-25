import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicRoute } from '@/routes/PublicRoute'
import { AppShell } from '@/components/layout/AppShell'
import Login from '@/pages/auth/Login'
import Signup from '@/pages/auth/Signup'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'
import Hoje from '@/pages/Hoje'
import Remedios from '@/pages/Remedios'
import Historico from '@/pages/Historico'
import Configuracoes from '@/pages/Configuracoes'
import MedicationFormPage from '@/pages/MedicationFormPage'

export default function App() {
  return (
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
  )
}
