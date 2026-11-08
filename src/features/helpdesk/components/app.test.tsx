import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { ApiError, createDemoApi } from '../api'
import { HelpdeskApp } from '../app'
import '../app.css'
import type { HelpdeskApi, Message } from '../types'

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

it('正式查閱顯示歷史範圍並隱藏接手、恢復和發送', async () => {
  const demo = createDemoApi()
  await render(
    <HelpdeskApp
      api={{
        ...demo,
        mode: 'live',
        login: () => demo.login('teacher@example.test', ''),
      }}
    />
  )
  await page
    .getByRole('textbox', { name: '電子郵件' })
    .fill('agent@example.test')
  await page.getByLabelText('密碼', { exact: true }).fill('fixture-only')
  await page.getByRole('button', { name: '登入工作台' }).click()
  await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
  await expect
    .element(page.getByText('歷史紀錄說明', { exact: true }))
    .toBeVisible()
  await expect
    .element(page.getByText('已保存的正文長期保留', { exact: false }))
    .not.toBeVisible()
  await page.getByText('歷史紀錄說明', { exact: true }).click()
  await expect
    .element(page.getByText('已保存的正文長期保留', { exact: false }))
    .toBeVisible()
  await expect
    .element(page.getByRole('button', { name: '接手對話' }))
    .not.toBeInTheDocument()
  await expect
    .element(page.getByRole('button', { name: '交回 AI' }))
    .not.toBeInTheDocument()
  await expect
    .element(page.getByRole('button', { name: '送出訊息' }))
    .not.toBeInTheDocument()
})

it('取得伺服器操作資格的正式員工能接手、輸入回覆及交回 AI', async () => {
  const demo = createDemoApi()
  const login = async () => {
    const result = await demo.login('teacher@example.test', '')
    return { ...result, staff: { ...result.staff, canReply: true } }
  }
  const send = vi.spyOn(demo, 'sendMessage')
  await render(<HelpdeskApp api={{ ...demo, mode: 'live', login }} />)
  await page
    .getByRole('textbox', { name: '電子郵件' })
    .fill('agent@example.test')
  await page.getByLabelText('密碼', { exact: true }).fill('fixture-only')
  await page.getByRole('button', { name: '登入工作台' }).click()
  await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
  await page.getByRole('button', { name: '接手對話' }).click()
  await page.getByRole('textbox', { name: '回覆訊息' }).fill('這是人工回覆')
  await page.getByRole('button', { name: '送出訊息' }).click()
  await expect
    .element(page.getByRole('log').getByText('這是人工回覆', { exact: true }))
    .toBeInTheDocument()
  expect(send).toHaveBeenCalledTimes(1)
  await page.getByRole('button', { name: '交回 AI' }).click()
  await expect
    .element(page.getByRole('button', { name: '接手對話' }))
    .toBeInTheDocument()
})

it('等待客服的未分派對話可直接接手，不必先交回 AI', async () => {
  const demo = createDemoApi()
  const change = vi.spyOn(demo, 'setMode')
  await render(
    <HelpdeskApp
      api={{
        ...demo,
        listConversations: async () =>
          (await demo.listConversations()).map((c) =>
            c.id === 'demo-2' ? { ...c, assignedTo: null } : c
          ),
      }}
    />
  )
  await page.getByRole('button', { name: '進入示範工作台' }).click()
  await page.getByRole('button', { name: /示範顧客：陳同學/ }).click()
  await page.getByRole('button', { name: '接手對話' }).click()
  expect(change).toHaveBeenCalledWith('demo-2', 'human', 1)
})

