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
    .element(page.getByRole('note'))
    .toHaveTextContent('部分舊訊息、AI 回覆與真人回覆可能未保存')
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
