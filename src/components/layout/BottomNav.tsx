import { NavLink } from 'react-router-dom'
import { CalendarCheck, Pill, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/', label: 'Hoje', Icon: CalendarCheck, end: true },
  { to: '/remedios', label: 'Remédios', Icon: Pill },
  { to: '/historico', label: 'Histórico', Icon: BarChart3 },
  { to: '/configuracoes', label: 'Ajustes', Icon: Settings },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-surface border-t border-border">
      <ul className="grid grid-cols-4 max-w-md mx-auto">
        {items.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => cn(
              'flex flex-col items-center gap-1 py-2 text-xs',
              isActive ? 'text-primary' : 'text-muted',
            )}>
              <Icon size={22} />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
