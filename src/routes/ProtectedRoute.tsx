import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="p-6 text-muted">Carregando…</div>
  return user ? <Outlet /> : <Navigate to="/entrar" replace />
}
