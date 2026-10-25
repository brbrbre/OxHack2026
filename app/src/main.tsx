import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import RootApp from './RootApp'
import { CurrencyProvider } from './currency/CurrencyContext'
import { I18nProvider } from './i18n/I18nContext'
import { ThemeProvider } from './appearance/ThemeContext'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider><ThemeProvider><CurrencyProvider><RootApp /></CurrencyProvider></ThemeProvider></I18nProvider>
  </StrictMode>,
)
