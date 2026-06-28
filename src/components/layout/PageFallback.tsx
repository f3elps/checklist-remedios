export function PageFallback() {
  return (
    <div role="status" aria-live="polite" className="grid place-items-center py-16">
      <span className="sr-only">Carregando…</span>
      <div
        className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary"
        aria-hidden
      />
    </div>
  )
}
