import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { ApiError, createDemoApi } from '../api'
import { HelpdeskApp } from '../app'
import '../app.css'
import type { CustomerDetails } from '../types'

const note = () => page.getByRole('textbox', { name: '內部記事' })
const save = () => page.getByRole('button', { name: '儲存客戶資料' })
const reload = () => page.getByRole('button', { name: '重新載入客戶資料' })
async function open(api = createDemoApi()) {
  await page.viewport(1440, 900)
  await render(<HelpdeskApp api={api} />)
  await page.getByRole('button', { name: '進入示範工作台' }).click()
  await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
  return api
}
afterEach(async () => {
  vi.restoreAllMocks()
  await page.viewport(1280, 800)
})
describe('客戶內部資料', () => {
  it('儲存、更新人、標籤增刪去重、搜尋與AI提示', async () => {
    const api = await open()
    const spy = vi.spyOn(api, 'updateCustomer')
    await expect
      .element(page.getByText(/AI 預設會讀取記事與標籤/))
      .toBeVisible()
    await note().fill('偏好週末上課')
    await page.getByRole('textbox', { name: '新增標籤' }).fill(' VIP ')
    await page.getByRole('button', { name: '加入標籤' }).click()
    await page.getByRole('textbox', { name: '新增標籤' }).fill('VIP')
    await page.getByRole('button', { name: '加入標籤' }).click()
    await page.getByRole('button', { name: '移除標籤 課程詢問' }).click()
    await save().click()
    await expect.element(page.getByText(/已更新示範記憶體/)).toBeVisible()
    expect(spy.mock.calls[0]).toEqual([
      'demo-1',
      { note: '偏好週末上課', tags: ['VIP'], expectedVersion: 0 },
    ])
    await expect.element(page.getByText(/最後更新：課堂主管/)).toBeVisible()
    await page.getByRole('textbox', { name: '搜尋顧客或訊息' }).fill('VIP')
    await expect
      .element(page.getByRole('button', { name: /示範顧客：林同學/ }))
      .toBeVisible()
    await expect
      .element(page.getByRole('button', { name: /示範顧客：陳同學/ }))
      .not.toBeInTheDocument()
  })
  it('HTML記事、標籤、更新人只顯示文字，不建立可執行元素', async () => {
    const api = createDemoApi()
    const original = api.getCustomer
    const html = '<img src=x onerror=alert(1)><script>alert(1)</script>'
    vi.spyOn(api, 'getCustomer').mockImplementation(async (id) => ({
      ...(await original(id)),
      note: html,
      tags: ['<svg onload=alert(1)>'],
      updatedBy: { id: 'x', name: html },
    }))
    await open(api)
    await expect.element(note()).toHaveValue(html)
    await expect
      .element(page.getByText('<svg onload=alert(1)>', { exact: true }))
      .toBeVisible()
    expect(
      document.querySelector(
        '.customer-details img, .customer-details script, .customer-details svg'
      )
    ).toBeNull()
  })
  it('5000碼點與30碼點通過，超限不儲存', async () => {
    await open()
    await note().fill('😀'.repeat(5000))
    await expect.element(save()).toBeEnabled()
    await note().fill('😀'.repeat(5001))
    await expect.element(save()).toBeDisabled()
    await page.getByRole('textbox', { name: '新增標籤' }).fill('😀'.repeat(30))
    await expect
      .element(page.getByRole('button', { name: '加入標籤' }))
      .toBeEnabled()
    await page.getByRole('textbox', { name: '新增標籤' }).fill('😀'.repeat(31))
    await expect
      .element(page.getByRole('button', { name: '加入標籤' }))
      .toBeDisabled()
  })
  it('409保留草稿，明確確認重新載入後才能用新版本儲存', async () => {
    const api = await open()
    const original = api.updateCustomer
    await original('demo-1', {
      note: '他人更新',
      tags: ['新標籤'],
      expectedVersion: 0,
    })
    const spy = vi.spyOn(api, 'updateCustomer')
    await note().fill('我的草稿')
    await save().click()
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('草稿已保留')
    await expect.element(note()).toHaveValue('我的草稿')
    await expect.element(save()).toBeDisabled()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await reload().click()
    await expect.element(note()).toHaveValue('我的草稿')
    confirm.mockReturnValue(true)
    await reload().click()
    await expect.element(note()).toHaveValue('他人更新')
    await note().fill('合併完成')
    await save().click()
    await expect.element(page.getByText(/已更新示範記憶體/)).toBeVisible()
    expect(spy.mock.calls.map((c) => c[1].expectedVersion)).toEqual([0, 1])
  })
  it.each([403, 404, 405, 501, 503, 0, 502])(
    '儲存失敗%s保留草稿並阻止盲目重試',
    async (status) => {
      const api = await open()
      const spy = vi
        .spyOn(api, 'updateCustomer')
        .mockRejectedValue(new ApiError(status, 'fixture'))
      await note().fill('保留')
      await save().click()
      await expect.element(page.getByRole('alert')).toBeVisible()
      if ([404, 405, 501].includes(status))
        await expect
          .element(page.getByRole('alert'))
          .toHaveTextContent('需更新後端')
      await expect.element(note()).toHaveValue('保留')
      await expect.element(save()).toBeDisabled()
      expect(spy).toHaveBeenCalledTimes(1)
    }
  )
  it.each([403, 404, 405, 501, 503])(
    '讀取失敗%s無假空白資料可儲存',
    async (status) => {
      const api = createDemoApi()
      vi.spyOn(api, 'getCustomer').mockRejectedValue(
        new ApiError(status, 'fixture')
      )
      await open(api)
      await expect.element(page.getByRole('alert')).toBeVisible()
      await expect.element(note()).not.toBeInTheDocument()
      await expect.element(save()).not.toBeInTheDocument()
    }
  )
  it('canEdit=false不提供儲存與標籤編輯', async () => {
    const api = createDemoApi()
    const original = api.getCustomer
    vi.spyOn(api, 'getCustomer').mockImplementation(async (id) => ({
      ...(await original(id)),
      canEdit: false,
    }))
    await open(api)
    await expect.element(note()).toHaveAttribute('readonly')
    await expect.element(save()).not.toBeInTheDocument()
    await expect
      .element(page.getByRole('textbox', { name: '新增標籤' }))
      .not.toBeInTheDocument()
  })
  it.each(['conversation', 'navigation', 'logout'])(
    '取消離開保留草稿、確認才離開 %s',
    async (action) => {
      await open()
      await note().fill('未儲存')
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const target =
        action === 'conversation'
          ? page.getByRole('button', { name: /示範顧客：陳同學/ })
          : action === 'navigation'
            ? page.getByRole('button', { name: '客服成員', exact: true })
            : page.getByRole('button', { name: '登出', exact: true })
      await target.click()
      await expect.element(note()).toHaveValue('未儲存')
      expect(confirm).toHaveBeenCalledTimes(1)
      confirm.mockReturnValue(true)
      await target.click()
      if (action === 'conversation')
        await expect.element(note()).toHaveValue('')
      else await expect.element(note()).not.toBeInTheDocument()
    }
  )
  it('儲存進行中鎖定離開與重複儲存，完成才切換', async () => {
    const api = await open()
    const original = api.updateCustomer
    let finish!: () => void
    const gate = new Promise<void>((done) => {
      finish = done
    })
    const spy = vi
      .spyOn(api, 'updateCustomer')
      .mockImplementation(async (...args) => {
        await gate
        return original(...args)
      })
    await note().fill('等待儲存')
    await save().click()
    await page.getByRole('button', { name: /示範顧客：陳同學/ }).click()
    await expect.element(note()).toHaveValue('等待儲存')
    await page.getByRole('button', { name: '登出', exact: true }).click()
    await expect.element(note()).toHaveValue('等待儲存')
    expect(spy).toHaveBeenCalledTimes(1)
    finish()
    await expect.element(page.getByText(/已更新示範記憶體/)).toBeVisible()
    await page.getByRole('button', { name: /示範顧客：陳同學/ }).click()
    await expect.element(note()).toHaveValue('')
  })
  it('切換後晚到資料及舊401都不影響新客戶', async () => {
    const api = createDemoApi()
    const original = api.getCustomer
    let reject!: (error: Error) => void
    vi.spyOn(api, 'getCustomer').mockImplementation((id) =>
      id === 'demo-1'
        ? new Promise((_, fail) => {
            reject = fail
          })
        : original(id)
    )
    await open(api)
    await page.getByRole('button', { name: /示範顧客：陳同學/ }).click()
    await expect.element(note()).toHaveValue('')
    reject(new ApiError(401, 'late'))
    await expect
      .element(page.getByRole('heading', { name: '示範顧客：陳同學' }))
      .toBeVisible()
    await expect
      .element(page.getByRole('button', { name: '進入示範工作台' }))
      .not.toBeInTheDocument()
  })
  it('同對話刷新與theme不覆蓋草稿，瀏覽器離開有提示', async () => {
    await open()
    await note().fill('保留中的記事')
    await page.getByRole('button', { name: '重新整理資料' }).click()
    await page.getByRole('combobox', { name: '介面色系' }).selectOptions('dark')
    await expect.element(note()).toHaveValue('保留中的記事')
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
  it('切換客戶後舊成功回應不能蓋掉新草稿', async () => {
    const api = createDemoApi()
    const original = api.getCustomer
    let finish!: (value: CustomerDetails) => void
    vi.spyOn(api, 'getCustomer').mockImplementation((id) =>
      id === 'demo-1'
        ? new Promise((done) => {
            finish = done
          })
        : original(id)
    )
    await open(api)
    await page.getByRole('button', { name: /示範顧客：陳同學/ }).click()
    await note().fill('新客戶草稿')
    finish({
      note: '舊客戶私密',
      tags: [],
      version: 3,
      canEdit: true,
      updatedAt: null,
      updatedBy: null,
    })
    await expect.element(note()).toHaveValue('新客戶草稿')
  })
  it('窄版返回需確認未存資料', async () => {
    await open()
    await page.viewport(390, 900)
    await note().fill('草稿')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await page.getByRole('button', { name: '返回對話列表' }).click()
    await expect.element(note()).toHaveValue('草稿')
    confirm.mockReturnValue(true)
    await page.getByRole('button', { name: '返回對話列表' }).click()
    await expect.element(note()).not.toBeInTheDocument()
    await expect
      .element(page.getByRole('button', { name: /示範顧客：陳同學/ }))
      .toBeVisible()
  })
  it('登出後晚到成功不重新顯示私密資料', async () => {
    const api = createDemoApi()
    let finish!: (value: CustomerDetails) => void
    vi.spyOn(api, 'getCustomer').mockImplementation(
      () =>
        new Promise((done) => {
          finish = done
        })
    )
    await open(api)
    await page.getByRole('button', { name: '登出', exact: true }).click()
    finish({
      note: '晚到私密資料',
      tags: [],
      version: 0,
      canEdit: true,
      updatedAt: null,
      updatedBy: null,
    })
    await expect
      .element(page.getByRole('button', { name: '進入示範工作台' }))
      .toBeVisible()
    await expect.element(note()).not.toBeInTheDocument()
  })
  it('當前401清除session與記事', async () => {
    const api = await open()
    vi.spyOn(api, 'updateCustomer').mockRejectedValue(
      new ApiError(401, 'expired')
    )
    await note().fill('私密')
    await save().click()
    await expect
      .element(page.getByRole('button', { name: '進入示範工作台' }))
      .toBeVisible()
    await expect.element(note()).not.toBeInTheDocument()
  })
  it.each([320, 390, 1440])(
    '窄版與桌面%s無水平溢位，記事可達',
    async (width) => {
      await open()
      await page.viewport(width, 900)
      await expect.element(note()).toBeVisible()
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
      const panel = document.querySelector('.customer-details')!
      expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth)
    }
  )
})
