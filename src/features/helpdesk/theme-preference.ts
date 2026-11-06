import { useState } from 'react'

export const THEME_STORAGE_KEY = 'ansai-helpdesk-theme'
export const THEMES = [
  { id: 'dark', name: '星淵黑色' },
  { id: 'light', name: '奶白葉影' },
  { id: 'color', name: '雲曜科技' },
] as const
export type HelpdeskTheme = (typeof THEMES)[number]['id']
export const DEFAULT_THEME: HelpdeskTheme = 'light'
export function isHelpdeskTheme(value: unknown): value is HelpdeskTheme {
  return THEMES.some(({ id }) => id === value)
}
export function readTheme(): HelpdeskTheme {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isHelpdeskTheme(value) ? value : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}
export function useHelpdeskTheme() {
  const [theme, setTheme] = useState<HelpdeskTheme>(readTheme)
  function changeTheme(value: string) {
    if (!isHelpdeskTheme(value)) return
    setTheme(value)
    try {
      // Only this whitelisted appearance preference is persisted, never session/chat data.
      window.localStorage.setItem(THEME_STORAGE_KEY, value)
    } catch {
      // Private browsing / disabled storage must not block an in-memory theme switch.
    }
  }
  return { theme, changeTheme }
}
