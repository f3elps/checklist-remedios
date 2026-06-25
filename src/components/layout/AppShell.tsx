import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from './BottomNav'

export function AppShell() {
  return (
    <div className="min-h-full max-w-md mx-auto pb-20">
      <header className="flex items-center justify-between p-4">
        <span className="text-xl font-bold text-primary">Cuidi</span>
        <button aria-label="Sair" onClick={() => supabase.auth.signOut()} className="text-muted">
          <LogOut size={20} />
        </button>
      </header>
      <main className="px-4"><Outlet /></main>
      <BottomNav />
    </div>
  )
}
