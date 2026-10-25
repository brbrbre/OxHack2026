import { useI18n } from '../i18n/I18nContext'
import '../selected-assets.css'

export default function SelectedPlanNotice() {
  const { t } = useI18n()
  return <aside className="selected-assets-split" role="note">
    <strong>{t('Plan for your selected assets')}</strong>
    <span>{t('This plan only considers the assets you picked. A single holding may use up to 100% of the budget, subject to your risk profile.')}</span>
    <span>{t('Some money may stay in cash.')}</span>
  </aside>
}
