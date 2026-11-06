import { afterEach, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { ThemeSelector } from './theme'
import {
  DEFAULT_THEME,
  isHelpdeskTheme,
  readTheme,
  THEME_STORAGE_KEY,
  useHelpdeskTheme,
} from './theme-preference'

function PreferenceHarness() {
  const { theme, changeTheme } = useHelpdeskTheme()
  return (
    <>
      <output>{theme}</output>
      <ThemeSelector theme={theme} onChange={changeTheme} />
      <button onClick={() => changeTheme('invalid')}>invalid</button>
    </>
  )
}
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.removeItem(THEME_STORAGE_KEY)
})
it('accepts only the three known scalar theme IDs', () => {
  for (const value of [
    null,
    undefined,
    '',
    'auto',
    '{}',
    '__proto__',
    'LIGHT',
    'dark; color:red',
  ])
    expect(isHelpdeskTheme(value)).toBe(false)
  for (const value of ['dark', 'light', 'color'])
    expect(isHelpdeskTheme(value)).toBe(true)
})
it('missing or invalid stored preference uses the default without writing', () => {
  localStorage.removeItem(THEME_STORAGE_KEY)
  expect(readTheme()).toBe(DEFAULT_THEME)
  localStorage.setItem(THEME_STORAGE_KEY, 'invalid-json')
  const write = vi.spyOn(Storage.prototype, 'setItem')
  expect(readTheme()).toBe(DEFAULT_THEME)
  expect(write).not.toHaveBeenCalled()
})
it('valid saved preference is read on remount; invalid change never persists', async () => {
  localStorage.setItem(THEME_STORAGE_KEY, 'dark')
  const write = vi.spyOn(Storage.prototype, 'setItem')
  await render(<PreferenceHarness />)
  await expect
    .element(page.getByRole('combobox', { name: '介面色系' }))
    .toHaveValue('dark')
  await page.getByRole('button', { name: 'invalid' }).click()
  expect(write).not.toHaveBeenCalled()
  await page.getByRole('combobox', { name: '介面色系' }).selectOptions('color')
  expect(write).toHaveBeenCalledExactlyOnceWith(THEME_STORAGE_KEY, 'color')
})
it('denied storage getter and read both fall back safely', () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
  expect(readTheme()).toBe(DEFAULT_THEME)
  vi.restoreAllMocks()
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
  expect(readTheme()).toBe(DEFAULT_THEME)
})
it('quota/write failure still allows in-memory switching', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
  await render(<PreferenceHarness />)
  await page.getByRole('combobox', { name: '介面色系' }).selectOptions('dark')
  await expect
    .element(page.getByRole('combobox', { name: '介面色系' }))
    .toHaveValue('dark')
})
