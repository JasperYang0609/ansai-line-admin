import { expect, it, vi } from 'vitest'
import { createCalendarApi } from './calendar-client'

it('日曆連接只回傳已檢查的 Google 網址，不接受外部或含憑證連結', async () => {
  for (const authorizationUrl of [
    'https://foreign.example.test/',
    'https://accounts.google.com/o/oauth2/v2/auth?access_token=secret',
  ]) {
    const api = createCalendarApi(async () => ({ authorizationUrl }))
    await expect(api.connect()).rejects.toThrow()
  }
  const url =
    'https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&code_challenge_method=S256'
  const call = vi.fn(async () => ({ authorizationUrl: url }))
  const api = createCalendarApi(call)
  expect(await api.connect()).toBe(url)
  expect(call).toHaveBeenCalledWith('/calendar/connect', { method: 'POST' })
})
it('日曆錯誤不可當零筆，狀態回應不保留未知秘密欄位', async () => {
  const api = createCalendarApi(async () => ({
    state: 'connected',
    isOwner: true,
    refreshToken: '不得回傳',
  }))
  expect(await api.status()).toEqual({ state: 'connected', isOwner: true })
  await expect(api.bookings()).rejects.toThrow('日曆回應不完整')
  const unavailable = createCalendarApi(async () => {
    throw Error('合成中斷')
  })
  await expect(unavailable.bookings()).rejects.toThrow('合成中斷')
})
it('資格核准綁定指定對話與已讀服務版本，不提交前端員工或租戶身分', async () => {
  const call = vi.fn(async () => ({ approved: true }))
  await createCalendarApi(call).approve('synthetic-conversation', 3)
  expect(call).toHaveBeenCalledWith('/calendar/approve', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: 'synthetic-conversation',
      settingsVersion: 3,
    }),
  })
})

it('較早預約使用後端分頁，不把第一頁當成全部歷史', async () => {
  const call = vi.fn(async () => ({ bookings: [], next: null })),
    cursor = { createdAt: '2026-01-01T00:00:00Z', id: 'synthetic-id' }
  await createCalendarApi(call).bookings(cursor)
  expect(call).toHaveBeenCalledWith(
    '/calendar/bookings?' +
      new URLSearchParams({ beforeAt: cursor.createdAt, beforeId: cursor.id })
  )
})
