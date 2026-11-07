import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDemoApi, createHelpdeskApi, createLiveApi } from './api'

const key = 'sb_publishable_classroom_fake'
const id = () => crypto.randomUUID()
afterEach(() => vi.unstubAllGlobals())
describe('明確分離示範與真實模式', () => {
  it('預設為示範，未知與不完整 live 設定不降級', () => {
    expect(createHelpdeskApi({}).mode).toBe('demo')
    expect(() => createHelpdeskApi({ mode: 'typo' })).toThrow()
    expect(() => createHelpdeskApi({ mode: 'live' })).toThrow()
  })
  it.each([
    'http://admin.example.test',
    'https://user:pass@admin.example.test',
    'https://admin.example.test?token=bad',
    'https://admin.example.test#secret',
  ])('拒絕不安全位址 %s', (url) =>
    expect(() =>
      createLiveApi(url, 'https://project.supabase.co', key)
    ).toThrow()
  )
  it('拒絕 server secret 作為公開 key', () =>
    expect(() =>
      createLiveApi(
        'https://admin.example.test',
        'https://project.supabase.co',
        'sb_secret_not_a_real_key'
      )
    ).toThrow())
})
describe('示範中的回覆與歸屬', () => {
  it('未登入不能讀取對話', async () => {
    await expect(createDemoApi().listConversations()).rejects.toMatchObject({
      status: 401,
    })
  })
  it('必須真人接手後才可發送，作者來自登入', async () => {
    const api = createDemoApi()
    await api.login('agent-a@example.test', '')
    await expect(
      api.sendMessage('demo-1', '您好', 0, id())
    ).rejects.toMatchObject({ status: 403 })
    const c = await api.setMode('demo-1', 'human', 0)
    const m = await api.sendMessage(c.id, ' 您好 ', c.version, id())
    expect(m.authorName).toBe('客服小安')
    expect(m.body).toBe('您好')
    expect((await api.listMessages(c.id)).slice(-1)[0]?.id).toBe(m.id)
  })
  it('同識別碼同內容去重，不同內容拒絕', async () => {
    const api = createDemoApi()
    await api.login('agent-a@example.test', '')
    const c = await api.setMode('demo-1', 'human', 0)
    const requestId = id()
    const a = await api.sendMessage(c.id, '一次', c.version, requestId)
    const b = await api.sendMessage(c.id, '一次', c.version, requestId)
    expect(a.id).toBe(b.id)
    await expect(
      api.sendMessage(c.id, '兩次', c.version, requestId)
    ).rejects.toMatchObject({ status: 409 })
  })
  it('阻擋其他客服發送與恢復 AI', async () => {
    const api = createDemoApi()
    await api.login('agent-b@example.test', '')
    await expect(
      api.sendMessage('demo-2', '搶答', 1, id())
    ).rejects.toMatchObject({ status: 403 })
    await expect(api.setMode('demo-2', 'ai', 1)).rejects.toMatchObject({
      status: 403,
    })
  })
  it('拒絕舊版本以及切回 AI 後的晚到人工回覆', async () => {
    const api = createDemoApi()
    await api.login('agent-a@example.test', '')
    const c = await api.setMode('demo-1', 'human', 0)
    await expect(api.setMode(c.id, 'ai', 0)).rejects.toMatchObject({
      status: 409,
    })
    await api.setMode(c.id, 'ai', c.version)
    await expect(
      api.sendMessage(c.id, '晚到', c.version, id())
    ).rejects.toMatchObject({ status: 409 })
  })
  it('空白、過長、無效識別碼拒絕', async () => {
    const api = createDemoApi()
    await api.login('agent-a@example.test', '')
    for (const body of [' ', '字'.repeat(5001)])
      await expect(
        api.sendMessage('demo-2', body, 1, id())
      ).rejects.toMatchObject({ status: 400 })
    await expect(
      api.sendMessage('demo-2', '測試', 1, 'invalid')
    ).rejects.toMatchObject({ status: 400 })
  })
  it('複製回傳值不會讓呼叫端改動記憶體資料', async () => {
    const api = createDemoApi()
    await api.login('teacher@example.test', '')
    const rows = await api.listConversations()
    rows[0].mode = 'human'
    expect((await api.listConversations())[0].mode).toBe('ai')
    await api.logout()
    await expect(api.listStaff()).rejects.toMatchObject({ status: 401 })
  })
})
describe('真實 transport：伺服器權威與失敗行為', () => {
  const who = {
    id: 'server-user',
    name: '伺服器客服',
    email: 'agent@example.test',
    role: 'agent',
  }
  function fixture(extra: Response[]) {
    const fetcher = vi.fn()
    for (const response of [
      Response.json({ access_token: 'test-user-token' }),
      Response.json(who),
      ...extra,
    ])
      fetcher.mockResolvedValueOnce(response)
    vi.stubGlobal('fetch', fetcher)
    return {
      fetcher,
      api: createLiveApi(
        'https://admin.example.test',
        'https://project.supabase.co',
        key
      ),
    }
  }
  it('Supabase 驗證後仍要求後端確認員工身分', async () => {
    const { api, fetcher } = fixture([])
    expect(
      (await api.login('agent@example.test', 'fake-password')).staff.id
    ).toBe(who.id)
    expect(fetcher.mock.calls[1][0]).toBe('https://admin.example.test/session')
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(
      'Bearer test-user-token'
    )
  })
  it('正式模式使用伺服器接手與發送端點，不傳作者或租戶', async () => {
    const conversation = {
      id: 'c',
      customerName: '合成顧客',
      preview: '',
      updatedAt: new Date().toISOString(),
      mode: 'human',
      version: 4,
      assignedTo: who.id,
      unread: 0,
      tags: [],
    }
    const message = {
      id: 'm',
      conversationId: 'c',
      body: '測試',
      createdAt: new Date().toISOString(),
      authorType: 'agent',
      authorName: who.name,
      status: 'sent',
    }
    const { api, fetcher } = fixture([
      Response.json(conversation),
      Response.json(message),
      Response.json({ ...conversation, mode: 'ai', version: 5 }),
    ])
    await api.login('agent@example.test', 'fake-password')
    await api.setMode('c', 'human', 3)
    const requestId = id()
    await api.sendMessage('c', ' 測試 ', 4, requestId)
    await api.setMode('c', 'ai', 4)
    expect(fetcher.mock.calls[2][0]).toBe(
      'https://admin.example.test/conversations/c/mode'
    )
    expect(fetcher.mock.calls[2][1].method).toBe('POST')
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({
      mode: 'human',
      expectedVersion: 3,
    })
    expect(JSON.parse(fetcher.mock.calls[3][1].body)).toEqual({
      body: '測試',
      expectedVersion: 4,
      requestId,
    })
    expect(fetcher).toHaveBeenCalledTimes(5)
  })
  it('人工發送的逾時、5xx 與格式錯誤都只發出一次請求', async () => {
    for (const response of [
      new Response('', { status: 503 }),
      Response.json({ wrong: true }),
    ]) {
      const { api, fetcher } = fixture([response])
      await api.login('agent@example.test', 'fake-password')
      await expect(
        api.sendMessage('c', '人工回覆', 1, id())
      ).rejects.toMatchObject({ status: expect.any(Number) })
      expect(fetcher).toHaveBeenCalledTimes(3)
    }
  })
  it('401 清除 session，之後不能繼續呼叫', async () => {
    const { api, fetcher } = fixture([new Response('', { status: 401 })])
    await api.login('agent@example.test', 'fake-password')
    await expect(api.listStaff()).rejects.toMatchObject({ status: 401 })
    await expect(api.listConversations()).rejects.toMatchObject({ status: 401 })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
  it('409 不重試，不變成示範成功', async () => {
    const { api, fetcher } = fixture([new Response('', { status: 409 })])
    await api.login('agent@example.test', 'fake-password')
    await expect(api.listMessages('c')).rejects.toMatchObject({
      status: 409,
    })
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(api.mode).toBe('live')
  })
  it('未授權員工不留下 bearer', async () => {
    const { api, fetcher } = fixture([Response.json([])])
    fetcher
      .mockReset()
      .mockResolvedValueOnce(Response.json({ access_token: 'test-user-token' }))
      .mockResolvedValueOnce(new Response('', { status: 403 }))
    await expect(
      api.login('agent@example.test', 'fake-password')
    ).rejects.toMatchObject({ status: 403 })
    await expect(api.listStaff()).rejects.toMatchObject({ status: 401 })
  })
  it('拒絕 malformed response 及路徑穿越', async () => {
    const { api, fetcher } = fixture([Response.json({ items: [] })])
    await api.login('agent@example.test', 'fake-password')
    await expect(api.listConversations()).rejects.toThrow()
    await expect(api.listMessages('../staff')).rejects.toMatchObject({
      status: 400,
    })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
  it('204 登出正常且清除登入', async () => {
    const { api } = fixture([new Response(null, { status: 204 })])
    await api.login('agent@example.test', 'fake-password')
    await api.logout()
    await expect(api.listConversations()).rejects.toMatchObject({ status: 401 })
  })
})

it('較早歷史使用原始時間與識別碼游標，不把微秒時間截斷', async () => {
  const calls = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ access_token: '合成登入權杖' }))
    .mockResolvedValueOnce(
      Response.json({
        id: 'a',
        name: '合成客服',
        email: 'a@example.test',
        role: 'agent',
      })
    )
    .mockResolvedValueOnce(Response.json([]))
  vi.stubGlobal('fetch', calls)
  const api = createLiveApi(
    'https://admin.example.test',
    'https://project.supabase.co',
    key
  )
  await api.login('a@example.test', '合成密碼')
  const before = {
    createdAt: '2020-01-01T00:00:00.123456+00:00',
    id: '80000000-0000-4000-8000-000000000001',
  }
  await api.listMessages('c', before)
  const url = new URL(calls.mock.calls[2][0])
  expect(url.searchParams.get('beforeAt')).toBe(before.createdAt)
  expect(url.searchParams.get('beforeId')).toBe(before.id)
  expect(calls.mock.calls[2][1].method).toBe('GET')
  await expect(
    api.listMessages('c', { ...before, createdAt: '錯誤時間' })
  ).rejects.toMatchObject({ status: 400 })
  expect(calls).toHaveBeenCalledTimes(3)
})
