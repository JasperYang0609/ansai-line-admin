import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { ApiError, createDemoApi } from '../api'
import { HelpdeskApp } from '../app'
import '../app.css'

async function openChat(api = createDemoApi()) {
  await page.viewport(1280, 800)
  const screen = await render(<HelpdeskApp api={api} />)
  await page.getByRole('button', { name: '進入示範工作台' }).click()
  await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
  await page.getByRole('button', { name: '接手對話' }).click()
  return screen
}
afterEach(async () => {
  vi.restoreAllMocks()
  await page.viewport(1280, 800)
})
describe('客服工作台流程', () => {
  it('示範入口不要求密碼，接手後送出並保留客服身分', async () => {
    const api = createDemoApi()
    const spy = vi.spyOn(api, 'sendMessage')
    await openChat(api)
    await page.getByRole('textbox', { name: /回覆訊息/ }).fill('測試客服回覆')
    await page.getByRole('button', { name: '送出訊息' }).click()
    await expect
      .element(page.getByRole('log').getByText('測試客服回覆', { exact: true }))
      .toBeVisible()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][2]).toBe(1)
    expect(spy.mock.calls[0][3]).toMatch(/^[0-9a-f-]{36}$/)
    await expect
      .element(page.getByRole('textbox', { name: /回覆訊息/ }))
      .toHaveValue('')
    await expect
      .element(page.getByText('已送出（平台受理）').first())
      .toBeVisible()
  })
  it.each([0, 502])(
    '發送結果不明 %s 時保留草稿，刷新與切換對話都不解鎖',
    async (status) => {
      const api = createDemoApi()
      const spy = vi
        .spyOn(api, 'sendMessage')
        .mockRejectedValue(new ApiError(status, 'unknown'))
      await openChat(api)
      await page.getByRole('textbox', { name: /回覆訊息/ }).fill('不可重送')
      await page.getByRole('button', { name: '送出訊息' }).click()
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent('發送結果待確認')
      await expect
        .element(page.getByRole('textbox', { name: /回覆訊息/ }))
        .toHaveValue('不可重送')
      await expect
        .element(page.getByRole('button', { name: '送出訊息' }))
        .toBeDisabled()
      await page.getByRole('button', { name: '重新整理資料' }).click()
      await page.getByRole('button', { name: /示範顧客：陳同學/ }).click()
      await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
      await expect
        .element(page.getByRole('button', { name: '送出訊息' }))
        .toBeDisabled()
      await expect
        .element(page.getByRole('button', { name: '交回 AI' }))
        .toBeDisabled()
      expect(spy).toHaveBeenCalledTimes(1)
    }
  )
  it('顧客 HTML 訊息只呈現文字，不建立可執行元素', async () => {
    const api = createDemoApi()
    const original = api.listMessages
    const body = '<img src=x onerror=alert(1)><script>alert(1)</script>'
    vi.spyOn(api, 'listMessages').mockImplementation(async (id) => [
      ...(await original(id)),
      {
        id: 'xss',
        conversationId: id,
        body,
        createdAt: new Date().toISOString(),
        authorType: 'customer',
        authorName: '示範顧客',
        status: 'received',
      },
    ])
    await openChat(api)
    await expect
      .element(page.getByRole('log').getByText(body, { exact: true }))
      .toBeVisible()
    expect(
      document.querySelector('[role=log] img, [role=log] script')
    ).toBeNull()
  })
  it('切換對話後，舊對話的晚到訊息不混入新對話', async () => {
    const api = createDemoApi()
    const original = api.listMessages
    await openChat(api)
    let resolve!: (value: Awaited<ReturnType<typeof original>>) => void
    const old = new Promise<Awaited<ReturnType<typeof original>>>((done) => {
      resolve = done
    })
    vi.spyOn(api, 'listMessages').mockImplementation((id) =>
      id === 'demo-1' ? old : original(id)
    )
    await page.getByRole('button', { name: '重新整理資料' }).click()
    await page.getByRole('button', { name: /示範顧客：陳同學/ }).click()
    resolve([
      {
        id: 'late',
        conversationId: 'demo-1',
        body: '舊對話晚到資料',
        createdAt: new Date().toISOString(),
        authorType: 'customer',
        authorName: '示範顧客',
        status: 'received',
      },
    ])
    await expect
      .element(page.getByRole('heading', { name: '示範顧客：陳同學' }))
      .toBeVisible()
    await expect
      .element(
        page.getByRole('log').getByText('舊對話晚到資料', { exact: true })
      )
      .not.toBeInTheDocument()
  })
  it('409 重新載入、不重送且保留草稿', async () => {
    const api = createDemoApi()
    const spy = vi
      .spyOn(api, 'sendMessage')
      .mockRejectedValue(new ApiError(409, 'conflict'))
    await openChat(api)
    await page.getByRole('textbox', { name: /回覆訊息/ }).fill('保留這段文字')
    await page.getByRole('button', { name: '送出訊息' }).click()
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('對話狀態已更新')
    await expect
      .element(page.getByRole('textbox', { name: /回覆訊息/ }))
      .toHaveValue('保留這段文字')
    expect(spy).toHaveBeenCalledTimes(1)
  })
  it('401 清除對話與草稿並要求重新登入', async () => {
    const api = createDemoApi()
    vi.spyOn(api, 'sendMessage').mockRejectedValue(new ApiError(401, 'expired'))
    await openChat(api)
    await page.getByRole('textbox', { name: /回覆訊息/ }).fill('私密草稿')
    await page.getByRole('button', { name: '送出訊息' }).click()
    await expect
      .element(page.getByRole('button', { name: '進入示範工作台' }))
      .toBeVisible()
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('登入已過期')
  })
  it('雙擊送出只發一次，新的明確送出使用新識別碼', async () => {
    const api = createDemoApi()
    const original = api.sendMessage
    let resolve!: () => void
    const gate = new Promise<void>((done) => {
      resolve = done
    })
    const spy = vi
      .spyOn(api, 'sendMessage')
      .mockImplementation(async (...args) => {
        await gate
        return original(...args)
      })
    await openChat(api)
    await page.getByRole('textbox', { name: /回覆訊息/ }).fill('第一則')
    const button = page
      .getByRole('button', { name: '送出訊息' })
      .element() as HTMLButtonElement
    button.click()
    button.click()
    expect(spy).toHaveBeenCalledTimes(1)
    resolve()
    await expect
      .element(page.getByRole('log').getByText('第一則', { exact: true }))
      .toBeVisible()
    await page.getByRole('textbox', { name: /回覆訊息/ }).fill('第二則')
    await page.getByRole('button', { name: '送出訊息' }).click()
    await expect
      .element(page.getByRole('log').getByText('第二則', { exact: true }))
      .toBeVisible()
    expect(spy.mock.calls[0][3]).not.toBe(spy.mock.calls[1][3])
  })
  it('320px 收件匣、對話、導覽與模組不水平溢位', async () => {
    await page.viewport(320, 740)
    await render(<HelpdeskApp api={createDemoApi()} />)
    await page.getByRole('button', { name: '進入示範工作台' }).click()
    await expect
      .element(page.getByRole('button', { name: /示範顧客：林同學/ }))
      .toBeVisible()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320)
    await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
    await expect
      .element(page.getByRole('button', { name: '返回對話列表' }))
      .toBeVisible()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320)
    await page.getByRole('button', { name: '返回對話列表' }).click()
    await page.getByRole('button', { name: '開啟導覽選單' }).click()
    await expect
      .element(page.getByRole('dialog', { name: '主要導覽' }))
      .toBeVisible()
    await page.getByRole('button', { name: '客服成員', exact: true }).click()
    await expect
      .element(page.getByRole('heading', { name: '客服成員' }))
      .toBeVisible()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320)
    await page.getByRole('button', { name: '開啟導覽選單' }).click()
    await expect
      .element(page.getByRole('dialog', { name: '主要導覽' }))
      .toBeVisible()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    )
    await expect
      .element(page.getByRole('button', { name: '開啟導覽選單' }))
      .toHaveFocus()
  })
})
