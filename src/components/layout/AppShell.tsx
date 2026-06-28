import { Outlet } from 'react-router-dom'
import { Suspense } from 'react'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from './BottomNav'
import { ProfileThemeSync } from '@/providers/ProfileThemeSync'
import { PageFallback } from './PageFallback'
import { Logo } from '@/components/Logo'

export function AppShell() {
  return (
    <div className="min-h-full max-w-md mx-auto pb-20">
      <header className="flex items-center justify-between p-4">
        <span className="flex items-center gap-2 text-xl font-bold text-primary">
          <Logo className="h-7 w-7" />
          Cuidi
        </span>
        <button aria-label="Sair" onClick={() => supabase.auth.signOut()} className="text-muted">
          <LogOut size={20} />
        </button>
      </header>
      <ProfileThemeSync />
      <main className="px-4">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
    </div>
  )
}
