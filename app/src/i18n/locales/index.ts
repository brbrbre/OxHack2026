import en from './en'
import es419 from './es-419'
import zhCN from './zh-CN'
import fr from './fr'
import it from './it'
import type { Locale, Messages } from '../types'

// One connection point for the language selector and every translated component.
export const messages: Readonly<Record<Locale, Messages>> = {
  en,
  'es-419': es419,
  'zh-CN': zhCN,
  fr,
  it,
}
