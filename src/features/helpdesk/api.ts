import { z } from 'zod'
import type {
  Conversation,
  HelpdeskApi,
  Message,
  Session,
  Staff,
} from './types'

const staffSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
  role: z.enum(['admin', 'agent']),
})
const conversationSchema = z.object({
  id: z.string().min(1),
  customerName: z.string(),
  preview: z.string(),
  updatedAt: z.string(),
  mode: z.enum(['ai', 'human']),
  version: z.number().int().nonnegative(),
  assignedTo: z.string().nullable(),
  unread: z.number().int().nonnegative(),
  tags: z.array(z.string()),
})
const messageSchema = z.object({
  id: z.string().min(1),
  conversationId: z.string().min(1),
  body: z.string(),
  createdAt: z.string(),
  authorType: z.enum(['customer', 'ai', 'agent']),
  authorName: z.string(),
  status: z.enum([
    'received',
    'queued',
    'sending',
    'sent',
    'failed',
    'unknown',
    'cancelled',
  ]),
})
export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success)
    throw new ApiError(502, '後端回傳格式不正確，請核對操作結果。')
  return result.data
}
function requiredBody(body: string) {
  const value = body.trim()
  if (!value || [...value].length > 5000)
    throw new ApiError(400, '訊息需為 1～5000 字。')
  return value
}
function validVersion(version: number) {
  if (!Number.isSafeInteger(version) || version < 0)
    throw new ApiError(400, '對話版本無效，請重新整理。')
}
function validRequestId(id: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  )
    throw new ApiError(400, '發送識別碼無效。')
}
function safeBase(raw: string): string {
  const url = new URL(raw)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('連線網址必須為 HTTPS，且不可包含帳密或查詢參數。')
  return url.href.replace(/[/]$/, '')
}
function publicKey(key: string) {
  if (key.startsWith('sb_publishable_')) return key
  if (key.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(
        atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
      ) as { role?: string }
      if (payload.role === 'anon') return key
    } catch {
      /* not a public legacy JWT */
    }
  }
  throw new Error('僅能使用 Supabase publishable／anon key，不可放入管理金鑰。')
}
export type ApiConfig = {
  mode?: string
  apiUrl?: string
  supabaseUrl?: string
  publishableKey?: string
}
export function createHelpdeskApi(
  config: ApiConfig = {
    mode: import.meta.env.VITE_HELPDESK_MODE,
    apiUrl: import.meta.env.VITE_ADMIN_API_URL,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  }
): HelpdeskApi {
  if (!config.mode || config.mode === 'demo') return createDemoApi()
  if (config.mode !== 'live')
    throw new Error('VITE_HELPDESK_MODE 僅能設定為 demo 或 live。')
  if (!config.apiUrl || !config.supabaseUrl || !config.publishableKey)
    throw new Error('真實連線模式缺少必要設定；不會自動切回示範。')
  return createLiveApi(config.apiUrl, config.supabaseUrl, config.publishableKey)
}