it('唯讀客服能載入超過三十天的 AI 與真人原文，讀到起點後保留已載入紀錄', async () => {
  const demo = createDemoApi()
  const recent = {
    id: 'recent',
    conversationId: 'demo-1',
    body: '近期合成提問',
    createdAt: '2026-11-01T00:00:00Z',
    authorType: 'customer' as const,
    authorName: '合成顧客',
    status: 'received' as const,
  }
  const old = [
    {
      ...recent,
      id: 'old-ai',
      body: '六年前保存的 AI 原文',
      createdAt: '2020-01-01T00:00:00Z',
      authorType: 'ai' as const,
      status: 'sent' as const,
    },
    {
      ...recent,
      id: 'old-agent',
      body: '六年前保存的真人原文',
      createdAt: '2020-01-02T00:00:00Z',
      authorType: 'agent' as const,
      status: 'sent' as const,
    },
  ]
  const history = vi
    .fn()
    .mockResolvedValueOnce([recent])
    .mockResolvedValueOnce(old)
    .mockResolvedValueOnce([])
  await render(
    <HelpdeskApp
      api={{
        ...demo,
        mode: 'live',
        login: () => demo.login('teacher@example.test', ''),
        listMessages: history,
      }}
    />
  )
  await page.getByRole('textbox', { name: '電子郵件' }).fill('a@example.test')
  await page.getByLabelText('密碼', { exact: true }).fill('合成密碼')
  await page.getByRole('button', { name: '登入工作台' }).click()
  await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
  await page.getByRole('button', { name: '載入較早訊息' }).click()
  expect(history).toHaveBeenLastCalledWith('demo-1', {
    id: recent.id,
    createdAt: recent.createdAt,
  })
  await expect
    .element(page.getByRole('log').getByText(old[0].body, { exact: true }))
    .toBeVisible()
  await expect
    .element(page.getByRole('log').getByText(old[1].body, { exact: true }))
    .toBeVisible()
  await page.getByRole('button', { name: '載入較早訊息' }).click()
  await expect
    .element(page.getByRole('button', { name: '載入較早訊息' }))
    .not.toBeInTheDocument()
  await expect
    .element(page.getByRole('log').getByText(old[0].body, { exact: true }))
    .toBeInTheDocument()
})

function notificationFixture() {
  const demo = createDemoApi()
  let notify = () => {}
  const stop = vi.fn()
  const api: HelpdeskApi = {
    ...demo,
    mode: 'live',
    login: async () => {
      const session = await demo.login('teacher@example.test', '')
      return { ...session, staff: { ...session.staff, canReply: true } }
    },
    subscribe: (changed, status) => {
      notify = changed
      status('connected')
      return stop
    },
  }
  return { api, notify: () => notify(), stop }
}

