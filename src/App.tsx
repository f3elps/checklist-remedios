import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicRoute } from '@/routes/PublicRoute'
import Login from '@/pages/auth/Login'
import Signup from '@/pages/auth/Signup'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import ResetPassword from '@/pages/auth/ResetPassword'

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
        <Route path="/" element={<div>hoje em breve</div>} />
      </Route>
    </Routes>
  )
}
