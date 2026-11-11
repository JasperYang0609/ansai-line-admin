import { afterEach, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import { createDemoApi } from '../api'
import { HelpdeskApp } from '../app'
import '../app.css'
import type { CalendarApi, BookingRecord } from '../calendar-client'
import { BookingCalendarPage } from './booking-calendar'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('shows a real leap-year month, changes months across years, selects dates and returns to today', async () => {
  vi.setSystemTime(new Date(2024, 1, 15, 12))
  await render(<BookingCalendarPage />)
  await expect
    .element(page.getByRole('table'))
    .toHaveAccessibleName('2024年2月日期瀏覽')
  expect(document.querySelectorAll('.booking-day')).toHaveLength(42)
  await page.getByRole('button', { name: /2024年2月29日/ }).click()
  await expect
    .element(page.getByRole('button', { name: /2024年2月29日/ }))
    .toHaveAttribute('aria-pressed', 'true')
  await expect
    .element(page.getByRole('heading', { name: /2024年2月29日/ }))
    .toBeVisible()
  await page.getByRole('button', { name: '上一個月' }).click()
  await page.getByRole('button', { name: '上一個月' }).click()
  await expect
    .element(page.getByRole('table'))
    .toHaveAccessibleName('2023年12月日期瀏覽')
  await page.getByRole('button', { name: '下一個月' }).click()
  await expect
    .element(page.getByRole('table'))
    .toHaveAccessibleName('2024年1月日期瀏覽')
  await page.getByRole('button', { name: '今天', exact: true }).click()
  await expect
    .element(page.getByRole('button', { name: /2024年2月15日/ }))
    .toHaveAttribute('aria-current', 'date')
  await expect
    .element(page.getByRole('button', { name: /2024年2月15日/ }))
    .toHaveAttribute('aria-pressed', 'true')
})

it('has no fake appointments, connection success, API requests or persistent settings', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch')
  const storage = vi.spyOn(Storage.prototype, 'setItem')
  await render(<BookingCalendarPage />)
  await expect
    .element(page.getByRole('button', { name: '連接 Google（待開放）' }))
    .toBeDisabled()
  await expect
    .element(page.getByText('預約資料尚未載入', { exact: true }))
    .toBeVisible()
  await expect
    .element(page.getByText('僅供日期瀏覽，不代表可預約時段。'))
    .toBeVisible()
  await page.getByRole('button', { name: '下一個月' }).click()
  await page.getByText('設定前須知', { exact: true }).click()
  await expect
    .element(page.getByRole('link', { name: /查看安裝與授權指南/ }))
    .toHaveAttribute('rel', 'noopener noreferrer')
  expect(fetch).not.toHaveBeenCalled()
  expect(storage).not.toHaveBeenCalled()
})

it('opens from the sidebar, preserves the inbox draft and does not send or switch AI mode', async () => {
  await page.viewport(1440, 900)
  const api = createDemoApi()
  const send = vi.spyOn(api, 'sendMessage')
  const mode = vi.spyOn(api, 'setMode')
  await render(<HelpdeskApp api={api} />)
  await page.getByRole('button', { name: '進入示範工作台' }).click()
  await page.getByRole('button', { name: /示範顧客：林同學/ }).click()
  await page.getByRole('button', { name: '接手對話' }).click()
  const calls = mode.mock.calls.length
  await page.getByRole('textbox', { name: /回覆訊息/ }).fill('尚未送出的草稿')
  await page.getByRole('button', { name: '預約行事曆', exact: true }).click()
  await expect
    .element(page.getByRole('heading', { name: '預約行事曆', exact: true }))
    .toBeVisible()
  await expect
    .element(page.getByRole('button', { name: '預約行事曆', exact: true }))
    .toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: /^收件匣/ }).click()
  await expect
    .element(page.getByRole('textbox', { name: /回覆訊息/ }))
    .toHaveValue('尚未送出的草稿')
  expect(send).not.toHaveBeenCalled()
  expect(mode.mock.calls).toHaveLength(calls)
})

