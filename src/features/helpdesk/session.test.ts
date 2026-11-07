import { afterEach, expect, it, vi } from 'vitest'
import { createLiveApi } from './api'

afterEach(() => vi.unstubAllGlobals())
const staff = {
  id: 'b',
  name: '客服 B',
  email: 'b@example.test',
  role: 'agent',
}
function deferred() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
it('A 的晚到 401 不清掉 B 的 token', async () => {
  const old = deferred()
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ access_token: 'token-a' }))
    .mockResolvedValueOnce(Response.json({ ...staff, id: 'a' }))
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(Response.json({ access_token: 'token-b' }))
    .mockResolvedValueOnce(Response.json(staff))
    .mockResolvedValueOnce(Response.json([staff]))
  vi.stubGlobal('fetch', fetcher)
  const api = createLiveApi(
    'https://admin.example.test',
    'https://project.supabase.co',
    'sb_publishable_fake'
  )
  await api.login('a@example.test', 'fake')
  const pending = api.listConversations().catch((error) => error)
  await api.logout()
  await api.login('b@example.test', 'fake')
  old.resolve(new Response('', { status: 401 }))
  expect((await pending).status).toBe(401)
  expect((await api.listStaff())[0].id).toBe('b')
  expect(fetcher.mock.calls[6][1].headers.Authorization).toBe('Bearer token-b')
})
it('A 的晚到登入不能覆寫 B 的登入', async () => {
  const old = deferred()
  const fetcher = vi
    .fn()
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(Response.json({ access_token: 'token-b' }))
    .mockResolvedValueOnce(Response.json(staff))
    .mockResolvedValueOnce(Response.json([staff]))
  vi.stubGlobal('fetch', fetcher)
  const api = createLiveApi(
    'https://admin.example.test',
    'https://project.supabase.co',
    'sb_publishable_fake'
  )
  const pending = api.login('a@example.test', 'fake').catch((error) => error)
  await api.login('b@example.test', 'fake')
  old.resolve(Response.json({ access_token: 'token-a' }))
  expect((await pending).status).toBe(409)
  expect((await api.listStaff())[0].id).toBe('b')
  expect(fetcher.mock.calls[3][1].headers.Authorization).toBe('Bearer token-b')
})
it('查閱回傳無效或過大時拒絕結果，不重試', async () => {
  for (const response of [
    Response.json({ wrong: true }),
    new Response('x'.repeat(1_048_577)),
  ]) {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'token-b' }))
      .mockResolvedValueOnce(Response.json(staff))
      .mockResolvedValueOnce(response)
    vi.stubGlobal('fetch', fetcher)
    const api = createLiveApi(
      'https://admin.example.test',
      'https://project.supabase.co',
      'sb_publishable_fake'
    )
    await api.login('b@example.test', 'fake')
    await expect(api.listMessages('c')).rejects.toMatchObject({ status: 502 })
    expect(fetcher).toHaveBeenCalledTimes(3)
  }
})

it('切換客服帳號後，上一位帳號晚到的歷史不能交給新登入', async () => {
  const old = deferred()
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ access_token: 'token-a' }))
    .mockResolvedValueOnce(Response.json({ ...staff, id: 'a' }))
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(Response.json({ access_token: 'token-b' }))
    .mockResolvedValueOnce(Response.json(staff))
  vi.stubGlobal('fetch', fetcher)
  const api = createLiveApi(
    'https://admin.example.test',
    'https://project.supabase.co',
    'sb_publishable_fake'
  )
  await api.login('a@example.test', 'fake')
  const pending = api.listMessages('conversation-a').catch((error) => error)
  await api.login('b@example.test', 'fake')
  old.resolve(Response.json([{ body: '舊帳號的客戶資料' }]))
  expect((await pending).status).toBe(409)
})