// 示範資料僅存於這個 adapter 的記憶體；從不呼叫 LINE，也不保存密碼。
export function createDemoApi(): HelpdeskApi {
  const people: Staff[] = [
    {
      id: 'demo-admin',
      name: '課堂主管',
      email: 'teacher@example.test',
      role: 'admin',
    },
    {
      id: 'demo-agent-a',
      name: '客服小安',
      email: 'agent-a@example.test',
      role: 'agent',
    },
    {
      id: 'demo-agent-b',
      name: '客服小賽',
      email: 'agent-b@example.test',
      role: 'agent',
    },
  ]
  const now = new Date().toISOString()
  const conversations: Conversation[] = [
    {
      id: 'demo-1',
      customerName: '示範顧客：林同學',
      preview: '請問課程有提供練習專案嗎？',
      updatedAt: now,
      mode: 'ai',
      version: 0,
      assignedTo: null,
      unread: 1,
      tags: ['課程詢問'],
    },
    {
      id: 'demo-2',
      customerName: '示範顧客：陳同學',
      preview: '我想請真人協助確認需求。',
      updatedAt: now,
      mode: 'human',
      version: 1,
      assignedTo: 'demo-agent-a',
      unread: 0,
      tags: ['真人處理'],
    },
  ]
  const messages: Message[] = [
    {
      id: 'm1',
      conversationId: 'demo-1',
      body: '請問課程有提供練習專案嗎？',
      createdAt: now,
      authorType: 'customer',
      authorName: '林同學',
      status: 'received',
    },
    {
      id: 'm2',
      conversationId: 'demo-1',
      body: '有的，可以從開源起始專案開始，逐步加入自己的功能。',
      createdAt: now,
      authorType: 'ai',
      authorName: 'AI 助理（示範）',
      status: 'sent',
    },
    {
      id: 'm3',
      conversationId: 'demo-2',
      body: '我想請真人協助確認需求。',
      createdAt: now,
      authorType: 'customer',
      authorName: '陳同學',
      status: 'received',
    },
    {
      id: 'm4',
      conversationId: 'demo-2',
      body: '您好，我是小安，請問想完成什麼功能？',
      createdAt: now,
      authorType: 'agent',
      authorName: '客服小安',
      status: 'sent',
    },
  ]
  let user: Staff | null = null
  const sent = new Map<
    string,
    { conversationId: string; body: string; authorId: string; message: Message }
  >()
  const signedIn = () => {
    if (!user) throw new ApiError(401, '請先登入。')
    return user
  }
  const find = (id: string) => {
    signedIn()
    const c = conversations.find((c) => c.id === id)
    if (!c) throw new ApiError(404, '找不到對話。')
    return c
  }
  return {
    mode: 'demo',
    async login(email) {
      user = people.find((p) => p.email === email.trim()) ?? people[0]
      return {
        accessToken: 'demo-only-not-a-real-token',
        staff: structuredClone(user),
      }
    },
    async logout() {
      user = null
    },
    async listConversations() {
      signedIn()
      return structuredClone(conversations)
    },
    async listMessages(id) {
      find(id)
      return structuredClone(messages.filter((m) => m.conversationId === id))
    },
    async listStaff() {
      signedIn()
      return structuredClone(people)
    },
    async sendMessage(id, body, version, requestId) {
      const who = signedIn()
      const c = find(id)
      const text = requiredBody(body)
      validVersion(version)
      validRequestId(requestId)
      const prior = sent.get(requestId)
      if (prior) {
        if (
          prior.conversationId !== id ||
          prior.body !== text ||
          prior.authorId !== who.id
        )
          throw new ApiError(409, '識別碼已用於另一則訊息。')
        return structuredClone(prior.message)
      }
      if (c.version !== version)
        throw new ApiError(409, '對話狀態已改變，請重新整理。')
      if (c.mode !== 'human' || c.assignedTo !== who.id)
        throw new ApiError(403, '請先由本人接手對話。')
      const message: Message = {
        id: crypto.randomUUID(),
        conversationId: id,
        body: text,
        createdAt: new Date().toISOString(),
        authorType: 'agent',
        authorName: who.name,
        status: 'sent',
      }
      messages.push(message)
      c.preview = text
      c.updatedAt = message.createdAt
      sent.set(requestId, {
        conversationId: id,
        body: text,
        authorId: who.id,
        message,
      })
      return structuredClone(message)
    },
    async setMode(id, mode, version) {
      const who = signedIn()
      const c = find(id)
      validVersion(version)
      if (c.version !== version)
        throw new ApiError(409, '對話狀態已改變，請重新整理。')
      if (c.mode === 'human' && c.assignedTo !== who.id && who.role !== 'admin')
        throw new ApiError(403, '只有接手客服或主管能變更。')
      c.mode = mode
      c.assignedTo = mode === 'human' ? who.id : null
      c.version++
      c.updatedAt = new Date().toISOString()
      return structuredClone(c)
    },
  }
}

