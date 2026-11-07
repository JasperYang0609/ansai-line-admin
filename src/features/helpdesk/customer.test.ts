import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDemoApi, createLiveApi } from './api'
import { customerSchema, customerUpdateSchema } from './customer'

const details = {
  note: '',
  tags: [],
  version: 0,
  updatedAt: null,
  updatedBy: null,
  canEdit: true,
}
const who = {
  id: 'staff',
  name: '員工',
  email: 'agent@example.test',
  role: 'agent',
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('客戶資料邊界', () => {
  it('Unicode codepoints、trim、去重與清空', () => {
    expect(
      customerUpdateSchema.parse({
        note: '😀'.repeat(5000),
        tags: [' VIP ', 'VIP', '😀'.repeat(30)],
        expectedVersion: 0,
      }).tags
    ).toEqual(['VIP', '😀'.repeat(30)])
    expect(
      customerUpdateSchema.parse({ note: '', tags: [], expectedVersion: 1 })
        .note
    ).toBe('')
  })
  it.each([
    { note: '😀'.repeat(5001) },
    { tags: ['😀'.repeat(31)] },
    { tags: [' '] },
    { tags: Array.from({ length: 11 }, (_, i) => String(i)) },
    { expectedVersion: -1 },
    { expectedVersion: 0.5 },
    { expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
    { tags: [3] },
    { note: null },
  ])('拒絕無效更新 %#', (value) => {
    expect(
      customerUpdateSchema.safeParse({
        note: '',
        tags: [],
        expectedVersion: 0,
        ...value,
      }).success
    ).toBe(false)
  })
  it('回傳缺權限、錯時間、無效版本均 fail closed', () => {
    for (const value of [
      { ...details, canEdit: undefined },
      { ...details, updatedAt: 'bad' },
      { ...details, version: -1 },
    ])
      expect(customerSchema.safeParse(value).success).toBe(false)
  })
  it('demo 限登入、資料隔離、複製、版本衝突、列表標籤與作者', async () => {
    const api = createDemoApi()
    await expect(api.getCustomer('demo-1')).rejects.toMatchObject({
      status: 401,
    })
    await api.login('agent-a@example.test', '')
    const saved = await api.updateCustomer('demo-1', {
      note: '摘要',
      tags: [' VIP ', 'VIP'],
      expectedVersion: 0,
    })
    expect(saved).toMatchObject({
      note: '摘要',
      tags: ['VIP'],
      version: 1,
      updatedBy: { id: 'demo-agent-a' },
    })
    expect((await api.listConversations())[0].tags).toEqual(['VIP'])
    saved.tags.push('修改副本')
    expect((await api.getCustomer('demo-1')).tags).toEqual(['VIP'])
    expect((await api.getCustomer('demo-2')).note).toBe('')
    await expect(
      api.updateCustomer('demo-1', {
        note: '覆寫',
        tags: [],
        expectedVersion: 0,
      })
    ).rejects.toMatchObject({ status: 409 })
    await api.logout()
    await expect(
      api.updateCustomer('demo-1', { note: '', tags: [], expectedVersion: 1 })
    ).rejects.toMatchObject({ status: 401 })
    const fresh = createDemoApi()
    await fresh.login('', '')
    expect((await fresh.getCustomer('demo-1')).note).toBe('')
  })
})
function fixture(responses: Response[]) {
  const fetcher = vi.fn()
  for (const r of [
    Response.json({ access_token: 'fake-user-token' }),
    Response.json(who),
    ...responses,
  ])
    fetcher.mockResolvedValueOnce(r)
  vi.stubGlobal('fetch', fetcher)
  return {
    fetcher,
    api: createLiveApi(
      'https://admin.example.test',
      'https://auth.example.test',
      'sb_publishable_fixture'
    ),
  }
}
describe('客戶資料 live transport', () => {
  it('GET/POST 使用既有 bearer、base 與精確 body，無 LINE 呼叫', async () => {
    const { api, fetcher } = fixture([
      Response.json(details),
      Response.json({ ...details, note: '筆記', tags: ['VIP'], version: 1 }),
    ])
    await api.login('agent@example.test', 'fixture')
    await api.getCustomer('c1')
    await api.updateCustomer('c1', {
      note: '筆記',
      tags: [' VIP ', 'VIP'],
      expectedVersion: 0,
    })
    expect(fetcher.mock.calls[2][0]).toBe(
      'https://admin.example.test/conversations/c1/customer'
    )
    expect(fetcher.mock.calls[2][1].headers.Authorization).toBe(
      'Bearer fake-user-token'
    )
    expect(fetcher.mock.calls[3][1].method).toBe('POST')
    expect(JSON.parse(fetcher.mock.calls[3][1].body)).toEqual({
      note: '筆記',
      tags: ['VIP'],
      expectedVersion: 0,
    })
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
  it.each([401, 403, 404, 405, 409, 501, 503])(
    'HTTP %s 不假成功或重試',
    async (status) => {
      const { api, fetcher } = fixture([new Response(null, { status })])
      await api.login('agent@example.test', 'fixture')
      await expect(
        api.updateCustomer('c1', { note: '', tags: [], expectedVersion: 0 })
      ).rejects.toMatchObject({ status })
      expect(fetcher).toHaveBeenCalledTimes(3)
    }
  )
  it('不符契約成功回傳拒絕，無效路徑／payload 不送出', async () => {
    const { api, fetcher } = fixture([Response.json({ success: true })])
    await api.login('agent@example.test', 'fixture')
    await expect(api.getCustomer('../c')).rejects.toMatchObject({ status: 400 })
    await expect(
      api.updateCustomer('c1', {
        note: 'x'.repeat(5001),
        tags: [],
        expectedVersion: 0,
      })
    ).rejects.toMatchObject({ status: 400 })
    await expect(api.getCustomer('c1')).rejects.toMatchObject({ status: 502 })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
  it('登出後晚到客戶資料不能跨登入期使用', async () => {
    const { api, fetcher } = fixture([])
    await api.login('agent@example.test', 'fixture')
    let resolve!: (r: Response) => void
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        })
    )
    const pending = api.getCustomer('c1')
    const rejected = expect(pending).rejects.toMatchObject({ status: 409 })
    fetcher.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await api.logout()
    resolve(Response.json(details))
    await rejected
  })
})
