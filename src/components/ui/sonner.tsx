import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-surface group-[.toaster]:text-text group-[.toaster]:border-border group-[.toaster]:shadow-card',
          description: 'group-[.toast]:text-muted',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-on-primary',
          cancelButton:
            'group-[.toast]:bg-surface-2 group-[.toast]:text-muted',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
