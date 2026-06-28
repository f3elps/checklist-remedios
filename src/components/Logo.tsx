import type { SVGProps } from 'react'

/**
 * Marca do Cuidi: cápsula branca dentro de um coração.
 * O coração usa `currentColor` — herda a cor primária do tema via `text-primary`.
 * Decorativa por padrão (`aria-hidden`): use junto de um texto visível "Cuidi"
 * ou de um título de tela que dê o nome acessível.
 */
export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      <path
        d="M32 56C32 56 8 42 8 24.5C8 15.4 15.1 9 22.8 9C27.2 9 30.4 11.2 32 14.2C33.6 11.2 36.8 9 41.2 9C48.9 9 56 15.4 56 24.5C56 42 32 56 32 56Z"
        fill="currentColor"
      />
      <g transform="rotate(-38 32 28)">
        <rect x="20.5" y="22.5" width="23" height="11" rx="5.5" fill="#ffffff" />
        <line x1="32" y1="22.5" x2="32" y2="33.5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.85" />
        <rect x="20.5" y="22.5" width="11.5" height="11" rx="5.5" fill="#ffffff" />
        <rect x="20.5" y="22.5" width="11.5" height="11" rx="5.5" fill="currentColor" fillOpacity="0.12" />
      </g>
    </svg>
  )
}