function calendarFixture(): CalendarApi {
  return {
    status: vi.fn(async () => ({ state: 'connected' as const, isOwner: true })),
    settings: vi.fn(async () => ({ settings: null })),
    bookings: vi.fn(async () => ({ bookings: [] })),
    calendars: vi.fn(async () => ({ calendars: [] })),
    counts: vi.fn(async () => ({ counts: [] })),
    sync: vi.fn(async () => ({
      checked: 1,
      updated: 0,
      cancelled: 0,
      conflicts: 0,
      failed: 0,
      remaining: 0,
    })),
    changeBooking: vi.fn(async () => ({
      bookingId: '合成預約',
      status: 'confirmed' as const,
    })),
    connect: vi.fn(async () => ''),
    save: vi.fn(async () => ({ version: 1 })),
    pause: vi.fn(async () => ({ enabled: false as const })),
    reconcile: vi.fn(async () => ({ status: 'confirmed' as const })),
    approve: vi.fn(async () => ({ approved: true as const })),
  }
}

it('日期下方以完整日統計顯示筆數，零筆不擠畫面，不以第一頁代替總數', async () => {
  vi.setSystemTime(new Date(2026, 10, 10, 12))
  const api = calendarFixture()
  api.counts = vi.fn(async () => ({
    counts: [{ date: '2026-11-11', count: 205 }],
  }))
  // 列表仍是第一頁；日統計獨立來自後端完整範圍。
  api.bookings = vi.fn(async () => ({
    bookings: [],
    next: { createdAt: '2026-11-01T00:00:00Z', id: 'synthetic' },
  }))
  await render(<BookingCalendarPage calendar={api} />)
  await expect
    .element(page.getByRole('button', { name: /2026年11月11日.*205 筆預約/ }))
    .toHaveTextContent('205')
  await expect
    .element(page.getByRole('button', { name: /2026年11月12日/ }))
    .toHaveTextContent('12')
  expect(document.querySelectorAll('.booking-day-count')).toHaveLength(1)
  const badge = document.querySelector('.booking-day-count')!
  expect(badge.textContent).toBe('205')
  expect(getComputedStyle(badge).borderRadius).toBe('50%')
  expect(badge.getBoundingClientRect().width).toBe(
    badge.getBoundingClientRect().height
  )
  const dates = [...document.querySelectorAll('.booking-day')].slice(7, 14)
  const centers = dates.map((day) => {
    const number = day.firstElementChild!.getBoundingClientRect()
    const cell = day.getBoundingClientRect()
    expect(
      Math.abs(number.top + number.height / 2 - cell.top - cell.height / 2 + 6)
    ).toBeLessThan(1)
    return number.top
  })
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(1)

  expect(api.counts).toHaveBeenCalledWith('2026-11-01', '2026-12-12')
  expect(api.sync).not.toHaveBeenCalled()
})

it('Google 刪除同步後更新每日筆數，保留取消紀錄而不再顯示預約徽章', async () => {
  vi.setSystemTime(new Date(2026, 10, 11, 12))
  const api = calendarFixture()
  let cancelled = false
  const row: BookingRecord = {
    id: 'synthetic',
    conversationId: 'synthetic',
    eventId: 'synthetic',
    start: '2026-11-11T02:00:00Z',
    end: '2026-11-11T03:00:00Z',
    status: 'confirmed',
    service: '合成預約',
    timeZone: 'Asia/Taipei',
  }
  api.bookings = vi.fn(async () => ({
    bookings: [
      {
        ...row,
        status: cancelled ? ('cancelled' as const) : ('confirmed' as const),
      },
    ],
  }))
  api.counts = vi.fn(async () => ({
    counts: cancelled ? [] : [{ date: '2026-11-11', count: 1 }],
  }))
  api.sync = vi.fn(async () => {
    cancelled = true
    return {
      checked: 1,
      updated: 0,
      cancelled: 1,
      conflicts: 0,
      failed: 0,
      remaining: 0,
    }
  })
  await render(<BookingCalendarPage calendar={api} />)
  await expect
    .element(page.getByRole('button', { name: /2026年11月11日.*1 筆預約/ }))
    .toBeVisible()
  await page.getByRole('button', { name: '同步 Google 並重新整理' }).click()
  await expect
    .element(page.getByRole('button', { name: /2026年11月11日.*0 筆預約/ }))
    .toBeVisible()
  expect(document.querySelectorAll('.booking-day-count')).toHaveLength(0)
  await expect.element(page.getByText('已取消', { exact: true })).toBeVisible()
})