// 只對受信任的後端呼叫；作者、租戶與 LINE 發送權限一律由伺服器決定。
export function createLiveApi(
  apiUrl: string,
  supabaseUrl: string,
  publishableKey: string
): HelpdeskApi {
  const base = safeBase(apiUrl)
  const authBase = safeBase(supabaseUrl)
  const key = publicKey(publishableKey)
  let token = ''
  let sessionGeneration = 0
  async function request(
    url: string,
    init: RequestInit = {},
    generation = sessionGeneration
  ) {
    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      })
    } catch {
      throw new ApiError(
        0,
        '連線中斷或逾時；請先重新整理確認結果，不要重複發送。'
      )
    }
    if (!response.ok) {
      if (response.status === 401 && generation === sessionGeneration)
        token = ''
      const message =
        response.status === 401
          ? '登入已過期，請重新登入。'
          : response.status === 403
            ? '沒有執行此操作的權限。'
            : response.status === 409
              ? '對話或發送狀態衝突，請重新整理。'
              : '後端無法完成操作，請稍後再試。'
      throw new ApiError(response.status, message)
    }
    if (response.status === 204) return null
    try {
      const reader = response.body?.getReader()
      if (!reader) throw new Error('empty')
      const chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > 1_048_576) {
            await reader.cancel()
            throw new Error('oversize')
          }
          chunks.push(value)
        }
      } finally {
        reader.releaseLock()
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      return JSON.parse(new TextDecoder().decode(bytes)) as unknown
    } catch {
      throw new ApiError(502, '後端回傳格式不正確或過大，請核對操作結果。')
    }
  }
  async function call(path: string, data?: unknown): Promise<unknown> {
    if (!token) throw new ApiError(401, '請先登入。')
    const generation = sessionGeneration
    return request(
      base + path,
      {
        method: data === undefined ? 'GET' : 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: data === undefined ? undefined : JSON.stringify(data),
      },
      generation
    )
  }
  const segment = (id: string) => {
    if (
      !id ||
      id.length > 200 ||
      ['/', String.fromCharCode(92), '?', '#', '%'].some((char) =>
        id.includes(char)
      ) ||
      id === '.' ||
      id === '..'
    )
      throw new ApiError(400, '對話識別碼無效。')
    return encodeURIComponent(id)
  }
  return {
    mode: 'live',
    async login(email, password): Promise<Session> {
      const generation = ++sessionGeneration
      token = ''
      if (!email.trim() || !password)
        throw new ApiError(400, '請輸入帳號與密碼。')
      const auth = parse(
        z.object({ access_token: z.string().min(1) }),
        await request(authBase + '/auth/v1/token?grant_type=password', {
          method: 'POST',
          headers: { apikey: key },
          body: JSON.stringify({ email: email.trim(), password }),
        })
      )
      if (generation !== sessionGeneration)
        throw new ApiError(409, '登入狀態已變更。')
      token = auth.access_token
      try {
        const staff = parse(staffSchema, await call('/session'))
        if (generation !== sessionGeneration)
          throw new ApiError(409, '登入狀態已變更。')
        return { accessToken: token, staff }
      } catch (error) {
        if (generation === sessionGeneration) token = ''
        throw error
      }
    },
    async logout() {
      const old = token
      const generation = ++sessionGeneration
      token = ''
      if (old)
        await request(
          authBase + '/auth/v1/logout?scope=local',
          {
            method: 'POST',
            headers: { apikey: key, Authorization: 'Bearer ' + old },
          },
          generation
        )
    },
    async listConversations() {
      return parse(
        z.array(conversationSchema).max(100),
        await call('/conversations')
      )
    },
    async listMessages(id) {
      return parse(
        z.array(messageSchema).max(100),
        await call('/conversations/' + segment(id) + '/messages')
      )
    },
    async listStaff() {
      return parse(z.array(staffSchema).max(100), await call('/staff'))
    },
    async sendMessage(id, body, expectedVersion, requestId) {
      const text = requiredBody(body)
      validVersion(expectedVersion)
      validRequestId(requestId)
      return parse(
        messageSchema,
        await call('/conversations/' + segment(id) + '/messages', {
          body: text,
          expectedVersion,
          requestId,
        })
      )
    },
    async setMode(id, mode, expectedVersion) {
      validVersion(expectedVersion)
      return parse(
        conversationSchema,
        await call('/conversations/' + segment(id) + '/mode', {
          mode,
          expectedVersion,
        })
      )
    },
  }
}
