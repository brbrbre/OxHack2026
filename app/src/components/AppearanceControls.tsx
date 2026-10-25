import { Globe2, Moon, Sun } from 'lucide-react'
import { LOCALES, useI18n } from '../i18n/I18nContext'
import type { Locale } from '../i18n/I18nContext'
import { useTheme } from '../appearance/ThemeContext'

export default function AppearanceControls() {
  const { locale, setLocale, t } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const ThemeIcon = theme === 'light' ? Moon : Sun
  return <div className="appearance-controls">
    <label className="language-control">
      <Globe2 size={16} aria-hidden="true" />
      <span className="sr-only">{t('Language')}</span>
      <select aria-label={t('Language')} value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
        {LOCALES.map(({ value, label }) => <option key={value} value={value} lang={value}>{label}</option>)}
      </select>
    </label>
    <button className="theme-control" type="button" onClick={toggleTheme}
      aria-label={t(theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode')}
      title={t(theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode')}>
      <ThemeIcon size={18} strokeWidth={1.7} aria-hidden="true" />
    </button>
  </div>
}
