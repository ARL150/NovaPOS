import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'

export type ThemeId = 'dark' | 'light' | 'cyberpunk' | 'ocean' | 'crimson' | 'matrix'

export interface Theme {
  id: ThemeId
  name: string
  accent: string
  description: string
  text: string
  textMuted: string
  bg: string
  surface: string
}

export const THEMES: Theme[] = [
  { id: 'dark',      name: 'Dark',       accent: '#58a6ff', description: 'Oscuro estándar', text: '#c9d1d9', textMuted: '#8b949e', bg: '#0d1117', surface: '#161b22' },
  { id: 'light',     name: 'Light',      accent: '#0969da', description: 'Modo claro',      text: '#24292f', textMuted: '#57606a', bg: '#f6f8fa', surface: '#ffffff' },
  { id: 'cyberpunk', name: 'Cyberpunk',  accent: '#bf00ff', description: 'Morado neón',     text: '#e0d0f0', textMuted: '#a080c0', bg: '#0a0015', surface: '#100025' },
  { id: 'ocean',     name: 'Ocean',      accent: '#00c8f0', description: 'Azul profundo',   text: '#cce8f0', textMuted: '#6aacbf', bg: '#031825', surface: '#062435' },
  { id: 'crimson',   name: 'Crimson',    accent: '#ff4d4d', description: 'Rojo intenso',    text: '#f0cccc', textMuted: '#c07070', bg: '#150202', surface: '#200505' },
  { id: 'matrix',    name: 'Matrix',     accent: '#00ff41', description: 'Verde terminal',  text: '#a0ffa0', textMuted: '#40bf50', bg: '#011101', surface: '#021c02' },
]

interface ThemeCtx { theme: Theme; setTheme: (id: ThemeId) => void }
const ThemeContext = createContext<ThemeCtx | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>(() =>
    (localStorage.getItem('nova-theme') as ThemeId) || 'dark'
  )
  const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0]

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
    localStorage.setItem('nova-theme', themeId)
  }, [themeId])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeId }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme fuera de ThemeProvider')
  return ctx
}
