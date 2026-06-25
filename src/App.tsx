import { Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicRoute } from '@/routes/PublicRoute'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/entrar" element={<div>login em breve</div>} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<div>hoje em breve</div>} />
      </Route>
    </Routes>
  )
}
