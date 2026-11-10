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
      for (const name of [
        '預約行事曆',
        '客服成員',
        '訊息概況',
        '連線設定',
        '使用說明',
      ]) {
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

it.each([320, 390, 768, 1024, 1280, 1440, 1920])(
  'workspace surfaces preserve usable geometry, controls and mobile navigation at %s',
  async (width) => {
    await page.viewport(width, 900)
    await render(<HelpdeskApp api={createDemoApi()} />)
    await page.getByRole('button', { name: '進入示範工作台' }).click()
    await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
    await expect
      .element(page.getByRole('textbox', { name: '內部記事' }))
      .toBeVisible()
    const element = (name: string) => root().querySelector<HTMLElement>(name)!
    const rect = (name: string) => element(name).getBoundingClientRect()
    for (const theme of THEMES) {
      await selector().selectOptions(theme.id)
      noOverflow()
      assertReadable()
      const workspace = rect('.inbox-layout')
      const chat = rect('.chat-panel')
      const list = rect('.conversation-list')
      const details = rect('.customer-details')
      const exterior = width <= 640 ? 8 : 16
      expect(getComputedStyle(element('.inbox-layout')).paddingLeft).toBe(
        exterior + 'px'
      )
      for (const name of [
        '.conversation-list',
        '.chat-panel',
        '.customer-details',
      ]) {
        const style = getComputedStyle(element(name))
        expect(style.borderRadius).toBe('16px')
        expect(style.borderTopWidth).toBe('1px')
        expect(style.boxShadow).not.toBe('none')
      }
      expect(chat.width).toBeGreaterThanOrEqual(width <= 640 ? width - 18 : 370)
      expect(rect('.message-history').height).toBeGreaterThan(240)
      expect(chat.right).toBeLessThanOrEqual(workspace.right - exterior + 1)
      if (width > 640) {
        expect(list.left - workspace.left).toBeCloseTo(exterior, 0)
        expect(chat.left - list.right).toBeCloseTo(12, 0)
        expect(chat.width).toBeGreaterThan(list.width)
        const row = rect('.conversation-item.selected')
        expect(row.left - list.left).toBeGreaterThanOrEqual(8)
        expect(list.right - row.right).toBeGreaterThanOrEqual(8)
      }
      if (width > 1250) {
        expect(details.left - chat.right).toBeCloseTo(12, 0)
        expect(details.top).toBe(chat.top)
        expect(chat.width).toBeGreaterThan(details.width)
      } else {
        expect(details.top - chat.bottom).toBeCloseTo(12, 0)
      }
      const selected = getComputedStyle(element('.conversation-item.selected'))
      expect(selected.borderRadius).toBe('10px')
      expect(selected.borderLeftWidth).toBe(selected.borderRightWidth)
      expect(selected.backgroundColor).not.toBe(
        getComputedStyle(element('.conversation-list')).backgroundColor
      )
      for (const name of [
        '.search-box',
        '.small-button',
        '.primary-button',
        '#customer-note',
        '#customer-tag',
      ])
        expect(getComputedStyle(element(name)).borderRadius).toBe('10px')
      for (const name of [
        '.message-bubble',
        '.composer',
        '.customer-tag-entry',
        '.conversation-item',
      ])
        expect(getComputedStyle(element(name)).boxShadow).toBe('none')
      expect(getComputedStyle(element('.composer')).borderRadius).toBe('16px')
      expect(
        getComputedStyle(element('.composer textarea')).borderTopWidth
      ).toBe('0px')
      const send = rect('.composer .primary-button')
      const composer = rect('.composer')
      expect(composer.right - send.right).toBeLessThanOrEqual(14)
      expect(composer.bottom - send.bottom).toBeLessThanOrEqual(14)
      expect(rect('.customer-name').bottom).toBeLessThan(
        rect('#customer-note').top
      )
      expect(
        parseFloat(getComputedStyle(element('.customer-name')).fontSize)
      ).toBeGreaterThan(
        parseFloat(getComputedStyle(element('.customer-details h2')).fontSize)
      )
      await expect
        .element(page.getByText('歷史紀錄說明', { exact: true }))
        .toBeVisible()
      await expect.element(page.getByText('已受理不代表顧客已讀')).toBeVisible()
    }
    if (width <= 640) {
      await page.getByRole('button', { name: '返回對話列表' }).click()
      await expect
        .element(page.getByRole('region', { name: '對話列表' }))
        .toBeVisible()
      expect(element('.customer-chat-workspace').getClientRects()).toHaveLength(
        0
      )
      noOverflow()
    }
    if (width <= 820) {
      await page.getByRole('button', { name: '開啟導覽選單' }).click()
      expect(element('.sidebar').classList.contains('is-open')).toBe(true)
      expect(rect('.sidebar').left).toBe(0)
      noOverflow()
    }
  }
)
