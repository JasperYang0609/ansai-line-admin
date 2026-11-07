import { afterEach, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { ApiError, createDemoApi } from './api'
import { HelpdeskApp } from './app'
import './app.css'
import { THEMES, THEME_STORAGE_KEY } from './theme-preference'

const selector = () => page.getByRole('combobox', { name: '介面色系' })
afterEach(async () => {
  vi.restoreAllMocks()
  localStorage.removeItem(THEME_STORAGE_KEY)
  await page.viewport(1280, 800)
})
function root() {
  return document.querySelector<HTMLElement>('.helpdesk-theme')!
}
function noOverflow() {
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    window.innerWidth
  )
  const rect = selector().element().getBoundingClientRect()
  expect(rect.left).toBeGreaterThanOrEqual(0)
  expect(rect.right).toBeLessThanOrEqual(window.innerWidth)
  expect(rect.height).toBeGreaterThanOrEqual(36)
  for (const container of root().querySelectorAll<HTMLElement>(
    '.workspace-content, .composer, .module-page, .chat-panel'
  )) {
    if (container.getClientRects().length)
      expect(container.scrollWidth, container.className).toBeLessThanOrEqual(
        container.clientWidth + 1
      )
  }
}
function rgb(color: string) {
  const values = color.match(/[0-9.]+/g)!.map(Number)
  return { channels: values.slice(0, 3), alpha: values[3] ?? 1 }
}
function contrast(a: string, b: string) {
  const luminance = (color: string) =>
    rgb(color)
      .channels.map((n) => n / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((sum, n, index) => sum + n * [0.2126, 0.7152, 0.0722][index], 0)
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + 0.05) / (values[1] + 0.05)
}
function background(element: Element): string {
  const own = getComputedStyle(element).backgroundColor
  if (rgb(own).alpha === 1) return own
  return element.parentElement
    ? background(element.parentElement)
    : 'rgb(255, 255, 255)'
}
function assertReadable() {
  for (const el of root().querySelectorAll<HTMLElement>('*')) {
    const style = getComputedStyle(el)
    if (
      !el.getClientRects().length ||
      style.visibility === 'hidden' ||
      el.closest('[inert]') ||
      el.closest('button:disabled, textarea:disabled, input:disabled') ||
      el.tagName === 'OPTION'
    )
      continue
    const bounds = el.getBoundingClientRect()
    if (bounds.right <= 0 || bounds.left >= window.innerWidth) continue
    const text = [...el.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()
    )
    if (!text && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) continue
    expect(
      contrast(style.color, background(el)),
      el.className + ' ' + el.textContent?.slice(0, 50)
    ).toBeGreaterThanOrEqual(4.5)
  }
}
async function navigate(name: string) {
  if (window.innerWidth <= 820)
    await page.getByRole('button', { name: '開啟導覽選單' }).click()
  await page
    .getByRole(
      'button',
      name === '收件匣' ? { name: /^收件匣/ } : { name, exact: true }
    )
    .click()
}
it.each([320, 390, 1440])(
  'all palettes: login, chat and every module fit and remain readable at %s',
  async (width) => {
    await page.viewport(width, 900)
    await render(<HelpdeskApp api={createDemoApi()} />)
    for (const theme of THEMES) {
      await selector().selectOptions(theme.id)
      expect(root().dataset.theme).toBe(theme.id)
      noOverflow()
      assertReadable()
    }
    await page.getByRole('button', { name: '進入示範工作台' }).click()
    await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
    await page.getByRole('button', { name: '接手對話' }).click()
    await page.getByRole('textbox', { name: /回覆訊息/ }).fill('跨色系保留草稿')
    for (const theme of THEMES) {
      await selector().selectOptions(theme.id)
      await expect
        .element(page.getByRole('textbox', { name: /回覆訊息/ }))
        .toHaveValue('跨色系保留草稿')
      noOverflow()
      assertReadable()
      for (const name of ['客服成員', '訊息概況', '連線設定', '使用說明']) {
        await navigate(name)
        noOverflow()
        assertReadable()
      }
      await navigate('收件匣')
    }
  }
)
it('switching every theme preserves unknown-send draft and send/handoff locks without another API mutation', async () => {
  await page.viewport(390, 900)
  const api = createDemoApi()
  const send = vi
    .spyOn(api, 'sendMessage')
    .mockRejectedValue(new ApiError(502, 'unknown'))
  const mode = vi.spyOn(api, 'setMode')
  await render(<HelpdeskApp api={api} />)
  const write = vi.spyOn(Storage.prototype, 'setItem')
  await page.getByRole('button', { name: '進入示範工作台' }).click()
  await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
  await page.getByRole('button', { name: '接手對話' }).click()
  await page
    .getByRole('textbox', { name: /回覆訊息/ })
    .fill('不可重送的私密草稿')
  await page.getByRole('button', { name: '送出訊息' }).click()
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('發送結果待確認')
  for (const theme of THEMES) {
    await selector().selectOptions(theme.id)
    await expect
      .element(page.getByRole('textbox', { name: /回覆訊息/ }))
      .toHaveValue('不可重送的私密草稿')
    await expect
      .element(page.getByRole('button', { name: '送出訊息' }))
      .toBeDisabled()
    await expect
      .element(page.getByRole('button', { name: '交回 AI' }))
      .toBeDisabled()
    assertReadable()
  }
  expect(send).toHaveBeenCalledTimes(1)
  expect(mode).toHaveBeenCalledTimes(1)
  expect(write.mock.calls).toEqual(
    THEMES.map(({ id }) => [THEME_STORAGE_KEY, id])
  )
})
it('invalid/blocked storage leaves login and authenticated selectors functional; remount restores only theme', async () => {
  localStorage.setItem(THEME_STORAGE_KEY, 'malformed')
  const view = await render(<HelpdeskApp api={createDemoApi()} />)
  await expect.element(selector()).toHaveValue('light')
  await selector().selectOptions('dark')
  await view.unmount()
  const restored = await render(<HelpdeskApp api={createDemoApi()} />)
  await expect.element(selector()).toHaveValue('dark')
  await expect
    .element(page.getByRole('button', { name: '進入示範工作台' }))
    .toBeVisible()
  await restored.unmount()
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('denied', 'SecurityError')
  })
  await render(<HelpdeskApp api={createDemoApi()} />)
  await expect.element(selector()).toHaveValue('light')
  await selector().selectOptions('dark')
  await page.getByRole('button', { name: '進入示範工作台' }).click()
  await expect.element(selector()).toHaveValue('dark')
  await selector().selectOptions('color')
  await expect.element(selector()).toHaveValue('color')
})
it('native selector is keyboard accessible with visible focus', async () => {
  await render(<HelpdeskApp api={createDemoApi()} />)
  const element = selector().element() as HTMLSelectElement
  for (const theme of THEMES) {
    await selector().selectOptions(theme.id)
    element.focus()
    await expect.element(selector()).toHaveFocus()
    const style = getComputedStyle(element)
    expect(style.outlineStyle).not.toBe('none')
    expect(
      contrast(style.outlineColor, background(element))
    ).toBeGreaterThanOrEqual(3)
    expect(
      contrast(style.borderColor, style.backgroundColor)
    ).toBeGreaterThanOrEqual(3)
  }
  expect(element.labels?.length).toBe(1)
  expect([...element.options].map((option) => option.text)).toEqual(
    THEMES.map(({ name }) => name)
  )
})

it('live login fields and error notice use every palette without persisting credentials', async () => {
  const api = createDemoApi()
  const login = vi.fn().mockRejectedValue(new Error('fixture rejection'))
  const write = vi.spyOn(Storage.prototype, 'setItem')
  await render(<HelpdeskApp api={{ ...api, mode: 'live', login }} />)
  for (const theme of THEMES) {
    await selector().selectOptions(theme.id)
    await page
      .getByRole('textbox', { name: '電子郵件' })
      .fill('example@example.test')
    await page.getByLabelText('密碼', { exact: true }).fill('fixture-only')
    await page.getByRole('button', { name: '登入工作台' }).click()
    await expect.element(page.getByRole('alert')).toHaveTextContent('登入失敗')
    assertReadable()
  }
  expect(write.mock.calls).toEqual(
    THEMES.map(({ id }) => [THEME_STORAGE_KEY, id])
  )
})
