import { AlertCircle, RotateCcw } from 'lucide-react'

export default function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-message" role="alert">
      <AlertCircle size={19} aria-hidden="true" />
      <div><strong>Something needs another look.</strong><p>{message}</p>
        {onRetry && <button className="text-button" type="button" onClick={onRetry}>
          <RotateCcw size={13} aria-hidden="true" /> Try again
        </button>}
      </div>
    </div>
  )
}