describe('正式工作台名稱與操作說明', () => {
  it('正式模式沒有學習版或開發教學字眼，說明依操作權限顯示', async () => {
    const demo = createDemoApi()
    const send = vi.spyOn(demo, 'sendMessage')
    const mode = vi.spyOn(demo, 'setMode')
    const api: HelpdeskApi = {
      ...demo,
      mode: 'live',
      login: async () => {
        const session = await demo.login('teacher@example.test', '')
        return {
          ...session,
          staff: { ...session.staff, name: '合成正式客服', canReply: true },
        }
      },
    }
    await render(<HelpdeskApp api={api} />)
    await page
      .getByRole('textbox', { name: '電子郵件' })
      .fill('fixture@example.test')
    await page.getByLabelText('密碼', { exact: true }).fill('合成密碼')
    await page.getByRole('button', { name: '登入工作台' }).click()
    await expect
      .element(page.getByText('合成正式客服', { exact: true }))
      .toBeVisible()
    await expect
      .element(page.getByText('學習版', { exact: true }))
      .not.toBeInTheDocument()
    await expect
      .element(page.getByText('示範環境', { exact: true }))
      .not.toBeInTheDocument()
    await page.getByRole('button', { name: '連線設定', exact: true }).click()
    await expect
      .element(page.getByText('正式環境', { exact: true }))
      .toBeVisible()
    await expect
      .element(
        page.getByText(
          '目前帳號可查看授權對話，接手後回覆顧客，並在需要時交回 AI。',
          { exact: false }
        )
      )
      .toBeVisible()
    await expect
      .element(
        page.getByText('接手、恢復 AI 與人工發送留待後續', { exact: false })
      )
      .not.toBeInTheDocument()
    await page.getByRole('button', { name: '客服成員', exact: true }).click()
    await expect
      .element(page.getByText('名單僅供查看', { exact: true }))
      .toBeVisible()
    await page.getByRole('button', { name: '使用說明', exact: true }).click()
    await expect
      .element(page.getByRole('heading', { name: '使用說明', exact: true }))
      .toBeVisible()
    await expect
      .element(page.getByRole('heading', { name: '確認發送結果', exact: true }))
      .toBeVisible()
    await expect
      .element(page.getByText('資料與權限由團隊管理', { exact: true }))
      .toBeVisible()
    await expect
      .element(page.getByText('介面與資料分開', { exact: true }))
      .not.toBeInTheDocument()
    expect(send).not.toHaveBeenCalled()
    expect(mode).not.toHaveBeenCalled()
  })
  it('真正唯讀權限仍明確顯示，不能因名稱整理而開放發送', async () => {
    const demo = createDemoApi()
    await render(
      <HelpdeskApp
        api={{
          ...demo,
          mode: 'live',
          login: () => demo.login('teacher@example.test', ''),
        }}
      />
    )
    await page
      .getByRole('textbox', { name: '電子郵件' })
      .fill('fixture@example.test')
    await page.getByLabelText('密碼', { exact: true }).fill('合成密碼')
    await page.getByRole('button', { name: '登入工作台' }).click()
    await expect
      .element(page.getByText('正式紀錄 · 唯讀', { exact: true }))
      .not.toBeInTheDocument()
    await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
    await expect
      .element(page.getByRole('button', { name: '接手對話', exact: true }))
      .not.toBeInTheDocument()
    await expect
      .element(page.getByRole('textbox', { name: /回覆訊息/ }))
      .not.toBeInTheDocument()
    await page.getByRole('button', { name: '連線設定', exact: true }).click()
    await expect
      .element(
        page.getByText('如需接手或發送訊息，請聯絡團隊管理員核准操作權限。', {
          exact: false,
        })
      )
      .toBeVisible()
  })
  it('示範環境仍保留不連接 LINE 的明確提示，操作說明不假裝成正式資料', async () => {
    await render(<HelpdeskApp api={createDemoApi()} />)
    await page
      .getByRole('button', { name: '進入示範工作台', exact: true })
      .click()
    await expect
      .element(page.getByText('示範模式 · 不連接 LINE', { exact: true }))
      .toBeVisible()
    await expect
      .element(page.getByText('示範環境', { exact: true }))
      .toBeVisible()
    await page
      .getByRole('button', { name: '查看操作說明', exact: true })
      .click()
    await expect
      .element(page.getByText('目前是示範環境', { exact: true }))
      .toBeVisible()
    await expect
      .element(
        page.getByText(
          '這裡使用示範資料，不會傳送訊息至 LINE；重新整理頁面後會重設。',
          { exact: true }
        )
      )
      .toBeVisible()
  })
})
async function openNotificationChat(api: HelpdeskApi) {
  await page.viewport(1280, 800)
  await render(<HelpdeskApp api={api} />)
  await page
    .getByRole('textbox', { name: '電子郵件' })
    .fill('fixture@example.test')
  await page.getByLabelText('密碼', { exact: true }).fill('合成密碼')
  await page.getByRole('button', { name: '登入工作台' }).click()
  await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
  await page.getByRole('button', { name: '接手對話', exact: true }).click()
}
const notificationMessage = (id: string, body = id): Message => ({
  id,
  body,
  conversationId: 'demo-1',
  authorName: '合成顧客',
  authorType: 'customer',
  status: 'received',
  createdAt: '2026-11-08T00:00:00Z',
})

