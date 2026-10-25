import { AlertCircle, RotateCcw } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'
import { localizeKnownError } from '../i18n/errors'

export default function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n()
  return (
    <div className="error-message" role="alert">
      <AlertCircle size={19} aria-hidden="true" />
      <div><strong>{t('Unable to complete the request.')}</strong><p>{localizeKnownError(message, t)}</p>
        {onRetry && <button className="text-button" type="button" onClick={onRetry}>
          <RotateCcw size={13} aria-hidden="true" /> {t('Try again')}
        </button>}
      </div>
    </div>
  )
}
