import { useEffect, useRef } from 'react'
import { Info } from 'lucide-react'
import { useI18n } from '../i18n/I18nContext'

export const RESPONSIBILITY_NOTICE = 'Educational information, not financial advice. Returns are not guaranteed. You are responsible for your investment decisions.'

export default function InformationNotice() {
  const { t } = useI18n()
  const element = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!element.current) return
    function reserveSpace() {
      if (element.current) document.documentElement.style.setProperty('--notice-space', Math.ceil(element.current.getBoundingClientRect().height) + 'px')
    }
    reserveSpace()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(reserveSpace) : null
    observer?.observe(element.current)
    window.addEventListener('resize', reserveSpace)
    return () => { observer?.disconnect(); window.removeEventListener('resize', reserveSpace) }
  }, [t])
  return <aside ref={element} className="information-notice" aria-label={t('Important information')}>
    <div><Info size={17} aria-hidden="true" /><p>{t(RESPONSIBILITY_NOTICE)}</p></div>
  </aside>
}
