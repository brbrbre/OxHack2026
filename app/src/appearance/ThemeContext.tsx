import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import './appearance.css'
import './dark.css'

export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'horizon-theme'

export function readTheme(storage?: Pick<Storage, 'getItem'>): Theme {
  try { return storage?.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light' }
  catch { return 'light' }
}

const ThemeContext = createContext({ theme: 'light' as Theme, toggleTheme: () => {} })

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme?: Theme }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (initialTheme) return initialTheme
    try { return typeof window === 'undefined' ? 'light' : readTheme(window.localStorage) }
    catch { return 'light' }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#10151C' : '#F7F8F6')
  }, [theme])
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key === THEME_STORAGE_KEY) setTheme(event.newValue === 'dark' ? 'dark' : 'light')
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])
  const value = useMemo(() => ({ theme, toggleTheme: () => {
    const next = theme === 'light' ? 'dark' : 'light'
    try { window.localStorage.setItem(THEME_STORAGE_KEY, next) } catch { /* Preferences are optional. */ }
    setTheme(next)
  } }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() { return useContext(ThemeContext) }