it('統計失敗顯示未知而非零筆；切月後不套用前一月份晚到回應', async () => {
  vi.setSystemTime(new Date(2026, 10, 10, 12))
  const api = calendarFixture()
  let finish!: (v: { counts: { date: string; count: number }[] }) => void
  api.counts = vi.fn((start) =>
    start === '2026-11-01'
      ? new Promise<Awaited<ReturnType<CalendarApi['counts']>>>((resolve) => {
          finish = resolve
        })
      : Promise.reject(Error('合成中斷'))
  )
  await render(<BookingCalendarPage calendar={api} />)
  await expect.poll(() => api.counts).toHaveBeenCalledTimes(1)
  await page.getByRole('button', { name: '下一個月' }).click()
  await expect.element(page.getByText(/預約筆數讀取失敗/)).toBeVisible()
  finish({ counts: [{ date: '2026-11-30', count: 99 }] })
  await expect
    .element(page.getByRole('table'))
    .toHaveAccessibleName('2026年12月日期瀏覽')
  await expect
    .element(page.getByRole('button', { name: /2026年11月30日/ }))
    .not.toHaveTextContent('99 筆預約')
  expect(document.querySelectorAll('.booking-day-count')).toHaveLength(0)
})

it('320px 有筆數的日期仍可點選且不水平溢位', async () => {
  vi.setSystemTime(new Date(2026, 10, 10, 12))
  await page.viewport(320, 900)
  const api = calendarFixture()
  api.counts = vi.fn(async () => ({
    counts: [{ date: '2026-11-11', count: 205 }],
  }))
  await render(
    <div className='helpdesk-app' data-theme='light'>
      <BookingCalendarPage calendar={api} />
    </div>
  )
  await expect
    .element(page.getByRole('button', { name: /2026年11月11日.*205 筆預約/ }))
    .toBeVisible()
  await page.getByRole('button', { name: /2026年11月11日.*205 筆預約/ }).click()
  await expect
    .element(page.getByRole('button', { name: /2026年11月11日.*205 筆預約/ }))
    .toHaveAttribute('aria-pressed', 'true')
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    window.innerWidth
  )
})

it('客服看得到預約、可新增及取消，沒有 Google 授權或設定權限', async () => {
  vi.setSystemTime(new Date(2026, 10, 11, 12))
  const api = calendarFixture()
  api.status = vi.fn(async () => ({
    state: 'connected' as const,
    isOwner: false,
    canManage: false,
    canBook: true,
    service: { name: '合成諮詢', timeZone: 'Asia/Taipei', durationMinutes: 60 },
  }))
  const booking = {
    id: '合成預約',
    eventId: '合成事件',
    conversationId: null,
    service: '合成諮詢',
    customerName: '合成來店客戶',
    status: 'confirmed' as const,
    start: '2026-11-11T02:00:00Z',
    end: '2026-11-11T03:00:00Z',
    timeZone: 'Asia/Taipei',
    updatedAt: '2026-11-11T01:00:00Z',
  }
  let rows: Awaited<ReturnType<CalendarApi['bookings']>>['bookings'] = []
  api.bookings = vi.fn(async () => ({ bookings: rows }))
  api.changeBooking = vi.fn(async (input) => {
    rows = [
      input.kind === 'cancel' ? { ...booking, status: 'cancelled' } : booking,
    ]
    return {
      bookingId: booking.id,
      status:
        input.kind === 'cancel'
          ? ('cancelled' as const)
          : ('confirmed' as const),
    }
  })
  await render(<BookingCalendarPage calendar={api} />)
  await page.getByRole('button', { name: '新增預約', exact: true }).click()
  await page.getByLabelText('客戶姓名').fill('合成來店客戶')
  await page.getByRole('button', { name: '儲存預約' }).click()
  await expect
    .element(page.getByText('合成來店客戶', { exact: true }))
    .toBeVisible()
  expect(api.settings).not.toHaveBeenCalled()
  await expect
    .element(page.getByRole('button', { name: '重新連接 Google' }))
    .not.toBeInTheDocument()
  await page.getByRole('button', { name: '取消預約', exact: true }).click()
  await page.getByRole('button', { name: '確認取消' }).click()
  await expect.element(page.getByText('已取消', { exact: true })).toBeVisible()
  expect(api.changeBooking).toHaveBeenLastCalledWith(
    expect.objectContaining({
      kind: 'cancel',
      expectedUpdatedAt: booking.updatedAt,
    })
  )
})