describe('事件通知自動更新', () => {
  it('員工發送資格撤回通知會更新成唯讀，不重建訂閱或丟失歷史', async () => {
    const fixture = notificationFixture()
    const subscribe = vi.spyOn(fixture.api, 'subscribe')
    await openNotificationChat(fixture.api)
    const person = (await fixture.api.listStaff()).find(
      (item) => item.role === 'admin'
    )!
    fixture.api.getSession = async () => ({ ...person, canReply: false })
    fixture.notify()
    await expect
      .element(page.getByText('正式紀錄 · 唯讀', { exact: true }))
      .not.toBeInTheDocument()
    await expect
      .element(page.getByRole('textbox', { name: /回覆訊息/ }))
      .not.toBeInTheDocument()
    await expect.element(page.getByRole('log')).toBeInTheDocument()
    expect(subscribe).toHaveBeenCalledTimes(1)
  })
  it('閒置超過五秒不查詢，有通知才合併更新，保留草稿且不發送', async () => {
    const fixture = notificationFixture()
    const { api } = fixture
    const overview = vi.spyOn(api, 'listConversations')
    const send = vi.spyOn(api, 'sendMessage')
    const history = vi.spyOn(api, 'listMessages')
    await openNotificationChat(api)
    await page
      .getByRole('textbox', { name: '回覆訊息', exact: true })
      .fill('還沒寫完的草稿')
    const calls = overview.mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 5200))
    expect(overview).toHaveBeenCalledTimes(calls)
    history.mockResolvedValue([notificationMessage('通知新訊息')])
    fixture.notify()
    fixture.notify()
    fixture.notify()
    await expect
      .element(page.getByRole('log').getByText('通知新訊息', { exact: true }))
      .toBeInTheDocument()
    expect(overview).toHaveBeenCalledTimes(calls + 1)
    await expect
      .element(page.getByRole('textbox', { name: '回覆訊息', exact: true }))
      .toHaveValue('還沒寫完的草稿')
    expect(send).not.toHaveBeenCalled()
    await page.getByRole('button', { name: '登出', exact: true }).click()
    expect(fixture.stop).toHaveBeenCalledTimes(1)
    fixture.notify()
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(overview).toHaveBeenCalledTimes(calls + 1)
  }, 15000)
  it.each([401, 403])(
    '背景讀取遇到 %s 會清除私密畫面與訂閱',
    async (status) => {
      const fixture = notificationFixture()
      await openNotificationChat(fixture.api)
      vi.spyOn(fixture.api, 'listConversations').mockRejectedValue(
        new ApiError(503, '合成暫時故障')
      )
      vi.spyOn(fixture.api, 'listStaff').mockRejectedValue(
        new ApiError(status, '合成資格撤銷')
      )
      fixture.notify()
      await expect
        .element(page.getByRole('button', { name: '登入工作台', exact: true }))
        .toBeVisible()
      expect(fixture.stop).toHaveBeenCalledTimes(1)
      await expect.element(page.getByRole('log')).not.toBeInTheDocument()
    }
  )
  it('未知發送結果不因新通知或已讀回資料而解鎖、重送', async () => {
    const fixture = notificationFixture()
    const send = vi
      .spyOn(fixture.api, 'sendMessage')
      .mockRejectedValue(new ApiError(0, '合成未知結果'))
    await openNotificationChat(fixture.api)
    await page
      .getByRole('textbox', { name: '回覆訊息', exact: true })
      .fill('不能重送的草稿')
    await page.getByRole('button', { name: '送出訊息', exact: true }).click()
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('發送結果待確認')
    vi.spyOn(fixture.api, 'listMessages').mockResolvedValue([
      notificationMessage('鎖定後的新提問'),
    ])
    fixture.notify()
    await expect
      .element(
        page.getByRole('log').getByText('鎖定後的新提問', { exact: true })
      )
      .toBeInTheDocument()
    await expect
      .element(page.getByRole('button', { name: '送出訊息', exact: true }))
      .toBeDisabled()
    await expect
      .element(page.getByRole('button', { name: '交回 AI', exact: true }))
      .toBeDisabled()
    await expect
      .element(page.getByRole('textbox', { name: /回覆訊息/ }))
      .toHaveValue('不能重送的草稿')
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('斷線空窗超過百則會補齊中段，保留較早歷史與閱讀位置', async () => {
    const fixture = notificationFixture()
    const old = Array.from({ length: 30 }, (_, i) => ({
      ...notificationMessage('舊-' + i, '合成舊訊息' + i + '。'.repeat(120)),
      createdAt: new Date(Date.UTC(2020, 0, 1, 0, 0, i)).toISOString(),
    }))
    const history = vi.spyOn(fixture.api, 'listMessages').mockResolvedValue(old)
    await openNotificationChat(fixture.api)
    const log = page.getByRole('log').element() as HTMLElement
    log.scrollTop = 80
    log.dispatchEvent(new Event('scroll'))
    const newest = Array.from({ length: 100 }, (_, i) => ({
      ...notificationMessage('新-' + i),
      createdAt: new Date(Date.UTC(2026, 10, 8, 0, 0, i)).toISOString(),
    }))
    history.mockImplementation(async (_id, before) =>
      before
        ? [
            old[old.length - 1],
            {
              ...notificationMessage('補齊中段'),
              createdAt: '2025-01-01T00:00:00Z',
            },
          ]
        : newest
    )
    fixture.notify()
    await expect
      .element(page.getByRole('log').getByText('補齊中段', { exact: true }))
      .toBeInTheDocument()
    await expect
      .element(page.getByRole('log').getByText(old[0].body, { exact: true }))
      .toBeInTheDocument()
    expect(log.scrollTop).toBe(80)
    expect(history).toHaveBeenLastCalledWith('demo-1', {
      id: newest[0].id,
      createdAt: newest[0].createdAt,
    })
  })
  it('讀取中的通知不遺失，切換對話後不混入舊資料', async () => {
    const fixture = notificationFixture()
    await openNotificationChat(fixture.api)
    const original = fixture.api.listMessages
    let resolve!: (value: Message[]) => void
    const waiting = new Promise<Message[]>((done) => {
      resolve = done
    })
    const history = vi
      .spyOn(fixture.api, 'listMessages')
      .mockImplementation((id) => (id === 'demo-1' ? waiting : original(id)))
    fixture.notify()
    await vi.waitFor(() => expect(history).toHaveBeenCalled())
    await page.getByRole('button', { name: /示範顧客：陳同學/ }).click()
    fixture.notify()
    resolve([notificationMessage('晚到不可混入')])
    await expect
      .element(page.getByRole('heading', { name: '示範顧客：陳同學' }))
      .toBeVisible()
    await expect
      .element(page.getByRole('log').getByText('晚到不可混入', { exact: true }))
      .not.toBeInTheDocument()
    await vi.waitFor(() =>
      expect(history.mock.calls.some(([id]) => id === 'demo-2')).toBe(true)
    )
  })
  it('通知故障保留既有資料與草稿，回到頁面後可補讀', async () => {
    const fixture = notificationFixture()
    await openNotificationChat(fixture.api)
    await page
      .getByRole('textbox', { name: '回覆訊息', exact: true })
      .fill('不能丟的草稿')
    const history = vi
      .spyOn(fixture.api, 'listMessages')
      .mockRejectedValueOnce(new ApiError(503, '合成暫時故障'))
      .mockResolvedValue([notificationMessage('恢復連線後補讀')])
    fixture.notify()
    await expect
      .element(
        page.getByText('即時連線中斷，恢復連線後自動補讀', { exact: false })
      )
      .toBeVisible()
    await expect
      .element(page.getByRole('textbox', { name: '回覆訊息', exact: true }))
      .toHaveValue('不能丟的草稿')
    window.dispatchEvent(new Event('focus'))
    await expect
      .element(
        page.getByRole('log').getByText('恢復連線後補讀', { exact: true })
      )
      .toBeInTheDocument()
    expect(history).toHaveBeenCalledTimes(2)
  })
})
