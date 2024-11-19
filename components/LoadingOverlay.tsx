import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  message?: string
  visible: boolean
}

export default function LoadingOverlay({ message = 'Loading...', visible }: LoadingOverlayProps) {
  if (!visible) return null

  return (
    <div 
      className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => e.preventDefault()}
    >
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  )
}